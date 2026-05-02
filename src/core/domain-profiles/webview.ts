import { FRONTEND_DOMAIN_BOUNDARY_REASON, type DomainProfileDefinition } from "./types";

export const WEBVIEW_DOMAIN_PROFILE: DomainProfileDefinition = {
  lane: "webview",
  evidenceDomain: "webview",
  outcome: "fallback",
  claimStatus: "fallback-boundary",
  fallbackFirst: true,
  boundaryReason: FRONTEND_DOMAIN_BOUNDARY_REASON,
  claimBoundary: "source-reading-boundary",
};
