// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const doc = fs.readFileSync(path.join(repoRoot, "docs", "post-merge-main-ci-echo-boundary.md"), "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function assertDocIncludes(text) {
  assert.ok(compactDoc.includes(text), `missing boundary text: ${text}`);
}

test("post-merge main CI echo boundary doc names the read-only operator surfaces", () => {
  for (const required of [
    "echo receipt only",
    "open issue, an open pull request, a non-`main` active branch/worktree signal, or a mapped fooks tmux session",
    "the echo receipt and the active artifact receipt separate",
    "Clean-slate nudge boundary",
    "active issue, active branch/session, or active PR evidence",
    "Merged CI echo receipt",
    "no active issue/branch/session/PR is currently attached",
    "must not imply that the merged CI echo is itself an active development artifact",
    "Development reminder active-artifact rule",
    "must not end as a status-only idle report",
    "report a real blocker that prevents starting bounded work or create/adopt one active artifact",
    "issue, branch, session, or PR",
    "cannot treat the checkout as active development until one is created or linked",
    "should not present clean `main` status, green CI, or stale local worktree inventory as the next development action",
    "Keep this reminder-anchor rule separate from the `fooks check` required-artifact contract",
    "Branch-only evidence can be an active work receipt or reminder anchor",
    "does not satisfy `fooks check` `requiredActiveArtifact` by itself",
    "operator/check field remains limited to an open GitHub issue, an open GitHub pull request, or a mapped fooks tmux session",
    "For issue #865",
    "activeWorkReceipts.legacyReviewWorktreeResidueBoundary",
    "stale-manual-review-evidence",
    "the eight old-review-worktree case",
    "satisfiesActiveDevelopmentRequirement: false",
    "Actual active development must come from issue, branch, session, or PR evidence, or from a concrete blocker",
    "the issue #865 clean-slate nudge summary for old local review worktrees",
    "stale/manual-review evidence",
    "For issue #867",
    "activeWorkReceipts.postReceiptNudgeAnchorBoundary",
    "#866 main CI/release success and closed legacy worktree bucket as receipts only",
    "fresh post-receipt nudge must name a new issue, branch, session, PR anchor, or a concrete blocker",
    "requiresFreshPostReceiptNudgeAnchor: true",
    "green receipt is not enough to describe active development",
    "the issue #867 post-receipt nudge summary",
    "sets receipt active-development evidence to false",
    "fooks check --json",
    'verdict: "idleRequiresActiveArtifact"',
    "requiredActiveArtifact.required: true",
    "open GitHub issue, an open GitHub pull request, or a mapped fooks tmux session",
    "fooks status activity --include-remote-counts --json",
    "currentRunEvidence",
    'classification: "mainEchoNonActive"',
    "mainEchoEvidence: true",
    "activeWorkEvidence: false",
    "ci:alerts",
    'verdict: "current-main-echo"',
    'disposition: "verification-only"',
    "npm run evidence:react-web-release-report",
    "advisory release report",
  ]) {
    assertDocIncludes(required);
  }
});

test("post-merge main CI echo boundary doc preserves non-goals", () => {
  for (const nonGoal of [
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web behavior",
    "React Native behavior",
    "TUI behavior",
    "WebView behavior",
    "no performance, product, billing, provider-cost, runtime-token, or broad-support claim",
    "not cleanup authority",
  ]) {
    assertDocIncludes(nonGoal);
  }
});
