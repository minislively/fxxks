import path from "node:path";
import type { ExtractionResult, ModelFacingPayload } from "../schema";

function pruneArray<T>(value: T[] | undefined): T[] | undefined {
  return value && value.length > 0 ? value : undefined;
}

function pruneObject<T extends Record<string, unknown>>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

function toRelativePath(filePath: string, cwd: string): string {
  const relative = path.relative(cwd, filePath);
  return relative || path.basename(filePath);
}

export function toModelFacingPayload(result: ExtractionResult, cwd = process.cwd()): ModelFacingPayload {
  if (result.useOriginal && result.mode === "raw" && result.rawText) {
    return {
      mode: result.mode,
      filePath: toRelativePath(result.filePath, cwd),
      useOriginal: true,
      rawText: result.rawText,
    };
  }

  const contract = result.contract
    ? pruneObject({
        ...(result.contract.propsName ? { propsName: result.contract.propsName } : {}),
        ...(pruneArray(result.contract.propsSummary) ? { propsSummary: result.contract.propsSummary } : {}),
        ...(result.contract.hasForwardRef ? { hasForwardRef: result.contract.hasForwardRef } : {}),
      })
    : undefined;

  const behavior = result.behavior
    ? pruneObject({
        hooks: result.behavior.hooks,
        ...(pruneArray(result.behavior.stateSummary) ? { stateSummary: result.behavior.stateSummary } : {}),
        ...(pruneArray(result.behavior.effects) ? { effects: result.behavior.effects } : {}),
        ...(pruneArray(result.behavior.eventHandlers) ? { eventHandlers: result.behavior.eventHandlers } : {}),
        ...(result.behavior.hasSideEffects ? { hasSideEffects: result.behavior.hasSideEffects } : {}),
      })
    : undefined;

  const structure = result.structure
    ? pruneObject({
        ...(pruneArray(result.structure.sections) ? { sections: result.structure.sections } : {}),
        ...(pruneArray(result.structure.conditionalRenders) ? { conditionalRenders: result.structure.conditionalRenders } : {}),
        ...(pruneArray(result.structure.repeatedBlocks) ? { repeatedBlocks: result.structure.repeatedBlocks } : {}),
        ...(typeof result.structure.jsxDepth === "number" ? { jsxDepth: result.structure.jsxDepth } : {}),
      })
    : undefined;

  const style = result.style
    ? pruneObject({
        ...(result.style.system && result.style.system !== "unknown" ? { system: result.style.system } : {}),
        ...(pruneArray(result.style.summary) ? { summary: result.style.summary } : {}),
        ...(result.style.hasStyleBranching ? { hasStyleBranching: result.style.hasStyleBranching } : {}),
      })
    : undefined;

  return {
    mode: result.mode,
    filePath: toRelativePath(result.filePath, cwd),
    ...(result.componentName ? { componentName: result.componentName } : {}),
    ...(result.exports.length > 0 ? { exports: result.exports } : {}),
    ...(contract ? { contract } : {}),
    ...(behavior ? { behavior } : {}),
    ...(structure ? { structure } : {}),
    ...(style ? { style } : {}),
    ...(result.mode === "hybrid" && result.snippets && result.snippets.length > 0 ? { snippets: result.snippets } : {}),
  };
}
