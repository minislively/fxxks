import type { DomainDetectionResult } from "../domain-detector";
import { assessFallbackPayloadPolicy } from "./fallback";
import { assessReactNativePayloadPolicy } from "./react-native";
import { assessReactWebPayloadPolicy, REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY } from "./react-web";
import { assessTuiInkPayloadPolicy } from "./tui-ink";
import type { FrontendPayloadPolicyDecision } from "./types";
import { assessWebViewPayloadPolicy } from "./webview";

export type FrontendPayloadPolicyAssessor = (
  domainDetection: DomainDetectionResult,
) => FrontendPayloadPolicyDecision | undefined;

export type FrontendPayloadBuildOptions = {
  includeDomainPayload: boolean;
  domainPayloadPolicy?: string;
};

export type FrontendPayloadPolicyRegistryEntry = {
  name: string;
  lane: "react-web" | "webview" | "tui-ink" | "react-native" | "fallback";
  assess: FrontendPayloadPolicyAssessor;
};

export const FRONTEND_PAYLOAD_POLICY_REGISTRY: readonly FrontendPayloadPolicyRegistryEntry[] = [
  { name: "react-web-current-supported", lane: "react-web", assess: assessReactWebPayloadPolicy },
  { name: "webview-boundary", lane: "webview", assess: assessWebViewPayloadPolicy },
  { name: "tui-ink-evidence-only", lane: "tui-ink", assess: assessTuiInkPayloadPolicy },
  { name: "react-native-primitive-input", lane: "react-native", assess: assessReactNativePayloadPolicy },
  { name: "mixed-unknown-fallback", lane: "fallback", assess: assessFallbackPayloadPolicy },
] as const;

export function assessFrontendPayloadPolicy(
  domainDetection: DomainDetectionResult,
): FrontendPayloadPolicyDecision | undefined {
  for (const entry of FRONTEND_PAYLOAD_POLICY_REGISTRY) {
    const decision = entry.assess(domainDetection);
    if (decision) return decision;
  }

  return undefined;
}

export function toFrontendPayloadBuildOptions(
  policy: FrontendPayloadPolicyDecision | undefined,
): FrontendPayloadBuildOptions {
  return {
    includeDomainPayload: policy?.name === REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY,
    ...(policy?.name ? { domainPayloadPolicy: policy.name } : {}),
  };
}
