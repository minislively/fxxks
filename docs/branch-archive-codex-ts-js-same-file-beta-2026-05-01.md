# Branch archive: `codex/ts-js-same-file-beta`

Issue: #325
Date: 2026-05-01

## Bounded evidence

Commands run from a non-main worktree after `git fetch origin codex/ts-js-same-file-beta main`:

- `git log --oneline origin/main..origin/codex/ts-js-same-file-beta`
  - `a224108 test: update README subtitle regex for TS/JS beta wording`
  - `6470b48 Expand Codex repeated-file support into a guarded TS/JS beta`
  - `d82d134 Clarify PR scope before expanding public support`
- `git diff --stat origin/main...origin/codex/ts-js-same-file-beta`
  - 20 files changed
  - 326 insertions, 69 deletions
- `git diff --name-status origin/main...origin/codex/ts-js-same-file-beta`
  - Modified docs and runtime/extraction files
  - Added `fixtures/ts-js-beta/{comments-only.ts,empty.ts,module-config.js,module-utils.ts,weak-config.js}`
- Current-tree delete count from the same name-status diff: 0

## Decision

Archive the remote branch rather than transplanting its patch set.

The still-relevant TS/JS same-file beta intent is already represented on `origin/main` by newer, more complete artifacts:

- TS/JS beta setup eligibility and scanning: `src/core/setup-eligibility.ts`
- Codex TS/JS beta prompt/runtime path: `src/core/context-policy.ts`, `src/adapters/codex-runtime-hook.ts`, and `src/adapters/pre-read.ts`
- TS/JS extraction/readiness payload behavior: `src/core/extract.ts`, `src/core/payload/model-facing.ts`, and `src/core/payload/readiness.ts`
- Fixture-backed coverage: `fixtures/ts-js-beta/` and the TS/JS beta tests in `test/fooks.test.mjs`
- Public claim boundaries: `README.md`, `docs/setup.md`, `docs/roadmap.md`, and `docs/release.md`

Because the branch-only commits are older than the current mainline TS/JS beta implementation and docs, replaying them would mostly reintroduce stale wording such as setup eligibility being deferred. No unrelated deletes or stale branch-wide changes were transplanted.

## Verification

- `git diff --check`
