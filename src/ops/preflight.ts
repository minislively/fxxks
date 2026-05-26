import type { OperatorContextTrustEntry } from "./context-trust";
import type { OperatorCheckSnapshot } from "./operator-check";

export const PREFLIGHT_SCHEMA_VERSION = 1;
export const PREFLIGHT_COMMAND = "preflight";
export const PREFLIGHT_SOURCE = "operator-check/contextTrust preflight projection";
export const PREFLIGHT_CLAIM_BOUNDARY =
  "Read-only preflight projection over the already-assembled operator-check/contextTrust snapshot; it adds compact agent guidance without performing evidence collection, stale detection, handoff generation, hook enforcement, instruction persistence, or token/cost telemetry.";

export type PreflightRiskLevel = "low" | "medium" | "high";

export type PreflightRecommendedAction =
  | "continue-with-current-authority"
  | "create-or-link-active-artifact"
  | "adopt-or-report-live-handoff"
  | "write-bounded-closeout-receipt"
  | "resolve-blockers-first";

export type PreflightAuthorityStatus = "present" | "missing" | "blocked";

export type PreflightEvidenceRef = Pick<
  OperatorContextTrustEntry,
  "kind" | "source" | "referenceField" | "count" | "live" | "authority" | "contractScope" | "reason"
>;

export type PreflightPacket = {
  schemaVersion: typeof PREFLIGHT_SCHEMA_VERSION;
  command: typeof PREFLIGHT_COMMAND;
  source: typeof PREFLIGHT_SOURCE;
  claimBoundary: typeof PREFLIGHT_CLAIM_BOUNDARY;
  derivedFrom: {
    operatorCheckCommand: "check";
    operatorCheckSchemaVersion: 1;
    contextTrustSchemaVersion: 1;
  };
  summary: {
    authorityStatus: PreflightAuthorityStatus;
    currentAuthoritySummary: string;
    nonAuthorizingSummary: string;
    advisorySummary?: string;
    historicalSummary?: string;
  };
  guidance: {
    riskLevel: PreflightRiskLevel;
    recommendedAction: PreflightRecommendedAction;
    rationale: string;
  };
  currentAuthority: PreflightEvidenceRef[];
  nonAuthorizing: PreflightEvidenceRef[];
  advisoryOnly: PreflightEvidenceRef[];
  historicalOnly: PreflightEvidenceRef[];
};

function evidenceRefs(entries: OperatorContextTrustEntry[]): PreflightEvidenceRef[] {
  return entries.map((entry) => ({
    kind: entry.kind,
    source: entry.source,
    reason: entry.reason,
    ...(entry.referenceField ? { referenceField: entry.referenceField } : {}),
    ...(entry.count !== undefined ? { count: entry.count } : {}),
    ...(entry.live !== undefined ? { live: entry.live } : {}),
    ...(entry.authority ? { authority: entry.authority } : {}),
    contractScope: entry.contractScope,
  }));
}

function summarizeEntries(empty: string, entries: PreflightEvidenceRef[]): string {
  if (entries.length === 0) return empty;
  const kinds = entries.map((entry) => entry.kind).join(", ");
  return `${entries.length} entr${entries.length === 1 ? "y" : "ies"}: ${kinds}`;
}

function headlineFor(packet: PreflightPacket): string {
  if (packet.summary.authorityStatus === "blocked" || packet.guidance.recommendedAction === "resolve-blockers-first") {
    return "Preflight: BLOCK - resolve blockers first";
  }

  if (packet.guidance.recommendedAction === "continue-with-current-authority") {
    return packet.guidance.riskLevel === "low"
      ? "Preflight: OK to continue"
      : "Preflight: WARN - continue with caution";
  }

  if (packet.guidance.recommendedAction === "adopt-or-report-live-handoff") {
    return "Preflight: BLOCK - adopt or report live handoff";
  }

  if (packet.guidance.recommendedAction === "write-bounded-closeout-receipt") {
    return "Preflight: OK - write bounded closeout receipt";
  }

  return "Preflight: BLOCK - active authority needed";
}

function formatEvidenceLine(entry: PreflightEvidenceRef): string {
  const details = [
    entry.count !== undefined ? `count=${entry.count}` : undefined,
    entry.live !== undefined ? `live=${entry.live}` : undefined,
    entry.authority ? `authority=${entry.authority}` : undefined,
    entry.contractScope ? `scope=${entry.contractScope}` : undefined,
  ].filter((detail): detail is string => Boolean(detail));
  return `- ${entry.kind}${details.length > 0 ? ` (${details.join(", ")})` : ""}`;
}

function appendEvidenceSection(lines: string[], title: string, entries: PreflightEvidenceRef[]): void {
  if (entries.length === 0) return;
  lines.push("", `${title}:`);
  for (const entry of entries) {
    lines.push(formatEvidenceLine(entry));
  }
}

function hasStaleOrLocalOnlyResidue(entries: PreflightEvidenceRef[]): boolean {
  return entries.some((entry) =>
    entry.contractScope === "stale-residue-boundary"
    || entry.contractScope === "cleanup-review-boundary"
    || entry.kind.includes("stale")
    || entry.kind.includes("local-only")
  );
}

function appendNotes(lines: string[], packet: PreflightPacket): void {
  const notes: string[] = [];

  if (packet.advisoryOnly.length > 0) {
    notes.push(`advisory guidance present: ${packet.summary.advisorySummary ?? summarizeEntries("no advisory guidance", packet.advisoryOnly)}`);
  }

  if (packet.historicalOnly.length > 0) {
    notes.push(`historical receipts present: ${packet.summary.historicalSummary ?? summarizeEntries("no historical receipts", packet.historicalOnly)}`);
  }

  if (hasStaleOrLocalOnlyResidue(packet.nonAuthorizing)) {
    notes.push("stale/local-only residue is cleanup-review context, not active-work authority");
  }

  notes.push("no cleanup, authority creation, hook enforcement, or new evidence collection was performed");

  if (notes.length === 0) return;
  lines.push("", "Notes:");
  for (const note of notes) {
    lines.push(`- ${note}`);
  }
}

function hasLiveHandoffCandidate(entries: PreflightEvidenceRef[]): boolean {
  return entries.some((entry) =>
    entry.authority === "handoff-candidate"
    && entry.contractScope === "handoff-artifact-boundary"
    && entry.live === true
  );
}

function hasMappedSessionLiveHandoffCaveat(entries: PreflightEvidenceRef[]): boolean {
  return entries.some((entry) =>
    entry.authority === "insufficient"
    && entry.contractScope === "handoff-artifact-boundary"
    && entry.live === false
  );
}

function guidanceFor(
  snapshot: OperatorCheckSnapshot,
  currentAuthority: PreflightEvidenceRef[],
  nonAuthorizing: PreflightEvidenceRef[],
): PreflightPacket["guidance"] {
  const blocked = snapshot.verdict === "blocked" || snapshot.blockers.length > 0;
  if (blocked) {
    return {
      riskLevel: "high",
      recommendedAction: "resolve-blockers-first",
      rationale: "operator-check reports blockers, so resolve the blocked snapshot before using any evidence as the next-work anchor.",
    };
  }

  if (currentAuthority.length > 0) {
    const riskLevel: PreflightRiskLevel = hasMappedSessionLiveHandoffCaveat(nonAuthorizing) ? "medium" : "low";
    return {
      riskLevel,
      recommendedAction: "continue-with-current-authority",
      rationale:
        riskLevel === "medium"
          ? "top-level current authority exists, but live-handoff caveats should be reviewed before continuing."
          : "top-level issue, pull request, or mapped-session authority exists and satisfies the active-work boundary.",
    };
  }

  if (hasLiveHandoffCandidate(nonAuthorizing)) {
    return {
      riskLevel: "high",
      recommendedAction: "adopt-or-report-live-handoff",
      rationale:
        "no top-level current authority exists, but a live non-authorizing handoff candidate exists; adopt/report that artifact instead of inventing current authority.",
    };
  }

  if (snapshot.requiredActiveArtifact.dogfoodHandoff.status === "closeout-receipt-boundary") {
    return {
      riskLevel: "low",
      recommendedAction: "write-bounded-closeout-receipt",
      rationale:
        "clean main with only epic #960 open is a no-new-child closeout boundary; write the bounded #960 closeout receipt without creating a new issue/session, closing #960, or mutating GitHub.",
    };
  }

  return {
    riskLevel: "high",
    recommendedAction: "create-or-link-active-artifact",
    rationale: "no top-level current authority exists; create or link an issue, pull request, or mapped fooks session before continuing work.",
  };
}

export function buildPreflightPacket(snapshot: OperatorCheckSnapshot): PreflightPacket {
  const currentAuthority = evidenceRefs(snapshot.contextTrust.sourceOfTruth.current);
  const nonAuthorizing = evidenceRefs(snapshot.contextTrust.nonAuthorizing);
  const advisoryOnly = evidenceRefs(snapshot.contextTrust.advisoryOnly);
  const historicalOnly = evidenceRefs(snapshot.contextTrust.historicalOnly);
  const blocked = snapshot.verdict === "blocked" || snapshot.blockers.length > 0;
  const authorityStatus: PreflightAuthorityStatus = blocked
    ? "blocked"
    : currentAuthority.length > 0
      ? "present"
      : "missing";

  return {
    schemaVersion: PREFLIGHT_SCHEMA_VERSION,
    command: PREFLIGHT_COMMAND,
    source: PREFLIGHT_SOURCE,
    claimBoundary: PREFLIGHT_CLAIM_BOUNDARY,
    derivedFrom: {
      operatorCheckCommand: snapshot.command,
      operatorCheckSchemaVersion: snapshot.schemaVersion,
      contextTrustSchemaVersion: snapshot.contextTrust.schemaVersion,
    },
    summary: {
      authorityStatus,
      currentAuthoritySummary: summarizeEntries("no top-level issue, pull request, or mapped-session authority", currentAuthority),
      nonAuthorizingSummary: summarizeEntries("no non-authorizing evidence", nonAuthorizing),
      ...(advisoryOnly.length > 0 ? { advisorySummary: summarizeEntries("no advisory guidance", advisoryOnly) } : {}),
      ...(historicalOnly.length > 0 ? { historicalSummary: summarizeEntries("no historical receipts", historicalOnly) } : {}),
    },
    guidance: guidanceFor(snapshot, currentAuthority, nonAuthorizing),
    currentAuthority,
    nonAuthorizing,
    advisoryOnly,
    historicalOnly,
  };
}

export function renderPreflightText(packet: PreflightPacket): string {
  const lines = [
    headlineFor(packet),
    `Risk: ${packet.guidance.riskLevel}`,
    `Action: ${packet.guidance.recommendedAction}`,
    `Authority: ${packet.summary.authorityStatus}`,
    `Rationale: ${packet.guidance.rationale}`,
  ];

  appendEvidenceSection(lines, "Current authority", packet.currentAuthority);
  appendEvidenceSection(lines, "Do not treat as current", packet.nonAuthorizing);
  appendNotes(lines, packet);

  return `${lines.join("\n")}\n`;
}
