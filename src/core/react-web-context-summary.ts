import type { ModelFacingPayload } from "./schema";

export const REACT_WEB_CONTEXT_SUMMARY_CLAIM_BOUNDARY = "source-backed-react-web-context-counts-only" as const;

export type ReactWebContextSummary = {
  present: boolean;
  schemaVersion: string;
  scope: {
    kind: "same-file" | "same-component";
    filePath: string;
    componentName?: string;
  };
  fieldCounts: Record<string, number>;
  totalAnchors: number;
  claimBoundary: typeof REACT_WEB_CONTEXT_SUMMARY_CLAIM_BOUNDARY;
};

const REACT_WEB_CONTEXT_SUMMARY_FIELDS = [
  "editTargetRouting",
  "formStateFlow",
  "a11yAnchors",
  "intentTargets",
  "stateHints",
  "layoutRegionHints",
  "componentApiHints",
  "stylingVariantHints",
  "importRoleHints",
  "renderStates",
  "localDependencies",
] as const;

export function reactWebContextSummaryFor(payload: ModelFacingPayload, useOriginal: boolean): ReactWebContextSummary | undefined {
  if (useOriginal || !payload.reactWebContext) return undefined;

  const fieldCounts: Record<string, number> = {};
  for (const field of REACT_WEB_CONTEXT_SUMMARY_FIELDS) {
    const values = payload.reactWebContext[field];
    if (Array.isArray(values) && values.length > 0) {
      fieldCounts[field] = values.length;
    }
  }

  return {
    present: true,
    schemaVersion: payload.reactWebContext.schemaVersion,
    scope: {
      kind: payload.reactWebContext.scope.kind,
      filePath: payload.reactWebContext.scope.filePath,
      componentName: payload.reactWebContext.scope.componentName,
    },
    fieldCounts,
    totalAnchors: Object.values(fieldCounts).reduce((total, count) => total + count, 0),
    claimBoundary: REACT_WEB_CONTEXT_SUMMARY_CLAIM_BOUNDARY,
  };
}

export function formatReactWebContextSummary(summary: ReactWebContextSummary): string {
  return `React Web context: ${summary.totalAnchors} source-backed anchors across ${Object.keys(summary.fieldCounts).length} summary fields (counts only; see --json).`;
}
