# Post-receipt nudge anchor boundary (#867)

This is a narrow read-only docs/test/operator-boundary artifact for issue #867.
It covers the dogfood state after PR #866 closes the legacy worktree bucket: the
main CI/release success is a receipt, not a current development anchor.

## Receipt-only condition

After the PR #866 closeout, a clean `main` checkout may still have exact-head
`main` CI and React Web release-report success evidence. That evidence confirms
the already-merged state only:

- `main` CI success is a verification receipt.
- React Web release-report success is a release receipt.
- The closed legacy worktree bucket is a cleanup/closeout receipt.
- None of those receipts is active development evidence by itself.

## Fresh post-receipt nudge rule

A fresh post-receipt nudge must name one current anchor before describing next
work: a new issue, branch, session, PR anchor, or concrete blocker. If no anchor
or blocker exists, the nudge must say that no current development anchor is
attached after the #866 receipt and must not reuse the green `main` receipt as
the answer.

The acceptable outcomes are intentionally small:

1. name a new issue and attach the next action to it;
2. name a non-`main` branch and attach the next action to it;
3. name a mapped fooks session and attach the next action to it;
4. name an open PR and attach the next action to it;
5. name the concrete blocker that prevents creating or adopting one of those
   anchors.

## Operator/check surface

`fooks check --json` exposes this under
`activeWorkReceipts.postReceiptNudgeAnchorBoundary` with issue `#867`.
The idle post-receipt shape keeps `requiresFreshPostReceiptNudgeAnchor: true`,
`mainCiReleaseSuccessReceipt.activeDevelopmentEvidence: false`, and
`closedLegacyWorktreeBucketReceipt.activeDevelopmentEvidence: false`.

The boundary may preserve #866 CI/release success as receipt evidence, but it
must keep that receipt separate from the next issue/branch/session/PR anchor or
concrete blocker.

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, performance claims, product claims, cleanup authority, or release criteria.

## Focused verification

```sh
npm run build
node --test test/operator-activity.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```
