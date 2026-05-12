import assert from "node:assert/strict";

export const reactWebIssueFixtureRegressionClasses = [
  "count-mismatch",
  "detector-parity",
  "noisy-suggestion",
  "unsafe-preview",
  "unsupported-boundary",
];

function expectedValue(value, fallback) {
  return value === undefined ? fallback : value;
}

function matchesPattern(value, pattern) {
  if (!pattern) return true;
  return pattern.test(value ?? "");
}

function pushFailure(failures, regressionClass, message) {
  failures.push({ regressionClass, message });
}

export function parseReactWebIssueFixtureUsefulness({ fixture, report, preview, expectation }) {
  const expectedCards = expectation.expectedCards;
  const acceptedCards = expectedValue(expectation.acceptedCards, expectedCards);
  const rejectedCards = expectedValue(expectation.rejectedCards, 0);
  const expectedAcceptedCards = expectedValue(expectation.expectedAcceptedCards, expectedCards);
  const expectedRejectedCards = expectedValue(expectation.expectedRejectedCards, 0);
  const noiseNotes = expectation.noiseNotes ?? [];
  const expectedNoiseNotes = expectation.expectedNoiseNotes ?? [];
  const requireParityWithPreview = expectedValue(expectation.requireParityWithPreview, true);
  const expectedSafePreviewCount = expectation.expectedSafePreviewCount;
  const expectedManualReviewCount = expectation.expectedManualReviewCount;
  const expectedUnsupported = expectation.expectedUnsupported;
  const expectedSkippedReason = expectation.expectedSkippedReason;
  const observedCards = report.summary.issueCount;
  const parityWithPreviewFindings = observedCards === preview.summary.findingCount;
  const unsupported = report.inScope === false;
  const unsupportedSkipBoundary = expectedUnsupported === undefined || (unsupported === expectedUnsupported && matchesPattern(report.skippedReason, expectedSkippedReason));
  const failures = [];

  if (observedCards !== expectedCards) {
    pushFailure(failures, "count-mismatch", `${fixture}: expected ${expectedCards} issue cards, observed ${observedCards}`);
  }
  if (acceptedCards !== expectedAcceptedCards || rejectedCards !== expectedRejectedCards) {
    pushFailure(
      failures,
      "count-mismatch",
      `${fixture}: accepted/rejected mismatch; accepted=${acceptedCards} expected=${expectedAcceptedCards}, rejected=${rejectedCards} expected=${expectedRejectedCards}`,
    );
  }
  if (requireParityWithPreview && !parityWithPreviewFindings) {
    pushFailure(
      failures,
      "detector-parity",
      `${fixture}: issue card count ${observedCards} diverged from label-preview finding count ${preview.summary.findingCount}`,
    );
  }
  if (noiseNotes.join("\n") !== expectedNoiseNotes.join("\n")) {
    pushFailure(
      failures,
      "noisy-suggestion",
      `${fixture}: noise notes mismatch; observed=${JSON.stringify(noiseNotes)}, expected=${JSON.stringify(expectedNoiseNotes)}`,
    );
  }
  if (expectedSafePreviewCount !== undefined && report.summary.safePreviewCount !== expectedSafePreviewCount) {
    pushFailure(
      failures,
      "unsafe-preview",
      `${fixture}: expected safe-preview count ${expectedSafePreviewCount}, observed ${report.summary.safePreviewCount}`,
    );
  }
  if (expectedManualReviewCount !== undefined && report.summary.manualReviewCount !== expectedManualReviewCount) {
    pushFailure(
      failures,
      "count-mismatch",
      `${fixture}: expected manual-review count ${expectedManualReviewCount}, observed ${report.summary.manualReviewCount}`,
    );
  }
  if (expectedUnsupported !== undefined && unsupported !== expectedUnsupported) {
    pushFailure(
      failures,
      "unsupported-boundary",
      `${fixture}: expected unsupported=${expectedUnsupported}, observed unsupported=${unsupported}`,
    );
  }
  if (expectedSkippedReason && !matchesPattern(report.skippedReason, expectedSkippedReason)) {
    pushFailure(
      failures,
      "unsupported-boundary",
      `${fixture}: skippedReason ${JSON.stringify(report.skippedReason ?? null)} did not match ${expectedSkippedReason}`,
    );
  }

  return {
    fixture,
    expectedCards,
    observedCards,
    acceptedCards,
    rejectedCards,
    expectedAcceptedCards,
    expectedRejectedCards,
    expectedSafePreviewCount,
    observedSafePreviewCount: report.summary.safePreviewCount,
    expectedManualReviewCount,
    observedManualReviewCount: report.summary.manualReviewCount,
    unsupported,
    expectedUnsupported,
    unsupportedSkipBoundary,
    noiseNotes,
    expectedNoiseNotes,
    suggestionPlausibility: expectation.suggestionPlausibility,
    parityWithPreviewFindings,
    regressionClasses: [...new Set(failures.map((failure) => failure.regressionClass))],
    failures,
    verdict: failures.length === 0 ? "pass" : "fail",
  };
}

export function assertReactWebIssueFixtureUsefulness(caseResult) {
  assert.equal(
    caseResult.verdict,
    "pass",
    `${caseResult.fixture}: fixture usefulness gate failed (${caseResult.regressionClasses.join(", ") || "unknown"})\n${caseResult.failures
      .map((failure) => `- [${failure.regressionClass}] ${failure.message}`)
      .join("\n")}`,
  );
}

export function evaluateReactWebIssueFixtureUsefulness(cases, buildReport, buildPreview) {
  return cases.map((fixtureCase) =>
    parseReactWebIssueFixtureUsefulness({
      fixture: fixtureCase.name,
      report: buildReport(fixtureCase.file),
      preview: buildPreview(fixtureCase.file),
      expectation: fixtureCase,
    }),
  );
}


export const reactWebWorkOrderQualityRegressionClasses = [
  "missing-location",
  "weak-why",
  "non-action-next-step",
  "missing-human-decision",
  "unsafe-do-not-do",
  "context-hints-bad-size",
];

function pushWorkOrderFailure(failures, regressionClass, issueId, message) {
  failures.push({ regressionClass, issueId, message });
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasLocation(value) {
  return /[^\s:]+:\d+(?:-\d+)?/u.test(value ?? "");
}

function hasAnyPattern(values, pattern) {
  return values.some((value) => pattern.test(value ?? ""));
}

function validateWorkOrderItem({ item, expectedTopIds, issueIds, failures }) {
  const issueId = isNonEmptyString(item?.issueId) ? item.issueId : "<missing-issue-id>";
  const inspectFirst = Array.isArray(item?.inspectFirst) ? item.inspectFirst : [];
  const humanDecisionNeeded = Array.isArray(item?.humanDecisionNeeded) ? item.humanDecisionNeeded : [];
  const doNotDo = Array.isArray(item?.doNotDo) ? item.doNotDo : [];
  const contextHints = Array.isArray(item?.contextHints) ? item.contextHints : [];
  const firstInspectStep = item?.firstInspectStep;

  if (!issueIds.has(issueId) || !expectedTopIds.includes(issueId)) {
    pushWorkOrderFailure(failures, "missing-location", issueId, `${issueId}: first-minute item is not linked to a top issue id`);
  }
  if (!isNonEmptyString(firstInspectStep) || inspectFirst[0] !== firstInspectStep || !hasLocation(firstInspectStep)) {
    pushWorkOrderFailure(
      failures,
      "missing-location",
      issueId,
      `${issueId}: first inspect step must match inspectFirst[0] and include a file:line location`,
    );
  }

  if (item?.fixShapeGuidance?.humanReviewRequired !== true) {
    pushWorkOrderFailure(failures, "missing-human-decision", issueId, `${issueId}: fix shape guidance must require human review`);
  }
  if (item?.fixShapeGuidance?.autoApply !== false) {
    pushWorkOrderFailure(failures, "unsafe-do-not-do", issueId, `${issueId}: fix shape guidance must keep autoApply false`);
  }

  if (
    !isNonEmptyString(item?.whyThisFirst) ||
    item.whyThisFirst.length > 180 ||
    !/(rank|priority|because|evidence|safe preview|context|confidence)/iu.test(item.whyThisFirst)
  ) {
    pushWorkOrderFailure(
      failures,
      "weak-why",
      issueId,
      `${issueId}: whyThisFirst must compactly justify why this top issue is first`,
    );
  }

  if (
    !isNonEmptyString(item?.nextAction) ||
    item.nextAction.length > 180 ||
    !/(inspect|review|compare|check)/iu.test(item.nextAction)
  ) {
    pushWorkOrderFailure(
      failures,
      "non-action-next-step",
      issueId,
      `${issueId}: nextAction must name an immediate inspect/review/compare/check action`,
    );
  }

  if (
    humanDecisionNeeded.length < 1 ||
    humanDecisionNeeded.length > 2 ||
    humanDecisionNeeded.some((entry) => !isNonEmptyString(entry) || entry.length > 120) ||
    !hasAnyPattern(humanDecisionNeeded, /(human|review|label|name|copy|association|shape)/iu)
  ) {
    pushWorkOrderFailure(
      failures,
      "missing-human-decision",
      issueId,
      `${issueId}: humanDecisionNeeded must preserve final human label/name/copy/association review`,
    );
  }

  if (
    doNotDo.length < 2 ||
    doNotDo.length > 3 ||
    doNotDo.some((entry) => !isNonEmptyString(entry) || entry.length > 120) ||
    !hasAnyPattern(doNotDo, /(auto-?apply|apply|patch)/iu) ||
    !hasAnyPattern(doNotDo, /(custom-component|generated|accessible-name copy|infer)/iu)
  ) {
    pushWorkOrderFailure(
      failures,
      "unsafe-do-not-do",
      issueId,
      `${issueId}: doNotDo must block auto-apply/patch and unsupported inference/generated-copy overreach`,
    );
  }

  if (
    contextHints.length < 1 ||
    contextHints.length > 4 ||
    contextHints.some((entry) => !isNonEmptyString(entry) || entry.length > 100) ||
    !hasAnyPattern(contextHints, /(native|context|source|convention|preview|file|line)/iu)
  ) {
    pushWorkOrderFailure(
      failures,
      "context-hints-bad-size",
      issueId,
      `${issueId}: contextHints must be 1-4 compact orienting strings`,
    );
  }
}

export function parseReactWebWorkOrderQuality({ fixture, report }) {
  const failures = [];
  const firstMinuteSummary = report?.firstMinuteSummary ?? { sourceTopIssueIds: [], items: [] };
  const expectedTopIds = Array.isArray(firstMinuteSummary.sourceTopIssueIds) ? firstMinuteSummary.sourceTopIssueIds : [];
  const items = Array.isArray(firstMinuteSummary.items) ? firstMinuteSummary.items : [];
  const issueIds = new Set((Array.isArray(report?.issues) ? report.issues : []).map((issue) => issue.id));

  if (expectedTopIds.length !== items.length) {
    pushWorkOrderFailure(
      failures,
      "missing-location",
      "<summary>",
      `${fixture}: expected one first-minute item per sourceTopIssueIds entry; topIds=${expectedTopIds.length}, items=${items.length}`,
    );
  }

  for (const item of items) validateWorkOrderItem({ item, expectedTopIds, issueIds, failures });

  return {
    fixture,
    sourceTopIssueIds: expectedTopIds,
    observedItemCount: items.length,
    regressionClasses: [...new Set(failures.map((failure) => failure.regressionClass))],
    failures,
    verdict: failures.length === 0 ? "pass" : "fail",
  };
}

export function assertReactWebWorkOrderQuality(result) {
  assert.equal(
    result.verdict,
    "pass",
    `${result.fixture}: work-order quality gate failed (${result.regressionClasses.join(", ") || "unknown"})\n${result.failures
      .map((failure) => `- [${failure.regressionClass}] ${failure.issueId}: ${failure.message}`)
      .join("\n")}`,
  );
}
