import type { DomainDetectionResult } from "../domain-detector";
import {
  DOMAIN_PAYLOAD_SCHEMA_VERSION,
  type ReactNativePrimitiveInputDomainPayload,
  type ReactNativePrimitiveInputReuseContract,
} from "../payload/domain-payload";
import {
  RN_PRIMITIVE_INPUT_FORBIDDEN_EXACT_SIGNALS,
  RN_PRIMITIVE_INPUT_FORBIDDEN_PREFIXES,
  RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
  RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS,
} from "./react-native";
import type { ModelFacingPayload, SourceFingerprint } from "../schema";
import { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } from "./fallback";
import type { FrontendPayloadPolicyDecision } from "./types";

const FRONTEND_PROFILE_GATE_EXTENSIONS = new Set([".tsx", ".jsx"]);
export const MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON = "missing-react-web-domain-payload";
export const MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON = "missing-react-native-domain-payload";

export type FrontendProfilePayloadReuseDecision = { allowed: true } | { allowed: false; reason: string };

function arraysEqual(left: string[] | undefined, right: readonly string[]): boolean {
  if (!left || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function sourceFingerprintsEqual(left: SourceFingerprint | undefined, right: SourceFingerprint | undefined): boolean {
  if (!left || !right) return false;
  return left.fileHash === right.fileHash && left.lineCount === right.lineCount;
}

function expectedReactNativeDeniedSignals(): string[] {
  return [
    ...RN_PRIMITIVE_INPUT_FORBIDDEN_EXACT_SIGNALS,
    ...RN_PRIMITIVE_INPUT_FORBIDDEN_PREFIXES.map((prefix) => `${prefix}*`),
  ];
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
    arraysEqual(contract.deniedBySignals, expectedReactNativeDeniedSignals()) &&
    contract.supportBoundary === "measured-evidence-only; no broad RN/WebView/TUI support"
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
