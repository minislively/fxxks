// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "session-whip-final-receipt-artifact-875.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #875 dogfood artifact documents the idle-forbidden session-whip target shape", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#875");
  assert.equal(report.readOnly, true);
  assert.equal(report.question, "session whip with idle forbidden after PR #874 final receipts");

  assert.equal(report.currentTargetEvidence.adoptedIssue.number, 875);
  assert.equal(report.currentTargetEvidence.adoptedIssue.isCurrentTargetEvidence, true);
  assert.equal(report.currentTargetEvidence.adoptedBranch.name, "dogfood/issue-875-session-whip-final-receipt-artifact");
  assert.equal(report.currentTargetEvidence.adoptedBranch.isMain, false);
  assert.equal(report.currentTargetEvidence.adoptedBranch.isCurrentTargetEvidence, true);
  assert.equal(report.currentTargetEvidence.mappedOmxSession.session, "fooks-dogfood-issue-875-session-whip-final-receipt-artifact");
  assert.equal(report.currentTargetEvidence.mappedOmxSession.isCurrentTargetEvidence, true);
  assert.equal(
    report.currentTargetEvidence.worktree.path,
    "/home/bellman/Workspace/fooks.omx-worktrees/issue-875-session-whip-final-receipt-artifact",
  );
  assert.equal(report.currentTargetEvidence.worktree.isCurrentTargetEvidence, true);

  for (const field of ["delta", "ahead", "proc", "pane"]) {
    assert.equal(report.currentTargetEvidence[field].required, true, `${field} must be required live target evidence`);
    assert.match(report.currentTargetEvidence[field].evidence, /\S/u, `${field} must carry concrete evidence text`);
  }

  assert.equal(report.receiptOnlyEvidence.mergedPullRequest, "#874");
  assert.equal(report.receiptOnlyEvidence.finalMainCiReceiptsGreen, true);
  assert.equal(report.receiptOnlyEvidence.priorReceiptIsCurrentTargetEvidence, false);
  assert.equal(report.receiptOnlyEvidence.emptyStateIsValidAnswer, false);
  assert.match(report.sessionWhipAnswerRule, /idle forbidden/);
  assert.match(report.sessionWhipAnswerRule, /create\/adopt one live issue\/branch\/session\/PR target/);
  assert.match(report.sessionWhipAnswerRule, /issue #875, branch, OMX session, worktree, delta, ahead, proc, and pane/);
  assert.match(report.sessionWhipAnswerRule, /Do not answer with the PR #874 receipt or an empty state/);
});

test("issue #875 dogfood artifact preserves session-whip non-goals", () => {
  for (const required of [
    "PR #874 merged",
    "final `main` CI receipts are green",
    "fooks session whip with idle forbidden",
    "must not answer with the just-verified receipt",
    "must not report an empty state",
    "create or adopt exactly one bounded live artifact",
    "issue evidence for `#875`",
    "dogfood/issue-875-session-whip-final-receipt-artifact",
    "mapped OMX session evidence",
    "worktree evidence",
    "`delta` evidence",
    "`ahead` evidence",
    "`proc` evidence",
    "`pane` evidence",
    "receipt-only closeout evidence",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "performance claims",
    "product claims",
    "session-whip final-receipt report boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #875 doc text: ${required}`);
  }
});
