# Issue #1027 interrupted local verification inconclusive guard

This is a read-only dogfood guard for the #960 reliability/session-handoff lane.
It documents one operator failure mode only: a local worktree verification command
that exits `130` because it was interrupted is inconclusive evidence by itself.

## Guarded failure mode

Do not report an interrupted local verifier as a branch blocker when current-head
CI is passing and no current focused command failure backs the interruption. Exit
`130` means the verifier was stopped before it produced a pass/fail result; it is
not the same evidence shape as a focused test, typecheck, or build failure that
ran to completion.

When an interrupted local verifier is followed by a bounded rerun that passes,
keep the stale interrupted receipt in the handoff as inconclusive local evidence,
not as a blocker. Operators should continue to cite the current successful rerun
and current-head CI state as the branch-health evidence.

## Required operator shape

Classify local verification evidence in this order:

1. Current focused command failure: blocker.
2. Current-head CI failure: blocker.
3. Interrupted local command with exit `130`: inconclusive unless item 1 or 2 is
   also present.
4. Interrupted exit `130` plus a bounded rerun that passes: inconclusive stale
   local verifier receipt; cite the rerun as the current local result.

Use the same reliability/session-handoff vocabulary in operator notes: blocked
requires current focused failure or current-head CI failure; interrupted local
verification is inconclusive; bounded rerun pass is current local verification
evidence.

## Boundary

This changes only local operator verification classification guidance and test
helpers. It does not change merge policy, provider/runtime hooks, telemetry,
billing/token proof, detector scope, product claims, or frontend behavior.
