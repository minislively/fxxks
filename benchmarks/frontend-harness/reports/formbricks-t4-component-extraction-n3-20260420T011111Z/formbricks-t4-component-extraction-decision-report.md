# Formbricks T4 Component Extraction N=3 Decision Report

Generated: 2026-04-20T01:11:11+09:00

## Verdict

- N=1 smoke verdict: `smoke-pass-proceed-to-n3`
- N=3 routing verdict: `proceed-to-n5`
  - N=3 is promising but cannot produce a claimable win because the threshold requires 4/5.
- Product interpretation: this candidate is worth N=5. It is the first post-filter Formbricks ambiguous UI task that shows quality-gated positive median total-time improvement and positive parsed runtime-token reduction under direct Codex runner parity.

## Commands

```bash
python3 benchmarks/frontend-harness/runners/full-benchmark-suite.py \
  --runner codex \
  --repo formbricks \
  --task T4 \
  --task-prompt "In the Formbricks web app, find a UI component under apps/web/app that renders a visible section header with title/description and nearby actions or controls. Extract that header JSX into a separate local Header component with typed props, keep the original behavior and styling intact, and report which files you modified or created. Do not edit API routes, generated files, tests, or locale JSON." \
  --iterations 1

python3 benchmarks/frontend-harness/runners/full-benchmark-suite.py \
  --runner codex \
  --repo formbricks \
  --task T4 \
  --task-prompt "In the Formbricks web app, find a UI component under apps/web/app that renders a visible section header with title/description and nearby actions or controls. Extract that header JSX into a separate local Header component with typed props, keep the original behavior and styling intact, and report which files you modified or created. Do not edit API routes, generated files, tests, or locale JSON." \
  --iterations 3
```

Both variants used direct `codex exec --full-auto`. The fooks variant differed by running the harness `fooks init` / `fooks scan` / `fooks attach codex` preparation before the same Codex command.

## Source filtering precondition

Before this run, the v2 dry-run source filtering was hardened and the manifest was extended to exclude Next API routes:

- `**/app/api/**`
- `**/pages/api/**`

Verification-only dry-runs after that change showed:

| Repo | Selected / target | Included | app/api selected | pages/api selected |
| --- | ---: | ---: | ---: | ---: |
| cal.com | 49 / 185 | 100 | 0 | 0 |
| formbricks | 97 / 185 | 235 | 0 | 0 |

## Report paths

- N=3 JSON: `benchmarks/frontend-harness/reports/benchmark-full-1776613131.json`
- N=3 artifacts archive: `benchmarks/frontend-harness/reports/formbricks-t4-component-extraction-n3-20260420T011111Z/benchmark-full-1776613131-artifacts.tar.gz`

## Aggregate fields

| Field | Value |
| --- | ---: |
| `rawMedianTotalTimeImprovement` | +15.1% |
| `rawMedianRuntimeTokenReduction` | +12.9% |
| `qualityGatedPairCount` | 3 |
| `qualityGatedMedianTotalTimeImprovement` | +15.1% |
| `qualityGatedMedianRuntimeTokenReduction` | +12.9% |
| `fooksAcceptancePassRate` | 100.0% |
| `broaderScopeRegressionCount` | 0 |
| `severeTokenOutlierCount` | 0 |
| `runtimeTokenClaimAvailable` | true |
| `proxyContextReduction.avg_reduction_pct` | +66.4% |
| `proxyContextReduction.avg_tokens_saved` | ~542,439 |

Target comparability breakdown:

- `same_component_or_file`: 2
- `semantically_comparable_target`: 1
- `incomparable_target`: 0

## Per-run table

| Iter | Target comparability | Vanilla files | Fooks files | Vanilla acceptance | Fooks acceptance | Total-time improvement | Runtime-token reduction |
| ---: | --- | --- | --- | --- | --- | ---: | ---: |
| 1 | `semantically_comparable_target` | `shareEmbedModal/tab-container.tsx` | `SettingsCard.tsx` | yes: 10/11 | yes: 10/11 | -32.0% | +12.9% |
| 2 | `same_component_or_file` | `SettingsCard.tsx` | `SettingsCard.tsx` | yes: 10/11 | yes: 10/11 | +24.9% | +62.2% |
| 3 | `same_component_or_file` | `SettingsCard.tsx` | `SettingsCard.tsx` | yes: 10/11 | yes: 10/11 | +15.1% | +9.4% |

## Evidence notes

- All 3 paired runs succeeded.
- Fooks acceptance passed 3/3 and did not broaden edit scope.
- Parsed runtime tokens were available for all quality-gated pairs, and fooks used fewer runtime tokens in all 3 pairs.
- Direct Codex runner parity keeps OMX orchestration overhead out of the benchmark result.
- The run is still not claimable as a public product win because the harness threshold requires N=5 with at least 4/5 quality-gated passing pairs.
- Typecheck/build validation did not prove because the Formbricks worktrees lacked installed `tsc` / `turbo` commands (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`). Interpret code correctness through artifact scorer + diff check only unless dependencies are installed for a follow-up run.

## Recommendation

Proceed to N=5 on this exact candidate before making a product claim. If N=5 preserves 4/5 quality-gated pairs with positive median total-time improvement, positive runtime-token reduction, and no severe token outliers, this lane becomes a claimable “fooks wins on ambiguous UI component extraction” example.

Do not generalize this result to exact-file tasks. Earlier Formbricks exact-file evidence stayed mixed/negative; this result specifically supports ambiguous UI discovery/refactor work where fooks has a chance to reduce search/context overhead.
