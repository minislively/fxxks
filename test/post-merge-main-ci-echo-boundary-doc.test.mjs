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
    "For issue #869",
    "activeWorkReceipts.receiptOnlyNudgeLoopBoundary",
    "PR #868 merged commit and successful `main` CI run as prior receipts only",
    "newly created/adopted issue evidence plus mapped OMX session evidence",
    "requiresIssueAndOmxSessionEvidence: true",
    "another receipt-only report is not an active development anchor",
    "For issue #1065",
    "activeWorkReceipts.nextChildEvidenceBoundary",
    "main CI/release success and completed-child receipt handling as status-only receipts",
    "requiresConcreteNextChildEvidence: true",
    "concrete next child issue, PR, branch, mapped session, active worktree/process evidence, or concrete blocker",
    "For issue #1077",
    "activeWorkReceipts.drainReadyCutoff",
    "no-new-child/drain-ready",
    "stale checklist text cannot auto-create another child",
    "preserve the existing `activeWorkReceipts.nextChildEvidenceBoundary` behavior instead",
    "the issue #867 post-receipt nudge summary",
    "sets receipt active-development evidence to false",
    "the issue #869 receipt-only nudge-loop summary",
    "sets repeated receipt-only reports to false",
    "the issue #1065 next-child evidence summary",
    "completed-child receipt handling status-only",
    "sets status-only receipts as non-active-work evidence",
    "epic-only #960 queue",
    "the issue #1077 drain-ready cutoff summary",
    "allows a no-new-child/drain-ready operator label only after landed child evidence is cited",
    "defers to `activeWorkReceipts.nextChildEvidenceBoundary` whenever concrete child issue/session/PR/branch/worktree-process/blocker evidence exists",
    "docs/dogfood/current-development-nudge-target-871.md",
    "the issue #871 current-development nudge target artifact",
    "PR #870 merged CI/release receipts receipt-only",
    "spawned issue #871",
    "mapped OMX session",
    "`delta`, `ahead`, and `proc` fields",
    "docs/dogfood/post-success-nudge-replay-boundary-873.md",
    "the issue #873 post-success nudge replay boundary artifact",
    "PR #872 green `main` CI/release receipts receipt-only",
    "when open PR/issues and live OMX are zero",
    "spawn/adopt one current issue/branch/session target",
    "instead of answering with the prior CI receipt",
    "docs/dogfood/session-whip-final-receipt-artifact-875.md",
    "the issue #875 session-whip final-receipt artifact",
    "PR #874 final `main` CI receipts receipt-only",
    "live issue/branch/session/PR target with worktree, `delta`, `ahead`, `proc`,",
    "instead of answering with the prior receipt or an empty state",
    "docs/dogfood/semantic-duplicate-nudge-guard-877.md",
    "the issue #877 recent-closed-chain guard artifact",
    "closed dogfood issues #863/#865/#867/#869/#871/#873/#875",
    "cuts semantic duplicates on the receipt-vs-active-anchor axis",
    "exactly one distinct current pain target",
    "issue #877, the non-`main` branch/worktree, mapped OMX session",
    "docs/dogfood/closed-audit-id-anchor-guard-881.md",
    "the issue #881 closed-audit-ID anchor guard artifact",
    "`worktree:audit` `linkedIssue` #854 and nested orphan-triage `linkedIssue` #711 as closed audit provenance only",
    "open PR/issues, mapped tmux sessions, and mapped `/proc` evidence are zero",
    "must not answer with #854 or #711 as the current active development anchor",
    "adopt or name a distinct live issue/branch/session/PR/proc target before describing active development",
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
