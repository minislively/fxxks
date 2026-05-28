import type { SourceFingerprint, SourceRange } from "./schema";

export const FACT_GRAPH_REPORT_SCHEMA_VERSION = "fact-graph-report.v1" as const;
export const FACT_GRAPH_REPORT_PRODUCER = "fooks" as const;
export const FACT_GRAPH_REPORT_CLAIM_BOUNDARY =
  "Local source-backed fact graph report only: captures observed nodes and edges with source references for planning and inspection. This report does not authorize runtime reuse, pre-read reuse, cache reuse, setup-readiness reuse, or model-facing payload reuse; does not promote React Web, backend, database, React Native, WebView, or TUI support; and does not claim token, cost, latency, billing, cache-performance, or provider savings.";

export const FACT_GRAPH_REPORT_NON_CLAIMS = [
  "does not authorize runtime reuse",
  "does not authorize pre-read reuse",
  "does not authorize cache reuse",
  "does not authorize setup-readiness reuse",
  "does not authorize model-facing payload reuse",
  "does not claim token, cost, latency, billing, cache-performance, provider-cost, or provider-token savings",
  "does not promote frontend, backend, database, React Native, WebView, or TUI support by itself",
] as const;

export type FactGraphDomain = string;
export type FactGraphConfidence = "known" | "candidate" | "unsupported";
export type FactGraphFreshnessStatus = "fresh" | "stale" | "unknown";

export type FactGraphExtractorRef = {
  id: string;
  version: string;
};

export type FactGraphSourceRef = {
  filePath: string;
  loc?: SourceRange;
  fingerprint?: SourceFingerprint;
  extractor: FactGraphExtractorRef;
};

export type FactGraphPrimitive = string | number | boolean;
export type FactGraphPropertyValue = FactGraphPrimitive | FactGraphPrimitive[];
export type FactGraphProperties = Record<string, FactGraphPropertyValue>;

export type FactNode = {
  id: string;
  domain: FactGraphDomain;
  kind: string;
  label: string;
  confidence: FactGraphConfidence;
  sourceRefs: FactGraphSourceRef[];
  evidence: string[];
  properties?: FactGraphProperties;
};

export type FactEdge = {
  id: string;
  domain: FactGraphDomain;
  kind: string;
  from: string;
  to: string;
  confidence: FactGraphConfidence;
  sourceRefs: FactGraphSourceRef[];
  evidence: string[];
  properties?: FactGraphProperties;
};

export type FactGraphFreshness = {
  status: FactGraphFreshnessStatus;
  staleWhen: string[];
  sourceFingerprints: SourceFingerprint[];
  extractorVersions: Record<string, string>;
};

export type FactGraphReportPolicy = {
  reportOnly: true;
  runtimeAuthorized: false;
  candidatesAuthorizeRuntime: false;
};

export type FactGraphReportMetrics = {
  nodeCount: number;
  edgeCount: number;
  knownCount: number;
  candidateCount: number;
  unsupportedCount: number;
};

export type FactGraphReport = {
  schemaVersion: typeof FACT_GRAPH_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  producer: typeof FACT_GRAPH_REPORT_PRODUCER;
  scope: {
    files: string[];
    domain: FactGraphDomain;
  };
  claimBoundary: typeof FACT_GRAPH_REPORT_CLAIM_BOUNDARY | string;
  policy: FactGraphReportPolicy;
  freshness: FactGraphFreshness;
  nodes: FactNode[];
  edges: FactEdge[];
  metrics: FactGraphReportMetrics;
  warnings: string[];
  nonClaims: string[];
};

export type BuildFactGraphReportOptions = {
  generatedAt?: string;
  scope: FactGraphReport["scope"];
  freshness: FactGraphFreshness;
  nodes?: FactNode[];
  edges?: FactEdge[];
  warnings?: string[];
};

export function buildFactGraphMetrics(nodes: FactNode[] = [], edges: FactEdge[] = []): FactGraphReportMetrics {
  const confidences = [...nodes.map((node) => node.confidence), ...edges.map((edge) => edge.confidence)];
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    knownCount: confidences.filter((confidence) => confidence === "known").length,
    candidateCount: confidences.filter((confidence) => confidence === "candidate").length,
    unsupportedCount: confidences.filter((confidence) => confidence === "unsupported").length,
  };
}

export function buildFactGraphReport(options: BuildFactGraphReportOptions): FactGraphReport {
  const nodes = options.nodes ?? [];
  const edges = options.edges ?? [];
  return {
    schemaVersion: FACT_GRAPH_REPORT_SCHEMA_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    producer: FACT_GRAPH_REPORT_PRODUCER,
    scope: options.scope,
    claimBoundary: FACT_GRAPH_REPORT_CLAIM_BOUNDARY,
    policy: {
      reportOnly: true,
      runtimeAuthorized: false,
      candidatesAuthorizeRuntime: false,
    },
    freshness: options.freshness,
    nodes,
    edges,
    metrics: buildFactGraphMetrics(nodes, edges),
    warnings: options.warnings ?? [],
    nonClaims: [...FACT_GRAPH_REPORT_NON_CLAIMS],
  };
}
