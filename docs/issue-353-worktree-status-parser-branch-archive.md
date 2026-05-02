# Issue #353 worktree-status parser branch archive rationale

Date: 2026-05-02

Branch inspected: `origin/codex/worktree-status-parser`

## Bounded evidence

Issue #353 re-inspected `origin/codex/worktree-status-parser` because the remote branch audit still reported it as a valid candidate without PR/archive evidence.

Required inspection commands run for this issue:

- `git log origin/main..origin/codex/worktree-status-parser`
- `git diff origin/main...origin/codex/worktree-status-parser`

The branch has one unique commit:

```text
e48fb51 Separate dirty-worktree evidence before workflow wiring
```

The merge-base patch is narrow and contains only the already-superseded worktree status parser artifacts:

```text
src/core/worktree-status.ts   | 165 insertions
test/worktree-status.test.mjs |  73 insertions
src/index.ts                  |   8 insertions
```

## Disposition

Archive as evidence only. Do not replay the stale branch tree onto current `main`, and do not delete the remote branch.

Current `main` already contains the useful worktree-status parser/test/export surface from the stale branch, plus newer current-main worktree evidence integration. A direct replay of the stale branch tree would be unsafe: the current-tree comparison reports destructive stale drift with 87 current-file deletes across unrelated docs, scripts, fixtures, source, and tests.

The safe issue #353 outcome is therefore audit suppression through exact archive evidence for this branch, not code transplant or remote-branch deletion.

## Verification

- `git diff --exit-code origin/codex/worktree-status-parser:src/core/worktree-status.ts HEAD:src/core/worktree-status.ts`
- `git diff --exit-code origin/codex/worktree-status-parser:test/worktree-status.test.mjs HEAD:test/worktree-status.test.mjs`
- `npm run --silent branch:audit -- --no-fetch --json`
- `npm run build`
- `node --test test/worktree-status.test.mjs test/worktree-evidence.test.mjs test/audit-remote-branches.test.mjs`
- `git diff --check`
