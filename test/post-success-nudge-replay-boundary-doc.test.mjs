// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "post-success-nudge-replay-boundary-873.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #873 dogfood artifact documents the post-success nudge target shape", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#873");
  assert.equal(report.readOnly, true);
  assert.equal(report.question, "what is the current post-success nudge target?");

  assert.equal(report.preNudgeInventory.openIssueCount, 0);
  assert.equal(report.preNudgeInventory.openPullRequestCount, 0);
  assert.equal(report.preNudgeInventory.liveOmxSessionCount, 0);
  assert.equal(report.preNudgeInventory.requiresSpawnOrAdoptTarget, true);

  assert.equal(report.currentTargetEvidence.adoptedIssue.number, 873);
  assert.equal(report.currentTargetEvidence.adoptedIssue.isCurrentTargetEvidence, true);
  assert.equal(report.currentTargetEvidence.adoptedBranch.name, "dogfood/issue-873-post-success-nudge-replay-boundary");
  assert.equal(report.currentTargetEvidence.adoptedBranch.isMain, false);
  assert.equal(report.currentTargetEvidence.adoptedBranch.isCurrentTargetEvidence, true);
  assert.equal(report.currentTargetEvidence.mappedOmxSession.session, "fooks-dogfood-issue-873-post-success-nudge-replay-boundary");
  assert.equal(report.currentTargetEvidence.mappedOmxSession.worktree, "issue-873-post-success-nudge-replay-boundary");
  assert.equal(report.currentTargetEvidence.mappedOmxSession.isCurrentTargetEvidence, true);

  for (const field of ["delta", "ahead", "proc"]) {
    assert.equal(report.currentTargetEvidence[field].required, true, `${field} must be required current target evidence`);
  }

  assert.equal(report.receiptOnlyEvidence.mergedPullRequest, "#872");
  assert.equal(report.receiptOnlyEvidence.mainCiAndReleaseReceiptsGreen, true);
  assert.equal(report.receiptOnlyEvidence.priorReceiptsAreCurrentTargetEvidence, false);
  assert.match(report.nudgeAnswerRule, /open PR\/issues and live OMX are zero/);
  assert.match(report.nudgeAnswerRule, /spawn\/adopt one issue\/branch\/session target/);
  assert.match(report.nudgeAnswerRule, /issue #873/);
  assert.match(report.nudgeAnswerRule, /delta\/ahead\/proc/);
  assert.match(report.nudgeAnswerRule, /do not answer with the PR #872 CI\/release receipt/);
});

test("issue #873 dogfood artifact preserves replay-boundary non-goals", () => {
  for (const required of [
    "PR #872 merged",
    "both latest `main` CI/release receipts are green",
    "must not collapse into replaying that final receipt",
    "zero open PR/issues and zero live OMX/fooks session evidence",
    "create or adopt exactly one bounded target",
    "issue evidence for `#873`",
    "dogfood/issue-873-post-success-nudge-replay-boundary",
    "mapped OMX/fooks session evidence",
    "`delta`, `ahead`, and `proc` evidence",
    "must not be replayed as the answer to the fresh nudge",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "performance claims",
    "product claims",
    "post-success nudge report boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #873 doc text: ${required}`);
  }
});
