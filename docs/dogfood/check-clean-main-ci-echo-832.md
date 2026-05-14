# Check clean main CI echo artifact handoff (#832)

This is a narrow docs/test operator-boundary artifact for issue #832. It keeps
`fooks check` from treating a clean post-merge `main` CI/React echo as the final
answer when no active dogfood artifact exists.

## Rule

After clean `main` CI or React Web release-report echoes, `fooks check` must not
end as a status recap. If the run has no active issue, branch, session, or PR to
report, the operator handoff must create or adopt exactly one bounded active
artifact first, then report only that artifact as the next development anchor.

Clean CI, clean React echoes, zero open issue/PR counts, zero mapped fooks
sessions, and legacy local worktree inventory remain verification or inventory
receipts only. They are not the artifact that satisfies the handoff.

## Current adoption

Issue #832 and this non-`main` branch are the active artifacts for this pass. This
artifact is read-only evidence; it does not change runtime/provider behavior,
merge-gate policy, detector scope, cleanup authority, React Web, React Native,
TUI, WebView behavior, performance claims, or product claims.
