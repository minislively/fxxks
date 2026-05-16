# Issue #885 fooks-check handoff artifact evidence

This is a narrow read-only dogfood artifact for issue #885. It makes the
`fooks check` handoff rule explicit without changing runtime/provider behavior,
merge-gate policy, detector scope, React Web/RN/TUI/WebView behavior,
performance claims, or product claims.

## Rule

When `fooks check` is used as a handoff after clean `main` receipts or an idle
status-summary-forbidden nudge:

1. Adopt live evidence first when any live PR, issue, mapped session, or
   non-`main` worktree is already present.
2. If none is present, create exactly one bounded issue, branch, or session for
   the current run.
3. Report concrete artifact evidence: identifier, source, worktree `delta`,
   `ahead`, and `/proc`/pane evidence. Do not answer with the prior CI/release
   receipt, stale local residue, or a generic idle summary.

This #885 handoff report is nested dogfood evidence. It does not change the
top-level `requiredActiveArtifact` contract, which remains limited to open issue,
open PR, or mapped fooks tmux session.

## Current run evidence

```json
{
  "issue": "#885",
  "readOnly": true,
  "question": "what fooks-check handoff artifact should be reported?",
  "handoffRule": "adopt-live-artifact-else-create-exactly-one",
  "preHandoffInventory": {
    "openIssue": {
      "number": 885,
      "state": "OPEN",
      "url": "https://github.com/minislively/fooks/issues/885",
      "isLiveArtifactEvidence": true
    },
    "openPullRequestCount": 0,
    "mappedSession": {
      "session": "fooks-dogfood-issue-885-fooks-check-artifact-evidence",
      "pane": "0",
      "worktree": "/home/bellman/Workspace/fooks.omx-worktrees/issue-885-fooks-check-artifact-evidence",
      "isLiveArtifactEvidence": true
    },
    "liveWorktree": {
      "branch": "dogfood/issue-885-fooks-check-artifact-evidence",
      "isMain": false,
      "isLiveArtifactEvidence": true
    }
  },
  "decision": {
    "adoptLiveArtifactPresent": true,
    "runCreatedArtifactRequired": false,
    "exactlyOneRunCreatedArtifactIfIdle": ["issue", "branch", "session"],
    "mustReportConcreteEvidence": ["issue #885", "branch", "mapped session", "delta", "ahead", "proc"]
  },
  "currentReportEvidence": {
    "adoptedIssue": "#885",
    "adoptedBranch": "dogfood/issue-885-fooks-check-artifact-evidence",
    "mappedSession": "fooks-dogfood-issue-885-fooks-check-artifact-evidence",
    "delta": {
      "required": true,
      "evidence": "working tree contains this docs/test/operator artifact while in progress"
    },
    "ahead": {
      "required": true,
      "evidence": "local branch tracks origin/main; ahead count is reported before handoff/PR"
    },
    "proc": {
      "required": true,
      "evidence": "tmux/OMX process command includes issue-885-fooks-check-artifact-evidence worktree path"
    }
  },
  "receiptOnlyEvidence": {
    "priorCleanMainReceiptsAreCurrentTargetEvidence": false,
    "staleLocalResidueIsCurrentTargetEvidence": false,
    "genericStatusSummaryAllowed": false
  },
  "fooksCheckAnswerRule": "Adopt live issue/PR/session/worktree evidence when present; otherwise create exactly one issue, branch, or session for this run and report concrete run-created artifact evidence with delta/ahead/proc. Do not answer with a clean main receipt, stale residue, or an idle status summary."
}
```

## Non-goals

- This artifact does not change runtime/provider behavior.
- This artifact does not change merge-gate policy.
- This artifact does not broaden detector scope.
- This artifact does not change React Web/RN/TUI/WebView behavior.
- It adds no performance claims and no product claims.
- Does not create cleanup authority, deletion authority, provider billing proof,
  or runtime-token evidence.
- Documents and tests the `fooks check` handoff report boundary only.
