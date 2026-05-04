import type { DomainDetectionResult } from "../domain-detector";
import { REACT_NATIVE_SIGNAL_TAXONOMY } from "../domain-profiles/react-native";
import type { FrontendPayloadPolicyDecision } from "./types";

export const RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY = REACT_NATIVE_SIGNAL_TAXONOMY.primitiveInput.policy;
export const RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS = REACT_NATIVE_SIGNAL_TAXONOMY.primitiveInput.requiredSignals;
export const RN_PRIMITIVE_INPUT_FORBIDDEN_PREFIXES = REACT_NATIVE_SIGNAL_TAXONOMY.primitiveInput.forbiddenPrefixes;
export const RN_PRIMITIVE_INPUT_FORBIDDEN_EXACT_SIGNALS = REACT_NATIVE_SIGNAL_TAXONOMY.primitiveInput.forbiddenExactSignals;
export const RN_PRIMITIVE_INPUT_DENIED_BY_SIGNALS = [
  ...RN_PRIMITIVE_INPUT_FORBIDDEN_EXACT_SIGNALS,
  ...RN_PRIMITIVE_INPUT_FORBIDDEN_PREFIXES.map((prefix) => `${prefix}*`),
] as const;
export const RN_PRIMITIVE_INPUT_SUPPORT_BOUNDARY = REACT_NATIVE_SIGNAL_TAXONOMY.primitiveInput.supportBoundary;

type ReactNativePrimitiveInputSignalGate =
  | { allowed: true }
  | { allowed: false; reason: `forbidden-signal:${string}` | `missing-signal:${string}` };

function hasSignal(domainDetection: DomainDetectionResult, signal: string): boolean {
  return domainDetection.signals.includes(signal);
}

function hasAnySignalWithPrefix(domainDetection: DomainDetectionResult, prefix: string): boolean {
  return domainDetection.signals.some((signal) => signal.startsWith(prefix));
}

export function assessReactNativePrimitiveInputSignalGate(
  domainDetection: DomainDetectionResult,
): ReactNativePrimitiveInputSignalGate {
  const forbiddenSignal =
    RN_PRIMITIVE_INPUT_FORBIDDEN_EXACT_SIGNALS.find((signal) => hasSignal(domainDetection, signal)) ??
    RN_PRIMITIVE_INPUT_FORBIDDEN_PREFIXES.find((prefix) => hasAnySignalWithPrefix(domainDetection, prefix));
  if (forbiddenSignal) {
    return { allowed: false, reason: `forbidden-signal:${forbiddenSignal}` };
  }

  const missingSignal = RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS.find((signal) => !hasSignal(domainDetection, signal));
  if (missingSignal) {
    return { allowed: false, reason: `missing-signal:${missingSignal}` };
  }

  return { allowed: true };
}

export function assessReactNativePayloadPolicy(
  domainDetection: DomainDetectionResult,
): FrontendPayloadPolicyDecision | undefined {
  if (domainDetection.classification !== "react-native") return undefined;

  const signalGate = assessReactNativePrimitiveInputSignalGate(domainDetection);
  if (!signalGate.allowed) {
    return {
      name: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
      allowed: false,
      reason: signalGate.reason,
    };
  }

  return { name: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY, allowed: true };
}
