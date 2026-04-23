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
  captureWorktreeSnapshot,
  currentWorktreeEvidenceStatus,
  finalizeWorktreeEvidenceSafe,
  initializeWorktreeEvidenceSafe,
  readWorktreeEvidence,
} = require(path.join(repoRoot, "dist", "core", "worktree-evidence.js"));
const { sessionWorktreeEvidencePath } = require(path.join(repoRoot, "dist", "core", "paths.js"));
const { handleCodexRuntimeHook } = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
const { handleClaudeRuntimeHook } = require(path.join(repoRoot, "dist", "adapters", "claude-runtime-hook.js"));

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

test("worktree evidence implementation is read-only and keeps claim boundaries local", () => {
  const implementationFiles = [
    path.join(repoRoot, "src", "core", "worktree-evidence.ts"),
    path.join(repoRoot, "src", "adapters", "codex-runtime-hook.ts"),
    path.join(repoRoot, "src", "adapters", "claude-runtime-hook.ts"),
  ];
  const source = implementationFiles.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n");
  assert.match(source, /git status --porcelain=v1 -z/);
  for (const term of ["add", "stash", "reset", "restore", "checkout", "clean", "commit", "rm", "mv"]) {
    assert.doesNotMatch(source, new RegExp(`\\bgit\\s+${term}\\b`));
  }
  assert.doesNotMatch(source, /FOOKS_SESSION_METRICS_SCHEMA_VERSION\\s*=\\s*2/);
  assert.doesNotMatch(source, /provider billing proof|provider cost proof|token savings proof/i);
});
