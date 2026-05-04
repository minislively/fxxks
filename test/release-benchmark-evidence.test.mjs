import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReleaseBenchmarkEvidence,
  renderReleaseBenchmarkEvidenceMarkdown,
} from "../scripts/release-benchmark-evidence.mjs";

test("release benchmark evidence combines context reduction and reuse correctness for npm wording", async () => {
  const evidence = await buildReleaseBenchmarkEvidence({ runId: "test" });

  assert.equal(evidence.schemaVersion, "release-benchmark-evidence.v1");
  assert.equal(evidence.measurement, "release-facing-local-evidence-summary");
  assert.match(evidence.claimBoundary, /Release-facing local evidence summary only/);
  assert.match(evidence.claimBoundary, /not provider tokenizer output/);
  assert.match(evidence.claimBoundary, /not runtime-token savings/);
  assert.match(evidence.claimBoundary, /not wall-clock cache performance/);
  assert.match(evidence.claimBoundary, /not provider cost, billing, invoice, or charged-cost evidence/);

  assert.equal(evidence.releaseClaims.npmUpdateClaimable, true);
  assert.match(evidence.releaseClaims.headline, /React Web same-file reuse is routed correctly/);
  assert.match(evidence.releaseClaims.headline, /30\.\d+% to 77\.\d+% smaller source-derived domainPayloads/);

  assert.equal(evidence.context.allReactWebInjects, true);
  assert.equal(evidence.context.domainPayloadReduction.claimable, true);
  assert.ok(evidence.context.domainPayloadReduction.minPct > 30);
  assert.ok(evidence.context.domainPayloadReduction.maxPct > 70);
  assert.equal(evidence.context.fullRuntimePayloadReduction.claimable, false);
  assert.match(evidence.context.fullRuntimePayloadReduction.blocker, /not smaller than source for every fixture/);

  assert.equal(evidence.reuse.reuseCorrectnessClaimable, true);
  assert.equal(evidence.reuse.sameFileReactWebReuse.firstAction, "record");
  assert.equal(evidence.reuse.sameFileReactWebReuse.secondAction, "inject");
  assert.equal(evidence.reuse.sourceChangeRefresh.stalePayloadReused, false);
  assert.ok(evidence.reuse.sourceChangeRefresh.reasons.includes("refreshed-before-attach"));
  assert.equal(evidence.reuse.unsupportedDomainFallbacks.webview.secondAction, "fallback");
  assert.equal(evidence.reuse.unsupportedDomainFallbacks.reactNative.secondAction, "fallback");

  assert.equal(evidence.nonClaims.cachePerformanceImprovement.claimable, false);
  assert.equal(evidence.nonClaims.runtimeTokenSavings.claimable, false);
  assert.equal(evidence.nonClaims.providerBillingSavings.claimable, false);
  assert.ok(evidence.releaseClaims.forbidden.includes("Caching performance improved."));
  assert.ok(evidence.releaseClaims.forbidden.includes("Provider cost or billing is reduced."));
});

test("release benchmark evidence Markdown gives safe public wording and explicit non-claims", async () => {
  const evidence = await buildReleaseBenchmarkEvidence({ runId: "markdown-test" });
  const markdown = renderReleaseBenchmarkEvidenceMarkdown(evidence);

  assert.match(markdown, /Release-safe headline/);
  assert.match(markdown, /npm update wording claimable: yes/);
  assert.match(markdown, /React Web context reduction: yes/);
  assert.match(markdown, /React Web reuse correctness: yes/);
  assert.match(markdown, /Cache performance improvement: no/);
  assert.match(markdown, /Runtime-token savings: no/);
  assert.match(markdown, /Provider billing\/cost savings: no/);
  assert.match(markdown, /Full runtime payloads always smaller than source: no/);
  assert.doesNotMatch(markdown, /Cache performance improvement: yes/i);
  assert.doesNotMatch(markdown, /Runtime-token savings: yes/i);
  assert.doesNotMatch(markdown, /Provider billing\/cost savings: yes/i);
});
