// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "fooks-check-handoff-artifact-evidence-885.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

/** @param {string} markdown */
function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #885 artifact documents the fooks-check handoff evidence rule", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#885");
  assert.equal(report.readOnly, true);
  assert.equal(report.question, "what fooks-check handoff artifact should be reported?");
  assert.equal(report.handoffRule, "adopt-live-artifact-else-create-exactly-one");

  assert.equal(report.preHandoffInventory.openIssue.number, 885);
  assert.equal(report.preHandoffInventory.openIssue.state, "OPEN");
  assert.equal(report.preHandoffInventory.openIssue.isLiveArtifactEvidence, true);
  assert.equal(report.preHandoffInventory.openPullRequestCount, 0);
  assert.equal(report.preHandoffInventory.mappedSession.session, "fooks-dogfood-issue-885-fooks-check-artifact-evidence");
  assert.equal(report.preHandoffInventory.mappedSession.isLiveArtifactEvidence, true);
  assert.equal(report.preHandoffInventory.liveWorktree.branch, "dogfood/issue-885-fooks-check-artifact-evidence");
  assert.equal(report.preHandoffInventory.liveWorktree.isMain, false);

  assert.equal(report.decision.adoptLiveArtifactPresent, true);
  assert.equal(report.decision.runCreatedArtifactRequired, false);
  assert.deepEqual(report.decision.exactlyOneRunCreatedArtifactIfIdle, ["issue", "branch", "session"]);
  assert.deepEqual(report.decision.mustReportConcreteEvidence, ["issue #885", "branch", "mapped session", "delta", "ahead", "proc"]);

  for (const field of ["delta", "ahead", "proc"]) {
    assert.equal(report.currentReportEvidence[field].required, true, `${field} must be required handoff evidence`);
    assert.match(report.currentReportEvidence[field].evidence, /\S/u, `${field} must carry concrete evidence text`);
  }

  assert.equal(report.receiptOnlyEvidence.priorCleanMainReceiptsAreCurrentTargetEvidence, false);
  assert.equal(report.receiptOnlyEvidence.staleLocalResidueIsCurrentTargetEvidence, false);
  assert.equal(report.receiptOnlyEvidence.genericStatusSummaryAllowed, false);
  assert.match(report.fooksCheckAnswerRule, /Adopt live issue\/PR\/session\/worktree evidence/);
  assert.match(report.fooksCheckAnswerRule, /create exactly one issue, branch, or session/);
  assert.match(report.fooksCheckAnswerRule, /delta\/ahead\/proc/);
  assert.match(report.fooksCheckAnswerRule, /Do not answer with a clean main receipt/);
});

test("issue #885 artifact preserves the requested narrow non-goals", () => {
  for (const required of [
    "narrow read-only dogfood artifact for issue #885",
    "`fooks check` handoff rule",
    "Adopt live evidence first",
    "live PR, issue, mapped session, or non-`main` worktree",
    "create exactly one bounded issue, branch, or session",
    "identifier, source, worktree `delta`, `ahead`, and `/proc`/pane evidence",
    "prior CI/release receipt",
    "stale local residue",
    "generic idle summary",
    "dogfood/issue-885-fooks-check-artifact-evidence",
    "fooks-dogfood-issue-885-fooks-check-artifact-evidence",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "performance claims",
    "product claims",
    "`fooks check` handoff report boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #885 doc text: ${required}`);
  }
});
