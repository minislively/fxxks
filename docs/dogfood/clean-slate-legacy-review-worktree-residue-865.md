# Clean-slate legacy review-worktree residue boundary (#865)

This is a narrow read-only docs/test/operator-boundary artifact for issue #865.
It prevents clean-slate fooks dogfood nudges from treating old local review
worktrees as active development after open PR/issues and live sessions are zero.

## Seed condition

The painful clean-slate state is:

- open GitHub issues: `0`
- open GitHub pull requests: `0`
- mapped fooks tmux/proc sessions: `0`
- legacy local review worktree residue: visible, including the eight-row case
- concrete blocker: absent unless the operator/check snapshot reports one

In that state, legacy review-worktree residue is stale/manual-review evidence
only. It can be listed to explain why local inventory still looks noisy, but it
must not be reported as active development and must not force manual inspection
before the nudge can name the clean-slate boundary.

## Nudge rule

A clean-slate dogfood nudge may describe actual active development only when at
least one of these anchors exists:

- active issue evidence
- active non-`main` branch evidence
- active mapped fooks session evidence
- active PR evidence
- a concrete blocker that prevents creating or adopting one of those anchors

If none exists, the nudge must classify legacy review-worktree residue as
stale/manual-review evidence and say that no active issue/branch/session/PR is
attached. It may point to the read-only manual-review residue count, but it must
not present old local review worktrees as the next development action.

## Operator/check surface

`fooks check --json` exposes this boundary under
`activeWorkReceipts.legacyReviewWorktreeResidueBoundary` with issue `#865`,
`classification: "stale-manual-review-evidence"`,
`staleManualReviewEvidenceOnly: true`, and
`satisfiesActiveDevelopmentRequirement: false`.

The older `legacyLocalResidueCleanupReview` rows remain the detailed local path
review evidence. The issue #865 boundary is the clean-slate nudge summary: it
points nudges away from old review-worktree residue and back to issue, branch,
session, PR, or concrete-blocker evidence.

## Non-goals

This artifact does not delete legacy worktrees, fetch, push, prune, remove
branches, kill sessions, change runtime/provider behavior, change merge-gate
policy, broaden detector scope, change React Web/RN/TUI/WebView behavior, make
performance claims, or make product claims.

## Focused verification

```sh
npm run build
node --test test/operator-activity.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```
