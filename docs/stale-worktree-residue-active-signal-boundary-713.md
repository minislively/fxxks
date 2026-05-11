# Issue #713 stale worktree residue active-signal boundary

This is a narrow operator-facing artifact for stale local `fooks.omx-worktrees`
entries that survive issue, PR, or session cleanup. It records the ambiguity and
keeps those entries separate from active issue, branch, session, or PR evidence.

## Observed local worktree residue

`git worktree list --porcelain` on 2026-05-11 showed the current worktree plus
these non-current `fooks.omx-worktrees` entries:

- `fooks-issue-631-rn-compare-inspect-visibility`
- `fooks-issue-714-active-work-receipt`
- `fooks-pr-505-current-head-review`
- `fooks-pr-562-fix-changes-requested`
- `fooks-pr-562-review-ready-note`
- `pr-573-profile-runner-refresh`

The active worktree for this artifact is
`stale-worktree-residue-active-signal-boundary-20260511040108` on branch
`dogfood/stale-worktree-residue-active-signal-boundary-20260511040108`.

## Narrow ambiguity

A stale worktree path can look like active work because its directory or branch
name contains `issue`, `pr`, or an old task slug. `git worktree list` alone only
proves that a local checkout entry exists. It does not prove that the referenced
issue is open, that a PR is open, that a mapped tmux/OMX/Codex session is still
running there, or that the branch is the operator's current active branch.

## Operator boundary

Treat non-current `fooks.omx-worktrees` entries as residue until another active
signal is present. Active signals are limited to the current operator worktree,
a mapped live fooks tmux/OMX/Codex session, an explicitly open issue, or an
explicitly open PR. A stale worktree entry without one of those signals may be
cleanup evidence, but it must not be used as active branch, issue, session, or PR
evidence.

This artifact does not authorize deleting worktrees or branches. Use the
read-only status surfaces first, and keep cleanup as a separate manual decision:

```sh
git worktree list --porcelain
fooks status artifacts --json
fooks status activity --json
```

## Non-goals

This artifact does not change runtime/provider behavior, merge policy, detector
scope, React Web behavior, React Native behavior, TUI behavior, WebView behavior,
performance claims, product claims, or cleanup authority. It is only an
operator-facing boundary for interpreting stale local worktree residue.
