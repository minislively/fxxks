# Issue #340 frontend domain fixture expectation lock branch archive rationale

Date: 2026-05-02

Branch inspected: `origin/docs/frontend-domain-fixture-expectation-lock`
Base inspected: `origin/main`

## Decision

Archive the stale `origin/docs/frontend-domain-fixture-expectation-lock` branch as covered by current `main`. Do not replay the branch tree or any deletes from that tree.

## Bounded inspection

The branch was inspected from current `origin/main` without checking out or applying its tree.

Branch-only commits from `git log --oneline --reverse origin/main..origin/docs/frontend-domain-fixture-expectation-lock`:

```text
525aa0e Keep fixture expectation docs aligned with the manifest
```

The merge base is `ab8e3053764f090d0c9bb3c60f39022a78d07974`.

The useful merge-base patch is narrow fixture expectation coverage only:

- `git diff --shortstat origin/main...origin/docs/frontend-domain-fixture-expectation-lock` reports 2 files changed, 73 insertions, and 13 deletions.
- `git diff --name-status origin/main...origin/docs/frontend-domain-fixture-expectation-lock` reports two modified files:
  - `docs/frontend-domain-fixture-expectations.md`
  - `test/fooks.test.mjs`

Direct stale-tree replay is destructive and was not used:

- `git diff --shortstat origin/main..origin/docs/frontend-domain-fixture-expectation-lock` reports 67 files changed, 154 insertions, and 6,664 deletions.
- `git diff --diff-filter=D --name-only origin/main..origin/docs/frontend-domain-fixture-expectation-lock` reports 37 current-main deletes, including `docs/remote-branch-audit.md`, `scripts/audit-remote-branches.mjs`, multiple branch archive rationale docs, and current frontend-domain expectation tests/fixtures.
- `docs/remote-branch-audit.md` already classifies this branch as `destructive-stale-tree`.

## Patch-equivalence evidence

The branch commit patch is present on current `main` through PR #209:

```text
branch patch-id: 327910181c0e279ffb6ce2e7baadd2ab8b7e8494 525aa0e1bb65
main patch-id:   327910181c0e279ffb6ce2e7baadd2ab8b7e8494 56f7265
```

Both commits are titled `Keep fixture expectation docs aligned with the manifest`. The matching stable patch-id means the stale branch's useful patch was applied to current `main`; later mainline changes have since expanded the same fixture expectation surfaces.

## Current-main fixture expectation coverage

Current `origin/main` supersedes the stale branch baseline instead of merely matching its older tree:

- `docs/frontend-domain-fixture-expectations.md` declares `test/fixtures/frontend-domain-expectations/manifest.json` as the source of truth for selected and deferred slots.
- The current manifest has 11 selected slots: `F0`, `F1`, `F2`, `F3`, `F4`, `F5`, `F6`, `F9`, `F10`, `F11`, and `F12`, plus deferred `F7`.
- Current `test/fooks.test.mjs` keeps the table/manifest mirror guard via `parseMarkdownTableRows` and `stripMarkdownCode` and checks selected/deferred rows against the manifest.
- Current targeted coverage also protects later expansions absent from the stale branch, including WebView bridge `F4`, React Web wrapper slots `F11`/`F12`, RN readiness slots `F9`/`F10`, deferred-only field guards, and pre-read fallback/payload boundaries.

This keeps the fixture expectation lock on current `main` without old-tree churn.

## Rejected alternatives

- Full stale-branch replay: rejected because the double-dot tree comparison would delete 37 current-main paths and churn unrelated docs, scripts, tests, and fixtures.
- Cherry-picking `525aa0e`: rejected because its stable patch-id already exists on `main` as `56f7265` / PR #209.
- Manually copying branch versions of the two changed files: rejected because current `main` has newer, broader fixture expectation coverage than the stale branch.
- No archive note: rejected because Issue #340 needs auditable evidence distinguishing patch-equivalence from destructive stale-tree replay.

No stale branch code, tests, generated artifacts, raw patch artifacts, or deletes were replayed for Issue #340.

## Verification

Run before commit:

- `git diff --check`
- `git diff --name-status origin/main...HEAD`
- `git diff --diff-filter=D --name-only origin/main...HEAD`
- Patch-id comparison for `525aa0e1bb65` and current-main `56f7265`.
- `grep -RIn 'frontend-domain-fixture-expectation-lock\|Issue #340\|525aa0e\|56f7265\|327910181c0e279ffb6ce2e7baadd2ab8b7e8494\|parseMarkdownTableRows\|frontend domain fixture expectations keep exact local outcomes' docs test/fooks.test.mjs`
- Targeted fixture expectation test: `npm run build && node --test --test-name-pattern 'frontend domain fixture|custom-wrapper-dom-signal-gap|React Web runtime evidence audit' test/fooks.test.mjs`
