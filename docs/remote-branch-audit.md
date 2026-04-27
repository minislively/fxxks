# Remote branch stale-work audit

Generated: 2026-04-27T10:09:50.617Z

Base: `origin/main`

Remote: `origin`
GitHub open PR check: yes (0 open PRs in minislively/fooks)

Regenerate this report with `npm run --silent branch:audit -- --output docs/remote-branch-audit.md`. Use `--json` for automation.

## Summary

- Total remote branches audited: 81
- Redundant branches: 71
  - Fully merged by commit: 20
  - Patch-equivalent to base: 51
- Valid candidates needing human review: 10
- Branches with open PRs: 0

## Valid candidates without open PRs

These branches still have unique patch commits relative to `origin/main`. Review before deleting or recreating PRs.

| Branch | Ahead | Behind | Unique patches | Patch-equivalent | Last commit | Tip | Subject |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `claim-boundary-usage-billing-wording` | 4 | 21 | 3 | 0 | 2026-04-26 | `75de0ac3e307` | Keep claim boundaries intact after main merge |
| `frontend-domain-contract-before-extractor-promotion` | 2 | 18 | 2 | 0 | 2026-04-26 | `0658854a26f9` | merge: resolve conflict with main (PR #199 changes) |
| `codex/applied-code-evidence-closeout-20260425` | 2 | 28 | 2 | 0 | 2026-04-25 | `8d1c4a7f2baf` | Record bounded R4 applied diagnostic without claim upgrade |
| `fooks-dogfood-zombie-cleanup` | 1 | 34 | 1 | 0 | 2026-04-24 | `b4ed5e5df96d` | feat(doctor): add worktree and tmux session health checks |
| `chore/v0.1.0-public-readme-polish` | 2 | 76 | 2 | 0 | 2026-04-23 | `5f1774d65bbe` | test: update README subtitle regex to match polished wording |
| `codex/ts-js-same-file-beta` | 3 | 74 | 3 | 0 | 2026-04-23 | `a224108273f3` | test: update README subtitle regex for TS/JS beta wording |
| `codex/worktree-status-parser` | 1 | 80 | 1 | 0 | 2026-04-23 | `e48fb51bb442` | Separate dirty-worktree evidence before workflow wiring |
| `fix-pr114` | 14 | 126 | 9 | 5 | 2026-04-22 | `0decccb5e0af` | feat: add line metadata to hooks, effects, and eventHandlers |
| `ralph/benchmark-context-policy` | 3 | 209 | 1 | 2 | 2026-04-17 | `d401306e9063` | Measure ambiguous Formbricks claims under quality gates |
| `benchmark/formbricks-n3-quality` | 4 | 223 | 4 | 0 | 2026-04-16 | `8787fa685745` | Preserve the Caps Lock follow-up benchmark evidence |

## Redundant: fully merged by commit

| Branch | Ahead | Behind | Unique patches | Patch-equivalent | Last commit | Tip | Subject |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `codex/design-review-metadata-schema-v0` | 0 | 57 | 0 | 0 | 2026-04-24 | `cf2a884f6908` | Constrain design metadata before fixture implementation |
| `codex/readme-benchmark-priority-omx-link` | 0 | 45 | 0 | 0 | 2026-04-24 | `c966515f8809` | Prioritize provider-cost evidence and link OMX diagnostic |
| `codex/runtime-edit-guidance-optin-gate` | 0 | 85 | 0 | 0 | 2026-04-23 | `ff60c6154839` | Preserve compact runtime defaults while opening edit-guidance opt-in (#126) |
| `codex/fooks-doctor` | 0 | 95 | 0 | 0 | 2026-04-22 | `ec338b71d248` | Cover Claude doctor host-tooling diagnostics |
| `codex/release-risk-boundary-hardening` | 0 | 148 | 0 | 0 | 2026-04-21 | `afbfff6636e7` | Align R4 task inventory with smoke evidence |
| `fix/run-first-success-noop-guidance-20260421` | 0 | 152 | 0 | 0 | 2026-04-21 | `cb36b6b78449` | Make no-op fooks run point to the real first-success path |
| `harden-public-release-surface` | 0 | 131 | 0 | 0 | 2026-04-21 | `186c5d2faf79` | merge: resolve conflicts with main, keep release-hardening changes |
| `ralph/public-folder-cleanup` | 0 | 131 | 0 | 0 | 2026-04-21 | `e8404e901985` | merge: resolve conflicts with main, keep public-folder-cleanup changes |
| `codex/simplify-public-docs-v2` | 0 | 159 | 0 | 0 | 2026-04-20 | `cfb19c31fd25` | Make public docs easier to scan |
| `feat/cache-monitoring-dashboard` | 0 | 184 | 0 | 0 | 2026-04-20 | `3b32c53f14bd` | chore: add MIT license for public package |
| `feat/cache-resilience-and-detect` | 0 | 188 | 0 | 0 | 2026-04-20 | `8b28997a2a71` | feat(layer2): deterministic dry-run framework with bucket classifier |
| `fix/fooks-run-noop-guidance-20260420` | 0 | 157 | 0 | 0 | 2026-04-20 | `bdbd2f57d662` | Close the empty-context dead end in fooks run |
| `issue-59-opencode-read-boundary` | 0 | 161 | 0 | 0 | 2026-04-20 | `425797789666` | Preserve the opencode manual boundary |
| `preserve/formbricks-n3-results` | 0 | 163 | 0 | 0 | 2026-04-20 | `0c97c755f63f` | Preserve Formbricks N=3 benchmark evidence data |
| `feat/agent-neutral-docs` | 0 | 201 | 0 | 0 | 2026-04-19 | `bf3c6afa1003` | feat(benchmark): dry-run frontend sample eligibility |
| `feat/default-auto-mode-spec-1776320070` | 0 | 227 | 0 | 0 | 2026-04-16 | `56f1527ec864` | docs(cli): refine spec tone per review feedback |
| `fix/api-access-blocker-wording` | 0 | 239 | 0 | 0 | 2026-04-16 | `45ac105c04fa` | fix(docs): correct misleading wording in API_ACCESS_BLOCKER.md |
| `feat/benchmark-v2-integration` | 0 | 242 | 0 | 0 | 2026-04-15 | `667f69710e63` | feat(benchmark): add v2 integration layer |
| `feat/multifile-validation` | 0 | 254 | 0 | 0 | 2026-04-15 | `8ddfdcf6caa6` | feat: multifile validation and benchmark documentation updates (rebased) |
| `fix/issue-15-large-mixed-fidelity-gap` | 0 | 248 | 0 | 0 | 2026-04-15 | `9a8a19288644` | fix(benchmark): large-mixed fidelity gap in v2 extraction path |

## Redundant: patch-equivalent to base

These branches still have commits ahead of the base ref, but `git cherry` reports their patches as already present in `origin/main`.

| Branch | Ahead | Behind | Unique patches | Patch-equivalent | Last commit | Tip | Subject |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `docs/frontend-domain-fixture-expectation-lock` | 1 | 12 | 0 | 1 | 2026-04-27 | `525aa0e1bb65` | Keep fixture expectation docs aligned with the manifest |
| `docs/frontend-domain-manifest-shape-guard` | 1 | 11 | 0 | 1 | 2026-04-27 | `8143b7b3b81e` | Prevent selected fixture slots from carrying deferred state |
| `docs/red-team-cache-resolution-note` | 1 | 3 | 0 | 1 | 2026-04-27 | `e1179cf9c947` | docs: mark red-team cache finding as historical |
| `feat/webview-bridge-paired-fallback-fixture` | 1 | 1 | 0 | 1 | 2026-04-27 | `1bc85bcdaadf` | Add fallback evidence for WebView bridge pairs |
| `test/frontend-domain-detector-manifest-parity` | 1 | 10 | 0 | 1 | 2026-04-27 | `babfd3800faa` | Keep detector outcomes aligned with fixture manifest lanes |
| `feat/domain-extract-exposure` | 1 | 14 | 0 | 1 | 2026-04-26 | `10ce1faa8035` | feat: expose domainDetection in extract output |
| `feat/issue-203-frontend-domain-detector` | 1 | 15 | 0 | 1 | 2026-04-26 | `2e589b2913aa` | Expose frontend domain evidence without support promotion |
| `fix/issue-190-artifact-scope` | 1 | 23 | 0 | 1 | 2026-04-26 | `e08a077d6b1d` | Fix artifact audit fooks session scope |
| `chore/issue-187-artifact-audit` | 1 | 24 | 0 | 1 | 2026-04-25 | `83b707433d65` | Add a safe audit for merged fooks artifacts |
| `docs/issue-177-rn-webview-boundary` | 1 | 31 | 0 | 1 | 2026-04-25 | `3ab8107b4042` | Clarify RN WebView support boundary |
| `docs/issue-182-rn-webview-architecture` | 1 | 27 | 0 | 1 | 2026-04-25 | `03afac163f0d` | Define RN/WebView architecture lanes before promotion |
| `docs/issue-185-tui-fixture-survey` | 1 | 25 | 0 | 1 | 2026-04-25 | `ef8e0c642dc3` | Record TUI fixture survey boundaries |
| `docs/rn-webview-evidence-lane` | 1 | 30 | 0 | 1 | 2026-04-25 | `928a3e5c2025` | Define RN WebView support promotion gates |
| `docs/rn-webview-fixture-candidates` | 1 | 29 | 0 | 1 | 2026-04-25 | `1e586018e79a` | Survey RN WebView fixture candidates before extractor work |
| `feat/frontend-design-payload-quality` | 1 | 28 | 0 | 1 | 2026-04-25 | `7d93606aaa03` | Improve frontend design payload anchors without broadening claims |
| `fooks-pr174-feedback` | 1 | 34 | 0 | 1 | 2026-04-25 | `44938cf7942f` | feat(doctor): add operator-scoped worktree and tmux session health checks |
| `codex/design-review-metadata-compression` | 1 | 59 | 0 | 1 | 2026-04-24 | `88ee60fb1595` | Define the metadata seam before design support |
| `codex/design-review-metadata-v0-impl` | 1 | 51 | 0 | 1 | 2026-04-24 | `169f569f93e1` | Prove design-review metadata before runtime exposure |
| `eval/lsp-frontend-context-extraction` | 1 | 73 | 0 | 1 | 2026-04-24 | `18a847462498` | eval(#110): add LSP frontend context extraction evaluation script |
| `fix/issue-108-provider-tokenizer-boundary` | 1 | 58 | 0 | 1 | 2026-04-24 | `63150fb32c83` | Clarify provider tokenizer proof boundary |
| `fix/issue-109-usage-log-boundary` | 1 | 61 | 0 | 1 | 2026-04-24 | `1822863cb17c` | Clarify usage-log reporting is out of scope |
| `fix/issue-154-benchmark-impact` | 1 | 63 | 0 | 1 | 2026-04-24 | `b8ad93845978` | Restore claim-safe benchmark impact visibility |
| `fix/issue-156-output-token-shaping` | 1 | 62 | 0 | 1 | 2026-04-24 | `e58b3788d68e` | Expose output-token evidence without runtime shaping |
| `fix/release-smoke-negated-billing-token` | 1 | 46 | 0 | 1 | 2026-04-24 | `0443d9eb1c29` | Fix release smoke negated billing-token claim detection |
| `claude-benchmark-parity` | 1 | 78 | 0 | 1 | 2026-04-23 | `1946e8f14e83` | Add Claude benchmark parity with Codex Layer 2 R4 task benchmarks |
| `codex/line-edit-ux` | 2 | 92 | 0 | 1 | 2026-04-23 | `5c990e96accc` | Merge remote-tracking branch 'origin/main' into codex/line-edit-ux |
| `feat/codex-edit-guidance-optin-gates` | 1 | 71 | 0 | 1 | 2026-04-23 | `c44a4e195c2c` | test: add hasPositiveFreshness fallback test for #142 |
| `feat/frontend-scope-taxonomy` | 1 | 70 | 0 | 1 | 2026-04-23 | `10ee997bebc4` | docs: add Post-Ralph verification status to frontend scope taxonomy |
| `fooks-issue-92-proof-wording` | 1 | 124 | 0 | 1 | 2026-04-21 | `79cd002c6e5e` | fix: proof wording and validation refinements |
| `gaebal/opencode-dirty-root-20260421` | 1 | 124 | 0 | 1 | 2026-04-21 | `d28388602db3` | fix: keep .opencode artifacts out of repo root |
| `benchmark/formbricks-t4-n3-evidence` | 1 | 198 | 0 | 1 | 2026-04-20 | `fba1512cd31d` | Record Formbricks T4 N3 benchmark evidence |
| `codex/add-mit-license` | 1 | 185 | 0 | 1 | 2026-04-20 | `f6d72520e3ef` | Clarify public package reuse rights |
| `codex/ci-actions-node24-runtime` | 1 | 177 | 0 | 1 | 2026-04-20 | `d4a32e3ab997` | Avoid deprecated GitHub Actions runtimes |
| `codex/document-source-runtime-split` | 1 | 180 | 0 | 1 | 2026-04-20 | `df9b57c70604` | Clarify why fooks keeps runtime JavaScript |
| `codex/oh-my-fooks-release-prep` | 1 | 186 | 0 | 1 | 2026-04-20 | `28c08ccce612` | Prepare safe public package handoff |
| `codex/opencode-command-risk-reduction` | 1 | 175 | 0 | 1 | 2026-04-20 | `ae9726f49efc` | Reduce opencode tool-selection ambiguity |
| `codex/opencode-tool-mvp` | 1 | 182 | 0 | 1 | 2026-04-20 | `054e20c7b6ea` | Make adapter handoffs explicit without leaking debug controls |
| `codex/restore-benchmark-snapshot` | 1 | 180 | 0 | 1 | 2026-04-20 | `20bb4e5c3681` | Restore concise benchmark snapshot to README |
| `codex/setup-docs-guide` | 1 | 187 | 0 | 1 | 2026-04-20 | `d43d8c24277f` | Document recoverable setup onboarding |
| `benchmark/v2-runner-source-filtering` | 1 | 202 | 0 | 1 | 2026-04-19 | `68cb7c0e9b50` | Make benchmark dry-runs prove frontend sample eligibility |
| `fooks-issue-0-cache-resilience-main-dirty` | 1 | 201 | 0 | 1 | 2026-04-19 | `e07a7d2f9789` | feat(cache): improve cache monitoring and add tests |
| `validation/agent-neutral-cli-proof` | 1 | 201 | 0 | 1 | 2026-04-19 | `937358fd3d30` | Record concrete Codex and Claude terminal CLI validation |
| `validation/agent-neutral-first-success-20260419` | 1 | 198 | 0 | 1 | 2026-04-19 | `dce297a548f0` | Reopen the terminal CLI proof track with a retention-safe first success pass |
| `benchmark/cal-t4-component-extraction` | 1 | 206 | 0 | 1 | 2026-04-18 | `8c6a2988d78b` | Gate Cal.com T4 benchmarks on quality evidence |
| `fooks-issue-0-rawtext-payload-recovery` | 1 | 206 | 0 | 1 | 2026-04-18 | `bceea887bc94` | Restore raw payload source text in model-facing output |
| `pr-27-check` | 1 | 207 | 0 | 1 | 2026-04-17 | `388fd4573e37` | Gate benchmark wins on artifact quality |
| `feat/layer2-frontend-direct-execution` | 1 | 241 | 0 | 1 | 2026-04-15 | `8ed6d5ddcc2c` | docs(benchmark): add layer2 frontend execution framework |
| `test/cache-resilience-coverage` | 1 | 254 | 0 | 1 | 2026-04-15 | `2bca1e1857c9` | test: add cache resilience test coverage |
| `doc-final-rerun` | 1 | 257 | 0 | 1 | 2026-04-14 | `38f69e3df8ed` | docs: Final Rerun updates - README, BENCHMARK_HISTORY, RISK_AND_MONITORING |
| `feat/add-ci-cd` | 1 | 276 | 0 | 1 | 2026-04-14 | `7130bbc0bc70` | ci: add GitHub Actions workflow for CI/CD |
| `feat/red-teaming-analysis` | 1 | 276 | 0 | 1 | 2026-04-14 | `99cbb35b3dbe` | docs: add comprehensive red team analysis report |

## Open PR branches

No open-pr branches.
