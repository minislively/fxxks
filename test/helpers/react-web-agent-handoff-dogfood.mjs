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

export function consumeReactWebSummaryForAgentTask(summary) {
  if (!isObject(summary) || summary.inScope === false) {
    return unsupportedStop("summary-json", summary);
  }

  const item = summary.firstMinuteSummary?.items?.[0];
  if (!item) {
    return emptyStop("summary-json", "no-first-minute-items", summary);
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

  const candidates = Array.isArray(dryRun.candidates) ? dryRun.candidates : [];
  if (candidates.length === 0) {
    return {
      ...emptyStop("dry-run-json", "no-dry-run-candidates", dryRun),
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
