# Issue #1046 clean epic/advisory inventory spawn-child guard

This is a narrow read-only dogfood docs/test/operator-check/session-whip guard
for issue #1046. It covers the post-merge state after PR #1048 where fooks can
be clean with only Epic `#960` plus one concrete but idle child issue in the
open issue inventory.

## Guard rule

A clean post-merge `session-whip` or `fooks check` snapshot with:

- `open_pr=0`;
- no active branch;
- no mapped tmux session;
- no open PR;
- no active worktree or mapped process;
- a clean root worktree on `main` with zero divergence; and
- open issue inventory containing Epic `#960` plus one concrete but idle child
  issue

is `clean-epic-plus-idle-child-session-whip-idle`. A status-only check/whip
receipt must not end on the clean main/CI/dirty/open_pr=0 summary alone and
must not treat the idle issue inventory as active work by itself.

Before claiming active development, the operator path must spawn or adopt
concrete child work: active session, active branch, open PR, active worktree, or
active process. Existing active artifact cases stay active; this guard only
covers clean main plus advisory/idle inventory with no branch-session-PR work.

This guard is intentionally read-only. It does not mutate GitHub issues
automatically, change merge policy, provider/runtime hooks, telemetry,
billing/token proof, detector scope, product claims, or reopen closed PRs or
issues.

## Expected read-only report shape

```json
{
  "issue": "#1046",
  "readOnly": true,
  "sourceEpic": "#960",
  "postMergeReceipt": "PR #1048",
  "operatorDecision": {
    "classification": "clean-epic-plus-idle-child-session-whip-idle",
    "statusOnlyCheckMayEndOnCleanEcho": false,
    "activeDevelopmentAllowed": false,
    "activeDevelopmentRequiresOneOf": [
      "active-session",
      "active-branch",
      "open-pull-request",
      "active-worktree",
      "active-process"
    ],
    "rule": "A clean post-merge session-whip/operator-check snapshot with only planning epic #960 plus one idle child issue and no active branch, session, PR, worktree, or process is status-only and must spawn or adopt concrete child work before claiming active development."
  }
}
```

## Focused verification

```sh
node --test test/epic-only-open-issue-idle-guard.test.mjs test/operator-activity.test.mjs
```
