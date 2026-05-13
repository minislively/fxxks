# Issue #788 stale local worktree residue audit

This is a bounded dogfood artifact for the local residue observed from
`/home/bellman/Workspace/fooks.omx-worktrees/stale-local-worktree-residue-20260513040112`.
It reduces future operator re-check cost by recording the read-only
classification from `git -C /home/bellman/Workspace/fooks worktree list --porcelain`.

## Scope and non-authority

- Linked issue: #788
- Audit date: 2026-05-13 UTC
- Read-only sources: local `git worktree list --porcelain`, local branch/remotes,
  local `git status`, local `git rev-list origin/main...HEAD`, local `git diff --shortstat`,
  `gh pr list`, and `tmux list-panes`.
- This artifact does not delete worktrees, delete branches, fetch remotes, open or
  close issues/PRs, or touch `/home/bellman/Workspace/fooks` beyond read-only git
  inspection.

## Classification summary

`git worktree list --porcelain` showed the main checkout plus 10
`fooks.omx-worktrees` entries. Excluding the current issue #788 worktree, there
were 9 sibling local worktrees to classify.

| Bucket | Count | Entries | Operator implication |
| --- | ---: | --- | --- |
| Current issue #788 worktree | 1 | `stale-local-worktree-residue-20260513040112` | Keep while this audit/PR is active. |
| Active local session signal | 1 | `fooks-active-react-web-followup-20260513` | Keep; it has live tmux panes and is not stale residue for this audit. |
| Non-active residue needing manual review | 8 | `fooks-issue-631-rn-compare-inspect-visibility`, `fooks-pr-505-current-head-review`, `fooks-pr-562-fix-changes-requested`, `fooks-pr-562-review-ready-note`, `fooks-pr-727-review`, `fooks-pr-728-review`, `fooks-pr-767-decision-layer-review`, `pr-573-profile-runner-refresh` | Do not count as active work without a fresh active signal; do not auto-delete because each still has commits/diff versus `origin/main`. |

## Per-worktree evidence

| Worktree | Branch state | Active signal | PR/remotes evidence | `origin/main...HEAD` | Working tree | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| `fooks-active-react-web-followup-20260513` | branch `fooks-active-react-web-followup-20260513` | live tmux panes observed | no matching open PR in the 200 most recent open PRs; no matching remote branch observed | behind 0 / ahead 0; no diff | clean | active local session signal; keep |
| `fooks-issue-631-rn-compare-inspect-visibility` | branch `fooks-issue-631-rn-compare-inspect-visibility` | none observed | matching remote branch `origin/fooks-issue-631-rn-compare-inspect-visibility`; closed PR #634; no matching open PR | behind 76 / ahead 1; 7 files changed | clean | non-active closed-PR remote residue; manual review only |
| `fooks-pr-505-current-head-review` | branch `fooks-pr-505-current-head-review` | none observed | no matching open PR or remote branch observed | behind 159 / ahead 8; 10 files changed | clean | stale local branch residue with local-only commits; salvage review before any cleanup |
| `fooks-pr-562-fix-changes-requested` | branch `fooks-pr-562-fix-changes-requested` | none observed | no matching open PR or remote branch observed | behind 113 / ahead 1; 9 files changed | clean | stale local branch residue with local-only commits; salvage review before any cleanup |
| `fooks-pr-562-review-ready-note` | branch `fooks-pr-562-review-ready-note` | none observed | no matching open PR or remote branch observed | behind 113 / ahead 1; 9 files changed | clean | stale local branch residue with local-only commits; salvage review before any cleanup |
| `fooks-pr-727-review` | detached HEAD | none observed | detached PR-review worktree path; no branch to match against open PRs | behind 30 / ahead 1; 5 files changed | clean | detached review residue; manual review only |
| `fooks-pr-728-review` | detached HEAD | none observed | detached PR-review worktree path; no branch to match against open PRs | behind 29 / ahead 1; 2 files changed | clean | detached review residue; manual review only |
| `fooks-pr-767-decision-layer-review` | branch `fooks-pr-767-decision-layer-review` | none observed | no matching open PR or remote branch observed | behind 9 / ahead 1; 8 files changed | clean | stale local branch residue with local-only commits; salvage review before any cleanup |
| `pr-573-profile-runner-refresh` | branch `pr-573-profile-runner-refresh` | none observed | no matching open PR or remote branch observed | behind 104 / ahead 2; 4 files changed | clean | stale local branch residue with local-only commits; salvage review before any cleanup |

## Re-check commands

Use these read-only commands before any future cleanup decision:

```sh
git -C /home/bellman/Workspace/fooks worktree list --porcelain
git branch -r --format='%(refname:short)'
gh pr list --state open --json number,headRefName,url --limit 200
gh pr list --state closed --json number,headRefName,state,closedAt,url --limit 200
tmux list-panes -a -F '#{session_name}\t#{pane_current_path}'
```

For any candidate that still appears stale, inspect its local-only work before
cleanup is considered:

```sh
git -C <worktree-path> status --porcelain=v1
git -C <worktree-path> rev-list --left-right --count origin/main...HEAD
git -C <worktree-path> diff --shortstat origin/main...HEAD
git -C <worktree-path> log --oneline origin/main..HEAD
```

## Stop condition

This artifact only records the 2026-05-13 read-only classification. It is not a
cleanup approval. A future operator can stop re-checking after confirming whether
a candidate has a current live session, open PR, or remote branch signal and
whether its local-only commits have been salvaged or intentionally discarded by a
separate explicit cleanup decision.
