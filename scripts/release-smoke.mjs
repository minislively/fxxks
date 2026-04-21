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

  for (const file of packEntry.files) {
    assert(!file.path.startsWith("docs/archive/"), `packed tarball should not include internal archive docs: ${file.path}`);
    assert(!file.path.startsWith("benchmarks/frontend-harness/reports/"), `packed tarball should not include internal benchmark reports: ${file.path}`);
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
