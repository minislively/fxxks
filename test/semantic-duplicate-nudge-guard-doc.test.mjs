// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "semantic-duplicate-nudge-guard-877.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #877 dogfood artifact documents the recent-closed-chain duplicate guard", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#877");
  assert.equal(report.readOnly, true);
  assert.equal(report.question, "fresh dogfood nudge after a closed receipt-vs-active-anchor chain");
  assert.deepEqual(report.recentClosedChainGuard.inspectedIssues, [863, 865, 867, 869, 871, 873, 875]);
  assert.equal(report.recentClosedChainGuard.closedAxis, "receipt-vs-active-anchor");
  assert.deepEqual(report.recentClosedChainGuard.semanticDuplicatesCut, [863, 865, 867, 869, 871, 873, 875]);
  assert.equal(report.recentClosedChainGuard.reopenClosedAxisAllowed, false);
  assert.equal(report.recentClosedChainGuard.requiresDistinctCurrentPain, true);

  assert.equal(report.currentTargetEvidence.adoptedIssue.number, 877);
  assert.equal(report.currentTargetEvidence.adoptedIssue.isCurrentTargetEvidence, true);
  assert.match(report.currentTargetEvidence.adoptedIssue.distinctCurrentPain, /semantic duplicate nudge guard/);
  assert.equal(report.currentTargetEvidence.adoptedBranch.name, "dogfood/issue-877-semantic-duplicate-nudge-guard");
  assert.equal(report.currentTargetEvidence.adoptedBranch.isMain, false);
  assert.equal(report.currentTargetEvidence.mappedOmxSession.session, "fooks-dogfood-issue-877-semantic-duplicate-nudge-guard");
  assert.equal(report.currentTargetEvidence.mappedOmxSession.worktree, "issue-877-semantic-duplicate-nudge-guard");

  for (const field of ["delta", "ahead", "proc"]) {
    assert.equal(report.currentTargetEvidence[field].required, true, `${field} must be required current target evidence`);
    assert.match(report.currentTargetEvidence[field].evidence, /\S/u, `${field} must carry concrete evidence text`);
  }

  assert.deepEqual(report.receiptOnlyEvidence.closedIssues, ["#863", "#865", "#867", "#869", "#871", "#873", "#875"]);
  assert.equal(report.receiptOnlyEvidence.closedChainIsCurrentTargetEvidence, false);
  assert.equal(report.receiptOnlyEvidence.closedChainMayBeReopenedUnderNewWording, false);
  assert.match(report.nudgeAnswerRule, /Inspect recent closed dogfood issues/);
  assert.match(report.nudgeAnswerRule, /cut semantic duplicates/);
  assert.match(report.nudgeAnswerRule, /exactly one distinct target/);
  assert.match(report.nudgeAnswerRule, /delta, ahead, and proc evidence/);
});

test("issue #877 dogfood artifact preserves the requested narrow scope", () => {
  for (const required of [
    "closed dogfood axis `#863/#865/#867/#869/#871/#873/#875`",
    "must not reopen any row in that table under new wording",
    "semantic duplicate nudge guard",
    "zero open PR/issues and zero live OMX/fooks session evidence",
    "inspect recent closed dogfood issues",
    "cut candidates whose only pain is another wording",
    "exactly one distinct issue/branch/OMX target",
    "issue evidence for `#877`",
    "dogfood/issue-877-semantic-duplicate-nudge-guard",
    "mapped OMX session evidence",
    "duplicate-cut evidence for `#863/#865/#867/#869/#871/#873/#875`",
    "`delta` evidence",
    "`ahead` evidence",
    "`proc` evidence",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "performance claims",
    "product claims",
    "recent-closed-chain guard only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #877 doc text: ${required}`);
  }
});
