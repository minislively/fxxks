# Issue #304 claim-boundary usage/billing branch archive rationale

Date: 2026-04-30

Branch inspected: `origin/claim-boundary-usage-billing-wording`
Base inspected: `origin/main`

## Bounded evidence

`git log --oneline --decorate origin/main..origin/claim-boundary-usage-billing-wording` shows four branch-only commits:

- `75de0ac` `Keep claim boundaries intact after main merge`
- `0e862fe` `merge: resolve conflict with main (PR #193 changes)`
- `ee1e006` `Prevent local telemetry from implying billing-grade proof`
- `e7ca86a` `Document frontend domain promotion gates`

`git diff --stat origin/main...origin/claim-boundary-usage-billing-wording` reports 41 changed files with 187 insertions and 108 deletions. The only added file is `docs/frontend-domain-profiles.md`.

The current-tree delete count from `git diff --name-status origin/main...origin/claim-boundary-usage-billing-wording` is `0`.

The changed-file set is:

- `CONTRIBUTING.md`
- `README.md`
- `benchmarks/frontend-harness/v2-runner/src/dry-run.mjs`
- `benchmarks/layer2-frontend-task/PROVIDER_COST_IMPORT_RUNBOOK.md`
- `benchmarks/layer2-frontend-task/PUBLIC_REPORT_SAMPLE.md`
- `benchmarks/layer2-frontend-task/R1-R5_REAL_WORLD_TASKS.md`
- `benchmarks/layer2-frontend-task/R4-metric-schema.md`
- `benchmarks/layer2-frontend-task/R4-runner-spec.md`
- `benchmarks/layer2-frontend-task/STATUS.md`
- `benchmarks/layer2-frontend-task/TASK_INVENTORY.md`
- `benchmarks/layer2-frontend-task/billing-import-evidence.js`
- `benchmarks/layer2-frontend-task/claude-wrapper.js`
- `benchmarks/layer2-frontend-task/deterministic-outcome-scaffold.js`
- `benchmarks/layer2-frontend-task/r4-repeated-summary.js`
- `benchmarks/layer2-frontend-task/run-r4-repeated.js`
- `benchmarks/layer2-frontend-task/runtime-token-metrics.js`
- `benchmarks/layer2-frontend-task/summarize-r4-smoke.js`
- `benchmarks/layer2-frontend-task/validate-r4-applied.js`
- `docs/benchmark-evidence.md`
- `docs/deterministic-outcome-benchmark.md`
- `docs/edit-guidance-evidence.md`
- `docs/frontend-domain-profiles.md`
- `docs/output-token-shaping.md`
- `docs/provider-tokenizer-boundary.md`
- `docs/release-note-v0.1.0.md`
- `docs/release-readiness.md`
- `docs/release.md`
- `docs/roadmap.md`
- `docs/setup.md`
- `docs/usage-log-boundary.md`
- `scripts/live-provider-hook-smoke.mjs`
- `scripts/release-smoke.mjs`
- `src/cli/doctor.ts`
- `src/core/compare.ts`
- `src/core/session-metrics.ts`
- `test/deterministic-outcome-scaffold.test.mjs`
- `test/fooks.test.mjs`
- `test/frontend-v2-runner.test.mjs`
- `test/layer2-applied-validation.test.mjs`
- `test/provider-cost-evidence.test.mjs`
- `test/worktree-evidence.test.mjs`

## Decision

Archive the stale branch instead of replaying it. The relevant claim-boundary wording is already preserved on current `origin/main` as `provider usage/billing-token`, `provider usage/billing tokens`, and `invoices, dashboards, charged costs` boundaries across the README, release docs, provider-tokenizer docs, usage-log boundary, runtime strings, and claim-guard tests.

Direct replay is unnecessary and unsafe because it would re-touch 41 broad docs, benchmark, script, source, and test files for wording already present on main, plus an unrelated frontend-domain profile document. No branch code, broad wording sweep, or unrelated file churn should be transplanted for issue #304.

## Verification

Run before commit:

- `git diff --check`
- `grep -R "provider usage/billing" -n README.md docs src test scripts benchmarks | head`
