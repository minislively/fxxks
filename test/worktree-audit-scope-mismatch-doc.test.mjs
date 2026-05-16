// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "worktree-audit-scope-mismatch-879.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #879 dogfood artifact keeps operator evidence surfaces separate", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#879");
  assert.equal(report.readOnly, true);
  assert.equal(report.observedAfterCleanup, "PR #878 cleanup");
  assert.deepEqual(report.operatorBoundary.separateFieldsRequired, [
    "rawGitWorktreeInventory",
    "auditScopedInventory",
    "runtimeEvidence",
    "repositoryCounts",
  ]);
  assert.deepEqual(report.operatorBoundary.activeWorkEvidenceKinds, ["live-issue", "live-branch", "live-session", "live-pr", "live-proc"]);
  assert.equal(report.operatorBoundary.residueIsActiveWork, false);
  assert.equal(report.operatorBoundary.auditKeepRootEntriesAreActiveWork, false);

  assert.equal(report.rawGitWorktreeInventory.source, "git worktree list --porcelain");
  assert.equal(report.rawGitWorktreeInventory.totalWorktrees, 10);
  assert.equal(report.rawGitWorktreeInventory.legacyLocalFooksWorktreePaths, 8);
  assert.equal(report.rawGitWorktreeInventory.isScopedToAuditEntries, false);
  assert.equal(report.rawGitWorktreeInventory.isActiveWorkEvidence, false);

  assert.equal(report.auditScopedInventory.source, "npm run --silent worktree:audit -- --json");
  assert.equal(report.auditScopedInventory.staleReviewCandidates, 0);
  assert.equal(report.auditScopedInventory.entries.total, 1);
  assert.deepEqual(report.auditScopedInventory.entries.categories, {
    keep: 1,
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 0,
  });
  assert.equal(report.auditScopedInventory.entries.scope, "keep/root");
  assert.equal(report.auditScopedInventory.isActiveWorkEvidence, false);

  assert.equal(report.runtimeEvidence.tmux.mappedLiveFooksSessions, 0);
  assert.equal(report.runtimeEvidence.tmux.isActiveWorkEvidence, false);
  assert.equal(report.runtimeEvidence.proc.mappedLiveProcesses, 0);
  assert.equal(report.runtimeEvidence.proc.isActiveWorkEvidence, false);

  assert.equal(report.repositoryCounts.openPullRequests.count, 0);
  assert.equal(report.repositoryCounts.openPullRequests.isActiveWorkEvidence, false);
  assert.equal(report.repositoryCounts.openIssues.count, 0);
  assert.equal(report.repositoryCounts.openIssues.isActiveWorkEvidence, false);

  assert.equal(report.activeWorkDecision.isCleanSlateForActiveWork, true);
  assert.equal(report.activeWorkDecision.activeEvidencePresent, false);
  assert.match(report.activeWorkDecision.reason, /no live issue, branch, session, PR, or proc evidence/);
});

test("issue #879 dogfood artifact preserves the requested narrow non-goals", () => {
  for (const required of [
    "narrow read-only dogfood docs/test artifact for issue #879",
    "Raw git worktree inventory",
    "Audit scoped inventory",
    "Runtime evidence",
    "Repository counts",
    "Only live issue, branch, session, PR, or process evidence is active work",
    "legacyLocalFooksWorktreePaths",
    "staleReviewCandidates",
    "keep/root",
    "zero stale-review candidates does not erase raw local residue counts",
    "local residue inventory; do not infer current work",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "performance claims",
    "product claims",
    "duplicate-guard detection",
    "`worktree:audit` scope",
    "`fooks check` output",
    "operator reporting boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #879 doc text: ${required}`);
  }
});
