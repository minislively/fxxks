import fs from "node:fs";
import path from "node:path";
import { extractFile } from "../core/extract";
import { toModelFacingPayload, type ModelFacingPayloadOptions } from "../core/payload/model-facing";
import { assessPayloadReadiness } from "../core/payload/readiness";
import type { PreReadDecision } from "../core/schema";

const REACT_ELIGIBLE_EXTENSIONS = new Set([".tsx", ".jsx"]);
const CODEX_TS_JS_BETA_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
export const REACT_NATIVE_WEBVIEW_BOUNDARY_REASON = "unsupported-react-native-webview-boundary";

export type PreReadOptions = Pick<ModelFacingPayloadOptions, "includeEditGuidance">;

function eligibleExtensions(runtime: PreReadDecision["runtime"]): ReadonlySet<string> {
  return runtime === "codex" ? CODEX_TS_JS_BETA_EXTENSIONS : REACT_ELIGIBLE_EXTENSIONS;
}

function relativePath(filePath: string, cwd: string): string {
  const relative = path.relative(cwd, filePath);
  return relative || path.basename(filePath);
}

export function hasReactNativeWebViewBoundaryMarker(sourceText: string): boolean {
  return (
    /\bfrom\s+["']react-native(?:\/[^"']*)?["']/.test(sourceText) ||
    /\brequire\(\s*["']react-native(?:\/[^"']*)?["']\s*\)/.test(sourceText) ||
    /\bfrom\s+["']react-native-webview["']/.test(sourceText) ||
    /\brequire\(\s*["']react-native-webview["']\s*\)/.test(sourceText) ||
    /<WebView(?:\s|>|\/)/.test(sourceText)
  );
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
  if (hasReactNativeWebViewBoundaryMarker(sourceText)) {
    return {
      runtime,
      filePath: outputPath,
      eligible: true,
      decision: "fallback",
      reasons: [REACT_NATIVE_WEBVIEW_BOUNDARY_REASON],
      debug: {},
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
  };

  if (readiness.ready) {
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
    reasons: readiness.reasons,
    readiness,
    debug,
    fallback: {
      action: "full-read",
      reason: readiness.reasons[0] ?? "missing-structure",
    },
  };
}
