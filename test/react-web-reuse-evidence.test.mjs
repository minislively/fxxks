import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReactWebReuseEvidence,
  renderReactWebReuseEvidenceMarkdown,
} from "../scripts/react-web-reuse-evidence.mjs";

test("React Web reuse evidence proves routing correctness without performance or billing claims", async () => {
  const evidence = await buildReactWebReuseEvidence({ runId: "test" });

  assert.equal(evidence.schemaVersion, "react-web-reuse-evidence.v1");
  assert.equal(evidence.measurement, "codex-runtime-hook-local-reuse-decisions");
  assert.match(evidence.claimBoundary, /same-file React Web reuse routing/);
  assert.match(evidence.claimBoundary, /source-change refresh detection/);
  assert.match(evidence.claimBoundary, /unsupported-domain fallback boundaries/);
  assert.match(evidence.claimBoundary, /not wall-clock cache performance/);
  assert.match(evidence.claimBoundary, /not.*provider cost, billing, invoice, or charged-cost evidence/);

  assert.equal(evidence.checks.sameFileReactWebReuse.claimable, true);
  assert.equal(evidence.checks.sameFileReactWebReuse.firstAction, "record");
  assert.equal(evidence.checks.sameFileReactWebReuse.secondAction, "inject");
  assert.deepEqual(evidence.checks.sameFileReactWebReuse.secondReasons, ["repeated-file"]);
  assert.equal(evidence.checks.sameFileReactWebReuse.domain, "react-web");
  assert.equal(evidence.checks.sameFileReactWebReuse.claimBoundary, "react-web-measured-extraction");

  assert.equal(evidence.checks.sourceChangeRefresh.claimable, true);
  assert.equal(evidence.checks.sourceChangeRefresh.action, "inject");
  assert.ok(evidence.checks.sourceChangeRefresh.reasons.includes("refreshed-before-attach"));
  assert.equal(evidence.checks.sourceChangeRefresh.stalePayloadReused, false);
  assert.notEqual(
    evidence.checks.sourceChangeRefresh.beforeFingerprint.fileHash,
    evidence.checks.sourceChangeRefresh.afterFingerprint.fileHash,
  );
  assert.notEqual(
    evidence.checks.sourceChangeRefresh.beforeFingerprint.lineCount,
    evidence.checks.sourceChangeRefresh.afterFingerprint.lineCount,
  );

  assert.equal(evidence.checks.unsupportedDomainFallbacks.claimable, true);
  assert.equal(evidence.checks.unsupportedDomainFallbacks.webview.secondAction, "fallback");
  assert.equal(evidence.checks.unsupportedDomainFallbacks.webview.fallbackReason, "unsupported-react-native-webview-boundary");
  assert.equal(evidence.checks.unsupportedDomainFallbacks.webview.classification, "webview");
  assert.equal(evidence.checks.unsupportedDomainFallbacks.webview.payloadInjected, false);
  assert.equal(evidence.checks.unsupportedDomainFallbacks.reactNative.secondAction, "fallback");
  assert.equal(evidence.checks.unsupportedDomainFallbacks.reactNative.fallbackReason, "unsupported-frontend-domain-profile");
  assert.equal(evidence.checks.unsupportedDomainFallbacks.reactNative.classification, "react-native");
  assert.equal(evidence.checks.unsupportedDomainFallbacks.reactNative.payloadInjected, false);

  assert.equal(evidence.summary.reuseCorrectnessClaimable, true);
  assert.equal(evidence.summary.cachePerformanceImprovement.claimable, false);
  assert.match(evidence.summary.cachePerformanceImprovement.blocker, /not wall-clock latency, cache hit rate, or end-to-end runtime performance/);
  assert.equal(evidence.summary.providerBillingSavings.claimable, false);
  assert.match(evidence.summary.providerBillingSavings.blocker, /no provider usage, tokenizer, billing dashboard, invoice, or charged-cost data/);
});

test("React Web reuse evidence Markdown keeps claim boundaries explicit", async () => {
  const evidence = await buildReactWebReuseEvidence({ runId: "markdown-test" });
  const markdown = renderReactWebReuseEvidenceMarkdown(evidence);

  assert.match(markdown, /Same-file React Web reuse routing claimable: yes/);
  assert.match(markdown, /Source-change refresh detection claimable: yes/);
  assert.match(markdown, /Unsupported-domain fallback boundaries claimable: yes/);
  assert.match(markdown, /Overall reuse correctness claimable: yes/);
  assert.match(markdown, /Cache performance improvement claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /does not support wall-clock cache-performance, runtime-token, provider-cost, billing, invoice, or charged-cost claims/);
  assert.doesNotMatch(markdown, /cache performance improvement claimable: yes/i);
  assert.doesNotMatch(markdown, /provider billing savings claimable: yes/i);
});
