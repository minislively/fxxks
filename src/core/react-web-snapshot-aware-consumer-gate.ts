export const REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_SCHEMA_VERSION = "react-web-snapshot-aware-consumer-gate.v1" as const;
export const REACT_WEB_FACT_GRAPH_CONSUMER_DRY_RUN_SCHEMA_VERSION = "react-web-fact-graph-consumer-dry-run.v1" as const;
export const REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_CLAIM_BOUNDARY =
  "React Web snapshot-aware consumer gate is a pure readiness check: it keeps authorization none, does not authorize pre-read payload graph injection, does not change merge-gate policy, and does not claim provider token/cost/billing savings." as const;

export type ReactWebSnapshotAwareConsumerGateStatus = "allowed" | "blocked" | "unavailable";
export type ReactWebSnapshotDriftStatus = "fresh" | "drifted" | "missing-baseline" | "unknown" | string;
export type ReactWebFactGraphConsumerFreshnessStatus = "fresh" | "stale" | "unknown" | string;

export type ReactWebSnapshotAwareConsumerGateSnapshotInput = {
  driftStatus?: ReactWebSnapshotDriftStatus;
  reasons?: string[];
  manifestMatched?: boolean;
  fixtureSourceMatched?: boolean;
};

export type ReactWebSnapshotAwareConsumerGateGraphInput = {
  schemaVersion?: string;
  freshnessStatus?: ReactWebFactGraphConsumerFreshnessStatus;
  selectedAnchorCount?: number;
  deferredAnchorCount?: number;
  maxAnchors?: number;
  staleBehavior?: string;
  authorization?: string;
  advisoryOnly?: boolean;
};

export type ReactWebSnapshotAwareConsumerGateProbeBoundaryInput = {
  payloadContainsGraph?: boolean;
  diagnosticOnly?: boolean;
  claimable?: boolean;
};

export type ReactWebSnapshotAwareConsumerGateInput = {
  snapshot?: ReactWebSnapshotAwareConsumerGateSnapshotInput;
  graphConsumer?: ReactWebSnapshotAwareConsumerGateGraphInput | null;
  probeBoundary?: ReactWebSnapshotAwareConsumerGateProbeBoundaryInput | null;
};

export type ReactWebSnapshotAwareConsumerGateSnapshot = {
  driftStatus: ReactWebSnapshotDriftStatus;
  reasons: string[];
  manifestMatched: boolean;
  fixtureSourceMatched: boolean;
};

export type ReactWebSnapshotAwareConsumerGateGraph = {
  schemaVersion?: string;
  freshnessStatus: ReactWebFactGraphConsumerFreshnessStatus;
  selectedAnchorCount: number;
  deferredAnchorCount: number;
  maxAnchors: number;
  countsPresent: boolean;
  staleBehavior: string;
  authorization?: string;
  advisoryOnly: boolean;
};

export type ReactWebSnapshotAwareConsumerGateProbeBoundary = {
  payloadContainsGraph?: boolean;
  diagnosticOnly?: boolean;
  claimable?: boolean;
};

export type ReactWebSnapshotAwareConsumerGateResult = {
  schemaVersion: typeof REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_SCHEMA_VERSION;
  claimBoundary: typeof REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_CLAIM_BOUNDARY;
  profile: "react-web";
  authorization: "none";
  advisoryOnly: true;
  diagnosticOnly: true;
  claimable: false;
  status: ReactWebSnapshotAwareConsumerGateStatus;
  allowed: boolean;
  blockedReasons: string[];
  snapshot: ReactWebSnapshotAwareConsumerGateSnapshot;
  graphConsumer: ReactWebSnapshotAwareConsumerGateGraph | null;
  probeBoundary: ReactWebSnapshotAwareConsumerGateProbeBoundary | null;
  wouldSelectAnchorCount: number;
  nonClaims: {
    preReadPayloadGraphInjection: false;
    mergeGatePolicy: false;
    providerTokenCostSavings: false;
    broadReactWebSupport: false;
  };
};

function arrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeReactWebSnapshotAwareGateSnapshot(
  snapshot: ReactWebSnapshotAwareConsumerGateSnapshotInput = {},
): ReactWebSnapshotAwareConsumerGateSnapshot {
  return {
    driftStatus: snapshot.driftStatus ?? "missing-baseline",
    reasons: arrayOrEmpty(snapshot.reasons),
    manifestMatched: snapshot.manifestMatched === true,
    fixtureSourceMatched: snapshot.fixtureSourceMatched === true,
  };
}

export function normalizeReactWebSnapshotAwareGateGraph(
  graphConsumer?: ReactWebSnapshotAwareConsumerGateGraphInput | null,
): ReactWebSnapshotAwareConsumerGateGraph | null {
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

export function normalizeReactWebSnapshotAwareGateProbeBoundary(
  probeBoundary?: ReactWebSnapshotAwareConsumerGateProbeBoundaryInput | null,
): ReactWebSnapshotAwareConsumerGateProbeBoundary | null {
  if (!probeBoundary) return null;
  return {
    payloadContainsGraph: probeBoundary.payloadContainsGraph,
    diagnosticOnly: probeBoundary.diagnosticOnly,
    claimable: probeBoundary.claimable,
  };
}

function probeBoundaryBlockers(probeBoundary: ReactWebSnapshotAwareConsumerGateProbeBoundary | null): string[] {
  if (!probeBoundary) return ["pre-read-probe-boundary-missing"];
  return [
    ...(probeBoundary.payloadContainsGraph === false ? [] : ["pre-read-payload-graph-leak"]),
    ...(probeBoundary.diagnosticOnly === true ? [] : ["pre-read-probe-not-diagnostic-only"]),
    ...(probeBoundary.claimable === false ? [] : ["pre-read-probe-claimable"]),
  ];
}

export function evaluateReactWebSnapshotAwareConsumerGate(
  input: ReactWebSnapshotAwareConsumerGateInput = {},
): ReactWebSnapshotAwareConsumerGateResult {
  const snapshot = normalizeReactWebSnapshotAwareGateSnapshot(input.snapshot);
  const graph = normalizeReactWebSnapshotAwareGateGraph(input.graphConsumer);
  const probeBoundary = normalizeReactWebSnapshotAwareGateProbeBoundary(input.probeBoundary);
  const blockedReasons: string[] = [];

  if (snapshot.driftStatus !== "fresh") {
    blockedReasons.push("snapshot-drift-not-fresh");
  }
  if (snapshot.manifestMatched !== true) {
    blockedReasons.push("snapshot-manifest-not-matched");
  }
  if (snapshot.fixtureSourceMatched !== true) {
    blockedReasons.push("snapshot-fixture-source-not-matched");
  }
  if (snapshot.reasons.length > 0) {
    blockedReasons.push("snapshot-reasons-present");
  }
  blockedReasons.push(...probeBoundaryBlockers(probeBoundary));

  if (!graph) {
    const reasons = [...blockedReasons, "graph-consumer-unavailable"];
    return result("unavailable", reasons, snapshot, graph, probeBoundary, 0);
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
    return result("blocked", blockedReasons, snapshot, graph, probeBoundary, 0);
  }
  if (graph.selectedAnchorCount <= 0) {
    return result("unavailable", ["no-anchors-selected"], snapshot, graph, probeBoundary, 0);
  }

  return result("allowed", [], snapshot, graph, probeBoundary, graph.selectedAnchorCount);
}

function result(
  status: ReactWebSnapshotAwareConsumerGateStatus,
  blockedReasons: string[],
  snapshot: ReactWebSnapshotAwareConsumerGateSnapshot,
  graphConsumer: ReactWebSnapshotAwareConsumerGateGraph | null,
  probeBoundary: ReactWebSnapshotAwareConsumerGateProbeBoundary | null,
  wouldSelectAnchorCount: number,
): ReactWebSnapshotAwareConsumerGateResult {
  return {
    schemaVersion: REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_SCHEMA_VERSION,
    claimBoundary: REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_CLAIM_BOUNDARY,
    profile: "react-web",
    authorization: "none",
    advisoryOnly: true,
    diagnosticOnly: true,
    claimable: false,
    status,
    allowed: status === "allowed",
    blockedReasons,
    snapshot,
    graphConsumer,
    probeBoundary,
    wouldSelectAnchorCount,
    nonClaims: {
      preReadPayloadGraphInjection: false,
      mergeGatePolicy: false,
      providerTokenCostSavings: false,
      broadReactWebSupport: false,
    },
  };
}
