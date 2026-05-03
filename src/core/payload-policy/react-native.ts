import type { DomainDetectionResult } from "../domain-detector";
import type { FrontendPayloadPolicyDecision } from "./types";

export const RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY = "rn-primitive-input-narrow-payload";

export const RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS = [
  "react-native:primitive:View",
  "react-native:primitive:Text",
  "react-native:primitive:TextInput",
  "react-native:primitive:Pressable",
  "react-native:jsx-prop:onChangeText",
  "react-native:jsx-prop:onPress",
] as const;
export const RN_PRIMITIVE_INPUT_FORBIDDEN_PREFIXES = [
  "webview:",
  "tui-ink:",
  "react-native:navigation-",
  "react-native:api-call:Dimensions.",
  "react-native:api-call:PanResponder.",
] as const;
export const RN_PRIMITIVE_INPUT_FORBIDDEN_EXACT_SIGNALS = [
  "react-native:primitive:FlatList",
  "react-native:primitive:Image",
  "react-native:primitive:ScrollView",
  "react-native:primitive:TouchableOpacity",
  "react-native:style-factory:StyleSheet.create",
  "react-native:platform-select:Platform.select",
  "react-native:style-prop:resizeMode",
  "react-native:jsx-prop:activeOpacity",
  "react-native:jsx-prop:pagingEnabled",
] as const;

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
