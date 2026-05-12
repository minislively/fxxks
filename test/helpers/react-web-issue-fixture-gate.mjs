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
