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
assert(setup.runtimes?.claude?.state === "handoff-ready", `unexpected Claude setup state ${setup.runtimes?.claude?.state}`);
assert(setup.runtimes?.claude?.blocksOverall === false, "Claude readiness should be non-fatal for overall setup");
assert(setup.runtimes?.opencode?.state === "tool-ready", `unexpected opencode setup state ${setup.runtimes?.opencode?.state}`);
assert(setup.runtimes?.opencode?.blocksOverall === false, "opencode readiness should be non-fatal for overall setup");
assert(setup.attach?.runtimeProof?.details?.includes("account-source=package-repository"), "setup should derive public repo account context from package metadata");
assert(setup.scope?.schemaVersion === 1, "setup should report scope summary schema");
assert(setup.scope?.packageInstall?.scope === "global-cli", "setup scope should distinguish global CLI package install");
assert(setup.scope?.packageInstall?.mutatedBySetup === false, "setup must not imply npm package install mutation");
const setupProjectRoot = fs.realpathSync(project);
assert(setup.scope?.projectLocal?.root === setupProjectRoot, "setup scope should identify the current project root");
assert(setup.scope?.projectLocal?.paths?.includes(path.join(setupProjectRoot, ".fooks", "config.json")), "setup scope should include project-local .fooks config");
assert(setup.scope?.projectLocal?.paths?.includes(path.join(setupProjectRoot, ".opencode", "tools", "fooks_extract.ts")), "setup scope should include project-local opencode tool");
assert(setup.scope?.userRuntime?.paths?.includes(path.join(codexHome, "hooks.json")), "setup scope should include isolated Codex hooks path");
assert(setup.scope?.userRuntime?.paths?.some((item) => item.startsWith(path.join(codexHome, "fooks", "attachments"))), "setup scope should include isolated Codex runtime manifest path");
assert(setup.scope?.nonGoals?.some((item) => item.includes("No --scope option")), "setup scope should document that no new scope option is required");
assert(fs.existsSync(path.join(codexHome, "hooks.json")), "isolated Codex hooks file should be written under FOOKS_CODEX_HOME");
assert(fs.existsSync(path.join(project, ".opencode", "tools", "fooks_extract.ts")), "opencode helper should be installed project-locally");
assert(fs.existsSync(path.join(project, ".opencode", "commands", "fooks-extract.md")), "opencode slash command should be installed project-locally");

console.log(JSON.stringify({
  ok: true,
  package: dryRun.id,
  tarball: tarballPath,
  installedBinary: fooksBin,
  setupSummary: setup.summary,
  accountDetails: setup.attach.runtimeProof.details.filter((detail) => detail.startsWith("account-")),
}, null, 2));
