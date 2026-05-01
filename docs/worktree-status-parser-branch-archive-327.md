# Issue #327: codex/worktree-status-parser branch archive

Date: 2026-05-01

## Bounded branch evidence

- Remote branch inspected: `origin/codex/worktree-status-parser`
- Fresh baseline fetched: `origin/main`
- Unique branch commit: `e48fb51 Separate dirty-worktree evidence before workflow wiring`
- Three-dot stat against `origin/main`:
  - `src/core/worktree-status.ts`: 165 insertions
  - `src/index.ts`: 8 insertions
  - `test/worktree-status.test.mjs`: 73 insertions
- Three-dot files changed:
  - `A src/core/worktree-status.ts`
  - `M src/index.ts`
  - `A test/worktree-status.test.mjs`
- Three-dot delete count: 0

## Disposition

Archive, do not transplant the stale branch wholesale.

The still-relevant worktree status parser artifact is already present on `origin/main` as of `35e6fdd`:

- `src/core/worktree-status.ts` matches `origin/codex/worktree-status-parser:src/core/worktree-status.ts`.
- `test/worktree-status.test.mjs` matches `origin/codex/worktree-status-parser:test/worktree-status.test.mjs`.
- `src/index.ts` on `origin/main` already exports the parser and also contains newer unrelated exports, so replacing it with the stale branch version would delete current mainline API surface.

A two-dot comparison from current `origin/main` back to the stale branch shows broad destructive drift across unrelated docs, scripts, fixtures, source, and tests. That drift is outside the worktree status parser scope and was not transplanted.

## Verification

- `git diff --exit-code origin/codex/worktree-status-parser:src/core/worktree-status.ts HEAD:src/core/worktree-status.ts`
- `git diff --exit-code origin/codex/worktree-status-parser:test/worktree-status.test.mjs HEAD:test/worktree-status.test.mjs`
- `npm run build && node --test test/worktree-status.test.mjs`
- `git diff --check`
