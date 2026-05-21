export function classifyLocalVerificationEvidence({
  exitCode,
  interrupted = exitCode === 130,
  currentFocusedCommandFailure = false,
  currentHeadCiFailure = false,
  boundedRerunPassed = false,
} = {}) {
  if (currentFocusedCommandFailure) {
    return {
      classification: "blocker",
      reason: "current-focused-command-failure",
      operatorCue: "Local verification is blocked by a current focused command failure.",
    };
  }

  if (currentHeadCiFailure) {
    return {
      classification: "blocker",
      reason: "current-head-ci-failure",
      operatorCue: "Branch health is blocked by a current-head CI failure.",
    };
  }

  if (interrupted) {
    return {
      classification: "inconclusive",
      reason: boundedRerunPassed ? "interrupted-local-verifier-rerun-passed" : "interrupted-local-verifier",
      operatorCue: boundedRerunPassed
        ? "Interrupted local verification exit 130 is stale inconclusive evidence; cite the bounded rerun pass as current local verification."
        : "Interrupted local verification exit 130 is inconclusive unless backed by current focused command failure or current-head CI failure.",
    };
  }

  return {
    classification: "current-local-result",
    reason: exitCode === 0 ? "local-verifier-passed" : "local-verifier-completed",
    operatorCue: "Use the completed local verifier result as current local verification evidence.",
  };
}
