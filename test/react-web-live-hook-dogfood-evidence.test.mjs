import test from "node:test";
import assert from "node:assert/strict";
import {
  REACT_WEB_LIVE_HOOK_DOGFOOD_SCHEMA_VERSION,
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
  assert.equal(evidence.success.secondNative.containsReactWebFactGraph, true);
  assert.match(evidence.success.secondNative.firstLine, /fooks: reused pre-read \(compressed\)/);

  assert.equal(evidence.success.evidenceArtifact.exists, true);
  assert.equal(evidence.success.evidenceArtifact.filePath, evidence.success.targetFile);
  assert.equal(evidence.success.evidenceArtifact.filePathMatchesTarget, true);
  assert.equal(evidence.success.evidenceArtifact.decision, "use");
  assert.equal(evidence.success.evidenceArtifact.runtimeGraph.diagnosticOnly, true);
  assert.equal(evidence.success.evidenceArtifact.runtimeGraph.included, true);
  assert.equal(evidence.success.evidenceArtifact.runtimeGraph.reason, "fresh-anchors-packed");
  assert.equal(evidence.success.evidenceArtifact.runtimeGraph.freshnessStatus, "fresh");
  assert.ok(evidence.success.evidenceArtifact.runtimeGraph.selectedAnchorCount > 0);

  assert.equal(evidence.boundary.diagnosticOnly, true);
  assert.equal(evidence.boundary.claimable, false);
  assert.equal(evidence.boundary.secondNative.containsReactWebFactGraph, false);
  assert.equal(evidence.graphAssistedContextPath.diagnosticOnly, true);
  assert.equal(evidence.graphAssistedContextPath.claimable, false);
  assert.equal(evidence.graphAssistedContextPath.observed, true);
  assert.equal(evidence.validation.passed, true);
  assert.deepEqual(evidence.validation.successFailures, []);
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
  assert.match(markdown, /contains reactWebFactGraph=yes/);
  assert.match(markdown, /Artifact identity matches replay target: yes/);
  assert.match(markdown, /Graph context leaked: no/);
  assert.match(markdown, /Provider token\/cost\/billing\/invoice savings: no/);
  assert.match(markdown, /Cache performance or latency improvement: no/);
  assert.match(markdown, /Broad runtime-token savings: no/);
  assert.match(markdown, /Broad React Web\/RN\/WebView\/TUI support: no/);
  assert.match(markdown, /Stale graph reuse: no/);
  assert.doesNotMatch(markdown, /Provider token\/cost\/billing\/invoice savings: yes/i);
});
