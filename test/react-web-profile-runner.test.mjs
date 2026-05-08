import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReactWebProfileRunnerEvidence,
  renderReactWebProfileRunnerMarkdown,
} from "../scripts/react-web-profile-runner.mjs";
import { runBenchProfile } from "../scripts/bench-profile.mjs";

test("React Web profile runner aggregates exactly four approved artifacts with locked claimability", async () => {
  const evidence = await buildReactWebProfileRunnerEvidence({
    repeat: 2,
    runId: `profile-test-${Date.now()}-${Math.random()}`,
  });

  assert.equal(evidence.schemaVersion, "react-web-profile-runner.v1");
  assert.equal(evidence.profile, "react-web");
  assert.equal(evidence.measurement, "react-web-evidence-profile-aggregation");
  assert.match(evidence.claimBoundary, /Local React Web evidence aggregation only/);
  assert.match(evidence.claimBoundary, /not benchmark\/profiler semantics/);
  assert.match(evidence.claimBoundary, /not wall-clock performance proof/);
  assert.match(evidence.claimBoundary, /not runtime-token savings proof/);
  assert.match(evidence.claimBoundary, /not provider cost, billing, invoice, or charged-cost evidence/);

  assert.deepEqual(evidence.claimability, {
    contextReduction: true,
    cachePerformance: false,
    providerBillingSavings: false,
  });

  assert.deepEqual(Object.keys(evidence.artifacts), ["context", "reuse", "overCachingAudit", "stability"]);
  assert.equal(evidence.artifacts.context.schemaVersion, "react-web-context-evidence.v2");
  assert.equal(evidence.artifacts.reuse.schemaVersion, "react-web-reuse-evidence.v1");
  assert.equal(evidence.artifacts.overCachingAudit.schemaVersion, "react-web-over-caching-audit.v1");
  assert.equal(evidence.artifacts.stability.schemaVersion, "react-web-stability-evidence.v1");

  assert.equal(evidence.summary.contextReductionClaimable, true);
  assert.equal(evidence.summary.reuseCorrectnessClaimable, true);
  assert.equal(evidence.summary.overCachingNoRepro, true);
  assert.equal(typeof evidence.summary.stabilityStable, "boolean");
  assert.equal(evidence.summary.primaryMetric.metric, "repeatRunActualInjectedContextReductionMinPct");
  assert.deepEqual(evidence.summary.warnings, evidence.artifacts.stability.summary.warnings);

  assert.ok(evidence.artifacts.reuse.checks.unsupportedDomainFallbacks.webview);
  assert.ok(evidence.artifacts.reuse.checks.unsupportedDomainFallbacks.reactNative);
  assert.equal("rn" in evidence.artifacts, false);
  assert.equal("tui" in evidence.artifacts, false);
  assert.equal("mixedRouting" in evidence.artifacts, false);
  assert.equal("knowledgeContext" in evidence.artifacts, false);
  assert.equal("fixturesExpanded" in evidence.artifacts, false);
});

test("React Web profile runner markdown keeps evidence-only boundary language", async () => {
  const evidence = await buildReactWebProfileRunnerEvidence({
    repeat: 2,
    runId: `profile-markdown-${Date.now()}-${Math.random()}`,
  });
  const markdown = renderReactWebProfileRunnerMarkdown(evidence);

  assert.match(markdown, /React Web profile runner/);
  assert.match(markdown, /Local React Web evidence aggregation only/);
  assert.match(markdown, /not benchmark\/profiler semantics/);
  assert.match(markdown, /Cache performance claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /context: react-web-context-evidence\.v2/);
  assert.match(markdown, /reuse: react-web-reuse-evidence\.v1/);
  assert.match(markdown, /overCachingAudit: react-web-over-caching-audit\.v1/);
  assert.match(markdown, /stability: react-web-stability-evidence\.v1/);
});

test("Bench profile dispatch is fail-closed and profile runner composes builders directly", async () => {
  const benchSource = fs.readFileSync(new URL("../scripts/bench-profile.mjs", import.meta.url), "utf8");
  const runnerSource = fs.readFileSync(new URL("../scripts/react-web-profile-runner.mjs", import.meta.url), "utf8");

  assert.match(benchSource, /SUPPORTED_PROFILES = Object\.freeze\(\["react-web"\]\)/);
  assert.doesNotMatch(benchSource, /benchmarks\/scripts\/profiler\.mjs/);
  assert.doesNotMatch(benchSource, /execFileSync|spawn|npm run/);

  assert.match(runnerSource, /buildReactWebContextEvidence/);
  assert.match(runnerSource, /buildReactWebReuseEvidence/);
  assert.match(runnerSource, /buildReactWebOverCachingAuditEvidence/);
  assert.match(runnerSource, /buildReactWebStabilityEvidence/);
  assert.doesNotMatch(runnerSource, /execFileSync|spawn|npm run/);

  await assert.rejects(
    () => runBenchProfile({ argv: ["rn"] }),
    /unsupported profile 'rn'; supported profiles: react-web/,
  );
  await assert.rejects(
    () => runBenchProfile({ argv: ["mixed-routing"] }),
    /unsupported profile 'mixed-routing'; supported profiles: react-web/,
  );
});
