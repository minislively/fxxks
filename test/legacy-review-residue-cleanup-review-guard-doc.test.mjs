// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "legacy-review-residue-cleanup-review-guard-895.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #895 artifact separates cleanup-review residue from active anchors", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#895");
  assert.equal(report.readOnly, true);
  assert.equal(report.observedAfterCleanup, "PR #894 clean merge");
  assert.equal(report.cleanupReviewEvidence.rawLocalFooksWorktreeInventory.legacyReviewRefreshWorktreeCount, 8);
  assert.equal(report.cleanupReviewEvidence.rawLocalFooksWorktreeInventory.classification, "actionable-operator-residue-cleanup-review");
  assert.equal(report.cleanupReviewEvidence.rawLocalFooksWorktreeInventory.isCurrentActiveAnchor, false);
  assert.equal(report.cleanupReviewEvidence.operatorCheckProjection.classification, "operator-cleanup-review-evidence");
  assert.equal(report.cleanupReviewEvidence.operatorCheckProjection.actionableOperatorResidue, true);
  assert.equal(report.cleanupReviewEvidence.operatorCheckProjection.cleanupCommandsIncluded, false);

  assert.deepEqual(report.currentActiveAnchorEvidence, {
    openPullRequests: 0,
    openIssues: 0,
    mappedFooksTmuxSessions: 0,
    mappedProcWorktreeProcesses: 0,
    activeAnchorPresent: false,
    allowedActiveAnchorKinds: ["live-issue", "live-pr", "live-branch", "live-tmux", "live-proc", "concrete-blocker"],
  });

  assert.equal(report.auditScopedEvidence.command, "worktree:audit");
  assert.equal(report.auditScopedEvidence.staleReviewCandidates, 0);
  assert.equal(report.auditScopedEvidence.entries, 1);
  assert.equal(report.auditScopedEvidence.entryScope, "keep/root");
  assert.equal(report.auditScopedEvidence.linkedIssue, "#854");
  assert.equal(report.auditScopedEvidence.triageLinkedIssue, "#711");
  assert.equal(report.auditScopedEvidence.isCurrentActiveAnchor, false);
  assert.match(report.auditScopedEvidence.operatorMeaning, /does not erase raw local cleanup-review residue/);

  assert.equal(report.decision.legacyReviewResidueIsCleanupReviewEvidence, true);
  assert.equal(report.decision.legacyReviewResidueSatisfiesActiveAnchorRequirement, false);
  assert.equal(report.decision.auditLinkedIssuesAreActiveAnchors, false);
  assert.match(report.decision.nudgeRule, /do not rediscover or present them as current active work/);
});

test("issue #895 artifact preserves narrow non-goals", () => {
  for (const required of [
    "narrow read-only dogfood docs/test/operator guard for issue #895",
    "PR #894 clean-merge state",
    "eight legacy review/refresh worktrees",
    "actionable operator residue for cleanup-review evidence",
    "not current active anchors",
    "must not be rediscovered manually on every nudge",
    "Cleanup-review evidence lane",
    "Current active anchor lane",
    "`worktree:audit` metadata is provenance",
    "staleReviewCandidates=0",
    "single keep/root entry",
    "linked issues `#854` / `#711` remain audit IDs",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "product claims",
    "performance claims",
    "`worktree:audit` output shape",
    "`fooks check` verdict policy",
    "operator reporting boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #895 doc text: ${required}`);
  }
});
