import {
  FACT_GRAPH_REPORT_NON_CLAIMS,
  type FactEdge,
  type FactGraphConfidence,
  type FactGraphFreshnessStatus,
  type FactGraphReport,
  type FactGraphSourceRef,
  type FactNode,
} from "./fact-graph";
import {
  buildReactWebFactGraphInspection,
  type ReactWebFactGraphInspection,
} from "./react-web-fact-graph";

export const REACT_WEB_FACT_GRAPH_CONSUMER_SCHEMA_VERSION = "react-web-fact-graph-consumer-dry-run.v1" as const;
export const REACT_WEB_FACT_GRAPH_CONSUMER_COMMAND = "inspect react-web-fact-graph-consumer" as const;
export const REACT_WEB_FACT_GRAPH_CONSUMER_DEFAULT_MAX_ANCHORS = 8 as const;
export const REACT_WEB_FACT_GRAPH_CONSUMER_MIN_ANCHORS = 1 as const;
export const REACT_WEB_FACT_GRAPH_CONSUMER_MAX_ANCHORS = 20 as const;
export const REACT_WEB_FACT_GRAPH_CONSUMER_CLAIM_BOUNDARY =
  "React Web fact graph consumer dry-run is advisory and report-only: it ranks source-backed graph anchors for inspection only and does not authorize runtime, pre-read, cache, setup-readiness, or model-facing reuse; it does not claim token, cost, latency, billing, cache-performance, provider-cost, or provider-token savings." as const;

export type ReactWebFactGraphConsumerAuthorization = "none";
export type ReactWebFactGraphAnchorType = "node" | "edge";
export type ReactWebFactGraphAnchorDeferredReason = "budget-deferred" | "stale-or-unknown-freshness";

export type ReactWebFactGraphAnchor = {
  rank: number;
  anchorType: ReactWebFactGraphAnchorType;
  anchorId: string;
  nodeId?: string;
  edgeId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  kind: string;
  label: string;
  confidence: FactGraphConfidence;
  priority: number;
  reason: string;
  sourceRefs: FactGraphSourceRef[];
  freshnessStatus: FactGraphFreshnessStatus;
  deferredReason?: ReactWebFactGraphAnchorDeferredReason;
};

export type ReactWebFactGraphConsumerDryRun = {
  schemaVersion: typeof REACT_WEB_FACT_GRAPH_CONSUMER_SCHEMA_VERSION;
  command: typeof REACT_WEB_FACT_GRAPH_CONSUMER_COMMAND;
  profile: "react-web";
  advisoryOnly: true;
  inScope: boolean;
  skippedReason?: string;
  selectionPolicy: {
    reportOnly: true;
    authorization: ReactWebFactGraphConsumerAuthorization;
    maxAnchors: number;
    staleBehavior: "defer-all";
  };
  graphSummary: {
    schemaVersion: FactGraphReport["schemaVersion"];
    files: string[];
    domain: string;
    freshnessStatus: FactGraphFreshnessStatus;
    nodeCount: number;
    edgeCount: number;
    knownCount: number;
    candidateCount: number;
    unsupportedCount: number;
  };
  selectedAnchors: ReactWebFactGraphAnchor[];
  deferredAnchors: ReactWebFactGraphAnchor[];
  warnings: string[];
  nonClaims: string[];
};

export type ReactWebFactGraphConsumerOptions = {
  maxAnchors?: number;
};

type Candidate = Omit<ReactWebFactGraphAnchor, "rank" | "deferredReason"> & {
  firstLine: number;
};

function boundedMaxAnchors(value: number | undefined): number {
  if (value === undefined) return REACT_WEB_FACT_GRAPH_CONSUMER_DEFAULT_MAX_ANCHORS;
  if (!Number.isInteger(value) || value < REACT_WEB_FACT_GRAPH_CONSUMER_MIN_ANCHORS || value > REACT_WEB_FACT_GRAPH_CONSUMER_MAX_ANCHORS) {
    throw new Error(`--max-anchors must be an integer between ${REACT_WEB_FACT_GRAPH_CONSUMER_MIN_ANCHORS} and ${REACT_WEB_FACT_GRAPH_CONSUMER_MAX_ANCHORS}`);
  }
  return value;
}

export function normalizeReactWebFactGraphConsumerMaxAnchors(value: number | undefined): number {
  return boundedMaxAnchors(value);
}

function firstSourceLine(refs: FactGraphSourceRef[]): number {
  const lines = refs.map((ref) => ref.loc?.startLine).filter((line): line is number => typeof line === "number");
  return lines.length > 0 ? Math.min(...lines) : Number.MAX_SAFE_INTEGER;
}

function confidenceScore(confidence: FactGraphConfidence): number {
  switch (confidence) {
    case "known":
      return 3;
    case "candidate":
      return 2;
    case "unsupported":
      return 1;
  }
}

function priorityFor(kind: string, anchorType: ReactWebFactGraphAnchorType): number {
  if (kind.startsWith("patch-target") || kind === "targets") return 100;
  if (kind === "component" || kind === "file" || kind === "contains") return 90;
  if (kind.startsWith("edit-target-route")) return 85;
  if (kind.startsWith("form-state") || kind.includes("validation")) return 75;
  if (
    kind.startsWith("a11y-anchor") ||
    kind.startsWith("component-api") ||
    kind.startsWith("layout-region") ||
    kind.startsWith("import-role") ||
    kind.startsWith("local-dependency") ||
    kind === "associated-with" ||
    kind === "depends-on" ||
    kind === "flows-to" ||
    kind === "uses-form-role"
  ) return 65;
  if (kind === "concern-profile" || kind === "supports-concern") return 20;
  return anchorType === "edge" ? 11 : 10;
}

function nodeReason(node: FactNode): string {
  return `node:${node.kind}; ${node.evidence.slice(0, 3).join("; ") || "source-backed fact"}`;
}

function edgeReason(edge: FactEdge): string {
  return `edge:${edge.kind}; ${edge.evidence.slice(0, 3).join("; ") || "source-backed relation"}`;
}

function nodeCandidate(node: FactNode, freshnessStatus: FactGraphFreshnessStatus): Candidate | null {
  if (node.sourceRefs.length === 0) return null;
  return {
    anchorType: "node",
    anchorId: node.id,
    nodeId: node.id,
    kind: node.kind,
    label: node.label,
    confidence: node.confidence,
    priority: priorityFor(node.kind, "node"),
    reason: nodeReason(node),
    sourceRefs: node.sourceRefs,
    freshnessStatus,
    firstLine: firstSourceLine(node.sourceRefs),
  };
}

function edgeLabel(edge: FactEdge, nodesById: Map<string, FactNode>): string {
  const from = nodesById.get(edge.from)?.label ?? edge.from;
  const to = nodesById.get(edge.to)?.label ?? edge.to;
  return `${from} ${edge.kind} ${to}`;
}

function edgeCandidate(edge: FactEdge, nodesById: Map<string, FactNode>, freshnessStatus: FactGraphFreshnessStatus): Candidate | null {
  if (edge.sourceRefs.length === 0) return null;
  return {
    anchorType: "edge",
    anchorId: edge.id,
    edgeId: edge.id,
    fromNodeId: edge.from,
    toNodeId: edge.to,
    kind: edge.kind,
    label: edgeLabel(edge, nodesById),
    confidence: edge.confidence,
    priority: priorityFor(edge.kind, "edge"),
    reason: edgeReason(edge),
    sourceRefs: edge.sourceRefs,
    freshnessStatus,
    firstLine: firstSourceLine(edge.sourceRefs),
  };
}

function compareCandidates(left: Candidate, right: Candidate): number {
  if (left.priority !== right.priority) return right.priority - left.priority;
  const confidenceDelta = confidenceScore(right.confidence) - confidenceScore(left.confidence);
  if (confidenceDelta !== 0) return confidenceDelta;
  if (left.firstLine !== right.firstLine) return left.firstLine - right.firstLine;
  if (left.anchorType !== right.anchorType) return left.anchorType === "edge" ? -1 : 1;
  const labelCompare = left.label.localeCompare(right.label);
  if (labelCompare !== 0) return labelCompare;
  return left.anchorId.localeCompare(right.anchorId);
}

function ranked(anchor: Candidate, rank: number, deferredReason?: ReactWebFactGraphAnchorDeferredReason): ReactWebFactGraphAnchor {
  const { firstLine: _firstLine, ...publicAnchor } = anchor;
  return {
    rank,
    ...publicAnchor,
    ...(deferredReason ? { deferredReason } : {}),
  };
}

function buildCandidates(graph: FactGraphReport): Candidate[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  return [
    ...graph.nodes.map((node) => nodeCandidate(node, graph.freshness.status)),
    ...graph.edges.map((edge) => edgeCandidate(edge, nodesById, graph.freshness.status)),
  ].filter((candidate): candidate is Candidate => candidate !== null).sort(compareCandidates);
}

export function selectReactWebFactGraphAnchors(
  inspection: ReactWebFactGraphInspection,
  options: ReactWebFactGraphConsumerOptions = {},
): ReactWebFactGraphConsumerDryRun {
  const maxAnchors = boundedMaxAnchors(options.maxAnchors);
  const graph = inspection.graph;
  const candidates = inspection.inScope ? buildCandidates(graph) : [];
  const warnings = [
    REACT_WEB_FACT_GRAPH_CONSUMER_CLAIM_BOUNDARY,
    ...graph.warnings,
  ];
  if (inspection.inScope && candidates.length === 0) {
    warnings.push("React Web fact graph consumer found no source-backed anchors to select.");
  }

  const staleOrUnknown = graph.freshness.status !== "fresh";
  const selectedAnchors = staleOrUnknown ? [] : candidates.slice(0, maxAnchors).map((candidate, index) => ranked(candidate, index + 1));
  const deferredCandidates = staleOrUnknown ? candidates : candidates.slice(maxAnchors);
  const deferredReason: ReactWebFactGraphAnchorDeferredReason = staleOrUnknown ? "stale-or-unknown-freshness" : "budget-deferred";
  const deferredAnchors = deferredCandidates.map((candidate, index) => ranked(candidate, selectedAnchors.length + index + 1, deferredReason));

  if (staleOrUnknown && candidates.length > 0) {
    warnings.push("React Web fact graph freshness is stale or unknown; all source-backed anchors were deferred.");
  }

  return {
    schemaVersion: REACT_WEB_FACT_GRAPH_CONSUMER_SCHEMA_VERSION,
    command: REACT_WEB_FACT_GRAPH_CONSUMER_COMMAND,
    profile: "react-web",
    advisoryOnly: true,
    inScope: inspection.inScope,
    ...(inspection.skippedReason ? { skippedReason: inspection.skippedReason } : {}),
    selectionPolicy: {
      reportOnly: true,
      authorization: "none",
      maxAnchors,
      staleBehavior: "defer-all",
    },
    graphSummary: {
      schemaVersion: graph.schemaVersion,
      files: graph.scope.files,
      domain: graph.scope.domain,
      freshnessStatus: graph.freshness.status,
      nodeCount: graph.metrics.nodeCount,
      edgeCount: graph.metrics.edgeCount,
      knownCount: graph.metrics.knownCount,
      candidateCount: graph.metrics.candidateCount,
      unsupportedCount: graph.metrics.unsupportedCount,
    },
    selectedAnchors,
    deferredAnchors,
    warnings,
    nonClaims: [...FACT_GRAPH_REPORT_NON_CLAIMS],
  };
}

export function buildReactWebFactGraphConsumerDryRun(
  filePath: string,
  cwd = process.cwd(),
  options: ReactWebFactGraphConsumerOptions = {},
): ReactWebFactGraphConsumerDryRun {
  return selectReactWebFactGraphAnchors(buildReactWebFactGraphInspection(filePath, cwd), options);
}

export function renderReactWebFactGraphConsumerDryRunText(dryRun: ReactWebFactGraphConsumerDryRun): string {
  const lines = [
    `React Web fact graph consumer dry-run (${dryRun.schemaVersion})`,
    `Command: ${dryRun.command}`,
    `In scope: ${dryRun.inScope}${dryRun.skippedReason ? ` (${dryRun.skippedReason})` : ""}`,
    `Policy: reportOnly=${dryRun.selectionPolicy.reportOnly}, authorization=${dryRun.selectionPolicy.authorization}, maxAnchors=${dryRun.selectionPolicy.maxAnchors}`,
    `Graph: ${dryRun.graphSummary.nodeCount} node(s), ${dryRun.graphSummary.edgeCount} edge(s), freshness=${dryRun.graphSummary.freshnessStatus}`,
    `Selected anchors: ${dryRun.selectedAnchors.length}`,
    ...dryRun.selectedAnchors.map((anchor) => `- #${anchor.rank} ${anchor.anchorType}:${anchor.kind} ${anchor.label} (${anchor.confidence}, priority=${anchor.priority})`),
    `Deferred anchors: ${dryRun.deferredAnchors.length}`,
  ];
  if (dryRun.warnings.length > 0) {
    lines.push("Warnings:", ...dryRun.warnings.map((warning) => `- ${warning}`));
  }
  if (dryRun.nonClaims.length > 0) {
    lines.push("Non-claims:", ...dryRun.nonClaims.map((claim) => `- ${claim}`));
  }
  return `${lines.join("\n")}\n`;
}
