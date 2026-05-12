export type ReactWebDecisionLevel = "blocker" | "warning" | "info";
export type ReactWebDecisionConfidence = "high" | "medium" | "low";
export type ReactWebDecisionState =
  | "ready-for-agent-inspect"
  | "human-decision-required"
  | "dry-run-candidate-only"
  | "unsupported"
  | "incomplete"
  | "malformed-stop";

export type ReactWebDecisionAllowedActions = {
  inspect: boolean;
  suggestPatch: boolean;
  applyPatch: false;
  generateCopy: false;
};

export type ReactWebDecision = {
  findingId: string;
  ruleId: string;
  level: ReactWebDecisionLevel;
  confidence: ReactWebDecisionConfidence;
  state: ReactWebDecisionState;
  allowedActions: ReactWebDecisionAllowedActions;
  reason: string;
  requiredEvidence: string[];
  stopConditions: string[];
};

export type ReactWebDecisionSummary = Pick<
  ReactWebDecision,
  "state" | "level" | "confidence" | "allowedActions" | "stopConditions"
>;

export type BuildReactWebIssueDecisionInput = {
  findingId: string;
  ruleId: string;
  confidence: ReactWebDecisionConfidence;
  previewAvailable: boolean;
  manualReviewReason?: string;
};

const READ_ONLY_ALLOWED_ACTIONS: ReactWebDecisionAllowedActions = {
  inspect: true,
  suggestPatch: false,
  applyPatch: false,
  generateCopy: false,
};

function allowedActions(options: { inspect?: boolean; suggestPatch?: boolean } = {}): ReactWebDecisionAllowedActions {
  return {
    inspect: options.inspect ?? true,
    suggestPatch: options.suggestPatch ?? false,
    applyPatch: false,
    generateCopy: false,
  };
}

export function summarizeReactWebDecision(decision: ReactWebDecision): ReactWebDecisionSummary {
  return {
    state: decision.state,
    level: decision.level,
    confidence: decision.confidence,
    allowedActions: { ...decision.allowedActions },
    stopConditions: [...decision.stopConditions],
  };
}

function uniqueStopConditions(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildReactWebIssueDecision(input: BuildReactWebIssueDecisionInput): ReactWebDecision {
  if (input.previewAvailable && input.confidence === "high") {
    return {
      findingId: input.findingId,
      ruleId: input.ruleId,
      level: "warning",
      confidence: input.confidence,
      state: "ready-for-agent-inspect",
      allowedActions: allowedActions({ suggestPatch: true }),
      reason:
        "High-confidence native JSX evidence supports a read-only preview shape, but fooks does not grant patch-apply authority.",
      requiredEvidence: [
        "native JSX element evidence",
        "high-confidence label/control association evidence",
        "read-only preview fragment",
      ],
      stopConditions: [
        "Stop before editing files; this decision only authorizes inspection and patch suggestion.",
        "Stop if the preview no longer matches local source evidence.",
        "Stop if final accessible-name copy or semantic intent must be chosen.",
      ],
    };
  }

  return {
    findingId: input.findingId,
    ruleId: input.ruleId,
    level: input.confidence === "high" ? "warning" : "info",
    confidence: input.confidence,
    state: "human-decision-required",
    allowedActions: allowedActions(),
    reason:
      input.manualReviewReason ??
      "The finding is reportable, but remediation requires human review before choosing label/name copy or association shape.",
    requiredEvidence: [
      "native JSX element evidence",
      "local source context",
      "human-reviewed remediation intent",
    ],
    stopConditions: [
      "Stop before generating accessible-name copy.",
      "Stop before applying patches automatically.",
      "Stop before inferring custom-component semantics.",
    ],
  };
}

export function buildReactWebDryRunDecision(issueDecision: ReactWebDecision): ReactWebDecision {
  return {
    ...issueDecision,
    state: "dry-run-candidate-only",
    allowedActions: allowedActions({ suggestPatch: issueDecision.allowedActions.suggestPatch }),
    reason: `Dry-run projection only: ${issueDecision.reason}`,
    requiredEvidence: [...issueDecision.requiredEvidence, "dry-run projection boundary"],
    stopConditions: uniqueStopConditions([
      "Stop before any write path; dryRunOnly remains true.",
      "Stop before applying patches automatically.",
      ...issueDecision.stopConditions,
    ]),
  };
}

export function buildReactWebUnsupportedDecision(options: {
  findingId?: string;
  ruleId?: string;
  reason: string;
  skippedReason?: string;
}): ReactWebDecision {
  return {
    findingId: options.findingId ?? "react-web-report",
    ruleId: options.ruleId ?? "react-web.unsupported-boundary",
    level: "info",
    confidence: "low",
    state: "unsupported",
    allowedActions: { ...READ_ONLY_ALLOWED_ACTIONS },
    reason: options.skippedReason ? `${options.reason}: ${options.skippedReason}` : options.reason,
    requiredEvidence: ["supported React Web native JSX classification"],
    stopConditions: [
      "Stop because the source is outside the supported React Web native JSX lane.",
      "Do not infer custom-component semantics.",
      "Do not emit patch work orders.",
    ],
  };
}

export function buildReactWebMalformedDecision(options: {
  findingId?: string;
  ruleId?: string;
  reason: string;
}): ReactWebDecision {
  return {
    findingId: options.findingId ?? "react-web-projection",
    ruleId: options.ruleId ?? "react-web.malformed-projection",
    level: "blocker",
    confidence: "low",
    state: "malformed-stop",
    allowedActions: allowedActions({ inspect: false }),
    reason: options.reason,
    requiredEvidence: ["well-formed React Web issue report projection"],
    stopConditions: [
      "Stop immediately because the projection is malformed.",
      "Do not emit an agent work order.",
      "Do not apply or suggest patches from malformed input.",
    ],
  };
}
