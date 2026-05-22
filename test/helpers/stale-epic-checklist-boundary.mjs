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

function issueNumber(value) {
  const raw = typeof value === "object" && value !== null ? value.number : value;
  const normalized = normalizeRef(raw).replace(/^#/u, "");
  if (!/^\d+$/u.test(normalized)) return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function openIssueNumbers(issues) {
  return (issues ?? [])
    .filter((issue) => isOpenState(typeof issue === "object" && issue !== null ? issue.state : "open"))
    .map(issueNumber)
    .filter((number) => Number.isInteger(number));
}

function hasConcreteChildIssue(evidence, epicNumber) {
  return openIssueNumbers(evidence?.issues ?? evidence?.childIssues)
    .some((number) => number !== epicNumber);
}

function hasActiveWorktree(evidence) {
  return (evidence?.worktrees ?? []).some((worktree) => isOpenState(worktree?.state) || worktree?.active === true);
}

function epicOnlyActiveEvidenceKinds(evidence, epicNumber) {
  return [
    hasConcreteChildIssue(evidence, epicNumber) ? "open-child-issue" : null,
    hasActiveBranch(evidence) ? "active-branch" : null,
    hasActiveWorktree(evidence) ? "active-worktree" : null,
    hasActiveSession(evidence) ? "active-session" : null,
    hasOpenPullRequest(evidence) ? "open-pull-request" : null,
    (evidence?.processes ?? []).some((process) =>
      isOpenState(process?.state) || process?.active === true
    ) ? "active-process" : null,
  ].filter(Boolean);
}

export function classifyEpicOnlyOpenIssueState(input) {
  const epicNumber = issueNumber(input?.epic) ?? 960;
  const issues = openIssueNumbers(input?.evidence?.issues ?? input?.evidence?.childIssues);
  const openIssueCount = typeof input?.openIssueCount === "number" ? input.openIssueCount : issues.length;
  const activeKinds = epicOnlyActiveEvidenceKinds(input?.evidence ?? {}, epicNumber);
  const epicOnlyOpenIssueState = openIssueCount === 1 && issues.length === 1 && issues[0] === epicNumber;
  const concreteActiveArtifactPresent = activeKinds.length > 0;
  const classification = epicOnlyOpenIssueState && !concreteActiveArtifactPresent
    ? "epic-only-open-issue-advisory"
    : "concrete-active-artifact-present";

  return {
    epic: `#${epicNumber}`,
    openIssueCount,
    epicOnlyOpenIssueState,
    classification,
    activeDevelopmentAllowed: classification === "concrete-active-artifact-present",
    activeEvidenceKinds: activeKinds,
    requiredBeforeActiveDevelopment: [
      "open-child-issue",
      "active-branch",
      "active-worktree",
      "active-session",
      "open-pull-request",
      "active-process",
    ],
    rule: "An open_issue=1 snapshot that contains only epic #960 is advisory/idle until backed by a concrete child issue, branch, worktree, session, pull request, or process.",
  };
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
