import type { DomainDetectionResult } from "../domain-detector";
import { FRONTEND_DOMAIN_BOUNDARY_REASON } from "../domain-profiles/types";
import type { FrontendPayloadPolicyDecision } from "./types";

export const MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY = "mixed-frontend-boundary-fallback";
export const UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY = "unknown-frontend-deferred-fallback";
export const UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON = "unsupported-frontend-domain-profile";

export function assessFallbackPayloadPolicy(domainDetection: DomainDetectionResult): FrontendPayloadPolicyDecision | undefined {
  if (domainDetection.classification === "mixed") {
    return {
      name: MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY,
      allowed: false,
      reason: domainDetection.reason ?? FRONTEND_DOMAIN_BOUNDARY_REASON,
    };
  }

  if (domainDetection.classification === "unknown") {
    return {
      name: UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY,
      allowed: false,
      reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
    };
  }

  return undefined;
}
