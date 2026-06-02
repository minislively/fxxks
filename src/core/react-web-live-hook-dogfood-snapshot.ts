import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ReactWebSnapshotAwareConsumerGateSnapshotInput } from "./react-web-snapshot-aware-consumer-gate";

export const REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION = "react-web-live-hook-dogfood-fixture-manifest.v1" as const;
export const REACT_WEB_LIVE_HOOK_DOGFOOD_SNAPSHOT_SCHEMA_VERSION = "react-web-live-hook-dogfood-snapshot.v1" as const;
export const REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_FINGERPRINT_ALGORITHM = "sha256-json-stable-v1" as const;
export const REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_SOURCE_FINGERPRINT_ALGORITHM = "sha256-file-set-v1" as const;
export const DEFAULT_LIVE_HOOK_DOGFOOD_SNAPSHOT_PATH = path.join("fixtures", "react-web-live-hook-dogfood.snapshot.json");

export const LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS = [
  "baseline-component",
  "effect-hooks",
  "source-too-small-control",
  "hybrid-dashboard",
  "form-state",
  "data-fetching",
  "custom-hook-state",
  "context-provider",
  "client-state",
] as const;

export const DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST = [
  { file: "fixtures/compressed/FormSection.tsx", coverage: ["baseline-component", "form-state"], purpose: "Primary React Web form-section reuse-shape baseline with same-file helpers.", role: "reuse-baseline", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "fixtures/compressed/HookEffectPanel.tsx", coverage: ["effect-hooks", "custom-hook-state"], purpose: "Hook/effect-heavy React Web row for graph-assisted context diagnostics.", role: "positive", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "fixtures/compressed/TinyEditCard.tsx", coverage: ["source-too-small-control"], purpose: "Small-source control that proves candidate admission can safely fall back.", role: "boundary-control", expectation: { classification: "react-web", admission: "discarded-source-too-small", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "fixtures/hybrid/DashboardPanel.tsx", coverage: ["hybrid-dashboard", "custom-hook-state"], purpose: "Hybrid dashboard row for mixed presentation/state graph diagnostics.", role: "positive", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "fixtures/compressed/FormControls.tsx", coverage: ["form-state", "react-hook-form"], purpose: "React Hook Form/form-state reuse-shape baseline.", role: "positive", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "test/fixtures/react-web-context-expansion/modal-dialog-preferences-form.tsx", coverage: ["form-state", "modal-form"], purpose: "Modal preferences form row for nested local form-state diagnostics.", role: "positive", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "test/fixtures/react-web-context-expansion/data-fetching-user-table.tsx", coverage: ["data-fetching"], purpose: "Server/data-fetching shaped React Web row reused as the suite baseline.", role: "positive", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "test/fixtures/react-web-context-expansion/custom-hook-heavy-review-inbox.tsx", coverage: ["custom-hook-state", "effect-hooks"], purpose: "Custom hook-heavy review inbox row for local state transition diagnostics.", role: "positive", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "test/fixtures/react-web-context-expansion/context-provider-workspace-preferences.tsx", coverage: ["context-provider", "form-state"], purpose: "React Context provider/consumer row for workspace preference state.", role: "positive", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
  { file: "test/fixtures/react-web-context-expansion/client-state-release-store.tsx", coverage: ["client-state", "zustand"], purpose: "Client-state/store-hook component row for release store diagnostics.", role: "positive", expectation: { classification: "react-web", admission: "admitted", metricBoundary: "diagnostic-local-bytes-only" } },
] as const;

type ManifestEntry = (typeof DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST)[number];

type Snapshot = {
  schemaVersion?: string;
  manifestFingerprintAlgorithm?: string;
  manifestFingerprint?: string;
  fixtureSourceFingerprintAlgorithm?: string;
  fixtureSourceFingerprint?: string;
  fixtureCount?: number;
  requiredLabels?: string[];
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeManifestFingerprintEntry(entry: ManifestEntry) {
  return {
    file: entry.file,
    coverage: [...entry.coverage].sort(),
    purpose: entry.purpose,
    role: entry.role,
    expectation: {
      admission: entry.expectation.admission,
      classification: entry.expectation.classification,
      metricBoundary: entry.expectation.metricBoundary,
    },
  };
}

export function buildReactWebLiveHookDogfoodManifestFingerprint(
  manifest: readonly ManifestEntry[] = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
): string {
  return crypto
    .createHash("sha256")
    .update(stableJson({ schemaVersion: REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION, manifest: manifest.map(normalizeManifestFingerprintEntry) }))
    .digest("hex");
}

export function buildReactWebLiveHookDogfoodFixtureSourceFingerprint({
  repoRoot = process.cwd(),
  manifest = DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST,
}: {
  repoRoot?: string;
  manifest?: readonly ManifestEntry[];
} = {}): string {
  const files = manifest.map((entry) => {
    const content = fs.readFileSync(path.resolve(repoRoot, entry.file));
    return {
      file: entry.file,
      bytes: content.length,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
    };
  });
  return crypto
    .createHash("sha256")
    .update(stableJson({ schemaVersion: REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_SCHEMA_VERSION, files }))
    .digest("hex");
}

function readSnapshot(repoRoot: string, snapshotPath = DEFAULT_LIVE_HOOK_DOGFOOD_SNAPSHOT_PATH): Snapshot | null {
  const resolved = path.resolve(repoRoot, snapshotPath);
  if (!fs.existsSync(resolved)) return null;
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as Snapshot;
}

function arraysEqual(left: readonly string[] = [], right: readonly string[] = []): boolean {
  return JSON.stringify([...left]) === JSON.stringify([...right]);
}

export function buildReactWebRuntimeSnapshotGateInput({
  repoRoot = process.cwd(),
  snapshotPath = DEFAULT_LIVE_HOOK_DOGFOOD_SNAPSHOT_PATH,
}: {
  repoRoot?: string;
  snapshotPath?: string;
} = {}): ReactWebSnapshotAwareConsumerGateSnapshotInput {
  const expected = readSnapshot(repoRoot, snapshotPath);
  const manifestFingerprint = buildReactWebLiveHookDogfoodManifestFingerprint();
  const fixtureSourceFingerprint = buildReactWebLiveHookDogfoodFixtureSourceFingerprint({ repoRoot });
  if (!expected) {
    return {
      driftStatus: "missing-baseline",
      reasons: ["snapshot-baseline-missing"],
      manifestMatched: false,
      fixtureSourceMatched: false,
    };
  }

  const schemaMatched = expected.schemaVersion === REACT_WEB_LIVE_HOOK_DOGFOOD_SNAPSHOT_SCHEMA_VERSION;
  const fixtureCountMatched = expected.fixtureCount === DEFAULT_LIVE_HOOK_DOGFOOD_SUITE_FIXTURE_MANIFEST.length;
  const requiredLabelsMatched = arraysEqual(expected.requiredLabels, LIVE_HOOK_DOGFOOD_REQUIRED_COVERAGE_LABELS);
  const manifestMatched =
    expected.manifestFingerprintAlgorithm === REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_MANIFEST_FINGERPRINT_ALGORITHM &&
    expected.manifestFingerprint === manifestFingerprint;
  const fixtureSourceMatched =
    expected.fixtureSourceFingerprintAlgorithm === REACT_WEB_LIVE_HOOK_DOGFOOD_FIXTURE_SOURCE_FINGERPRINT_ALGORITHM &&
    expected.fixtureSourceFingerprint === fixtureSourceFingerprint;
  const reasons = [
    ...(schemaMatched ? [] : ["snapshot-schema-mismatch"]),
    ...(fixtureCountMatched ? [] : ["fixture-count-mismatch"]),
    ...(requiredLabelsMatched ? [] : ["required-labels-mismatch"]),
    ...(manifestMatched ? [] : ["manifest-fingerprint-mismatch"]),
    ...(fixtureSourceMatched ? [] : ["fixture-source-fingerprint-mismatch"]),
  ];

  return {
    driftStatus: reasons.length === 0 ? "fresh" : "drifted",
    reasons,
    manifestMatched,
    fixtureSourceMatched,
  };
}
