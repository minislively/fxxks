import path from "node:path";
import { extractFile } from "../core/extract";
import { toModelFacingPayload } from "../core/payload/model-facing";
import { assessPayloadReadiness } from "../core/payload/readiness";
import type { PreReadDecision } from "../core/schema";

const ELIGIBLE_EXTENSIONS = new Set([".tsx", ".jsx"]);

function relativePath(filePath: string, cwd: string): string {
  const relative = path.relative(cwd, filePath);
  return relative || path.basename(filePath);
}

export function decidePreRead(filePath: string, cwd = process.cwd(), runtime: PreReadDecision["runtime"] = "codex"): PreReadDecision {
  const resolvedPath = path.resolve(filePath);
  const outputPath = relativePath(resolvedPath, cwd);
  const extension = path.extname(resolvedPath);

  if (!ELIGIBLE_EXTENSIONS.has(extension)) {
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

  const result = extractFile(resolvedPath);
  const payload = toModelFacingPayload(result, cwd);
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
