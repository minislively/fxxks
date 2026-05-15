# Receipt-only nudge loop anchor boundary (#869)

This is a narrow read-only docs/test/operator-boundary artifact for issue #869.
It covers the dogfood state after PR #868 merged and its successful `main` CI
run was already recorded as a receipt. That receipt is not an active development
anchor for the next fooks nudge.

## Loop-prevention rule

A fresh post-#868 nudge report must name both pieces of current evidence before
it describes active dogfood development:

1. newly created or adopted issue evidence; and
2. mapped OMX session evidence for the work currently being nudged.

If either piece is missing, the report must say that no active development
anchor is attached yet. It must not reuse the last merged commit, the successful
`main` CI run, or any release receipt as the next-development anchor.

## Operator/check surface

`fooks check --json` exposes this under
`activeWorkReceipts.receiptOnlyNudgeLoopBoundary` with issue `#869`.
The idle loop-prevention shape keeps
`requiresIssueAndOmxSessionEvidence: true`,
`satisfiesNudgeReportAnchorRequirement: false`, and
`repeatedReceiptOnlyReportAllowed: false` until current evidence includes both a
newly created/adopted issue and a mapped OMX session.

The boundary may preserve PR #868 merge and CI success as prior receipt evidence,
but it keeps that receipt separate from the required issue-plus-session anchor
for the next nudge report.

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, performance claims, product
claims, cleanup authority, or release criteria.

## Focused verification

```sh
npm run build
node --test test/operator-activity.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```
