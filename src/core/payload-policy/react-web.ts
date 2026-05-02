import type { DomainDetectionResult } from "../domain-detector";
import { REACT_WEB_DOMAIN_PAYLOAD_POLICY } from "../payload/domain-payload";
import type { FrontendPayloadPolicyDecision } from "./types";

export const REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY = REACT_WEB_DOMAIN_PAYLOAD_POLICY;
export const CUSTOM_WRAPPER_DOM_SIGNAL_GAP = "custom-wrapper-dom-signal-gap";

function reactWebEvidenceGates(domainDetection: DomainDetectionResult): string[] {
  if (domainDetection.classification !== "react-web") return [];
  if (domainDetection.profile.claimStatus !== "current-supported-lane") return [];

  const hasDomTagEvidence = domainDetection.evidence.some((item) => item.domain === "react-web" && item.signal === "dom-tag");
  const hasWebJsxAttributeEvidence = domainDetection.evidence.some(
    (item) => item.domain === "react-web" && item.signal === "jsx-attribute",
  );

  return !hasDomTagEvidence && hasWebJsxAttributeEvidence ? [CUSTOM_WRAPPER_DOM_SIGNAL_GAP] : [];
}

export function assessReactWebPayloadPolicy(domainDetection: DomainDetectionResult): FrontendPayloadPolicyDecision | undefined {
  if (domainDetection.classification !== "react-web") return undefined;
  if (domainDetection.profile.claimStatus !== "current-supported-lane") return undefined;

  const evidenceGates = reactWebEvidenceGates(domainDetection);
  return {
    name: REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY,
    allowed: true,
    ...(evidenceGates.length > 0 ? { evidenceGates } : {}),
  };
}
