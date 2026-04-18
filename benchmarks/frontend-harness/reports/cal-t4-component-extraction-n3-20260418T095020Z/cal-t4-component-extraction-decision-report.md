# Cal.com T4 Component Extraction Benchmark Decision Report

Generated: 2026-04-18T11:32:31.627349+00:00

## Verdict

- N=1 smoke verdict: `smoke-pass-proceed-to-n3`
- N=3 routing verdict: `provisional-loss-or-non-goal`
  - N=3 quality-gated total time does not improve.
- Product interpretation: do **not** proceed to N=5 for a win claim from this candidate. The N=3 quality-gated pair regressed on total time, so this lane is currently a provisional loss/non-goal for acceleration claims despite fooks often producing valid artifacts and lower runtime tokens.

## Commands

```bash
python3 benchmarks/frontend-harness/runners/full-benchmark-suite.py --runner codex --repo cal.com --task T4 --iterations 1 --reports-dir benchmarks/frontend-harness/reports/cal-t4-component-extraction-20260418T093633Z
python3 benchmarks/frontend-harness/runners/full-benchmark-suite.py --runner codex --repo cal.com --task T4 --iterations 3 --reports-dir benchmarks/frontend-harness/reports/cal-t4-component-extraction-n3-20260418T095020Z
```

Both variants used direct `codex exec --full-auto`; fooks differed only by the harness `init/scan/attach-codex` preparation before the same Codex command.

## Report paths

- N=1 JSON: `benchmarks/frontend-harness/reports/cal-t4-component-extraction-20260418T093633Z/benchmark-full-1776504993.json`
- N=3 JSON: `benchmarks/frontend-harness/reports/cal-t4-component-extraction-n3-20260418T095020Z/benchmark-full-1776505820.json`
- N=3 artifacts: `/Users/veluga/Documents/Workspace_Minseol/fooks/benchmarks/frontend-harness/reports/cal-t4-component-extraction-n3-20260418T095020Z/artifacts/benchmark-full-1776505820`

## Aggregate fields

| Field | Value |
| --- | ---: |
| `rawMedianTotalTimeImprovement` | +2.1% |
| `rawMedianRuntimeTokenReduction` | +26.6% |
| `qualityGatedPairCount` | 1 |
| `qualityGatedMedianTotalTimeImprovement` | -4.3% |
| `qualityGatedMedianRuntimeTokenReduction` | +23.5% |
| `fooksAcceptancePassRate` | 100.0% |
| `broaderScopeRegressionCount` | 0 |
| `severeTokenOutlierCount` | 0 |
| `runtimeTokenClaimAvailable` | true |

Target comparability breakdown:
- `same_component_or_file`: 0
- `semantically_comparable_target`: 2
- `incomparable_target`: 1

## Per-run table

| Iter | Pair status | Target comparability | Vanilla files | Fooks files | Vanilla acceptance | Fooks acceptance | Total-time improvement | Runtime-token reduction |
| ---: | --- | --- | --- | --- | --- | --- | ---: | ---: |
| 1 | paired-success | `semantically_comparable_target` | apps/web/components/apps/AppPage.tsx, apps/web/components/apps/AppPageHeader.tsx | packages/ui/components/alert/Alert.tsx, packages/ui/components/alert/Header.tsx | no: header_semantics_preserved | yes: none | +8.6% | +29.7% |
| 2 | partial/failed | `incomparable_target` | none | apps/web/app/(use-page-wrapper)/(main-nav)/ShellMainAppDir.tsx, apps/web/app/(use-page-wrapper)/(main-nav)/ShellMainAppDirHeader.tsx | no: original_component_uses_header, no_unused_header_false_positive | yes: none | n/a | n/a |
| 3 | paired-success | `semantically_comparable_target` | apps/web/modules/settings/my-account/components/HolidaysHeader.tsx, apps/web/modules/settings/my-account/holidays-view.tsx | packages/ui/components/layout/ShellSubHeading.tsx, packages/ui/components/layout/ShellSubHeadingHeader.tsx | yes: none | yes: none | -4.3% | +23.5% |

## Evidence notes

- N=1 smoke passed candidate/scorer stability and routed to N=3; it is not a product win/loss claim.
- N=3 produced two successful paired runs and one vanilla timeout. Only one pair was quality-gated because one successful vanilla artifact failed the mandatory `header_semantics_preserved` check.
- Fooks acceptance was 3/3 among successful fooks artifacts, with zero broader-scope regressions and zero severe runtime-token outliers.
- The single quality-gated pair showed runtime-token reduction but a negative total-time improvement, so the current rules correctly route to provisional loss/non-goal rather than N=5.
- Proxy context reduction is recorded only as `proxyContextReduction` context-size evidence; runtime-token claims use parsed `tokens_used` only.

## Recommendation

Do not spend N=5 on this exact candidate for a win claim. The useful product finding is narrower: fooks can produce valid T4 artifacts and may reduce runtime tokens, but the current ambiguous Cal.com T4 prompt does not yet show quality-gated total-time advantage. Next best step is prompt/scorer refinement focused on target comparability and stable vanilla/fooks target selection, then rerun N=1 before another N=3.
