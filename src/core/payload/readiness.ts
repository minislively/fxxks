import type { ExtractionResult, ModelFacingPayload, PayloadReadiness } from "../schema";

export type PayloadReadinessOptions = {
  allowReactWebContractlessReadiness?: boolean;
};

export function assessPayloadReadiness(
  result: ExtractionResult,
  payload: ModelFacingPayload,
  options: PayloadReadinessOptions = {},
): PayloadReadiness {
  const reasons: string[] = [];
  const moduleLanguage = result.language === "ts" || result.language === "js";
  const hasModuleStructure = Boolean(payload.structure?.moduleDeclarations?.some((item) => item.kind !== "variable"));

  if (moduleLanguage && !hasModuleStructure) {
    reasons.push("missing-module-structure");
  }

  if (!moduleLanguage && payload.useOriginal && result.mode === "raw" && payload.rawText) {
    return {
      ready: true,
      reasons,
      signals: {
        mode: result.mode,
        hasContract: Boolean(payload.contract),
        hasBehavior: Boolean(payload.behavior),
        hasStructure: Boolean(payload.structure),
        hasHybridSnippets: Boolean(payload.snippets && payload.snippets.length > 0),
        usedComplexityScore: false,
        usedDecideReason: false,
      },
    };
  }

  if (result.mode === "raw") reasons.push("raw-mode");
  const hasDiagnosticReactWebReuseShape =
    options.allowReactWebContractlessReadiness === true &&
    result.domainDetection?.classification === "react-web" &&
    (payload.domainPayload?.domain === "react-web" || Boolean(payload.reactWebContext) || Boolean(payload.editGuidance));
  if (!moduleLanguage && !payload.contract && !hasDiagnosticReactWebReuseShape) reasons.push("missing-contract");
  if (!payload.behavior) reasons.push("missing-behavior");
  if (!payload.structure) reasons.push("missing-structure");
  if (result.mode === "hybrid" && (!payload.snippets || payload.snippets.length === 0)) {
    reasons.push("missing-hybrid-snippets");
  }

  return {
    ready: reasons.length === 0,
    reasons,
    signals: {
      mode: result.mode,
      hasContract: Boolean(payload.contract),
      hasBehavior: Boolean(payload.behavior),
      hasStructure: Boolean(payload.structure),
      hasHybridSnippets: Boolean(payload.snippets && payload.snippets.length > 0),
      usedComplexityScore: false,
      usedDecideReason: false,
    },
  };
}
