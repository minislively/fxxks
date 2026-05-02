# Issue #342 frontend domain manifest shape guard branch archive rationale

Date: 2026-05-02

Branch inspected: `origin/docs/frontend-domain-manifest-shape-guard`
Base inspected: `origin/main`

## Decision

Archive the stale `origin/docs/frontend-domain-manifest-shape-guard` branch as already covered by current `main`. Do not replay the branch tree, and do not apply any stale-tree deletes from that branch.

## Bounded inspection

The branch was inspected from current `origin/main` without checking out, merging, or applying its tree.

Branch-only commits from `git log --oneline --reverse origin/main..origin/docs/frontend-domain-manifest-shape-guard`:

```text
8143b7b Prevent selected fixture slots from carrying deferred state
```

The merge base is `56f7265dce7fb252017168e192f3a498060dbf79`.

The useful merge-base patch is narrow manifest shape guard coverage only:

- `git diff --shortstat origin/main...origin/docs/frontend-domain-manifest-shape-guard` reports 3 files changed, 28 insertions, and 2 deletions.
- `git diff --name-status origin/main...origin/docs/frontend-domain-manifest-shape-guard` reports three modified files:
  - `docs/frontend-domain-fixture-expectations.md`
  - `test/fixtures/frontend-domain-expectations/manifest.json`
  - `test/fooks.test.mjs`

Direct stale-tree replay is destructive and was not used:

- `git diff --shortstat origin/main..origin/docs/frontend-domain-manifest-shape-guard` reports 68 files changed, 152 insertions, and 6,713 deletions.
- `git diff --diff-filter=D --name-only origin/main..origin/docs/frontend-domain-manifest-shape-guard` reports current-main deletes, including `docs/remote-branch-audit.md`, `scripts/audit-remote-branches.mjs`, `test/audit-remote-branches.test.mjs`, `test/ci-alert-triage.test.mjs`, `test/fixtures/frontend-domain-expectations/react-web/custom-design-system-card.tsx`, and `test/fixtures/frontend-domain-expectations/webview/checkout-bridge-native.tsx`.
- `docs/remote-branch-audit.md` already classifies this branch as `destructive-stale-tree` and `patch-equivalent` with zero unique patches.

## Patch-equivalence evidence

The branch commit patch is present on current `main` through PR #210:

```text
branch patch-id: 2c2dfebc5544482fff91d628b00dc60dd9f1fd1e 8143b7b3b81e
main patch-id:   2c2dfebc5544482fff91d628b00dc60dd9f1fd1e c6f367a0cee
```

Both commits are titled `Prevent selected fixture slots from carrying deferred state`. `git cherry -v origin/main origin/docs/frontend-domain-manifest-shape-guard` marks `8143b7b3b81e` with `-`, confirming the branch-only patch is already equivalent to a patch in `origin/main`.

## Current-main manifest shape guard coverage

Current `origin/main` supersedes the stale branch baseline instead of merely matching its older tree:

- `docs/frontend-domain-fixture-expectations.md` has a `Manifest shape guard` section requiring selected fixtures to omit deferred-only fields such as `deferReason` and `doesNotBlockBaseline`.
- The same section requires deferred fixtures to omit selected-only executable fixture shape, including fixture paths, expected outcomes, fallback reasons, required signals, and verification instructions.
- `test/fixtures/frontend-domain-expectations/manifest.json` currently has 11 selected slots (`F0`, `F1`, `F2`, `F3`, `F4`, `F5`, `F6`, `F9`, `F10`, `F11`, and `F12`) and one deferred slot (`F7`), so the current baseline includes later WebView, RN readiness, and React Web wrapper slots absent from the stale branch.
- `test/fooks.test.mjs` enforces that selected slots do not carry deferred-only fields and deferred slots do not carry selected-only fields, while also checking fallback reason boundaries, support-claim boundaries, and that `F4` is not both selected and deferred.
- Current docs and tests retain the branch's shape guard intent while preserving newer mainline coverage.

This keeps the manifest shape guard on current `main` without old-tree churn.

## Rejected alternatives

- Full stale-branch replay: rejected because the double-dot tree comparison would delete current docs, scripts, tests, fixtures, and payload files.
- Cherry-picking `8143b7b`: rejected because its stable patch-id already exists on `main` as `c6f367a` / PR #210.
- Manually copying branch versions of the three changed files: rejected because current `main` has newer, broader manifest shape guard coverage than the stale branch.
- No archive note: rejected because Issue #342 needs auditable evidence distinguishing patch-equivalence from destructive stale-tree replay.

No stale branch code, tests, generated artifacts, raw patch artifacts, or deletes were replayed for Issue #342.

## Verification

Run before commit:

- `git diff --check`
- `git diff --name-status origin/main...HEAD`
- `git diff --diff-filter=D --name-only origin/main...HEAD`
- Patch-id comparison for `8143b7b3b81e` and current-main `c6f367a0cee`.
- `grep -RIn 'frontend-domain-manifest-shape-guard\|Issue #342\|8143b7b\|c6f367a\|2c2dfebc5544482fff91d628b00dc60dd9f1fd1e\|Manifest shape guard\|selected fixture must not carry deferred-only\|deferred fixture must not carry selected-only' docs test/fooks.test.mjs test/fixtures/frontend-domain-expectations/manifest.json`
- Targeted manifest shape guard test: `npm run build && node --test --test-name-pattern 'frontend domain fixture expectations|frontend domain fixture docs|frontend fixture boundary regression map' test/fooks.test.mjs`
