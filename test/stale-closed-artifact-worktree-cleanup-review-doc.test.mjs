// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "stale-closed-artifact-worktree-cleanup-review-918.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #918 artifact records stale closed-artifact worktrees as cleanup-review evidence only", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#918");
  assert.equal(report.readOnly, true);
  assert.equal(report.cleanupCommandsIncluded, false);
  assert.equal(report.cleanupAuthorityGranted, false);
  assert.equal(report.activeWorkEvidence, false);
  assert.equal(report.candidates.length, 2);

  assert.deepEqual(report.candidates.map((candidate) => candidate.path), [
    "/Users/veluga/Documents/Workspace_Minseol/fooks-fixture-expectation-lock",
    "/Users/veluga/Documents/Workspace_Minseol/fooks-manifest-shape-guard",
  ]);
  assert.deepEqual(report.candidates.map((candidate) => candidate.branch), [
    "docs/frontend-domain-fixture-expectation-lock",
    "docs/frontend-domain-manifest-shape-guard",
  ]);
  assert.deepEqual(report.candidates.map((candidate) => candidate.manualCleanupCommands), [[], []]);
  assert.equal(report.decision.treatAsCleanupReviewEvidence, true);
  assert.equal(report.decision.treatAsCurrentActiveWork, false);
  assert.equal(report.decision.runCleanupAutomatically, false);
  assert.match(report.decision.operatorRule, /Do not present them as active development/);
});

test("issue #918 artifact preserves no-cleanup-command boundary", () => {
  for (const required of [
    "narrow read-only dogfood artifact for issue #918",
    "cleanup-review evidence only",
    "not active work evidence",
    "not cleanup authority",
    "not a command sheet",
    "manualCleanupCommands: []",
    "no tmux panes mapped to this worktree",
    "worktree is not the current working directory",
    "Do not convert this artifact into automatic cleanup behavior",
    "operator cleanup-review boundary only",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #918 doc text: ${required}`);
  }

  assert.doesNotMatch(doc, /git worktree remove|git worktree prune|git branch -d|tmux kill-session/u);
});
