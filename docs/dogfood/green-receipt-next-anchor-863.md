# Green receipt next-development anchor (#863)

This is a narrow read-only docs/test operator-boundary artifact for issue #863.
It separates the final green post-merge `main` receipts from the next fooks
development anchor so a reminder response cannot collapse into repeating the
last successful CI/release-report evidence.

## Final green receipt boundary

After a merge chain finishes with both `main` CI and the React Web release-report
green, those facts are final verification receipts only:

- the exact-head `main` CI success receipt confirms the already-merged head;
- the React Web release-report success receipt confirms the release-report
  surface for that same completed state;
- neither receipt is a concrete next-development anchor by itself.

A reminder may preserve those receipts as evidence, but it must keep them
separate from the active artifact that owns the next development action.

## Reminder response rule

A next development reminder must choose exactly one of these outcomes:

1. **Adopt/create anchor:** create or adopt one concrete issue, branch, session,
   or PR artifact, name it in the reminder response, and attach the next
   development action to that artifact.
2. **Concrete blocker:** report the concrete blocker that prevents creating or
   adopting an issue, branch, session, or PR artifact, and name the specific next
   action required to unblock the anchor.

The reminder must not repeat the final green `main` CI receipt or React Web
release-report receipt as the answer. It must not present green receipts, stale
local worktree inventory, or clean checkout status as the next development
anchor.

Issue #863 and branch `dogfood/issue-863-green-receipt-next-anchor` are the
active artifacts for this docs/test pass only. This artifact is not cleanup
authority, does not reopen merged work, and does not authorize fetching,
deleting, pushing unrelated branches, or changing runtime/provider behavior.

## Focused verification

Use this artifact with `docs/post-merge-main-ci-echo-boundary.md` and the
operator reminder tests only. Focused verification for this boundary is:

```sh
npm run build
node --test test/operator-activity.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```

The verification proves the docs/test reminder boundary mentions issue #863, the
final green `main` CI plus React Web release-report receipt split, the concrete
issue/branch/session/PR anchor requirement, the concrete blocker fallback, and
the rule that final receipts are not the next development answer. It does not
change runtime/provider behavior, merge-gate policy, detector scope, React Web
behavior, React Native behavior, TUI behavior, WebView behavior, performance
claims, or product claims.
