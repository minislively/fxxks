# Clean-merge reminder action boundary (#803)

This is a narrow read-only dogfood artifact for issue #803. It records the
operator reminder rule for clean post-merge CI/React echoes without changing
runtime/provider behavior, merge-gate policy, detector scope, React Web,
React Native, TUI, WebView behavior, performance claims, or product claims.

## Rule

After clean `main` CI or React Web release-report echoes, a development reminder
must not repeat clean status as the next development action. The reminder must
either:

1. report a real blocker that prevents bounded development from starting; or
2. create or adopt one active issue, branch, session, or PR evidence artifact
   that can anchor the next action.

If neither condition is true, the reminder must say that the checkout cannot be
treated as active development until an active issue, branch, session, or PR is
created or linked. Clean CI, clean React Web release-report echoes, and stale
local worktree inventory are verification or review receipts only.

## Current dogfood adoption

Issue #803 itself is the active issue artifact for this narrow reminder pass.
The branch `dogfood/issue-803-clean-merge-reminder-action` is the active branch
artifact for the docs/test follow-through. This artifact is read-only evidence;
it does not authorize cleanup, fetching, deleting, pushing unrelated branches,
reopening merged work, or changing operator runtime behavior.

## Verification boundary

Use this artifact with `docs/post-merge-main-ci-echo-boundary.md` and the
operator reminder tests only. Passing CI/React echoes prove the merge result;
they do not prove that future development work exists. Future reminder wording
should stop at a concrete blocker or an adopted issue/branch/session/PR anchor,
not at another clean-status summary.
