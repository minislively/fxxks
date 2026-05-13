function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonByteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function reductionPercent(smaller, baseline) {
  if (!Number.isFinite(baseline) || baseline <= 0) return 0;
  return Number(((baseline - smaller) / baseline * 100).toFixed(1));
}

function hasSafeDecision(decision, options = {}) {
  return (
    isObject(decision) &&
    decision.schemaVersion === "react-web-decision.v1" &&
    isObject(decision.allowedActions) &&
    decision.allowedActions.applyPatch === false &&
    decision.allowedActions.generateCopy === false &&
    decision.autoApply === false &&
    decision.humanReviewRequired === true &&
    (options.dryRunOnly === undefined || decision.dryRunOnly === options.dryRunOnly) &&
    (options.states === undefined || options.states.includes(decision.state)) &&
    Array.isArray(decision.stopConditions) &&
    decision.stopConditions.length > 0
  );
}

function isInspectFirstTaskSafe(task) {
  return (
    isObject(task) &&
    task.kind === "inspect-first-task" &&
    task.source === "summary-json" &&
    typeof task.issueId === "string" &&
    task.issueId.length > 0 &&
    typeof task.firstInspectStep === "string" &&
    /[^\s:]+:\d+(?:-\d+)?/u.test(task.firstInspectStep) &&
    task.autoApply === false &&
    task.humanReviewRequired === true &&
    hasSafeDecision(task.decision, {
      states: ["ready-for-agent-inspect", "human-decision-required"],
      dryRunOnly: false,
    })
  );
}

function isDryRunCandidateSafe(candidate) {
  return (
    isObject(candidate) &&
    typeof candidate.issueId === "string" &&
    candidate.issueId.length > 0 &&
    candidate.autoApply === false &&
    candidate.humanReviewRequired === true &&
    candidate.dryRunOnly === true &&
    hasSafeDecision(candidate.decision, {
      states: ["dry-run-candidate-only"],
      dryRunOnly: true,
    })
  );
}

export function evaluateReactWebDecisionHandoffBenchmark({
  fixture,
  rawSource,
  fullJson,
  summaryJson,
  dryRunJson,
  summaryTask,
  dryRunTasks,
}) {
  const rawSourceBytes = Buffer.byteLength(rawSource, "utf8");
  const fullJsonBytes = jsonByteLength(fullJson);
  const summaryJsonBytes = jsonByteLength(summaryJson);
  const dryRunJsonBytes = jsonByteLength(dryRunJson);
  const firstSummaryItem = summaryJson?.firstMinuteSummary?.items?.[0];
  const sourceTopIssueId = summaryJson?.firstMinuteSummary?.sourceTopIssueIds?.[0];
  const dryRunCandidates = Array.isArray(dryRunTasks?.candidates) ? dryRunTasks.candidates : [];

  const firstInspectTargetPresent = isInspectFirstTaskSafe(summaryTask);
  const top1IssueStartMatch = Boolean(
    firstInspectTargetPresent &&
      sourceTopIssueId &&
      summaryTask.issueId === sourceTopIssueId &&
      firstSummaryItem?.firstInspectStep === summaryTask.firstInspectStep,
  );
  const dryRunCandidateSafety = dryRunTasks?.kind === "dry-run-candidate-tasks" && dryRunCandidates.length > 0 && dryRunCandidates.every(isDryRunCandidateSafe);
  const noAutoApplyCompliance = [summaryTask, dryRunTasks, ...dryRunCandidates]
    .filter(Boolean)
    .every((entry) => entry.autoApply === false && entry.decision?.allowedActions?.applyPatch !== true && entry.decision?.allowedActions?.generateCopy !== true);
  const humanReviewBoundaryRetention = [summaryTask, ...dryRunCandidates]
    .filter(Boolean)
    .every((entry) => entry.humanReviewRequired === true && entry.decision?.humanReviewRequired === true);

  return {
    schemaVersion: "react-web-decision-handoff-benchmark.v1",
    fixture,
    comparisonArms: [
      "raw-source-generic-prompt",
      "full-fooks-issue-json",
      "summary-json-decision-handoff",
      "dry-run-json-decision-handoff",
    ],
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
    claimBoundary:
      "Decision handoff benchmark evidence only: proves deterministic projection correctness, safety-boundary retention, and compactness for named React Web fixtures; it is not provider-token, billing, latency, live-agent turn-count, or automatic patch-apply evidence.",
  };
}

export function evaluateReactWebDecisionStopBenchmark(stops) {
  const entries = stops.map((stop) => ({
    source: stop?.source,
    reason: stop?.reason,
    kind: stop?.kind,
    state: stop?.stopDecision?.state,
    inspectAllowed: stop?.stopDecision?.allowedActions?.inspect === true,
    applyPatchAllowed: stop?.stopDecision?.allowedActions?.applyPatch === true,
    generateCopyAllowed: stop?.stopDecision?.allowedActions?.generateCopy === true,
    autoApply: stop?.autoApply === true || stop?.stopDecision?.autoApply === true,
  }));
  return {
    schemaVersion: "react-web-decision-stop-benchmark.v1",
    stopCount: entries.length,
    entries,
    unsupportedStopRate: entries.length === 0 ? 0 : entries.filter((entry) => entry.state === "unsupported").length / entries.length,
    malformedStopRate: entries.length === 0 ? 0 : entries.filter((entry) => entry.state === "malformed-stop").length / entries.length,
    allStopFailClosed: entries.every(
      (entry) => entry.kind === "stop" && !entry.inspectAllowed && !entry.applyPatchAllowed && !entry.generateCopyAllowed && !entry.autoApply,
    ),
  };
}
