import fs from "node:fs";
import path from "node:path";
import { extractFile } from "../core/extract";
import { detectDomainFromSource, type DomainDetectionResult } from "../core/domain-detector";
import { toModelFacingPayload, type ModelFacingPayloadOptions } from "../core/payload/model-facing";
import { assessPayloadReadiness } from "../core/payload/readiness";
import {
  MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY,
  UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY,
  UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
} from "../core/payload-policy/fallback";
import { assessFrontendProfilePayloadReuse } from "../core/payload-policy/profile-gate";
import { assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions } from "../core/payload-policy/registry";
import {
  CUSTOM_WRAPPER_DOM_SIGNAL_GAP,
  REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY,
} from "../core/payload-policy/react-web";
import { RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY } from "../core/payload-policy/react-native";
import { TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY } from "../core/payload-policy/tui-ink";
import type { FrontendPayloadPolicyDecision } from "../core/payload-policy/types";
import { WEBVIEW_BOUNDARY_FALLBACK_POLICY } from "../core/payload-policy/webview";
import type { PreReadDecision } from "../core/schema";

const REACT_ELIGIBLE_EXTENSIONS = new Set([".tsx", ".jsx"]);
const CODEX_TS_JS_BETA_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
export { assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions } from "../core/payload-policy/registry";
export {
  CUSTOM_WRAPPER_DOM_SIGNAL_GAP,
  MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY,
  REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY,
  RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
  TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY,
  UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY,
  UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  WEBVIEW_BOUNDARY_FALLBACK_POLICY,
};
export const REACT_NATIVE_WEBVIEW_BOUNDARY_REASON = "unsupported-react-native-webview-boundary";

export type PreReadOptions = Pick<ModelFacingPayloadOptions, "includeEditGuidance">;
export type { FrontendPayloadPolicyDecision };

function eligibleExtensions(runtime: PreReadDecision["runtime"]): ReadonlySet<string> {
  return runtime === "codex" ? CODEX_TS_JS_BETA_EXTENSIONS : REACT_ELIGIBLE_EXTENSIONS;
}

function relativePath(filePath: string, cwd: string): string {
  const relative = path.relative(cwd, filePath);
  return relative || path.basename(filePath);
}

type PreReadFallbackDecisionInput = {
  runtime: PreReadDecision["runtime"];
  filePath: string;
  eligible: boolean;
  reasons: string[];
  readiness?: PreReadDecision["readiness"];
  debug?: PreReadDecision["debug"];
  fallbackReason?: string;
};

function buildPreReadFallbackDecision(input: PreReadFallbackDecisionInput): PreReadDecision {
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

type PreReadPayloadDecisionInput = {
  runtime: PreReadDecision["runtime"];
  filePath: string;
  payload: NonNullable<PreReadDecision["payload"]>;
  readiness: NonNullable<PreReadDecision["readiness"]>;
  debug: PreReadDecision["debug"];
};

function buildPreReadPayloadDecision(input: PreReadPayloadDecisionInput): PreReadDecision {
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

function frontendDebug(
  domainDetection: DomainDetectionResult,
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision,
): NonNullable<PreReadDecision["debug"]> {
  return {
    domainDetection,
    ...(frontendPayloadPolicy ? { frontendPayloadPolicy } : {}),
  };
}

type PreReadPayloadDebugInput = {
  result: ReturnType<typeof extractFile>;
  domainDetection: DomainDetectionResult;
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision;
};

function buildPreReadPayloadDebug(input: PreReadPayloadDebugInput): NonNullable<PreReadDecision["debug"]> {
  return {
    mode: input.result.mode,
    complexityScore: input.result.meta.complexityScore,
    decideReason: input.result.meta.decideReason,
    decideConfidence: input.result.meta.decideConfidence,
    language: input.result.language,
    ...frontendDebug(input.domainDetection, input.frontendPayloadPolicy),
  };
}

type PreReadPayloadPlanInput = {
  resolvedPath: string;
  cwd: string;
  includeEditGuidance: boolean;
  domainDetection: DomainDetectionResult;
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision;
};

type PreReadPayloadPlan = {
  payload: NonNullable<PreReadDecision["payload"]>;
  readiness: NonNullable<PreReadDecision["readiness"]>;
  debug: NonNullable<PreReadDecision["debug"]>;
};

function buildPreReadPayloadPlan(input: PreReadPayloadPlanInput): PreReadPayloadPlan {
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

type PreReadDecisionFromPayloadPlanInput = {
  runtime: PreReadDecision["runtime"];
  filePath: string;
  extension: string;
  domainDetection: DomainDetectionResult;
  frontendPayloadPolicy?: FrontendPayloadPolicyDecision;
  payload: NonNullable<PreReadDecision["payload"]>;
  readiness: NonNullable<PreReadDecision["readiness"]>;
  debug: NonNullable<PreReadDecision["debug"]>;
};

function buildPreReadDecisionFromPayloadPlan(input: PreReadDecisionFromPayloadPlanInput): PreReadDecision {
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

export function hasReactNativeWebViewBoundaryMarker(sourceText: string): boolean {
  const domainDetection = detectDomainFromSource(sourceText);
  return domainDetection.outcome === "fallback" && domainDetection.reason === REACT_NATIVE_WEBVIEW_BOUNDARY_REASON;
}

export function decidePreRead(
  filePath: string,
  cwd = process.cwd(),
  runtime: PreReadDecision["runtime"] = "codex",
  options: PreReadOptions = {},
): PreReadDecision {
  const resolvedPath = path.resolve(filePath);
  const outputPath = relativePath(resolvedPath, cwd);
  const extension = path.extname(resolvedPath).toLowerCase();

  if (!eligibleExtensions(runtime).has(extension)) {
    return buildPreReadFallbackDecision({
      runtime,
      filePath: outputPath,
      eligible: false,
      reasons: ["ineligible-extension"],
    });
  }

  const sourceText = fs.readFileSync(resolvedPath, "utf8");
  const domainDetection = detectDomainFromSource(sourceText, resolvedPath);
  const frontendPayloadPolicy = assessFrontendPayloadPolicy(domainDetection);
  if (
    domainDetection.outcome === "fallback" &&
    domainDetection.reason === REACT_NATIVE_WEBVIEW_BOUNDARY_REASON &&
    domainDetection.classification !== "react-native"
  ) {
    return buildPreReadFallbackDecision({
      runtime,
      filePath: outputPath,
      eligible: true,
      reasons: [REACT_NATIVE_WEBVIEW_BOUNDARY_REASON],
      debug: frontendDebug(domainDetection, frontendPayloadPolicy),
    });
  }

  if (domainDetection.classification === "react-native" && frontendPayloadPolicy?.allowed !== true) {
    return buildPreReadFallbackDecision({
      runtime,
      filePath: outputPath,
      eligible: true,
      reasons: [UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON],
      debug: frontendDebug(domainDetection, frontendPayloadPolicy),
    });
  }

  const { payload, readiness, debug } = buildPreReadPayloadPlan({
    resolvedPath,
    cwd,
    includeEditGuidance: options.includeEditGuidance === true,
    domainDetection,
    frontendPayloadPolicy,
  });

  return buildPreReadDecisionFromPayloadPlan({
    runtime,
    filePath: outputPath,
    extension,
    domainDetection,
    frontendPayloadPolicy,
    payload,
    readiness,
    debug,
  });
}
