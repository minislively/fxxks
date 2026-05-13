import { REACT_WEB_DECISION_SCHEMA_VERSION, type ReactWebDecision, type ReactWebDecisionState } from "./react-web-decision";
import type {
  ReactWebIssueFirstMinuteSummaryItem,
  ReactWebIssueReport,
  ReactWebIssueReportMigrationDryRunJson,
  ReactWebIssueReportSummaryJson,
} from "./react-web-issue-report";

export const REACT_WEB_DECISION_HANDOFF_BENCHMARK_SCHEMA_VERSION = "react-web-decision-handoff-benchmark.v1" as const;
export const REACT_WEB_DECISION_STOP_BENCHMARK_SCHEMA_VERSION = "react-web-decision-stop-benchmark.v1" as const;
export const REACT_WEB_DECISION_HANDOFF_BENCHMARK_CLAIM_BOUNDARY =
  "Decision handoff benchmark evidence only: proves deterministic projection correctness, safety-boundary retention, and compactness for named React Web fixtures; it is not provider-token, billing, latency, live-agent turn-count, or automatic patch-apply evidence." as const;

export type ReactWebDecisionHandoffComparisonArm =
  | "raw-source-generic-prompt"
  | "full-fooks-issue-json"
  | "summary-json-decision-handoff"
  | "dry-run-json-decision-handoff";

export const REACT_WEB_DECISION_HANDOFF_COMPARISON_ARMS: ReactWebDecisionHandoffComparisonArm[] = [
  "raw-source-generic-prompt",
  "full-fooks-issue-json",
  "summary-json-decision-handoff",
  "dry-run-json-decision-handoff",
];

export type ReactWebDecisionHandoffTask = {
  kind: "inspect-first-task";
  source: "summary-json";
  issueId?: string;
  firstInspectStep?: string;
  autoApply?: boolean;
  humanReviewRequired?: boolean;
  decision?: ReactWebDecision;
};

export type ReactWebDecisionDryRunHandoffTask = {
  issueId?: string;
  autoApply?: boolean;
  humanReviewRequired?: boolean;
  dryRunOnly?: boolean;
  decision?: ReactWebDecision;
};

export type ReactWebDecisionDryRunHandoff = {
  kind: "dry-run-candidate-tasks" | "stop";
  source: "dry-run-json";
  autoApply?: boolean;
  candidates?: ReactWebDecisionDryRunHandoffTask[];
};

export type EvaluateReactWebDecisionHandoffBenchmarkInput = {
  fixture: string;
  rawSource: string;
  fullJson: ReactWebIssueReport;
  summaryJson: ReactWebIssueReportSummaryJson;
  dryRunJson: ReactWebIssueReportMigrationDryRunJson;
  summaryTask: ReactWebDecisionHandoffTask;
  dryRunTasks: ReactWebDecisionDryRunHandoff;
};

export type ReactWebDecisionHandoffBenchmark = {
  schemaVersion: typeof REACT_WEB_DECISION_HANDOFF_BENCHMARK_SCHEMA_VERSION;
  fixture: string;
  comparisonArms: ReactWebDecisionHandoffComparisonArm[];
  primaryMetrics: {
    decisionHandoffCorrect: boolean;
    firstInspectTargetPresent: boolean;
    top1IssueStartMatch: boolean;
    noAutoApplyCompliance: boolean;
    humanReviewBoundaryRetention: boolean;
    dryRunCandidateSafety: boolean;
  };
  secondarySizeMetrics: {
    rawSourceBytes: number;
    fullJsonBytes: number;
    summaryJsonBytes: number;
    dryRunJsonBytes: number;
    approxTokens: {
      rawSource: number;
      fullJson: number;
      summaryJson: number;
      dryRunJson: number;
    };
    summaryVsFullReductionPct: number;
    dryRunVsFullReductionPct: number;
    summaryVsRawReductionPct: number;
    dryRunVsRawReductionPct: number;
  };
  claimBoundary: typeof REACT_WEB_DECISION_HANDOFF_BENCHMARK_CLAIM_BOUNDARY;
};

export type ReactWebDecisionStopHandoff = {
  kind?: "stop" | string;
  source?: string;
  reason?: string;
  autoApply?: boolean;
  stopDecision?: ReactWebDecision;
};

export type ReactWebDecisionStopBenchmarkEntry = {
  source?: string;
  reason?: string;
  kind?: string;
  state?: ReactWebDecisionState;
  inspectAllowed: boolean;
  applyPatchAllowed: boolean;
  generateCopyAllowed: boolean;
  autoApply: boolean;
};

export type ReactWebDecisionStopBenchmark = {
  schemaVersion: typeof REACT_WEB_DECISION_STOP_BENCHMARK_SCHEMA_VERSION;
  stopCount: number;
  entries: ReactWebDecisionStopBenchmarkEntry[];
  unsupportedStopRate: number;
  malformedStopRate: number;
  allStopFailClosed: boolean;
};

function jsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function reductionPercent(smaller: number, baseline: number): number {
  if (!Number.isFinite(baseline) || baseline <= 0) return 0;
  return Number((((baseline - smaller) / baseline) * 100).toFixed(1));
}

function hasSafeDecision(decision: ReactWebDecision | undefined, options: { states?: ReactWebDecisionState[]; dryRunOnly?: boolean } = {}): boolean {
  return Boolean(
    decision &&
      decision.schemaVersion === REACT_WEB_DECISION_SCHEMA_VERSION &&
      decision.allowedActions.applyPatch === false &&
      decision.allowedActions.generateCopy === false &&
      decision.autoApply === false &&
      decision.humanReviewRequired === true &&
      (options.dryRunOnly === undefined || decision.dryRunOnly === options.dryRunOnly) &&
      (options.states === undefined || options.states.includes(decision.state)) &&
      decision.stopConditions.length > 0,
  );
}

function hasLocation(value: string | undefined): boolean {
  return /[^\s:]+:\d+(?:-\d+)?/u.test(value ?? "");
}

function isTrue(value: unknown): boolean {
  return value === true;
}

function isInspectFirstTaskSafe(task: ReactWebDecisionHandoffTask): boolean {
  return (
    task.kind === "inspect-first-task" &&
    task.source === "summary-json" &&
    Boolean(task.issueId) &&
    hasLocation(task.firstInspectStep) &&
    task.autoApply === false &&
    task.humanReviewRequired === true &&
    hasSafeDecision(task.decision, {
      states: ["ready-for-agent-inspect", "human-decision-required"],
      dryRunOnly: false,
    })
  );
}

function isDryRunCandidateSafe(candidate: ReactWebDecisionDryRunHandoffTask): boolean {
  return (
    Boolean(candidate.issueId) &&
    candidate.autoApply === false &&
    candidate.humanReviewRequired === true &&
    candidate.dryRunOnly === true &&
    hasSafeDecision(candidate.decision, {
      states: ["dry-run-candidate-only"],
      dryRunOnly: true,
    })
  );
}

function firstSummaryItem(summaryJson: ReactWebIssueReportSummaryJson): ReactWebIssueFirstMinuteSummaryItem | undefined {
  return summaryJson.firstMinuteSummary.items[0];
}

export function evaluateReactWebDecisionHandoffBenchmark(input: EvaluateReactWebDecisionHandoffBenchmarkInput): ReactWebDecisionHandoffBenchmark {
  const rawSourceBytes = Buffer.byteLength(input.rawSource, "utf8");
  const fullJsonBytes = jsonByteLength(input.fullJson);
  const summaryJsonBytes = jsonByteLength(input.summaryJson);
  const dryRunJsonBytes = jsonByteLength(input.dryRunJson);
  const firstItem = firstSummaryItem(input.summaryJson);
  const sourceTopIssueId = input.summaryJson.firstMinuteSummary.sourceTopIssueIds[0];
  const dryRunCandidates = input.dryRunTasks.candidates ?? [];

  const firstInspectTargetPresent = isInspectFirstTaskSafe(input.summaryTask);
  const top1IssueStartMatch = Boolean(
    firstInspectTargetPresent &&
      sourceTopIssueId &&
      input.summaryTask.issueId === sourceTopIssueId &&
      firstItem?.firstInspectStep === input.summaryTask.firstInspectStep,
  );
  const dryRunCandidateSafety = input.dryRunTasks.kind === "dry-run-candidate-tasks" && dryRunCandidates.length > 0 && dryRunCandidates.every(isDryRunCandidateSafe);
  const noAutoApplyCompliance = [input.summaryTask, input.dryRunTasks, ...dryRunCandidates]
    .filter((entry): entry is { autoApply?: boolean; decision?: ReactWebDecision } => Boolean(entry))
    .every((entry) => entry.autoApply === false && !isTrue(entry.decision?.allowedActions.applyPatch) && !isTrue(entry.decision?.allowedActions.generateCopy));
  const humanReviewBoundaryRetention = [input.summaryTask, ...dryRunCandidates]
    .filter((entry): entry is { humanReviewRequired?: boolean; decision?: ReactWebDecision } => Boolean(entry))
    .every((entry) => entry.humanReviewRequired === true && entry.decision?.humanReviewRequired === true);

  return {
    schemaVersion: REACT_WEB_DECISION_HANDOFF_BENCHMARK_SCHEMA_VERSION,
    fixture: input.fixture,
    comparisonArms: [...REACT_WEB_DECISION_HANDOFF_COMPARISON_ARMS],
    primaryMetrics: {
      decisionHandoffCorrect: firstInspectTargetPresent && top1IssueStartMatch && dryRunCandidateSafety && noAutoApplyCompliance && humanReviewBoundaryRetention,
      firstInspectTargetPresent,
      top1IssueStartMatch,
      noAutoApplyCompliance,
      humanReviewBoundaryRetention,
      dryRunCandidateSafety,
    },
    secondarySizeMetrics: {
      rawSourceBytes,
      fullJsonBytes,
      summaryJsonBytes,
      dryRunJsonBytes,
      approxTokens: {
        rawSource: Math.ceil(rawSourceBytes / 4),
        fullJson: Math.ceil(fullJsonBytes / 4),
        summaryJson: Math.ceil(summaryJsonBytes / 4),
        dryRunJson: Math.ceil(dryRunJsonBytes / 4),
      },
      summaryVsFullReductionPct: reductionPercent(summaryJsonBytes, fullJsonBytes),
      dryRunVsFullReductionPct: reductionPercent(dryRunJsonBytes, fullJsonBytes),
      summaryVsRawReductionPct: reductionPercent(summaryJsonBytes, rawSourceBytes),
      dryRunVsRawReductionPct: reductionPercent(dryRunJsonBytes, rawSourceBytes),
    },
    claimBoundary: REACT_WEB_DECISION_HANDOFF_BENCHMARK_CLAIM_BOUNDARY,
  };
}

export function evaluateReactWebDecisionStopBenchmark(stops: ReactWebDecisionStopHandoff[]): ReactWebDecisionStopBenchmark {
  const entries = stops.map((stop) => ({
    source: stop.source,
    reason: stop.reason,
    kind: stop.kind,
    state: stop.stopDecision?.state,
    inspectAllowed: isTrue(stop.stopDecision?.allowedActions.inspect),
    applyPatchAllowed: isTrue(stop.stopDecision?.allowedActions.applyPatch),
    generateCopyAllowed: isTrue(stop.stopDecision?.allowedActions.generateCopy),
    autoApply: isTrue(stop.autoApply) || isTrue(stop.stopDecision?.autoApply),
  }));
  return {
    schemaVersion: REACT_WEB_DECISION_STOP_BENCHMARK_SCHEMA_VERSION,
    stopCount: entries.length,
    entries,
    unsupportedStopRate: entries.length === 0 ? 0 : entries.filter((entry) => entry.state === "unsupported").length / entries.length,
    malformedStopRate: entries.length === 0 ? 0 : entries.filter((entry) => entry.state === "malformed-stop").length / entries.length,
    allStopFailClosed: entries.every(
      (entry) => entry.kind === "stop" && !entry.inspectAllowed && !entry.applyPatchAllowed && !entry.generateCopyAllowed && !entry.autoApply,
    ),
  };
}
