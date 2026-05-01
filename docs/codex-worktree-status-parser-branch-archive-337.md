# Archive: codex/worktree-status-parser stale branch (#337)

## Decision
Archive the stale `origin/codex/worktree-status-parser` branch as evidence only. Do not replay the branch tree onto current `main`.

## Why this is being archived
The branch is a valid stale-backlog candidate for the fooks dogfood loop, but applying the branch tree directly would mix old generated/worktree-state changes with current repository state. The useful artifact is the operational lesson: worktree-status parsing needs bounded evidence and explicit stale-branch triage, not blind stale-tree replay.

## Bounded evidence
- Issue: #337
- Remote branch: `origin/codex/worktree-status-parser`
- Branch-only commits vs current `origin/main`: 1
- Merge-base diff shortstat: 3 files changed, 246 insertions(+)
- Merge-base name-status counts: A 2, M 1
- Merge-base deletes: 0

### Branch-only commit log
```text
e48fb51 Separate dirty-worktree evidence before workflow wiring
```

### Changed paths sampled
```text
src/core/worktree-status.ts
src/index.ts
test/worktree-status.test.mjs
```

## Product/ops interpretation
- Keep: the signal that worktree/session state parsing is worth tracking as dogfood evidence.
- Cut: replaying stale branch output or old tree shape into current main.
- Follow-up: use this archive as the closure artifact for issue #337 and keep future stale-branch salvage current-main-first.

## Verification
- `git diff --check origin/main..HEAD`
- Targeted grep for branch, issue, and non-replay rationale
- Docs-only PR target: `docs/codex-worktree-status-parser-branch-archive-337.md`
