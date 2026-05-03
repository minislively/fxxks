import {
  REACT_WEB_CONTEXT_METADATA_SCHEMA_VERSION,
  type EditGuidance,
  type ExtractionResult,
  type ReactWebContextA11yAnchor,
  type ReactWebContextIntentTarget,
  type ReactWebContextLocalDependency,
  type ReactWebContextMetadataV0,
  type ReactWebContextRenderState,
  type ReactWebContextStateHint,
  type SourceFingerprint,
} from "./schema";

export const REACT_WEB_CONTEXT_METADATA_ITEM_CAPS = {
  stateHints: 12,
  renderStates: 12,
  a11yAnchors: 16,
  localDependencies: 12,
  intentTargets: 16,
} as const;

const REACT_WEB_CONTEXT_WARNINGS = [
  "React Web current supported lane only; this metadata does not imply React Native, WebView, TUI, Mixed, or Unknown support.",
  "Source-derived repeated-read context hints only; not LSP-backed and not a dependency graph.",
  "A11y anchors are source-observed hints only, not an accessibility audit.",
  "This metadata is not proof of runtime/provider token savings.",
  "Rerun extraction or read current source if sourceFingerprint.fileHash or sourceFingerprint.lineCount changes.",
];

function compact(value: string, maxLength = 80): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function pruneArray<T>(items: T[], limit: number): T[] | undefined {
  return items.length > 0 ? items.slice(0, limit) : undefined;
}

function dedupeBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function buildStateHints(result: ExtractionResult): ReactWebContextStateHint[] {
  const hints: ReactWebContextStateHint[] = [];

  for (const label of result.behavior?.stateSummary ?? []) {
    hints.push({
      label: compact(label),
      kind: "state",
      evidence: ["behavior.stateSummary"],
    });
  }

  for (const signal of result.behavior?.effectSignals ?? []) {
    hints.push({
      label: signal.hook,
      kind: "effect",
      ...(signal.loc ? { loc: signal.loc } : {}),
      ...(signal.deps && signal.deps.length > 0 ? { deps: signal.deps } : {}),
      evidence: ["behavior.effectSignals"],
    });
  }

  for (const signal of result.behavior?.callbackSignals ?? []) {
    hints.push({
      label: signal.hook,
      kind: "callback",
      ...(signal.loc ? { loc: signal.loc } : {}),
      ...(signal.deps && signal.deps.length > 0 ? { deps: signal.deps } : {}),
      evidence: ["behavior.callbackSignals"],
    });
  }

  return dedupeBy(hints, (item) => `${item.kind}:${item.label}:${item.loc?.startLine ?? ""}:${item.deps?.join(",") ?? ""}`);
}

function buildRenderStates(result: ExtractionResult): ReactWebContextRenderState[] {
  const states: ReactWebContextRenderState[] = [];

  for (const condition of result.structure?.conditionalRenders ?? []) {
    states.push({
      label: "conditional-render",
      kind: "conditional",
      condition: compact(condition),
      evidence: ["structure.conditionalRenders"],
    });
  }

  for (const repeated of result.structure?.repeatedBlocks ?? []) {
    states.push({
      label: compact(repeated),
      kind: "repeated",
      evidence: ["structure.repeatedBlocks"],
    });
  }

  return dedupeBy(states, (item) => `${item.kind}:${item.label}:${item.condition ?? ""}`);
}

function buildA11yAnchors(result: ExtractionResult): ReactWebContextA11yAnchor[] {
  const anchors: ReactWebContextA11yAnchor[] = [];

  for (const anchor of result.behavior?.a11yAnchors ?? []) {
    anchors.push({
      kind: anchor.kind,
      label: anchor.label,
      ...(anchor.loc ? { loc: anchor.loc } : {}),
      evidence: ["behavior.a11yAnchors"],
    });
  }

  for (const control of result.behavior?.formSurface?.controls ?? []) {
    for (const prop of control.props ?? []) {
      if (prop === "required" || prop === "disabled" || prop === "readOnly") {
        anchors.push({
          kind: prop === "readOnly" ? "readonly" : prop,
          label: control.name ? `${control.tag}[name=${control.name}]` : control.tag,
          ...(control.loc ? { loc: control.loc } : {}),
          evidence: ["behavior.formSurface.controls.props"],
        });
      }
    }
  }

  for (const attr of result.domainDetection?.evidence ?? []) {
    if (attr.domain !== "react-web" || attr.signal !== "jsx-attribute") continue;
    if (attr.detail === "htmlFor") {
      anchors.push({ kind: "htmlFor", label: "htmlFor", evidence: ["domainDetection.evidence.jsx-attribute"] });
    }
    if (attr.detail === "role") {
      anchors.push({ kind: "role", label: "role", evidence: ["domainDetection.evidence.jsx-attribute"] });
    }
    if (attr.detail.startsWith("aria-")) {
      anchors.push({ kind: "aria", label: attr.detail, evidence: ["domainDetection.evidence.jsx-attribute"] });
    }
  }

  for (const anchor of result.behavior?.formSurface?.validationAnchors ?? []) {
    if (/error/i.test(anchor.value)) {
      anchors.push({
        kind: "error-text",
        label: compact(anchor.value),
        ...(anchor.loc ? { loc: anchor.loc } : {}),
        evidence: ["behavior.formSurface.validationAnchors"],
      });
    }
  }

  return dedupeBy(anchors, (item) => `${item.kind}:${item.label}:${item.loc?.startLine ?? ""}`);
}

function buildLocalDependencies(result: ExtractionResult): ReactWebContextLocalDependency[] {
  const dependencies: ReactWebContextLocalDependency[] = [];

  for (const declaration of result.structure?.moduleDeclarations ?? []) {
    dependencies.push({
      symbol: declaration.value,
      kind: "local-declaration",
      ...(declaration.loc ? { loc: declaration.loc } : {}),
      ...(result.componentName ? { usedBy: [result.componentName] } : {}),
    });
  }

  for (const item of result.exports) {
    dependencies.push({
      symbol: item.name,
      kind: "local-declaration",
      ...(result.componentLoc ? { loc: result.componentLoc } : {}),
      ...(result.componentName ? { usedBy: [result.componentName] } : {}),
    });
  }

  return dedupeBy(dependencies, (item) => `${item.kind}:${item.symbol}:${item.loc?.startLine ?? ""}`);
}

function intentForPatchTarget(kind: EditGuidance["patchTargets"][number]["kind"]): ReactWebContextIntentTarget["intent"] | undefined {
  switch (kind) {
    case "component":
      return "component";
    case "props":
      return "props";
    case "effect":
    case "callback":
      return "state";
    case "event-handler":
      return "handler";
    case "form-control":
    case "submit-handler":
    case "validation-anchor":
      return "form";
    case "snippet":
      return "branch";
    default:
      return undefined;
  }
}

function buildIntentTargets(result: ExtractionResult, editGuidance: EditGuidance | undefined): ReactWebContextIntentTarget[] {
  const targets: ReactWebContextIntentTarget[] = [];

  for (const target of editGuidance?.patchTargets ?? []) {
    const intent = intentForPatchTarget(target.kind);
    if (!intent) continue;
    targets.push({
      intent,
      label: target.label,
      loc: target.loc,
      source: "editGuidance",
    });
  }

  if (result.style?.hasStyleBranching || (result.style?.system && result.style.system !== "unknown")) {
    targets.push({
      intent: "style",
      label: result.style.system ?? "style",
      source: "style",
    });
  }

  for (const condition of result.structure?.conditionalRenders ?? []) {
    targets.push({
      intent: "branch",
      label: compact(condition),
      source: "structure",
    });
  }

  return dedupeBy(targets, (item) => `${item.intent}:${item.label}:${item.loc?.startLine ?? ""}:${item.source}`);
}

export function buildReactWebContextMetadata(
  result: ExtractionResult,
  freshness: SourceFingerprint | undefined,
  filePath: string,
  editGuidance?: EditGuidance,
): ReactWebContextMetadataV0 | undefined {
  if (!freshness) return undefined;

  const stateHints = pruneArray(buildStateHints(result), REACT_WEB_CONTEXT_METADATA_ITEM_CAPS.stateHints);
  const renderStates = pruneArray(buildRenderStates(result), REACT_WEB_CONTEXT_METADATA_ITEM_CAPS.renderStates);
  const a11yAnchors = pruneArray(buildA11yAnchors(result), REACT_WEB_CONTEXT_METADATA_ITEM_CAPS.a11yAnchors);
  const localDependencies = pruneArray(buildLocalDependencies(result), REACT_WEB_CONTEXT_METADATA_ITEM_CAPS.localDependencies);
  const intentTargets = pruneArray(buildIntentTargets(result, editGuidance), REACT_WEB_CONTEXT_METADATA_ITEM_CAPS.intentTargets);

  const hasContext = Boolean(stateHints || renderStates || a11yAnchors || localDependencies || intentTargets);
  if (!hasContext) return undefined;

  return {
    schemaVersion: REACT_WEB_CONTEXT_METADATA_SCHEMA_VERSION,
    freshness,
    scope: {
      kind: result.componentName && result.componentLoc ? "same-component" : "same-file",
      filePath,
      ...(result.componentName ? { componentName: result.componentName } : {}),
      ...(result.componentLoc ? { componentLoc: result.componentLoc } : {}),
    },
    ...(stateHints ? { stateHints } : {}),
    ...(renderStates ? { renderStates } : {}),
    ...(a11yAnchors ? { a11yAnchors } : {}),
    ...(localDependencies ? { localDependencies } : {}),
    ...(intentTargets ? { intentTargets } : {}),
    warnings: REACT_WEB_CONTEXT_WARNINGS,
  };
}
