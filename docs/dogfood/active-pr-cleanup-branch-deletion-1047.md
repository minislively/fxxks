# Dogfood #1047: active PR cleanup is not branch-deletion cleanup

This is a read-only operator guard for the failure mode where dogfood cleanup
mistakes an active PR branch/worktree for stale branch-deletion residue.

## Boundary

Active PR cleanup is **not** stale branch deletion cleanup while any live PR is
open for the branch or review worktree. Branch/worktree/remote cleanup may be
considered only after one of these states is explicit and intentional:

- the PR is `MERGED`, with merge success independently verified; or
- the PR is `CLOSED` intentionally for recovery/abandonment, with that intent
  named in the operator handoff.

If the PR is still open and a required check is pending, failing, queued, or
otherwise non-terminal, cleanup output must keep the branch/worktree as active
PR evidence. It must not be collapsed into `safe-cleanup`, stale residue, or a
false idle/no-artifact state.

## Case matrix

| Case | Operator classification |
| --- | --- |
| Open PR for the branch, including pending required checks | Keep/adopt as active PR evidence; no branch/worktree/remote deletion from cleanup artifacts. |
| Current non-main branch | Active branch evidence; not idle. |
| Mapped fooks tmux/session | Active session evidence; not idle. |
| Remote branch with no open PR but closed PR evidence | Manual-review cleanup noise; not active by itself and not auto-delete authority. |
| No open issue/PR/session, clean main, zero divergence | Real idle/no-artifact state, subject to remote-count proof. |

## Operator wording

When a cleanup artifact sees an open PR, the handoff should say:

> Active PR cleanup guard: branch/worktree/remote cleanup is unsafe while this PR remains open; wait for an intentional merged/closed PR state with required checks terminal.

This guard is read-only. It does not change merge policy, required-check policy,
runtime hooks, telemetry, billing/token proof, detector scope, or product claims.
