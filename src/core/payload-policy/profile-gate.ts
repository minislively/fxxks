import type { DomainDetectionResult } from "../domain-detector";
import type { ModelFacingPayload } from "../schema";
import { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } from "./fallback";
import type { FrontendPayloadPolicyDecision } from "./types";

const FRONTEND_PROFILE_GATE_EXTENSIONS = new Set([".tsx", ".jsx"]);
export const MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON = "missing-react-web-domain-payload";

export type FrontendProfilePayloadReuseDecision = { allowed: true } | { allowed: false; reason: string };

export function assessFrontendProfilePayloadReuse(
  extension: string,
  domainDetection: DomainDetectionResult,
  payload: ModelFacingPayload,
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision,
): FrontendProfilePayloadReuseDecision {
  if (!FRONTEND_PROFILE_GATE_EXTENSIONS.has(extension)) {
    return { allowed: true };
  }

  if (domainDetection.profile.lane === "react-web" && domainDetection.profile.claimStatus === "current-supported-lane") {
    return payload.domainPayload?.domain === "react-web" && payload.domainPayload.plannerDecision === "compact-safe"
      ? { allowed: true }
      : { allowed: false, reason: MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON };
  }

  if (frontendPayloadPolicy?.allowed === true) {
    return { allowed: true };
  }

  return { allowed: false, reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON };
}
