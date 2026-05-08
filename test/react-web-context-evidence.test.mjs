import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReactWebContextEvidence,
  renderReactWebContextEvidenceMarkdown,
} from "../scripts/react-web-context-evidence.mjs";

test("React Web context evidence measures actual injected additionalContext without broad savings claims", async () => {
  const evidence = await buildReactWebContextEvidence({ runId: `test-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.schemaVersion, "react-web-context-evidence.v2");
  assert.equal(evidence.measurement, "local-source-bytes-vs-host-facing-additional-context-bytes");
  assert.match(evidence.claimBoundary, /not provider tokenizer output/);
  assert.match(evidence.claimBoundary, /not runtime-token savings/);
  assert.match(evidence.claimBoundary, /not cache performance/);
  assert.match(evidence.claimBoundary, /not provider billing or invoice savings/);
  assert.equal(evidence.metricProvenance.actualInjectedContextReduction.metric, "actualInjectedContextReduction");
  assert.equal(evidence.metricProvenance.actualInjectedContextReduction.unit, "percent");
  assert.equal(evidence.metricProvenance.actualInjectedContextReduction.numerator, "sourceBytes - additionalContextBytes");
  assert.equal(evidence.metricProvenance.actualInjectedContextReduction.denominator, "sourceBytes");
  assert.ok(evidence.metricProvenance.actualInjectedContextReduction.notComparableTo.includes("cacheHitRate"));
  assert.ok(evidence.metricProvenance.actualInjectedContextReduction.notComparableTo.includes("providerBillingSavings"));

  assert.equal(evidence.summary.fixtureCount, 5);
  assert.equal(evidence.summary.allReactWebInjects, true);
  assert.equal(evidence.summary.actualInjectedContextReduction.claimable, true);
  assert.equal(evidence.summary.actualInjectedContextReduction.blocker, null);
  assert.ok(evidence.summary.actualInjectedContextReduction.minPct > 0);
  assert.ok(evidence.summary.actualInjectedContextReduction.maxPct > 70);
  assert.ok(
    evidence.fixtures.every((row) => !row.additionalContextLargerThanSource),
    "optimized host-facing additionalContext should be smaller than source for every measured fixture",
  );
  assert.ok(
    evidence.fixtures.some((row) => row.additionalContextBytes < row.runtimePayloadBytes),
    "actual injected context should use the optimized runtime envelope rather than full internal payload JSON",
  );

  assert.equal(evidence.summary.domainPayloadReduction.claimable, true);
  assert.equal(evidence.summary.domainPayloadReduction.diagnosticOnly, true);
  assert.ok(evidence.summary.domainPayloadReduction.minPct > 25);

  assert.equal(evidence.summary.fullRuntimePayloadReduction.claimable, false);
  assert.match(evidence.summary.fullRuntimePayloadReduction.blocker, /not smaller than source for every fixture/);
  assert.ok(
    evidence.fixtures.some((row) => row.runtimePayloadLargerThanSource),
    "evidence must keep the full-runtime-payload non-claim visible",
  );
  assert.ok(
    evidence.fixtures.some((row) => row.runtimePayloadReductionPct > 0),
    "evidence should preserve the partial full-payload reduction signal for larger fixtures",
  );

  assert.equal(evidence.summary.cachePerformanceImprovement.claimable, false);
  assert.match(evidence.summary.cachePerformanceImprovement.blocker, /no wall-clock, cache-hit-rate, or end-to-end runtime benchmark/);
  assert.equal(evidence.summary.providerBillingSavings.claimable, false);
  assert.match(evidence.summary.providerBillingSavings.blocker, /no provider usage, billing dashboard, invoice, or charged-cost data/);

  for (const row of evidence.fixtures) {
    assert.equal(row.firstAction, "record");
    assert.equal(row.secondAction, "inject");
    assert.equal(row.decision, "payload");
    assert.equal(row.classification, "react-web");
    assert.ok(row.additionalContextBytes > 0);
    assert.equal(typeof row.additionalContextReductionPct, "number");
    assert.equal(row.domainPayloadLargerThanSource, false);
    assert.equal(row.claimBoundary, "react-web-measured-extraction");
    assert.equal(row.claimStatus, "current-supported-lane");
  }
});

test("React Web context evidence Markdown keeps the public claim boundary explicit", async () => {
  const evidence = await buildReactWebContextEvidence({ runId: `markdown-test-${Date.now()}-${Math.random()}` });
  const markdown = renderReactWebContextEvidenceMarkdown(evidence);

  assert.match(markdown, /Actual injected context reduction claimable: yes/);
  assert.match(markdown, /Domain payload reduction diagnostic-only: yes/);
  assert.match(markdown, /Internal runtime payload reduction diagnostic-only: no/);
  assert.match(markdown, /Cache performance improvement claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /Metric provenance/);
  assert.match(markdown, /sourceBytes - additionalContextBytes/);
  assert.match(markdown, /Not comparable to: wallClockSpeedup, cacheHitRate, runtimeTokenSavings, providerBillingSavings/);
  assert.match(markdown, /domainPayload metric is diagnostic-only/);
  assert.match(markdown, /does not support broad runtime-token, latency, cache-performance, provider-cost, billing, invoice, or charged-cost claims/);
  assert.doesNotMatch(markdown, /provider billing savings claimable: yes/i);
  assert.doesNotMatch(markdown, /cache performance improvement claimable: yes/i);
});
