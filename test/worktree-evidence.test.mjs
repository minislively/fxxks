// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);

const {
  WORKTREE_EVIDENCE_CLAIM_BOUNDARY,
  WORKTREE_STATUS_COMMAND,
  WORKTREE_BRANCH_DIVERGENCE_SOURCE,
  captureBranchDivergence,
  captureWorktreeSnapshot,
  currentWorktreeEvidenceStatus,
  finalizeWorktreeEvidenceSafe,
  initializeWorktreeEvidenceSafe,
  readWorktreeEvidence,
} = require(path.join(repoRoot, "dist", "core", "worktree-evidence.js"));
const { sessionWorktreeEvidencePath } = require(path.join(repoRoot, "dist", "core", "paths.js"));
const { handleCodexRuntimeHook } = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
const { handleClaudeRuntimeHook } = require(path.join(repoRoot, "dist", "adapters", "claude-runtime-hook.js"));
const { runDoctor } = require(path.join(repoRoot, "dist", "cli", "doctor.js"));

function makeTempProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-worktree-evidence-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "src", "components", "SimpleButton.tsx"), "export function SimpleButton() { return <button />; }\n");
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "temp-project", version: "1.0.0" }, null, 2));
  return tempDir;
}

function run(args, cwd) {
  return JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" }));
}

function outputRunner(output) {
  return () => output;
}

test("captureWorktreeSnapshot parses clean, untracked, conflicted, and rename evidence through the shared parser", () => {
  const clean = captureWorktreeSnapshot("/tmp/project", {
    runner: outputRunner(""),
    now: () => "2026-04-23T00:00:00.000Z",
  });
  assert.deepEqual(clean.blockers, []);
  assert.equal(clean.snapshot.clean, true);
  assert.deepEqual(clean.snapshot.changedPaths, []);

  const dirty = captureWorktreeSnapshot("/tmp/project", {
    runner: outputRunner(" M src/App.tsx\0?? scratch.log\0UU conflict.ts\0R  src/NewName.tsx\0src/OldName.tsx\0"),
    now: () => "2026-04-23T00:00:01.000Z",
  });
  assert.deepEqual(dirty.blockers, []);
  assert.equal(dirty.snapshot.clean, false);
  assert.deepEqual(dirty.snapshot.changedPaths, ["conflict.ts", "scratch.log", "src/App.tsx", "src/NewName.tsx"]);
  assert.deepEqual(dirty.snapshot.trackedPaths, ["conflict.ts", "src/App.tsx", "src/NewName.tsx"]);
  assert.deepEqual(dirty.snapshot.untrackedPaths, ["scratch.log"]);
  assert.deepEqual(dirty.snapshot.conflictedPaths, ["conflict.ts"]);
});

test("session evidence records baseline/latest and computes dirty deltas with a fake runner", () => {
  const tempDir = makeTempProject();
  const sessionKey = "delta-session";
  const outputs = [
    " M existing.txt\0?? scratch.log\0",
    " M existing.txt\0?? new.txt\0UU conflict.ts\0",
  ];
  let calls = 0;
  const runner = () => outputs[calls++] ?? "";

  const initialized = initializeWorktreeEvidenceSafe(tempDir, sessionKey, {
    runner,
    now: () => "2026-04-23T00:00:00.000Z",
  });
  assert.equal(initialized.path, sessionWorktreeEvidencePath(tempDir, sessionKey));
  assert.deepEqual(initialized.evidence.baseline.changedPaths, ["existing.txt", "scratch.log"]);
  assert.deepEqual(initialized.evidence.blockers, []);

  const finalized = finalizeWorktreeEvidenceSafe(tempDir, sessionKey, {
    runner,
    now: () => "2026-04-23T00:01:00.000Z",
  });
  assert.deepEqual(finalized.evidence.latest.changedPaths, ["conflict.ts", "existing.txt", "new.txt"]);
  assert.deepEqual(finalized.evidence.delta, {
    newDirtyPaths: ["conflict.ts", "new.txt"],
    resolvedDirtyPaths: ["scratch.log"],
    stillDirtyPaths: ["existing.txt"],
    conflictedPaths: ["conflict.ts"],
  });

  const onDisk = readWorktreeEvidence(tempDir, sessionKey);
  assert.deepEqual(onDisk.delta, finalized.evidence.delta);
  assert.equal(onDisk.claimBoundary, WORKTREE_EVIDENCE_CLAIM_BOUNDARY);
  assert.equal(onDisk.command, WORKTREE_STATUS_COMMAND);
});

test("session evidence keeps clean-to-dirty and dirty-to-clean deltas distinct", () => {
  const tempDir = makeTempProject();
  const sessionKey = "clean-dirty-session";
  const outputs = ["", "?? new.txt\0"];
  let calls = 0;

  initializeWorktreeEvidenceSafe(tempDir, sessionKey, { runner: () => outputs[calls++] ?? "" });
  const dirty = finalizeWorktreeEvidenceSafe(tempDir, sessionKey, { runner: () => outputs[calls++] ?? "" });
  assert.deepEqual(dirty.evidence.delta.newDirtyPaths, ["new.txt"]);
  assert.deepEqual(dirty.evidence.delta.resolvedDirtyPaths, []);
  assert.deepEqual(dirty.evidence.delta.stillDirtyPaths, []);

  const secondSession = "dirty-clean-session";
  let secondCalls = 0;
  const secondOutputs = [" M fixed.ts\0", ""];
  initializeWorktreeEvidenceSafe(tempDir, secondSession, { runner: () => secondOutputs[secondCalls++] ?? "" });
  const clean = finalizeWorktreeEvidenceSafe(tempDir, secondSession, { runner: () => secondOutputs[secondCalls++] ?? "" });
  assert.deepEqual(clean.evidence.delta.newDirtyPaths, []);
  assert.deepEqual(clean.evidence.delta.resolvedDirtyPaths, ["fixed.ts"]);
  assert.deepEqual(clean.evidence.delta.stillDirtyPaths, []);
});

test("capture and status report blockers without throwing when local status is unavailable", () => {
  const tempDir = makeTempProject();
  const runner = () => {
    throw new Error("synthetic status failure");
  };

  const captured = captureWorktreeSnapshot(tempDir, { runner });
  assert.equal(captured.snapshot, undefined);
  assert.match(captured.blockers[0], /synthetic status failure/);

  const initialized = initializeWorktreeEvidenceSafe(tempDir, "blocked-session", { runner });
  assert.equal(initialized.evidence.baseline, undefined);
  assert.match(initialized.evidence.blockers[0], /synthetic status failure/);

  const current = currentWorktreeEvidenceStatus(tempDir, { runner, now: () => "2026-04-23T00:02:00.000Z" });
  assert.equal(current.snapshot, undefined);
  assert.equal(current.capturedAt, "2026-04-23T00:02:00.000Z");
  assert.match(current.blockers[0], /synthetic status failure/);
});

test("runtime hooks write sidecars only at session boundaries and tolerate unavailable worktree status", () => {
  const tempDir = makeTempProject();
  const codexSession = "codex-worktree-sidecar";
  const claudeSession = "claude-worktree-sidecar";
  const target = path.join("src", "components", "SimpleButton.tsx");

  const codexPromptOnly = "codex-prompt-only";
  handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: codexPromptOnly, prompt: `Review ${target}` }, tempDir);
  assert.equal(fs.existsSync(sessionWorktreeEvidencePath(tempDir, codexPromptOnly)), false);

  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: codexSession }, tempDir);
  const codexStart = readWorktreeEvidence(tempDir, codexSession);
  assert.ok(codexStart);
  assert.match(codexStart.blockers.join("\n"), /worktree status unavailable/);
  handleCodexRuntimeHook({ hookEventName: "Stop", sessionId: codexSession }, tempDir);
  const codexStop = readWorktreeEvidence(tempDir, codexSession);
  assert.ok(codexStop.blockers.length >= codexStart.blockers.length);

  const claudePromptOnly = "claude-prompt-only";
  handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: claudePromptOnly, prompt: `Review ${target}` }, tempDir);
  assert.equal(fs.existsSync(sessionWorktreeEvidencePath(tempDir, claudePromptOnly)), false);

  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: claudeSession }, tempDir);
  const claudeStart = readWorktreeEvidence(tempDir, claudeSession);
  assert.ok(claudeStart);
  assert.match(claudeStart.blockers.join("\n"), /worktree status unavailable/);
  handleClaudeRuntimeHook({ hookEventName: "Stop", sessionId: claudeSession }, tempDir);
  const claudeStop = readWorktreeEvidence(tempDir, claudeSession);
  assert.ok(claudeStop.blockers.length >= claudeStart.blockers.length);
});

test("status worktree emits parseable JSON and default status remains metric-shaped", () => {
  const tempDir = makeTempProject();
  const worktree = run(["status", "worktree"], tempDir);
  assert.equal(worktree.schemaVersion, 1);
  assert.equal(worktree.command, WORKTREE_STATUS_COMMAND);
  assert.match(worktree.claimBoundary, /Local git worktree evidence only/);
  assert.ok(Array.isArray(worktree.blockers));

  const status = run(["status"], tempDir);
  assert.equal(status.schemaVersion, 1);
  assert.equal(status.metricTier, "estimated");
  assert.equal("snapshot" in status, false);
  assert.equal("baseline" in status, false);
  assert.equal("latest" in status, false);

  assert.throws(
    () => execFileSync(process.execPath, [cli, "status", "unknown"], { cwd: tempDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
    /worktree/,
  );
});

test("captureBranchDivergence reports mocked available, quiet, and unknown states", () => {
  const calls = [];
  const available = captureBranchDivergence("/tmp/project", {
    gitRunner: (_cwd, args) => {
      calls.push(args.join(" "));
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "2\t3\n";
      throw new Error(`unexpected ${args.join(" ")}`);
    },
  });
  assert.deepEqual(available, {
    kind: "available",
    branch: "main",
    upstream: "origin/main",
    ahead: 2,
    behind: 3,
    source: WORKTREE_BRANCH_DIVERGENCE_SOURCE,
  });
  assert.deepEqual(calls, [
    "symbolic-ref --quiet --short HEAD",
    "rev-parse --abbrev-ref --symbolic-full-name @{u}",
    "rev-list --left-right --count HEAD...@{u}",
  ]);

  assert.equal(captureBranchDivergence("/tmp/project", { gitRunner: () => { throw new Error("detached"); } }).kind, "detached");
  assert.deepEqual(captureBranchDivergence("/tmp/project", {
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "feature\n";
      throw new Error("no upstream");
    },
  }), { kind: "no-upstream", branch: "feature", source: WORKTREE_BRANCH_DIVERGENCE_SOURCE });
  const unknown = captureBranchDivergence("/tmp/project", {
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      throw new Error("rev-list failed");
    },
  });
  assert.equal(unknown.kind, "unknown");
  assert.match(unknown.reason, /rev-list failed/);
});

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function makeTrackedRepo() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-branch-divergence-"));
  const seed = path.join(tempDir, "seed");
  const remote = path.join(tempDir, "remote.git");
  const clone = path.join(tempDir, "clone");
  fs.mkdirSync(seed);
  git(seed, ["init", "-b", "main"]);
  git(seed, ["config", "user.email", "fooks@example.test"]);
  git(seed, ["config", "user.name", "Fooks Test"]);
  fs.writeFileSync(path.join(seed, "file.txt"), "base\n");
  git(seed, ["add", "file.txt"]);
  git(seed, ["commit", "-m", "base"]);
  git(seed, ["init", "--bare", remote]);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "-u", "origin", "main"]);
  git(remote, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  git(tempDir, ["clone", remote, clone]);
  git(clone, ["branch", "--set-upstream-to", "origin/main", "main"]);
  git(clone, ["config", "user.email", "fooks@example.test"]);
  git(clone, ["config", "user.name", "Fooks Test"]);
  return { tempDir, seed, clone };
}

function commitFile(cwd, name, content, message) {
  fs.writeFileSync(path.join(cwd, name), content);
  git(cwd, ["add", name]);
  git(cwd, ["commit", "-m", message]);
}

function pushRemoteCommit(repo, name, content, message) {
  commitFile(repo.seed, name, content, message);
  git(repo.seed, ["push", "origin", "main"]);
  git(repo.clone, ["fetch", "origin", "main"]);
}

test("status worktree reports clean branches behind, ahead, and diverged using local tracking refs", () => {
  const behindRepo = makeTrackedRepo();
  pushRemoteCommit(behindRepo, "behind.txt", "behind\n", "behind");
  const behind = run(["status", "worktree"], behindRepo.clone);
  assert.equal(behind.snapshot.clean, true);
  assert.deepEqual(behind.branchDivergence, behind.snapshot.branchDivergence);
  assert.equal(behind.branchDivergence.kind, "available");
  assert.equal(behind.branchDivergence.behind, 1);
  assert.equal(behind.branchDivergence.ahead, 0);
  assert.equal(behind.branchDivergence.source, WORKTREE_BRANCH_DIVERGENCE_SOURCE);

  const aheadRepo = makeTrackedRepo();
  commitFile(aheadRepo.clone, "ahead.txt", "ahead\n", "ahead");
  const ahead = run(["status", "worktree"], aheadRepo.clone);
  assert.equal(ahead.snapshot.clean, true);
  assert.equal(ahead.branchDivergence.kind, "available");
  assert.equal(ahead.branchDivergence.ahead, 1);
  assert.equal(ahead.branchDivergence.behind, 0);

  const divergedRepo = makeTrackedRepo();
  commitFile(divergedRepo.clone, "local.txt", "local\n", "local");
  pushRemoteCommit(divergedRepo, "remote.txt", "remote\n", "remote");
  const diverged = run(["status", "worktree"], divergedRepo.clone);
  assert.equal(diverged.snapshot.clean, true);
  assert.equal(diverged.branchDivergence.kind, "available");
  assert.equal(diverged.branchDivergence.ahead, 1);
  assert.equal(diverged.branchDivergence.behind, 1);
});

test("branch divergence keeps no-upstream and detached states quiet", () => {
  const repo = makeTrackedRepo();
  git(repo.clone, ["checkout", "-b", "local-only"]);
  const noUpstream = run(["status", "worktree"], repo.clone);
  assert.equal(noUpstream.branchDivergence.kind, "no-upstream");
  assert.equal(noUpstream.branchDivergence.branch, "local-only");

  git(repo.clone, ["checkout", "--detach"]);
  const detached = run(["status", "worktree"], repo.clone);
  assert.equal(detached.branchDivergence.kind, "detached");
});

test("doctor warns for clean local tracking divergence but suppresses dirty divergence", () => {
  const cleanRepo = makeTrackedRepo();
  pushRemoteCommit(cleanRepo, "remote-clean.txt", "remote\n", "remote clean");
  const cleanDoctor = runDoctor({ target: "all", cwd: cleanRepo.clone, cliName: "fooks" });
  const cleanCheck = cleanDoctor.checks.find((check) => check.name === "Worktree upstream divergence");
  assert.ok(cleanCheck);
  assert.equal(cleanCheck.status, "warn");
  assert.match(cleanCheck.message, /local tracking refs only; no fetch performed/);
  assert.equal(cleanCheck.evidence.behind, 1);

  const dirtyRepo = makeTrackedRepo();
  pushRemoteCommit(dirtyRepo, "remote-dirty.txt", "remote\n", "remote dirty");
  fs.writeFileSync(path.join(dirtyRepo.clone, "dirty.txt"), "dirty\n");
  const dirtyDoctor = runDoctor({ target: "all", cwd: dirtyRepo.clone, cliName: "fooks" });
  assert.equal(dirtyDoctor.checks.some((check) => check.name === "Worktree upstream divergence"), false);
});


test("worktree evidence implementation is read-only and keeps claim boundaries local", () => {
  const implementationFiles = [
    path.join(repoRoot, "src", "core", "worktree-evidence.ts"),
    path.join(repoRoot, "src", "adapters", "codex-runtime-hook.ts"),
    path.join(repoRoot, "src", "adapters", "claude-runtime-hook.ts"),
  ];
  const source = implementationFiles.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n");
  assert.match(source, /git status --porcelain=v1 -z/);
  assert.match(source, /git rev-list --left-right --count HEAD\.\.\.@\{u\}/);
  assert.doesNotMatch(source, /execFileSync\(\s*["']git["']\s*,\s*\[\s*["'](?:fetch|pull|push|add|stash|reset|restore|checkout|clean|commit|rm|mv)["']/);
  for (const term of ["add", "stash", "reset", "restore", "checkout", "clean", "commit", "rm", "mv"]) {
    assert.doesNotMatch(source, new RegExp(`\\bgit\\s+${term}\\b`));
  }
  assert.doesNotMatch(source, /FOOKS_SESSION_METRICS_SCHEMA_VERSION\\s*=\\s*2/);
  assert.doesNotMatch(source, /provider usage\/billing proof|charged-cost proof|token savings proof/i);
});
