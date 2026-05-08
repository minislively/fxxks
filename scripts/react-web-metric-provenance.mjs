const NOT_COMPARABLE_TO = Object.freeze([
  "wallClockSpeedup",
  "cacheHitRate",
  "runtimeTokenSavings",
  "providerBillingSavings",
]);

export const ACTUAL_INJECTED_CONTEXT_REDUCTION_PROVENANCE = Object.freeze({
  metric: "actualInjectedContextReduction",
  unit: "percent",
  numerator: "sourceBytes - additionalContextBytes",
  denominator: "sourceBytes",
  formula: "((sourceBytes - additionalContextBytes) / sourceBytes) * 100",
  claimBoundary: "local React Web fixture byte reduction only",
  notComparableTo: [...NOT_COMPARABLE_TO],
});

export const REPEATED_RUN_ACTUAL_INJECTED_CONTEXT_MIN_PROVENANCE = Object.freeze({
  metric: "repeatRunActualInjectedContextReductionMinPct",
  unit: "percent",
  sourceMetric: "actualInjectedContextReduction.minPct",
  aggregation: "per-run conservative suite minimum across measured fixtures, then repeated-run summary statistics",
  formula: "perRunValue = min(fixtures[].additionalContextReductionPct); repeatedRunSummary = stats(perRunValue across runs)",
  conservative: true,
  claimBoundary: "local React Web fixture byte reduction only",
  notComparableTo: [...NOT_COMPARABLE_TO],
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildReactWebMetricProvenance() {
  return {
    actualInjectedContextReduction: clone(ACTUAL_INJECTED_CONTEXT_REDUCTION_PROVENANCE),
    repeatRunActualInjectedContextReductionMinPct: clone(REPEATED_RUN_ACTUAL_INJECTED_CONTEXT_MIN_PROVENANCE),
  };
}
