import type { DomainDetectionResult } from "../domain-detector";
import {
  DOMAIN_PAYLOAD_SCHEMA_VERSION,
  RN_SOURCE_ANCHOR_BETA_CONTRACT_VERSION,
  type ReactNativePrimitiveInputDomainPayload,
  type ReactNativePrimitiveInputReuseContract,
  type ReactNativeSourceAnchorBetaPayload,
} from "../payload/domain-payload";
import {
  RN_PRIMITIVE_INPUT_DENIED_BY_SIGNALS,
  RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
  RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS,
  RN_PRIMITIVE_INPUT_SUPPORT_BOUNDARY,
} from "./react-native";
import type { ModelFacingPayload, SourceFingerprint } from "../schema";
import { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } from "./fallback";
import type { FrontendPayloadPolicyDecision } from "./types";

const FRONTEND_PROFILE_GATE_EXTENSIONS = new Set([".tsx", ".jsx"]);
export const MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON = "missing-react-web-domain-payload";
export const MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON = "missing-react-native-domain-payload";

export type FrontendProfilePayloadReuseDecision = { allowed: true } | { allowed: false; reason: string };

function arraysEqual(left: readonly string[] | undefined, right: readonly string[]): boolean {
  if (!left || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function sourceFingerprintsEqual(left: SourceFingerprint | undefined, right: SourceFingerprint | undefined): boolean {
  if (!left || !right) return false;
  return left.fileHash === right.fileHash && left.lineCount === right.lineCount;
}

function arraysContainValues(left: string[] | readonly string[] | undefined, right: readonly string[]): boolean {
  if (!left) return false;
  return right.every((value) => left.includes(value));
}

function isSourceRange(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { startLine?: unknown }).startLine === "number" &&
    typeof (value as { endLine?: unknown }).endLine === "number"
  );
}

function hasLocatedAnchor(
  anchors: ReactNativeSourceAnchorBetaPayload["anchors"] | Partial<ReactNativeSourceAnchorBetaPayload["anchors"]> | undefined,
  predicate: (item: { kind?: string; label?: string; loc?: unknown }) => boolean,
): boolean {
  if (!anchors || !Array.isArray(anchors.locatedAnchors)) return false;
  return anchors.locatedAnchors.some((item) => predicate(item) && isSourceRange(item.loc));
}

function isReactNativeSourceAnchorBetaPayload(value: unknown): value is ReactNativeSourceAnchorBetaPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ReactNativeSourceAnchorBetaPayload>;
  const contract = payload.contract as Partial<ReactNativeSourceAnchorBetaPayload["contract"]> | undefined;
  const anchors = payload.anchors as Partial<ReactNativeSourceAnchorBetaPayload["anchors"]> | undefined;

  return (
    Boolean(contract) &&
    contract?.contractVersion === RN_SOURCE_ANCHOR_BETA_CONTRACT_VERSION &&
    contract.scope === "local-proof-only" &&
    arraysEqual(contract.allowedProofSurfaces, ["extract", "compare", "inspect-domain"]) &&
    contract.runtimeReusePromotion === "not-promoted" &&
    contract.sourceDerivedOnly === true &&
    arraysEqual(contract.anchorKinds, [
      "component-name",
      "props-interface",
      "hooks-effects",
      "event-handlers",
      "rn-primitive-outline",
      "source-fingerprint-ranges",
    ]) &&
    arraysEqual(contract.fallbackFirstBoundaries, [
      "webview",
      "native-bridge",
      "platform-specific",
      "navigation",
      "gesture-list-image-scrollview",
      "mixed-react-web-dom",
      "tui-ink",
    ]) &&
    contract.nextImplementationStep ===
      "emit located RN sourceAnchorBeta anchors from existing component/props/hook/handler/primitive evidence before widening detector gates" &&
    Boolean(anchors) &&
    anchors?.sourceFingerprintRequired === true &&
    arraysContainValues(anchors?.primitives, ["Pressable", "Text", "TextInput", "View"]) &&
    arraysContainValues(anchors?.jsxProps, ["onChangeText", "onPress"]) &&
    hasLocatedAnchor(anchors, (item) => item.kind === "component-name" && item.label === anchors.componentName) &&
    (!anchors.propsName || hasLocatedAnchor(anchors, (item) => item.kind === "props-interface" && item.label === anchors.propsName)) &&
    hasLocatedAnchor(anchors, (item) => item.kind === "event-handlers" && Boolean(item.label?.startsWith("onChangeText:"))) &&
    hasLocatedAnchor(anchors, (item) => item.kind === "event-handlers" && Boolean(item.label?.startsWith("onPress:"))) &&
    hasLocatedAnchor(anchors, (item) => item.kind === "rn-primitive-outline" && item.label === "TextInput") &&
    hasLocatedAnchor(anchors, (item) => item.kind === "rn-primitive-outline" && item.label === "Pressable")
  );
}

function isReactNativePrimitiveInputReuseContract(value: unknown): value is ReactNativePrimitiveInputReuseContract {
  if (!value || typeof value !== "object") return false;
  const contract = value as Partial<ReactNativePrimitiveInputReuseContract>;

  return (
    contract.sourceDerivedOnly === true &&
    contract.policy === RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY &&
    contract.plannerDecision === "narrow-primitive-input-payload" &&
    contract.freshnessSource === "sourceFingerprint" &&
    arraysEqual(contract.staleWhen, [
      "sourceFingerprint.fileHash changes",
      "sourceFingerprint.lineCount changes",
      "frontendPayloadPolicy no longer allows RN narrow policy",
    ]) &&
    arraysEqual(contract.requiredSignals, RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS) &&
    arraysEqual(contract.deniedBySignals, RN_PRIMITIVE_INPUT_DENIED_BY_SIGNALS) &&
    contract.supportBoundary === RN_PRIMITIVE_INPUT_SUPPORT_BOUNDARY
  );
}

function isReactNativePrimitiveInputDomainPayload(
  payload: ModelFacingPayload,
  expectedPolicy: string,
): payload is ModelFacingPayload & { domainPayload: ReactNativePrimitiveInputDomainPayload } {
  const domainPayload = payload.domainPayload;
  if (!domainPayload || domainPayload.domain !== "react-native") return false;

  if (expectedPolicy !== RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY) return false;
  if (domainPayload.schemaVersion !== DOMAIN_PAYLOAD_SCHEMA_VERSION) return false;
  if (domainPayload.policy !== RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY) return false;
  if (domainPayload.plannerDecision !== "narrow-primitive-input-payload") return false;
  if (domainPayload.claimStatus !== "measured-evidence-only") return false;
  if (domainPayload.claimBoundary !== "rn-primitive-input-narrow-payload-only") return false;
  if (!isReactNativeSourceAnchorBetaPayload(domainPayload.sourceAnchorBeta)) return false;
  if (!isReactNativePrimitiveInputReuseContract(domainPayload.reuseContract)) return false;
  if (!payload.sourceFingerprint) return false;
  if (payload.editGuidance?.freshness && !sourceFingerprintsEqual(payload.sourceFingerprint, payload.editGuidance.freshness)) return false;

  return true;
}

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
    if (domainDetection.profile.lane === "react-native") {
      return isReactNativePrimitiveInputDomainPayload(payload, frontendPayloadPolicy.name)
        ? { allowed: true }
        : { allowed: false, reason: MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON };
}
