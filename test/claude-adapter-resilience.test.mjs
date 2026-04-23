// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);

const { handleClaudeRuntimeHook } = require(path.join(repoRoot, "dist", "adapters", "claude-runtime-hook.js"));
const {
  ensureFreshClaudeContextForTarget,
  readClaudeTrustStatus,
  writeClaudeTrustStatus,
} = require(path.join(repoRoot, "dist", "adapters", "claude-runtime-trust.js"));
const { clearClaudeRuntimeSession, claudeRuntimeSessionPath } = require(path.join(repoRoot, "dist", "adapters", "claude-runtime-session.js"));
const { scanProject } = require(path.join(repoRoot, "dist", "core", "scan.js"));

function makeTempProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-resilience-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "src", "components", "FormSection.tsx"),
    "export function FormSection() { return <div>Form</div>; }\n",
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ name: "temp-project", version: "1.0.0" }),
  );
  return tempDir;
}

test("claude runtime hook defends against corrupt trust status file", () => {
  const tempDir = makeTempProject();
  const sessionId = "claude-corrupt-trust";
  const target = path.join("src", "components", "FormSection.tsx");

  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Review ${target}` }, tempDir);

  const trustFile = path.join(tempDir, ".fooks", "state", "claude-runtime", "trust.json");
  fs.writeFileSync(trustFile, "{not-json");

  const afterCorrupt = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Again, review ${target}` }, tempDir);
  assert.equal(afterCorrupt.action, "inject");
  assert.equal(afterCorrupt.filePath, target);

  const status = readClaudeTrustStatus(tempDir);
  assert.equal(status.connectionState, "connected");
  assert.equal(status.lifecycleState, "attach-prepared");
});

test("claude runtime hook no-ops unrecognized event names", () => {
  const tempDir = makeTempProject();
  const decision = handleClaudeRuntimeHook({ hookEventName: "UnknownEvent", prompt: "Explain src/components/FormSection.tsx" }, tempDir);
  assert.equal(decision.action, "noop");
  assert.ok(decision.reasons.includes("unrecognized-hook-event"));
  assert.equal(decision.filePath, undefined);
});

test("claude runtime session clear removes empty parent directories", () => {
  const tempDir = makeTempProject();
  const sessionKey = "claude-cleanup-test";
  const statePath = claudeRuntimeSessionPath(tempDir, sessionKey);

  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: sessionKey }, tempDir);
  assert.ok(fs.existsSync(statePath));

  clearClaudeRuntimeSession(tempDir, sessionKey);
  assert.equal(fs.existsSync(statePath), false);
  assert.equal(fs.existsSync(path.join(tempDir, ".fooks", "state", "claude-runtime")), false);
});

test("claude ensureFreshClaudeContextForTarget non-stale path does not rewrite trust status", () => {
  const tempDir = makeTempProject();
  const target = path.join("src", "components", "FormSection.tsx");

  const scan = scanProject(tempDir);
  const before = writeClaudeTrustStatus(
    {
      runtime: "claude",
      connectionState: "connected",
      lifecycleState: "ready",
      updatedAt: "2026-04-23T00:00:00.000Z",
      lastScanAt: scan.scannedAt,
      lastRefreshAt: scan.scannedAt,
    },
    tempDir,
  );
  const beforeUpdatedAt = before.updatedAt;

  const result = ensureFreshClaudeContextForTarget(target, tempDir);
  assert.equal(result.refreshed, false);

  const after = readClaudeTrustStatus(tempDir);
  assert.equal(after.updatedAt, beforeUpdatedAt);
});
