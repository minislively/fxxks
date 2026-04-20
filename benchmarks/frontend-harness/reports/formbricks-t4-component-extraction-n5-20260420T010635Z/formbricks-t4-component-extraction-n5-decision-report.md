# Formbricks T4 Component Extraction N=5 Decision Report

Generated: 2026-04-20T10:06:35+09:00

## Verdict

- N=5 benchmark verdict: `loss-non-goal-or-inconclusive`
- Product interpretation: **do not cite this lane as a fooks win**. On the N=5 rerun, fooks preserved task quality but lost on median total time and actual runtime tokens.
- The useful product signal is diagnostic: this ambiguous component-extraction task is not enough by itself; fooks can compress proxy context heavily, but preparation/context does not guarantee lower runtime tokens when the agent selects a different target or reasons longer.

## Latest main handling

- The N=5 run started from `e2ac0d2` (`Restore raw payload source text in model-facing output`).
- During the run, `origin/main` advanced to `cc00e55` (`Clarify dual-agent handoff after fooks run`).
- This branch was fast-forwarded to `cc00e55` before recording the evidence.
- I did not rerun N=5 after `cc00e55` because that commit only changes CLI manual handoff text/tests, while this benchmark uses direct `codex exec --full-auto` with harness fooks preparation. Treat this as a low-materiality base caveat, not a performance-affecting code delta.

## Command

```bash
python3 benchmarks/frontend-harness/runners/full-benchmark-suite.py \
  --runner codex \
  --repo formbricks \
  --task T4 \
  --task-prompt "In the Formbricks web app, find a UI component under apps/web/app that renders a visible section header with title/description and nearby actions or controls. Extract that header JSX into a separate local Header component with typed props, keep the original behavior and styling intact, and report which files you modified or created. Do not edit API routes, generated files, tests, or locale JSON." \
  --iterations 5
```

Both variants used direct `codex exec --full-auto`. The fooks variant differed by running the harness `fooks init` / `fooks scan` / `fooks attach codex` preparation before the same Codex command. No OMX execution runner was used for either variant.

## Report paths

- N=5 JSON: `benchmarks/frontend-harness/reports/benchmark-full-1776644047.json`
- N=5 artifacts archive: `benchmarks/frontend-harness/reports/formbricks-t4-component-extraction-n5-20260420T010635Z/benchmark-full-1776644047-artifacts.tar.gz`

## Aggregate fields

| Field | Value |
| --- | ---: |
| `rawMedianTotalTimeImprovement` | -9.1% |
| `rawMedianRuntimeTokenReduction` | -37.1% |
| `qualityGatedPairCount` | 5 |
| `qualityGatedMedianTotalTimeImprovement` | -9.1% |
| `qualityGatedMedianRuntimeTokenReduction` | -37.1% |
| `fooksAcceptancePassRate` | 100.0% |
| `broaderScopeRegressionCount` | 0 |
| `severeTokenOutlierCount` | 4 |
| `runtimeTokenClaimAvailable` | true |
| `proxyContextReduction.avg_reduction_pct` | +66.6% |
| `proxyContextReduction.avg_tokens_saved` | ~613,629 |

Target comparability breakdown:

- `same_component_or_file`: 2
- `semantically_comparable_target`: 3
- `incomparable_target`: 0

## Per-run table

| Iter | Target comparability | Vanilla files | Fooks files | Vanilla acceptance | Fooks acceptance | Total-time improvement | Runtime-token reduction | Vanilla tokens | Fooks tokens |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | `same_component_or_file` | `environments/[environmentId]/settings/components/SettingsCard.tsx` | `environments/[environmentId]/settings/components/SettingsCard.tsx` | yes: 10/11 | yes: 10/11 | +21.8% | -42.4% | 124,641 | 177,531 |
| 2 | `same_component_or_file` | `environments/[environmentId]/settings/components/SettingsCard.tsx` | `environments/[environmentId]/settings/components/SettingsCard.tsx` | yes: 10/11 | yes: 10/11 | -9.1% | +6.0% | 107,771 | 101,319 |
| 3 | `semantically_comparable_target` | `environments/[environmentId]/settings/components/SettingsCard.tsx` | `billing-confirmation/components/ConfirmationPage.tsx` | yes: 10/11 | yes: 10/11 | -19.3% | -166.1% | 68,459 | 182,143 |
| 4 | `semantically_comparable_target` | `environments/[environmentId]/settings/components/SettingsCard.tsx` | `billing-confirmation/components/ConfirmationPage.tsx` | yes: 10/11 | yes: 10/11 | -56.5% | -36.6% | 57,819 | 78,965 |
| 5 | `semantically_comparable_target` | `environments/[environmentId]/settings/components/SettingsCard.tsx` | `billing-confirmation/components/ConfirmationPage.tsx` | yes: 10/11 | yes: 10/11 | +4.3% | -37.1% | 104,388 | 143,097 |

## Evidence notes

- All 5 paired runs succeeded and fooks acceptance passed 5/5 with no broader-scope regressions.
- Median total-time improvement was negative (`-9.1%`), so fooks was slower at the quality-gated median despite wins in iterations 1 and 5.
- Actual runtime tokens were worse at the median (`-37.1%` reduction means fooks used more tokens), with severe fooks runtime-token outliers in 4/5 pairs. This directly answers the concern that “our thing used more tokens”: yes, for this lane that is bad for the runtime-token claim, so the product claim must not be framed as runtime-token savings here.
- Proxy context compression remained strong (`+66.6%`, ~613,629 tokens saved per prepared context), but proxy compression is only context-size evidence and did not translate into lower runtime token usage in this run.
- The most likely explanation is target/decision variance: vanilla repeatedly edited `SettingsCard.tsx`, while fooks picked `ConfirmationPage.tsx` in 3/5 pairs. Both passed the task scorer, but the changed target can cause different reasoning paths and token usage.
- Direct Codex runner parity keeps OMX orchestration overhead out of this benchmark. This is the right comparison surface for product evidence.
- Typecheck/build validation did not prove correctness because the Formbricks worktrees lacked installed `tsc` / `turbo` commands (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`). Interpret code correctness through artifact scorer + diff check only unless dependencies are installed for a follow-up run.

## Recommendation

Do not repeat this same ambiguous Formbricks T4 lane immediately as a claim candidate. The next priority should be a narrower decision benchmark that separates the questions:

1. **When does fooks win?** Run tasks where fooks is expected to reduce search overhead without changing the chosen target: exact-ish ambiguous file discovery, multi-file migration with stable anchors, or feature addition that requires cross-file pattern lookup.
2. **When does fooks lose?** Keep this report as a negative/control example: open-ended ambiguous UI refactor can induce longer reasoning or different target choice even with compressed context.
3. **Measurement fix before public claims:** install or cache repo dependencies for Formbricks validation, and add a target-stability dimension to reports so “different but acceptable target” does not hide token/time variance.

Product wording should be: fooks can reduce prepared context size, but actual runtime-token/time wins depend on task shape. This N=5 says Formbricks ambiguous component extraction is currently **loss/inconclusive**, not a win.
