# Legacy / Unneeded File Cleanup Audit

- Updated: 2026-05-18T00:57:46Z
- Tracking issue: #937
- Source spec: `.omx/specs/deep-interview-legacy-file-audit.md`
- PRD: latest `.omx/plans/prd-legacy-file-audit-*.md`
- Policy: first pass may delete only low-risk generated/cache/runtime artifacts; code/test/script/fixture/doc candidates are report-only.

## First-pass candidate inventory

| Path | Risk | Exists before cleanup | Size before cleanup | Tracked files | Ignored | Evidence | Action |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| `dist` | low | yes | 2.6M | 0 | yes | Ignored by .gitignore; TypeScript build output from tsconfig outDir; reproducible by npm run build. | delete in first pass; validation rebuilds it |
| `benchmarks/layer2-frontend-task/results` | low | yes | 524K | 0 | yes | Ignored benchmark result output directory. | delete in first pass |
| `.fooks/state` | low | yes | 28M | 0 | yes | Ignored local runtime state; largest .fooks area. | delete in first pass |
| `.fooks/cache` | low | yes | 480K | 0 | yes | Ignored local cache. | delete in first pass |
| `.fooks/artifacts` | low | yes | 160K | 0 | yes | Ignored generated evidence/artifact output. | delete in first pass |
| `.fooks/sessions` | low | yes | 144M | 0 | yes | Ignored local session runtime records. | delete in first pass if present |
| `node_modules` | low | yes | 26M | 0 | yes | Ignored dependency install output; reproducible from package-lock. | skip deletion to preserve validation environment |
| `.omx` | low/medium | yes | 286M | 3 | no | Ignored OMX runtime/planning state; active workflow is using it and it contains current artifacts. | skip during active workflow; prune separately |
| `.claude` | medium | yes | 4.0K | 0 | no | Ignored local agent/tooling configuration. | report-only |
| `.omc` | medium | yes | 112K | 0 | yes | Ignored local/tooling state. | report-only |
| `.opencode` | medium | yes | 8.0K | 0 | yes | Local tool config/state. | report-only |
| `.npm-auth` | protected | yes | 4.0K | 0 | yes | Potential local auth material. | do not delete automatically |

## Medium-risk legacy/archive docs (report-only)

- Found 20 docs with legacy/archive/old naming signals; 20 are git-tracked. These are not deleted in the first pass.

  - `docs/applied-code-evidence-closeout-branch-archive-306.md`
  - `docs/benchmark-context-policy-branch-archive-331.md`
  - `docs/branch-archive-codex-ts-js-same-file-beta-2026-05-01.md`
  - `docs/claim-boundary-usage-billing-branch-archive-304.md`
  - `docs/codex-worktree-status-parser-branch-archive-337.md`
  - `docs/dogfood/clean-slate-legacy-review-worktree-residue-865.md`
  - `docs/dogfood/legacy-review-residue-cleanup-review-guard-895.md`
  - `docs/fix-pr114-branch-archive-329.md`
  - `docs/fooks-dogfood-zombie-cleanup-branch-archive-309.md`
  - `docs/formbricks-n3-quality-branch-archive-334.md`
  - `docs/formbricks-t4-n3-evidence-branch-archive-336.md`
  - `docs/frontend-domain-contract-branch-archive-298.md`
  - `docs/frontend-domain-contract-branch-archive-308.md`
  - `docs/frontend-domain-fixture-expectation-lock-branch-archive-340.md`
  - `docs/frontend-domain-manifest-shape-guard-branch-archive-342.md`
  - `docs/issue-221-branch-audit-stale-valid-branch-archive-312.md`
  - `docs/issue-353-worktree-status-parser-branch-archive.md`
  - `docs/public-readme-polish-branch-archive-323.md`
  - `docs/worktree-status-parser-branch-archive-327.md`
  - `docs/zombie-session-cleanup-stale-branch-archive-314.md`

## High-risk report-only areas

- `src/**` — Implementation source: no automatic deletion in first pass.
- `scripts/**` — Package/ops scripts: no automatic deletion in first pass.
- `test/**` — Regression tests: no automatic deletion in first pass.
- `fixtures/**` — Test fixtures: no automatic deletion in first pass.

## Protected areas

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.test.json`
- `.github/workflows/**`
- `README.md`
- `LICENSE`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`

## Applied first-pass cleanup

Applied at: 2026-05-18T01:00:54Z

Deleted only low-risk ignored/generated/runtime paths:
- `dist/` — build output; validation `npm run test` and `npm run build` rebuilt it successfully before final removal.
- `benchmarks/layer2-frontend-task/results/` — ignored benchmark result output.
- `.fooks/state/` — ignored local runtime state.
- `.fooks/cache/` — ignored local cache.
- `.fooks/artifacts/` — ignored generated artifact output.
- `.fooks/sessions/` — ignored local session runtime records.

Skipped despite low-risk classification:
- `node_modules/` — kept to preserve the local validation environment.
- `.omx/` — kept because the active workflow and current planning/report artifacts live there; prune separately outside this run.

Kept/report-only:
- `.fooks/evidence/**`, `.fooks/adapters/**`, `.fooks/config.json`, `.fooks/index.json` — ignored/local but potentially useful evidence/config; not part of the first-pass deletion set.
- `docs/*legacy*`, `docs/*archive*`, `docs/*old*` — medium-risk tracked docs; not deleted.
- `src/**`, `scripts/**`, `test/**`, `fixtures/**` — high-risk; not deleted.

Approximate first-pass local cleanup size before validation/regeneration: ~175MB from `.fooks` runtime/session/cache/artifact areas plus small generated build/benchmark outputs.

## Validation evidence

Logs: `.omx/logs/legacy-file-audit/`

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS | `tsc -p tsconfig.json --noEmit` completed with no diagnostics in `typecheck.log`. |
| `npm run lint` | PASS | lint delegates to typecheck and completed with no diagnostics in `lint.log`. |
| `npm run test` | FAIL: 850 pass / 7 fail | Failures are recorded in `test.log`; they are setup/environment/path/timing assertions, not deleted-file missing errors. |
| `npm run build` | PASS | `tsc -p tsconfig.json` completed in `build.log`; `dist/` was regenerated then removed again as low-risk build output. |

Test failure summary from `npm run test`:
- `init creates config and cache contract` — expected placeholder account but environment/config returned `minislively`.
- `setup default output is human-readable and points to --json for details` — setup reported blocked with `detectDomainFromSource is not a function`.
- Three `operator-activity` tests — `/private/var/...` vs `/var/...` temp path assertion differences.
- `status stale-worktrees emits issue 854 JSON and rejects unknown args` — `spawnSync ... ETIMEDOUT`.
- `bare status includes docs-backed WorkItem dashboard while preserving metric status shape` — `/private/var/...` vs `/var/...` temp path assertion difference.

## Final workspace state

- No tracked source/test/script/fixture files were deleted.
- Final `git status --short` shows only this new report under `docs/cleanup/` as an untracked source artifact.
- The first-pass low-risk directories listed above are absent after final cleanup.

## Recommended follow-up backlog

1. Decide whether `.fooks/evidence/**` should be archived, compressed, or kept as dogfood evidence.
2. Review the 20 medium-risk tracked legacy/archive docs listed above; delete only after deciding whether historical context is still needed.
3. Investigate the 7 pre-existing/environment-sensitive test failures separately from cleanup.
4. Prune `.omx/` only after this active workflow is complete, because it contains current context/spec/plan/log artifacts.

