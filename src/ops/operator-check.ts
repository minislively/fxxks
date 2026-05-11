import { execFileSync } from "node:child_process";
import {
  readOperatorActivitySnapshot,
  type OperatorActivityOptions,
  type OperatorActivitySnapshot,
  OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG,
} from "./operator-activity";
import {
  ORPHAN_LOCAL_WORKTREE_TRIAGE_CLAIM_BOUNDARY,
  ORPHAN_LOCAL_WORKTREE_TRIAGE_COMMAND,
  ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE,
  ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE_URL,
  ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE,
  triageOrphanLocalWorktrees,
  type OrphanLocalWorktreeEntry,
} from "./orphan-local-worktree-triage";

export const OPERATOR_CHECK_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_COMMAND = "check";
export const OPERATOR_CHECK_CLAIM_BOUNDARY =
  "Read-only operator/check artifact for the post-merge main echo versus active work boundary; it requires a concrete issue, PR, or mapped session artifact when the checkout is otherwise idle.";
export const OPERATOR_CHECK_SOURCE = `status activity ${OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG} projection`;
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SOURCE = "operator/check active-work receipt projection";
export const OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SOURCE = "operator/check orphan local-ahead salvage-review queue projection";
export const OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_CLAIM_BOUNDARY =
  "Read-only issue #726 operator queue for orphan local-ahead sibling worktrees; lists salvage-review evidence only and does not delete, push, fetch, mutate, or generate cleanup commands for orphan branches.";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE = "#736";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE_URL = "https://github.com/minislively/fooks/issues/736";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SOURCE = "operator/check stale worktree residue ledger projection";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_CLAIM_BOUNDARY =
  "Read-only issue #736 operator receipt for stale sibling worktree residue; groups existing triage classes by count and next review action only, without paths, cleanup commands, fetch, delete, push, or mutation authority.";
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_ISSUE = "#720";
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_CLAIM_BOUNDARY =
  "Bounded local/static active-work receipt for fooks session-whip handling; aggregate issue/PR counts are not per-artifact identity, stale sibling worktree receipts are adoption classifiers only, and report lines omit paths and cleanup commands.";

export type OperatorCheckVerdict = "activeArtifactPresent" | "idleRequiresActiveArtifact" | "blocked";
export type OperatorCheckActiveArtifactKind = "issue" | "pullRequest" | "session";
export type OperatorCheckActiveWorkReceiptKind = "issue" | "pullRequest" | "branch" | "session" | "worktree";
export type OperatorCheckActiveWorkReceiptClassification = "active" | "closedOrStale" | "mainEcho" | "blocked";
export type OperatorCheckStaleResidueLedgerCategory = "safe-cleanup" | "salvage-review" | "manual-review-noise";
export type OperatorCheckStaleResidueLedgerNextReviewAction =
  | "review-closed-or-merged-evidence-before-manual-cleanup"
  | "preserve-local-only-commits-before-adoption-or-cleanup"
  | "confirm-closed-pr-or-detached-review-context-before-ignoring";

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

export type OperatorCheckActiveWorkReceiptIdentifiers = {
  repo?: string;
  repoSource: "git remote.origin.url" | "unavailable";
  worktree: {
    branch?: string;
    upstream?: string;
    head?: string;
    clean: boolean | null;
  };
  session?: {
    name: string;
    paneCount: number;
  };
  siblingWorktree?: {
    category: OrphanLocalWorktreeEntry["category"];
    activeTmuxPaneCount: number;
    aheadOfBase?: number;
    behindBase?: number;
    dirty: OrphanLocalWorktreeEntry["dirty"];
    remoteBranchExists: OrphanLocalWorktreeEntry["remoteBranchExists"];
    openPullRequestState: OrphanLocalWorktreeEntry["openPullRequest"]["state"];
    closedPullRequestState: OrphanLocalWorktreeEntry["closedPullRequest"]["state"];
    localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically";
  };
};

export type OperatorCheckSalvageReviewQueueItem = {
  branch?: string;
  head?: string;
  category: "salvage-review";
  evidence: {
    baseRef?: string;
    aheadOfBase?: number;
    behindBase?: number;
    diff: OrphanLocalWorktreeEntry["diffEvidence"];
    dirty: OrphanLocalWorktreeEntry["dirty"];
    changedPathCount?: number;
    remoteBranchExists: false | "unknown";
    openPullRequestState: OrphanLocalWorktreeEntry["openPullRequest"]["state"];
    closedPullRequestState: OrphanLocalWorktreeEntry["closedPullRequest"]["state"];
  };
  reasons: string[];
  localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically";
};

export type OperatorCheckSalvageReviewQueue = {
  schemaVersion: typeof OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SCHEMA_VERSION;
  issue: typeof ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE;
  issueUrl: typeof ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE_URL;
  source: typeof OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_CLAIM_BOUNDARY;
  readOnly: true;
  itemCount: number;
  items: OperatorCheckSalvageReviewQueueItem[];
};

export type OperatorCheckStaleResidueLedgerClass = {
  category: OperatorCheckStaleResidueLedgerCategory;
  count: number;
  nextReviewAction: OperatorCheckStaleResidueLedgerNextReviewAction;
};

export type OperatorCheckStaleResidueLedger = {
  schemaVersion: typeof OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE_URL;
  source: typeof OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_STALE_RESIDUE_LEDGER_CLAIM_BOUNDARY;
  readOnly: true;
  totalCount: number;
  counts: Record<OperatorCheckStaleResidueLedgerCategory, number>;
  classes: OperatorCheckStaleResidueLedgerClass[];
  localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically";
};

export type OperatorCheckActiveWorkReceipt = {
  kind: OperatorCheckActiveWorkReceiptKind;
  classification: OperatorCheckActiveWorkReceiptClassification;
  identifiers: OperatorCheckActiveWorkReceiptIdentifiers;
  count?: number;
  source: string;
  reasons: string[];
  blockers: string[];
};

export type OperatorCheckActiveWorkReceipts = {
  schemaVersion: typeof OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SCHEMA_VERSION;
  source: typeof OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_CLAIM_BOUNDARY;
  readOnly: true;
  classification: OperatorCheckActiveWorkReceiptClassification;
  identifiers: Omit<OperatorCheckActiveWorkReceiptIdentifiers, "session">;
  receipts: OperatorCheckActiveWorkReceipt[];
  reportLine: string;
  salvageReviewQueue: OperatorCheckSalvageReviewQueue;
  staleResidueLedger: OperatorCheckStaleResidueLedger;
  blockers: string[];
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
  activeWorkReceipts: OperatorCheckActiveWorkReceipts;
  requiredActiveArtifact: OperatorCheckRequiredActiveArtifact;
  activity: OperatorActivitySnapshot;
  blockers: string[];
};


function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function sanitizeReportToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/[^a-zA-Z0-9._/#:-]+/g, "-").replace(/^-+|-+$/g, "") || undefined;
}

function canonicalRepoIdentifier(remoteUrl: string): string | undefined {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return undefined;
  const ssh = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/u);
  if (ssh) return `${ssh[1]}/${ssh[2].replace(/\.git$/u, "")}`;
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/^\/+|\.git$/gu, "");
    return pathname ? `${parsed.hostname}/${pathname}` : parsed.hostname;
  } catch {
    return trimmed.replace(/\.git$/u, "");
  }
}

function readLocalGitConfig(cwd: string, options: OperatorActivityOptions): string {
  if (options.commandRunner) return options.commandRunner("git", ["config", "--get", "remote.origin.url"], cwd, 1000);
  return execFileSync("git", ["config", "--get", "remote.origin.url"], {
    cwd,
    encoding: "utf8",
    timeout: 1000,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function readRepoIdentifier(cwd: string, options: OperatorActivityOptions): { repo?: string; blockers: string[] } {
  try {
    const repo = canonicalRepoIdentifier(readLocalGitConfig(cwd, options));
    return repo ? { repo, blockers: [] } : { blockers: ["repo identifier unavailable: remote.origin.url is empty"] };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { blockers: [`repo identifier unavailable: ${detail}`] };
  }
}

function baseReceiptIdentifiers(
  activity: OperatorActivitySnapshot,
  repo: string | undefined,
  repoBlockers: string[],
): Omit<OperatorCheckActiveWorkReceiptIdentifiers, "session"> {
  return {
    repo,
    repoSource: repoBlockers.length > 0 ? "unavailable" : "git remote.origin.url",
    worktree: {
      branch: activity.worktree.branch,
      upstream: activity.worktree.upstream,
      clean: activity.worktree.clean,
    },
  };
}

function withRepoBlockers(blockers: string[], repoBlockers: string[]): string[] {
  return uniqueSorted([...blockers, ...repoBlockers]);
}

function receiptReportLine(
  receipts: OperatorCheckActiveWorkReceipt[],
  classification: OperatorCheckActiveWorkReceiptClassification,
  blockers: string[],
  salvageReviewQueueItemCount = 0,
  staleResidueLedgerCount = 0,
): string {
  const active = receipts.filter((receipt) => receipt.classification === "active").length;
  const stale = receipts.filter((receipt) => receipt.classification === "closedOrStale").length;
  const mainEcho = receipts.some((receipt) => receipt.classification === "mainEcho");
  const blocked = blockers.length;
  const parts = [`fooks active-work receipt: ${classification}`];
  parts.push(`active=${active}`);
  parts.push(`closedOrStale=${stale}`);
  if (mainEcho) parts.push("mainEcho=1");
  if (salvageReviewQueueItemCount > 0) parts.push(`salvageReviewQueue=${salvageReviewQueueItemCount}`);
  if (staleResidueLedgerCount > 0) parts.push(`staleResidueLedger=${staleResidueLedgerCount}`);
  if (blocked) parts.push(`blockers=${blocked}`);
  return parts.join("; ");
}

function overallReceiptClassification(
  receipts: OperatorCheckActiveWorkReceipt[],
  blockers: string[],
): OperatorCheckActiveWorkReceiptClassification {
  if (blockers.length > 0) return "blocked";
  if (receipts.some((receipt) => receipt.classification === "active")) return "active";
  if (receipts.some((receipt) => receipt.classification === "closedOrStale")) return "closedOrStale";
  if (receipts.some((receipt) => receipt.classification === "mainEcho")) return "mainEcho";
  return "blocked";
}

function siblingWorktreeReceiptClassification(entry: OrphanLocalWorktreeEntry): OperatorCheckActiveWorkReceiptClassification {
  if (entry.category === "manual-review-noise") return "closedOrStale";
  return entry.category === "keep" ? "active" : "closedOrStale";
}

function siblingWorktreeReceiptReasons(entry: OrphanLocalWorktreeEntry): string[] {
  const categoryReason = entry.category === "manual-review-noise"
    ? entry.branch
      ? `closed-PR remote worktree residue is non-active manual-review noise; do not adopt as active solely from remote/pr counts (#723; triage ${ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE})`
      : `detached PR review worktree leftover is non-active cleanup-review noise; do not adopt as active without a fresh issue, PR, or mapped session, and do not auto-delete, push, or mutate local-only commits (#733; triage ${ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE})`
    : entry.category === "salvage-review"
    ? `local-ahead orphan or uncertain local state: preserve local-only commits before adoption or cleanup (${OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_ISSUE}; triage ${ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE})`
    : entry.category === "safe-cleanup"
      ? `stale worktree residue candidate; no active adoption without manual confirmation (${OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_ISSUE}; triage ${ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE})`
      : `sibling worktree has active keep evidence and may be adopted only with that evidence (${OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_ISSUE}; triage ${ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE})`;
  return uniqueSorted([categoryReason, ...entry.reasons]);
}

function siblingWorktreeReceipts(
  cwd: string,
  baseIdentifiers: Omit<OperatorCheckActiveWorkReceiptIdentifiers, "session" | "siblingWorktree">,
  baseBlockers: string[],
  options: OperatorActivityOptions,
): {
  receipts: OperatorCheckActiveWorkReceipt[];
  salvageReviewQueue: OperatorCheckSalvageReviewQueue;
  staleResidueLedger: OperatorCheckStaleResidueLedger;
  blockers: string[];
} {
  try {
    const triage = triageOrphanLocalWorktrees(cwd, {
      runner: options.commandRunner
        ? (command, args, runnerCwd) => options.commandRunner?.(command, args, runnerCwd, 3000) ?? ""
        : undefined,
      pathExists: options.pathExists,
      now: options.now,
    });
    const receipts = triage.entries
      .filter((entry) => !entry.current)
      .map((entry) => ({
        kind: "worktree" as const,
        classification: siblingWorktreeReceiptClassification(entry),
        identifiers: {
          ...baseIdentifiers,
          worktree: {
            ...baseIdentifiers.worktree,
            branch: entry.branch,
            head: entry.head,
          },
          siblingWorktree: {
            category: entry.category,
            activeTmuxPaneCount: entry.activeTmuxPaneCount,
            aheadOfBase: entry.aheadOfBase,
            behindBase: entry.behindBase,
            dirty: entry.dirty,
            remoteBranchExists: entry.remoteBranchExists,
            openPullRequestState: entry.openPullRequest.state,
            closedPullRequestState: entry.closedPullRequest.state,
            localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically" as const,
          },
        },
        source: `${ORPHAN_LOCAL_WORKTREE_TRIAGE_COMMAND}; ${ORPHAN_LOCAL_WORKTREE_TRIAGE_CLAIM_BOUNDARY}`,
        reasons: siblingWorktreeReceiptReasons(entry),
        blockers: withRepoBlockers(triage.blockers, baseBlockers),
      }));
    return {
      receipts,
      salvageReviewQueue: buildSalvageReviewQueue(triage.entries),
      staleResidueLedger: buildStaleResidueLedger(triage.entries),
      blockers: triage.blockers,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      receipts: [],
      salvageReviewQueue: buildSalvageReviewQueue([]),
      staleResidueLedger: buildStaleResidueLedger([]),
      blockers: [`sibling worktree adoption receipt unavailable: ${detail}`],
    };
  }
}

const STALE_RESIDUE_LEDGER_CLASSES: OperatorCheckStaleResidueLedgerClass[] = [
  {
    category: "safe-cleanup",
    count: 0,
    nextReviewAction: "review-closed-or-merged-evidence-before-manual-cleanup",
  },
  {
    category: "salvage-review",
    count: 0,
    nextReviewAction: "preserve-local-only-commits-before-adoption-or-cleanup",
  },
  {
    category: "manual-review-noise",
    count: 0,
    nextReviewAction: "confirm-closed-pr-or-detached-review-context-before-ignoring",
  },
];

function isStaleResidueLedgerCategory(category: OrphanLocalWorktreeEntry["category"]): category is OperatorCheckStaleResidueLedgerCategory {
  return category === "safe-cleanup" || category === "salvage-review" || category === "manual-review-noise";
}

function buildStaleResidueLedger(entries: OrphanLocalWorktreeEntry[]): OperatorCheckStaleResidueLedger {
  const counts: Record<OperatorCheckStaleResidueLedgerCategory, number> = {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 0,
  };
  for (const entry of entries) {
    if (!entry.current && isStaleResidueLedgerCategory(entry.category)) counts[entry.category] += 1;
  }
  const classes = STALE_RESIDUE_LEDGER_CLASSES.map((row) => ({
    ...row,
    count: counts[row.category],
  }));
  return {
    schemaVersion: OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE,
    issueUrl: OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE_URL,
    source: OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SOURCE,
    claimBoundary: OPERATOR_CHECK_STALE_RESIDUE_LEDGER_CLAIM_BOUNDARY,
    readOnly: true,
    totalCount: classes.reduce((sum, row) => sum + row.count, 0),
    counts,
    classes,
    localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically",
  };
}

function buildSalvageReviewQueue(entries: OrphanLocalWorktreeEntry[]): OperatorCheckSalvageReviewQueue {
  const items = entries
    .filter((entry) => !entry.current)
    .filter((entry) => entry.category === "salvage-review")
    .filter((entry) => entry.remoteBranchExists === false || entry.remoteBranchExists === "unknown")
    .map((entry) => ({
      branch: entry.branch,
      head: entry.head,
      category: "salvage-review" as const,
      evidence: {
        baseRef: entry.baseRef,
        aheadOfBase: entry.aheadOfBase,
        behindBase: entry.behindBase,
        diff: entry.diffEvidence,
        dirty: entry.dirty,
        changedPathCount: entry.changedPathCount,
        remoteBranchExists: entry.remoteBranchExists as false | "unknown",
        openPullRequestState: entry.openPullRequest.state,
        closedPullRequestState: entry.closedPullRequest.state,
      },
      reasons: siblingWorktreeReceiptReasons(entry),
      localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically" as const,
    }));

  return {
    schemaVersion: OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SCHEMA_VERSION,
    issue: ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE,
    issueUrl: ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE_URL,
    source: OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SOURCE,
    claimBoundary: OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_CLAIM_BOUNDARY,
    readOnly: true,
    itemCount: items.length,
    items,
  };
}

function buildActiveWorkReceipts(
  cwd: string,
  activity: OperatorActivitySnapshot,
  options: OperatorActivityOptions,
): OperatorCheckActiveWorkReceipts {
  const repoIdentity = readRepoIdentifier(cwd, options);
  const baseIdentifiers = baseReceiptIdentifiers(activity, repoIdentity.repo, repoIdentity.blockers);
  const receipts: OperatorCheckActiveWorkReceipt[] = [];

  const baseBlockers = repoIdentity.blockers;
  const counts = activity.optionalCounts;
  if (counts.enabled && typeof counts.openIssues === "number" && counts.openIssues > 0) {
    receipts.push({
      kind: "issue",
      classification: "active",
      identifiers: baseIdentifiers,
      count: counts.openIssues,
      source: counts.source,
      reasons: ["aggregate open issue count is greater than zero"],
      blockers: withRepoBlockers([], baseBlockers),
    });
  }
  if (counts.enabled && typeof counts.openPullRequests === "number" && counts.openPullRequests > 0) {
    receipts.push({
      kind: "pullRequest",
      classification: "active",
      identifiers: baseIdentifiers,
      count: counts.openPullRequests,
      source: counts.source,
      reasons: ["aggregate open pull request count is greater than zero"],
      blockers: withRepoBlockers([], baseBlockers),
    });
  }

  if (activity.currentRunEvidence.mainEchoEvidence) {
    receipts.push({
      kind: "branch",
      classification: "mainEcho",
      identifiers: baseIdentifiers,
      source: activity.currentRunEvidence.source,
      reasons: activity.currentRunEvidence.reasons,
      blockers: withRepoBlockers(activity.currentRunEvidence.blockers, baseBlockers),
    });
  } else if (activity.worktree.branch && activity.worktree.branch !== "main") {
    receipts.push({
      kind: "branch",
      classification: "active",
      identifiers: baseIdentifiers,
      source: "local git worktree snapshot",
      reasons: [`current branch is ${sanitizeReportToken(activity.worktree.branch) ?? "non-main"}`],
      blockers: withRepoBlockers(activity.worktree.blockers, baseBlockers),
    });
  }

  for (const session of activity.tmux.sessions) {
    const classification: OperatorCheckActiveWorkReceiptClassification = session.status === "staleRuntimeCandidate" ? "closedOrStale" : "active";
    receipts.push({
      kind: "session",
      classification,
      identifiers: {
        ...baseIdentifiers,
        session: {
          name: session.session,
          paneCount: session.paneCount,
        },
      },
      source: activity.tmux.command,
      reasons: session.reasons,
      blockers: withRepoBlockers(activity.tmux.blockers, baseBlockers),
    });
  }

  for (const entry of activity.legacyWorktreeEvidence.entries) {
    receipts.push({
      kind: "branch",
      classification: "closedOrStale",
      identifiers: {
        ...baseIdentifiers,
        worktree: {
          ...baseIdentifiers.worktree,
          branch: entry.branch,
          head: entry.head,
        },
      },
      source: activity.legacyWorktreeEvidence.source,
      reasons: entry.reasons,
      blockers: withRepoBlockers(activity.legacyWorktreeEvidence.blockers, baseBlockers),
    });
  }

  const siblingReceipts = siblingWorktreeReceipts(cwd, baseIdentifiers, baseBlockers, options);
  receipts.push(...siblingReceipts.receipts);

  const blockers = uniqueSorted([
    ...baseBlockers,
    ...activity.blockers,
    ...siblingReceipts.blockers,
    ...receipts.flatMap((receipt) => receipt.blockers),
  ]);
  const classification = overallReceiptClassification(receipts, blockers);
  return {
    schemaVersion: OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SCHEMA_VERSION,
    source: OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SOURCE,
    claimBoundary: OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_CLAIM_BOUNDARY,
    readOnly: true,
    classification,
    identifiers: baseIdentifiers,
    receipts,
    reportLine: receiptReportLine(
      receipts,
      classification,
      blockers,
      siblingReceipts.salvageReviewQueue.itemCount,
      siblingReceipts.staleResidueLedger.totalCount,
    ),
    salvageReviewQueue: siblingReceipts.salvageReviewQueue,
    staleResidueLedger: siblingReceipts.staleResidueLedger,
    blockers,
  };
}

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
  const activeWorkReceipts = buildActiveWorkReceipts(cwd, activity, options);
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
    activeWorkReceipts,
    requiredActiveArtifact: requiredActiveArtifact(!blocked && !hasActiveArtifact),
    activity,
    blockers,
  };
}
