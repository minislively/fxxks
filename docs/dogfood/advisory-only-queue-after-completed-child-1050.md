# Advisory-only queue after completed child work (#1050)

This is a narrow read-only dogfood docs/test/operator-check/session-whip guard
for issue #1050. It covers the state after PR #1049 closes the clean
advisory-inventory child work: the only open issue can again be Epic `#960`,
with no branch, session, open PR, active worktree, or process.

## Guard rule

A clean post-child-completion `session-whip` or `fooks check` snapshot with:

- completed child evidence from PR `#1049` / issue `#1046` as receipt-only
  history;
- only Epic `#960` in the open issue inventory;
- `open_pr=0`;
- no non-main branch;
- no mapped tmux/OMX session;
- no active worktree or mapped process; and
- a clean root worktree on `main` with zero divergence

is `advisory-only-queue-after-completed-child-action-required`. It is not a
terminal idle answer. The operator path must create or adopt a concrete child
issue/session/branch/PR/worktree/process before claiming current active
development or ending a dogfood nudge.

Existing active artifact cases still count normally: an open child issue, active
branch, mapped live session, open PR, active worktree, or active process makes
the snapshot `concrete-child-session-present` and should be adopted rather than
ignored.

This guard is intentionally read-only. It does not mutate GitHub issues
automatically beyond this branch/PR, reopen closed PRs or issues, change merge
policy, runtime hooks, telemetry, billing/token proof, detector scope, product
claims, or merge anything.

## Expected read-only report shape

```json
{
  "issue": "#1050",
  "readOnly": true,
  "sourceEpic": "#960",
  "completedChildReceipt": {
    "issue": "#1046",
    "pullRequest": "#1049",
    "activeWorkEvidence": false
  },
  "openIssueInventory": ["#960"],
  "operatorDecision": {
    "classification": "advisory-only-queue-after-completed-child-action-required",
    "terminalIdleAllowed": false,
    "activeDevelopmentAllowed": false,
    "actionRequiredForConcreteChildOrSession": true,
    "activeDevelopmentRequiresOneOf": [
      "open-child-issue",
      "active-session",
      "active-branch",
      "open-pull-request",
      "active-worktree",
      "active-process"
    ],
    "rule": "After completed child work closes and only planning epic #960 remains open, the advisory-only queue is action-required for a concrete child/session; it is not a terminal idle dogfood answer."
  }
}
```

## Focused verification

```sh
node --test test/epic-only-open-issue-idle-guard.test.mjs test/operator-activity.test.mjs
```
