# Session whip final-receipt artifact boundary (#875)

This is a narrow read-only dogfood docs/test artifact for issue #875. It covers
the state after PR #874 merged and the final `main` CI receipts are green: a
fooks session whip with idle forbidden must not answer with the just-verified
receipt and must not report an empty state. It must immediately create or adopt
one live issue/branch/session/PR target, then answer only with concrete live
evidence for that target.

## Session-whip rule

When idle is forbidden and the latest available evidence is only a closed PR
receipt, the session whip must first create or adopt exactly one bounded live
artifact. The report is valid only when it contains concrete evidence for the
current target:

1. issue evidence for `#875`;
2. non-`main` branch evidence for
   `dogfood/issue-875-session-whip-final-receipt-artifact`;
3. mapped OMX session evidence for this worktree;
4. worktree evidence for the adopted target;
5. `delta` evidence for the live target worktree;
6. `ahead` evidence against `origin/main`;
7. `proc` evidence for the running session process; and
8. `pane` evidence for the attached tmux pane.

The PR #874 final `main` CI receipts remain receipt-only closeout evidence. They
may explain why the previous work is done, but they must not be reused as the
answer to a fresh session whip, and they must not replace live target evidence
with an empty state.

## Captured read-only report shape

```json
{
  "issue": "#875",
  "readOnly": true,
  "question": "session whip with idle forbidden after PR #874 final receipts",
  "currentTargetEvidence": {
    "adoptedIssue": {
      "number": 875,
      "isCurrentTargetEvidence": true
    },
    "adoptedBranch": {
      "name": "dogfood/issue-875-session-whip-final-receipt-artifact",
      "isMain": false,
      "isCurrentTargetEvidence": true
    },
    "mappedOmxSession": {
      "session": "fooks-dogfood-issue-875-session-whip-final-receipt-artifact",
      "isCurrentTargetEvidence": true
    },
    "worktree": {
      "path": "/home/bellman/Workspace/fooks.omx-worktrees/issue-875-session-whip-final-receipt-artifact",
      "isCurrentTargetEvidence": true
    },
    "delta": {
      "kind": "worktree-delta",
      "required": true,
      "evidence": "dogfood docs/test delta for issue #875; not a prior PR #874 receipt"
    },
    "ahead": {
      "kind": "base-divergence",
      "required": true,
      "evidence": "git rev-list --left-right --count origin/main...HEAD reported 0 0 at target adoption before this artifact commit"
    },
    "proc": {
      "kind": "mapped-process",
      "required": true,
      "evidence": "codex process observed in the adopted worktree session"
    },
    "pane": {
      "kind": "tmux-pane",
      "required": true,
      "evidence": "TMUX_PANE=%2 in session fooks-dogfood-issue-875-session-whip-final-receipt-artifact:0.0"
    }
  },
  "receiptOnlyEvidence": {
    "mergedPullRequest": "#874",
    "finalMainCiReceiptsGreen": true,
    "priorReceiptIsCurrentTargetEvidence": false,
    "emptyStateIsValidAnswer": false
  },
  "sessionWhipAnswerRule": "With idle forbidden after PR #874 final receipts, immediately create/adopt one live issue/branch/session/PR target and answer only with issue #875, branch, OMX session, worktree, delta, ahead, proc, and pane evidence. Do not answer with the PR #874 receipt or an empty state."
}
```

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, performance claims, product
claims, cleanup authority, release criteria, or the semantics of final `main` CI
receipts. It documents and tests the session-whip final-receipt report boundary
only.

## Focused verification

```sh
node --test test/session-whip-final-receipt-artifact-doc.test.mjs test/post-success-nudge-replay-boundary-doc.test.mjs
```
