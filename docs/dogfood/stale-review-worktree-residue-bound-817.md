# Issue #817 stale review worktree residue bound

This is a bounded dogfood artifact for the local residue observed from
`/home/bellman/Workspace/fooks.omx-worktrees/stale-review-worktree-residue-bound-20260514040102`.
It records how idle whip should separate stale review residue from active work
without touching the main checkout at `/home/bellman/Workspace/fooks`.

## Scope and non-authority

- Linked issue: #817
- Audit date: 2026-05-14 UTC
- Read-only sources: local `git worktree list --porcelain`, `fooks status orphan-worktrees --json`,
  `fooks status activity --json`, local `git status`, local `git rev-list origin/main...HEAD`,
  local `git diff --shortstat origin/main...HEAD`, `gh pr list`, and `tmux list-panes`.
- This artifact does not delete worktrees, delete branches, fetch remotes, push,
  open or close PRs, or mutate the main checkout.

## Idle whip rule

`git worktree list --porcelain` proves only that a checkout exists. Idle whip
must not count a non-current `.omx-worktrees` checkout as active work unless it
has at least one fresh active signal: the current operator worktree, a mapped
live tmux/OMX/Codex pane, an open PR, or an open issue/task that explicitly owns
that checkout.

Detached review paths matching `fooks-pr-<number>-review` with no mapped pane and
no open PR are non-active cleanup-review noise. They still require manual review
because detached HEADs can contain local-only commits or diffs; this artifact is
not cleanup authority.

## Current residue counts

`git worktree list --porcelain` showed 11 total worktrees:

| Bucket | Count | Paths |
| --- | ---: | --- |
| Main checkout, excluded from mutation | 1 | `/home/bellman/Workspace/fooks` |
| Current issue #817 worktree | 1 | `/home/bellman/Workspace/fooks.omx-worktrees/stale-review-worktree-residue-bound-20260514040102` |
| Non-current sibling worktrees checked by `status orphan-worktrees` | 9 | Listed below |

`fooks status orphan-worktrees --json` classified the 10 sibling entries under
`/home/bellman/Workspace/fooks.omx-worktrees` as:

| Classification | Count | Paths |
| --- | ---: | --- |
| `keep` | 1 | `stale-review-worktree-residue-bound-20260514040102` |
| `manual-review-noise` | 2 | `fooks-pr-727-review`, `fooks-pr-728-review` |
| `salvage-review` | 7 | `fooks-issue-791-main-ci-echo-bound`, `fooks-pr-505-current-head-review`, `fooks-pr-562-fix-changes-requested`, `fooks-pr-562-review-ready-note`, `fooks-pr-767-decision-layer-review`, `fooks-pr790-review-202605130600`, `pr-573-profile-runner-refresh` |
| `safe-cleanup` | 0 | none |

`fooks status activity --json` reported `legacyWorktreeEvidence.staleClosedArtifactWorktreeCount: 0` and
`currentRunEvidence.classification: activeOrUnknown` for this issue branch. That
means idle whip must use the explicit orphan-worktree review categories for this
case; the legacy closed-artifact count alone would miss the detached PR-review
residue.

## Per-worktree evidence

| Worktree | Branch state | Active signal | PR evidence | `origin/main...HEAD` | Working tree | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| `stale-review-worktree-residue-bound-20260514040102` | branch `dogfood/stale-review-worktree-residue-bound-20260514040102` | current worktree; 2 mapped tmux panes | no open PR found | behind 0 / ahead 0; no committed diff | dirty during artifact authoring | keep |
| `fooks-pr-727-review` | detached HEAD `74afe67c73a349d4024f2c43d2a9b5b8efcf8d4e` | none | no open PR; closed PR evidence found | behind 634 / ahead 593; 477 files changed | clean | detached review residue; manual review only |
| `fooks-pr-728-review` | detached HEAD `dcb590c8f272f45245aa933b411e777960b08579` | none | no open PR; closed PR evidence found | behind 634 / ahead 594; 477 files changed | clean | detached review residue; manual review only |
| `fooks-issue-791-main-ci-echo-bound` | branch `fooks-issue-791-main-ci-echo-bound` | none | no open PR found | behind 634 / ahead 624; 492 files changed | clean | salvage review before cleanup |
| `fooks-pr-505-current-head-review` | branch `fooks-pr-505-current-head-review` | none | no open PR found | behind 634 / ahead 471; 347 files changed | clean | salvage review before cleanup |
| `fooks-pr-562-fix-changes-requested` | branch `fooks-pr-562-fix-changes-requested` | none | no open PR found | behind 634 / ahead 510; 396 files changed | clean | salvage review before cleanup |
| `fooks-pr-562-review-ready-note` | branch `fooks-pr-562-review-ready-note` | none | no open PR found | behind 634 / ahead 510; 396 files changed | clean | salvage review before cleanup |
| `fooks-pr-767-decision-layer-review` | branch `fooks-pr-767-decision-layer-review` | none | no open PR found | behind 634 / ahead 614; 488 files changed | clean | salvage review before cleanup |
| `fooks-pr790-review-202605130600` | branch `fooks-pr790-review-202605130600` | none | no open PR found | behind 634 / ahead 624; 492 files changed | clean | salvage review before cleanup |
| `pr-573-profile-runner-refresh` | branch `pr-573-profile-runner-refresh` | none | no open PR found | behind 634 / ahead 520; 403 files changed | clean | salvage review before cleanup |

## Re-check commands

Use these read-only commands before any future idle-whip or cleanup decision:

```sh
git worktree list --porcelain
fooks status orphan-worktrees --json
fooks status activity --json
```

For any non-active candidate, inspect local-only evidence before any separate
manual cleanup approval:

```sh
git -C <worktree-path> status --short --branch
git -C <worktree-path> rev-list --left-right --count origin/main...HEAD
git -C <worktree-path> diff --shortstat origin/main...HEAD
git -C <worktree-path> log --oneline --decorate --max-count=20 origin/main..HEAD
```

## Stop condition

Idle whip can stop treating these paths as active artifacts after confirming that
there is no current-worktree match, no mapped live pane, and no open PR/issue
ownership. It must still leave deletion, branch pruning, salvage, or push actions
to a separate explicit cleanup decision.
