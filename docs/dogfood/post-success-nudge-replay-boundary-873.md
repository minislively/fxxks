# Post-success nudge replay boundary (#873)

This is a narrow read-only dogfood docs/test artifact for issue #873. It covers
the state after PR #872 merged and both latest `main` CI/release receipts are
green: a fresh fooks nudge must not collapse into replaying that final receipt.
It must name the current target that was spawned or adopted for the new nudge.

## Post-success replay boundary

When the pre-nudge inventory has zero open PR/issues and zero live OMX/fooks
session evidence, the next nudge must create or adopt exactly one bounded target
before reporting active development. The target can then be described only with
current evidence:

1. issue evidence for `#873`;
2. non-`main` branch/worktree evidence for
   `dogfood/issue-873-post-success-nudge-replay-boundary`;
3. mapped OMX/fooks session evidence for that worktree; and
4. `delta`, `ahead`, and `proc` evidence in the same report.

The PR #872 `main` CI/release receipts remain prior success receipts. They may
explain why the previous work is closed, but they must not be replayed as the
answer to the fresh nudge.

## Expected read-only report shape

```json
{
  "issue": "#873",
  "readOnly": true,
  "question": "what is the current post-success nudge target?",
  "preNudgeInventory": {
    "openIssueCount": 0,
    "openPullRequestCount": 0,
    "liveOmxSessionCount": 0,
    "requiresSpawnOrAdoptTarget": true
  },
  "currentTargetEvidence": {
    "adoptedIssue": {
      "number": 873,
      "isCurrentTargetEvidence": true
    },
    "adoptedBranch": {
      "name": "dogfood/issue-873-post-success-nudge-replay-boundary",
      "isMain": false,
      "isCurrentTargetEvidence": true
    },
    "mappedOmxSession": {
      "session": "fooks-dogfood-issue-873-post-success-nudge-replay-boundary",
      "worktree": "issue-873-post-success-nudge-replay-boundary",
      "isCurrentTargetEvidence": true
    },
    "delta": {
      "kind": "worktree-delta",
      "required": true,
      "meaning": "current target worktree changes, not prior green receipt state"
    },
    "ahead": {
      "kind": "base-divergence",
      "required": true,
      "meaning": "current target branch ahead/behind count against origin/main"
    },
    "proc": {
      "kind": "mapped-process",
      "required": true,
      "meaning": "live OMX/fooks process or session evidence for the current target"
    }
  },
  "receiptOnlyEvidence": {
    "mergedPullRequest": "#872",
    "mainCiAndReleaseReceiptsGreen": true,
    "priorReceiptsAreCurrentTargetEvidence": false
  },
  "nudgeAnswerRule": "If open PR/issues and live OMX are zero, spawn/adopt one issue/branch/session target and answer with issue #873 plus branch/session delta/ahead/proc evidence; do not answer with the PR #872 CI/release receipt."
}
```

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, performance claims, product
claims, cleanup authority, or release criteria. It documents and tests the
post-success nudge report boundary only.

## Focused verification

```sh
node --test test/post-success-nudge-replay-boundary-doc.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```
