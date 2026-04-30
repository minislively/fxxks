# Remote branch backlog triage — 2026-04-30

Issue: #295

## Bounded scan

- Command: `git fetch --prune origin && node scripts/audit-remote-branches.mjs --json --no-fetch`
- Base: `origin/main`
- Remote: `origin`
- Generated: 2026-04-30T04:01:36.964Z
- Open PR check: yes, 0 open PRs in `minislively/fooks`
- Total remote branches audited: 85
- Branches with `origin/main..origin/<branch>` commits: 65
- Fully merged branches with no branch-only commits: 20

## Classification criteria

- **Candidate for PR**: has branch-only commits with at least one unique patch (`git cherry` `+`) and no destructive current-tree deletes in the bounded diff.
- **Redundant/delete-candidate**: has branch-only commits, but all patches are already equivalent to `origin/main` (`git cherry` has no `+` entries). Delete only after owner confirmation.
- **Conflict-heavy/archive**: has at least one unique patch, but the current diff deletes tracked paths from `origin/main` or is otherwise too stale for a direct PR. Archive or inspect manually; do not merge or delete from this artifact alone.

## Counts

| Classification | Count | Notes |
| --- | ---: | --- |
| Candidate for PR | 0 | No branch with unique patches avoided destructive current-tree deletes. |
| Redundant/delete-candidate | 55 | Branch-only commits are patch-equivalent to `origin/main`. |
| Conflict-heavy/archive | 10 | All unique-patch branches delete current tracked files and need manual handling. |
| Fully merged/no branch-only commits | 20 | Outside the branch-only backlog, but safe to include in owner-confirmed cleanup queues. |

## Conflict-heavy/archive branches with unique patches

| Branch | Unique patches | Behind base | Current-tree deletes | Last commit | Subject |
| --- | ---: | ---: | ---: | --- | --- |
| `claim-boundary-usage-billing-wording` | 3 | 83 | 34 | 2026-04-26 | Keep claim boundaries intact after main merge |
| `frontend-domain-contract-before-extractor-promotion` | 2 | 80 | 26 | 2026-04-26 | merge: resolve conflict with main (PR #199 changes) |
| `codex/applied-code-evidence-closeout-20260425` | 2 | 90 | 39 | 2026-04-25 | Record bounded R4 applied diagnostic without claim upgrade |
| `fooks-dogfood-zombie-cleanup` | 1 | 96 | 41 | 2026-04-24 | feat(doctor): add worktree and tmux session health checks |
| `chore/v0.1.0-public-readme-polish` | 2 | 138 | 60 | 2026-04-23 | test: update README subtitle regex to match polished wording |
| `codex/ts-js-same-file-beta` | 3 | 136 | 54 | 2026-04-23 | test: update README subtitle regex for TS/JS beta wording |
| `codex/worktree-status-parser` | 1 | 142 | 65 | 2026-04-23 | Separate dirty-worktree evidence before workflow wiring |
| `fix-pr114` | 9 | 188 | 115 | 2026-04-22 | feat: add line metadata to hooks, effects, and eventHandlers |
| `ralph/benchmark-context-policy` | 1 | 271 | 159 | 2026-04-17 | Measure ambiguous Formbricks claims under quality gates |
| `benchmark/formbricks-n3-quality` | 4 | 285 | 172 | 2026-04-16 | Preserve the Caps Lock follow-up benchmark evidence |

## Recommended next concrete branch

Inspect `frontend-domain-contract-before-extractor-promotion` next: it is the newest conflict-heavy/archive branch tied for the latest commit date and has the smallest current-tree delete footprint among the unique-patch branches. Use `git diff --stat origin/main...origin/frontend-domain-contract-before-extractor-promotion`, then decide whether to archive it or open a fresh, minimal PR that preserves only still-relevant contract changes.
