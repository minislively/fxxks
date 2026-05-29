import test from "node:test";
import assert from "node:assert/strict";
import {
  REACT_WEB_LIVE_HOOK_DOGFOOD_SCHEMA_VERSION,
  DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES,
  buildReactWebLiveHookDogfoodEvidence,
  renderReactWebLiveHookDogfoodEvidenceMarkdown,
} from "../scripts/react-web-live-hook-dogfood-evidence.mjs";

test("React Web live hook dogfood evidence replays built CLI native hook graph path", async () => {
  const evidence = await buildReactWebLiveHookDogfoodEvidence({ runId: `test-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.schemaVersion, REACT_WEB_LIVE_HOOK_DOGFOOD_SCHEMA_VERSION);
  assert.equal(evidence.measurement, "built-cli-native-hook-dogfood-replay");
  assert.equal(evidence.isolatedReplay.attached, true);
  assert.equal(evidence.isolatedReplay.globalSettingsMutated, false);
  assert.equal(evidence.isolatedReplay.attachRuntimeProofStatus, "passed");
  assert.ok(evidence.commands.some((command) => command.name === "codex-pre-read"));
  assert.ok(evidence.commands.some((command) => command.name === "native-hook-success-second"));

  assert.equal(evidence.success.prompts.editIntent, true);
  assert.match(evidence.success.prompts.first, /update/);
  assert.match(evidence.success.prompts.second, /Again, update/);
  assert.equal(evidence.success.preReadGraphDiagnostics.diagnosticOnly, true);
  assert.equal(evidence.success.preReadGraphDiagnostics.claimable, false);
  assert.equal(evidence.success.preReadGraphDiagnostics.classification, "react-web");
  assert.equal(evidence.success.preReadGraphDiagnostics.freshnessStatus, "fresh");
  assert.ok(evidence.success.preReadGraphDiagnostics.selectedAnchorCount > 0);

  assert.equal(evidence.success.firstNative.emitted, false);
  assert.equal(evidence.success.firstNative.hasAdditionalContext, false);
  assert.equal(evidence.success.secondNative.emitted, true);
  assert.equal(evidence.success.secondNative.hookEventName, "UserPromptSubmit");
  assert.equal(evidence.success.secondNative.hasAdditionalContext, true);
  assert.equal(typeof evidence.success.secondNative.containsReactWebFactGraph, "boolean");
  assert.match(evidence.success.secondNative.firstLine, /fooks: (reused pre-read \(compressed\)|fallback \(additional-context-compression-inefficient\))/);

  assert.equal(evidence.success.evidenceArtifact.exists, true);
  assert.equal(evidence.success.evidenceArtifact.filePath, evidence.success.targetFile);
  assert.equal(evidence.success.evidenceArtifact.filePathMatchesTarget, true);
  assert.ok(["use", "fallback"].includes(evidence.success.evidenceArtifact.decision));
  assert.equal(evidence.success.evidenceArtifact.additionalContextAdmission.diagnosticOnly, true);
  assert.equal(typeof evidence.success.evidenceArtifact.additionalContextAdmission.admitted, "boolean");
  assert.equal(evidence.success.evidenceArtifact.runtimeGraph.diagnosticOnly, true);
  assert.equal(typeof evidence.success.evidenceArtifact.runtimeGraph.included, "boolean");
  assert.ok(["fresh-anchors-packed", "source-relative-budget-exceeded"].includes(evidence.success.evidenceArtifact.runtimeGraph.reason));
  assert.equal(evidence.success.evidenceArtifact.runtimeGraph.freshnessStatus, "fresh");
  assert.ok(evidence.success.evidenceArtifact.runtimeGraph.selectedAnchorCount > 0);

  assert.equal(evidence.suite.diagnosticOnly, true);
  assert.match(evidence.suite.claimBoundary, /not provider tokenizer output/);
  assert.equal(evidence.suite.summary.measurement, "built-cli-native-hook-fixture-matrix-additional-context-bytes");
  assert.equal(evidence.suite.summary.diagnosticOnly, true);
  assert.equal(evidence.suite.summary.fixtureCount, DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.length);
  assert.equal(evidence.suite.summary.graphDiagnosticCount, DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.length);
  assert.equal(typeof evidence.suite.summary.graphIncludedCount, "number");
  assert.ok(evidence.suite.summary.runtimeGraphIncludedArtifactCount > 0);
  assert.equal(typeof evidence.suite.summary.graphSkippedForBudgetCount, "number");
  assert.equal(evidence.suite.summary.firstPromptEmptyCount, DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.length);
  assert.equal(evidence.suite.summary.artifactIdentityMatchCount, DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.length);
  assert.equal(evidence.suite.summary.claimable, false);
  assert.equal(evidence.suite.summary.allFreshGraphs, true);
  assert.equal(evidence.suite.summary.admissionObservedCount, DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.length);
  assert.ok(evidence.suite.summary.admittedAdditionalContextCount > 0);
  assert.ok(evidence.suite.summary.compactRowsCount > 0);
  assert.equal(typeof evidence.suite.summary.minAdditionalContextReductionPct, "number");
  assert.equal(typeof evidence.suite.summary.maxAdditionalContextReductionPct, "number");
  assert.deepEqual(evidence.suite.fixtures.map((row) => row.file), DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES);
  for (const row of evidence.suite.fixtures) {
    assert.equal(row.diagnosticOnly, true);
    assert.equal(row.claimable, false);
    assert.equal(row.firstNative.emitted, false);
    assert.equal(typeof row.secondNative.containsReactWebFactGraph, "boolean");
    assert.equal(row.preReadGraphDiagnostics.classification, "react-web");
    assert.equal(row.preReadGraphDiagnostics.freshnessStatus, "fresh");
    assert.equal(row.evidenceArtifact.filePathMatchesTarget, true);
    assert.equal(row.evidenceArtifact.runtimeGraph.freshnessStatus, "fresh");
    assert.ok(["fresh-anchors-packed", "source-relative-budget-exceeded"].includes(row.evidenceArtifact.runtimeGraph.reason));
    assert.equal(row.evidenceArtifact.additionalContextAdmission.diagnosticOnly, true);
    assert.equal(typeof row.evidenceArtifact.additionalContextAdmission.admitted, "boolean");
    assert.equal(typeof row.additionalContextReductionPct, "number");
  }

  assert.equal(evidence.boundary.diagnosticOnly, true);
  assert.equal(evidence.boundary.claimable, false);
  assert.equal(evidence.boundary.secondNative.containsReactWebFactGraph, false);
  assert.equal(evidence.graphAssistedContextPath.diagnosticOnly, true);
  assert.equal(evidence.graphAssistedContextPath.claimable, false);
  assert.equal(evidence.graphAssistedContextPath.observed, true);
  assert.equal(evidence.validation.passed, true);
  assert.deepEqual(evidence.validation.successFailures, []);
  assert.deepEqual(evidence.validation.suiteFailures, []);
  assert.deepEqual(evidence.validation.boundaryFailures, []);

  assert.equal(evidence.nonClaims["provider-token-savings"], false);
  assert.equal(evidence.nonClaims["provider-cost-savings"], false);
  assert.equal(evidence.nonClaims["cache-performance-improvement"], false);
  assert.equal(evidence.nonClaims["broad-runtime-token-savings"], false);
  assert.equal(evidence.nonClaims["react-native-webview-or-tui-support-expansion"], false);
});

test("React Web live hook dogfood evidence Markdown keeps diagnostic-only boundaries explicit", async () => {
  const evidence = await buildReactWebLiveHookDogfoodEvidence({ runId: `markdown-${Date.now()}-${Math.random()}` });
  const markdown = renderReactWebLiveHookDogfoodEvidenceMarkdown(evidence);

  assert.match(markdown, /built-CLI\/native-hook dogfood evidence/i);
  assert.match(markdown, /Isolated attached replay: yes/);
  assert.match(markdown, /Graph-assisted path observed: yes \(diagnostic-only\)/);
  assert.match(markdown, /Prompt shape: repeated same-file edit-intent prompts/);
  assert.match(markdown, /First native hook: emitted=no \(record-only empty stdout expected\)/);
  assert.match(markdown, /contains reactWebFactGraph=(yes|no)/);
  assert.match(markdown, /Artifact identity matches replay target: yes/);
  assert.match(markdown, /Fixture matrix/);
  assert.match(markdown, /Graph diagnostics observed: \d+\/\d+/);
  assert.match(markdown, /Graph included in final additionalContext: \d+\/\d+/);
  assert.match(markdown, /Runtime graph included in artifact diagnostics: \d+\/\d+/);
  assert.match(markdown, /Graph skipped for source-relative budget: \d+\/\d+/);
  assert.match(markdown, /Final hook output smaller than local source: \d+\/\d+/);
  assert.match(markdown, /Expanded final hook output rows: \d+\/\d+/);
  assert.match(markdown, /AdditionalContext admission diagnostics: \d+\/\d+/);
  assert.match(markdown, /AdditionalContext admitted rows: \d+\/\d+/);
  assert.match(markdown, /AdditionalContext discarded rows: \d+\/\d+/);
  assert.match(markdown, /candidate_compression_success_rate:/);
  assert.match(markdown, /final_injection_byte_reduction:/);
  assert.match(markdown, /not proof of candidate compression success/);
  assert.match(markdown, /Claimable as broad token\/cost savings: no/);
  assert.match(markdown, /Graph context leaked: no/);
  assert.match(markdown, /Provider token\/cost\/billing\/invoice savings: no/);
  assert.match(markdown, /Cache performance or latency improvement: no/);
  assert.match(markdown, /Broad runtime-token savings: no/);
  assert.match(markdown, /Broad React Web\/RN\/WebView\/TUI support: no/);
  assert.match(markdown, /Stale graph reuse: no/);
  assert.doesNotMatch(markdown, /Provider token\/cost\/billing\/invoice savings: yes/i);
});
