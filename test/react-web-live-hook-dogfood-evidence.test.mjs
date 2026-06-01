import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REACT_WEB_LIVE_HOOK_DOGFOOD_SCHEMA_VERSION,
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION,
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_FINGERPRINT_ALGORITHM,
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_SOURCE_FINGERPRINT_ALGORITHM,
  DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
  DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES,
  LIVE_HOOK_DOGFOOD_ALLOWED_ROLES,
  LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS,
  buildReactWebLiveHookDogfoodFixtureSourceFingerprint,
  buildReactWebLiveHookDogfoodManifestFingerprint,
  buildReactWebLiveHookDogfoodCoverageSummary,
  buildReactWebLiveHookDogfoodEvidence,
  renderReactWebLiveHookDogfoodEvidenceMarkdown,
} from "../scripts/react-web-live-hook-dogfood-evidence.mjs";

test("React Web live hook dogfood fixture manifest is explicit and order-preserving", () => {
  assert.equal(REACT_WEB_LIVE_HOOK_DOGFOOD_SCHEMA_VERSION, "react-web-live-hook-dogfood-evidence.v3");
  assert.equal(
    REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION,
    "react-web-live-hook-dogfood-fixture-manifest.v1",
  );
  assert.equal(DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.length, 10);
  assert.deepEqual(
    DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES,
    DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.map((entry) => entry.file),
  );

  for (const entry of DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST) {
    assert.equal(typeof entry.file, "string");
    assert.ok(entry.file.length > 0);
    assert.ok(entry.coverage.length > 0);
    assert.equal(typeof entry.purpose, "string");
    assert.ok(entry.purpose.length > 0);
    assert.ok(LIVE_HOOK_DOGFOOD_ALLOWED_ROLES.includes(entry.role));
    assert.equal(entry.expectation.classification, "react-web");
    assert.equal(entry.expectation.metricBoundary, "diagnostic-local-bytes-only");
    assert.ok(["admitted", "discarded-source-too-small"].includes(entry.expectation.admission));
    assert.equal(entry.coverage.includes("baseline/component"), false);
  }

  const observedLabels = new Set(DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.flatMap((entry) => entry.coverage));
  for (const requiredLabel of LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS) {
    assert.equal(observedLabels.has(requiredLabel), true, `missing required label ${requiredLabel}`);
  }
});

test("React Web live hook dogfood coverage summary is canonical and advisory-only", () => {
  const summary = buildReactWebLiveHookDogfoodCoverageSummary();

  assert.equal(summary.schemaVersion, REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION);
  assert.equal(summary.source, "react-web-live-hook-dogfood-fixture-manifest");
  assert.equal(summary.freshnessStatus, "fresh");
  assert.equal(summary.manifestFingerprintAlgorithm, REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_FINGERPRINT_ALGORITHM);
  assert.match(summary.manifestFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(summary.manifestFingerprintShort, summary.manifestFingerprint.slice(0, 12));
  assert.equal(summary.manifestFileCount, 10);
  assert.deepEqual(summary.manifestFingerprintInput, [
    "schemaVersion",
    "manifest[].file",
    "manifest[].coverage",
    "manifest[].purpose",
    "manifest[].role",
    "manifest[].expectation.classification",
    "manifest[].expectation.admission",
    "manifest[].expectation.metricBoundary",
  ]);
  assert.equal(summary.fixtureSourceFreshnessStatus, "fresh");
  assert.equal(summary.fixtureSourceFingerprintAlgorithm, REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_SOURCE_FINGERPRINT_ALGORITHM);
  assert.match(summary.fixtureSourceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(summary.fixtureSourceFingerprintShort, summary.fixtureSourceFingerprint.slice(0, 12));
  assert.equal(summary.fixtureSourceFileCount, 10);
  assert.ok(summary.fixtureSourceByteCount > 0);
  assert.deepEqual(summary.fixtureSourceFingerprintInput, [
    "manifest[].file",
    "sha256(file bytes)",
    "file byte length",
  ]);
  assert.equal(summary.diagnosticOnly, true);
  assert.equal(summary.claimable, false);
  assert.equal(summary.advisoryOnly, true);
  assert.equal(summary.fixtureCount, 10);
  assert.deepEqual(summary.requiredLabels, LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS);
  assert.deepEqual(summary.expectedLabels, LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS);
  assert.equal(summary.missingLabels.length, 0);
  assert.equal(summary.countsByRole.positive, 8);
  assert.equal(summary.countsByRole["boundary-control"], 1);
  assert.equal(summary.countsByRole["reuse-baseline"], 1);
  assert.match(summary.claimBoundary, /Local fixture-intent coverage summary only/);
  assert.match(summary.claimBoundary, /not broad React Web support/);
  assert.match(summary.claimBoundary, /not provider token\/cost savings/);
  assert.match(summary.claimBoundary, /not runtime, pre-read, cache, or model-facing authorization/);
});

test("React Web live hook dogfood manifest fingerprint detects fixture intent drift", () => {
  const defaultFingerprint = buildReactWebLiveHookDogfoodManifestFingerprint();
  const repeatedFingerprint = buildReactWebLiveHookDogfoodManifestFingerprint({
    manifest: DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
  });
  const coverageDriftManifest = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.map((entry, index) => (index === 0
    ? { ...entry, coverage: [...entry.coverage, "new-form-intent"] }
    : entry));
  const expectationDriftManifest = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.map((entry, index) => (index === 1
    ? { ...entry, expectation: { ...entry.expectation, admission: "discarded-source-too-small" } }
    : entry));

  assert.equal(repeatedFingerprint, defaultFingerprint);
  assert.match(defaultFingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(
    buildReactWebLiveHookDogfoodManifestFingerprint({ manifest: coverageDriftManifest }),
    defaultFingerprint,
  );
  assert.notEqual(
    buildReactWebLiveHookDogfoodManifestFingerprint({ manifest: expectationDriftManifest }),
    defaultFingerprint,
  );
});

test("React Web live hook dogfood fixture source fingerprint detects source drift", () => {
  const defaultSourceIdentity = buildReactWebLiveHookDogfoodFixtureSourceFingerprint();
  const repeatedSourceIdentity = buildReactWebLiveHookDogfoodFixtureSourceFingerprint();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-fixture-source-fingerprint-"));
  const manifest = [{ ...DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST[0], file: "Fixture.tsx" }];
  fs.writeFileSync(path.join(tempDir, "Fixture.tsx"), "export function Fixture() { return <div>one</div>; }\n");
  const first = buildReactWebLiveHookDogfoodFixtureSourceFingerprint({ manifest, repoRoot: tempDir });
  fs.writeFileSync(path.join(tempDir, "Fixture.tsx"), "export function Fixture() { return <div>two</div>; }\n");
  const second = buildReactWebLiveHookDogfoodFixtureSourceFingerprint({ manifest, repoRoot: tempDir });

  assert.equal(repeatedSourceIdentity.fingerprint, defaultSourceIdentity.fingerprint);
  assert.match(defaultSourceIdentity.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(defaultSourceIdentity.fileCount, 10);
  assert.ok(defaultSourceIdentity.byteCount > 0);
  assert.notEqual(first.fingerprint, second.fingerprint);
  assert.notEqual(first.files[0].sha256, second.files[0].sha256);
});

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
  assert.equal(evidence.suite.manifest.schemaVersion, REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION);
  assert.equal(evidence.suite.manifest.diagnosticOnly, true);
  assert.equal(evidence.suite.manifest.claimable, false);
  assert.deepEqual(evidence.suite.manifest.entries, DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST);
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
  assert.equal(DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.length, 10);
  assert.ok(DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.includes("fixtures/compressed/FormControls.tsx"));
  assert.ok(
    DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.includes(
      "test/fixtures/react-web-context-expansion/data-fetching-user-table.tsx",
    ),
  );
  assert.ok(
    DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.includes(
      "test/fixtures/react-web-context-expansion/context-provider-workspace-preferences.tsx",
    ),
  );
  assert.ok(
    DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES.includes(
      "test/fixtures/react-web-context-expansion/client-state-release-store.tsx",
    ),
  );
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
    assert.equal(typeof row.evidenceArtifact.additionalContextAdmission.reductionPct, "number");
    assert.equal(typeof row.additionalContextReductionPct, "number");
  }
  const sourceTooSmallRows = evidence.suite.fixtures.filter(
    (row) => row.evidenceArtifact.additionalContextAdmission.reason === "source-too-small",
  );
  assert.ok(sourceTooSmallRows.length > 0);
  for (const row of sourceTooSmallRows) {
    const admission = row.evidenceArtifact.additionalContextAdmission;
    const expectedReductionPct = Number.parseFloat(((1 - admission.candidateBytes / admission.sourceBytes) * 100).toFixed(3));
    assert.equal(admission.reductionPct, expectedReductionPct);
  }
  const expectedSourceTooSmallEntry = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.find(
    (entry) => entry.expectation.admission === "discarded-source-too-small",
  );
  assert.equal(expectedSourceTooSmallEntry.file, "fixtures/compressed/TinyEditCard.tsx");
  const expectedSourceTooSmallRow = evidence.suite.fixtures.find((row) => row.file === expectedSourceTooSmallEntry.file);
  assert.equal(expectedSourceTooSmallRow.evidenceArtifact.additionalContextAdmission.admitted, false);
  assert.equal(expectedSourceTooSmallRow.evidenceArtifact.additionalContextAdmission.reason, "source-too-small");
  for (const [index, entry] of DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.entries()) {
    const row = evidence.suite.fixtures[index];
    assert.equal(row.file, entry.file);
    assert.equal(row.preReadGraphDiagnostics.classification, entry.expectation.classification);
    assert.equal(row.evidenceArtifact.additionalContextAdmission.diagnosticOnly, true);
    assert.equal(entry.expectation.metricBoundary, "diagnostic-local-bytes-only");
    const actualAdmission =
      row.evidenceArtifact.additionalContextAdmission.admitted === true
        ? "admitted"
        : row.evidenceArtifact.additionalContextAdmission.reason === "source-too-small"
          ? "discarded-source-too-small"
          : row.evidenceArtifact.additionalContextAdmission.reason;
    assert.equal(actualAdmission, entry.expectation.admission);
  }
  assert.equal(
    evidence.suite.summary.metricAliases.candidate_byte_reduction.min,
    Math.min(...evidence.suite.fixtures.map((row) => row.evidenceArtifact.additionalContextAdmission.reductionPct)),
  );
  assert.deepEqual(evidence.suite.summary.coverage.requiredLabels, LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS);
  assert.equal(evidence.suite.summary.coverage.source, "react-web-live-hook-dogfood-fixture-manifest");
  assert.equal(evidence.suite.summary.coverage.diagnosticOnly, true);
  assert.equal(evidence.suite.summary.coverage.claimable, false);
  assert.equal(evidence.suite.summary.coverage.advisoryOnly, true);
  assert.deepEqual(evidence.suite.summary.coverage.expectedLabels, LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS);
  assert.equal(evidence.suite.summary.coverage.missingLabels.length, 0);
  for (const requiredLabel of LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS) {
    assert.ok(evidence.suite.summary.coverage.observedLabels.includes(requiredLabel));
    assert.equal(typeof evidence.suite.summary.coverage.countsByLabel[requiredLabel], "number");
    assert.ok(evidence.suite.summary.coverage.countsByLabel[requiredLabel] > 0);
  }
  assert.equal(evidence.suite.summary.coverage.countsByRole.positive, 8);
  assert.equal(evidence.suite.summary.coverage.countsByRole["boundary-control"], 1);
  assert.equal(evidence.suite.summary.coverage.countsByRole["reuse-baseline"], 1);

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
  assert.match(markdown, /Coverage labels/);
  assert.match(markdown, /Manifest schema: react-web-live-hook-dogfood-fixture-manifest\.v1/);
  assert.match(markdown, /Required labels: .*baseline-component/);
  assert.match(markdown, /Observed labels: .*form-state/);
  assert.match(markdown, /Missing labels: none/);
  assert.match(markdown, /Counts by role:/);
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
