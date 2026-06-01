# Issue #1137 post-clean-merge session-whip activity cue

This is a narrow read-only dogfood docs/test/help fixture for issue #1137. It
covers the clean state after fooks#1135 closed and PR #1136 merged, when the
repository backlog was empty: zero open issues, zero open PRs, and zero mapped
fooks tmux sessions before the new whip target was created.

## Cue rule

A post-clean-merge session whip must not treat the merged PR receipt, green CI
receipt, or zero-backlog inventory as current active development. If idle is
forbidden, the operator must create or adopt exactly one bounded live artifact
and then report only source-backed current evidence for that target.

For this issue, the source-backed activity cue is the adopted issue/branch/worktree
pair:

- open issue `#1137`;
- non-`main` branch `fooks-session-whip-post-merge-activity`;
- worktree `/home/bellman/Workspace/fooks.omx-worktrees/fooks-issue-1137-post-merge-session-whip`.

A mapped session, open PR, active process, or concrete blocker may also satisfy
future whips when present, but receipt-only evidence never does.

## Captured read-only report shape

```json
{
  "issue": "#1137",
  "readOnly": true,
  "postCleanMergeReceipt": {
    "closedIssue": "#1135",
    "mergedPullRequest": "#1136",
    "receiptOnlyEvidence": true,
    "activeDevelopmentEvidence": false
  },
  "preCueInventory": {
    "openIssues": 0,
    "openPullRequests": 0,
    "mappedFooksTmuxSessions": 0,
    "classification": "post-clean-merge-session-whip-idle"
  },
  "currentActivityCue": {
    "classification": "source-backed-session-whip-activity-cue",
    "adoptedIssue": "#1137",
    "adoptedBranch": "fooks-session-whip-post-merge-activity",
    "adoptedWorktree": "/home/bellman/Workspace/fooks.omx-worktrees/fooks-issue-1137-post-merge-session-whip",
    "activeEvidenceKinds": [
      "open-issue",
      "active-branch",
      "active-worktree"
    ],
    "requiredBeforeActiveDevelopment": [
      "open-issue",
      "active-branch",
      "active-session",
      "open-pull-request",
      "active-worktree",
      "active-process",
      "concrete-blocker"
    ]
  },
  "mutationBoundary": {
    "createsIssuesFromCli": false,
    "mutatesGitHubFromStatusSurfaces": false,
    "mutatesWorktreesFromStatusSurfaces": false,
    "changesRuntimeProviderFrontendOrMergeGatePolicy": false,
    "changesReactWebBehavior": false,
    "inventsBacklog": false
  },
  "rule": "A clean post-merge session whip with zero open issues/PRs/sessions is idle until exactly one bounded live artifact is created or adopted; after adoption, report active development only from the source-backed issue, branch, session, PR, worktree/process, or blocker evidence."
}
```

## Non-goals

This cue does not change runtime/provider behavior, merge-gate policy, detector
scope, React Web/RN/TUI/WebView behavior, cleanup authority, performance claims,
product claims, release criteria, or GitHub mutation behavior. It does not make
`fooks check`, `fooks status activity`, or CLI help create issues, sessions,
branches, worktrees, or PRs. It only documents and tests the post-clean-merge
session-whip activity report boundary.

## Focused verification

```sh
node --test test/post-clean-merge-session-whip-activity-1137-doc.test.mjs test/operator-activity.test.mjs
```
