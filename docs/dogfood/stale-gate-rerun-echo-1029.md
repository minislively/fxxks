# Issue #1029 stale gate rerun echo guard

This is a narrow read-only dogfood docs/test/helper guard for issue #1029. It
keeps the original approval/linked-issue gate failure relay from PR #1028
separate from the latest rerun result for the same current head.

## Captured PR #1028 evidence

- Source PR: `#1028` (`Classify interrupted local verification as inconclusive`)
- Current head SHA: `55384c5c08814c182677f6ef981b05233a535b24`
- Original failed approval/linked-issue gate relay: run `26250077038`, attempt
  `1`, job `77258573169`, conclusion `failure`
- Latest rerun result for the same current head: run `26250077038`, attempt `2`,
  job `77258696992`, conclusion `success`
- Live `gh pr checks 1028` after the rerun showed `Validate approval review and
  linked issue` and the other current-head checks passing.
- PR #1028 merged at `d42f971ad6101938a64033afce3768552977e8b2` after the live
  current-head checks passed.

## Guard rule

When an alert or relay repeats the attempt-1 failed approval/linked-issue gate
after a later rerun on the same current head has passed, classify the repeated
failure as `stale-approval-gate-failure-echo`. It is audit provenance for the
old failed attempt, not the latest current-head gate result and not a fresh
blocker by itself.

Do not skip the live merge gate. The operator still has to verify live
current-head checks and mergeability before merge:

1. Confirm the relay points to the original failed approval gate.
2. Confirm the latest approval-gate rerun is for the same current head SHA.
3. Confirm the latest rerun concluded `success` and supersedes the failed relay.
4. Confirm all live current-head checks pass.
5. Confirm mergeability is clean before merging.

## Expected read-only report shape

```json
{
  "issue": "#1029",
  "readOnly": true,
  "question": "distinguish stale approval-gate failure echo from latest current-head rerun pass for PR #1028",
  "sourcePullRequest": "#1028",
  "currentHeadSha": "55384c5c08814c182677f6ef981b05233a535b24",
  "relay": {
    "workflow": "Merge Gate",
    "name": "Validate approval review and linked issue",
    "runId": "26250077038",
    "attempt": 1,
    "jobId": "77258573169",
    "headSha": "55384c5c08814c182677f6ef981b05233a535b24",
    "conclusion": "failure",
    "classification": "original-failed-approval-gate-relay"
  },
  "latest": {
    "workflow": "Merge Gate",
    "name": "Validate approval review and linked issue",
    "runId": "26250077038",
    "attempt": 2,
    "jobId": "77258696992",
    "headSha": "55384c5c08814c182677f6ef981b05233a535b24",
    "conclusion": "success",
    "classification": "latest-current-head-rerun-pass"
  },
  "operatorDecision": {
    "classification": "stale-approval-gate-failure-echo",
    "relayIsCurrentHeadBlocker": false,
    "latestResultIsAuthoritativeForCurrentHead": true,
    "eligibleToMergeRequiresLiveChecksPass": true,
    "eligibleToMergeRequiresCleanMergeability": true,
    "rule": "The attempt-1 approval-gate failure relay is stale after attempt 2 passed for the same current head. Treat the failure as audit provenance, then merge only after live current-head checks pass and mergeability is clean."
  }
}
```

## Non-goals

This guard changes only read-only dogfood operator classification docs and a test
helper. It does not change merge policy, approval requirements,
provider/runtime hooks, telemetry, billing/token proof, detector scope, product
claims, frontend behavior, CI workflow behavior, issue closure policy, or release
criteria.

## Focused verification

```sh
node --test test/stale-gate-rerun-echo.test.mjs test/merge-gate-workflow.test.mjs test/pr-merge-gate.test.mjs
```
