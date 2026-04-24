import type { ExtractionResult, SourceFingerprint, SourceRange, StyleSystem } from "./schema";

export const DESIGN_REVIEW_METADATA_SCHEMA_VERSION = "design-review-metadata.v0" as const;

export const DESIGN_REVIEW_METADATA_ITEM_CAPS = {
  visualRegions: 12,
  variantAxes: 8,
  stateAxes: 8,
  interactionAnchors: 12,
  styleReferences: 16,
} as const;

export type DesignReviewEvidenceSource = "contract" | "behavior" | "structure" | "style" | "snippet";

export type DesignReviewEvidenceRefV0 = {
  source: DesignReviewEvidenceSource;
  field: string;
  value?: string;
  loc?: SourceRange;
};

export type DesignReviewVisualRegionV0 = {
  label: string;
  kind: "layout" | "form" | "list" | "content" | "control" | "unknown";
  loc?: SourceRange;
  evidence: DesignReviewEvidenceRefV0[];
};

export type DesignReviewVariantAxisV0 = {
  name: string;
  values?: string[];
  loc?: SourceRange;
  evidence: DesignReviewEvidenceRefV0[];
};

export type DesignReviewStateAxisV0 = {
  name: string;
  kind: "boolean" | "async" | "empty" | "error" | "selection" | "unknown";
  loc?: SourceRange;
  evidence: DesignReviewEvidenceRefV0[];
};

export type DesignReviewInteractionAnchorV0 = {
  label: string;
  kind: "event-handler" | "form-control" | "submit-handler" | "validation-anchor";
  loc?: SourceRange;
  evidence: DesignReviewEvidenceRefV0[];
};

export type DesignReviewStyleReferenceV0 = {
  kind: "tailwind-group" | "css-module" | "styled-component" | "inline-style" | "css-variable" | "theme-key" | "unknown";
  label: string;
  loc?: SourceRange;
  evidence: DesignReviewEvidenceRefV0[];
};

export type DesignReviewCompressionContractV0 = {
  sourceDerivedOnly: true;
  notVisualProof: true;
  notFigmaBacked: true;
  notAccessibilityAudit: true;
  notLspBacked: true;
  notProviderTokenized: true;
  maxItems: typeof DESIGN_REVIEW_METADATA_ITEM_CAPS;
  staleWhen: ["sourceFingerprint.fileHash changes", "sourceFingerprint.lineCount changes"];
  requiredUserActionOnStale: "rerun extraction or read current source before editing";
};

export type DesignReviewMetadataV0 = {
  schemaVersion: typeof DESIGN_REVIEW_METADATA_SCHEMA_VERSION;
  freshness: SourceFingerprint;
  scope: {
    kind: "same-file" | "same-component";
    filePath: string;
    componentName?: string;
    componentLoc?: SourceRange;
  };
  confidence: "high" | "medium" | "low";
  confidenceReasons: string[];
  visualRegions: DesignReviewVisualRegionV0[];
  variantAxes: DesignReviewVariantAxisV0[];
  stateAxes: DesignReviewStateAxisV0[];
  interactionAnchors: DesignReviewInteractionAnchorV0[];
  styleReferences: DesignReviewStyleReferenceV0[];
  compressionContract: DesignReviewCompressionContractV0;
};

export type DesignReviewFreshnessAssessment = {
  fresh: boolean;
  usableForEditing: boolean;
  reasons: string[];
  requiredUserActionOnStale?: DesignReviewCompressionContractV0["requiredUserActionOnStale"];
};

type EvidenceBearingItem = {
  evidence: DesignReviewEvidenceRefV0[];
};

const VARIANT_AXIS_NAMES = new Set(["variant", "tone", "size", "disabled", "selected", "loading", "compact"]);
const STATE_KEYWORDS = ["loading", "submitting", "pending", "error", "empty", "selected", "active", "expanded", "collapsed", "disabled"];
const ASYNC_STATES = new Set(["loading", "submitting", "pending"]);
const ERROR_STATES = new Set(["error"]);
const EMPTY_STATES = new Set(["empty"]);
const SELECTION_STATES = new Set(["selected", "active"]);

function fingerprintOf(result: ExtractionResult): SourceFingerprint | undefined {
  if (!result.fileHash || !Number.isFinite(result.meta.lineCount)) return undefined;
  return {
    fileHash: result.fileHash,
    lineCount: result.meta.lineCount,
  };
}

function evidence(source: DesignReviewEvidenceSource, field: string, value?: string, loc?: SourceRange): DesignReviewEvidenceRefV0 {
  return {
    source,
    field,
    ...(value ? { value } : {}),
    ...(loc ? { loc } : {}),
  };
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function propName(summary: string): string | undefined {
  const match = summary.match(/^([A-Za-z_$][\w$]*)\??\s*:/);
  return match?.[1];
}

function propValues(summary: string): string[] | undefined {
  const values = [...summary.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]).filter(Boolean);
  return values.length > 0 ? [...new Set(values)].slice(0, 8) : undefined;
}

function addUniqueBy<T>(items: T[], candidate: T, keyOf: (item: T) => string): void {
  const key = keyOf(candidate);
  if (items.some((item) => keyOf(item) === key)) return;
  items.push(candidate);
}

function allEmittedEvidence(metadata: {
  visualRegions: EvidenceBearingItem[];
  variantAxes: EvidenceBearingItem[];
  stateAxes: EvidenceBearingItem[];
  interactionAnchors: EvidenceBearingItem[];
  styleReferences: EvidenceBearingItem[];
}): DesignReviewEvidenceRefV0[][] {
  return [
    ...metadata.visualRegions.map((item) => item.evidence),
    ...metadata.variantAxes.map((item) => item.evidence),
    ...metadata.stateAxes.map((item) => item.evidence),
    ...metadata.interactionAnchors.map((item) => item.evidence),
    ...metadata.styleReferences.map((item) => item.evidence),
  ];
}

function classifyRegion(label: string): DesignReviewVisualRegionV0["kind"] {
  const normalized = label.toLowerCase();
  if (["form", "fieldset", "label"].includes(normalized)) return "form";
  if (["ul", "ol", "li", "table", "tbody", "tr"].includes(normalized) || normalized.includes("list")) return "list";
  if (["button", "input", "select", "textarea"].includes(normalized)) return "control";
  if (["section", "header", "footer", "main", "nav", "aside", "article"].includes(normalized) || normalized.includes("card") || normalized.includes("panel")) return "layout";
  if (/^[A-Z]/.test(label)) return "content";
  return "unknown";
}

function stateKind(name: string): DesignReviewStateAxisV0["kind"] {
  const normalized = name.toLowerCase();
  if ([...ASYNC_STATES].some((item) => normalized.includes(item))) return "async";
  if ([...ERROR_STATES].some((item) => normalized.includes(item))) return "error";
  if ([...EMPTY_STATES].some((item) => normalized.includes(item))) return "empty";
  if ([...SELECTION_STATES].some((item) => normalized.includes(item))) return "selection";
  if (/^(is|has|can|should)[A-Z]/.test(name) || normalized.startsWith("is") || normalized.startsWith("has")) return "boolean";
  return "unknown";
}

function styleKind(system: StyleSystem | undefined, summary: string): DesignReviewStyleReferenceV0["kind"] {
  if (system === "tailwind") return "tailwind-group";
  if (system === "css-modules") return "css-module";
  if (system === "styled-components") return "styled-component";
  if (system === "inline-style") return "inline-style";
  if (summary.includes("css-var")) return "css-variable";
  if (summary.includes("theme")) return "theme-key";
  return "unknown";
}

function compressionContract(): DesignReviewCompressionContractV0 {
  return {
    sourceDerivedOnly: true,
    notVisualProof: true,
    notFigmaBacked: true,
    notAccessibilityAudit: true,
    notLspBacked: true,
    notProviderTokenized: true,
    maxItems: DESIGN_REVIEW_METADATA_ITEM_CAPS,
    staleWhen: ["sourceFingerprint.fileHash changes", "sourceFingerprint.lineCount changes"],
    requiredUserActionOnStale: "rerun extraction or read current source before editing",
  };
}

function visualRegionsFrom(result: ExtractionResult): DesignReviewVisualRegionV0[] {
  const regions: DesignReviewVisualRegionV0[] = [];

  if (result.componentName) {
    addUniqueBy(
      regions,
      {
        label: result.componentName,
        kind: classifyRegion(result.componentName),
        ...(result.componentLoc ? { loc: result.componentLoc } : {}),
        evidence: [evidence("structure", "componentName", result.componentName, result.componentLoc)],
      },
      (item) => item.label,
    );
  }

  for (const section of result.structure?.sections ?? []) {
    addUniqueBy(
      regions,
      {
        label: section,
        kind: classifyRegion(section),
        evidence: [evidence("structure", "sections", section)],
      },
      (item) => item.label,
    );
  }

  for (const block of result.structure?.repeatedBlocks ?? []) {
    addUniqueBy(
      regions,
      {
        label: block === "array-map-render" ? "list" : block,
        kind: "list",
        evidence: [evidence("structure", "repeatedBlocks", block)],
      },
      (item) => `${item.kind}:${item.label}`,
    );
  }

  for (const control of result.behavior?.formSurface?.controls ?? []) {
    const label = control.name ? `${control.tag}[name=${control.name}]` : control.tag;
    addUniqueBy(
      regions,
      {
        label,
        kind: "control",
        ...(control.loc ? { loc: control.loc } : {}),
        evidence: [evidence("behavior", "formSurface.controls", label, control.loc)],
      },
      (item) => item.label,
    );
  }

  for (const snippet of result.snippets ?? []) {
    if (!snippet.loc) continue;
    addUniqueBy(
      regions,
      {
        label: snippet.label,
        kind: snippet.reason === "conditional-render" ? "content" : "unknown",
        loc: snippet.loc,
        evidence: [evidence("snippet", `snippets.${snippet.reason}`, snippet.label, snippet.loc)],
      },
      (item) => `${item.label}:${item.loc?.startLine ?? ""}`,
    );
  }

  return regions.slice(0, DESIGN_REVIEW_METADATA_ITEM_CAPS.visualRegions);
}

function variantAxesFrom(result: ExtractionResult): DesignReviewVariantAxisV0[] {
  const axes: DesignReviewVariantAxisV0[] = [];

  for (const summary of result.contract?.propsSummary ?? []) {
    const name = propName(summary);
    if (!name || !VARIANT_AXIS_NAMES.has(name)) continue;
    const values = propValues(summary);
    addUniqueBy(
      axes,
      {
        name,
        ...(values ? { values } : {}),
        ...(result.contract?.propsLoc ? { loc: result.contract.propsLoc } : {}),
        evidence: [evidence("contract", "propsSummary", summary, result.contract?.propsLoc)],
      },
      (item) => item.name,
    );
  }

  for (const branch of result.structure?.conditionalRenders ?? []) {
    for (const name of VARIANT_AXIS_NAMES) {
      if (!new RegExp(`\\b${name}\\b`, "i").test(branch)) continue;
      addUniqueBy(
        axes,
        {
          name,
          evidence: [evidence("structure", "conditionalRenders", compact(branch))],
        },
        (item) => item.name,
      );
    }
  }

  return axes.slice(0, DESIGN_REVIEW_METADATA_ITEM_CAPS.variantAxes);
}

function stateAxesFrom(result: ExtractionResult): DesignReviewStateAxisV0[] {
  const axes: DesignReviewStateAxisV0[] = [];
  const addState = (name: string, ref: DesignReviewEvidenceRefV0): void => {
    const cleaned = name.trim();
    if (!cleaned || /^set[A-Z]/.test(cleaned)) return;
    addUniqueBy(
      axes,
      {
        name: cleaned,
        kind: stateKind(cleaned),
        ...(ref.loc ? { loc: ref.loc } : {}),
        evidence: [ref],
      },
      (item) => item.name.toLowerCase(),
    );
  };

  for (const summary of result.behavior?.stateSummary ?? []) {
    for (const part of summary.split(",").map((item) => item.trim()).filter(Boolean)) {
      addState(part, evidence("behavior", "stateSummary", summary));
    }
  }

  for (const branch of result.structure?.conditionalRenders ?? []) {
    for (const keyword of STATE_KEYWORDS) {
      if (new RegExp(`\\b${keyword}\\b`, "i").test(branch)) {
        addState(keyword, evidence("structure", "conditionalRenders", compact(branch)));
      }
    }
  }

  for (const signal of result.behavior?.effectSignals ?? []) {
    if (signal.hasAsyncWork) {
      addState("asyncWork", evidence("behavior", "effectSignals", signal.hook, signal.loc));
    }
  }

  return axes.slice(0, DESIGN_REVIEW_METADATA_ITEM_CAPS.stateAxes);
}

function interactionAnchorsFrom(result: ExtractionResult): DesignReviewInteractionAnchorV0[] {
  const anchors: DesignReviewInteractionAnchorV0[] = [];

  for (const signal of result.behavior?.eventHandlerSignals ?? []) {
    addUniqueBy(
      anchors,
      {
        label: signal.name,
        kind: "event-handler",
        ...(signal.loc ? { loc: signal.loc } : {}),
        evidence: [evidence("behavior", "eventHandlerSignals", signal.trigger ?? signal.name, signal.loc)],
      },
      (item) => `${item.kind}:${item.label}:${item.loc?.startLine ?? ""}`,
    );
  }

  for (const control of result.behavior?.formSurface?.controls ?? []) {
    const label = control.name ? `${control.tag}[name=${control.name}]` : control.tag;
    addUniqueBy(
      anchors,
      {
        label,
        kind: "form-control",
        ...(control.loc ? { loc: control.loc } : {}),
        evidence: [evidence("behavior", "formSurface.controls", label, control.loc)],
      },
      (item) => `${item.kind}:${item.label}:${item.loc?.startLine ?? ""}`,
    );
  }

  for (const handler of result.behavior?.formSurface?.submitHandlers ?? []) {
    addUniqueBy(
      anchors,
      {
        label: handler.value,
        kind: "submit-handler",
        ...(handler.loc ? { loc: handler.loc } : {}),
        evidence: [evidence("behavior", "formSurface.submitHandlers", handler.value, handler.loc)],
      },
      (item) => `${item.kind}:${item.label}:${item.loc?.startLine ?? ""}`,
    );
  }

  for (const anchor of result.behavior?.formSurface?.validationAnchors ?? []) {
    addUniqueBy(
      anchors,
      {
        label: anchor.value,
        kind: "validation-anchor",
        ...(anchor.loc ? { loc: anchor.loc } : {}),
        evidence: [evidence("behavior", "formSurface.validationAnchors", anchor.value, anchor.loc)],
      },
      (item) => `${item.kind}:${item.label}:${item.loc?.startLine ?? ""}`,
    );
  }

  return anchors.slice(0, DESIGN_REVIEW_METADATA_ITEM_CAPS.interactionAnchors);
}

function styleReferencesFrom(result: ExtractionResult): DesignReviewStyleReferenceV0[] {
  const references: DesignReviewStyleReferenceV0[] = [];
  const system = result.style?.system;

  for (const summary of result.style?.summary ?? []) {
    addUniqueBy(
      references,
      {
        kind: styleKind(system, summary),
        label: summary,
        evidence: [evidence("style", "summary", summary)],
      },
      (item) => `${item.kind}:${item.label}`,
    );
  }

  if (system && system !== "unknown") {
    addUniqueBy(
      references,
      {
        kind: styleKind(system, system),
        label: system,
        evidence: [evidence("style", "system", system)],
      },
      (item) => `${item.kind}:${item.label}`,
    );
  }

  if (result.style?.hasStyleBranching) {
    addUniqueBy(
      references,
      {
        kind: styleKind(system, "style-branching"),
        label: "style-branching",
        evidence: [evidence("style", "hasStyleBranching", "true")],
      },
      (item) => `${item.kind}:${item.label}`,
    );
  }

  return references.slice(0, DESIGN_REVIEW_METADATA_ITEM_CAPS.styleReferences);
}

function confidenceFor(
  result: ExtractionResult,
  metadata: Pick<DesignReviewMetadataV0, "visualRegions" | "variantAxes" | "stateAxes" | "interactionAnchors" | "styleReferences">,
): Pick<DesignReviewMetadataV0, "confidence" | "confidenceReasons"> {
  const confidenceReasons: string[] = [];
  const evidenceSources = new Set<DesignReviewEvidenceSource>();
  for (const refs of allEmittedEvidence(metadata)) {
    for (const ref of refs) evidenceSources.add(ref.source);
  }

  if (result.componentName) confidenceReasons.push("component-identity-present");
  if (result.contract?.propsSummary?.length) confidenceReasons.push("contract-props-present");
  if (metadata.styleReferences.some((item) => item.kind !== "unknown")) confidenceReasons.push("style-system-evidence-present");
  if (metadata.interactionAnchors.length > 0 || metadata.stateAxes.length > 0) confidenceReasons.push("behavior-or-state-evidence-present");
  if (metadata.visualRegions.length > 0) confidenceReasons.push("visual-region-evidence-present");

  const everyItemHasEvidence = allEmittedEvidence(metadata).every((refs) => refs.length > 0);
  if (everyItemHasEvidence) confidenceReasons.push("all-items-have-evidence");

  const hasStrongDesignSurface =
    metadata.variantAxes.length >= 2 ||
    metadata.interactionAnchors.length >= 2 ||
    metadata.styleReferences.some((item) => item.kind === "styled-component");
  const hasKnownStyle = metadata.styleReferences.some((item) => item.kind !== "unknown");

  if (result.componentName && everyItemHasEvidence && evidenceSources.size >= 2 && hasKnownStyle && hasStrongDesignSurface) {
    return { confidence: "high", confidenceReasons };
  }
  if (result.componentName && everyItemHasEvidence && (evidenceSources.size >= 2 || metadata.visualRegions.length >= 2 || hasKnownStyle)) {
    return { confidence: "medium", confidenceReasons };
  }
  return {
    confidence: "low",
    confidenceReasons: confidenceReasons.length ? confidenceReasons : ["weak-source-derived-design-signals"],
  };
}

export function deriveDesignReviewMetadata(result: ExtractionResult): DesignReviewMetadataV0 | undefined {
  if (result.language !== "tsx" && result.language !== "jsx") return undefined;

  const freshness = fingerprintOf(result);
  if (!freshness) return undefined;

  const visualRegions = visualRegionsFrom(result);
  const variantAxes = variantAxesFrom(result);
  const stateAxes = stateAxesFrom(result);
  const interactionAnchors = interactionAnchorsFrom(result);
  const styleReferences = styleReferencesFrom(result);
  const confidence = confidenceFor(result, { visualRegions, variantAxes, stateAxes, interactionAnchors, styleReferences });

  return {
    schemaVersion: DESIGN_REVIEW_METADATA_SCHEMA_VERSION,
    freshness,
    scope: {
      kind: result.componentName && result.componentLoc ? "same-component" : "same-file",
      filePath: result.filePath,
      ...(result.componentName ? { componentName: result.componentName } : {}),
      ...(result.componentLoc ? { componentLoc: result.componentLoc } : {}),
    },
    confidence: confidence.confidence,
    confidenceReasons: confidence.confidenceReasons,
    visualRegions,
    variantAxes,
    stateAxes,
    interactionAnchors,
    styleReferences,
    compressionContract: compressionContract(),
  };
}

export function assessDesignReviewMetadataFreshness(metadata: DesignReviewMetadataV0, current: SourceFingerprint): DesignReviewFreshnessAssessment {
  const reasons: string[] = [];
  if (metadata.freshness.fileHash !== current.fileHash) reasons.push("stale-fileHash");
  if (metadata.freshness.lineCount !== current.lineCount) reasons.push("stale-lineCount");

  const fresh = reasons.length === 0;
  return {
    fresh,
    usableForEditing: fresh,
    reasons: fresh ? ["fresh"] : reasons,
    ...(fresh ? {} : { requiredUserActionOnStale: metadata.compressionContract.requiredUserActionOnStale }),
  };
}
