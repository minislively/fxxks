# Stale approval-gate failure replay boundary (#899)

This is a narrow read-only dogfood docs/test/operator artifact for issue #899.
It uses the PR #898 evidence trail to keep a stale failed approval-gate job replay
separate from live current-head PR gate state after a rerun and merge.

## Captured evidence from PR #898

- Original failed approval-gate run/job: `25969204750` / `76338018714`
- Same-run rerun passing job: `76338153094`
- PR #898 merged commit marker: `MERGED=644d7a9`
- Linked issue state: issue `#897` is `CLOSED`
- Post-merge `main` CI run: `25969259209` concluded `success`

The failed job `76338018714` is stale replay evidence after the same workflow run
later produced passing job `76338153094`, PR #898 merged at `644d7a9`, issue
#897 closed, and `main` CI run `25969259209` succeeded. It can be retained as
audit provenance, but it must not be reported as the live current-head PR gate
state.

## Operator boundary rule

Keep these two lanes separate:

1. **Stale failed-job replay lane**: historical failed run/job IDs, replayed
   failure notifications, old check URLs, and any alert that points back to the
   superseded failing job `76338018714`.
2. **Live current-head PR gate lane**: the current PR head or merged commit,
   same-run rerun result, linked issue state, merge marker, and post-merge
   `main` CI result.

For PR #898, the live lane is resolved: same-run rerun passed, `MERGED=644d7a9`,
issue #897 is closed, and `main` CI `25969259209` succeeded. A stale replay of
the original failed job must be labeled as stale audit evidence, not as a new
merge blocker, current-head gate failure, or request to change merge-gate policy.

## Expected read-only report shape

```json
{
  "issue": "#899",
  "readOnly": true,
  "question": "distinguish stale failed approval-gate replay from live current-head PR gate state after PR #898 rerun and merge",
  "sourcePullRequest": "#898",
  "evidence": {
    "originalFailedApprovalGate": {
      "runId": "25969204750",
      "jobId": "76338018714",
      "classification": "stale-failed-job-replay",
      "isLiveCurrentHeadGateState": false
    },
    "sameRunRerunPass": {
      "runId": "25969204750",
      "jobId": "76338153094",
      "supersedesOriginalFailedJob": true,
      "isLiveCurrentHeadGateState": true
    },
    "mergeReceipt": {
      "pullRequest": "#898",
      "mergedCommit": "644d7a9",
      "marker": "MERGED=644d7a9",
      "isLiveCurrentHeadGateState": true
    },
    "linkedIssueReceipt": {
      "issue": "#897",
      "state": "CLOSED",
      "isLiveCurrentHeadGateState": true
    },
    "postMergeMainCi": {
      "runId": "25969259209",
      "conclusion": "success",
      "isLiveCurrentHeadGateState": true
    }
  },
  "operatorDecision": {
    "staleFailureReplayIsAuditProvenance": true,
    "staleFailureReplayIsCurrentHeadGateFailure": false,
    "staleFailureReplayReopensMergedPr": false,
    "staleFailureReplayReopensClosedIssue": false,
    "staleFailureReplayChangesMergeGatePolicy": false,
    "rule": "When a failed approval-gate job is replayed after a same-run rerun passed, the PR merged, the linked issue closed, and post-merge main CI succeeded, report the failed job as stale audit provenance only. Use the rerun pass, merge marker, closed issue, and green main CI as the live current-head PR gate lane."
  }
}
```

## Operator reading order

1. Check whether the alert names the superseded failed job `76338018714` from
   run `25969204750`.
2. Check whether the same run later has passing job `76338153094`.
3. Check merged PR evidence: `MERGED=644d7a9` for PR #898.
4. Check linked issue state: issue #897 is closed.
5. Check post-merge `main` CI: run `25969259209` succeeded.
6. If all five facts hold, answer with the stale-replay classification and do
   not present the old failed job as live current-head PR gate state.

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, product claims, performance
claims, CI workflow behavior, approval requirements, rerun semantics, issue
closure policy, or release criteria. It documents and tests the operator
reporting boundary only.

## Focused verification

```sh
node --test test/stale-approval-gate-failure-replay-doc.test.mjs test/merge-gate-workflow.test.mjs test/pr-merge-gate.test.mjs
```
