# Clean-slate development reminder anchor (#857)

This is a narrow read-only docs/test operator-boundary artifact for issue #857.
It anchors clean-slate post-merge fooks development reminders to concrete active
issue, branch, session, or PR evidence instead of letting clean CI or release
report echoes become the reminder itself.

## Live seed

The issue seed is a clean post-merge state:

- main head: `a5d9ba1`
- dirty paths: `0`
- open PR/issues: `0/0`
- fooks tmux/proc sessions: `0/0`
- legacy local worktree residue exists, but no live session/proc owns it

Those facts are verification and inventory receipts only. They are not active
fooks development evidence, and they do not replace a concrete next action.

## Reminder rule

A clean-slate development reminder must choose exactly one of these outcomes:

1. **Blocker report:** name the blocker that prevents bounded development from
   starting, then state the concrete next action required to unblock or create an
   active issue, branch, session, or PR anchor.
2. **No-blocker report:** create or adopt one concrete active issue, branch,
   session, or PR anchor, then state the next development action against that
   anchor.

If neither outcome is available, the reminder must stop at the clean-slate
boundary: it can preserve the clean CI/release-report echo as verification
evidence, but it must say that no active issue/branch/session/PR is currently
attached and that one must be created or linked before reporting active fooks
development.

Issue #857 and branch `er/clean-slate-reminder-857` are the active artifacts for
this docs/test pass only. This artifact is not cleanup authority, does not reopen
merged work, and does not authorize fetching, deleting, pushing unrelated
branches, or changing runtime/provider behavior.

## Focused verification

Use this artifact with `docs/post-merge-main-ci-echo-boundary.md` and the
operator reminder tests only. Focused verification for this boundary is:

```sh
npm run build
node --test test/operator-activity.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```

The verification proves the docs/test reminder boundary mentions issue #857, the
branch/session/PR/issue anchor requirement, the blocker/no-blocker next-action
requirement, and the clean CI echo non-authority. It does not change provider
behavior, merge gates, detector scope, frontend behavior, cleanup policy,
performance claims, or product claims.
