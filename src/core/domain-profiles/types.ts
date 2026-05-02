export type DomainLabel = "react-web" | "react-native" | "webview" | "tui-ink" | "mixed" | "unknown";
export type FrontendDomainClassification = DomainLabel;
export type FrontendDomainOutcome = "extract" | "fallback" | "deferred" | "unsupported";
export type FrontendDomainProfileClaimStatus = "current-supported-lane" | "evidence-only" | "fallback-boundary" | "deferred";
export type FrontendDomainProfileClaimBoundary =
  | "react-web-measured-extraction"
  | "domain-evidence-only"
  | "source-reading-boundary"
  | "unknown-deferred";

export const FRONTEND_DOMAIN_BOUNDARY_REASON = "unsupported-react-native-webview-boundary";

export type FrontendDomainEvidence = {
  domain: Exclude<DomainLabel, "mixed" | "unknown">;
  signal: string;
  detail: string;
};

export type FrontendDomainProfileMetadata = {
  lane: DomainLabel;
  outcome: FrontendDomainOutcome;
  claimStatus: FrontendDomainProfileClaimStatus;
  fallbackFirst: boolean;
  boundaryReason?: string;
  claimBoundary: FrontendDomainProfileClaimBoundary;
};

export type DomainDetectionResult = {
  classification: FrontendDomainClassification;
  /** @deprecated Use classification. */
  domain: DomainLabel;
  outcome: FrontendDomainOutcome;
  reason?: string;
  profile: FrontendDomainProfileMetadata;
  evidence: FrontendDomainEvidence[];
  /** @deprecated Use evidence. */
  signals: string[];
};

export type DomainProfileDefinition = {
  lane: DomainLabel;
  evidenceDomain?: FrontendDomainEvidence["domain"];
  outcome: FrontendDomainOutcome;
  claimStatus: FrontendDomainProfileClaimStatus;
  fallbackFirst: boolean;
  claimBoundary: FrontendDomainProfileClaimBoundary;
  boundaryReason?: string;
};
