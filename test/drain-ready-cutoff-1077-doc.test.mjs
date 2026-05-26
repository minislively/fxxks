// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "drain-ready-cutoff-1077.md"), "utf8");
const boundaryDoc = fs.readFileSync(path.join(repoRoot, "docs", "post-merge-main-ci-echo-boundary.md"), "utf8");
const setupDoc = fs.readFileSync(path.join(repoRoot, "docs", "setup.md"), "utf8");
const compactDocs = `${doc}\n${boundaryDoc}\n${setupDoc}`.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

function assertDocsInclude(text) {
  assert.ok(compactDocs.includes(text), `missing issue #1077 doc text: ${text}`);
}

test("issue #1077 dogfood doc preserves drain-ready cutoff shape", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#1077");
  assert.equal(report.sourceEpic, "#960");
  assert.equal(report.readOnly, true);
  assert.equal(report.operatorCheckField, "activeWorkReceipts.drainReadyCutoff");
  assert.equal(report.classification, "no-new-child-drain-ready-after-landed-child-evidence");
  assert.equal(report.noNewChildBoundary.availableWhenLandedChildEvidenceIsCited, true);
  assert.equal(report.noNewChildBoundary.createChildFromStaleChecklistText, false);
  assert.equal(report.noNewChildBoundary.reportActiveDevelopmentFromEpicOnlyQueue, false);
  assert.equal(report.noNewChildBoundary.drainReadyLabelAllowed, true);
  assert.equal(report.closeoutReceiptBoundary.issue, "#1079");
  assert.equal(report.closeoutReceiptBoundary.activeDevelopmentEvidence, false);
  assert.equal(report.closeoutReceiptBoundary.autoCloseEpic960, false);
  assert.equal(report.closeoutReceiptBoundary.mutatesGitHub, false);
  assert.equal(
    report.closeoutReceiptBoundary.boundedNextAction,
    "write-operator-closeout-receipt-for-960-without-closing-epic",
  );
  assert.equal(
    report.preservesNextChildEvidenceBehavior.operatorCheckJsonPath,
    "activeWorkReceipts.nextChildEvidenceBoundary",
  );
  assert.equal(
    report.safeNextAction,
    "cite-landed-child-evidence-then-drain-epic-without-creating-new-child",
  );
  assert.match(report.rule, /not active development/);
  assert.match(report.rule, /not another auto-sliced child/);
  assert.match(report.rule, /bounded #960 closeout receipt/);
  assert.match(report.rule, /without closing #960 or mutating GitHub/);
});

test("issue #1077 docs name read-only non-authorizing and next-child preservation boundaries", () => {
  for (const required of [
    "Issue #1077 drain-ready cutoff",
    "narrow read-only dogfood/operator artifact for Epic `#960`",
    "prevents a clean `main` checkout with only Epic `#960` open from being reported as active development",
    "endlessly spawning another child from stale unchecked epic checklist text",
    "bounded next action is an operator closeout receipt for `#960`",
    "must say there is no active development",
    "It must not auto-close `#960`",
    "no-new-child/drain-ready",
    "Concrete child evidence still wins",
    "activeWorkReceipts.nextChildEvidenceBoundary",
    "does not update or close GitHub issues",
    "does not weaken approvals/CI/merge gates",
    "activeWorkReceipts.drainReadyCutoff",
    "activeWorkReceipts.drainReadyCutoff.closeoutReceiptBoundary",
    "operatorStatusCues.closeoutReceipt",
    "issue #1079 `closeoutReceiptBoundary`",
    "issue #1077 drain-ready cutoff summary",
    "stale checklist text cannot auto-create another child",
  ]) {
    assertDocsInclude(required);
  }
});
