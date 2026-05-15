# Clean-slate development reminder active-evidence anchor (#857)

This is a narrow read-only dogfood operator artifact for issue #857. It records
how clean-slate development reminders should stay useful when the current
checkout is clean and remote issue/PR counts are zero, without changing
runtime/provider behavior, merge-gate policy, detector scope, React Web,
React Native, TUI, WebView behavior, performance claims, or product claims.

## Rule

A clean-slate development reminder must not end as an idle/status summary and
must not use a green CI or React Web release-report echo as the next development
anchor. After naming the clean-slate boundary, the reminder must choose exactly
one of these outcomes:

1. report a concrete blocker that prevents bounded development from starting; or
2. name one active evidence anchor: an issue, branch, session, or PR.

If no blocker and no active issue/branch/session/PR anchor exists, the reminder
must say that no active development anchor is currently attached and stop there.
It may preserve clean `main`, green CI, clean release-report, zero open issue/PR
counts, and stale local worktree inventory as verification or review receipts,
but those receipts are not the next development action.

## Current dogfood adoption

Issue #857 is the active issue artifact for this pass. The branch
`dogfood/issue-857-clean-slate-dev-reminder` is the active branch artifact, and
this worktree/session is the bounded docs/test/operator lane. Those are the only
active-evidence anchors for this artifact; the clean checkout state or CI echo is
not the anchor.

## Reminder wording boundary

Use this artifact with `docs/post-merge-main-ci-echo-boundary.md` and the
operator reminder tests only. Future reminders should be shaped as:

- clean-slate boundary: what proves the checkout is not active development;
- active anchor or blocker: the issue, branch, session, PR, or blocker that
  justifies the next action;
- verification receipts: CI/release-report/status evidence, clearly labeled as
  non-active receipts.

Do not use this artifact as cleanup authority. It does not fetch, delete, push,
prune, mutate runtime state, reopen merged work, or broaden any detector or
frontend behavior.
