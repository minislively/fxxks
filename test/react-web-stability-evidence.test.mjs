import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReactWebStabilityEvidence,
  renderReactWebStabilityEvidenceMarkdown,
} from "../scripts/react-web-stability-evidence.mjs";

test("React Web stability evidence reports repeated-run conservative stats with locked claimability", async () => {
  const evidence = await buildReactWebStabilityEvidence({
    repeat: 2,
    runId: `test-${Date.now()}-${Math.random()}`,
  });

  assert.equal(evidence.schemaVersion, "react-web-stability-evidence.v1");
  assert.equal(evidence.measurement, "repeat-run-react-web-evidence-stability");
  assert.equal(evidence.repeat, 2);
  assert.match(evidence.claimBoundary, /Repeat-run local React Web evidence only/);
  assert.match(evidence.claimBoundary, /not wall-clock performance/);
  assert.match(evidence.claimBoundary, /not runtime-token savings/);
  assert.match(evidence.claimBoundary, /not provider cost, billing, invoice, or charged-cost evidence/);

  assert.deepEqual(evidence.claimability, {
    contextReduction: true,
    cachePerformance: false,
    providerBillingSavings: false,
  });

  assert.equal(evidence.metricProvenance.actualInjectedContextReduction.metric, "actualInjectedContextReduction");
  assert.equal(evidence.metricProvenance.repeatRunActualInjectedContextReductionMinPct.metric, "repeatRunActualInjectedContextReductionMinPct");
  assert.equal(evidence.metricProvenance.repeatRunActualInjectedContextReductionMinPct.conservative, true);
  assert.match(
    evidence.metricProvenance.repeatRunActualInjectedContextReductionMinPct.aggregation,
    /conservative suite minimum/,
  );
  assert.ok(
    evidence.metricProvenance.repeatRunActualInjectedContextReductionMinPct.notComparableTo.includes("runtimeTokenSavings"),
  );

  assert.equal(evidence.runs.length, 2);
  for (const run of evidence.runs) {
    assert.equal(run.primaryMetric.metric, "repeatRunActualInjectedContextReductionMinPct");
    assert.equal(typeof run.primaryMetric.valuePct, "number");
    assert.equal(run.contextEvidence.actualInjectedContextReduction.claimable, true);
    assert.equal(run.reuseEvidence.reuseCorrectnessClaimable, true);
    assert.equal(run.overCachingAudit.verdict, "no-repro");
  }

  assert.equal(evidence.summary.primaryMetric.metric, "repeatRunActualInjectedContextReductionMinPct");
  assert.ok(evidence.summary.primaryMetric.minObservedPct > 0);
  assert.ok(evidence.summary.primaryMetric.maxObservedPct >= evidence.summary.primaryMetric.minObservedPct);
  assert.equal(typeof evidence.summary.primaryMetric.meanPct, "number");
  assert.equal(typeof evidence.summary.primaryMetric.stddevPct, "number");
  assert.equal(typeof evidence.summary.primaryMetric.coefficientOfVariationPct, "number");
  assert.equal(typeof evidence.summary.primaryMetric.stable, "boolean");
  assert.equal(evidence.summary.contextReductionEvidenceClaimableAcrossRuns, true);
  assert.equal(evidence.summary.allReactWebInjectsAcrossRuns, true);
  assert.equal(evidence.summary.reuseCorrectness.consistent, true);
  assert.equal(evidence.summary.reuseCorrectness.claimableAcrossRuns, true);
  assert.deepEqual(evidence.summary.reuseCorrectness.values, [true, true]);
  assert.equal(evidence.summary.overCachingAudit.stable, true);
  assert.deepEqual(
    evidence.summary.overCachingAudit.verdictNames,
    ["react-web-small-edit-refresh-no-repro", "react-web-small-edit-refresh-no-repro"],
  );
  assert.equal(evidence.summary.overCachingAudit.noReproAcrossRuns, true);
});

test("React Web stability evidence markdown keeps warning/report boundaries explicit", async () => {
  const evidence = await buildReactWebStabilityEvidence({
    repeat: 2,
    runId: `markdown-test-${Date.now()}-${Math.random()}`,
  });
  const markdown = renderReactWebStabilityEvidenceMarkdown(evidence);

  assert.match(markdown, /Repeat count: 2/);
  assert.match(markdown, /Primary metric: repeatRunActualInjectedContextReductionMinPct/);
  assert.match(markdown, /Cache performance claimability: no/);
  assert.match(markdown, /Provider billing savings claimability: no/);
  assert.match(markdown, /Metric provenance/);
  assert.match(markdown, /perRunValue = min\(fixtures\[\]\.additionalContextReductionPct\)/);
  assert.match(markdown, /Conservative aggregation:/);
  assert.match(markdown, /Warnings/);
  assert.doesNotMatch(markdown, /Cache performance claimability: yes/i);
  assert.doesNotMatch(markdown, /Provider billing savings claimability: yes/i);
});
