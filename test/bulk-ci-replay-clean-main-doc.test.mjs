// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "bulk-ci-replay-clean-main-968.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

/** @param {string} markdown */
function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #968 artifact collapses bulk CI replay as echo", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#968");
  assert.equal(report.readOnly, true);
  assert.equal(report.sourcePullRequest, "#967");
  assert.match(report.question, /bulk historical CI success replay/);
  assert.match(report.question, /require active artifact evidence/);

  assert.equal(report.event.afterCleanMerge, true);
  assert.equal(report.event.clawhipBulkReplay, true);
  assert.equal(report.event.historicalCiSuccessUrls, "many");
  assert.equal(report.event.currentMainCiAndReleaseAlreadyGreen, true);

  assert.deepEqual(report.classification, {
    bulkReplayLane: "receipt-only-echo",
    currentMainGreenLane: "verification-only-provenance",
    activeArtifactLane: "required-before-current-work-claim",
  });

  assert.equal(report.strictFooksCheckDecision.collapseBulkHistoricalSuccessUrls, true);
  assert.equal(report.strictFooksCheckDecision.bulkReplaySatisfiesRequiredActiveArtifact, false);
  assert.equal(report.strictFooksCheckDecision.currentMainGreenReceiptSatisfiesRequiredActiveArtifact, false);
  assert.equal(report.strictFooksCheckDecision.requiresActiveArtifactEvidence, true);
  assert.deepEqual(report.strictFooksCheckDecision.acceptableTopLevelActiveArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);
  assert.match(report.strictFooksCheckDecision.handoffOnlyLiveWorktreeEvidence, /issue #885/);
});

test("issue #968 artifact requires active evidence and preserves non-goals", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.currentRunEvidence.adoptedIssue, "#968");
  assert.equal(report.currentRunEvidence.adoptedBranch, "dogfood/issue-968-bulk-ci-replay-clean-main");
  assert.equal(report.currentRunEvidence.mappedSession, "fooks-dogfood-issue-968-bulk-ci-replay-clean-main");
  assert.equal(report.currentRunEvidence.deltaAheadProcRequired, true);
  assert.deepEqual(report.prohibitedReportAnchors, [
    "bulk historical CI success URL replay",
    "prior clean merge receipt",
    "current main CI green receipt alone",
    "release-report green receipt alone",
    "generic idle status summary",
  ]);
  assert.match(report.operatorRule, /collapses the batch as receipt-only echo/);
  assert.match(report.operatorRule, /verification-only provenance/);
  assert.match(report.operatorRule, /active artifact evidence/);
  assert.match(report.operatorRule, /never satisfies requiredActiveArtifact by itself/);

  for (const required of [
    "narrow read-only dogfood docs/test/operator artifact for issue #968",
    "after PR #967 merged clean",
    "clawhip replayed a bulk batch of historical CI success URLs",
    "current `main` CI and release-report receipts were already green",
    "strict `fooks check` reporting",
    "bulk batch of historical successful CI URLs is a replay echo",
    "receipt-only echo lane",
    "active artifact evidence",
    "open issue, open PR, mapped fooks tmux/proc session",
    "Never let the replay batch satisfy the top-level `requiredActiveArtifact` contract by itself",
    "does not implement #962 or #963",
    "does not change merge-gate policy",
    "does not change runtime hooks or provider behavior",
    "no broad product",
    "performance",
    "billing",
    "runtime-token claims",
    "strict `fooks check` operator/reporting boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #968 doc text: ${required}`);
  }
});
