import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyStaleApprovalGateRerunEcho } from "./helpers/stale-gate-rerun-classifier.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(repoRoot, "docs", "dogfood", "stale-gate-rerun-echo-1029.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

const pr1028GateEvidence = {
  currentHeadSha: "55384c5c08814c182677f6ef981b05233a535b24",
  relay: {
    workflow: "Merge Gate",
    name: "Validate approval review and linked issue",
    runId: "26250077038",
    attempt: 1,
    jobId: "77258573169",
    headSha: "55384c5c08814c182677f6ef981b05233a535b24",
    conclusion: "failure",
    completedAt: "2026-05-21T20:04:27Z",
  },
  latest: {
    workflow: "Merge Gate",
    name: "Validate approval review and linked issue",
    runId: "26250077038",
    attempt: 2,
    jobId: "77258696992",
    headSha: "55384c5c08814c182677f6ef981b05233a535b24",
    conclusion: "success",
    completedAt: "2026-05-21T20:05:11Z",
  },
};

test("issue #1029 classifies the original PR #1028 approval-gate failure relay as stale after same-head rerun pass", () => {
  assert.deepEqual(
    classifyStaleApprovalGateRerunEcho({
      ...pr1028GateEvidence,
      liveCurrentHeadChecksPass: true,
      mergeabilityClean: true,
    }),
    {
      classification: "stale-approval-gate-failure-echo",
      staleFailureEcho: true,
      relayIsCurrentHeadBlocker: false,
      currentHeadGateResult: "latest-rerun-pass",
      latestResultIsAuthoritativeForCurrentHead: true,
      eligibleToMerge: true,
      mergeRule: "Merge only after live current-head checks pass and mergeability is clean.",
    },
  );
});

test("issue #1029 helper does not convert live merge requirements into stale-echo permission", () => {
  const withoutCleanMergeability = classifyStaleApprovalGateRerunEcho({
    ...pr1028GateEvidence,
    liveCurrentHeadChecksPass: true,
    mergeabilityClean: false,
  });
  assert.equal(withoutCleanMergeability.staleFailureEcho, true);
  assert.equal(withoutCleanMergeability.relayIsCurrentHeadBlocker, false);
  assert.equal(withoutCleanMergeability.eligibleToMerge, false);

  const withoutPassingLatest = classifyStaleApprovalGateRerunEcho({
    ...pr1028GateEvidence,
    latest: { ...pr1028GateEvidence.latest, conclusion: "failure" },
    liveCurrentHeadChecksPass: false,
    mergeabilityClean: true,
  });
  assert.equal(withoutPassingLatest.classification, "current-or-unresolved-approval-gate-evidence");
  assert.equal(withoutPassingLatest.relayIsCurrentHeadBlocker, true);
  assert.equal(withoutPassingLatest.latestResultIsAuthoritativeForCurrentHead, false);
  assert.equal(withoutPassingLatest.eligibleToMerge, false);
});

test("issue #1029 dogfood doc preserves the stale gate echo boundary", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#1029");
  assert.equal(report.readOnly, true);
  assert.equal(report.sourcePullRequest, "#1028");
  assert.equal(report.currentHeadSha, "55384c5c08814c182677f6ef981b05233a535b24");
  assert.equal(report.relay.classification, "original-failed-approval-gate-relay");
  assert.equal(report.relay.runId, "26250077038");
  assert.equal(report.relay.attempt, 1);
  assert.equal(report.relay.jobId, "77258573169");
  assert.equal(report.latest.classification, "latest-current-head-rerun-pass");
  assert.equal(report.latest.attempt, 2);
  assert.equal(report.latest.jobId, "77258696992");
  assert.equal(report.operatorDecision.classification, "stale-approval-gate-failure-echo");
  assert.equal(report.operatorDecision.relayIsCurrentHeadBlocker, false);
  assert.equal(report.operatorDecision.latestResultIsAuthoritativeForCurrentHead, true);
  assert.equal(report.operatorDecision.eligibleToMergeRequiresLiveChecksPass, true);
  assert.equal(report.operatorDecision.eligibleToMergeRequiresCleanMergeability, true);
  assert.match(report.operatorDecision.rule, /same current head/);
  assert.match(report.operatorDecision.rule, /live current-head checks pass/);
  assert.match(report.operatorDecision.rule, /mergeability is clean/);

  for (const required of [
    "narrow read-only dogfood docs/test/helper guard for issue #1029",
    "original approval/linked-issue gate failure relay from PR #1028",
    "Latest rerun result for the same current head",
    "stale-approval-gate-failure-echo",
    "not the latest current-head gate result and not a fresh blocker by itself",
    "Confirm all live current-head checks pass",
    "Confirm mergeability is clean before merging",
    "does not change merge policy, approval requirements",
    "provider/runtime hooks",
    "telemetry",
    "billing/token proof",
    "detector scope",
    "product claims",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #1029 doc text: ${required}`);
  }
});
