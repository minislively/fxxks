// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "stale-approval-gate-failure-replay-899.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #899 artifact classifies the replayed failed approval-gate job as stale", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#899");
  assert.equal(report.readOnly, true);
  assert.equal(report.sourcePullRequest, "#898");
  assert.match(report.question, /stale failed approval-gate replay/);
  assert.match(report.question, /live current-head PR gate state/);

  assert.deepEqual(report.evidence.originalFailedApprovalGate, {
    runId: "25969204750",
    jobId: "76338018714",
    classification: "stale-failed-job-replay",
    isLiveCurrentHeadGateState: false,
  });

  assert.deepEqual(report.evidence.sameRunRerunPass, {
    runId: "25969204750",
    jobId: "76338153094",
    supersedesOriginalFailedJob: true,
    isLiveCurrentHeadGateState: true,
  });

  assert.deepEqual(report.evidence.mergeReceipt, {
    pullRequest: "#898",
    mergedCommit: "644d7a9",
    marker: "MERGED=644d7a9",
    isLiveCurrentHeadGateState: true,
  });

  assert.deepEqual(report.evidence.linkedIssueReceipt, {
    issue: "#897",
    state: "CLOSED",
    isLiveCurrentHeadGateState: true,
  });

  assert.deepEqual(report.evidence.postMergeMainCi, {
    runId: "25969259209",
    conclusion: "success",
    isLiveCurrentHeadGateState: true,
  });
});

test("issue #899 artifact preserves the operator decision and non-goals", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.operatorDecision.staleFailureReplayIsAuditProvenance, true);
  assert.equal(report.operatorDecision.staleFailureReplayIsCurrentHeadGateFailure, false);
  assert.equal(report.operatorDecision.staleFailureReplayReopensMergedPr, false);
  assert.equal(report.operatorDecision.staleFailureReplayReopensClosedIssue, false);
  assert.equal(report.operatorDecision.staleFailureReplayChangesMergeGatePolicy, false);
  assert.match(report.operatorDecision.rule, /same-run rerun passed/);
  assert.match(report.operatorDecision.rule, /PR merged/);
  assert.match(report.operatorDecision.rule, /linked issue closed/);
  assert.match(report.operatorDecision.rule, /post-merge main CI succeeded/);
  assert.match(report.operatorDecision.rule, /stale audit provenance only/);
  assert.match(report.operatorDecision.rule, /live current-head PR gate lane/);

  for (const required of [
    "narrow read-only dogfood docs/test/operator artifact for issue #899",
    "PR #898 evidence trail",
    "Original failed approval-gate run/job: `25969204750` / `76338018714`",
    "Same-run rerun passing job: `76338153094`",
    "PR #898 merged commit marker: `MERGED=644d7a9`",
    "issue `#897` is `CLOSED`",
    "Post-merge `main` CI run: `25969259209` concluded `success`",
    "must not be reported as the live current-head PR gate state",
    "Stale failed-job replay lane",
    "Live current-head PR gate lane",
    "not as a new merge blocker",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "product claims",
    "performance claims",
    "operator reporting boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #899 doc text: ${required}`);
  }
});
