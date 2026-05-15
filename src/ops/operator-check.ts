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
export const OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SOURCE = "operator/check active-work receipt projection";
export const OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SOURCE = "operator/check orphan local-ahead salvage-review queue projection";
export const OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_CLAIM_BOUNDARY =
  "Read-only issue #843 operator queue for orphan local-ahead sibling worktrees; lists salvage-review evidence only and does not delete, push, fetch, mutate, or generate cleanup commands for orphan branches.";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE = "#736";
export const OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE = "#739";
export const OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_ISSUE = "#778";
export const OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_ISSUE = "#853";
export const OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_ISSUE = "#865";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE_URL = "https://github.com/minislively/fooks/issues/736";
export const OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE_URL = "https://github.com/minislively/fooks/issues/739";
export const OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_ISSUE_URL = "https://github.com/minislively/fooks/issues/778";
export const OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_ISSUE_URL = "https://github.com/minislively/fooks/issues/853";
export const OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_ISSUE_URL = "https://github.com/minislively/fooks/issues/865";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SOURCE = "operator/check stale worktree residue ledger projection";
export const OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SOURCE = "operator/check stale worktree residue cleanup-review manifest projection";
export const OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_SOURCE = "operator/check legacy local residue cleanup-review projection";
export const OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_SOURCE = "operator/check local-only residue active-boundary projection";
export const OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_SOURCE = "operator/check stale worktree residue active-boundary projection";
export const OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_SOURCE = "operator/check legacy review-worktree residue clean-slate boundary projection";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_CLAIM_BOUNDARY =
  "Read-only issue #736 operator receipt for stale sibling worktree residue; groups existing triage classes by count and next review action only, without paths, cleanup commands, fetch, delete, push, or mutation authority.";
export const OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_CLAIM_BOUNDARY =
  "Read-only issue #739 operator cleanup-review manifest for stale sibling worktree residue; lists per-row reason, risk class, and required manual action without paths, cleanup commands, fetch, delete, push, or mutation authority.";
export const OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_CLAIM_BOUNDARY =
  "Read-only issue #778 operator cleanup-review artifact for legacy local worktree residue from closed or merged artifacts; lists local path evidence only for operator review, never counts it as active work, and includes no cleanup commands, fetch, delete, push, or mutation authority.";
export const OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_CLAIM_BOUNDARY =
  "Read-only issue #853 operator boundary for local-only stale worktree/branch residue; separates open issue, open PR, mapped fooks tmux/proc session counts from cleanup-review residue, and never lets local-only residue satisfy active work/session requirements.";
export const OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_CLAIM_BOUNDARY =
  "Read-only operator/check reminder artifact for stale worktree residue versus active work; stale residue rows are cleanup-review context only and do not satisfy the active issue, PR, or mapped-session requirement.";
export const OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_CLAIM_BOUNDARY =
  "Read-only issue #865 dogfood clean-slate nudge artifact for legacy review-worktree residue; classifies legacy local review worktrees as stale/manual-review evidence only and requires actual active development to have issue, branch, session, PR evidence, or a concrete blocker.";
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
export type OperatorCheckStaleResidueCleanupReviewRiskClass =
  | "low-confirm-clean-before-manual-cleanup"
  | "high-preserve-local-only-state"
  | "medium-confirm-stale-context";
export type OperatorCheckStaleResidueCleanupReviewManualAction =
  | "confirm-no-needed-local-state-before-manual-cleanup"
  | "preserve-or-cherry-pick-local-only-commits-before-adoption-or-cleanup"
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
  dogfoodHandoff: {
    status: "requires-live-artifact" | "satisfied" | "blocked";
    requiredBeforeNextDevelopmentAction: boolean;
    evidenceBoundary: "ci-echo-and-stale-residue-are-not-active-work";
    nextAction: string;
  };
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

export type OperatorCheckStaleResidueCleanupReviewRow = {
  reviewId: string;
  branch?: string;
  head?: string;
  category: OperatorCheckStaleResidueLedgerCategory;
  reason: string;
  reasons: string[];
  riskClass: OperatorCheckStaleResidueCleanupReviewRiskClass;
  requiredManualAction: OperatorCheckStaleResidueCleanupReviewManualAction;
  evidence: {
    baseRef?: string;
    aheadOfBase?: number;
    behindBase?: number;
    dirty: OrphanLocalWorktreeEntry["dirty"];
    changedPathCount?: number;
    remoteBranchExists: OrphanLocalWorktreeEntry["remoteBranchExists"];
    openPullRequestState: OrphanLocalWorktreeEntry["openPullRequest"]["state"];
    closedPullRequestState: OrphanLocalWorktreeEntry["closedPullRequest"]["state"];
    activeTmuxPaneCount: number;
  };
  localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically";
};

export type OperatorCheckLegacyLocalResidueCleanupReviewRow = {
  reviewId: string;
  path: string;
  branch: string;
  head?: string;
  status: OperatorActivitySnapshot["legacyWorktreeEvidence"]["entries"][number]["status"];
  reasons: string[];
  archiveEvidence: OperatorActivitySnapshot["legacyWorktreeEvidence"]["entries"][number]["archiveEvidence"];
  activeSessionEvidence: OperatorActivitySnapshot["legacyWorktreeEvidence"]["entries"][number]["activeSessionEvidence"];
  staleLocalResidueIsActiveWorkEvidence: false;
  satisfiesActiveArtifactRequirement: false;
  requiredManualAction: "confirm-closed-or-merged-artifact-before-manual-cleanup-review";
};

export type OperatorCheckStaleResidueCleanupReviewManifest = {
  schemaVersion: typeof OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE_URL;
  source: typeof OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_CLAIM_BOUNDARY;
  readOnly: true;
  rowCount: number;
  rows: OperatorCheckStaleResidueCleanupReviewRow[];
  localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically";
};

export type OperatorCheckLegacyLocalResidueCleanupReview = {
  schemaVersion: typeof OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_ISSUE_URL;
  source: typeof OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_CLAIM_BOUNDARY;
  readOnly: true;
  rowCount: number;
  rows: OperatorCheckLegacyLocalResidueCleanupReviewRow[];
  staleLocalResidueIsActiveWorkEvidence: false;
  satisfiesActiveArtifactRequirement: false;
  cleanupCommandsIncluded: false;
};

export type OperatorCheckLocalOnlyResidueActiveBoundary = {
  schemaVersion: typeof OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_ISSUE_URL;
  source: typeof OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_CLAIM_BOUNDARY;
  readOnly: true;
  activeRequirementEvidence: {
    openIssueCount?: number;
    openPullRequestCount?: number;
    mappedFooksTmuxProcSessionCount: number;
  };
  cleanupReviewResidueEvidence: {
    siblingStaleResidueCount: number;
    legacyLocalResidueCount: number;
    totalLocalOnlyResidueCount: number;
  };
  localOnlyResidueIsActiveWorkEvidence: false;
  satisfiesActiveArtifactRequirement: false;
  cleanupReviewEvidenceOnly: true;
  reminder: string;
};

export type OperatorCheckStaleResidueActiveBoundary = {
  schemaVersion: typeof OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_SCHEMA_VERSION;
  source: typeof OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_CLAIM_BOUNDARY;
  readOnly: true;
  staleResidueCount: number;
  activeArtifactReceiptCount: number;
  staleResidueIsActiveWorkEvidence: false;
  satisfiesActiveArtifactRequirement: false;
  acceptableActiveArtifacts: ["open GitHub issue", "open GitHub pull request", "mapped fooks tmux session"];
  reminder: string;
};

export type OperatorCheckLegacyReviewWorktreeResidueBoundary = {
  schemaVersion: typeof OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_ISSUE_URL;
  source: typeof OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_CLAIM_BOUNDARY;
  readOnly: true;
  legacyReviewWorktreeResidueCount: number;
  classification: "stale-manual-review-evidence";
  staleManualReviewEvidenceOnly: true;
  satisfiesActiveDevelopmentRequirement: false;
  acceptableActiveDevelopmentEvidence: [
    "open GitHub issue",
    "non-main active branch",
    "mapped fooks tmux session",
    "open GitHub pull request",
    "concrete blocker",
  ];
  nudgeRule: string;
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
  cleanupReviewManifest: OperatorCheckStaleResidueCleanupReviewManifest;
  legacyLocalResidueCleanupReview: OperatorCheckLegacyLocalResidueCleanupReview;
  localOnlyResidueActiveBoundary: OperatorCheckLocalOnlyResidueActiveBoundary;
  staleResidueActiveBoundary: OperatorCheckStaleResidueActiveBoundary;
  legacyReviewWorktreeResidueBoundary: OperatorCheckLegacyReviewWorktreeResidueBoundary;
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
  postMergeMainCiEvidence: OperatorActivitySnapshot["postMergeMainCiEvidence"];
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
  cleanupReviewManifestRowCount = 0,
  legacyLocalResidueCleanupReviewRowCount = 0,
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
  if (cleanupReviewManifestRowCount > 0) parts.push(`cleanupReviewManifest=${cleanupReviewManifestRowCount}(${OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE})`);
  if (legacyLocalResidueCleanupReviewRowCount > 0) {
    parts.push(`legacyLocalResidueCleanupReview=${legacyLocalResidueCleanupReviewRowCount}(${OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_ISSUE})`);
  }
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
  cleanupReviewManifest: OperatorCheckStaleResidueCleanupReviewManifest;
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
      cleanupReviewManifest: buildCleanupReviewManifest(triage.entries),
      blockers: triage.blockers,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      receipts: [],
      salvageReviewQueue: buildSalvageReviewQueue([]),
      staleResidueLedger: buildStaleResidueLedger([]),
      cleanupReviewManifest: buildCleanupReviewManifest([]),
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

type OperatorCheckStaleResidueEntry = OrphanLocalWorktreeEntry & { category: OperatorCheckStaleResidueLedgerCategory };

function isStaleResidueEntry(entry: OrphanLocalWorktreeEntry): entry is OperatorCheckStaleResidueEntry {
  return !entry.current && isStaleResidueLedgerCategory(entry.category);
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

function cleanupReviewRiskClass(entry: OperatorCheckStaleResidueEntry): OperatorCheckStaleResidueCleanupReviewRiskClass {
  if (entry.category === "salvage-review") return "high-preserve-local-only-state";
  if (entry.category === "manual-review-noise") return "medium-confirm-stale-context";
  return "low-confirm-clean-before-manual-cleanup";
}

function cleanupReviewManualAction(entry: OperatorCheckStaleResidueEntry): OperatorCheckStaleResidueCleanupReviewManualAction {
  if (entry.category === "salvage-review") return "preserve-or-cherry-pick-local-only-commits-before-adoption-or-cleanup";
  if (entry.category === "manual-review-noise") return "confirm-closed-pr-or-detached-review-context-before-ignoring";
  return "confirm-no-needed-local-state-before-manual-cleanup";
}

function cleanupReviewPrimaryReason(entry: OperatorCheckStaleResidueEntry, reasons: string[]): string {
  const expectedReason = entry.category === "salvage-review"
    ? reasons.find((reason) => /preserve local-only commits/u.test(reason))
    : entry.category === "manual-review-noise"
      ? reasons.find((reason) => /non-active .*noise/u.test(reason))
      : reasons.find((reason) => /stale worktree residue candidate/u.test(reason));
  return expectedReason ?? reasons[0] ?? "stale worktree residue requires manual review before cleanup";
}

function cleanupReviewId(entry: OperatorCheckStaleResidueEntry): string {
  const subject = sanitizeReportToken(entry.branch ?? entry.head ?? "unknown") ?? "unknown";
  return `${entry.category}:${subject}`;
}

function buildCleanupReviewManifest(entries: OrphanLocalWorktreeEntry[]): OperatorCheckStaleResidueCleanupReviewManifest {
  const rows = entries
    .filter(isStaleResidueEntry)
    .map((entry) => {
      const reasons = siblingWorktreeReceiptReasons(entry);
      return {
        reviewId: cleanupReviewId(entry),
        branch: entry.branch,
        head: entry.head,
        category: entry.category,
        reason: cleanupReviewPrimaryReason(entry, reasons),
        reasons,
        riskClass: cleanupReviewRiskClass(entry),
        requiredManualAction: cleanupReviewManualAction(entry),
        evidence: {
          baseRef: entry.baseRef,
          aheadOfBase: entry.aheadOfBase,
          behindBase: entry.behindBase,
          dirty: entry.dirty,
          changedPathCount: entry.changedPathCount,
          remoteBranchExists: entry.remoteBranchExists,
          openPullRequestState: entry.openPullRequest.state,
          closedPullRequestState: entry.closedPullRequest.state,
          activeTmuxPaneCount: entry.activeTmuxPaneCount,
        },
        localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically" as const,
      };
    });

  return {
    schemaVersion: OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE,
    issueUrl: OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE_URL,
    source: OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SOURCE,
    claimBoundary: OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_CLAIM_BOUNDARY,
    readOnly: true,
    rowCount: rows.length,
    rows,
    localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically",
  };
}

function legacyLocalResidueReviewId(entry: OperatorActivitySnapshot["legacyWorktreeEvidence"]["entries"][number]): string {
  const subject = sanitizeReportToken(entry.branch || entry.head || "unknown") ?? "unknown";
  return `legacy-local-residue:${subject}`;
}

function buildLegacyLocalResidueCleanupReview(
  legacyWorktreeEvidence: OperatorActivitySnapshot["legacyWorktreeEvidence"],
): OperatorCheckLegacyLocalResidueCleanupReview {
  const rows = legacyWorktreeEvidence.entries.map((entry) => ({
    reviewId: legacyLocalResidueReviewId(entry),
    path: entry.path,
    branch: entry.branch,
    head: entry.head,
    status: entry.status,
    reasons: entry.reasons,
    archiveEvidence: entry.archiveEvidence,
    activeSessionEvidence: entry.activeSessionEvidence,
    staleLocalResidueIsActiveWorkEvidence: false as const,
    satisfiesActiveArtifactRequirement: false as const,
    requiredManualAction: "confirm-closed-or-merged-artifact-before-manual-cleanup-review" as const,
  }));

  return {
    schemaVersion: OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_ISSUE,
    issueUrl: OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_ISSUE_URL,
    source: OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_SOURCE,
    claimBoundary: OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_CLAIM_BOUNDARY,
    readOnly: true,
    rowCount: rows.length,
    rows,
    staleLocalResidueIsActiveWorkEvidence: false,
    satisfiesActiveArtifactRequirement: false,
    cleanupCommandsIncluded: false,
  };
}

function buildStaleResidueActiveBoundary(
  staleResidueCount: number,
  activeArtifactReceiptCount: number,
): OperatorCheckStaleResidueActiveBoundary {
  return {
    schemaVersion: OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_SCHEMA_VERSION,
    source: OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_SOURCE,
    claimBoundary: OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_CLAIM_BOUNDARY,
    readOnly: true,
    staleResidueCount,
    activeArtifactReceiptCount,
    staleResidueIsActiveWorkEvidence: false,
    satisfiesActiveArtifactRequirement: false,
    acceptableActiveArtifacts: ["open GitHub issue", "open GitHub pull request", "mapped fooks tmux session"],
    reminder: staleResidueCount > 0
      ? "Stale worktree residue is cleanup-review context only; require an open issue, open PR, or mapped fooks tmux session before treating this snapshot as active work."
      : "No stale worktree residue was projected into this operator/check snapshot.",
  };
}

function buildLegacyReviewWorktreeResidueBoundary(
  legacyReviewWorktreeResidueCount: number,
): OperatorCheckLegacyReviewWorktreeResidueBoundary {
  return {
    schemaVersion: OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_ISSUE,
    issueUrl: OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_ISSUE_URL,
    source: OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_SOURCE,
    claimBoundary: OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_CLAIM_BOUNDARY,
    readOnly: true,
    legacyReviewWorktreeResidueCount,
    classification: "stale-manual-review-evidence",
    staleManualReviewEvidenceOnly: true,
    satisfiesActiveDevelopmentRequirement: false,
    acceptableActiveDevelopmentEvidence: [
      "open GitHub issue",
      "non-main active branch",
      "mapped fooks tmux session",
      "open GitHub pull request",
      "concrete blocker",
    ],
    nudgeRule: legacyReviewWorktreeResidueCount > 0
      ? "During clean-slate dogfood nudges, legacy local review worktree residue is stale/manual-review evidence only; report actual active development only from issue, branch, session, PR evidence, or a concrete blocker."
      : "No legacy local review worktree residue was projected into this clean-slate boundary.",
  };
}

function buildLocalOnlyResidueActiveBoundary(
  activity: OperatorActivitySnapshot,
  siblingStaleResidueCount: number,
  legacyLocalResidueCount: number,
): OperatorCheckLocalOnlyResidueActiveBoundary {
  const totalLocalOnlyResidueCount = siblingStaleResidueCount + legacyLocalResidueCount;
  return {
    schemaVersion: OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_ISSUE,
    issueUrl: OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_ISSUE_URL,
    source: OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_SOURCE,
    claimBoundary: OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_CLAIM_BOUNDARY,
    readOnly: true,
    activeRequirementEvidence: {
      openIssueCount: activity.currentRunEvidence.evidence.openIssues,
      openPullRequestCount: activity.currentRunEvidence.evidence.openPullRequests,
      mappedFooksTmuxProcSessionCount: activity.currentRunEvidence.evidence.fooksSessionCount,
    },
    cleanupReviewResidueEvidence: {
      siblingStaleResidueCount,
      legacyLocalResidueCount,
      totalLocalOnlyResidueCount,
    },
    localOnlyResidueIsActiveWorkEvidence: false,
    satisfiesActiveArtifactRequirement: false,
    cleanupReviewEvidenceOnly: true,
    reminder: totalLocalOnlyResidueCount > 0
      ? "Local-only stale worktree/branch residue is cleanup-review evidence only; it remains separate from open issue, open PR, and mapped fooks tmux/proc session requirements."
      : "No local-only stale worktree/branch residue was projected into this operator/check snapshot.",
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
  const legacyLocalResidueCleanupReview = buildLegacyLocalResidueCleanupReview(activity.legacyWorktreeEvidence);
  receipts.push(...siblingReceipts.receipts);

  const blockers = uniqueSorted([
    ...baseBlockers,
    ...activity.blockers,
    ...siblingReceipts.blockers,
    ...receipts.flatMap((receipt) => receipt.blockers),
  ]);
  const classification = overallReceiptClassification(receipts, blockers);
  const activeArtifactReceiptCount = receipts.filter((receipt) =>
    receipt.classification === "active"
    && (receipt.kind === "issue" || receipt.kind === "pullRequest" || receipt.kind === "session")
  ).length;
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
      siblingReceipts.cleanupReviewManifest.rowCount,
      legacyLocalResidueCleanupReview.rowCount,
    ),
    salvageReviewQueue: siblingReceipts.salvageReviewQueue,
    staleResidueLedger: siblingReceipts.staleResidueLedger,
    cleanupReviewManifest: siblingReceipts.cleanupReviewManifest,
    legacyLocalResidueCleanupReview,
    localOnlyResidueActiveBoundary: buildLocalOnlyResidueActiveBoundary(
      activity,
      siblingReceipts.staleResidueLedger.totalCount,
      legacyLocalResidueCleanupReview.rowCount,
    ),
    staleResidueActiveBoundary: buildStaleResidueActiveBoundary(
      siblingReceipts.staleResidueLedger.totalCount,
      activeArtifactReceiptCount,
    ),
    legacyReviewWorktreeResidueBoundary: buildLegacyReviewWorktreeResidueBoundary(activity.legacyWorktreeEvidence.staleClosedArtifactWorktreeCount),
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

function requiredActiveArtifact(state: { blocked: boolean; hasActiveArtifact: boolean }): OperatorCheckRequiredActiveArtifact {
  const required = !state.blocked && !state.hasActiveArtifact;
  const status = state.blocked ? "blocked" : required ? "requires-live-artifact" : "satisfied";
  return {
    required,
    acceptableArtifacts: ["open GitHub issue", "open GitHub pull request", "mapped fooks tmux session"],
    message: state.blocked
      ? "Operator check is blocked; resolve blockers before deciding whether an active issue, PR, or mapped fooks session is required."
      : required
        ? "No concrete active issue, PR, or mapped fooks session is present; create or link one before treating post-merge main echoes as active work."
        : "A concrete active issue, PR, or mapped fooks session is present, so the snapshot is not idle echo-only evidence.",
    dogfoodHandoff: {
      status,
      requiredBeforeNextDevelopmentAction: required,
      evidenceBoundary: "ci-echo-and-stale-residue-are-not-active-work",
      nextAction: state.blocked
        ? "Resolve operator-check blockers before using this snapshot for session-whip handoff."
        : required
          ? "Create or link an open issue, open PR, or mapped fooks tmux session before reporting this clean post-merge snapshot as active work."
          : "Continue using the concrete active artifact already present in this snapshot.",
    },
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
    postMergeMainCiEvidence: activity.postMergeMainCiEvidence,
    activeArtifacts,
    activeWorkReceipts,
    requiredActiveArtifact: requiredActiveArtifact({ blocked, hasActiveArtifact }),
    activity,
    blockers,
  };
}
