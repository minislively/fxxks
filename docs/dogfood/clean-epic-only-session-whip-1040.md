# Issue #1040 clean epic-only session-whip child artifact guard

This is a narrow read-only dogfood docs/test/helper/operator-check-adjacent
artifact for issue #1040. It covers the post-merge state after PR #1039 where
live fooks evidence can be clean and idle while the only open GitHub issue is
planning Epic `#960`.

## Guard rule

A clean post-merge `session-whip` snapshot with:

- `open_pr=0`;
- no mapped tmux session;
- no mapped process;
- no active sibling worktree;
- a clean root worktree on `main` with zero divergence; and
- open issue inventory containing only Epic `#960`

is `clean-epic-only-session-whip-idle`. It must not end as a clean echo or treat
Epic `#960` as the child artifact for active development.

Before claiming active work, the next report must name one concrete child
artifact: an open child issue distinct from `#960`, active session, active
branch, open PR, active worktree, or active process.

This guard is intentionally read-only. It does not mutate GitHub issues
automatically, change merge policy, provider/runtime hooks, telemetry,
billing/token proof, detector scope, product claims, or PR/issue closure policy.

## Expected read-only report shape

```json
{
  "issue": "#1040",
  "readOnly": true,
  "sourceEpic": "#960",
  "postMergeReceipt": "PR #1039",
  "operatorDecision": {
    "classification": "clean-epic-only-session-whip-idle",
    "sessionWhipMayEndOnCleanEcho": false,
    "activeDevelopmentAllowed": false,
    "activeDevelopmentRequiresOneOf": [
      "open-child-issue",
      "active-session",
      "active-branch",
      "open-pull-request",
      "active-worktree",
      "active-process"
    ],
    "rule": "A clean post-merge session-whip snapshot with only planning epic #960 open is idle and must name a concrete child issue, session, branch, PR, worktree, or process before claiming active work."
  }
}
```

## Focused verification

```sh
node --test test/epic-only-open-issue-idle-guard.test.mjs test/operator-activity.test.mjs
```
