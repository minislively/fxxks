import fs from "node:fs";
import path from "node:path";
import { extractFile } from "../core/extract";
import { detectDomainFromSource, type DomainDetectionResult } from "../core/domain-detector";
import { toModelFacingPayload, type ModelFacingPayloadOptions } from "../core/payload/model-facing";
import { assessPayloadReadiness } from "../core/payload/readiness";
import type { PreReadDecision } from "../core/schema";

const REACT_ELIGIBLE_EXTENSIONS = new Set([".tsx", ".jsx"]);
const CODEX_TS_JS_BETA_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const FRONTEND_PROFILE_GATE_EXTENSIONS = new Set([".tsx", ".jsx"]);
export const REACT_NATIVE_WEBVIEW_BOUNDARY_REASON = "unsupported-react-native-webview-boundary";
export const UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON = "unsupported-frontend-domain-profile";

export type PreReadOptions = Pick<ModelFacingPayloadOptions, "includeEditGuidance">;

function eligibleExtensions(runtime: PreReadDecision["runtime"]): ReadonlySet<string> {
  return runtime === "codex" ? CODEX_TS_JS_BETA_EXTENSIONS : REACT_ELIGIBLE_EXTENSIONS;
}

function relativePath(filePath: string, cwd: string): string {
  const relative = path.relative(cwd, filePath);
  return relative || path.basename(filePath);
}

function assessFrontendProfilePayloadReuse(
  extension: string,
  domainDetection: DomainDetectionResult,
): { allowed: true } | { allowed: false; reason: string } {
  if (!FRONTEND_PROFILE_GATE_EXTENSIONS.has(extension)) {
    return { allowed: true };
  }

  if (domainDetection.profile.lane === "react-web" && domainDetection.profile.claimStatus === "current-supported-lane") {
    return { allowed: true };
  }

  return { allowed: false, reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON };
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
    return {
      runtime,
      filePath: outputPath,
      eligible: false,
      decision: "fallback",
      reasons: ["ineligible-extension"],
      debug: {},
      fallback: {
        action: "full-read",
        reason: "ineligible-extension",
      },
    };
  }

  const sourceText = fs.readFileSync(resolvedPath, "utf8");
  const domainDetection = detectDomainFromSource(sourceText, resolvedPath);
  if (domainDetection.outcome === "fallback" && domainDetection.reason === REACT_NATIVE_WEBVIEW_BOUNDARY_REASON) {
    return {
      runtime,
      filePath: outputPath,
      eligible: true,
      decision: "fallback",
      reasons: [REACT_NATIVE_WEBVIEW_BOUNDARY_REASON],
      debug: { domainDetection },
      fallback: {
        action: "full-read",
        reason: REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
      },
    };
  }

  const result = extractFile(resolvedPath);
  const payload = toModelFacingPayload(result, cwd, {
    includeEditGuidance: options.includeEditGuidance === true,
  });
  const readiness = assessPayloadReadiness(result, payload);
  const debug = {
    mode: result.mode,
    complexityScore: result.meta.complexityScore,
    decideReason: result.meta.decideReason,
    decideConfidence: result.meta.decideConfidence,
    language: result.language,
    domainDetection,
  };

  if (readiness.ready) {
    const profileGate = assessFrontendProfilePayloadReuse(extension, domainDetection);
    if (profileGate.allowed) {
      return {
        runtime,
        filePath: outputPath,
        eligible: true,
        decision: "payload",
        reasons: [],
        payload,
        readiness,
        debug,
      };
    }

    return {
      runtime,
      filePath: outputPath,
      eligible: true,
      decision: "fallback",
      reasons: [profileGate.reason],
      readiness,
      debug,
      fallback: {
        action: "full-read",
        reason: profileGate.reason,
      },
    };
  }

  return {
    runtime,
    filePath: outputPath,
    eligible: true,
    decision: "fallback",
    reasons: readiness.reasons,
    readiness,
    debug,
    fallback: {
      action: "full-read",
      reason: readiness.reasons[0] ?? "missing-structure",
    },
  };
}
