import { detectDomainFromSource, type DomainDetectionResult } from "../core/domain-detector";
import { extractFile } from "../core/extract";
import { toModelFacingPayload } from "../core/payload/model-facing";
import { assessPayloadReadiness } from "../core/payload/readiness";
import { assessFrontendProfilePayloadReuse } from "../core/payload-policy/profile-gate";
import { toFrontendPayloadBuildOptions } from "../core/payload-policy/registry";
import type { FrontendPayloadPolicyDecision } from "../core/payload-policy/types";
import type { PreReadDecision } from "../core/schema";

export const REACT_NATIVE_WEBVIEW_BOUNDARY_REASON = "unsupported-react-native-webview-boundary";

export type PreReadFallbackDecisionInput = {
  runtime: PreReadDecision["runtime"];
  filePath: string;
  eligible: boolean;
  reasons: string[];
  readiness?: PreReadDecision["readiness"];
  debug?: PreReadDecision["debug"];
  fallbackReason?: string;
};

export function buildPreReadFallbackDecision(input: PreReadFallbackDecisionInput): PreReadDecision {
  return {
    runtime: input.runtime,
    filePath: input.filePath,
    eligible: input.eligible,
    decision: "fallback",
    reasons: input.reasons,
    ...(input.readiness ? { readiness: input.readiness } : {}),
    debug: input.debug ?? {},
    fallback: {
      action: "full-read",
      reason: input.fallbackReason ?? input.reasons[0] ?? "missing-structure",
    },
  };
}

export type PreReadPayloadDecisionInput = {
  runtime: PreReadDecision["runtime"];
  filePath: string;
  payload: NonNullable<PreReadDecision["payload"]>;
  readiness: NonNullable<PreReadDecision["readiness"]>;
  debug: PreReadDecision["debug"];
};

export function buildPreReadPayloadDecision(input: PreReadPayloadDecisionInput): PreReadDecision {
  return {
    runtime: input.runtime,
    filePath: input.filePath,
    eligible: true,
    decision: "payload",
    reasons: [],
    payload: input.payload,
    readiness: input.readiness,
    debug: input.debug,
  };
}

export function frontendDebug(
  domainDetection: DomainDetectionResult,
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision,
): NonNullable<PreReadDecision["debug"]> {
  return {
    domainDetection,
    ...(frontendPayloadPolicy ? { frontendPayloadPolicy } : {}),
  };
}

export type PreReadPayloadDebugInput = {
  result: ReturnType<typeof extractFile>;
  domainDetection: DomainDetectionResult;
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision;
};

export function buildPreReadPayloadDebug(input: PreReadPayloadDebugInput): NonNullable<PreReadDecision["debug"]> {
  return {
    mode: input.result.mode,
    complexityScore: input.result.meta.complexityScore,
    decideReason: input.result.meta.decideReason,
    decideConfidence: input.result.meta.decideConfidence,
    language: input.result.language,
    ...frontendDebug(input.domainDetection, input.frontendPayloadPolicy),
  };
}

export type PreReadPayloadPlanInput = {
  resolvedPath: string;
  cwd: string;
  includeEditGuidance: boolean;
  domainDetection: DomainDetectionResult;
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision;
};

export type PreReadPayloadPlan = {
  payload: NonNullable<PreReadDecision["payload"]>;
  readiness: NonNullable<PreReadDecision["readiness"]>;
  debug: NonNullable<PreReadDecision["debug"]>;
};

export function buildPreReadPayloadPlan(input: PreReadPayloadPlanInput): PreReadPayloadPlan {
  const { frontendPayloadPolicy } = input;
  const result = extractFile(input.resolvedPath);
  const payloadBuildOptions = toFrontendPayloadBuildOptions(frontendPayloadPolicy);
  const payload = toModelFacingPayload(result, input.cwd, {
    includeEditGuidance: input.includeEditGuidance,
    ...payloadBuildOptions,
  });
  const readiness = assessPayloadReadiness(result, payload);
  const debug = buildPreReadPayloadDebug({
    result,
    domainDetection: input.domainDetection,
    frontendPayloadPolicy,
  });

  return { payload, readiness, debug };
}

export type PreReadDecisionFromPayloadPlanInput = {
  runtime: PreReadDecision["runtime"];
  filePath: string;
  extension: string;
  domainDetection: DomainDetectionResult;
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision;
  payload: NonNullable<PreReadDecision["payload"]>;
  readiness: NonNullable<PreReadDecision["readiness"]>;
  debug: NonNullable<PreReadDecision["debug"]>;
};

export function buildPreReadDecisionFromPayloadPlan(input: PreReadDecisionFromPayloadPlanInput): PreReadDecision {
  if (input.readiness.ready) {
    const profileGate = assessFrontendProfilePayloadReuse(
      input.extension,
      input.domainDetection,
      input.payload,
      input.frontendPayloadPolicy,
    );
    if (profileGate.allowed) {
      return buildPreReadPayloadDecision({
        runtime: input.runtime,
        filePath: input.filePath,
        payload: input.payload,
        readiness: input.readiness,
        debug: input.debug,
      });
    }

    return buildPreReadFallbackDecision({
      runtime: input.runtime,
      filePath: input.filePath,
      eligible: true,
      reasons: [profileGate.reason],
      readiness: input.readiness,
      debug: input.debug,
    });
  }

  return buildPreReadFallbackDecision({
    runtime: input.runtime,
    filePath: input.filePath,
    eligible: true,
    reasons: input.readiness.reasons,
    readiness: input.readiness,
    debug: input.debug,
  });
}

export function hasWebViewSourceShapeBoundary(domainDetection: DomainDetectionResult): boolean {
  return (
    domainDetection.outcome === "fallback" &&
    domainDetection.reason === REACT_NATIVE_WEBVIEW_BOUNDARY_REASON &&
    domainDetection.evidence.some((item) => item.domain === "webview" && item.signal === "source-shape")
  );
}

export function shouldUseReactNativeWebViewBoundaryFallback(domainDetection: DomainDetectionResult): boolean {
  if (domainDetection.classification === "react-native") {
    return false;
  }

  if (hasWebViewSourceShapeBoundary(domainDetection)) {
    return true;
  }

  return domainDetection.outcome === "fallback" && domainDetection.reason === REACT_NATIVE_WEBVIEW_BOUNDARY_REASON;
}

export function hasReactNativeWebViewBoundaryMarker(sourceText: string): boolean {
  const domainDetection = detectDomainFromSource(sourceText);
  return domainDetection.outcome === "fallback" && domainDetection.reason === REACT_NATIVE_WEBVIEW_BOUNDARY_REASON;
}
