function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unsupportedStop(source, projection) {
  return {
    kind: "stop",
    source,
    reason: "unsupported-boundary",
    inScope: false,
    skippedReason: projection?.skippedReason,
    autoApply: projection?.autoApply,
  };
}

function emptyStop(source, reason, projection) {
  return {
    kind: "stop",
    source,
    reason,
    inScope: projection?.inScope !== false,
    autoApply: projection?.autoApply,
  };
}

function malformedStop(source, reason, projection) {
  return {
    ...emptyStop(source, reason, projection),
    malformed: true,
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isSafeSummaryItem(item) {
  return (
    isObject(item) &&
    isNonEmptyString(item.issueId) &&
    isNonEmptyString(item.firstInspectStep) &&
    isNonEmptyString(item.nextAction) &&
    isStringArray(item.humanDecisionNeeded) &&
    isStringArray(item.doNotDo) &&
    isStringArray(item.contextHints) &&
    isObject(item.fixShapeGuidance) &&
    item.fixShapeGuidance.autoApply === false &&
    item.fixShapeGuidance.humanReviewRequired === true
  );
}

function isSafeDryRunCandidate(candidate) {
  return (
    isObject(candidate) &&
    isNonEmptyString(candidate.issueId) &&
    isNonEmptyString(candidate.affectedFile) &&
    isNonEmptyString(candidate.migrationCandidate) &&
    isNonEmptyString(candidate.firstInspectStep) &&
    typeof candidate.previewAvailable === "boolean" &&
    candidate.humanReviewRequired === true &&
    candidate.autoApply === false &&
    candidate.dryRunOnly === true &&
    isStringArray(candidate.riskNotes)
  );
}

export function consumeReactWebSummaryForAgentTask(summary) {
  if (!isObject(summary) || summary.inScope === false) {
    return unsupportedStop("summary-json", summary);
  }

  if (summary.firstMinuteSummary !== undefined && !isObject(summary.firstMinuteSummary)) {
    return malformedStop("summary-json", "malformed-first-minute-summary", summary);
  }

  const items = summary.firstMinuteSummary?.items;
  if (items !== undefined && !Array.isArray(items)) {
    return malformedStop("summary-json", "malformed-first-minute-items", summary);
  }

  const item = items?.[0];
  if (!item) {
    return emptyStop("summary-json", "no-first-minute-items", summary);
  }
  if (!isSafeSummaryItem(item)) {
    return malformedStop("summary-json", "malformed-first-minute-item", summary);
  }

  return {
    kind: "inspect-first-task",
    source: "summary-json",
    issueId: item.issueId,
    filePath: summary.filePath,
    claimBoundary: summary.claimBoundary,
    firstInspectStep: item.firstInspectStep,
    nextAction: item.nextAction,
    whyThisFirst: item.whyThisFirst,
    humanDecisionNeeded: item.humanDecisionNeeded,
    doNotDo: item.doNotDo,
    contextHints: item.contextHints,
    fixShape: item.fixShape,
    fixShapeGuidance: item.fixShapeGuidance,
    autoApply: item.fixShapeGuidance?.autoApply ?? summary.autoApply,
    humanReviewRequired: item.fixShapeGuidance?.humanReviewRequired,
  };
}

export function consumeReactWebDryRunForAgentTasks(dryRun) {
  if (!isObject(dryRun) || dryRun.inScope === false) {
    return unsupportedStop("dry-run-json", dryRun);
  }

  if (dryRun.candidates !== undefined && !Array.isArray(dryRun.candidates)) {
    return {
      ...malformedStop("dry-run-json", "malformed-dry-run-candidates", dryRun),
      dryRunOnly: dryRun.dryRunOnly,
      candidates: [],
    };
  }

  const candidates = dryRun.candidates ?? [];
  if (candidates.length === 0) {
    return {
      ...emptyStop("dry-run-json", "no-dry-run-candidates", dryRun),
      dryRunOnly: dryRun.dryRunOnly,
      candidates: [],
    };
  }
  if (!candidates.every(isSafeDryRunCandidate)) {
    return {
      ...malformedStop("dry-run-json", "malformed-dry-run-candidate", dryRun),
      dryRunOnly: dryRun.dryRunOnly,
      candidates: [],
    };
  }

  return {
    kind: "dry-run-candidate-tasks",
    source: "dry-run-json",
    filePath: dryRun.filePath,
    claimBoundary: dryRun.claimBoundary,
    dryRunOnly: dryRun.dryRunOnly,
    autoApply: dryRun.autoApply,
    candidates: candidates.map((candidate) => ({
      issueId: candidate.issueId,
      affectedFile: candidate.affectedFile,
      migrationCandidate: candidate.migrationCandidate,
      firstInspectStep: candidate.firstInspectStep,
      previewAvailable: candidate.previewAvailable,
      humanReviewRequired: candidate.humanReviewRequired,
      autoApply: candidate.autoApply,
      dryRunOnly: candidate.dryRunOnly,
      riskNotes: candidate.riskNotes,
    })),
  };
}
