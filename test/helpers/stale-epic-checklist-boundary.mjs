const ACTIVE_STATES = new Set(["open", "active", "current"]);

function normalizeRef(ref) {
  return String(ref ?? "").trim();
}

function isOpenState(value) {
  return ACTIVE_STATES.has(String(value ?? "").toLowerCase());
}

function hasOpenChildIssue(evidence) {
  return (evidence?.childIssues ?? []).some((issue) => isOpenState(issue?.state));
}

function hasActiveBranch(evidence) {
  return (evidence?.branches ?? []).some((branch) => isOpenState(branch?.state) || branch?.active === true);
}

function hasActiveSession(evidence) {
  return (evidence?.sessions ?? []).some((session) => isOpenState(session?.state) || session?.active === true);
}

function hasOpenPullRequest(evidence) {
  return (evidence?.pullRequests ?? []).some((pr) => isOpenState(pr?.state));
}

function hasExactDuplicateSearch(evidence) {
  return Boolean(evidence?.exactDuplicateSearch?.performed === true && normalizeRef(evidence.exactDuplicateSearch.query));
}

function activeEvidenceKinds(evidence) {
  return [
    hasOpenChildIssue(evidence) ? "open-child-issue" : null,
    hasActiveBranch(evidence) ? "active-branch" : null,
    hasActiveSession(evidence) ? "active-session" : null,
    hasOpenPullRequest(evidence) ? "open-pull-request" : null,
    hasExactDuplicateSearch(evidence) ? "exact-duplicate-search" : null,
  ].filter(Boolean);
}

export function classifyStaleEpicChecklistCandidate(input) {
  const activeKinds = activeEvidenceKinds(input?.evidence ?? {});
  const hasUncheckedEpicChecklistText = Boolean(input?.uncheckedEpicChecklistText);
  const backedByActiveEvidence = activeKinds.length > 0;
  const classification = hasUncheckedEpicChecklistText && !backedByActiveEvidence
    ? "epic-checklist-advisory-only"
    : "active-next-work-candidate";

  return {
    epic: normalizeRef(input?.epic) || "#960",
    checklistTextAuthority: classification === "epic-checklist-advisory-only" ? "advisory" : "backed",
    classification,
    activeNextWorkAllowed: classification === "active-next-work-candidate",
    activeEvidenceKinds: activeKinds,
    duplicateSessionRisk: classification === "epic-checklist-advisory-only" ? "elevated-until-sibling-search" : "bounded",
    rule: "Unchecked epic checklist text is advisory unless backed by an open child issue, active branch/session, open PR, or exact duplicate search.",
  };
}
