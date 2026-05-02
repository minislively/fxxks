import type { DomainDetectionResult } from "../domain-detector";
import { FRONTEND_DOMAIN_BOUNDARY_REASON } from "../domain-profiles/types";
import type { FrontendPayloadPolicyDecision } from "./types";

export const REACT_NATIVE_WEBVIEW_BOUNDARY_REASON = FRONTEND_DOMAIN_BOUNDARY_REASON;
export const WEBVIEW_BOUNDARY_FALLBACK_POLICY = "webview-boundary-fallback";

function hasAnySignalWithPrefix(domainDetection: DomainDetectionResult, prefix: string): boolean {
  return domainDetection.signals.some((signal) => signal.startsWith(prefix));
}

export function assessWebViewPayloadPolicy(domainDetection: DomainDetectionResult): FrontendPayloadPolicyDecision | undefined {
  if (domainDetection.reason !== REACT_NATIVE_WEBVIEW_BOUNDARY_REASON) return undefined;
  if (!hasAnySignalWithPrefix(domainDetection, "webview:")) return undefined;

  return {
    name: WEBVIEW_BOUNDARY_FALLBACK_POLICY,
    allowed: false,
    reason: REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
  };
}
