import type { DecisionConfidence, ExtractionResult, OutputMode } from "./schema";

export const RAW_ORIGINAL_SIZE_THRESHOLD_BYTES = 500;

export type DecideMetrics = {
  mode: OutputMode;
  complexityScore: number;
  reasons: string[];
  confidence: DecisionConfidence;
  useOriginal: boolean;
};

function confidenceForRaw(
  lineCount: number,
  jsxDepth: number,
  conditionalCount: number,
  hookCount: number,
  handlerCount: number,
  styleBranching: number,
): DecisionConfidence {
  const decisivelySmall =
    lineCount <= 28 &&
    jsxDepth <= 2 &&
    conditionalCount === 0 &&
    hookCount === 0 &&
    handlerCount <= 1 &&
    styleBranching === 0;
  if (decisivelySmall) {
    return "high";
  }

  const nearBoundary =
    lineCount >= 40 || jsxDepth >= 3 || conditionalCount >= 2 || hookCount === 1 || handlerCount >= 2;
  return nearBoundary ? "medium" : "high";
}

function confidenceForHybrid(
  lineCount: number,
  conditionalCount: number,
  repeatedCount: number,
  hookCount: number,
  handlerCount: number,
  styleBranching: number,
  importCount: number,
): DecisionConfidence {
  const strongSignalCount = [
    conditionalCount >= 2,
    repeatedCount >= 1,
    hookCount >= 3,
    handlerCount >= 3,
    styleBranching === 1,
    importCount >= 8,
    lineCount >= 120,
  ].filter(Boolean).length;

  if (strongSignalCount >= 3) {
    return "high";
  }

  return strongSignalCount >= 2 ? "medium" : "low";
}

function confidenceForCompressed(
  lineCount: number,
  jsxDepth: number,
  conditionalCount: number,
  hookCount: number,
  handlerCount: number,
  styleBranching: number,
  importCount: number,
): DecisionConfidence {
  const nearRawBoundary = lineCount <= 55 && jsxDepth <= 4 && conditionalCount <= 1 && hookCount <= 1 && handlerCount <= 2 && styleBranching === 0;
  const nearHybridBoundary = conditionalCount === 1 || hookCount === 2 || handlerCount === 2 || styleBranching === 1 || importCount >= 8 || lineCount >= 100;

  if (!nearRawBoundary && !nearHybridBoundary) {
    return "high";
  }

  return nearRawBoundary && nearHybridBoundary ? "low" : "medium";
}

export function decideMode(base: Omit<ExtractionResult, "mode">): DecideMetrics {
  const lineCount = base.meta.lineCount;
  const jsxDepth = base.structure?.jsxDepth ?? 0;
  const conditionalCount = base.structure?.conditionalRenders?.length ?? 0;
  const repeatedCount = base.structure?.repeatedBlocks?.length ?? 0;
  const moduleDeclarationCount = base.structure?.moduleDeclarations?.length ?? 0;
  const hookCount = base.behavior?.hooks.length ?? 0;
  const handlerCount = base.behavior?.eventHandlers?.length ?? 0;
  const styleBranching = base.style?.hasStyleBranching ? 1 : 0;
  const importCount = base.meta.importCount;
  const rawSizeBytes = base.meta.rawSizeBytes;
  const moduleLanguage = base.language === "ts" || base.language === "js";

  const complexityScore =
    lineCount * 0.05 +
    jsxDepth * 3 +
    conditionalCount * 8 +
    repeatedCount * 7 +
    hookCount * 4 +
    handlerCount * 3 +
    styleBranching * 6 +
    importCount * 1.2;

  const reasons: string[] = [];
  if (lineCount <= 40) reasons.push("small-file");
  if (jsxDepth <= 3) reasons.push("shallow-jsx");
  if (conditionalCount >= 2) reasons.push("multiple-conditionals");
  if (repeatedCount >= 1) reasons.push("repeated-rendering");
  if (hookCount >= 3) reasons.push("heavy-hook-usage");
  if (handlerCount >= 3) reasons.push("event-heavy");
  if (styleBranching) reasons.push("style-branching");
  if (importCount >= 8) reasons.push("import-heavy");
  if (lineCount >= 120) reasons.push("long-file");
  if (moduleLanguage && moduleDeclarationCount > 0) reasons.push("module-structure");

  const isRawCandidate = !moduleLanguage && lineCount <= 45 && jsxDepth <= 3 && conditionalCount <= 1 && hookCount <= 1 && handlerCount <= 1 && !styleBranching;
  const isHybridCandidate = conditionalCount >= 2 || handlerCount >= 3 || hookCount >= 3 || styleBranching === 1;

  if (isRawCandidate) {
    return {
      mode: "raw",
      complexityScore,
      reasons,
      confidence: confidenceForRaw(lineCount, jsxDepth, conditionalCount, hookCount, handlerCount, styleBranching),
      useOriginal: rawSizeBytes < RAW_ORIGINAL_SIZE_THRESHOLD_BYTES,
    };
  }

  if (isHybridCandidate) {
    return {
      mode: "hybrid",
      complexityScore,
      reasons,
      confidence: confidenceForHybrid(lineCount, conditionalCount, repeatedCount, hookCount, handlerCount, styleBranching, importCount),
      useOriginal: false,
    };
  }

  return {
    mode: "compressed",
    complexityScore,
    reasons,
    confidence: confidenceForCompressed(lineCount, jsxDepth, conditionalCount, hookCount, handlerCount, styleBranching, importCount),
    useOriginal: false,
  };
}
