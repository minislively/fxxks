import { FRONTEND_DOMAIN_BOUNDARY_REASON, type DomainProfileDefinition } from "./types";

export const REACT_NATIVE_DOMAIN_PROFILE: DomainProfileDefinition = {
  lane: "react-native",
  evidenceDomain: "react-native",
  outcome: "fallback",
  claimStatus: "fallback-boundary",
  fallbackFirst: true,
  boundaryReason: FRONTEND_DOMAIN_BOUNDARY_REASON,
  claimBoundary: "source-reading-boundary",
};
