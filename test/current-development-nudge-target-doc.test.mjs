// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "current-development-nudge-target-871.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #871 dogfood artifact documents the current-development report shape", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#871");
  assert.equal(report.readOnly, true);
  assert.equal(report.question, "what is being developed?");

  assert.equal(report.currentDevelopmentEvidence.spawnedIssue.number, 871);
  assert.equal(report.currentDevelopmentEvidence.spawnedIssue.isCurrentTargetEvidence, true);
  assert.equal(report.currentDevelopmentEvidence.spawnedBranch.name, "dogfood/issue-871-current-development-nudge-target");
  assert.equal(report.currentDevelopmentEvidence.spawnedBranch.isMain, false);
  assert.equal(report.currentDevelopmentEvidence.spawnedBranch.isCurrentTargetEvidence, true);
  assert.equal(report.currentDevelopmentEvidence.mappedOmxSession.session, "fooks-dogfood-issue-871-current-development-nudge-target");
  assert.equal(report.currentDevelopmentEvidence.mappedOmxSession.isCurrentTargetEvidence, true);

  for (const field of ["delta", "ahead", "proc"]) {
    assert.equal(report.currentDevelopmentEvidence[field].required, true, `${field} must be required current evidence`);
  }

  assert.equal(report.receiptOnlyEvidence.mergedPullRequest, "#870");
  assert.equal(report.receiptOnlyEvidence.mainCiReleaseReceiptsAreCurrentDevelopmentEvidence, false);
  assert.match(report.nudgeAnswerRule, /issue #871/);
  assert.match(report.nudgeAnswerRule, /delta\/ahead\/proc/);
  assert.match(report.nudgeAnswerRule, /PR #870 main CI\/release receipts receipt-only/);
});

test("issue #871 dogfood artifact preserves the requested non-goals", () => {
  for (const required of [
    "current target evidence",
    "spawned issue evidence for `#871`",
    "spawned non-`main` branch/worktree evidence",
    "mapped OMX session evidence",
    "`delta`, `ahead`, and `proc`",
    "Merged CI/release receipts from PR #870 remain receipt-only",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "performance claims",
    "product claims",
    "documents and tests report shape only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #871 doc text: ${required}`);
  }
});
