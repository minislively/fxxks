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
  fieldOrder: string[];
  formStateRoles?: {
    roles: string[];
    counts: Record<string, number>;
  };
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
  "formStateRoles",
] as const;

function summarizeFormStateRoles(payload: ModelFacingPayload): ReactWebContextSummary["formStateRoles"] | undefined {
  const roles = payload.reactWebContext?.formStateRoles;
  if (!Array.isArray(roles) || roles.length === 0) return undefined;

  const counts: Record<string, number> = {};
  for (const role of roles) {
    counts[role.role] = (counts[role.role] ?? 0) + 1;
  }

  return {
    roles: Object.keys(counts).sort(),
    counts,
  };
}

export function reactWebContextSummaryFor(payload: ModelFacingPayload, useOriginal: boolean): ReactWebContextSummary | undefined {
  if (useOriginal || !payload.reactWebContext) return undefined;

  const fieldCounts: Record<string, number> = {};
  for (const field of REACT_WEB_CONTEXT_SUMMARY_FIELDS) {
    const values = payload.reactWebContext[field];
    if (Array.isArray(values) && values.length > 0) {
      fieldCounts[field] = values.length;
    }
  }

  const fieldOrder = REACT_WEB_CONTEXT_SUMMARY_FIELDS.filter((field) => fieldCounts[field] > 0).sort(
    (left, right) => fieldCounts[right] - fieldCounts[left],
  );
  const formStateRoles = summarizeFormStateRoles(payload);

  return {
    present: true,
    schemaVersion: payload.reactWebContext.schemaVersion,
    scope: {
      kind: payload.reactWebContext.scope.kind,
      filePath: payload.reactWebContext.scope.filePath,
      componentName: payload.reactWebContext.scope.componentName,
    },
    fieldCounts,
    fieldOrder,
    ...(formStateRoles ? { formStateRoles } : {}),
    totalAnchors: Object.values(fieldCounts).reduce((total, count) => total + count, 0),
    claimBoundary: REACT_WEB_CONTEXT_SUMMARY_CLAIM_BOUNDARY,
  };
}

export function formatReactWebContextSummary(summary: ReactWebContextSummary): string {
  const topFields = summary.fieldOrder
    .slice(0, 4)
    .map((field) => `${field}=${summary.fieldCounts[field]}`)
    .join(", ");
  const fieldDetails = topFields ? `; top fields: ${topFields}` : "";
  const roleDetails = summary.formStateRoles?.roles.length
    ? `; form-state roles: ${summary.formStateRoles.roles.slice(0, 6).join(", ")}`
    : "";
  return `React Web context: ${summary.totalAnchors} source-backed anchors across ${summary.fieldOrder.length} summary fields${fieldDetails}${roleDetails} (source-only counts; see --json).`;
}
