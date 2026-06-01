import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReactWebLiveHookDogfoodCoverageSummary } from "./react-web-live-hook-dogfood-evidence.mjs";
import { measureReactWebPreReadGraphDiagnosticFixture } from "./react-web-context-evidence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const REACT_WEB_SNAPSHOT_AWARE_INSPECT_SCHEMA_VERSION = "react-web-snapshot-aware-inspect.v1";
export const REACT_WEB_SNAPSHOT_AWARE_INSPECT_COMMAND = "inspect react-web-snapshot-aware-anchors";
export const REACT_WEB_SNAPSHOT_AWARE_INSPECT_MODE = "snapshot-aware-dry-run";
export const REACT_WEB_FACT_GRAPH_CONSUMER_DRY_RUN_SCHEMA_VERSION = "react-web-fact-graph-consumer-dry-run.v1";
export const REACT_WEB_SNAPSHOT_AWARE_INSPECT_CLAIM_BOUNDARY =
  "React Web snapshot-aware inspect is a read-only dry-run report: it does not authorize runtime/pre-read injection, does not change PR gate policy, does not prove provider token/cost/billing savings, and does not claim broad React Web support.";
export const DEFAULT_REACT_WEB_SNAPSHOT_AWARE_INSPECT_FIXTURE = "fixtures/compressed/FormSection.tsx";

function emptyArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizedSnapshot(snapshotDrift = {}) {
  return {
    driftStatus: snapshotDrift.driftStatus ?? "missing-baseline",
    reasons: emptyArray(snapshotDrift.reasons),
    manifestMatched: snapshotDrift.manifest?.matched === true,
    fixtureSourceMatched: snapshotDrift.fixtureSource?.matched === true,
  };
}

function normalizedGraph(graphConsumer) {
  if (!graphConsumer) return null;
  return {
    schemaVersion: graphConsumer.schemaVersion,
    freshnessStatus: graphConsumer.freshnessStatus ?? "unknown",
    selectedAnchorCount: graphConsumer.selectedAnchorCount ?? 0,
    deferredAnchorCount: graphConsumer.deferredAnchorCount ?? 0,
    maxAnchors: graphConsumer.maxAnchors ?? 0,
    countsPresent:
      typeof graphConsumer.selectedAnchorCount === "number" &&
      typeof graphConsumer.deferredAnchorCount === "number" &&
      typeof graphConsumer.maxAnchors === "number",
    staleBehavior: graphConsumer.staleBehavior ?? "defer-all",
    authorization: graphConsumer.authorization,
    advisoryOnly: graphConsumer.advisoryOnly === true,
  };
}

function normalizedProbeBoundary(probeBoundary) {
  if (!probeBoundary) return null;
  return {
    payloadContainsGraph: probeBoundary.payloadContainsGraph,
    diagnosticOnly: probeBoundary.diagnosticOnly,
    claimable: probeBoundary.claimable,
  };
}

function probeBoundaryBlockers(probeBoundary) {
  if (!probeBoundary) return ["pre-read-probe-boundary-missing"];
  return [
    ...(probeBoundary.payloadContainsGraph === false ? [] : ["pre-read-payload-graph-leak"]),
    ...(probeBoundary.diagnosticOnly === true ? [] : ["pre-read-probe-not-diagnostic-only"]),
    ...(probeBoundary.claimable === false ? [] : ["pre-read-probe-claimable"]),
  ];
}

function decideInspectStatus({ snapshot, graph, probeBoundary = null }) {
  const blockedReasons = [];
  if (snapshot.driftStatus !== "fresh") {
    blockedReasons.push("snapshot-drift-not-fresh");
  }
  blockedReasons.push(...probeBoundaryBlockers(probeBoundary));
  if (!graph) {
    return { inspectStatus: "unavailable", blockedReasons: [...blockedReasons, "graph-consumer-unavailable"] };
  }
  if (graph.schemaVersion !== REACT_WEB_FACT_GRAPH_CONSUMER_DRY_RUN_SCHEMA_VERSION) {
    blockedReasons.push("graph-consumer-schema-mismatch");
  }
  if (graph.countsPresent !== true) {
    blockedReasons.push("graph-consumer-counts-missing");
  }
  if (graph.staleBehavior !== "defer-all") {
    blockedReasons.push("graph-consumer-stale-behavior-mismatch");
  }
  if (graph.authorization !== "none" || graph.advisoryOnly !== true) {
    blockedReasons.push("graph-consumer-authority-widened");
  }
  if (graph.freshnessStatus !== "fresh") {
    blockedReasons.push("graph-consumer-not-fresh");
  }
  if (blockedReasons.length > 0) {
    return { inspectStatus: "blocked", blockedReasons };
  }
  if (graph.selectedAnchorCount <= 0) {
    return { inspectStatus: "unavailable", blockedReasons: ["no-anchors-selected"] };
  }
  return { inspectStatus: "ready", blockedReasons: [] };
}

export function buildReactWebSnapshotAwareInspect({
  coverageSummary = buildReactWebLiveHookDogfoodCoverageSummary(),
  graphConsumer = null,
  probeBoundary = null,
  file = null,
  selectedAnchors = [],
  deferredAnchors = [],
} = {}) {
  const snapshot = normalizedSnapshot(coverageSummary.snapshotDrift);
  const graph = normalizedGraph(graphConsumer);
  const normalizedProbe = normalizedProbeBoundary(probeBoundary);
  const { inspectStatus, blockedReasons } = decideInspectStatus({ snapshot, graph, probeBoundary: normalizedProbe });
  const wouldSelectAnchorCount = inspectStatus === "ready" ? graph.selectedAnchorCount : 0;
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
