import test from "node:test";
import assert from "node:assert/strict";
import {
  assertReleaseBenchmarkSmokeGate,
  buildReleaseBenchmarkEvidence,
  buildReleaseBenchmarkSmokeSummary,
  renderReleaseBenchmarkEvidenceMarkdown,
} from "../scripts/release-benchmark-evidence.mjs";

test("release benchmark evidence gates npm wording on actual injected context and reuse correctness", async () => {
  const evidence = await buildReleaseBenchmarkEvidence({ runId: `test-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.schemaVersion, "release-benchmark-evidence.v1");
  assert.equal(evidence.measurement, "release-facing-local-evidence-summary");
  assert.match(evidence.claimBoundary, /Release-facing local evidence summary only/);
  assert.match(evidence.claimBoundary, /not provider tokenizer output/);
  assert.match(evidence.claimBoundary, /not runtime-token savings/);
  assert.match(evidence.claimBoundary, /not wall-clock cache performance/);
  assert.match(evidence.claimBoundary, /not provider cost, billing, invoice, or charged-cost evidence/);

  assert.equal(evidence.releaseClaims.npmUpdateClaimable, true);
  assert.match(evidence.releaseClaims.headline, /React Web same-file reuse is routed correctly/);
  assert.match(evidence.releaseClaims.headline, /smaller actual injected additionalContext/);
  assert.ok(
    evidence.releaseClaims.allowed.some((claim) => /smaller actual injected additionalContext/.test(claim)),
  );

  assert.equal(evidence.context.allReactWebInjects, true);
  assert.equal(evidence.context.actualInjectedContextReduction.claimable, true);
  assert.equal(evidence.context.actualInjectedContextReduction.blocker, null);
  assert.ok(evidence.context.actualInjectedContextReduction.minPct > 0);
  assert.ok(evidence.context.actualInjectedContextReduction.maxPct > 70);
  assert.equal(evidence.context.domainPayloadReduction.claimable, true);
  assert.equal(evidence.context.domainPayloadReduction.diagnosticOnly, true);
  assert.ok(evidence.context.domainPayloadReduction.minPct > 30);
  assert.ok(evidence.context.domainPayloadReduction.maxPct > 70);
  assert.equal(evidence.context.fullRuntimePayloadReduction.claimable, false);
  assert.match(evidence.context.fullRuntimePayloadReduction.blocker, /not smaller than source for every fixture/);
  assert.equal(evidence.context.preReadGraphDiagnostics.diagnosticOnly, true);
  assert.equal(evidence.context.preReadGraphDiagnostics.claimable, false);
  assert.ok(evidence.context.preReadGraphDiagnostics.emittedCount > 0);
  assert.equal(evidence.context.runtimeGraphDiagnostics.diagnosticOnly, true);
  assert.equal(evidence.context.runtimeGraphDiagnostics.claimable, false);
  assert.ok(evidence.context.runtimeGraphDiagnostics.emittedCount > 0);
  assert.equal(evidence.context.runtimeGraphDiagnostics.reasonCounts["fresh-anchors-packed"] > 0, true);
  assert.equal(evidence.context.graphAssistedContextPath.diagnosticOnly, true);
  assert.equal(evidence.context.graphAssistedContextPath.claimable, false);
  assert.ok(evidence.context.graphAssistedContextPath.correlatedFreshPathCount > 0);

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
  assert.equal(evidence.releaseProvenance.schemaVersion, "release-provenance.v1");
  assert.equal(evidence.releaseProvenance.package.expectedVersionTag, `v${evidence.releaseProvenance.package.version}`);
  assert.match(evidence.releaseProvenance.claimBoundary, /Release provenance only/);
  assert.ok(evidence.releaseClaims.forbidden.includes("Caching performance improved."));
  assert.ok(evidence.releaseClaims.forbidden.includes("Provider cost or billing is reduced."));
  assert.ok(evidence.releaseClaims.forbidden.includes("Diagnostic domainPayload reduction proves runtime-token savings."));
});

test("release benchmark smoke summary exposes only release-safe compact evidence", async () => {
  const evidence = await buildReleaseBenchmarkEvidence({ runId: `smoke-summary-test-${Date.now()}-${Math.random()}` });
  const summary = buildReleaseBenchmarkSmokeSummary(evidence);

  assert.equal(summary.npmUpdateClaimable, true);
  assert.match(summary.headline, /React Web same-file reuse is routed correctly/);
  assert.match(summary.headline, /actual injected additionalContext/);
  assert.equal(summary.actualInjectedContextReduction.claimable, true);
  assert.ok(summary.actualInjectedContextReduction.minPct > 0);
  assert.ok(summary.actualInjectedContextReduction.maxPct > 70);
  assert.equal(summary.reuseCorrectnessClaimable, true);
  assert.equal(summary.preReadGraphDiagnostics.diagnosticOnly, true);
  assert.equal(summary.preReadGraphDiagnostics.claimable, false);
  assert.equal(summary.runtimeGraphDiagnostics.diagnosticOnly, true);
  assert.equal(summary.runtimeGraphDiagnostics.claimable, false);
  assert.ok(summary.runtimeGraphDiagnostics.emittedCount > 0);
  assert.equal(summary.graphAssistedContextPath.diagnosticOnly, true);
  assert.equal(summary.graphAssistedContextPath.claimable, false);
  assert.ok(summary.graphAssistedContextPath.correlatedFreshPathCount > 0);
  assert.deepEqual(summary.nonClaims, {
    cachePerformanceImprovement: false,
    runtimeTokenSavings: false,
    providerBillingSavings: false,
  });
  assert.match(summary.claimBoundary, /not provider tokenizer output/);
  assert.match(summary.claimBoundary, /not runtime-token savings/);
  assert.match(summary.claimBoundary, /not provider cost, billing, invoice, or charged-cost evidence/);
  assert.equal(summary.releaseProvenance.package.expectedVersionTag, `v${summary.releaseProvenance.package.version}`);
  assert.match(summary.releaseProvenance.claimBoundary, /Release provenance only/);
});

test("release benchmark smoke gate fails closed when npm update wording is not claimable", () => {
  const evidence = {
    releaseClaims: {
      npmUpdateClaimable: false,
    },
    context: {
      actualInjectedContextReduction: {
        blocker: "fixture additionalContext is larger than source",
      },
    },
    reuse: {
      reuseCorrectnessClaimable: false,
    },
  };

  assert.throws(
    () => assertReleaseBenchmarkSmokeGate(evidence),
    /release benchmark gate failed: npm update wording is not claimable; actual injected context blocker: fixture additionalContext is larger than source; reuse correctness is not claimable/,
  );
});

test("release benchmark evidence Markdown gives safe public wording and explicit non-claims", async () => {
  const evidence = await buildReleaseBenchmarkEvidence({ runId: `markdown-test-${Date.now()}-${Math.random()}` });
  const markdown = renderReleaseBenchmarkEvidenceMarkdown(evidence);

  assert.match(markdown, /Release-safe headline/);
  assert.match(markdown, /npm update wording claimable: yes/);
  assert.match(markdown, /React Web actual injected context reduction: yes/);
  assert.match(markdown, /React Web domainPayload reduction diagnostic-only: yes/);
  assert.match(markdown, /React Web pre-read graph diagnostics:/);
  assert.match(markdown, /React Web runtime graph diagnostics:/);
  assert.match(markdown, /React Web graph-assisted context path:/);
  assert.match(markdown, /React Web reuse correctness: yes/);
  assert.match(markdown, /Cache performance improvement: no/);
  assert.match(markdown, /Runtime-token savings: no/);
  assert.match(markdown, /Provider billing\/cost savings: no/);
  assert.match(markdown, /Release provenance/);
  assert.match(markdown, /Expected tag:/);
  assert.match(markdown, /Actual injected runtime context always smaller than source without fixture evidence: no/);
  assert.match(markdown, /Diagnostic domainPayload reduction proves runtime-token savings: no/);
  assert.doesNotMatch(markdown, /Cache performance improvement: yes/i);
  assert.doesNotMatch(markdown, /Runtime-token savings: yes/i);
  assert.doesNotMatch(markdown, /Provider billing\/cost savings: yes/i);
});
