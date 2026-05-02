import { REACT_NATIVE_DOMAIN_PROFILE } from "./react-native";
import { REACT_WEB_DOMAIN_PROFILE } from "./react-web";
import { TUI_INK_DOMAIN_PROFILE } from "./tui-ink";
import {
  FRONTEND_DOMAIN_BOUNDARY_REASON,
  type DomainLabel,
  type DomainProfileDefinition,
  type FrontendDomainEvidence,
  type FrontendDomainOutcome,
  type FrontendDomainProfileMetadata,
} from "./types";
import { WEBVIEW_DOMAIN_PROFILE } from "./webview";

export const MIXED_DOMAIN_PROFILE: DomainProfileDefinition = {
  lane: "mixed",
  outcome: "fallback",
  claimStatus: "fallback-boundary",
  fallbackFirst: true,
  boundaryReason: FRONTEND_DOMAIN_BOUNDARY_REASON,
  claimBoundary: "source-reading-boundary",
};

export const UNKNOWN_DOMAIN_PROFILE: DomainProfileDefinition = {
  lane: "unknown",
  outcome: "deferred",
  claimStatus: "deferred",
  fallbackFirst: false,
  claimBoundary: "unknown-deferred",
};

export const FRONTEND_DOMAIN_PROFILE_REGISTRY = [
  REACT_WEB_DOMAIN_PROFILE,
  REACT_NATIVE_DOMAIN_PROFILE,
  WEBVIEW_DOMAIN_PROFILE,
  TUI_INK_DOMAIN_PROFILE,
  MIXED_DOMAIN_PROFILE,
  UNKNOWN_DOMAIN_PROFILE,
] as const;

const EVIDENCE_DOMAINS = ["react-native", "webview", "tui-ink"] as const;
const profilesByLane = new Map<DomainLabel, DomainProfileDefinition>(
  FRONTEND_DOMAIN_PROFILE_REGISTRY.map((profile) => [profile.lane, profile]),
);

export function hasDomainEvidence(evidence: FrontendDomainEvidence[], domain: FrontendDomainEvidence["domain"]): boolean {
  return evidence.some((item) => item.domain === domain);
}

export function resolveDomainClassification(evidence: FrontendDomainEvidence[], hasReactWebEvidence: boolean): DomainLabel {
  const matched = EVIDENCE_DOMAINS.filter((domain) => hasDomainEvidence(evidence, domain));
  if (matched.length > 1 || (matched.length === 1 && hasReactWebEvidence)) return "mixed";
  if (matched.length === 1) return matched[0];
  if (hasReactWebEvidence) return "react-web";
  return "unknown";
}

export function getDomainProfileDefinition(classification: DomainLabel): DomainProfileDefinition {
  const profile = profilesByLane.get(classification);
  if (!profile) return UNKNOWN_DOMAIN_PROFILE;
  return profile;
}

export function outcomeForClassification(classification: DomainLabel): { outcome: FrontendDomainOutcome; reason?: string } {
  const profile = getDomainProfileDefinition(classification);
  return {
    outcome: profile.outcome,
    ...(profile.boundaryReason ? { reason: profile.boundaryReason } : {}),
  };
}

export function profileForClassification(
  classification: DomainLabel,
  outcome: FrontendDomainOutcome,
  reason?: string,
): FrontendDomainProfileMetadata {
  const profile = getDomainProfileDefinition(classification);
  return {
    lane: classification,
    outcome,
    claimStatus: profile.claimStatus,
    fallbackFirst: profile.fallbackFirst,
    ...(reason ? { boundaryReason: reason } : {}),
    claimBoundary: profile.claimBoundary,
  };
}
