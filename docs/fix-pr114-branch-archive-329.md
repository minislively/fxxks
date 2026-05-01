# Issue #329 fix-pr114 stale-branch archive rationale

Date: 2026-05-01

Branch inspected: `origin/fix-pr114`
Base inspected: `origin/main`

## Bounded evidence

Fetched refs before inspection:

- `git fetch origin main fix-pr114 --prune`

`git log --oneline origin/main..origin/fix-pr114` reports 14 branch-only commits:

- `0decccb` `feat: add line metadata to hooks, effects, and eventHandlers`
- `c10d3b` `feat: extraction enrichment + shared freshness + debug parity`
- `b678e15` `Add fooks doctor command and include Stop in Claude hooks preset`
- `91ad47c` `Add freshness check and Stop hook to Claude runtime`
- `1d9df72` `Prevent Codex hook crashes during payload fallback`
- `8b189ba` `Compress Claude hook disclaimer and add escape hatch parity`
- `8d9d264` `Clarify Claude live smoke runtime context`
- `598117b` `Separate Claude provider health from hook proof (#103)`
- `6d9a737` `Make live provider smoke tolerate real CLI boundaries (#102)`
- `c2f3c87` `Make live provider hook risk explicitly verifiable (#100)`
- `6708af0` `Prove hook-smoke evidence before broader claims (#98)`
- `0894484` `Ground token evidence in source-qualified local estimates`
- `153ac22` `Keep fooks runtime state product-owned`
- `d74040b` `Enable Claude project-local context hooks`

`git diff --stat origin/main...origin/fix-pr114` reports 31 files changed with 3,075 insertions and 238 deletions. The changed files include hook/runtime files, extraction/schema/model-facing payload files, docs, scripts, and tests.

The merge-base diff has no file deletes:

- `git diff --name-only --diff-filter=D origin/main...origin/fix-pr114 | wc -l` -> `0`

Directly replaying the stale branch tree onto current main would be destructive:

- `git diff --name-only origin/main..origin/fix-pr114 | wc -l` -> `201` current-tree files changed
- `git diff --name-only --diff-filter=D origin/main..origin/fix-pr114 | wc -l` -> `126` current-tree deletes
- `git diff --shortstat origin/main..origin/fix-pr114` -> `201 files changed, 3067 insertions(+), 26684 deletions(-)`

## Relevant evidence preserved from the stale branch

The only still-relevant tip evidence is the line-metadata intent in `0decccb`, which adds AST-derived line ranges for hooks, effects, event handlers, and snippets in:

- `src/core/extract.ts`
- `src/core/schema.ts`
- `src/core/payload/model-facing.ts`

Current `origin/main` already supersedes that narrower shape with richer, differently named metadata:

- `src/core/schema.ts` defines `SourceRange`, `EffectSignal`, `CallbackSignal`, `EventHandlerSignal`, `PatchTarget`, and `EditGuidance`.
- `src/core/extract.ts` emits `loc` ranges via `sourceRangeOf(...)` for effect signals, callback signals, event handler signals, snippets, form controls, submit handlers, validation anchors, props, components, and module declarations.
- `src/core/payload/model-facing.ts` turns those `loc` ranges into bounded `editGuidance.patchTargets` and includes the instruction to treat ranges as AST-derived line edit aids, not LSP-backed semantic locations.

## Decision

Archive `origin/fix-pr114` instead of transplanting code. Its branch tip confirms useful line metadata and hook evidence, but current main already contains a broader implementation and the direct branch tree would delete 126 current files. No stale branch code, tests, docs, or deletes were replayed for issue #329.

## Verification

Run before commit:

- `git diff --check`
- `git diff --name-only origin/main..HEAD`
- `git diff --stat origin/main..HEAD`
