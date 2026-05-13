export const REACT_WEB_DECISION_SCHEMA_VERSION = "react-web-decision.v1" as const;

export type ReactWebDecisionState =
  | "ready-for-agent-inspect"
  | "human-decision-required"
  | "dry-run-candidate-only"
  | "unsupported"
  | "incomplete"
  | "malformed-stop";

export type ReactWebDecisionConfidence = "high" | "medium";

export type ReactWebDecisionAllowedActions = {
  inspect: boolean;
  suggestPatch: boolean;
  applyPatch: false;
  generateCopy: false;
};

export type ReactWebDecision = {
  schemaVersion: typeof REACT_WEB_DECISION_SCHEMA_VERSION;
  state: ReactWebDecisionState;
  allowedActions: ReactWebDecisionAllowedActions;
  stopConditions: string[];
  reason: string;
  confidence?: ReactWebDecisionConfidence;
  source: {
    findingId?: string;
    cardId?: string;
    projection?: "issue-card" | "summary-json" | "dry-run-json" | "agent-handoff";
  };
  rule: string;
  issueKind?: string;
  dryRunOnly: boolean;
  humanReviewRequired: true;
  autoApply: false;
};

export type BuildReactWebIssueDecisionOptions = {
  cardId: string;
  issueKind: string;
  confidence: ReactWebDecisionConfidence;
  fixability: "safe-preview" | "manual-review";
  previewAvailable: boolean;
  skipReason?: string;
};

const READ_ONLY_STOP_CONDITIONS = [
  "Current source evidence outranks advisory context, repo convention, or historical memory.",
  "Advisory context cannot grant applyPatch or generateCopy authority.",
  "Do not apply patches automatically.",
  "Do not generate accessible-name copy.",
  "Do not infer custom-component semantics.",
  "Do not broaden this React Web native-control issue into an accessibility audit.",
] as const;

function allowedActions(inspect: boolean, suggestPatch: boolean): ReactWebDecisionAllowedActions {
  return {
    inspect,
    suggestPatch,
    applyPatch: false,
    generateCopy: false,
  };
}

function decision(options: {
  state: ReactWebDecisionState;
  inspect: boolean;
  suggestPatch: boolean;
  stopConditions: string[];
  reason: string;
  confidence?: ReactWebDecisionConfidence;
  source: ReactWebDecision["source"];
  rule: string;
  issueKind?: string;
  dryRunOnly: boolean;
}): ReactWebDecision {
  return {
    schemaVersion: REACT_WEB_DECISION_SCHEMA_VERSION,
    state: options.state,
    allowedActions: allowedActions(options.inspect, options.suggestPatch),
    stopConditions: options.stopConditions,
    reason: options.reason,
    ...(options.confidence ? { confidence: options.confidence } : {}),
    source: options.source,
    rule: options.rule,
    ...(options.issueKind ? { issueKind: options.issueKind } : {}),
    dryRunOnly: options.dryRunOnly,
    humanReviewRequired: true,
    autoApply: false,
  };
}

export function buildReactWebIssueDecision(options: BuildReactWebIssueDecisionOptions): ReactWebDecision {
  if (options.fixability === "safe-preview" && options.previewAvailable) {
    return decision({
      state: "ready-for-agent-inspect",
      inspect: true,
      suggestPatch: true,
      stopConditions: [
        ...READ_ONLY_STOP_CONDITIONS,
        "Treat high confidence as preview quality only; it does not authorize applyPatch.",
        "Human review must confirm the htmlFor/id association before any separate edit.",
      ],
      reason:
        "High-confidence native label/control evidence can be inspected as a read-only patch-shape preview, but fooks does not apply it.",
      confidence: options.confidence,
      source: { cardId: options.cardId, projection: "issue-card" },
      rule: "react-web.label-preview.safe-preview-read-only",
      issueKind: options.issueKind,
      dryRunOnly: false,
    });
  }

  return decision({
    state: "human-decision-required",
    inspect: true,
    suggestPatch: false,
    stopConditions: [
      ...READ_ONLY_STOP_CONDITIONS,
      options.skipReason ?? "Manual review is required before selecting a label/name fix shape.",
    ],
    reason:
      "The finding is actionable for inspection, but final label/name shape or copy requires a human decision and no generated patch authority is granted.",
    confidence: options.confidence,
    source: { cardId: options.cardId, projection: "issue-card" },
    rule: "react-web.label-preview.human-review-required",
    issueKind: options.issueKind,
    dryRunOnly: false,
  });
}

export function buildReactWebProjectionDecision(options: {
  sourceDecision: ReactWebDecision;
  projection: "summary-json" | "dry-run-json";
  dryRunOnly?: boolean;
}): ReactWebDecision {
  if (options.projection === "dry-run-json") {
    return decision({
      state: "dry-run-candidate-only",
      inspect: options.sourceDecision.allowedActions.inspect,
      suggestPatch: options.sourceDecision.allowedActions.suggestPatch,
      stopConditions: [
        ...options.sourceDecision.stopConditions,
        "This dry-run candidate is an inventory row only; it is not an apply plan.",
      ],
      reason: `Dry-run projection of ${options.sourceDecision.source.cardId ?? "issue"}: ${options.sourceDecision.reason}`,
      confidence: options.sourceDecision.confidence,
      source: { ...options.sourceDecision.source, projection: "dry-run-json" },
      rule: options.sourceDecision.rule,
      issueKind: options.sourceDecision.issueKind,
      dryRunOnly: true,
    });
  }

  return {
    ...options.sourceDecision,
    source: { ...options.sourceDecision.source, projection: "summary-json" },
    dryRunOnly: options.dryRunOnly ?? options.sourceDecision.dryRunOnly,
  };
}

export function buildReactWebStopDecision(options: {
  state: Extract<ReactWebDecisionState, "unsupported" | "incomplete" | "malformed-stop">;
  reason: string;
  projection?: ReactWebDecision["source"]["projection"];
  dryRunOnly?: boolean;
  stopConditions?: string[];
}): ReactWebDecision {
  return decision({
    state: options.state,
    inspect: false,
    suggestPatch: false,
    stopConditions: [
      ...READ_ONLY_STOP_CONDITIONS,
      ...(options.stopConditions ?? []),
    ],
    reason: options.reason,
    source: { projection: options.projection },
    rule: `react-web.${options.state}`,
    dryRunOnly: options.dryRunOnly ?? false,
  });
}

export function summarizeReactWebDecisions(decisions: ReactWebDecision[]): {
  stateCounts: Record<ReactWebDecisionState, number>;
  inspectAllowedCount: number;
  suggestPatchAllowedCount: number;
  applyPatchAllowedCount: 0;
  generateCopyAllowedCount: 0;
} {
  const stateCounts: Record<ReactWebDecisionState, number> = {
    "ready-for-agent-inspect": 0,
    "human-decision-required": 0,
    "dry-run-candidate-only": 0,
    unsupported: 0,
    incomplete: 0,
    "malformed-stop": 0,
  };
  for (const current of decisions) stateCounts[current.state] += 1;
  return {
    stateCounts,
    inspectAllowedCount: decisions.filter((current) => current.allowedActions.inspect).length,
    suggestPatchAllowedCount: decisions.filter((current) => current.allowedActions.suggestPatch).length,
    applyPatchAllowedCount: 0,
    generateCopyAllowedCount: 0,
  };
}

export function failClosedReactWebDecision(projection: ReactWebDecision["source"]["projection"], reason: string): ReactWebDecision {
  return buildReactWebStopDecision({
    state: "malformed-stop",
    reason,
    projection,
    dryRunOnly: projection === "dry-run-json",
    stopConditions: ["Malformed handoff data must not produce an agent task or candidate."],
  });
}
