import {
  readOperatorActivitySnapshot,
  type OperatorActivityOptions,
  type OperatorActivitySnapshot,
  OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG,
} from "./operator-activity";

export const OPERATOR_CHECK_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_COMMAND = "check";
export const OPERATOR_CHECK_CLAIM_BOUNDARY =
  "Read-only operator/check artifact for the post-merge main echo versus active work boundary; it requires a concrete issue, PR, or mapped session artifact when the checkout is otherwise idle.";
export const OPERATOR_CHECK_SOURCE = `status activity ${OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG} projection`;

export type OperatorCheckVerdict = "activeArtifactPresent" | "idleRequiresActiveArtifact" | "blocked";
export type OperatorCheckActiveArtifactKind = "issue" | "pullRequest" | "session";

export type OperatorCheckActiveArtifact = {
  kind: OperatorCheckActiveArtifactKind;
  count: number;
  source: string;
};

export type OperatorCheckRequiredActiveArtifact = {
  required: boolean;
  acceptableArtifacts: ["open GitHub issue", "open GitHub pull request", "mapped fooks tmux session"];
  message: string;
};

export type OperatorCheckSnapshot = {
  schemaVersion: typeof OPERATOR_CHECK_SCHEMA_VERSION;
  command: typeof OPERATOR_CHECK_COMMAND;
  generatedAt: string;
  cwd: string;
  claimBoundary: typeof OPERATOR_CHECK_CLAIM_BOUNDARY;
  readOnly: true;
  source: typeof OPERATOR_CHECK_SOURCE;
  verdict: OperatorCheckVerdict;
  postMergeMainEchoBoundary: {
    explicit: true;
    currentRunClassification: OperatorActivitySnapshot["currentRunEvidence"]["classification"];
    mainEchoEvidence: boolean;
    activeWorkEvidence: boolean;
    echoOnly: boolean;
    reasons: string[];
  };
  activeArtifacts: OperatorCheckActiveArtifact[];
  requiredActiveArtifact: OperatorCheckRequiredActiveArtifact;
  activity: OperatorActivitySnapshot;
  blockers: string[];
};

function activeArtifactsFrom(activity: OperatorActivitySnapshot): OperatorCheckActiveArtifact[] {
  const artifacts: OperatorCheckActiveArtifact[] = [];
  const counts = activity.optionalCounts;
  if (counts.enabled && typeof counts.openIssues === "number" && counts.openIssues > 0) {
    artifacts.push({ kind: "issue", count: counts.openIssues, source: counts.source });
  }
  if (counts.enabled && typeof counts.openPullRequests === "number" && counts.openPullRequests > 0) {
    artifacts.push({ kind: "pullRequest", count: counts.openPullRequests, source: counts.source });
  }
  if (activity.tmux.sessions.length > 0) {
    artifacts.push({ kind: "session", count: activity.tmux.sessions.length, source: activity.tmux.command });
  }
  return artifacts;
}

function requiredActiveArtifact(required: boolean): OperatorCheckRequiredActiveArtifact {
  return {
    required,
    acceptableArtifacts: ["open GitHub issue", "open GitHub pull request", "mapped fooks tmux session"],
    message: required
      ? "No concrete active issue, PR, or mapped fooks session is present; create or link one before treating post-merge main echoes as active work."
      : "A concrete active issue, PR, or mapped fooks session is present, so the snapshot is not idle echo-only evidence.",
  };
}

export function readOperatorCheckSnapshot(cwd = process.cwd(), options: OperatorActivityOptions = {}): OperatorCheckSnapshot {
  const activity = readOperatorActivitySnapshot(cwd, { ...options, includeRemoteCounts: true });
  const activeArtifacts = activeArtifactsFrom(activity);
  const blockers = [...activity.blockers];
  const hasActiveArtifact = activeArtifacts.length > 0;
  const optionalCountBlockers = activity.optionalCounts.enabled ? activity.optionalCounts.blockers : [];
  const blocked = activity.currentRunEvidence.blockers.length > 0 || optionalCountBlockers.length > 0 || !activity.tmux.available;
  const echoOnly = activity.currentRunEvidence.mainEchoEvidence && !hasActiveArtifact;
  const verdict: OperatorCheckVerdict = blocked
    ? "blocked"
    : hasActiveArtifact
      ? "activeArtifactPresent"
      : "idleRequiresActiveArtifact";

  return {
    schemaVersion: OPERATOR_CHECK_SCHEMA_VERSION,
    command: OPERATOR_CHECK_COMMAND,
    generatedAt: activity.generatedAt,
    cwd: activity.cwd,
    claimBoundary: OPERATOR_CHECK_CLAIM_BOUNDARY,
    readOnly: true,
    source: OPERATOR_CHECK_SOURCE,
    verdict,
    postMergeMainEchoBoundary: {
      explicit: true,
      currentRunClassification: activity.currentRunEvidence.classification,
      mainEchoEvidence: activity.currentRunEvidence.mainEchoEvidence,
      activeWorkEvidence: activity.currentRunEvidence.activeWorkEvidence,
      echoOnly,
      reasons: activity.currentRunEvidence.reasons,
    },
    activeArtifacts,
    requiredActiveArtifact: requiredActiveArtifact(!blocked && !hasActiveArtifact),
    activity,
    blockers,
  };
}
