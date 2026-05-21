import fs from "node:fs";
import path from "node:path";
import { hashText } from "../core/hash";
import {
  REACT_WEB_EVIDENCE_ARTIFACT_CLAIM_BOUNDARY,
  REACT_WEB_EVIDENCE_ARTIFACT_INTEROP,
  type ReactWebEvidenceArtifact,
  type ReactWebEvidenceArtifactInterop,
  readReactWebEvidenceArtifact,
  reactWebEvidenceArtifactsDir,
} from "./react-web-evidence-artifact";
import { buildReactWebActivationMode, summarizeReactWebActivationMode, type ReactWebActivationModeSummary } from "./react-web-activation-mode";
import { buildReactWebRankedBundle, summarizeReactWebRankedBundle, type ReactWebRankedBundleSummary } from "./react-web-ranked-bundle";
import type { SourceFingerprint } from "../core/schema";
import type { AuthoritativeResumePacket } from "../ops/source-of-truth-handoff";

export const REACT_WEB_STATUS_SCHEMA_VERSION = 1;
export const REACT_WEB_STATUS_COMMAND = "status react-web";
export const REACT_WEB_STATUS_CLAIM_BOUNDARY =
  "Local React Web source-context decision status only: summarizes existing bounded evidence artifacts without emitting new artifacts, changing runtime behavior, or broadening support or performance claims.";
export const REACT_WEB_RELIABILITY_HANDOFF_CLAIM_BOUNDARY =
  "React Web-facing reliability handoff cue only: projects existing authoritativeResumePacket reliability/reset/compact handoff fields without changing stale-context detector scope, provider/runtime hooks, token or billing proof, merge policy, product claims, or frontend behavior.";

export type ReactWebProfileStatus = "ready" | "partial" | "blocked";
export type ReactWebBoundaryState = "bounded" | "blocked" | "advisory-only";
export type ReactWebFreshnessState = "current" | "stale" | "missing-source-file" | "unavailable";
export type ReactWebReliabilityHandoffStatus = "unavailable" | "clear" | "advisory" | "stop-before-more-execution";

export type ReactWebReliabilityHandoffCue = {
  available: boolean;
  status: ReactWebReliabilityHandoffStatus;
  source: "authoritativeResumePacket" | "not-provided";
  claimBoundary: typeof REACT_WEB_RELIABILITY_HANDOFF_CLAIM_BOUNDARY;
  derivedFrom: string[];
  summary: {
    planningWarningCount: number;
    combinedReliabilityWarningCount: number;
    longRunBudgetWarningCount: number;
    resetCompactHandoffRecommendationCount: number;
    staleContextReliabilityOverlap: boolean;
    longRunBudgetRiskLevel: "high" | "clear" | "unknown";
    stopBeforeMoreExecution: boolean;
  };
  recommendedAction: AuthoritativeResumePacket["nextSessionAdvisory"]["action"] | "run-handoff-resume-json";
  requiredRechecks: string[];
  forbiddenClaims: string[];
  operatorCue: string;
};

export type ReactWebStatusOptions = {
  authoritativeResumePacket?: AuthoritativeResumePacket | null;
};

export type ReactWebStatusResult = {
  schemaVersion: typeof REACT_WEB_STATUS_SCHEMA_VERSION;
  command: typeof REACT_WEB_STATUS_COMMAND;
  profile: "react-web";
  generatedAt: string;
  claimBoundary: typeof REACT_WEB_STATUS_CLAIM_BOUNDARY;
  interop: ReactWebEvidenceArtifactInterop;
  profileStatus: ReactWebProfileStatus;
  latestEvidenceId: string | null;
  latestEvidenceGeneratedAt: string | null;
  latestDecision: ReactWebEvidenceArtifact["decision"] | null;
  evidenceStrength: ReactWebEvidenceArtifact["evidenceStrength"] | null;
  latestFilePath: string | null;
  repeatedSameFileReady: boolean;
  fallbackReasons: string[];
  boundaryStatus: {
    mixedRouting: {
      status: ReactWebBoundaryState;
      reasons: string[];
    };
    projectKnowledge: {
      status: ReactWebBoundaryState;
      reasons: string[];
    };
  };
  freshness: {
    status: ReactWebFreshnessState;
    sourceFingerprint: SourceFingerprint | null;
    currentSourceFingerprint: SourceFingerprint | null;
    staleWhen: string[];
  };
  activationMode: ReactWebActivationModeSummary;
  rankedBundle: ReactWebRankedBundleSummary;
  reliabilityHandoff: ReactWebReliabilityHandoffCue;
  risks: string[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function latestArtifactIndexPath(cwd: string): string {
  return path.join(reactWebEvidenceArtifactsDir(cwd), "latest.json");
}

function currentSourceFingerprint(filePath: string): SourceFingerprint | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const source = fs.readFileSync(filePath, "utf8");
  return {
    fileHash: hashText(source),
    lineCount: source.split(/\r?\n/u).length,
  };
}

function buildReactWebReliabilityHandoffCue(
  authoritativeResumePacket: AuthoritativeResumePacket | null | undefined,
): ReactWebReliabilityHandoffCue {
  if (!authoritativeResumePacket) {
    return {
      available: false,
      status: "unavailable",
      source: "not-provided",
      claimBoundary: REACT_WEB_RELIABILITY_HANDOFF_CLAIM_BOUNDARY,
      derivedFrom: [
        "authoritativeResumePacket.reliabilityBoundary",
        "authoritativeResumePacket.nextSessionAdvisory",
        "authoritativeResumePacket.forbiddenClaims",
      ],
      summary: {
        planningWarningCount: 0,
        combinedReliabilityWarningCount: 0,
        longRunBudgetWarningCount: 0,
        resetCompactHandoffRecommendationCount: 0,
        staleContextReliabilityOverlap: false,
        longRunBudgetRiskLevel: "unknown",
        stopBeforeMoreExecution: false,
      },
      recommendedAction: "run-handoff-resume-json",
      requiredRechecks: ["Run fooks handoff --resume-json, then pass that packet to status react-web --handoff-resume-json <file> for React Web-facing reliability cues."],
      forbiddenClaims: [
        "provider billing/runtime proof",
        "merge-gate policy change",
        "frontend runtime behavior change",
      ],
      operatorCue: "No compact handoff packet was provided; React Web reliability handoff cues are unavailable on this status run.",
    };
  }

  const boundary = authoritativeResumePacket.reliabilityBoundary;
  const hasReliabilityWarnings =
    boundary.planningWarningCount > 0 ||
    boundary.combinedReliabilityWarningCount > 0 ||
    boundary.longRunBudgetWarningCount > 0 ||
    boundary.resetCompactHandoffRecommendationCount > 0 ||
    boundary.staleContextReliabilityOverlap;
  const status: ReactWebReliabilityHandoffStatus = boundary.stopBeforeMoreExecution
    ? "stop-before-more-execution"
    : hasReliabilityWarnings
      ? "advisory"
      : "clear";
  const operatorCue = boundary.stopBeforeMoreExecution
    ? "Stop before more React Web-oriented execution; use the compact handoff packet, recheck current authority, then resume from fresh context."
    : hasReliabilityWarnings
      ? "React Web-oriented execution has reliability handoff advisories; reset context, compact current source of truth, or hand off before another long run when indicated."
      : "No reliability handoff warnings are present in the provided compact handoff packet.";

  return {
    available: true,
    status,
    source: "authoritativeResumePacket",
    claimBoundary: REACT_WEB_RELIABILITY_HANDOFF_CLAIM_BOUNDARY,
    derivedFrom: [
      "authoritativeResumePacket.reliabilityBoundary",
      "authoritativeResumePacket.nextSessionAdvisory",
      "authoritativeResumePacket.forbiddenClaims",
    ],
    summary: {
      planningWarningCount: boundary.planningWarningCount,
      combinedReliabilityWarningCount: boundary.combinedReliabilityWarningCount,
      longRunBudgetWarningCount: boundary.longRunBudgetWarningCount,
      resetCompactHandoffRecommendationCount: boundary.resetCompactHandoffRecommendationCount,
      staleContextReliabilityOverlap: boundary.staleContextReliabilityOverlap,
      longRunBudgetRiskLevel: boundary.longRunBudgetRiskLevel,
      stopBeforeMoreExecution: boundary.stopBeforeMoreExecution,
    },
    recommendedAction: authoritativeResumePacket.nextSessionAdvisory.action,
    requiredRechecks: authoritativeResumePacket.nextSessionAdvisory.requiredRechecks,
    forbiddenClaims: authoritativeResumePacket.forbiddenClaims,
    operatorCue,
  };
}

function sourceFingerprintsEqual(left: SourceFingerprint | undefined, right: SourceFingerprint | null): boolean {
  if (!left || !right) return false;
  return left.fileHash === right.fileHash && left.lineCount === right.lineCount;
}

function buildBlockedNoEvidenceStatus(cwd: string, generatedAt: string): ReactWebStatusResult {
  return {
    schemaVersion: REACT_WEB_STATUS_SCHEMA_VERSION,
    command: REACT_WEB_STATUS_COMMAND,
    profile: "react-web",
    generatedAt,
    claimBoundary: REACT_WEB_STATUS_CLAIM_BOUNDARY,
    interop: { ...REACT_WEB_EVIDENCE_ARTIFACT_INTEROP },
    profileStatus: "blocked",
    latestEvidenceId: null,
    latestEvidenceGeneratedAt: null,
    latestDecision: null,
    evidenceStrength: null,
    latestFilePath: null,
    repeatedSameFileReady: false,
    fallbackReasons: [],
    boundaryStatus: {
      mixedRouting: {
        status: "bounded",
        reasons: ["no latest React Web evidence artifact recorded yet"],
      },
      projectKnowledge: {
        status: "advisory-only",
        reasons: ["project knowledge remains an advisory-only boundary and is not promoted to runtime execution authority"],
      },
    },
    freshness: {
      status: "unavailable",
      sourceFingerprint: null,
      currentSourceFingerprint: null,
      staleWhen: [],
    },
    activationMode: summarizeReactWebActivationMode(null),
    rankedBundle: summarizeReactWebRankedBundle(null),
    reliabilityHandoff: buildReactWebReliabilityHandoffCue(null),
    risks: [
      `no React Web evidence artifact found at ${path.relative(cwd, latestArtifactIndexPath(cwd)) || ".fooks/artifacts/react-web-evidence/latest.json"}`,
    ],
  };
}

function buildMixedRoutingBoundary(artifact: ReactWebEvidenceArtifact): ReactWebStatusResult["boundaryStatus"]["mixedRouting"] {
  const boundaryReasons = artifact.whyDenied.filter(
    (reason) => reason === "unsupported-react-native-webview-boundary" || reason.startsWith("unsupported-classification:"),
  );
  if (boundaryReasons.length > 0) {
    return {
      status: "blocked",
      reasons: uniqueSorted(boundaryReasons),
    };
  }
  return {
    status: "bounded",
    reasons: ["latest evidence stays within the React Web source-context boundary"],
  };
}

function buildProjectKnowledgeBoundary(artifact: ReactWebEvidenceArtifact): ReactWebStatusResult["boundaryStatus"]["projectKnowledge"] {
  return {
    status: "advisory-only",
    reasons: uniqueSorted([
      "project knowledge remains advisory-only and is not execution authority",
      artifact.contextModeReason ? `latest context mode reason: ${artifact.contextModeReason}` : "latest context mode reason: none",
    ]),
  };
}

function buildFreshness(cwd: string, artifact: ReactWebEvidenceArtifact): ReactWebStatusResult["freshness"] {
  const sourceFingerprint = artifact.sourceFingerprint ?? null;
  if (!sourceFingerprint) {
    return {
      status: "unavailable",
      sourceFingerprint: null,
      currentSourceFingerprint: null,
      staleWhen: artifact.freshness.staleWhen,
    };
  }

  const resolvedPath = path.resolve(cwd, artifact.filePath);
  const current = currentSourceFingerprint(resolvedPath);
  if (!current) {
    return {
      status: "missing-source-file",
      sourceFingerprint,
      currentSourceFingerprint: null,
      staleWhen: artifact.freshness.staleWhen,
    };
  }

  return {
    status: sourceFingerprintsEqual(sourceFingerprint, current) ? "current" : "stale",
    sourceFingerprint,
    currentSourceFingerprint: current,
    staleWhen: artifact.freshness.staleWhen,
  };
}

function buildRisks(
  artifact: ReactWebEvidenceArtifact,
  freshness: ReactWebStatusResult["freshness"],
  repeatedSameFileReady: boolean,
): string[] {
  const risks: string[] = [];

  if (artifact.decision === "fallback") {
    risks.push(
      `latest React Web decision is fallback${artifact.whyDenied.length > 0 ? `: ${artifact.whyDenied.join(", ")}` : ""}`,
    );
  }
  if (artifact.decision === "deny") {
    risks.push(
      `latest React Web decision is deny${artifact.whyDenied.length > 0 ? `: ${artifact.whyDenied.join(", ")}` : ""}`,
    );
  }
  if (!artifact.sourceFingerprint) {
    risks.push("latest evidence artifact is missing sourceFingerprint freshness data");
  }
  if (!artifact.editGuidance?.patchTargets?.length) {
    risks.push("latest evidence artifact is missing patchTargets for repeated same-file reuse");
  }
  if (artifact.domainPayload?.domain !== "react-web") {
    risks.push("latest evidence artifact is missing a React Web domain payload");
  }
  if (freshness.status === "stale") {
    risks.push("latest evidence artifact is stale against the current source file");
  }
  if (freshness.status === "missing-source-file") {
    risks.push("latest evidence source file is missing from the working tree");
  }
  if (!repeatedSameFileReady && artifact.decision === "use") {
    risks.push("latest evidence artifact is not yet strong enough to report repeated same-file ready");
  }

  return uniqueSorted(risks);
}

function deriveProfileStatus(
  artifact: ReactWebEvidenceArtifact,
  mixedRoutingStatus: ReactWebStatusResult["boundaryStatus"]["mixedRouting"]["status"],
  freshness: ReactWebStatusResult["freshness"]["status"],
  repeatedSameFileReady: boolean,
  risks: string[],
): ReactWebProfileStatus {
  if (artifact.decision === "deny" || mixedRoutingStatus === "blocked") {
    return "blocked";
  }
  if (artifact.decision === "fallback") {
    return "partial";
  }
  if (freshness !== "current" || !repeatedSameFileReady || risks.length > 0) {
    return "partial";
  }
  return "ready";
}

export function readReactWebStatus(cwd = process.cwd(), options: ReactWebStatusOptions = {}): ReactWebStatusResult {
  const generatedAt = new Date().toISOString();
  if (!fs.existsSync(latestArtifactIndexPath(cwd))) {
    return {
      ...buildBlockedNoEvidenceStatus(cwd, generatedAt),
      reliabilityHandoff: buildReactWebReliabilityHandoffCue(options.authoritativeResumePacket),
    };
  }

  const artifact = readReactWebEvidenceArtifact(cwd, "latest");
  const freshness = buildFreshness(cwd, artifact);
  const repeatedSameFileReady =
    artifact.decision === "use" &&
    artifact.domainPayload?.domain === "react-web" &&
    Boolean(artifact.sourceFingerprint) &&
    freshness.status === "current" &&
    Boolean(artifact.editGuidance?.patchTargets?.length);
  const mixedRouting = buildMixedRoutingBoundary(artifact);
  const projectKnowledge = buildProjectKnowledgeBoundary(artifact);
  const fallbackReasons = artifact.decision === "use" ? [] : uniqueSorted(artifact.whyDenied);
  const activationMode = buildReactWebActivationMode(cwd, artifact);
  const rankedBundle = buildReactWebRankedBundle(artifact);
  const risks = buildRisks(artifact, freshness, repeatedSameFileReady);

  return {
    schemaVersion: REACT_WEB_STATUS_SCHEMA_VERSION,
    command: REACT_WEB_STATUS_COMMAND,
    profile: "react-web",
    generatedAt,
    claimBoundary: REACT_WEB_STATUS_CLAIM_BOUNDARY,
    interop: artifact.interop,
    profileStatus: deriveProfileStatus(artifact, mixedRouting.status, freshness.status, repeatedSameFileReady, risks),
    latestEvidenceId: artifact.id,
    latestEvidenceGeneratedAt: artifact.generatedAt,
    latestDecision: artifact.decision,
    evidenceStrength: artifact.evidenceStrength,
    latestFilePath: artifact.filePath,
    repeatedSameFileReady,
    fallbackReasons,
    boundaryStatus: {
      mixedRouting,
      projectKnowledge,
    },
    freshness,
    activationMode: summarizeReactWebActivationMode(activationMode),
    rankedBundle: summarizeReactWebRankedBundle(rankedBundle),
    reliabilityHandoff: buildReactWebReliabilityHandoffCue(options.authoritativeResumePacket),
    risks,
  };
}

export function renderReactWebStatusText(status: ReactWebStatusResult): string {
  const risks = status.risks.length > 0 ? status.risks.map((risk) => `- ${risk}`).join("\n") : "- none";
  const fallbackReasons = status.fallbackReasons.length > 0 ? status.fallbackReasons.join(", ") : "none";
  const profileGateReasons = status.activationMode.profileGateReasons.length > 0
    ? status.activationMode.profileGateReasons.join(", ")
    : "none";
  const globMatchReasons = status.activationMode.globMatchReasons.length > 0
    ? status.activationMode.globMatchReasons.join(", ")
    : "none";
  const requiredRechecks = status.reliabilityHandoff.requiredRechecks.length > 0
    ? status.reliabilityHandoff.requiredRechecks.map((recheck) => `- ${recheck}`).join("\n")
    : "- none";
  return [
    "# React Web status",
    "",
    status.claimBoundary,
    "",
    "## Summary",
    `- profile status: ${status.profileStatus}`,
    `- interop: stored=${status.interop.mayBeStored ? "yes" : "no"}, summarized=${status.interop.mayBeSummarized ? "yes" : "no"}, override=${status.interop.mayOverrideDecision ? "yes" : "no"}`,
    `- latest evidence id: ${status.latestEvidenceId ?? "none"}`,
    `- latest decision: ${status.latestDecision ?? "none"}`,
    `- evidence strength: ${status.evidenceStrength ?? "none"}`,
    `- repeated same-file ready: ${status.repeatedSameFileReady ? "yes" : "no"}`,
    `- fallback reasons: ${fallbackReasons}`,
    `- mixed-routing boundary: ${status.boundaryStatus.mixedRouting.status}`,
    `- project-knowledge boundary: ${status.boundaryStatus.projectKnowledge.status}`,
    `- freshness: ${status.freshness.status}`,
    `- activation mode: ${status.activationMode.verdict} (repeated-file positive=${status.activationMode.repeatedFilePositive ? "yes" : "no"})`,
    `- promoted trigger: ${status.activationMode.promotedTrigger ?? "none"}`,
    `- profile-gate runtime gate: ${status.activationMode.profileGateVerdict} (${profileGateReasons})`,
    `- glob-match runtime gate: ${status.activationMode.globMatchVerdict} (${globMatchReasons})`,
    `- ranked bundle: ${status.rankedBundle.verdict} (${status.rankedBundle.selectedCount}/${status.rankedBundle.budgetLimit ?? 0} selected, ${status.rankedBundle.deferredCount} deferred)`,
    `- reliability handoff: ${status.reliabilityHandoff.status} (source=${status.reliabilityHandoff.source})`,
    "",
    "## Risks",
    risks,
    "",
    "## Reliability handoff",
    status.reliabilityHandoff.claimBoundary,
    "",
    `- available: ${status.reliabilityHandoff.available ? "yes" : "no"}`,
    `- operator cue: ${status.reliabilityHandoff.operatorCue}`,
    `- recommended action: ${status.reliabilityHandoff.recommendedAction}`,
    `- stale/context overlap: ${status.reliabilityHandoff.summary.staleContextReliabilityOverlap ? "yes" : "no"}`,
    `- long-run budget risk: ${status.reliabilityHandoff.summary.longRunBudgetRiskLevel}`,
    `- reset/compact handoff recommendations: ${status.reliabilityHandoff.summary.resetCompactHandoffRecommendationCount}`,
    `- stop before more execution: ${status.reliabilityHandoff.summary.stopBeforeMoreExecution ? "yes" : "no"}`,
    "",
    "### Required rechecks",
    requiredRechecks,
    "",
  ].join("\n");
}
