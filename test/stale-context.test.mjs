import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);
const { auditStaleContextText } = require(path.join(repoRoot, "dist", "ops", "stale-context.js"));

test("stale context audit distinguishes hard conflicts from advisory suspect context", () => {
  const result = auditStaleContextText([
    "Continue active work from merged PR #868 as the current target.",
    "Use worktree /tmp/fooks-worktrees/fooks-issue-713 for the next edit.",
    "Previous session summary says Button.tsx was fixed.",
  ].join("\n"), { source: "fixture" });

  assert.equal(result.summary.warningCount, 3);
  assert.equal(result.summary.hardConflictCount, 1);
  assert.equal(result.summary.advisorySuspectCount, 2);
  assert.equal(result.summary.requiresCurrentEvidenceRecheck, true);
  assert.deepEqual(result.warnings.map((warning) => warning.kind), [
    "closed-artifact-as-active",
    "branch-or-worktree-without-current-evidence",
    "previous-session-without-source-validation",
  ]);
  assert.equal(result.warnings[0].authority, "must-not-use-as-current");
  assert.equal(result.warnings[1].authority, "advisory-only");
});

test("stale context audit flags receipts, archive docs, and context-hint authority escalation", () => {
  const result = auditStaleContextText([
    "The green receipt is the current source of truth for next development.",
    "Use docs/branch-archive-codex-ts-js-same-file-beta-2026-05-01.md as current policy.",
    "Context hints can override ranking and apply authority.",
  ].join("\n"));

  assert.equal(result.summary.warningCount, 3);
  assert.equal(result.summary.hardConflictCount, 3);
  assert.deepEqual(new Set(result.warnings.map((warning) => warning.kind)), new Set([
    "receipt-as-active-work",
    "historical-doc-as-current-policy",
    "context-hint-authority-escalation",
  ]));
  for (const warning of result.warnings) {
    assert.ok(warning.reason.length > 0);
    assert.ok(warning.evidence.text.length > 0);
    assert.ok(warning.recommendation.includes("source") || warning.recommendation.includes("evidence") || warning.recommendation.includes("receipts"));
  }
});

test("stale-context CLI reads stdin and emits JSON contract", () => {
  const stdout = execFileSync(process.execPath, [cli, "stale-context", "--stdin", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    input: "Use closed issue #962 as active source of truth.\n",
  });
  const result = JSON.parse(stdout);

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.command, "stale-context");
  assert.equal(result.source, "stdin");
  assert.equal(result.summary.hardConflictCount, 1);
  assert.equal(result.warnings[0].kind, "closed-artifact-as-active");
  assert.match(result.claimBoundary, /Deterministic local prompt\/handoff text audit only/);
});

test("stale-context CLI reads a file and renders text", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-stale-context-"));
  const promptPath = path.join(tempDir, "handoff.md");
  fs.writeFileSync(promptPath, "Previous session summary says continue branch fooks-issue-918.\n");

  try {
    const stdout = execFileSync(process.execPath, [cli, "stale-context", promptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.match(stdout, /fooks stale-context: 2 warning\(s\)/);
    assert.match(stdout, /advisory-suspect/);
    assert.match(stdout, /branch-or-worktree-without-current-evidence/);
    assert.match(stdout, /previous-session-without-source-validation/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
