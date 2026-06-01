// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyPostCleanMergeSessionWhipActivityCue } from "./helpers/stale-epic-checklist-boundary.mjs";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "post-clean-merge-session-whip-activity-1137.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

function assertDocsInclude(text) {
  assert.ok(compactDoc.includes(text), `missing issue #1137 doc text: ${text}`);
}

test("issue #1137 helper treats zero-backlog clean post-merge whip as idle", () => {
  assert.deepEqual(
    classifyPostCleanMergeSessionWhipActivityCue({
      branch: "main",
      clean: true,
      ahead: 0,
      behind: 0,
      openIssueCount: 0,
      openPullRequestCount: 0,
      evidence: {
        issues: [],
        branches: [],
        worktrees: [],
        sessions: [],
        pullRequests: [],
        processes: [],
        blockers: [],
      },
    }),
    {
      issue: "#1137",
      classification: "post-clean-merge-session-whip-idle",
      cleanPostMergeEcho: true,
      zeroBacklog: true,
      activeDevelopmentAllowed: false,
      sourceBackedActivityCue: false,
      activeEvidenceKinds: [],
      requiredBeforeActiveDevelopment: [
        "open-issue",
        "active-branch",
        "active-session",
        "open-pull-request",
        "active-worktree",
        "active-process",
        "concrete-blocker",
      ],
      mutationBoundary: {
        createsIssuesFromCli: false,
        mutatesGitHub: false,
        mutatesWorktrees: false,
        changesRuntimeProviderFrontendOrMergeGatePolicy: false,
        changesReactWebBehavior: false,
        inventsBacklog: false,
      },
      rule: "A clean post-merge session whip with zero open issues, zero open PRs, and no concrete issue/branch/session/PR/worktree/process/blocker evidence remains idle; create or adopt exactly one bounded live artifact before claiming active development.",
    },
  );
});

test("issue #1137 helper treats the adopted issue branch worktree as source-backed activity", () => {
  const result = classifyPostCleanMergeSessionWhipActivityCue({
    branch: "fooks-session-whip-post-merge-activity",
    clean: false,
    ahead: 0,
    behind: 0,
    openIssueCount: 1,
    openPullRequestCount: 0,
    evidence: {
      issues: [{ number: 1137, state: "open" }],
      branches: [{ name: "fooks-session-whip-post-merge-activity", active: true }],
      worktrees: [{ path: "/home/bellman/Workspace/fooks.omx-worktrees/fooks-issue-1137-post-merge-session-whip", active: true }],
      sessions: [],
      pullRequests: [],
      processes: [],
      blockers: [],
    },
  });

  assert.equal(result.issue, "#1137");
  assert.equal(result.classification, "source-backed-session-whip-activity-cue");
  assert.equal(result.activeDevelopmentAllowed, true);
  assert.equal(result.sourceBackedActivityCue, true);
  assert.deepEqual(result.activeEvidenceKinds, ["open-issue", "active-branch", "active-worktree"]);
  assert.match(result.rule, /receipt-only closeout remains historical context/);
});

test("issue #1137 dogfood doc preserves the post-clean-merge activity cue contract", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#1137");
  assert.equal(report.readOnly, true);
  assert.equal(report.postCleanMergeReceipt.closedIssue, "#1135");
  assert.equal(report.postCleanMergeReceipt.mergedPullRequest, "#1136");
  assert.equal(report.postCleanMergeReceipt.activeDevelopmentEvidence, false);
  assert.equal(report.preCueInventory.openIssues, 0);
  assert.equal(report.preCueInventory.openPullRequests, 0);
  assert.equal(report.preCueInventory.mappedFooksTmuxSessions, 0);
  assert.equal(report.preCueInventory.classification, "post-clean-merge-session-whip-idle");
  assert.equal(report.currentActivityCue.classification, "source-backed-session-whip-activity-cue");
  assert.equal(report.currentActivityCue.adoptedIssue, "#1137");
  assert.equal(report.currentActivityCue.adoptedBranch, "fooks-session-whip-post-merge-activity");
  assert.deepEqual(report.currentActivityCue.activeEvidenceKinds, ["open-issue", "active-branch", "active-worktree"]);
  assert.equal(report.mutationBoundary.createsIssuesFromCli, false);
  assert.equal(report.mutationBoundary.changesReactWebBehavior, false);
  assert.equal(report.mutationBoundary.inventsBacklog, false);
  assert.match(report.rule, /zero open issues\/PRs\/sessions is idle/);
  assert.match(report.rule, /source-backed issue, branch, session, PR, worktree\/process, or blocker evidence/);

  for (const required of [
    "narrow read-only dogfood docs/test/help fixture for issue #1137",
    "fooks#1135 closed and PR #1136 merged",
    "repository backlog was empty",
    "zero open issues, zero open PRs, and zero mapped fooks tmux sessions",
    "must not treat the merged PR receipt",
    "create or adopt exactly one bounded live artifact",
    "open issue `#1137`",
    "non-`main` branch `fooks-session-whip-post-merge-activity`",
    "receipt-only evidence never does",
    "does not change runtime/provider behavior",
    "React Web/RN/TUI/WebView behavior",
    "does not make `fooks check`, `fooks status activity`, or CLI help create issues",
    "post-clean-merge session-whip activity report boundary",
  ]) {
    assertDocsInclude(required);
  }
});
