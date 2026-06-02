import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildReactWebLiveHookDogfoodCoverageSummary } from "./react-web-live-hook-dogfood-evidence.mjs";
import { measureReactWebPreReadGraphDiagnosticFixture } from "./react-web-context-evidence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const {
  REACT_WEB_FACT_GRAPH_CONSUMER_DRY_RUN_SCHEMA_VERSION,
  REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_CLAIM_BOUNDARY,
  evaluateReactWebSnapshotAwareConsumerGate,
} = require(path.join(defaultRepoRoot, "dist", "core", "react-web-snapshot-aware-consumer-gate.js"));

export const REACT_WEB_SNAPSHOT_AWARE_INSPECT_SCHEMA_VERSION = "react-web-snapshot-aware-inspect.v1";
export const REACT_WEB_SNAPSHOT_AWARE_INSPECT_COMMAND = "inspect react-web-snapshot-aware-anchors";
export const REACT_WEB_SNAPSHOT_AWARE_INSPECT_MODE = "snapshot-aware-dry-run";
export { REACT_WEB_FACT_GRAPH_CONSUMER_DRY_RUN_SCHEMA_VERSION };
export const REACT_WEB_SNAPSHOT_AWARE_INSPECT_CLAIM_BOUNDARY = REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_CLAIM_BOUNDARY;
export const DEFAULT_REACT_WEB_SNAPSHOT_AWARE_INSPECT_FIXTURE = "fixtures/compressed/FormSection.tsx";

function emptyArray(value) {
  return Array.isArray(value) ? value : [];
}

function snapshotInput(snapshotDrift = {}) {
  return {
    driftStatus: snapshotDrift.driftStatus ?? "missing-baseline",
    reasons: emptyArray(snapshotDrift.reasons),
    manifestMatched: snapshotDrift.manifest?.matched === true,
    fixtureSourceMatched: snapshotDrift.fixtureSource?.matched === true,
  };
}

function inspectStatusFromGate(status) {
  return status === "allowed" ? "ready" : status;
}

export function buildReactWebSnapshotAwareInspect({
  coverageSummary = buildReactWebLiveHookDogfoodCoverageSummary(),
  graphConsumer = null,
  probeBoundary = null,
  file = null,
  selectedAnchors = [],
  deferredAnchors = [],
} = {}) {
  const gate = evaluateReactWebSnapshotAwareConsumerGate({
    snapshot: snapshotInput(coverageSummary.snapshotDrift),
    graphConsumer,
    probeBoundary,
  });
  const snapshot = gate.snapshot;
  const graph = gate.graphConsumer;
  const normalizedProbe = gate.probeBoundary;
  const inspectStatus = inspectStatusFromGate(gate.status);
  const blockedReasons = gate.blockedReasons;
  const wouldSelectAnchorCount = gate.allowed ? gate.wouldSelectAnchorCount : 0;
  const selectedAnchorDetails = emptyArray(selectedAnchors);
  const deferredAnchorDetails = emptyArray(deferredAnchors);

  return {
    schemaVersion: REACT_WEB_SNAPSHOT_AWARE_INSPECT_SCHEMA_VERSION,
    command: REACT_WEB_SNAPSHOT_AWARE_INSPECT_COMMAND,
    profile: "react-web",
    mode: REACT_WEB_SNAPSHOT_AWARE_INSPECT_MODE,
    advisoryOnly: true,
    diagnosticOnly: true,
    claimable: false,
    authorization: "none",
    file,
    inspectStatus,
    claimBoundary: REACT_WEB_SNAPSHOT_AWARE_INSPECT_CLAIM_BOUNDARY,
    consumerGate: {
      schemaVersion: gate.schemaVersion,
      status: gate.status,
      allowed: gate.allowed,
      authorization: gate.authorization,
      blockedReasons: gate.blockedReasons,
      wouldSelectAnchorCount: gate.wouldSelectAnchorCount,
    },
    snapshot,
    graphConsumer: graph,
    probeBoundary: normalizedProbe,
    blockedReasons,
    wouldSelectAnchorCount,
    selectedAnchorDetailStatus: selectedAnchorDetails.length > 0 ? "provided" : "counts-only",
    selectedAnchors: inspectStatus === "ready" ? selectedAnchorDetails : [],
    deferredAnchors: deferredAnchorDetails,
    nonClaims: {
      runtimePreReadAuthorization: false,
      mergeGatePolicy: false,
      providerTokenCostSavings: false,
      broadReactWebSupport: false,
    },
  };
}

export async function buildReactWebSnapshotAwareInspectEvidence({
  repoRoot = defaultRepoRoot,
  relativeFile = DEFAULT_REACT_WEB_SNAPSHOT_AWARE_INSPECT_FIXTURE,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const coverageSummary = buildReactWebLiveHookDogfoodCoverageSummary({ repoRoot });
  const graphProbe = await measureReactWebPreReadGraphDiagnosticFixture({ repoRoot, relativeFile });
  const inspect = buildReactWebSnapshotAwareInspect({
    coverageSummary,
    graphConsumer: graphProbe.preReadGraph,
    probeBoundary: {
      payloadContainsGraph: graphProbe.payloadContainsGraph,
      diagnosticOnly: graphProbe.diagnosticOnly,
      claimable: graphProbe.claimable,
    },
    file: relativeFile,
  });

  return {
    ...inspect,
    runId,
    graphProbe: {
      decision: graphProbe.decision,
      classification: graphProbe.classification,
      payloadContainsGraph: graphProbe.payloadContainsGraph,
      diagnosticOnly: graphProbe.diagnosticOnly,
      claimable: graphProbe.claimable,
    },
  };
}

export function renderReactWebSnapshotAwareInspectMarkdown(evidence) {
  const blockedReasons = evidence.blockedReasons.length > 0 ? evidence.blockedReasons.join(", ") : "none";
  const snapshotReasons = evidence.snapshot.reasons.length > 0 ? evidence.snapshot.reasons.join(", ") : "none";
  return `# React Web snapshot-aware inspect

${evidence.claimBoundary}

## Summary

- Profile: ${evidence.profile}
- Mode: ${evidence.mode}
- File: ${evidence.file ?? "none"}
- Inspect status: ${evidence.inspectStatus}
- Authorization: ${evidence.authorization}
- Advisory-only: ${evidence.advisoryOnly ? "yes" : "no"}
- Diagnostic-only: ${evidence.diagnosticOnly ? "yes" : "no"}
- Claimable: ${evidence.claimable ? "yes" : "no"}
- Would select anchors: ${evidence.wouldSelectAnchorCount}
- Selected anchor detail status: ${evidence.selectedAnchorDetailStatus}
- Blocked reasons: ${blockedReasons}

## Snapshot gate

- Drift status: ${evidence.snapshot.driftStatus}
- Drift reasons: ${snapshotReasons}
- Manifest matched: ${evidence.snapshot.manifestMatched ? "yes" : "no"}
- Fixture source matched: ${evidence.snapshot.fixtureSourceMatched ? "yes" : "no"}

## Graph dry-run gate

- Graph available: ${evidence.graphConsumer ? "yes" : "no"}
- Graph freshness: ${evidence.graphConsumer?.freshnessStatus ?? "none"}
- Graph selected count: ${evidence.graphConsumer?.selectedAnchorCount ?? 0}
- Graph deferred count: ${evidence.graphConsumer?.deferredAnchorCount ?? 0}
- Graph authorization: ${evidence.graphConsumer?.authorization ?? "none"}

## Pre-read probe boundary

- Payload contains graph: ${evidence.probeBoundary?.payloadContainsGraph === true ? "yes" : "no"}
- Probe diagnostic-only: ${evidence.probeBoundary?.diagnosticOnly === true ? "yes" : "no"}
- Probe claimable: ${evidence.probeBoundary?.claimable === true ? "yes" : "no"}

## Non-claims

- Runtime/pre-read authorization: ${evidence.nonClaims.runtimePreReadAuthorization ? "yes" : "no"}
- Merge gate policy change: ${evidence.nonClaims.mergeGatePolicy ? "yes" : "no"}
- Provider token/cost savings: ${evidence.nonClaims.providerTokenCostSavings ? "yes" : "no"}
- Broad React Web support: ${evidence.nonClaims.broadReactWebSupport ? "yes" : "no"}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const relativeFile = process.argv.find((arg) => arg.startsWith("--file="))?.slice("--file=".length) ?? DEFAULT_REACT_WEB_SNAPSHOT_AWARE_INSPECT_FIXTURE;
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebSnapshotAwareInspectEvidence({ repoRoot: defaultRepoRoot, relativeFile, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebSnapshotAwareInspectMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
