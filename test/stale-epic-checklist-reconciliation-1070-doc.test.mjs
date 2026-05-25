// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const doc = fs.readFileSync(
  path.join(repoRoot, "docs", "dogfood", "stale-epic-checklist-reconciliation-1070.md"),
  "utf8",
);
const setupDoc = fs.readFileSync(path.join(repoRoot, "docs", "setup.md"), "utf8");
const boundaryDoc = fs.readFileSync(path.join(repoRoot, "docs", "post-merge-main-ci-echo-boundary.md"), "utf8");
const compactDocs = `${doc}\n${setupDoc}\n${boundaryDoc}`.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

function assertDocsInclude(text) {
  assert.ok(compactDocs.includes(text), `missing issue #1070 doc text: ${text}`);
}

test("issue #1070 dogfood doc preserves stale epic checklist reconciliation shape", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#1070");
  assert.equal(report.sourceEpic, "#960");
  assert.equal(report.readOnly, true);
  assert.equal(report.operatorCheckField, "activeWorkReceipts.epicStaleChecklistReconciliation");
  assert.equal(report.classification, "stale-epic-checklist-action-required");
  assert.equal(report.staleChecklistTextAuthority, "advisory");
  assert.equal(report.canDrainEpic, false);
  assert.equal(report.canReportActiveDevelopment, false);
  assert.equal(report.safeNextAction, "name-landed-child-evidence-and-open-or-adopt-current-active-artifact");
  assert.equal(report.duplicateWorkRisk, "elevated-until-current-child-evidence");
  assert.deepEqual(report.requiredBeforeDrain, [
    "closed child issue receipt",
    "merged child pull request receipt",
    "operator closeout receipt naming the completed child",
    "next child issue",
    "open pull request",
    "non-main branch",
    "mapped fooks tmux session",
    "active worktree or process evidence",
    "concrete blocker",
  ]);
  assert.match(report.rule, /cannot be reported as active development or drained/);
});

test("issue #1070 docs name the read-only advisory boundary and setup surface", () => {
  for (const required of [
    "Issue #1070 stale epic checklist reconciliation",
    "narrow read-only dogfood guard for Epic `#960`",
    "prevents stale unchecked epic checklist text from becoming active development or drain authority",
    "clean `main` with only the organizing epic open",
    "Old unchecked checklist rows in the epic body are advisory planning history",
    "reconciled with landed child evidence and a current active artifact",
    "does not update or close GitHub issues",
    "does not create child issues",
    "does not create PRs",
    "does not mutate branches",
    "closed child issue receipt",
    "merged child pull request receipt",
    "operator closeout receipt naming the completed child",
    "current next-child evidence: child issue, PR, non-main branch, mapped fooks session, active worktree/process evidence, or concrete blocker",
    "activeWorkReceipts.epicStaleChecklistReconciliation",
    "issue #1070 stale epic checklist reconciliation summary",
    "requires landed child evidence before the epic can be considered drainable",
    "stale unchecked #960 checklist text remains advisory until landed child evidence and current child/branch/session/PR/worktree-process/blocker evidence are named",
  ]) {
    assertDocsInclude(required);
  }
});
