# Issue #1033 epic-only open issue idle guard

This is a narrow read-only dogfood docs/test/helper guard for issue #1033 under
Epic #960 operations reliability. It documents the operator/check and handoff
boundary for the case where opt-in remote counts report `open_issue=1` but the
only open issue is the planning epic `#960`.

## Pain captured

After a concrete child closes, the repository can return to a state where the
only open issue is Epic `#960`. A duplicate/idle check that sees only the
aggregate count `open_issue=1` can mistake the epic itself for active
implementation work. That hides the difference between "#960 is the planning
container" and "a concrete child issue, branch, session, PR, worktree, or
process exists for current development."

## Guard rule

An `open_issue=1` snapshot that contains only epic `#960` is
`epic-only-open-issue-advisory`: idle/advisory for active-development purposes.
It does not satisfy duplicate-session or current-work authority by itself.

The state becomes `concrete-active-artifact-present` only when at least one
current artifact backs the work:

1. an open child issue distinct from `#960`;
2. an active branch;
3. an active worktree;
4. a live mapped session;
5. an open pull request; or
6. a mapped running process.

This guard is intentionally read-only. It distinguishes #960-only open issue
inventory from active development evidence; it does not mutate GitHub issues,
change merge policy, provider/runtime hooks, telemetry, billing/token proof,
detector scope, product claims, or PR/issue closure policy.

## Expected read-only report shape

```json
{
  "issue": "#1033",
  "readOnly": true,
  "sourceEpic": "#960",
  "openIssueInventory": ["#960"],
  "operatorDecision": {
    "openIssueCount": 1,
    "classification": "epic-only-open-issue-advisory",
    "epicOnlyOpenIssueState": true,
    "activeDevelopmentAllowed": false,
    "activeDevelopmentRequiresOneOf": [
      "open-child-issue",
      "active-branch",
      "active-worktree",
      "active-session",
      "open-pull-request",
      "active-process"
    ],
    "rule": "An open_issue=1 snapshot that contains only epic #960 is advisory/idle until backed by a concrete child issue, branch, worktree, session, pull request, or process."
  }
}
```

## Focused verification

```sh
node --test test/epic-only-open-issue-idle-guard.test.mjs
```
