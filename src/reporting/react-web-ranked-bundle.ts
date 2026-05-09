import {
  type ReactWebEvidenceArtifact,
  readReactWebEvidenceArtifact,
} from "./react-web-evidence-artifact";
import type { FrontendConcernProfile } from "../core/concern-profiles/types";

export const REACT_WEB_RANKED_BUNDLE_SCHEMA_VERSION = "react-web-ranked-bundle.v1";
export const REACT_WEB_RANKED_BUNDLE_COMMAND = "inspect ranked-bundle";
export const REACT_WEB_RANKED_BUNDLE_MODE = "shadow-diagnostic";
export const REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT = 6;
export const REACT_WEB_RANKED_BUNDLE_CLAIM_BOUNDARY =
  "Local React Web same-file ranked-context diagnostic only: explains which same-file source facts would be prioritized under a bounded budget and why fallback or fail-closed boundaries apply. This surface does not change runtime selection behavior, does not widen React Web support claims, and does not promote RN/TUI/WebView or generic context-manager capabilities.";

export type ReactWebRankedBundleVerdict = "ranked" | "fallback" | "blocked";
export type ReactWebRankedBundleEntryClass = "direct" | "adjacent";
export type ReactWebRankedBundleEntrySource = "patch-target" | "concern-profile" | "domain-payload";

export type ReactWebRankedBundleEntry = {
  label: string;
  entryClass: ReactWebRankedBundleEntryClass;
  source: ReactWebRankedBundleEntrySource;
  priority: number;
  evidence: string[];
};

export type ReactWebRankedBundleResult = {
  schemaVersion: typeof REACT_WEB_RANKED_BUNDLE_SCHEMA_VERSION;
  command: typeof REACT_WEB_RANKED_BUNDLE_COMMAND;
  profile: "react-web";
  mode: typeof REACT_WEB_RANKED_BUNDLE_MODE;
  artifactId: string;
  artifactGeneratedAt: string;
  filePath: string;
  claimBoundary: typeof REACT_WEB_RANKED_BUNDLE_CLAIM_BOUNDARY;
  verdict: ReactWebRankedBundleVerdict;
  runtimeDecision: ReactWebEvidenceArtifact["decision"];
  evidenceStrength: ReactWebEvidenceArtifact["evidenceStrength"];
  budget: {
    limit: number;
    selected: number;
    deferred: number;
    overflow: boolean;
  };
  repeatedSameFileEligible: boolean;
  failClosed: boolean;
  fallbackReasons: string[];
  selected: ReactWebRankedBundleEntry[];
  deferred: ReactWebRankedBundleEntry[];
};

export type ReactWebRankedBundleSummary = {
  available: boolean;
  verdict: ReactWebRankedBundleVerdict | "unavailable";
  budgetLimit: number | null;
  selectedCount: number;
  deferredCount: number;
  overflow: boolean;
  fallbackReasons: string[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function patchTargetPriority(kind: string): number {
  switch (kind) {
    case "component":
      return 100;
    case "props":
      return 95;
    case "effect":
      return 90;
    case "callback":
      return 88;
    case "event-handler":
      return 86;
    case "form-control":
      return 82;
    case "submit-handler":
      return 80;
    case "validation-anchor":
      return 78;
    case "snippet":
      return 70;
    default:
      return 60;
  }
}

function concernPriority(profile: FrontendConcernProfile): number {
  switch (profile.id) {
    case "form-state":
      return 56;
    case "validation-schema":
      return 54;
    case "client-state":
      return 52;
    case "routing":
      return 46;
    case "styling":
      return 36;
    default:
      return 20;
  }
}

function buildPatchTargetEntries(artifact: ReactWebEvidenceArtifact): ReactWebRankedBundleEntry[] {
  return (artifact.editGuidance?.patchTargets ?? []).map((target) => ({
    label: `${target.kind}: ${target.label}`,
    entryClass: "direct",
    source: "patch-target",
    priority: patchTargetPriority(target.kind),
    evidence: uniqueSorted([`editGuidance.patchTargets.${target.kind}`, target.reason]),
  }));
}

function buildConcernProfileEntries(artifact: ReactWebEvidenceArtifact): ReactWebRankedBundleEntry[] {
  return (artifact.concernProfiles ?? []).map((profile) => ({
    label: `${profile.id}: ${profile.signals.slice(0, 3).join(", ") || profile.claim}`,
    entryClass: "adjacent",
    source: "concern-profile",
    priority: concernPriority(profile),
    evidence: uniqueSorted([profile.claim, ...profile.signals.map((signal) => `concern:${signal}`)]),
  }));
}

function buildDomainPayloadEntry(artifact: ReactWebEvidenceArtifact): ReactWebRankedBundleEntry[] {
  if (artifact.domainPayload?.domain !== "react-web") return [];
  return [
    {
      label: `react-web-domain-payload: ${artifact.domainPayload.policy}`,
      entryClass: "adjacent",
      source: "domain-payload",
      priority: 50,
      evidence: uniqueSorted([
        `plannerDecision:${artifact.domainPayload.plannerDecision}`,
        `claimStatus:${artifact.domainPayload.claimStatus}`,
        ...artifact.domainPayload.evidence.slice(0, 4),
      ]),
    },
  ];
}

function failClosedReasons(artifact: ReactWebEvidenceArtifact): string[] {
  return uniqueSorted(
    artifact.whyDenied.filter(
      (reason) => reason === "unsupported-react-native-webview-boundary" || reason.startsWith("unsupported-classification:"),
    ),
  );
}

function compareEntries(left: ReactWebRankedBundleEntry, right: ReactWebRankedBundleEntry): number {
  if (left.priority !== right.priority) return right.priority - left.priority;
  if (left.entryClass !== right.entryClass) return left.entryClass === "direct" ? -1 : 1;
  return left.label.localeCompare(right.label);
}

export function buildReactWebRankedBundle(artifact: ReactWebEvidenceArtifact): ReactWebRankedBundleResult {
  const failClosed = artifact.decision === "deny" || failClosedReasons(artifact).length > 0 || artifact.domainPayload?.domain !== "react-web";
  const fallbackReasons = uniqueSorted([
    ...artifact.whyDenied,
    ...(failClosed ? failClosedReasons(artifact) : []),
  ]);
  const candidates = [...buildPatchTargetEntries(artifact), ...buildConcernProfileEntries(artifact), ...buildDomainPayloadEntry(artifact)].sort(compareEntries);
  const selected = failClosed ? [] : candidates.slice(0, REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT);
  const deferred = failClosed ? candidates : candidates.slice(REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT);
  const overflow = !failClosed && deferred.length > 0;
  const repeatedSameFileEligible =
    artifact.decision === "use" &&
    artifact.domainPayload?.domain === "react-web" &&
    Boolean(artifact.sourceFingerprint) &&
    Boolean(artifact.editGuidance?.patchTargets?.length);

  return {
    schemaVersion: REACT_WEB_RANKED_BUNDLE_SCHEMA_VERSION,
    command: REACT_WEB_RANKED_BUNDLE_COMMAND,
    profile: "react-web",
    mode: REACT_WEB_RANKED_BUNDLE_MODE,
    artifactId: artifact.id,
    artifactGeneratedAt: artifact.generatedAt,
    filePath: artifact.filePath,
    claimBoundary: REACT_WEB_RANKED_BUNDLE_CLAIM_BOUNDARY,
    verdict: failClosed ? "blocked" : artifact.decision === "fallback" || overflow ? "fallback" : "ranked",
    runtimeDecision: artifact.decision,
    evidenceStrength: artifact.evidenceStrength,
    budget: {
      limit: REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT,
      selected: selected.length,
      deferred: deferred.length,
      overflow,
    },
    repeatedSameFileEligible,
    failClosed,
    fallbackReasons: uniqueSorted([...fallbackReasons, ...(overflow ? ["bundle-budget-exceeded"] : [])]),
    selected,
    deferred,
  };
}

export function readReactWebRankedBundle(cwd: string, id: string): ReactWebRankedBundleResult {
  return buildReactWebRankedBundle(readReactWebEvidenceArtifact(cwd, id));
}

export function summarizeReactWebRankedBundle(bundle: ReactWebRankedBundleResult | null): ReactWebRankedBundleSummary {
  if (!bundle) {
    return {
      available: false,
      verdict: "unavailable",
      budgetLimit: null,
      selectedCount: 0,
      deferredCount: 0,
      overflow: false,
      fallbackReasons: [],
    };
  }

  return {
    available: true,
    verdict: bundle.verdict,
    budgetLimit: bundle.budget.limit,
    selectedCount: bundle.selected.length,
    deferredCount: bundle.deferred.length,
    overflow: bundle.budget.overflow,
    fallbackReasons: bundle.fallbackReasons,
  };
}

export function renderReactWebRankedBundleMarkdown(bundle: ReactWebRankedBundleResult): string {
  const selected = bundle.selected.length > 0
    ? bundle.selected.map((entry) => `- [${entry.entryClass}] ${entry.label} (priority ${entry.priority}; ${entry.source})`).join("\n")
    : "- none";
  const deferred = bundle.deferred.length > 0
    ? bundle.deferred.map((entry) => `- [${entry.entryClass}] ${entry.label} (priority ${entry.priority}; ${entry.source})`).join("\n")
    : "- none";
  const fallbackReasons = bundle.fallbackReasons.length > 0 ? bundle.fallbackReasons.map((reason) => `- ${reason}`).join("\n") : "- none";

  return `# React Web ranked bundle\n\n${bundle.claimBoundary}\n\n## Summary\n\n- artifact id: ${bundle.artifactId}\n- file: ${bundle.filePath}\n- mode: ${bundle.mode}\n- verdict: ${bundle.verdict}\n- runtime decision: ${bundle.runtimeDecision}\n- evidence strength: ${bundle.evidenceStrength}\n- repeated same-file eligible: ${bundle.repeatedSameFileEligible ? "yes" : "no"}\n- fail-closed: ${bundle.failClosed ? "yes" : "no"}\n- budget: ${bundle.budget.selected}/${bundle.budget.limit} selected, ${bundle.budget.deferred} deferred\n\n## Selected\n\n${selected}\n\n## Deferred\n\n${deferred}\n\n## Fallback reasons\n\n${fallbackReasons}\n`;
}
