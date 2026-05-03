import fs from "node:fs";
import path from "node:path";
import { detectDomainFromSource } from "../core/domain-detector";
import type { ModelFacingPayloadOptions } from "../core/payload/model-facing";
import {
  MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY,
  UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY,
  UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
} from "../core/payload-policy/fallback";
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
import {
  buildPreReadDecisionFromPayloadPlan,
  buildPreReadFallbackDecision,
  buildPreReadPayloadPlan,
  frontendDebug,
  REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
  shouldUseReactNativeWebViewBoundaryFallback,
} from "./pre-read-stack";

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
export { hasReactNativeWebViewBoundaryMarker, REACT_NATIVE_WEBVIEW_BOUNDARY_REASON } from "./pre-read-stack";

export type PreReadOptions = Pick<ModelFacingPayloadOptions, "includeEditGuidance">;
export type { FrontendPayloadPolicyDecision };

function eligibleExtensions(runtime: PreReadDecision["runtime"]): ReadonlySet<string> {
  return runtime === "codex" ? CODEX_TS_JS_BETA_EXTENSIONS : REACT_ELIGIBLE_EXTENSIONS;
}

function relativePath(filePath: string, cwd: string): string {
  const relative = path.relative(cwd, filePath);
  return relative || path.basename(filePath);
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
  if (shouldUseReactNativeWebViewBoundaryFallback(domainDetection)) {
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
