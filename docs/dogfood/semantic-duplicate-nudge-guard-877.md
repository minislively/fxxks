# Semantic duplicate nudge guard boundary (#877)

This is a narrow read-only dogfood docs/test artifact for issue #877. It covers
what a fresh fooks dogfood nudge should do after a clean merge when the recent
closed dogfood chain is already saturated with receipt-vs-active-anchor variants:
inspect the recent closed chain, cut semantic duplicates, then spawn/adopt
exactly one distinct issue/branch/OMX target.

## Recent closed-chain inspection

The inspected chain is the closed dogfood axis `#863/#865/#867/#869/#871/#873/#875`.
Those issues are all valid closed receipts, but they already cover the same
family of pain: a clean post-merge or post-success nudge must not answer with the
last receipt, stale residue, or an empty state instead of current target
evidence.

| Issue | Closed at (UTC) | Closed title | Duplicate-cut reason |
| --- | --- | --- | --- |
| #863 | 2026-05-15T10:09:16Z | Dogfood: separate final green receipts from next development anchor | Final green receipt vs next anchor already closed. |
| #865 | 2026-05-15T12:13:46Z | Dogfood: classify legacy review worktrees during clean-slate nudges | Clean-slate stale-residue vs active anchor already closed. |
| #867 | 2026-05-15T14:10:34Z | Dogfood: require active anchor after post-receipt nudge | Post-receipt active-anchor requirement already closed. |
| #869 | 2026-05-15T16:09:16Z | Dogfood: prevent repeated receipt-only nudge reports | Repeated receipt-only loop prevention already closed. |
| #871 | 2026-05-15T18:08:19Z | Dogfood: report current-development nudge as spawned target evidence | Spawned target evidence shape already closed. |
| #873 | 2026-05-15T20:10:50Z | Dogfood: keep post-success nudge from becoming final receipt replay | Post-success replay boundary already closed. |
| #875 | 2026-05-15T22:08:11Z | Dogfood: force session-whip artifact after final CI receipt | Idle-forbidden final-receipt artifact already closed. |

A fresh dogfood nudge must not reopen any row in that table under new wording.
It may cite the row as duplicate-cut evidence, but the live target must name a
current pain that is distinct from the closed receipt-vs-active-anchor boundary.

## Guard rule

When the clean-slate pre-nudge inventory has zero open PR/issues and zero live
OMX/fooks session evidence, the nudge may still spawn/adopt one live target.
Before it does, it must inspect recent closed dogfood issues and cut candidates
whose only pain is another wording of the closed receipt-vs-active-anchor chain.
The valid outcome is exactly one distinct issue/branch/OMX target with current evidence:

1. issue evidence for `#877`;
2. non-`main` branch/worktree evidence for
   `dogfood/issue-877-semantic-duplicate-nudge-guard`;
3. mapped OMX session evidence for this worktree;
4. duplicate-cut evidence for `#863/#865/#867/#869/#871/#873/#875`;
5. `delta` evidence for this docs/test artifact;
6. `ahead` evidence against `origin/main`; and
7. `proc` evidence for the running session process.

The distinct current pain for #877 is the **semantic duplicate nudge guard**:
clean-slate nudges should continue spawning one live target, but only after
filtering recently closed dogfood artifacts so the new target is not a synonym
for the same final-receipt boundary.

## Captured read-only report shape

```json
{
  "issue": "#877",
  "readOnly": true,
  "question": "fresh dogfood nudge after a closed receipt-vs-active-anchor chain",
  "recentClosedChainGuard": {
    "inspectedIssues": [863, 865, 867, 869, 871, 873, 875],
    "closedAxis": "receipt-vs-active-anchor",
    "semanticDuplicatesCut": [863, 865, 867, 869, 871, 873, 875],
    "reopenClosedAxisAllowed": false,
    "requiresDistinctCurrentPain": true
  },
  "currentTargetEvidence": {
    "adoptedIssue": {
      "number": 877,
      "title": "Dogfood: avoid semantic duplicate nudge artifacts after closeout",
      "isCurrentTargetEvidence": true,
      "distinctCurrentPain": "semantic duplicate nudge guard for recently closed dogfood artifacts"
    },
    "adoptedBranch": {
      "name": "dogfood/issue-877-semantic-duplicate-nudge-guard",
      "isMain": false,
      "isCurrentTargetEvidence": true
    },
    "mappedOmxSession": {
      "session": "fooks-dogfood-issue-877-semantic-duplicate-nudge-guard",
      "pane": "0.0",
      "worktree": "issue-877-semantic-duplicate-nudge-guard",
      "isCurrentTargetEvidence": true
    },
    "delta": {
      "kind": "worktree-delta",
      "required": true,
      "evidence": "focused docs/test delta for issue #877; not another prior receipt artifact"
    },
    "ahead": {
      "kind": "base-divergence",
      "required": true,
      "evidence": "git rev-list --left-right --count origin/main...HEAD reported 0 0 at target adoption before this artifact commit"
    },
    "proc": {
      "kind": "mapped-process",
      "required": true,
      "evidence": "notify/codex process observed with cwd /home/bellman/Workspace/fooks.omx-worktrees/issue-877-semantic-duplicate-nudge-guard under parent pane process 994610"
    }
  },
  "receiptOnlyEvidence": {
    "closedIssues": ["#863", "#865", "#867", "#869", "#871", "#873", "#875"],
    "closedChainIsCurrentTargetEvidence": false,
    "closedChainMayBeReopenedUnderNewWording": false
  },
  "nudgeAnswerRule": "Inspect recent closed dogfood issues, cut semantic duplicates on the receipt-vs-active-anchor axis, then answer with exactly one distinct target: issue #877, branch dogfood/issue-877-semantic-duplicate-nudge-guard, OMX session, delta, ahead, and proc evidence."
}
```

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, performance claims, product
claims, cleanup authority, release criteria, or the semantics of final `main` CI
receipts. It documents and tests the recent-closed-chain guard only.

## Focused verification

```sh
node --test test/semantic-duplicate-nudge-guard-doc.test.mjs test/session-whip-final-receipt-artifact-doc.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```
