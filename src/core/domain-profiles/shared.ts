import type { DomainProfileDefinition } from "./types";

export const SHARED_DOMAIN_PROFILE: DomainProfileDefinition = {
  lane: "shared",
  evidenceDomain: "shared",
  outcome: "extract",
  claimStatus: "evidence-only",
  fallbackFirst: false,
  claimBoundary: "domain-evidence-only",
};
