import { FACT_GRAPH_REPORT_NON_CLAIMS, FACT_GRAPH_REPORT_SCHEMA_VERSION, type FactGraphFreshnessStatus, type FactGraphReport } from "./fact-graph";
import {
  REACT_WEB_FACT_GRAPH_EXTRACTOR_ID,
  REACT_WEB_FACT_GRAPH_EXTRACTOR_VERSION,
  buildReactWebFactGraphInspection,
  type ReactWebFactGraphInspection,
} from "./react-web-fact-graph";
import { REACT_WEB_CONTEXT_METADATA_SCHEMA_VERSION, type SourceFingerprint } from "./schema";

export const REACT_WEB_FACT_GRAPH_FRESHNESS_SCHEMA_VERSION = "react-web-fact-graph-freshness.v1" as const;
export const REACT_WEB_FACT_GRAPH_FRESHNESS_COMMAND = "inspect react-web-fact-graph-freshness" as const;
export const REACT_WEB_FACT_GRAPH_FRESHNESS_CLAIM_BOUNDARY =
  "React Web fact graph freshness verification is advisory and report-only: it compares current expected source/schema/extractor metadata with graph metadata for inspection only and does not authorize runtime, pre-read, cache, setup-readiness, or model-facing reuse; it does not claim token, cost, latency, billing, cache-performance, provider-cost, or provider-token savings." as const;

export type ReactWebFactGraphFreshnessCheck =
  | "sourceFingerprint"
  | "extractorVersion"
  | "reactWebContextSchemaVersion"
  | "factGraphSchemaVersion";

export type ReactWebFactGraphFreshnessCheckStatus = "match" | "mismatch" | "missing";

export type ReactWebFactGraphFreshnessExpected = {
  sourceFingerprint?: SourceFingerprint;
  extractorVersion?: string;
  reactWebContextSchemaVersion?: string;
  factGraphSchemaVersion?: string;
};

export type ReactWebFactGraphFreshnessActual = {
  sourceFingerprint?: SourceFingerprint;
  extractorVersion?: string;
  reactWebContextSchemaVersion?: string;
  factGraphSchemaVersion?: string;
};

export type ReactWebFactGraphFreshnessVerification = {
  schemaVersion: typeof REACT_WEB_FACT_GRAPH_FRESHNESS_SCHEMA_VERSION;
  command: typeof REACT_WEB_FACT_GRAPH_FRESHNESS_COMMAND;
  profile: "react-web";
  advisoryOnly: true;
  inScope: boolean;
  skippedReason?: string;
  status: FactGraphFreshnessStatus;
  checks: Record<ReactWebFactGraphFreshnessCheck, ReactWebFactGraphFreshnessCheckStatus>;
  expected: ReactWebFactGraphFreshnessExpected;
  actual: ReactWebFactGraphFreshnessActual;
  staleReasons: string[];
  warnings: string[];
  nonClaims: string[];
  policy: {
    reportOnly: true;
    authorizesRuntime: false;
    authorizesPreRead: false;
    authorizesCache: false;
    authorizesModelFacingReuse: false;
  };
};

export type ReactWebFactGraphFreshnessSummary = Pick<
  ReactWebFactGraphFreshnessVerification,
  "schemaVersion" | "status" | "checks" | "staleReasons" | "warnings"
>;

function firstGraphFingerprint(graph: FactGraphReport): SourceFingerprint | undefined {
  return graph.freshness.sourceFingerprints[0] ?? graph.nodes.flatMap((node) => node.sourceRefs).find((ref) => ref.fingerprint)?.fingerprint ?? graph.edges.flatMap((edge) => edge.sourceRefs).find((ref) => ref.fingerprint)?.fingerprint;
}

export function buildReactWebFactGraphFreshnessExpected(
  inspection: ReactWebFactGraphInspection,
  overrides: ReactWebFactGraphFreshnessExpected = {},
): ReactWebFactGraphFreshnessExpected {
  return {
    sourceFingerprint: firstGraphFingerprint(inspection.graph),
    extractorVersion: REACT_WEB_FACT_GRAPH_EXTRACTOR_VERSION,
    reactWebContextSchemaVersion: REACT_WEB_CONTEXT_METADATA_SCHEMA_VERSION,
    factGraphSchemaVersion: FACT_GRAPH_REPORT_SCHEMA_VERSION,
    ...overrides,
  };
}

function actualFor(inspection: ReactWebFactGraphInspection): ReactWebFactGraphFreshnessActual {
  return {
    sourceFingerprint: firstGraphFingerprint(inspection.graph),
    extractorVersion: inspection.graph.freshness.extractorVersions[REACT_WEB_FACT_GRAPH_EXTRACTOR_ID],
    reactWebContextSchemaVersion: inspection.graph.freshness.extractorVersions.reactWebContext,
    factGraphSchemaVersion: inspection.graph.schemaVersion,
  };
}

function sameFingerprint(left: SourceFingerprint, right: SourceFingerprint): boolean {
  return left.fileHash === right.fileHash && left.lineCount === right.lineCount;
}

function checkVersion(expected: string | undefined, actual: string | undefined): ReactWebFactGraphFreshnessCheckStatus {
  if (!expected || !actual) return "missing";
  return expected === actual ? "match" : "mismatch";
}

function checkFingerprint(expected: SourceFingerprint | undefined, actual: SourceFingerprint | undefined): ReactWebFactGraphFreshnessCheckStatus {
  if (!expected || !actual) return "missing";
  return sameFingerprint(expected, actual) ? "match" : "mismatch";
}

function statusFor(checks: Record<ReactWebFactGraphFreshnessCheck, ReactWebFactGraphFreshnessCheckStatus>): FactGraphFreshnessStatus {
  if (Object.values(checks).some((status) => status === "mismatch")) return "stale";
  if (Object.values(checks).some((status) => status === "missing")) return "unknown";
  return "fresh";
}

function staleReasonsFor(checks: Record<ReactWebFactGraphFreshnessCheck, ReactWebFactGraphFreshnessCheckStatus>): string[] {
  return Object.entries(checks).flatMap(([check, status]) => {
    if (status === "match") return [];
    return [`${check}:${status}`];
  });
}

export function summarizeReactWebFactGraphFreshnessVerification(
  verification: ReactWebFactGraphFreshnessVerification,
): ReactWebFactGraphFreshnessSummary {
  return {
    schemaVersion: verification.schemaVersion,
    status: verification.status,
    checks: verification.checks,
    staleReasons: verification.staleReasons,
    warnings: verification.warnings,
  };
}

export function verifyReactWebFactGraphFreshness(
  inspection: ReactWebFactGraphInspection,
  expected: ReactWebFactGraphFreshnessExpected = buildReactWebFactGraphFreshnessExpected(inspection),
): ReactWebFactGraphFreshnessVerification {
  const actual = actualFor(inspection);
  const checks = {
    sourceFingerprint: checkFingerprint(expected.sourceFingerprint, actual.sourceFingerprint),
    extractorVersion: checkVersion(expected.extractorVersion, actual.extractorVersion),
    reactWebContextSchemaVersion: checkVersion(expected.reactWebContextSchemaVersion, actual.reactWebContextSchemaVersion),
    factGraphSchemaVersion: checkVersion(expected.factGraphSchemaVersion, actual.factGraphSchemaVersion),
  } satisfies Record<ReactWebFactGraphFreshnessCheck, ReactWebFactGraphFreshnessCheckStatus>;
  const status = statusFor(checks);
  const staleReasons = staleReasonsFor(checks);
  const warnings: string[] = [REACT_WEB_FACT_GRAPH_FRESHNESS_CLAIM_BOUNDARY];
  if (status === "stale") warnings.push("React Web fact graph metadata is stale; fallback to current source inspection before using graph anchors.");
  if (status === "unknown") warnings.push("React Web fact graph freshness is unknown; fallback to current source inspection before using graph anchors.");

  return {
    schemaVersion: REACT_WEB_FACT_GRAPH_FRESHNESS_SCHEMA_VERSION,
    command: REACT_WEB_FACT_GRAPH_FRESHNESS_COMMAND,
    profile: "react-web",
    advisoryOnly: true,
    inScope: inspection.inScope,
    ...(inspection.skippedReason ? { skippedReason: inspection.skippedReason } : {}),
    status,
    checks,
    expected,
    actual,
    staleReasons,
    warnings,
    nonClaims: [...FACT_GRAPH_REPORT_NON_CLAIMS],
    policy: {
      reportOnly: true,
      authorizesRuntime: false,
      authorizesPreRead: false,
      authorizesCache: false,
      authorizesModelFacingReuse: false,
    },
  };
}

export function buildReactWebFactGraphFreshnessVerification(
  filePath: string,
  cwd = process.cwd(),
  expectedOverrides: ReactWebFactGraphFreshnessExpected = {},
): ReactWebFactGraphFreshnessVerification {
  const inspection = buildReactWebFactGraphInspection(filePath, cwd);
  return verifyReactWebFactGraphFreshness(inspection, buildReactWebFactGraphFreshnessExpected(inspection, expectedOverrides));
}

export function renderReactWebFactGraphFreshnessVerificationText(verification: ReactWebFactGraphFreshnessVerification): string {
  const lines = [
    `React Web fact graph freshness (${verification.schemaVersion})`,
    `Command: ${verification.command}`,
    `In scope: ${verification.inScope}${verification.skippedReason ? ` (${verification.skippedReason})` : ""}`,
    `Status: ${verification.status}`,
    "Checks:",
    ...Object.entries(verification.checks).map(([check, status]) => `- ${check}: ${status}`),
  ];
  if (verification.staleReasons.length > 0) {
    lines.push("Stale/unknown reasons:", ...verification.staleReasons.map((reason) => `- ${reason}`));
  }
  if (verification.status !== "fresh") {
    lines.push("Fallback: inspect the current source before relying on graph anchors.");
  }
  if (verification.warnings.length > 0) {
    lines.push("Warnings:", ...verification.warnings.map((warning) => `- ${warning}`));
  }
  if (verification.nonClaims.length > 0) {
    lines.push("Non-claims:", ...verification.nonClaims.map((claim) => `- ${claim}`));
  }
  return `${lines.join("\n")}\n`;
}
