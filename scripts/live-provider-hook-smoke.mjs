#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runProvider = process.argv.includes("--run-provider") && process.env.FOOKS_LIVE_PROVIDER_SMOKE === "1";
const runCodex = !process.argv.includes("--skip-codex");
const runClaude = !process.argv.includes("--skip-claude");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    input: options.input,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

function commandVersion(command, args = ["--version"]) {
  try {
    return run(command, args).trim();
  } catch (error) {
    return `unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not emit JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseJsonLines(stdout) {
  return stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { type: "non_json_line", line };
    }
  });
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
}

function restoreBackup(backupPath, targetPath, existed) {
  if (existed) {
    fs.copyFileSync(backupPath, targetPath);
  } else if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true });
  }
}

function installPackedFooks() {
  run("npm", ["run", "build"]);
  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-live-pack-"));
  const tarballName = run("npm", ["pack", "--pack-destination", packDir]).trim().split(/\r?\n/).at(-1);
  const tarballPath = path.join(packDir, tarballName);
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-live-prefix-"));
  run("npm", ["install", "-g", "--prefix", prefix, tarballPath]);
  return {
    tarballPath,
    prefix,
    fooksBin: path.join(prefix, "bin", "fooks"),
    pathEnv: `${path.join(prefix, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
  };
}

function createFixtureProject() {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-live-provider-"));
  fs.mkdirSync(path.join(project, "src", "components"), { recursive: true });
  fs.writeFileSync(path.join(project, "package.json"), `${JSON.stringify({
    name: "fooks-live-provider-smoke",
    repository: { url: "https://github.com/example-org/fooks-live-provider-smoke.git" },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(project, "src", "components", "Card.tsx"), [
    "export function Card() {",
    "  return (",
    "    <section>",
    "      <h2>fooks live provider smoke</h2>",
    "      <p>This component verifies project-local hook activation.</p>",
    "    </section>",
    "  );",
    "}",
    "",
  ].join("\n"));
  return project;
}

function summarizeHookEvents(events) {
  return events.filter((event) => {
    const text = JSON.stringify(event);
    return /hook|SessionStart|UserPromptSubmit|additionalContext|fooks/i.test(text);
  }).slice(0, 20).map((event) => {
    const text = JSON.stringify(event);
    return text.length > 600 ? `${text.slice(0, 600)}…` : text;
  });
}

function runCodexProviderSmoke(project, env) {
  const outputPath = path.join(project, ".fooks", "live-codex-last-message.txt");
  const stdout = run("codex", [
    "exec",
    "--cd", project,
    "--sandbox", "read-only",
    "--ephemeral",
    "--json",
    "--output-last-message", outputPath,
    "Reply with exactly FOOKS_CODEX_LIVE_OK after considering src/components/Card.tsx. Do not edit files.",
  ], { cwd: project, env });
  const events = parseJsonLines(stdout);
  return {
    command: "codex exec --json --ephemeral",
    outputPath,
    lastMessageExists: fs.existsSync(outputPath),
    hookEventHints: summarizeHookEvents(events),
  };
}

function runClaudeProviderSmoke(project, env) {
  const stdout = run("claude", [
    "--print",
    "--output-format=stream-json",
    "--include-hook-events",
    "--max-budget-usd", process.env.FOOKS_LIVE_CLAUDE_MAX_BUDGET_USD ?? "0.05",
    "--tools", "",
    "--no-session-persistence",
    "Reply with exactly FOOKS_CLAUDE_LIVE_OK after considering src/components/Card.tsx. Do not edit files.",
  ], { cwd: project, env });
  const events = parseJsonLines(stdout);
  return {
    command: "claude --print --output-format=stream-json --include-hook-events",
    hookEventHints: summarizeHookEvents(events),
    eventCount: events.length,
  };
}

const cliVersions = {
  codex: commandVersion("codex"),
  claude: commandVersion("claude"),
};

if (!runProvider) {
  console.log(JSON.stringify({
    ok: true,
    skippedProviderCalls: true,
    reason: "Provider-backed live smoke is opt-in to avoid accidental token/account spend.",
    cliVersions,
    runCommand: "FOOKS_LIVE_PROVIDER_SMOKE=1 node scripts/live-provider-hook-smoke.mjs --run-provider",
    optionalFlags: ["--skip-codex", "--skip-claude"],
    claimBoundary: "This script can gather live CLI hook evidence, but it is not provider billing-token or provider-cost proof.",
  }, null, 2));
  process.exit(0);
}

const { fooksBin, pathEnv, tarballPath } = installPackedFooks();
const project = createFixtureProject();
const codexHome = process.env.FOOKS_LIVE_CODEX_HOME ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
const claudeHome = process.env.FOOKS_LIVE_CLAUDE_HOME ?? path.join(os.homedir(), ".claude");
const env = {
  PATH: pathEnv,
  FOOKS_CODEX_HOME: codexHome,
  FOOKS_CLAUDE_HOME: claudeHome,
};

const codexHooksPath = path.join(codexHome, "hooks.json");
const codexHooksBackup = path.join(project, ".fooks", "codex-hooks.backup.json");
const codexHooksExisted = copyIfExists(codexHooksPath, codexHooksBackup);

try {
  const setup = parseJson(run(fooksBin, ["setup"], { cwd: project, env }), "fooks setup");
  assert(setup.runtimes?.codex?.state === "automatic-ready", `Codex setup was not automatic-ready: ${setup.runtimes?.codex?.state}`);
  assert(setup.runtimes?.claude?.state === "context-hook-ready", `Claude setup was not context-hook-ready: ${setup.runtimes?.claude?.state}`);

  const provider = {};
  if (runCodex) provider.codex = runCodexProviderSmoke(project, env);
  if (runClaude) provider.claude = runClaudeProviderSmoke(project, env);

  const status = parseJson(run(fooksBin, ["status"], { cwd: project, env }), "fooks status");
  assert(status.metricTier === "estimated", `status metricTier should be estimated, got ${status.metricTier}`);
  assert(status.claimBoundary?.includes("not provider billing tokens"), "status should preserve provider billing-token boundary");

  console.log(JSON.stringify({
    ok: true,
    project,
    tarballPath,
    cliVersions,
    setupSummary: setup.summary,
    provider,
    status: {
      metricTier: status.metricTier,
      latestSessionCount: status.latestSessionCount,
      runtimeSources: Object.keys(status.breakdown?.byRuntimeAndSource ?? {}).sort(),
      claimBoundary: status.claimBoundary,
    },
    claimBoundary: "Live CLI smoke proves installed CLI hook activation and local estimated status evidence only; it is not provider billing-token or provider-cost proof.",
  }, null, 2));
} finally {
  restoreBackup(codexHooksBackup, codexHooksPath, codexHooksExisted);
}
