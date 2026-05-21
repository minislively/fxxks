const APPROVAL_GATE_WORKFLOW = "Merge Gate";
const APPROVAL_GATE_CHECK = "Validate approval review and linked issue";

function isApprovalGate(entry) {
  return entry?.workflow === APPROVAL_GATE_WORKFLOW && entry?.name === APPROVAL_GATE_CHECK;
}

function isSuccess(entry) {
  return String(entry?.conclusion ?? entry?.state ?? "").toLowerCase() === "success";
}

function isFailure(entry) {
  return String(entry?.conclusion ?? entry?.state ?? "").toLowerCase() === "failure";
}

function numericAttempt(entry) {
  return Number.isInteger(entry?.attempt) ? entry.attempt : Number(entry?.attempt ?? entry?.runAttempt ?? 0);
}

function sameHead(input) {
  return Boolean(
    input?.currentHeadSha
      && input?.relay?.headSha === input.currentHeadSha
      && input?.latest?.headSha === input.currentHeadSha,
  );
}

function latestSupersedesRelay(relay, latest) {
  if (!relay || !latest) return false;
  if (relay.runId && latest.runId && relay.runId === latest.runId) {
    return numericAttempt(latest) > numericAttempt(relay);
  }
  if (relay.completedAt && latest.completedAt) {
    return Date.parse(latest.completedAt) > Date.parse(relay.completedAt);
  }
  return false;
}

export function classifyStaleApprovalGateRerunEcho(input) {
  const relay = input?.relay;
  const latest = input?.latest;
  const relayIsOriginalFailedApprovalGate = isApprovalGate(relay) && isFailure(relay);
  const latestIsPassingApprovalGate = isApprovalGate(latest) && isSuccess(latest);
  const currentHeadMatchesBoth = sameHead(input);
  const latestSupersedesOriginal = latestSupersedesRelay(relay, latest);
  const staleFailureEcho = Boolean(
    relayIsOriginalFailedApprovalGate
      && latestIsPassingApprovalGate
      && currentHeadMatchesBoth
      && latestSupersedesOriginal,
  );
  const liveCurrentHeadChecksPass = Boolean(input?.liveCurrentHeadChecksPass);
  const mergeabilityClean = Boolean(input?.mergeabilityClean);

  return {
    classification: staleFailureEcho ? "stale-approval-gate-failure-echo" : "current-or-unresolved-approval-gate-evidence",
    staleFailureEcho,
    relayIsCurrentHeadBlocker: !staleFailureEcho && relayIsOriginalFailedApprovalGate && relay?.headSha === input?.currentHeadSha,
    currentHeadGateResult: staleFailureEcho ? "latest-rerun-pass" : latestIsPassingApprovalGate ? "latest-pass" : "unresolved",
    latestResultIsAuthoritativeForCurrentHead: staleFailureEcho || (latestIsPassingApprovalGate && latest?.headSha === input?.currentHeadSha),
    eligibleToMerge: liveCurrentHeadChecksPass && mergeabilityClean,
    mergeRule: "Merge only after live current-head checks pass and mergeability is clean.",
  };
}
