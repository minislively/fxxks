// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "closed-audit-id-anchor-guard-881.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #881 artifact marks closed worktree audit issue IDs as non-active evidence", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#881");
  assert.equal(report.readOnly, true);
  assert.equal(report.question, "classify closed worktree:audit linked issue IDs during clean-slate dogfood nudges");
  assert.deepEqual(report.cleanSlateInputs, {
    openPullRequests: 0,
    openIssues: 0,
    mappedTmuxSessions: 0,
    mappedProcWorktreeProcesses: 0,
    activeEvidencePresent: false,
  });

  assert.equal(report.auditMetadata.worktreeAudit.command, "worktree:audit");
  assert.equal(report.auditMetadata.worktreeAudit.linkedIssue, "#854");
  assert.equal(report.auditMetadata.worktreeAudit.linkedIssueState, "closed");
  assert.match(report.auditMetadata.worktreeAudit.operatorMeaning, /audit provenance only/);
  assert.match(report.auditMetadata.worktreeAudit.operatorMeaning, /not current active development/);

  assert.equal(report.auditMetadata.nestedOrphanTriage.command, "status orphan-worktrees");
  assert.equal(report.auditMetadata.nestedOrphanTriage.linkedIssue, "#711");
  assert.equal(report.auditMetadata.nestedOrphanTriage.linkedIssueState, "closed");
  assert.match(report.auditMetadata.nestedOrphanTriage.operatorMeaning, /nested triage provenance only/);
  assert.match(report.auditMetadata.nestedOrphanTriage.operatorMeaning, /not current active development/);

  assert.equal(report.closedAuditIdDecision.closedAuditIdsAreActiveEvidence, false);
  assert.equal(report.closedAuditIdDecision.mayNameAsCurrentDevelopmentAnchor, false);
  assert.equal(report.closedAuditIdDecision.classification, "closed-audit-provenance-non-active");
  assert.match(report.closedAuditIdDecision.reason, /#854 and #711 are closed audit\/report provenance IDs/);
  assert.match(report.nudgeAnswerRule, /open PR\/issues\/tmux\/proc are zero/);
  assert.match(report.nudgeAnswerRule, /closed audit provenance only/);
  assert.match(report.nudgeAnswerRule, /do not use either closed ID as the current active development anchor/);
  assert.match(report.nudgeAnswerRule, /Adopt or name a distinct live issue\/branch\/session\/PR\/proc target/);
});

test("issue #881 artifact preserves the requested narrow non-goals", () => {
  for (const required of [
    "narrow read-only dogfood docs/test/operator artifact for issue #881",
    "open PRs, open issues, mapped tmux sessions, and mapped `/proc` evidence are all zero",
    "top-level `linkedIssue: \"#854\"`",
    "nested orphan-triage `linkedIssue: \"#711\"`",
    "not current active development anchors",
    "Current live anchors first",
    "Audit metadata second",
    "Closed audit IDs never become active anchors",
    "A clean-slate nudge may describe active development only from a live issue, branch, session, PR, mapped process, or a concrete blocker",
    "must not answer \"current work is #854\"",
    "\"current work is #711\"",
    "closed-audit-provenance-non-active",
    "audit `linkedIssue` fields as report provenance",
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web/RN/TUI/WebView behavior",
    "performance claims",
    "product claims",
    "duplicate-guard detection",
    "`worktree:audit` output shape",
    "nested orphan triage output shape",
    "`fooks check` output",
    "operator reporting boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #881 doc text: ${required}`);
  }
});
