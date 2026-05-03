import path from "node:path";
import { deriveDesignReviewMetadata } from "../design-review-metadata";
import { buildFrontendDomainPayload, REACT_WEB_DOMAIN_PAYLOAD_POLICY } from "./domain-payload";
import type { EditGuidance, ExtractionResult, ModelFacingPayload, PatchTarget, PatchTargetKind, SourceFingerprint, SourceRange } from "../schema";

const PATCH_TARGET_LIMIT = 12;

const EDIT_GUIDANCE_INSTRUCTIONS = [
  "Use patchTargets only after confirming sourceFingerprint.fileHash and sourceFingerprint.lineCount still match the current source.",
  "If fileHash or lineCount changed, re-run fooks extract or read the file before editing.",
  "Treat loc ranges as AST-derived line edit aids, not LSP-backed semantic rename/reference locations.",
];

export type ModelFacingPayloadOptions = {
  includeEditGuidance?: boolean;
  includeDesignReviewMetadata?: boolean;
  includeDomainPayload?: boolean;
  domainPayloadPolicy?: string;
};

function supportsEditGuidance(result: ExtractionResult): boolean {
  return result.language === "tsx" || result.language === "jsx";
}

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

function hasSourceRanges(result: ExtractionResult): boolean {
  return Boolean(
    result.componentLoc ||
      result.contract?.propsLoc ||
      result.structure?.moduleDeclarations?.some((item) => item.loc) ||
      result.snippets?.some((item) => item.loc) ||
      result.behavior?.effectSignals?.some((item) => item.loc) ||
      result.behavior?.callbackSignals?.some((item) => item.loc) ||
      result.behavior?.eventHandlerSignals?.some((item) => item.loc) ||
      result.behavior?.formSurface?.controls?.some((item) => item.loc) ||
      result.behavior?.formSurface?.submitHandlers?.some((item) => item.loc) ||
      result.behavior?.formSurface?.validationAnchors?.some((item) => item.loc),
  );
}

function sourceFingerprint(result: ExtractionResult): SourceFingerprint | undefined {
  if (!hasSourceRanges(result)) return undefined;
  return {
    fileHash: result.fileHash,
    lineCount: result.meta.lineCount,
  };
}

function patchTargetLabel(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function buildEditGuidance(result: ExtractionResult, freshness: SourceFingerprint | undefined): EditGuidance | undefined {
  if (!freshness) return undefined;

  const targets: PatchTarget[] = [];
  const seen = new Set<string>();

  const addTarget = (kind: PatchTargetKind, label: string, loc: SourceRange | undefined, reason: string) => {
    if (!loc) return;
    const normalizedLabel = patchTargetLabel(label, kind);
    const key = `${kind}:${normalizedLabel}:${loc.startLine}:${loc.endLine}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({
      kind,
      label: normalizedLabel,
      loc,
      reason,
    });
  };

  addTarget("component", result.componentName ?? "component", result.componentLoc, "Primary component declaration for broad component-level edits.");
  addTarget("props", result.contract?.propsName ?? "props", result.contract?.propsLoc, "Props contract anchor for API and prop-shape edits.");

  for (const signal of result.behavior?.effectSignals ?? []) {
    const deps = signal.deps && signal.deps.length > 0 ? ` deps:[${signal.deps.join(", ")}]` : "";
    addTarget("effect", `${signal.hook}${deps}`, signal.loc, "Effect hook anchor for side-effect, cleanup, and async-work edits.");
  }

  for (const signal of result.behavior?.callbackSignals ?? []) {
    const deps = signal.deps && signal.deps.length > 0 ? ` deps:[${signal.deps.join(", ")}]` : "";
    addTarget("callback", `${signal.hook}${deps}`, signal.loc, "Callback/memo hook anchor for interaction or derived-value edits.");
  }

  for (const signal of result.behavior?.eventHandlerSignals ?? []) {
    addTarget("event-handler", signal.name, signal.loc, "Event handler anchor for user interaction edits.");
  }

  const formSurface = result.behavior?.formSurface;
  for (const control of formSurface?.controls ?? []) {
    const label = control.name ? `${control.tag}[name=${control.name}]` : control.tag;
    addTarget("form-control", label, control.loc, "Form control anchor for input, validation, and handler edits.");
  }

  for (const handler of formSurface?.submitHandlers ?? []) {
    addTarget("submit-handler", handler.value, handler.loc, "Form submit anchor for submission flow edits.");
  }

  for (const anchor of formSurface?.validationAnchors ?? []) {
    addTarget("validation-anchor", anchor.value, anchor.loc, "Validation anchor for form validation and schema edits.");
  }

  for (const snippet of result.snippets ?? []) {
    addTarget("snippet", snippet.label, snippet.loc, `Representative ${snippet.reason} snippet for localized patch edits.`);
  }

  if (targets.length === 0) return undefined;

  return {
    freshness,
    instructions: EDIT_GUIDANCE_INSTRUCTIONS,
    patchTargets: targets.slice(0, PATCH_TARGET_LIMIT),
  };
}

export function toModelFacingPayload(result: ExtractionResult, cwd = process.cwd(), options: ModelFacingPayloadOptions = {}): ModelFacingPayload {
  const domainPayload = options.includeDomainPayload
    ? buildFrontendDomainPayload(result, result.domainDetection, options.domainPayloadPolicy ?? REACT_WEB_DOMAIN_PAYLOAD_POLICY)
    : undefined;

  if (result.useOriginal && result.mode === "raw" && result.rawText) {
    return {
      mode: result.mode,
      filePath: toRelativePath(result.filePath, cwd),
      useOriginal: true,
      rawText: result.rawText,
      ...(domainPayload ? { domainPayload } : {}),
    };
  }

  const contract = result.contract
    ? pruneObject({
        ...(result.contract.propsName ? { propsName: result.contract.propsName } : {}),
        ...(pruneArray(result.contract.propsSummary) ? { propsSummary: result.contract.propsSummary } : {}),
        ...(result.contract.hasForwardRef ? { hasForwardRef: result.contract.hasForwardRef } : {}),
        ...(result.contract.propsLoc ? { propsLoc: result.contract.propsLoc } : {}),
      })
    : undefined;

  const formSurface = result.behavior?.formSurface
    ? pruneObject({
        ...(pruneArray(result.behavior.formSurface.controls) ? { controls: result.behavior.formSurface.controls } : {}),
        ...(pruneArray(result.behavior.formSurface.submitHandlers) ? { submitHandlers: result.behavior.formSurface.submitHandlers } : {}),
        ...(pruneArray(result.behavior.formSurface.validationAnchors) ? { validationAnchors: result.behavior.formSurface.validationAnchors } : {}),
      })
    : undefined;

  const behavior = result.behavior
    ? pruneObject({
        hooks: result.behavior.hooks,
        ...(pruneArray(result.behavior.stateSummary) ? { stateSummary: result.behavior.stateSummary } : {}),
        ...(pruneArray(result.behavior.effects) ? { effects: result.behavior.effects } : {}),
        ...(pruneArray(result.behavior.effectSignals) ? { effectSignals: result.behavior.effectSignals } : {}),
        ...(pruneArray(result.behavior.callbackSignals) ? { callbackSignals: result.behavior.callbackSignals } : {}),
        ...(pruneArray(result.behavior.eventHandlers) ? { eventHandlers: result.behavior.eventHandlers } : {}),
        ...(pruneArray(result.behavior.eventHandlerSignals) ? { eventHandlerSignals: result.behavior.eventHandlerSignals } : {}),
        ...(formSurface ? { formSurface } : {}),
        ...(result.behavior.hasSideEffects ? { hasSideEffects: result.behavior.hasSideEffects } : {}),
      })
    : undefined;

  const structure = result.structure
    ? pruneObject({
        ...(pruneArray(result.structure.sections) ? { sections: result.structure.sections } : {}),
        ...(pruneArray(result.structure.conditionalRenders) ? { conditionalRenders: result.structure.conditionalRenders } : {}),
        ...(pruneArray(result.structure.repeatedBlocks) ? { repeatedBlocks: result.structure.repeatedBlocks } : {}),
        ...(typeof result.structure.jsxDepth === "number" ? { jsxDepth: result.structure.jsxDepth } : {}),
        ...(pruneArray(result.structure.moduleDeclarations) ? { moduleDeclarations: result.structure.moduleDeclarations } : {}),
      })
    : undefined;

  const style = result.style
    ? pruneObject({
        ...(result.style.system && result.style.system !== "unknown" ? { system: result.style.system } : {}),
        ...(pruneArray(result.style.summary) ? { summary: result.style.summary } : {}),
        ...(result.style.hasStyleBranching ? { hasStyleBranching: result.style.hasStyleBranching } : {}),
      })
    : undefined;
  const fingerprint = sourceFingerprint(result);
  const editGuidance = options.includeEditGuidance && supportsEditGuidance(result)
    ? buildEditGuidance(result, fingerprint)
    : undefined;
  const designReviewMetadata = options.includeDesignReviewMetadata
    ? deriveDesignReviewMetadata(result)
    : undefined;

  return {
    mode: result.mode,
    filePath: toRelativePath(result.filePath, cwd),
    ...(result.mode === "raw" && result.rawText ? { rawText: result.rawText } : {}),
    ...(result.componentName ? { componentName: result.componentName } : {}),
    ...(result.componentLoc ? { componentLoc: result.componentLoc } : {}),
    ...(fingerprint ? { sourceFingerprint: fingerprint } : {}),
    ...(editGuidance ? { editGuidance } : {}),
    ...(designReviewMetadata ? { designReviewMetadata } : {}),
    ...(domainPayload ? { domainPayload } : {}),
    ...(result.exports.length > 0 ? { exports: result.exports } : {}),
    ...(contract ? { contract } : {}),
    ...(behavior ? { behavior } : {}),
    ...(structure ? { structure } : {}),
    ...(style ? { style } : {}),
    ...(result.mode === "hybrid" && result.snippets && result.snippets.length > 0 ? { snippets: result.snippets } : {}),
  };
}
