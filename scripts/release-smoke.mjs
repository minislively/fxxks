#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parsePackJson(stdout) {
  const parsed = JSON.parse(stdout);
  assert(Array.isArray(parsed) && parsed.length === 1, "npm pack --json should return one package entry");
  return parsed[0];
}


function assertNoForbiddenPublicClaims(label, text) {
  const forbidden = [
    /provider billing-token reduction/i,
    /billing-token savings/i,
    /provider cost savings/i,
    /Claude Read interception is enabled/i,
    /Claude runtime-token savings are enabled/i,
    /automatic Claude runtime-token savings/i,
  ];
  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${label} contains forbidden positive claim ${pattern}`);
  }

  for (const line of text.split(/\r?\n/)) {
    if (/ccusage replacement/i.test(line)) {
      assert(/not (?:a )?ccusage replacement|not provider billing tokens, provider costs, or a ccusage replacement/i.test(line), `${label} contains unbounded ccusage replacement wording: ${line}`);
    }
    if (/\.omx\//i.test(line) || /\.omx\/state/i.test(line)) {
      assert(/internal|harness|planning/i.test(line), `${label} exposes .omx as product state: ${line}`);
    }
  }
}

function assertPublicSurfaceClaimBoundaries(surfaces) {
  for (const [label, text] of Object.entries(surfaces)) {
    assertNoForbiddenPublicClaims(label, text);
  }
}

function assertPackedFiles(packEntry) {
  const paths = new Set(packEntry.files.map((file) => file.path));
  const required = [
    "package.json",
    "README.md",
    "dist/cli/index.js",
    "dist/index.js",
    "dist/adapters/codex.js",
    "dist/adapters/claude.js",
    "dist/adapters/opencode-tool-preset.js",
    "docs/setup.md",
    "docs/release.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
  ];

  for (const filePath of required) {
    assert(paths.has(filePath), `packed tarball missing ${filePath}`);
  }

  const forbiddenPrefixes = [
    "benchmarks/",
    "docs/archive/",
    "docs/benchmarks/",
    "docs/cli/",
    "docs/internal/",
  ];
  const forbiddenFiles = new Set([
    "docs/BENCHMARK_ENVIRONMENT_AUDIT.md",
    "docs/RISK_AND_MONITORING.md",
    "docs/codex-live-feedback-checklist.md",
    "docs/performance-vs-operational-complexity.md",
    "docs/real-environment-process-model-validation.md",
    "docs/real-repo-validation.md",
    "docs/runtime-bridge-contract.md",
    "docs/today-execution-plan.md",
  ]);

  for (const filePath of paths) {
    assert(!forbiddenFiles.has(filePath), `packed tarball includes internal doc ${filePath}`);
    assert(!forbiddenPrefixes.some((prefix) => filePath.startsWith(prefix)), `packed tarball includes non-public path ${filePath}`);
  }
}

const dryRun = parsePackJson(run("npm", ["pack", "--dry-run", "--json"]));
assertPackedFiles(dryRun);

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-pack-"));
const tarballName = run("npm", ["pack", "--pack-destination", packDir]).trim().split(/\r?\n/).at(-1);
const tarballPath = path.join(packDir, tarballName);
assert(fs.existsSync(tarballPath), `tarball not found at ${tarballPath}`);

const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-prefix-"));
run("npm", ["install", "-g", "--prefix", prefix, tarballPath]);
const fooksBin = path.join(prefix, "bin", "fooks");
assert(fs.existsSync(fooksBin), `installed fooks binary not found at ${fooksBin}`);

assertPublicSurfaceClaimBoundaries({
  "README.md": fs.readFileSync(path.join(repoRoot, "README.md"), "utf8"),
  "docs/setup.md": fs.readFileSync(path.join(repoRoot, "docs", "setup.md"), "utf8"),
  "docs/release.md": fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8"),
  "dist/cli/index.js": fs.readFileSync(path.join(repoRoot, "dist", "cli", "index.js"), "utf8"),
});

const project = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-project-"));
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-"));
const codexHome = path.join(runtimeRoot, "codex");
const claudeHome = path.join(runtimeRoot, "claude");
fs.mkdirSync(path.join(project, "src"), { recursive: true });
fs.mkdirSync(codexHome, { recursive: true });
fs.mkdirSync(claudeHome, { recursive: true });
fs.writeFileSync(
  path.join(project, "package.json"),
  `${JSON.stringify({ name: "tmp-fooks-release-smoke", repository: { url: "https://github.com/example-org/tmp-fooks-release-smoke.git" } }, null, 2)}\n`,
);
fs.writeFileSync(path.join(project, "src", "App.tsx"), "export function App(){ return <main>Hello</main>; }\n");

const setupStdout = execFileSync(fooksBin, ["setup"], {
  cwd: project,
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: path.join(runtimeRoot, "home"),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
    FOOKS_ACTIVE_ACCOUNT: "",
    FOOKS_TARGET_ACCOUNT: "",
  },
});
const setup = JSON.parse(setupStdout);
assert(setup.ready === true, `expected setup.ready=true, got ${setup.ready}`);
assert(setup.runtimes?.codex?.state === "automatic-ready", `unexpected Codex setup state ${setup.runtimes?.codex?.state}`);
assert(setup.runtimes?.codex?.blocksOverall === true, "Codex should be the only overall-blocking runtime");
assert(setup.runtimes?.claude?.state === "context-hook-ready", `unexpected Claude setup state ${setup.runtimes?.claude?.state}`);
assert(setup.runtimes?.claude?.blocksOverall === false, "Claude readiness should be non-fatal for overall setup");
assert(setup.runtimes?.opencode?.state === "tool-ready", `unexpected opencode setup state ${setup.runtimes?.opencode?.state}`);
assert(setup.runtimes?.opencode?.blocksOverall === false, "opencode readiness should be non-fatal for overall setup");
assert(setup.attach?.runtimeProof?.details?.includes("account-source=package-repository"), "setup should derive public repo account context from package metadata");

const statusStdout = execFileSync(fooksBin, ["status"], {
  cwd: project,
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: path.join(runtimeRoot, "home"),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  },
});
const claudeStatusStdout = execFileSync(fooksBin, ["status", "claude"], {
  cwd: project,
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: path.join(runtimeRoot, "home"),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  },
});
assertPublicSurfaceClaimBoundaries({
  "fooks setup output": setupStdout,
  "fooks status output": statusStdout,
  "fooks status claude output": claudeStatusStdout,
});
const status = JSON.parse(statusStdout);
assert(status.claimBoundary?.includes("not provider billing tokens"), "status should keep provider billing boundary");
assert(status.breakdown && typeof status.breakdown === "object", "status should expose runtime/source breakdown");
assert(fs.existsSync(path.join(codexHome, "hooks.json")), "isolated Codex hooks file should be written under FOOKS_CODEX_HOME");
const claudeLocalSettings = path.join(project, ".claude", "settings.local.json");
assert(fs.existsSync(claudeLocalSettings), "Claude project-local hooks should be installed under the project");
const claudeSettings = JSON.parse(fs.readFileSync(claudeLocalSettings, "utf8"));
assert(
  JSON.stringify(Object.keys(claudeSettings.hooks ?? {}).sort()) === JSON.stringify(["SessionStart", "UserPromptSubmit"]),
  "Claude smoke hooks should be limited to SessionStart and UserPromptSubmit",
);
assert(
  claudeSettings.hooks?.SessionStart?.[0]?.hooks?.[0]?.command === "fooks claude-runtime-hook --native-hook",
  "Claude SessionStart smoke hook should use the canonical fooks command",
);
assert(
  claudeSettings.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command === "fooks claude-runtime-hook --native-hook",
  "Claude UserPromptSubmit smoke hook should use the canonical fooks command",
);
const claudeNativeEnv = {
  ...process.env,
  HOME: path.join(runtimeRoot, "home"),
  XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
  FOOKS_CODEX_HOME: codexHome,
  FOOKS_CLAUDE_HOME: claudeHome,
};
const firstClaudePrompt = execFileSync(fooksBin, ["claude-runtime-hook", "--native-hook"], {
  cwd: project,
  encoding: "utf8",
  input: JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: project,
    session_id: "release-smoke-claude",
    prompt: "Explain src/App.tsx",
  }),
  env: claudeNativeEnv,
});
assert(firstClaudePrompt === "", "Claude first eligible native prompt should record without emitting context");
const secondClaudePrompt = JSON.parse(execFileSync(fooksBin, ["claude-runtime-hook", "--native-hook"], {
  cwd: project,
  encoding: "utf8",
  input: JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: project,
    session_id: "release-smoke-claude",
    prompt: "Again, explain src/App.tsx",
  }),
  env: claudeNativeEnv,
}));
assert(
  secondClaudePrompt.hookSpecificOutput?.hookEventName === "UserPromptSubmit",
  "Claude repeated same-file native prompt should emit UserPromptSubmit context",
);
assert(
  secondClaudePrompt.hookSpecificOutput?.additionalContext?.includes("src/App.tsx"),
  "Claude repeated same-file native context should reference the target file",
);
assert(fs.existsSync(path.join(project, ".opencode", "tools", "fooks_extract.ts")), "opencode helper should be installed project-locally");
assert(fs.existsSync(path.join(project, ".opencode", "commands", "fooks-extract.md")), "opencode slash command should be installed project-locally");

console.log(JSON.stringify({
  ok: true,
  package: dryRun.id,
  tarball: tarballPath,
  installedBinary: fooksBin,
  setupSummary: setup.summary,
  hookSmokeEvidence: {
    codex: {
      sessionStart: "recorded",
      firstPrompt: "record-only",
      repeatedPrompt: secondCodexPrompt.hookSpecificOutput.hookEventName,
      fallbackSavingsGuard: "zero-savings",
    },
    claude: {
      sessionStart: claudeStart.hookSpecificOutput.hookEventName,
      firstPrompt: "record-only",
      repeatedPrompt: secondClaudePrompt.hookSpecificOutput.hookEventName,
    },
    status: {
      metricTier: postHookStatus.metricTier,
      latestSessionCount: postHookStatus.latestSessionCount,
      runtimeSources: Object.keys(postHookStatus.breakdown.byRuntimeAndSource ?? {}).sort(),
      claimBoundary: postHookStatus.claimBoundary,
    },
  },
  accountDetails: setup.attach.runtimeProof.details.filter((detail) => detail.startsWith("account-")),
}, null, 2));
