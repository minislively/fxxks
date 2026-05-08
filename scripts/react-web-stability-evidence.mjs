import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReactWebContextEvidence } from "./react-web-context-evidence.mjs";
import { buildReactWebReuseEvidence } from "./react-web-reuse-evidence.mjs";
import { buildReactWebOverCachingAuditEvidence } from "./react-web-over-caching-audit.mjs";
import { buildReactWebMetricProvenance } from "./react-web-metric-provenance.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");
const DEFAULT_REPEAT = 5;
const DEFAULT_STABLE_THRESHOLD_PCT = 5;

function round(value) {
  return Number.parseFloat(value.toFixed(3));
}

function mean(values) {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function stddev(values) {
  if (values.length <= 1) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return round(Math.sqrt(variance));
}

function coefficientOfVariationPct(values) {
  if (values.length === 0) return 0;
  const average = mean(values);
  if (average === 0) return 0;
  return round((stddev(values) / Math.abs(average)) * 100);
}

function allSame(values) {
  return values.every((value) => value === values[0]);
}

function parseRepeat(argv) {
  const raw = argv.find((arg) => arg.startsWith("--repeat="))?.slice("--repeat=".length);
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_REPEAT;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--repeat must be a positive integer; received ${raw ?? "undefined"}`);
  }
  return parsed;
}

export async function buildReactWebStabilityEvidence({
  repoRoot = defaultRepoRoot,
  repeat = DEFAULT_REPEAT,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
  stableThresholdPct = DEFAULT_STABLE_THRESHOLD_PCT,
} = {}) {
  const metricProvenance = buildReactWebMetricProvenance();
  const runs = [];

  for (let index = 0; index < repeat; index += 1) {
    const iteration = index + 1;
    const iterationRunId = `${runId}-run-${String(iteration).padStart(2, "0")}`;
    const contextEvidence = await buildReactWebContextEvidence({ repoRoot, runId: `${iterationRunId}-context` });
    const reuseEvidence = await buildReactWebReuseEvidence({ repoRoot, runId: `${iterationRunId}-reuse` });
    const overCachingAudit = await buildReactWebOverCachingAuditEvidence({ repoRoot, runId: `${iterationRunId}-audit` });

    runs.push({
      iteration,
      runId: iterationRunId,
      contextEvidence: {
        actualInjectedContextReduction: contextEvidence.summary.actualInjectedContextReduction,
        allReactWebInjects: contextEvidence.summary.allReactWebInjects,
      },
      reuseEvidence: {
        reuseCorrectnessClaimable: reuseEvidence.summary.reuseCorrectnessClaimable,
        sameFileReactWebReuse: reuseEvidence.checks.sameFileReactWebReuse.claimable,
        sourceChangeRefresh: reuseEvidence.checks.sourceChangeRefresh.claimable,
        unsupportedDomainFallbacks: reuseEvidence.checks.unsupportedDomainFallbacks.claimable,
      },
      overCachingAudit: {
        verdict: overCachingAudit.summary.verdict,
        verdictName: overCachingAudit.summary.verdictName,
        bugReproduced: overCachingAudit.summary.bugReproduced,
        suspiciousStepCount: overCachingAudit.checks.smallEditRefreshAudit.suspiciousStepCount,
      },
      primaryMetric: {
        metric: "repeatRunActualInjectedContextReductionMinPct",
        valuePct: contextEvidence.summary.actualInjectedContextReduction.minPct,
      },
    });
  }

  const primaryMetricValues = runs.map((run) => run.primaryMetric.valuePct);
  const reuseValues = runs.map((run) => run.reuseEvidence.reuseCorrectnessClaimable);
  const auditVerdictNames = runs.map((run) => run.overCachingAudit.verdictName);
  const stable = repeat < 2 ? true : coefficientOfVariationPct(primaryMetricValues) <= stableThresholdPct;
  const warnings = [];

  if (!stable) {
    warnings.push("repeat-run conservative context reduction metric is unstable; treat as warning evidence, not a stronger optimization claim");
  }
  if (!runs.every((run) => run.contextEvidence.actualInjectedContextReduction.claimable)) {
    warnings.push("at least one run failed the actual injected context claimability gate");
  }
  if (!runs.every((run) => run.reuseEvidence.reuseCorrectnessClaimable)) {
    warnings.push("at least one run regressed React Web reuse correctness");
  }
  if (!allSame(auditVerdictNames)) {
    warnings.push("over-caching audit verdict name changed across repeated runs");
  }
  if (runs.some((run) => run.overCachingAudit.bugReproduced)) {
    warnings.push("over-caching audit reproduced a stale-payload warning in at least one run");
  }

  return {
    schemaVersion: "react-web-stability-evidence.v1",
    generatedAt: new Date().toISOString(),
    runId,
    repeat,
    measurement: "repeat-run-react-web-evidence-stability",
    claimBoundary:
      "Repeat-run local React Web evidence only: summarizes repeated context-byte, reuse-routing, and over-caching audit results on current main. This is not wall-clock performance, not cache-hit-rate proof, not runtime-token savings, and not provider cost, billing, invoice, or charged-cost evidence. Unstable results remain warning evidence, not broadened claims.",
    claimability: {
      contextReduction: true,
      cachePerformance: false,
      providerBillingSavings: false,
    },
    metricProvenance: {
      actualInjectedContextReduction: metricProvenance.actualInjectedContextReduction,
      repeatRunActualInjectedContextReductionMinPct: metricProvenance.repeatRunActualInjectedContextReductionMinPct,
    },
    runs,
    summary: {
      primaryMetric: {
        metric: "repeatRunActualInjectedContextReductionMinPct",
        minObservedPct: round(Math.min(...primaryMetricValues)),
        maxObservedPct: round(Math.max(...primaryMetricValues)),
        meanPct: mean(primaryMetricValues),
        stddevPct: stddev(primaryMetricValues),
        coefficientOfVariationPct: coefficientOfVariationPct(primaryMetricValues),
        stableThresholdPct,
        stable,
        warningOnly: !stable,
      },
      contextReductionEvidenceClaimableAcrossRuns: runs.every((run) => run.contextEvidence.actualInjectedContextReduction.claimable),
      allReactWebInjectsAcrossRuns: runs.every((run) => run.contextEvidence.allReactWebInjects),
      reuseCorrectness: {
        consistent: allSame(reuseValues),
        claimableAcrossRuns: runs.every((run) => run.reuseEvidence.reuseCorrectnessClaimable),
        values: reuseValues,
      },
      overCachingAudit: {
        stable: allSame(auditVerdictNames),
        verdictNames: auditVerdictNames,
        noReproAcrossRuns: runs.every((run) => run.overCachingAudit.verdict === "no-repro"),
      },
      warnings,
    },
  };
}

export function renderReactWebStabilityEvidenceMarkdown(evidence) {
  const runRows = evidence.runs
    .map(
      (run) =>
        `| ${run.iteration} | ${run.primaryMetric.valuePct}% | ${run.reuseEvidence.reuseCorrectnessClaimable ? "yes" : "no"} | ${run.overCachingAudit.verdictName} | ${run.overCachingAudit.bugReproduced ? "yes" : "no"} |`,
    )
    .join("\n");
  const warnings = evidence.summary.warnings.length > 0 ? evidence.summary.warnings.map((warning) => `- ${warning}`).join("\n") : "- none";

  return `# React Web stability evidence

${evidence.claimBoundary}

## Summary

- Repeat count: ${evidence.repeat}
- Primary metric: ${evidence.summary.primaryMetric.metric}
- Observed range: ${evidence.summary.primaryMetric.minObservedPct}% to ${evidence.summary.primaryMetric.maxObservedPct}%
- Mean/stddev: ${evidence.summary.primaryMetric.meanPct}% / ${evidence.summary.primaryMetric.stddevPct}%
- Coefficient of variation: ${evidence.summary.primaryMetric.coefficientOfVariationPct}%
- Stable: ${evidence.summary.primaryMetric.stable ? "yes" : "no"}
- Context reduction claimability boundary: ${evidence.claimability.contextReduction ? "yes" : "no"}
- Cache performance claimability: no
- Provider billing savings claimability: no

## Run table

| Run | conservative context reduction minPct | reuse correctness claimable | over-caching verdict | bug reproduced |
| --- | ---: | --- | --- | --- |
${runRows}

## Metric provenance

- \`actualInjectedContextReduction\`: ${evidence.metricProvenance.actualInjectedContextReduction.formula}
- \`repeatRunActualInjectedContextReductionMinPct\`: ${evidence.metricProvenance.repeatRunActualInjectedContextReductionMinPct.formula}
- Conservative aggregation: ${evidence.metricProvenance.repeatRunActualInjectedContextReductionMinPct.aggregation}
- Not comparable to: ${evidence.metricProvenance.repeatRunActualInjectedContextReductionMinPct.notComparableTo.join(", ")}

## Warnings

${warnings}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const repeat = parseRepeat(process.argv.slice(2));
  const evidence = await buildReactWebStabilityEvidence({ repoRoot: defaultRepoRoot, runId, repeat });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebStabilityEvidenceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
