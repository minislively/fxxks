import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const {
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION,
  REACT_WEB_LIVE_HOOK_DOGFOOD_SNAPSHOT_SCHEMA_VERSION,
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_FINGERPRINT_ALGORITHM,
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_SOURCE_FINGERPRINT_ALGORITHM,
  DEFAULT_LIVE_HOOK_DOGFOOD_SNAPSHOT_PATH,
  LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS,
  DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
  buildReactWebLiveHookDogfoodManifestFingerprint: buildCoreReactWebLiveHookDogfoodManifestFingerprint,
  buildReactWebLiveHookDogfoodFixtureSourceFingerprint: buildCoreReactWebLiveHookDogfoodFixtureSourceFingerprint,
} = require(path.join(defaultRepoRoot, "dist", "core", "react-web-live-hook-dogfood-snapshot.js"));

export const REACT_WEB_LIVE_HOOK_DOGFOOD_SCHEMA_VERSION = "react-web-live-hook-dogfood-evidence.v3";
export {
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION,
  REACT_WEB_LIVE_HOOK_DOGFOOD_SNAPSHOT_SCHEMA_VERSION,
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_FINGERPRINT_ALGORITHM,
  REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_SOURCE_FINGERPRINT_ALGORITHM,
  DEFAULT_LIVE_HOOK_DOGFOOD_SNAPSHOT_PATH,
  LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS,
  DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
};
export const LIVE_HOOK_DOGFOOD_ALLOWED_ROLES = ["positive", "boundary-control", "reuse-baseline"];
export const DEFAULT_LIVE_HOOK_REACT_WEB_TARGET = path.join("src", "components", "FormSection.tsx");
export const DEFAULT_LIVE_HOOK_BOUNDARY_TARGET = path.join("src", "components", "SimpleButton.tsx");
export const DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.map(
  (entry) => entry.file,
);

const NON_CLAIMS = [
  "provider-token-savings",
  "provider-cost-savings",
  "provider-billing-or-invoice-savings",
  "cache-performance-improvement",
  "latency-improvement",
  "broad-runtime-token-savings",
  "broad-react-web-support",
  "react-native-webview-or-tui-support-expansion",
  "stale-graph-reuse",
];

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function percentReduction(beforeBytes, afterBytes) {
  if (!Number.isFinite(beforeBytes) || beforeBytes <= 0) return 0;
  return Number.parseFloat(((1 - afterBytes / beforeBytes) * 100).toFixed(3));
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export function createLiveHookReplayProject({ repoRoot = defaultRepoRoot } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-live-hook-dogfood-"));
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-live-hook-codex-home-"));

  copyFile(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), path.join(projectRoot, DEFAULT_LIVE_HOOK_BOUNDARY_TARGET));
  copyFile(path.join(repoRoot, "fixtures", "raw", "Button.types.ts"), path.join(projectRoot, "src", "components", "Button.types.ts"));
  copyFile(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), path.join(projectRoot, DEFAULT_LIVE_HOOK_REACT_WEB_TARGET));
  copyFile(path.join(repoRoot, "fixtures", "compressed", "Button.types.ts"), path.join(projectRoot, "src", "components", "Button.types.ts"));
  copyFile(path.join(repoRoot, "fixtures", "compressed", "FormSection.utils.ts"), path.join(projectRoot, "src", "components", "FormSection.utils.ts"));
  fs.writeFileSync(
    path.join(projectRoot, "package.json"),
    `${JSON.stringify({ name: "fooks-live-hook-dogfood-project", repository: { url: "https://github.com/minislively/fooks-live-hook-dogfood-project.git" } }, null, 2)}\n`,
  );

  for (const fixture of DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES) {
    copyFile(path.join(repoRoot, fixture), path.join(projectRoot, fixture));
  }

  return { projectRoot, codexHome };
}

function cliPath(repoRoot) {
  return path.join(repoRoot, "dist", "cli", "index.js");
}

function runCli({ repoRoot, projectRoot, args, input, env = {} }) {
  const stdout = execFileSync(process.execPath, [cliPath(repoRoot), ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    input,
    env: { ...process.env, ...env },
  });
  return stdout;
}

function parseOptionalJson(stdout, label) {
  if (!stdout.trim()) return null;
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} emitted non-JSON stdout: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function runCliJson(options, label) {
  return parseOptionalJson(runCli(options), label);
}

function nativePayload({ projectRoot, sessionId, prompt }) {
  return JSON.stringify({
    hook_event_name: "UserPromptSubmit",
    cwd: projectRoot,
    session_id: sessionId,
    prompt,
  });
}

function latestReactWebArtifact(projectRoot) {
  const latestPath = path.join(projectRoot, ".fooks", "artifacts", "react-web-evidence", "latest.json");
  if (!fs.existsSync(latestPath)) return null;
  const latest = JSON.parse(fs.readFileSync(latestPath, "utf8"));
  const artifactPath = latest.latest?.path;
  if (!artifactPath || !fs.existsSync(artifactPath)) return null;
  return {
    latestPath,
    artifactPath,
    latest: latest.latest,
    artifact: JSON.parse(fs.readFileSync(artifactPath, "utf8")),
  };
}

function summarizePreReadGraph(preRead) {
  const graph = preRead?.debug?.reactWebFactGraphConsumer ?? null;
  return {
    diagnosticOnly: true,
    claimable: false,
    decision: preRead?.decision ?? null,
    filePath: preRead?.filePath ?? null,
    classification: preRead?.debug?.domainDetection?.classification ?? null,
    freshnessStatus: graph?.freshnessStatus ?? "unknown",
    selectedAnchorCount: graph?.selectedAnchorCount ?? 0,
    deferredAnchorCount: graph?.deferredAnchorCount ?? 0,
    advisoryOnly: graph?.advisoryOnly === true,
    authorization: graph?.authorization ?? "none",
    emitted: (graph?.selectedAnchorCount ?? 0) > 0,
  };
}

function summarizeNativeResult(result) {
  const additionalContext = result?.hookSpecificOutput?.additionalContext;
  return {
    emitted: result !== null,
    hookEventName: result?.hookSpecificOutput?.hookEventName ?? null,
    hasAdditionalContext: typeof additionalContext === "string" && additionalContext.length > 0,
    additionalContextBytes: typeof additionalContext === "string" ? Buffer.byteLength(additionalContext, "utf8") : 0,
    containsReactWebFactGraph: typeof additionalContext === "string" && additionalContext.includes("reactWebFactGraph"),
    firstLine: typeof additionalContext === "string" ? additionalContext.split("\n")[0] : null,
  };
}

function summarizeArtifact(artifactRef, expectedFile) {
  const artifact = artifactRef?.artifact ?? null;
  const runtimeGraph = artifact?.runtimeGraph ?? null;
  const admission = artifact?.additionalContextAdmission ?? null;
  return {
    diagnosticOnly: true,
    claimable: false,
    exists: Boolean(artifact),
    artifactPath: artifactRef?.artifactPath ?? null,
    filePath: artifact?.filePath ?? null,
    expectedFilePath: expectedFile,
    filePathMatchesTarget: artifact?.filePath === expectedFile,
    decision: artifact?.decision ?? null,
    evidenceStrength: artifact?.evidenceStrength ?? null,
    runtimeGraph: runtimeGraph
      ? {
          diagnosticOnly: runtimeGraph.diagnosticOnly === true,
          included: runtimeGraph.included === true,
          reason: runtimeGraph.reason,
          selectedAnchorCount: runtimeGraph.selectedAnchorCount ?? 0,
          deferredAnchorCount: runtimeGraph.deferredAnchorCount ?? 0,
          freshnessStatus: runtimeGraph.freshnessStatus ?? "unknown",
        }
      : null,
    additionalContextAdmission: admission
      ? {
          diagnosticOnly: admission.diagnosticOnly === true,
          admitted: admission.admitted === true,
          reason: admission.reason,
          sourceBytes: admission.sourceBytes ?? null,
          candidateKind: admission.candidateKind ?? null,
          candidateVariant: admission.candidateVariant ?? null,
          candidateBytes: admission.candidateBytes ?? 0,
          reductionPct: admission.reductionPct ?? null,
          minSourceBytes: admission.minSourceBytes ?? null,
          minReductionPct: admission.minReductionPct ?? null,
        }
      : null,
  };
}

function assertSuccessPath(success) {
  const failures = [];
  if (success.preReadGraphDiagnostics.freshnessStatus !== "fresh") failures.push("pre-read graph was not fresh");
  if (success.preReadGraphDiagnostics.selectedAnchorCount <= 0) failures.push("pre-read graph selected no anchors");
  if (success.firstNative.emitted) failures.push("first native-hook prompt emitted output instead of record-only empty stdout");
  if (!success.secondNative.hasAdditionalContext) failures.push("second native-hook prompt did not emit additionalContext");
  if (!success.secondNative.hasAdditionalContext) failures.push("second native-hook additionalContext did not emit host-facing context");
  if (!success.evidenceArtifact.exists) failures.push("React Web evidence artifact was not emitted");
  if (!success.evidenceArtifact.filePathMatchesTarget) failures.push("React Web evidence artifact did not match replay target");
  if (success.evidenceArtifact.runtimeGraph?.diagnosticOnly !== true) failures.push("runtimeGraph was not diagnostic-only");
  if (!["fresh-anchors-packed", "source-relative-budget-exceeded"].includes(success.evidenceArtifact.runtimeGraph?.reason)) failures.push("runtimeGraph reason was not an allowed fresh graph admission outcome");
  if (success.evidenceArtifact.runtimeGraph?.freshnessStatus !== "fresh") failures.push("runtimeGraph freshness was not fresh");
  return failures;
}

function assertBoundaryPath(boundary) {
  const failures = [];
  if (boundary.secondNative.containsReactWebFactGraph) failures.push("boundary native-hook additionalContext leaked reactWebFactGraph");
  return failures;
}

function summarizeLiveHookSuiteRow({ projectRoot, relativeFile, preRead, firstNative, secondNative, artifactRef }) {
  const source = fs.readFileSync(path.join(projectRoot, relativeFile), "utf8");
  const sourceBytes = byteLength(source);
  const additionalContextBytes = secondNative.additionalContextBytes;
  const artifact = summarizeArtifact(artifactRef, relativeFile);

  return {
    file: relativeFile,
    sourceBytes,
    additionalContextBytes,
    additionalContextReductionPct: percentReduction(sourceBytes, additionalContextBytes),
    finalInjectionBytes: additionalContextBytes,
    finalInjectionByteReductionPct: percentReduction(sourceBytes, additionalContextBytes),
    additionalContextLargerThanSource: additionalContextBytes > sourceBytes,
    preReadGraphDiagnostics: summarizePreReadGraph(preRead),
    firstNative,
    secondNative,
    evidenceArtifact: artifact,
    diagnosticOnly: true,
    claimable: false,
  };
}

function distribution(values) {
  if (values.length === 0) return { min: null, max: null, avg: null };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3)),
  };
}

function rate(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(3)) : null;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

export function buildReactWebLiveHookDogfoodManifestFingerprint({
  manifest = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
} = {}) {
  return buildCoreReactWebLiveHookDogfoodManifestFingerprint(manifest);
}

export function buildReactWebLiveHookDogfoodFixtureSourceFingerprint({
  manifest = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
  repoRoot = defaultRepoRoot,
} = {}) {
  const files = manifest.map((entry) => {
    const fixturePath = path.resolve(repoRoot, entry.file);
    const content = fs.readFileSync(fixturePath);
    return {
      file: entry.file,
      bytes: content.length,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
    };
  });
  return {
    fingerprint: buildCoreReactWebLiveHookDogfoodFixtureSourceFingerprint({ repoRoot, manifest }),
    fileCount: files.length,
    byteCount: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function arraysEqual(left = [], right = []) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildReactWebLiveHookDogfoodCoverageSnapshot(summary) {
  return {
    schemaVersion: REACT_WEB_LIVE_HOOK_DOGFOOD_SNAPSHOT_SCHEMA_VERSION,
    generatedFrom: "buildReactWebLiveHookDogfoodCoverageSummary",
    advisoryOnly: true,
    diagnosticOnly: true,
    claimable: false,
    manifestFingerprintAlgorithm: summary.manifestFingerprintAlgorithm,
    manifestFingerprint: summary.manifestFingerprint,
    fixtureSourceFingerprintAlgorithm: summary.fixtureSourceFingerprintAlgorithm,
    fixtureSourceFingerprint: summary.fixtureSourceFingerprint,
    fixtureCount: summary.fixtureCount,
    requiredLabels: summary.requiredLabels,
    claimBoundary:
      "Advisory reviewed baseline only: not runtime/pre-read authorization, not a merge gate, and not provider token/cost/billing evidence.",
  };
}

export function readReactWebLiveHookDogfoodCoverageSnapshot({
  repoRoot = defaultRepoRoot,
  snapshotPath = DEFAULT_LIVE_HOOK_DOGFOOD_SNAPSHOT_PATH,
} = {}) {
  return readJsonIfExists(path.resolve(repoRoot, snapshotPath));
}

export function buildReactWebLiveHookDogfoodSnapshotDrift({
  summary,
  expectedSnapshot,
  snapshotPath = DEFAULT_LIVE_HOOK_DOGFOOD_SNAPSHOT_PATH,
} = {}) {
  if (!expectedSnapshot) {
    return {
      advisoryOnly: true,
      diagnosticOnly: true,
      claimable: false,
      snapshotPath,
      driftStatus: "missing-baseline",
      reasons: ["snapshot-baseline-missing"],
      snapshotSchema: {
        expected: null,
        actual: REACT_WEB_LIVE_HOOK_DOGFOOD_SNAPSHOT_SCHEMA_VERSION,
        matched: false,
      },
      fixtureCount: {
        expected: null,
        actual: summary.fixtureCount,
        matched: false,
      },
      requiredLabels: {
        expected: null,
        actual: summary.requiredLabels,
        matched: false,
      },
      manifest: {
        expectedFingerprint: null,
        actualFingerprint: summary.manifestFingerprint,
        matched: false,
        algorithm: summary.manifestFingerprintAlgorithm,
      },
      fixtureSource: {
        expectedFingerprint: null,
        actualFingerprint: summary.fixtureSourceFingerprint,
        matched: false,
        algorithm: summary.fixtureSourceFingerprintAlgorithm,
      },
      updateCommandHint: `node scripts/react-web-live-hook-dogfood-evidence.mjs --write-coverage-snapshot=${snapshotPath}`,
      claimBoundary:
        "Advisory drift comparison only: not runtime/pre-read authorization and not a merge gate.",
    };
  }

  const manifestMatched =
    expectedSnapshot.manifestFingerprintAlgorithm === summary.manifestFingerprintAlgorithm
    && expectedSnapshot.manifestFingerprint === summary.manifestFingerprint;
  const fixtureSourceMatched =
    expectedSnapshot.fixtureSourceFingerprintAlgorithm === summary.fixtureSourceFingerprintAlgorithm
    && expectedSnapshot.fixtureSourceFingerprint === summary.fixtureSourceFingerprint;
  const schemaMatched = expectedSnapshot.schemaVersion === REACT_WEB_LIVE_HOOK_DOGFOOD_SNAPSHOT_SCHEMA_VERSION;
  const fixtureCountMatched = expectedSnapshot.fixtureCount === summary.fixtureCount;
  const requiredLabelsMatched = arraysEqual(expectedSnapshot.requiredLabels, summary.requiredLabels);
  const reasons = [
    ...(schemaMatched ? [] : ["snapshot-schema-mismatch"]),
    ...(fixtureCountMatched ? [] : ["fixture-count-mismatch"]),
    ...(requiredLabelsMatched ? [] : ["required-labels-mismatch"]),
    ...(manifestMatched ? [] : ["manifest-fingerprint-mismatch"]),
    ...(fixtureSourceMatched ? [] : ["fixture-source-fingerprint-mismatch"]),
  ];

  return {
    advisoryOnly: true,
    diagnosticOnly: true,
    claimable: false,
    snapshotPath,
    driftStatus: reasons.length === 0 ? "fresh" : "drifted",
    reasons,
    snapshotSchema: {
      expected: expectedSnapshot.schemaVersion,
      actual: REACT_WEB_LIVE_HOOK_DOGFOOD_SNAPSHOT_SCHEMA_VERSION,
      matched: schemaMatched,
    },
    fixtureCount: {
      expected: expectedSnapshot.fixtureCount,
      actual: summary.fixtureCount,
      matched: fixtureCountMatched,
    },
    requiredLabels: {
      expected: expectedSnapshot.requiredLabels,
      actual: summary.requiredLabels,
      matched: requiredLabelsMatched,
    },
    manifest: {
      expectedFingerprint: expectedSnapshot.manifestFingerprint,
      actualFingerprint: summary.manifestFingerprint,
      matched: manifestMatched,
      algorithm: summary.manifestFingerprintAlgorithm,
    },
    fixtureSource: {
      expectedFingerprint: expectedSnapshot.fixtureSourceFingerprint,
      actualFingerprint: summary.fixtureSourceFingerprint,
      matched: fixtureSourceMatched,
      algorithm: summary.fixtureSourceFingerprintAlgorithm,
    },
    updateCommandHint: `node scripts/react-web-live-hook-dogfood-evidence.mjs --write-coverage-snapshot=${snapshotPath}`,
    claimBoundary:
      "Advisory drift comparison only: not runtime/pre-read authorization and not a merge gate.",
  };
}

export function buildReactWebLiveHookDogfoodCoverageSummary({
  manifest = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
  repoRoot = defaultRepoRoot,
  snapshotPath = DEFAULT_LIVE_HOOK_DOGFOOD_SNAPSHOT_PATH,
  expectedSnapshot = readReactWebLiveHookDogfoodCoverageSnapshot({ repoRoot, snapshotPath }),
} = {}) {
  const requiredLabels = [...LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS];
  const expectedLabels = [...requiredLabels];
  const observedLabels = uniqueSorted(manifest.flatMap((entry) => entry.coverage ?? []));
  const observedSet = new Set(observedLabels);
  const missingLabels = requiredLabels.filter((label) => !observedSet.has(label));
  const countsByLabel = {};
  const countsByRole = {};

  for (const entry of manifest) {
    countsByRole[entry.role] = (countsByRole[entry.role] ?? 0) + 1;
    for (const label of new Set(entry.coverage ?? [])) {
      countsByLabel[label] = (countsByLabel[label] ?? 0) + 1;
    }
  }

  const manifestFingerprint = buildReactWebLiveHookDogfoodManifestFingerprint({ manifest });
  const fixtureSourceIdentity = buildReactWebLiveHookDogfoodFixtureSourceFingerprint({ manifest, repoRoot });

  const summary = {
    schemaVersion: REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION,
    source: "react-web-live-hook-dogfood-fixture-manifest",
    freshnessStatus: "fresh",
    manifestFingerprintAlgorithm: REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_FINGERPRINT_ALGORITHM,
    manifestFingerprint,
    manifestFingerprintShort: manifestFingerprint.slice(0, 12),
    manifestFingerprintInput: [
      "schemaVersion",
      "manifest[].file",
      "manifest[].coverage",
      "manifest[].purpose",
      "manifest[].role",
      "manifest[].expectation.classification",
      "manifest[].expectation.admission",
      "manifest[].expectation.metricBoundary",
    ],
    manifestFileCount: manifest.length,
    fixtureSourceFreshnessStatus: "fresh",
    fixtureSourceFingerprintAlgorithm: REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_SOURCE_FINGERPRINT_ALGORITHM,
    fixtureSourceFingerprint: fixtureSourceIdentity.fingerprint,
    fixtureSourceFingerprintShort: fixtureSourceIdentity.fingerprint.slice(0, 12),
    fixtureSourceFileCount: fixtureSourceIdentity.fileCount,
    fixtureSourceByteCount: fixtureSourceIdentity.byteCount,
    fixtureSourceFingerprintInput: [
      "manifest[].file",
      "sha256(file bytes)",
      "file byte length",
    ],
    diagnosticOnly: true,
    claimable: false,
    advisoryOnly: true,
    fixtureCount: manifest.length,
    requiredLabels,
    expectedLabels,
    observedLabels,
    missingLabels,
    countsByLabel: Object.fromEntries(Object.entries(countsByLabel).sort(([left], [right]) => left.localeCompare(right))),
    countsByRole: Object.fromEntries(Object.entries(countsByRole).sort(([left], [right]) => left.localeCompare(right))),
    claimBoundary:
      "Local fixture-intent coverage summary only: not broad React Web support, not provider token/cost savings, and not runtime, pre-read, cache, or model-facing authorization.",
  };
  summary.snapshotDrift = buildReactWebLiveHookDogfoodSnapshotDrift({ summary, expectedSnapshot, snapshotPath });
  return summary;
}

function summarizeLiveHookSuite(rows, { repoRoot = defaultRepoRoot } = {}) {
  const reductionValues = rows.map((row) => row.additionalContextReductionPct);
  const candidateReductionValues = rows
    .map((row) => row.evidenceArtifact.additionalContextAdmission?.reductionPct)
    .filter((value) => typeof value === "number");
  const finalInjectionReductionValues = rows.map((row) => row.finalInjectionByteReductionPct);
  const graphDiagnosticCount = rows.filter((row) => row.preReadGraphDiagnostics.emitted).length;
  const graphIncludedCount = rows.filter((row) => row.secondNative.containsReactWebFactGraph).length;
  const runtimeGraphIncludedArtifactCount = rows.filter((row) => row.evidenceArtifact.runtimeGraph?.included === true).length;
  const graphSkippedForBudgetCount = rows.filter((row) => row.evidenceArtifact.runtimeGraph?.reason === "source-relative-budget-exceeded").length;
  const firstPromptEmptyCount = rows.filter((row) => !row.firstNative.emitted).length;
  const artifactIdentityMatchCount = rows.filter((row) => row.evidenceArtifact.filePathMatchesTarget).length;
  const allAdditionalContextsSmaller = rows.every((row) => !row.additionalContextLargerThanSource && row.additionalContextBytes > 0);
  const compactRowsCount = rows.filter((row) => !row.additionalContextLargerThanSource && row.additionalContextBytes > 0).length;
  const expandedRowsCount = rows.length - compactRowsCount;
  const admissionObservedCount = rows.filter((row) => row.evidenceArtifact.additionalContextAdmission?.diagnosticOnly === true).length;
  const admittedAdditionalContextCount = rows.filter((row) => row.evidenceArtifact.additionalContextAdmission?.admitted === true).length;
  const compressionSuccessCount = rows.filter((row) => row.evidenceArtifact.additionalContextAdmission?.reason === "admitted").length;
  const discardedAdditionalContextCount = rows.filter((row) => row.evidenceArtifact.additionalContextAdmission?.admitted === false).length;
  const fallbackUsedCount = rows.filter((row) => row.secondNative.firstLine?.includes("Read the full source file for this turn") === true).length;
  const badCandidateObservedCount = rows.filter((row) => row.evidenceArtifact.additionalContextAdmission?.admitted === false).length;
  const badCandidateBlockCount = discardedAdditionalContextCount;
  const candidateAdmissionRate = rate(admittedAdditionalContextCount, admissionObservedCount);
  const candidateCompressionSuccessRate = rate(compressionSuccessCount, admissionObservedCount);
  const badCandidateBlockRate = rate(badCandidateBlockCount, badCandidateObservedCount);
  const fallbackUsageRate = rate(fallbackUsedCount, rows.length);

  const discardedReasonCounts = rows.reduce((counts, row) => {
    const admission = row.evidenceArtifact.additionalContextAdmission;
    if (admission && !admission.admitted) {
      counts[admission.reason] = (counts[admission.reason] ?? 0) + 1;
    }
    return counts;
  }, {});
  const allFreshGraphs = rows.every(
    (row) => row.preReadGraphDiagnostics.freshnessStatus === "fresh" && row.evidenceArtifact.runtimeGraph?.freshnessStatus === "fresh",
  );

  return {
    diagnosticOnly: true,
    claimable: false,
    measurement: "built-cli-native-hook-fixture-matrix-additional-context-bytes",
    fixtureCount: rows.length,
    graphDiagnosticCount,
    graphIncludedCount,
    runtimeGraphIncludedArtifactCount,
    graphSkippedForBudgetCount,
    graphObservedCount: graphIncludedCount,
    firstPromptEmptyCount,
    artifactIdentityMatchCount,
    compactRowsCount,
    expandedRowsCount,
    admissionObservedCount,
    admittedAdditionalContextCount,
    discardedAdditionalContextCount,
    discardedReasonCounts,
    candidateMetrics: {
      observedCount: admissionObservedCount,
      admittedCount: admittedAdditionalContextCount,
      discardedCount: discardedAdditionalContextCount,
      admissionRate: candidateAdmissionRate,
      compressionSuccessRate: candidateCompressionSuccessRate,
      badCandidateBlockRate,
      byteReduction: distribution(candidateReductionValues),
      discardReasons: discardedReasonCounts,
    },
    fallbackMetrics: {
      usedCount: fallbackUsedCount,
      usageRate: fallbackUsageRate,
    },
    finalInjectionMetrics: {
      byteReduction: distribution(finalInjectionReductionValues),
    },
    metricAliases: {
      candidate_admission_rate: candidateAdmissionRate,
      candidate_compression_success_rate: candidateCompressionSuccessRate,
      bad_candidate_block_rate: badCandidateBlockRate,
      fallback_used_rate: fallbackUsageRate,
      candidate_byte_reduction: distribution(candidateReductionValues),
      final_injection_byte_reduction: distribution(finalInjectionReductionValues),
    },
    coverage: buildReactWebLiveHookDogfoodCoverageSummary({ repoRoot }),
    allAdditionalContextsSmaller,
    allFreshGraphs,
    minAdditionalContextReductionPct: Math.min(...reductionValues),
    maxAdditionalContextReductionPct: Math.max(...reductionValues),
    blocker:
      graphDiagnosticCount === rows.length &&
      runtimeGraphIncludedArtifactCount > 0 &&
      artifactIdentityMatchCount === rows.length &&
      admissionObservedCount === rows.length &&
      admittedAdditionalContextCount > 0
        ? null
        : "live/native hook fixture rows did not preserve graph diagnostics, admission diagnostics, and at least one admitted compact candidate",
  };
}

function assertLiveHookSuite(suite) {
  const failures = [];
  const manifestEntries = suite.manifest?.entries ?? [];
  if (suite.summary.fixtureCount === 0) failures.push("live hook suite had no fixtures");
  if (manifestEntries.length !== suite.fixtures.length) failures.push("live hook suite manifest entry count did not match fixture row count");
  if (suite.summary.graphDiagnosticCount !== suite.summary.fixtureCount) failures.push("not every live hook suite fixture preserved graph diagnostics");
  if (suite.summary.runtimeGraphIncludedArtifactCount <= 0) failures.push("no live hook suite fixture preserved an included runtime graph diagnostic in the artifact");
  if (suite.summary.firstPromptEmptyCount !== suite.summary.fixtureCount) failures.push("not every live hook suite first prompt was record-only empty stdout");
  if (suite.summary.artifactIdentityMatchCount !== suite.summary.fixtureCount) failures.push("not every live hook suite artifact matched its replay target");
  if (suite.summary.admissionObservedCount !== suite.summary.fixtureCount) failures.push("not every live hook suite fixture recorded additionalContext admission diagnostics");
  if (suite.summary.admittedAdditionalContextCount <= 0) failures.push("no live hook suite fixture admitted compact additionalContext");
  if (suite.summary.admittedAdditionalContextCount > suite.summary.compactRowsCount) failures.push("admitted additionalContext count exceeded compact final output rows");
  if (!suite.summary.allFreshGraphs) failures.push("not every live hook suite fixture had fresh pre-read/runtime graph diagnostics");
  if (suite.summary.coverage?.missingLabels?.length > 0) failures.push(`live hook suite manifest missing required labels: ${suite.summary.coverage.missingLabels.join(", ")}`);

  for (const [index, entry] of manifestEntries.entries()) {
    const row = suite.fixtures[index];
    if (!row) continue;
    if (row.file !== entry.file) failures.push(`live hook suite manifest order drifted at ${entry.file}`);
    if (row.preReadGraphDiagnostics.classification !== entry.expectation?.classification) {
      failures.push(`live hook suite manifest classification mismatch for ${entry.file}`);
    }
    const admission = row.evidenceArtifact.additionalContextAdmission;
    if (admission?.diagnosticOnly !== true || entry.expectation?.metricBoundary !== "diagnostic-local-bytes-only") {
      failures.push(`live hook suite manifest metric boundary mismatch for ${entry.file}`);
    }
    const expectedAdmission = entry.expectation?.admission;
    const actualAdmission =
      admission?.admitted === true ? "admitted" : admission?.reason === "source-too-small" ? "discarded-source-too-small" : admission?.reason;
    if (actualAdmission !== expectedAdmission) {
      failures.push(`live hook suite manifest admission mismatch for ${entry.file}: expected ${expectedAdmission}, got ${actualAdmission}`);
    }
  }
  return failures;
}

export async function buildReactWebLiveHookDogfoodEvidence({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const { projectRoot, codexHome } = createLiveHookReplayProject({ repoRoot });
  const env = { FOOKS_CODEX_HOME: codexHome };
  const commands = [];
  const recordCommand = (name, args) => commands.push({ name, command: [process.execPath, cliPath(repoRoot), ...args].join(" ") });

  recordCommand("attach-codex", ["attach", "codex", "--json"]);
  const attach = runCliJson({ repoRoot, projectRoot, args: ["attach", "codex", "--json"], env }, "attach codex");

  recordCommand("codex-pre-read", ["codex-pre-read", DEFAULT_LIVE_HOOK_REACT_WEB_TARGET, "--json"]);
  const preRead = runCliJson({ repoRoot, projectRoot, args: ["codex-pre-read", DEFAULT_LIVE_HOOK_REACT_WEB_TARGET, "--json"], env }, "codex-pre-read");

  const successSessionId = `react-web-live-hook-${runId}`;
  const successFirstPrompt = `Please update ${DEFAULT_LIVE_HOOK_REACT_WEB_TARGET}`;
  const successSecondPrompt = `Again, update ${DEFAULT_LIVE_HOOK_REACT_WEB_TARGET} and keep graph diagnostics compact if safe`;
  recordCommand("native-hook-success-first", ["codex-runtime-hook", "--native-hook"]);
  const firstNative = runCliJson(
    { repoRoot, projectRoot, args: ["codex-runtime-hook", "--native-hook"], input: nativePayload({ projectRoot, sessionId: successSessionId, prompt: successFirstPrompt }), env },
    "native hook success first",
  );
  recordCommand("native-hook-success-second", ["codex-runtime-hook", "--native-hook"]);
  const secondNative = runCliJson(
    { repoRoot, projectRoot, args: ["codex-runtime-hook", "--native-hook"], input: nativePayload({ projectRoot, sessionId: successSessionId, prompt: successSecondPrompt }), env },
    "native hook success second",
  );
  const artifactRef = latestReactWebArtifact(projectRoot);

  const boundarySessionId = `react-web-live-hook-boundary-${runId}`;
  const boundaryFirstPrompt = `Please update ${DEFAULT_LIVE_HOOK_BOUNDARY_TARGET}`;
  const boundarySecondPrompt = `Again, update ${DEFAULT_LIVE_HOOK_BOUNDARY_TARGET}`;
  recordCommand("native-hook-boundary-first", ["codex-runtime-hook", "--native-hook"]);
  const boundaryFirst = runCliJson(
    { repoRoot, projectRoot, args: ["codex-runtime-hook", "--native-hook"], input: nativePayload({ projectRoot, sessionId: boundarySessionId, prompt: boundaryFirstPrompt }), env },
    "native hook boundary first",
  );
  recordCommand("native-hook-boundary-second", ["codex-runtime-hook", "--native-hook"]);
  const boundarySecond = runCliJson(
    { repoRoot, projectRoot, args: ["codex-runtime-hook", "--native-hook"], input: nativePayload({ projectRoot, sessionId: boundarySessionId, prompt: boundarySecondPrompt }), env },
    "native hook boundary second",
  );

  const success = {
    targetFile: DEFAULT_LIVE_HOOK_REACT_WEB_TARGET,
    prompts: { first: successFirstPrompt, second: successSecondPrompt, editIntent: true },
    preReadGraphDiagnostics: summarizePreReadGraph(preRead),
    firstNative: summarizeNativeResult(firstNative),
    secondNative: summarizeNativeResult(secondNative),
    evidenceArtifact: summarizeArtifact(artifactRef, DEFAULT_LIVE_HOOK_REACT_WEB_TARGET),
  };

  const suiteRows = [];
  for (const relativeFile of DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURES) {
    const suiteSessionId = `react-web-live-hook-suite-${runId}-${relativeFile.replace(/[^a-z0-9]+/gi, "-")}`;
    const suiteFirstPrompt = `Please update ${relativeFile}`;
    const suiteSecondPrompt = `Again, update ${relativeFile} and keep graph diagnostics compact if safe`;
    recordCommand(`suite-codex-pre-read:${relativeFile}`, ["codex-pre-read", relativeFile, "--json"]);
    const suitePreRead = runCliJson({ repoRoot, projectRoot, args: ["codex-pre-read", relativeFile, "--json"], env }, `suite codex-pre-read ${relativeFile}`);
    recordCommand(`suite-native-hook-first:${relativeFile}`, ["codex-runtime-hook", "--native-hook"]);
    const suiteFirstNative = runCliJson(
      { repoRoot, projectRoot, args: ["codex-runtime-hook", "--native-hook"], input: nativePayload({ projectRoot, sessionId: suiteSessionId, prompt: suiteFirstPrompt }), env },
      `suite native hook first ${relativeFile}`,
    );
    recordCommand(`suite-native-hook-second:${relativeFile}`, ["codex-runtime-hook", "--native-hook"]);
    const suiteSecondNative = runCliJson(
      { repoRoot, projectRoot, args: ["codex-runtime-hook", "--native-hook"], input: nativePayload({ projectRoot, sessionId: suiteSessionId, prompt: suiteSecondPrompt }), env },
      `suite native hook second ${relativeFile}`,
    );
    suiteRows.push(
      summarizeLiveHookSuiteRow({
        projectRoot,
        relativeFile,
        preRead: suitePreRead,
        firstNative: summarizeNativeResult(suiteFirstNative),
        secondNative: summarizeNativeResult(suiteSecondNative),
        artifactRef: latestReactWebArtifact(projectRoot),
      }),
    );
  }
  const suite = {
    manifest: {
      schemaVersion: REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION,
      diagnosticOnly: true,
      claimable: false,
      entries: DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
    },
    diagnosticOnly: true,
    claimBoundary:
      "Live/native hook fixture-matrix evidence only: local source bytes are compared with host-facing additionalContext bytes after built CLI replay. This is not provider tokenizer output, not provider billing/cost proof, and not a broad runtime-token claim.",
    fixtures: suiteRows,
    summary: summarizeLiveHookSuite(suiteRows, { repoRoot }),
  };
  const boundary = {
    targetFile: DEFAULT_LIVE_HOOK_BOUNDARY_TARGET,
    prompts: { first: boundaryFirstPrompt, second: boundarySecondPrompt, editIntent: true },
    firstNative: summarizeNativeResult(boundaryFirst),
    secondNative: summarizeNativeResult(boundarySecond),
    diagnosticOnly: true,
    claimable: false,
  };
  const successFailures = assertSuccessPath(success);
  const boundaryFailures = assertBoundaryPath(boundary);
  const suiteFailures = assertLiveHookSuite(suite);
  const graphAssistedContextPath = {
    diagnosticOnly: true,
    claimable: false,
    observed: successFailures.length === 0 && suite.summary.graphDiagnosticCount > 0 && suite.summary.runtimeGraphIncludedArtifactCount > 0,
    measurement: "built-cli-native-hook-react-web-graph-assisted-replay",
    blocker: successFailures.length === 0 && suiteFailures.length === 0 ? null : [...successFailures, ...suiteFailures].join("; "),
  };

  return {
    schemaVersion: REACT_WEB_LIVE_HOOK_DOGFOOD_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    runId,
    measurement: "built-cli-native-hook-dogfood-replay",
    claimBoundary:
      "Local built-CLI/native-hook dogfood evidence only: proves bounded React Web graph-assisted context is observable through an isolated attached replay path. It is not provider tokenizer output, not runtime-token savings, not cache performance, not latency, not provider cost, billing, invoice, or charged-cost proof, and not broad React Web/RN/WebView/TUI support.",
    isolatedReplay: {
      projectRoot,
      codexHome,
      attached: attach?.runtimeProof?.status === "passed" && fs.existsSync(path.join(projectRoot, ".fooks", "adapters", "codex", "adapter.json")),
      globalSettingsMutated: false,
      attachRuntimeProofStatus: attach?.runtimeProof?.status ?? null,
      trustLifecycleState: attach?.trustStatus?.lifecycleState ?? null,
    },
    commands,
    success,
    suite,
    boundary,
    graphAssistedContextPath,
    validation: {
      passed: successFailures.length === 0 && boundaryFailures.length === 0 && suiteFailures.length === 0,
      successFailures,
      suiteFailures,
      boundaryFailures,
    },
    nonClaims: Object.fromEntries(NON_CLAIMS.map((claim) => [claim, false])),
  };
}

export function renderReactWebLiveHookDogfoodEvidenceMarkdown(evidence) {
  return `# React Web live/native hook dogfood evidence

${evidence.claimBoundary}

## Summary

- Measurement: ${evidence.measurement}
- Isolated attached replay: ${evidence.isolatedReplay.attached ? "yes" : "no"}
- Graph-assisted path observed: ${evidence.graphAssistedContextPath.observed ? "yes" : "no"} (diagnostic-only)
- Validation passed: ${evidence.validation.passed ? "yes" : "no"}

## Success replay

- Target: \`${evidence.success.targetFile}\`
- Prompt shape: repeated same-file edit-intent prompts
- Pre-read graph: freshness=${evidence.success.preReadGraphDiagnostics.freshnessStatus}, selected=${evidence.success.preReadGraphDiagnostics.selectedAnchorCount}, deferred=${evidence.success.preReadGraphDiagnostics.deferredAnchorCount}, diagnostic-only=yes
- First native hook: emitted=${evidence.success.firstNative.emitted ? "yes" : "no"} (record-only empty stdout expected)
- Second native hook: additionalContext=${evidence.success.secondNative.hasAdditionalContext ? "yes" : "no"}, contains reactWebFactGraph=${evidence.success.secondNative.containsReactWebFactGraph ? "yes" : "no"}
- Runtime graph artifact: reason=${evidence.success.evidenceArtifact.runtimeGraph?.reason ?? "none"}, freshness=${evidence.success.evidenceArtifact.runtimeGraph?.freshnessStatus ?? "none"}, selected=${evidence.success.evidenceArtifact.runtimeGraph?.selectedAnchorCount ?? 0}, diagnostic-only=${evidence.success.evidenceArtifact.runtimeGraph?.diagnosticOnly ? "yes" : "no"}
- Artifact identity matches replay target: ${evidence.success.evidenceArtifact.filePathMatchesTarget ? "yes" : "no"}

## Fixture matrix

- Fixture count: ${evidence.suite.summary.fixtureCount}
- Graph diagnostics observed: ${evidence.suite.summary.graphDiagnosticCount}/${evidence.suite.summary.fixtureCount}
- Graph included in final additionalContext: ${evidence.suite.summary.graphIncludedCount}/${evidence.suite.summary.fixtureCount}
- Runtime graph included in artifact diagnostics: ${evidence.suite.summary.runtimeGraphIncludedArtifactCount}/${evidence.suite.summary.fixtureCount}
- Graph skipped for source-relative budget: ${evidence.suite.summary.graphSkippedForBudgetCount}/${evidence.suite.summary.fixtureCount}
- First prompts record-only: ${evidence.suite.summary.firstPromptEmptyCount}/${evidence.suite.summary.fixtureCount}
- Artifact identity matches: ${evidence.suite.summary.artifactIdentityMatchCount}/${evidence.suite.summary.fixtureCount}
- Final hook output smaller than local source: ${evidence.suite.summary.compactRowsCount}/${evidence.suite.summary.fixtureCount}
- Expanded final hook output rows: ${evidence.suite.summary.expandedRowsCount}/${evidence.suite.summary.fixtureCount}

### Coverage labels

- Manifest schema: ${evidence.suite.manifest?.schemaVersion ?? "none"}
- Required labels: ${evidence.suite.summary.coverage.requiredLabels.join(", ")}
- Observed labels: ${evidence.suite.summary.coverage.observedLabels.join(", ")}
- Missing labels: ${evidence.suite.summary.coverage.missingLabels.length > 0 ? evidence.suite.summary.coverage.missingLabels.join(", ") : "none"}
- Counts by label: ${JSON.stringify(evidence.suite.summary.coverage.countsByLabel)}
- Counts by role: ${JSON.stringify(evidence.suite.summary.coverage.countsByRole)}

### Candidate generation quality

- candidate_admission_rate: ${evidence.suite.summary.metricAliases.candidate_admission_rate}
- candidate_compression_success_rate: ${evidence.suite.summary.metricAliases.candidate_compression_success_rate}
- candidate_byte_reduction: ${JSON.stringify(evidence.suite.summary.metricAliases.candidate_byte_reduction)}

### Gate/admission outcome

- AdditionalContext admission diagnostics: ${evidence.suite.summary.admissionObservedCount}/${evidence.suite.summary.fixtureCount}
- AdditionalContext admitted rows: ${evidence.suite.summary.admittedAdditionalContextCount}/${evidence.suite.summary.fixtureCount}
- AdditionalContext discarded rows: ${evidence.suite.summary.discardedAdditionalContextCount}/${evidence.suite.summary.fixtureCount}
- bad_candidate_block_rate: ${evidence.suite.summary.metricAliases.bad_candidate_block_rate}
- AdditionalContext discard reasons: ${JSON.stringify(evidence.suite.summary.discardedReasonCounts)}

### Fallback behavior

- fallback_used_rate: ${evidence.suite.summary.metricAliases.fallback_used_rate}

### Final injection size

- final_injection_byte_reduction: ${JSON.stringify(evidence.suite.summary.metricAliases.final_injection_byte_reduction)}
- Note: final_injection_byte_reduction is final hook-output size after admission/fallback and is not proof of candidate compression success.
- Claimable as broad token/cost savings: no
- Claim boundary: ${evidence.suite.claimBoundary}

## Boundary replay

- Target: \`${evidence.boundary.targetFile}\`
- Graph context leaked: ${evidence.boundary.secondNative.containsReactWebFactGraph ? "yes" : "no"}
- Diagnostic-only: yes

## Non-claims

- Provider token/cost/billing/invoice savings: no
- Cache performance or latency improvement: no
- Broad runtime-token savings: no
- Broad React Web/RN/WebView/TUI support: no
- Stale graph reuse: no
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const writeSnapshotArg = process.argv
    .find((arg) => arg.startsWith("--write-coverage-snapshot="))
    ?.slice("--write-coverage-snapshot=".length);

  if (writeSnapshotArg) {
    const snapshotPath = path.resolve(defaultRepoRoot, writeSnapshotArg);
    const summary = buildReactWebLiveHookDogfoodCoverageSummary({
      repoRoot: defaultRepoRoot,
      expectedSnapshot: null,
      snapshotPath: writeSnapshotArg,
    });
    const snapshot = buildReactWebLiveHookDogfoodCoverageSnapshot(summary);
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    process.exit(0);
  }

  const evidence = await buildReactWebLiveHookDogfoodEvidence({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebLiveHookDogfoodEvidenceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
