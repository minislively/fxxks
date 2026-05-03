import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReactWebContextEvidence,
  renderReactWebContextEvidenceMarkdown,
} from "../scripts/react-web-context-evidence.mjs";

test("React Web context evidence proves bounded domainPayload reduction without broad savings claims", async () => {
  const evidence = await buildReactWebContextEvidence({ runId: "test" });

  assert.equal(evidence.schemaVersion, "react-web-context-evidence.v1");
  assert.equal(evidence.measurement, "local-source-bytes-vs-runtime-json-bytes");
  assert.match(evidence.claimBoundary, /not provider tokenizer output/);
  assert.match(evidence.claimBoundary, /not runtime-token savings/);
  assert.match(evidence.claimBoundary, /not cache performance/);
  assert.match(evidence.claimBoundary, /not provider billing or invoice savings/);

  assert.equal(evidence.summary.fixtureCount, 5);
  assert.equal(evidence.summary.allReactWebInjects, true);
  assert.equal(evidence.summary.domainPayloadReduction.claimable, true);
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
    assert.equal(row.domainPayloadLargerThanSource, false);
    assert.equal(row.claimBoundary, "react-web-measured-extraction");
    assert.equal(row.claimStatus, "current-supported-lane");
  }
});

test("React Web context evidence Markdown keeps the public claim boundary explicit", async () => {
  const evidence = await buildReactWebContextEvidence({ runId: "markdown-test" });
  const markdown = renderReactWebContextEvidenceMarkdown(evidence);

  assert.match(markdown, /Domain payload reduction claimable: yes/);
  assert.match(markdown, /Full runtime payload reduction claimable: no/);
  assert.match(markdown, /Cache performance improvement claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /does not support broad runtime-token, latency, cache-performance, provider-cost, billing, invoice, or charged-cost claims/);
  assert.doesNotMatch(markdown, /provider billing savings claimable: yes/i);
  assert.doesNotMatch(markdown, /cache performance improvement claimable: yes/i);
});
