# Legacy / Unneeded File Cleanup Audit

- Updated: 2026-05-18T00:57:46Z
- Tracking issue: #939
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


## Issue #944 legacy/archive docs decision pass

Applied at: 2026-05-18T02:46:00Z

Review policy for this pass:

- Delete only tracked legacy/archive docs that are clearly obsolete, superseded, duplicate, and unreferenced outside this cleanup audit.
- Keep archive docs that still provide branch-audit suppression evidence, dogfood/operator contract coverage, benchmark interpretation, or unique historical/product/evidence context.
- Reference checks used `rg` for each candidate path, basename, stem, and title; current architecture/product docs reviewed included `docs/product-direction.md`, `docs/frontend-domains.md`, `docs/evidence-model.md`, `docs/workflow-architecture.md`, `docs/state-contract.md`, `docs/work-item-action-dashboard-audit.md`, `docs/frontend-domain-contract.md`, `docs/frontend-domain-fixture-expectations.md`, `docs/frontend-domain-profiles.md`, `docs/remote-branch-audit.md`, and `docs/branch-audit-closeout-review-2026-05-09.md`.

| Path | Decision | Reference check | Reason |
| --- | --- | --- | --- |
| `docs/applied-code-evidence-closeout-branch-archive-306.md` | Keep | Referenced by `docs/remote-branch-audit.md` and `docs/branch-audit-closeout-review-2026-05-09.md`. | Current branch-audit suppression evidence for `codex/applied-code-evidence-closeout-20260425`; not safe to delete without changing audit evidence. |
| `docs/benchmark-context-policy-branch-archive-331.md` | Keep | Referenced by `docs/remote-branch-audit.md`, `docs/branch-audit-closeout-review-2026-05-09.md`, and `docs/formbricks-n3-quality-branch-archive-334.md`. | Preserves benchmark claim-boundary context and current branch-audit archive evidence. |
| `docs/branch-archive-codex-ts-js-same-file-beta-2026-05-01.md` | Keep | Referenced by `docs/remote-branch-audit.md` and `docs/branch-audit-closeout-review-2026-05-09.md`. | Current branch-audit suppression evidence for the TS/JS beta stale branch. |
| `docs/claim-boundary-usage-billing-branch-archive-304.md` | Keep | Referenced by `docs/remote-branch-audit.md` and `docs/branch-audit-closeout-review-2026-05-09.md`. | Current branch-audit suppression evidence and product claim-boundary context. |
| `docs/codex-worktree-status-parser-branch-archive-337.md` | Delete | Only referenced by this cleanup audit; title had no external refs. | Duplicate stale-branch note for `origin/codex/worktree-status-parser`; the kept `docs/issue-353-worktree-status-parser-branch-archive.md` is the current branch-audit evidence for that branch. |
| `docs/dogfood/clean-slate-legacy-review-worktree-residue-865.md` | Keep | Referenced by `test/operator-activity.test.mjs`. | Tested dogfood/operator contract; deleting would break focused doc coverage and lose active residue-boundary context. |
| `docs/dogfood/legacy-review-residue-cleanup-review-guard-895.md` | Keep | Referenced by `test/legacy-review-residue-cleanup-review-guard-doc.test.mjs`. | Tested cleanup-review guard with unique operator semantics. |
| `docs/fix-pr114-branch-archive-329.md` | Keep | Referenced by `docs/remote-branch-audit.md` and `docs/branch-audit-closeout-review-2026-05-09.md`. | Current branch-audit suppression evidence for `fix-pr114`; also records broad stale-tree risk. |
| `docs/fooks-dogfood-zombie-cleanup-branch-archive-309.md` | Keep | Referenced by `docs/remote-branch-audit.md` and `docs/branch-audit-closeout-review-2026-05-09.md`. | Current branch-audit suppression evidence for the dogfood zombie cleanup branch. |
| `docs/formbricks-n3-quality-branch-archive-334.md` | Keep | Referenced by `docs/remote-branch-audit.md` and `docs/branch-audit-closeout-review-2026-05-09.md`. | Current branch-audit suppression evidence plus historical Formbricks exact-file benchmark interpretation. |
| `docs/formbricks-t4-n3-evidence-branch-archive-336.md` | Keep | Only referenced by this cleanup audit; content cross-checks current benchmark report artifacts. | Preserves unique evidence-equivalence rationale for normalized JSON/path-scrubbed benchmark evidence not fully captured by the current decision report. |
| `docs/frontend-domain-contract-branch-archive-298.md` | Keep | Referenced by `docs/remote-branch-audit.md`, `docs/branch-audit-closeout-review-2026-05-09.md`, and `docs/frontend-domain-contract-branch-archive-308.md`. | Current branch-audit suppression evidence for `frontend-domain-contract-before-extractor-promotion`. |
| `docs/frontend-domain-contract-branch-archive-308.md` | Keep | Referenced by `docs/frontend-domain-contract-branch-archive-298.md` and appears in stale-tree delete examples in generated branch-audit docs. | Although duplicate-adjacent, it preserves the issue #308 re-triage against a newer `origin/main` state and keeps generated stale-tree examples coherent. |
| `docs/frontend-domain-fixture-expectation-lock-branch-archive-340.md` | Keep | Referenced by `docs/dogfood/stale-closed-artifact-worktree-cleanup-review-918.md` and branch-audit stale-tree examples. | Local worktree cleanup-review evidence and fixture expectation historical context. |
| `docs/frontend-domain-manifest-shape-guard-branch-archive-342.md` | Keep | Referenced by `docs/dogfood/stale-closed-artifact-worktree-cleanup-review-918.md` and branch-audit stale-tree examples. | Local worktree cleanup-review evidence and manifest-shape guard historical context. |
| `docs/issue-221-branch-audit-stale-valid-branch-archive-312.md` | Delete | Only referenced by this cleanup audit; title had no external refs. | Patch-equivalent stale branch rationale is superseded by current `scripts/audit-remote-branches.mjs` and `test/audit-remote-branches.test.mjs`; no current branch-audit archive evidence depends on this doc. |
| `docs/issue-353-worktree-status-parser-branch-archive.md` | Keep | Referenced by `docs/remote-branch-audit.md` and `docs/branch-audit-closeout-review-2026-05-09.md`. | Current exact branch-audit suppression evidence for `codex/worktree-status-parser`; it supersedes the deleted #327/#337 duplicate notes. |
| `docs/public-readme-polish-branch-archive-323.md` | Keep | Referenced by `docs/remote-branch-audit.md` and `docs/branch-audit-closeout-review-2026-05-09.md`. | Current branch-audit suppression evidence for the public README polish stale branch. |
| `docs/worktree-status-parser-branch-archive-327.md` | Delete | Only referenced by this cleanup audit; title had no external refs. | Older duplicate stale-branch note for `origin/codex/worktree-status-parser`; superseded by kept issue #353 archive evidence. |
| `docs/zombie-session-cleanup-stale-branch-archive-314.md` | Delete | Only referenced by this cleanup audit; title had no external refs. | Patch-equivalent stale branch rationale is superseded by current artifact-audit docs/code/tests and the kept dogfood zombie cleanup archive note. |

Deleted in this pass:

- `docs/codex-worktree-status-parser-branch-archive-337.md`
- `docs/issue-221-branch-audit-stale-valid-branch-archive-312.md`
- `docs/worktree-status-parser-branch-archive-327.md`
- `docs/zombie-session-cleanup-stale-branch-archive-314.md`

Kept all other tracked legacy/archive docs because they are referenced by current tests/generated audits, are current branch-audit suppression evidence, or preserve unique benchmark/product/dogfood context.

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

1. `.fooks/evidence/**` retention policy documented in `docs/cleanup/fooks-evidence-retention-policy.md` for issue #946. Future cleanup must follow that keep/archive/delete proof boundary; no evidence deletion was performed in the policy pass.
2. Review the 20 medium-risk tracked legacy/archive docs listed above; delete only after deciding whether historical context is still needed.
3. Investigate the 7 pre-existing/environment-sensitive test failures separately from cleanup.
4. Prune `.omx/` only after this active workflow is complete, because it contains current context/spec/plan/log artifacts.

