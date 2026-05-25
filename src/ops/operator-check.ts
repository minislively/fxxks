import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  hasPlanningEpicPlusSingleChildOpenIssue,
  hasOnlyPlanningEpicOpenIssue,
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
import { STALE_WORKTREE_AUDIT_COMMAND, STALE_WORKTREE_AUDIT_ISSUE } from "./stale-worktree-audit";
import { isTmuxActivityNoServerBlocker } from "./tmux-errors";
import { buildOperatorContextTrust, type OperatorContextTrustEntry, type OperatorContextTrustPacket } from "./context-trust";
import { buildRuntimeTokenCostPlanningWarnings, type RuntimeTokenCostPlanningWarning } from "./runtime-token-cost-planning-warning";
import { buildCombinedReliabilityWarnings, type CombinedReliabilityWarning } from "./combined-reliability-warning";
import { buildSequentialPlanningHints, readSequentialPlanningPrompt, type SequentialPlanningHint } from "./sequential-planning-hint";
import { buildPlanBeforeExecuteGuards, type PlanBeforeExecuteGuard } from "./plan-before-execute-guard";
import { buildLongRunBudgetWarnings, type LongRunBudgetWarning } from "./long-run-budget-warning";
import { buildResetCompactHandoffRecommendations, type ResetCompactHandoffRecommendation } from "./reset-compact-handoff-recommendation";

export const OPERATOR_CHECK_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_COMMAND = "check";
export const OPERATOR_CHECK_CLAIM_BOUNDARY =
  "Read-only operator/check artifact for the post-merge main echo versus active work boundary; it requires a concrete issue, PR, or mapped session artifact when the checkout is otherwise idle.";
export const OPERATOR_CHECK_SOURCE = `status activity ${OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG} projection`;
export const OPERATOR_CHECK_PROVENANCE_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_TIMING_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_TIMING_SOURCE = "fooks check --json operator-check diagnostic timing";
export const OPERATOR_CHECK_TIMING_CLAIM_BOUNDARY =
  "Diagnostic/read-only operator-check subphase timing only; not current-work authority, not cleanup authority, not handoff/source-of-truth authority, not provider billing/runtime proof, and not a semantic input to downstream guidance decisions.";
export const OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_SCHEMA_VERSION = 1;
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SOURCE = "operator/check active-work receipt projection";
export const OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_SOURCE = "operator/check compact session-whip run receipt projection";
export const OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SOURCE = "operator/check reliability warning visibility projection";
export const OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SOURCE = "operator/check compact resume handoff projection";
export const OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_CLAIM_BOUNDARY =
  "Read-only operator/check visibility projection over existing contextTrust/source-of-truth, runtime planning advisory, sequentialPlanningHints, combinedReliabilityWarnings, longRunBudgetWarnings, and resetCompactHandoffRecommendations fields only; it adds no telemetry, provider/runtime hooks, token/cost accounting, merge-gate policy, product claims, or frontend behavior.";
export const OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_CLAIM_BOUNDARY =
  "Compact advisory/read-only resume handoff projection for issue #992; derived only from existing operator-check contextTrust/source-of-truth, reliability warning visibility, runtime planning, sequential planning, plan-before-execute, long-run budget, and reset/compact/handoff recommendation fields, and adds no provider/runtime telemetry, CI/merge authority, product claims, or frontend behavior.";
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
export const OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_ISSUE = "#867";
export const OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_ISSUE = "#869";
export const OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_ISSUE = "#885";
export const OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_ISSUE = "#895";
export const OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_ISSUE = "#992";
export const OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_ISSUE = "#1062";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_ISSUE_URL = "https://github.com/minislively/fooks/issues/736";
export const OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE_URL = "https://github.com/minislively/fooks/issues/739";
export const OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_ISSUE_URL = "https://github.com/minislively/fooks/issues/778";
export const OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_ISSUE_URL = "https://github.com/minislively/fooks/issues/853";
export const OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_ISSUE_URL = "https://github.com/minislively/fooks/issues/865";
export const OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_ISSUE_URL = "https://github.com/minislively/fooks/issues/867";
export const OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_ISSUE_URL = "https://github.com/minislively/fooks/issues/869";
export const OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_ISSUE_URL = "https://github.com/minislively/fooks/issues/885";
export const OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_ISSUE_URL = "https://github.com/minislively/fooks/issues/1062";
export const OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_ISSUE_URL = "https://github.com/minislively/fooks/issues/895";
export const OPERATOR_CHECK_STALE_RESIDUE_LEDGER_SOURCE = "operator/check stale worktree residue ledger projection";
export const OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SOURCE = "operator/check stale worktree residue cleanup-review manifest projection";
export const OPERATOR_CHECK_LEGACY_LOCAL_RESIDUE_CLEANUP_REVIEW_SOURCE = "operator/check legacy local residue cleanup-review projection";
export const OPERATOR_CHECK_LOCAL_ONLY_RESIDUE_ACTIVE_BOUNDARY_SOURCE = "operator/check local-only residue active-boundary projection";
export const OPERATOR_CHECK_STALE_RESIDUE_ACTIVE_BOUNDARY_SOURCE = "operator/check stale worktree residue active-boundary projection";
export const OPERATOR_CHECK_LEGACY_REVIEW_WORKTREE_RESIDUE_BOUNDARY_SOURCE = "operator/check legacy review-worktree residue clean-slate boundary projection";
export const OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_SOURCE = "operator/check post-receipt dogfood nudge anchor projection";
export const OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_SOURCE = "operator/check receipt-only dogfood nudge loop boundary projection";
export const OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_SOURCE = "operator/check issue #885 handoff artifact evidence projection";
export const OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_SOURCE = "operator/check issue #1062 completed-child receipt boundary projection";
export const OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_SOURCE = "operator/check issue #895 legacy review residue cleanup-review guard projection";
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
export const OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_CLAIM_BOUNDARY =
  "Read-only issue #867 dogfood post-receipt nudge artifact; treats the #866 main CI/release success and closed legacy worktree bucket as receipts only, and requires the next nudge to name a fresh issue, branch, session, PR anchor, or concrete blocker.";
export const OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_CLAIM_BOUNDARY =
  "Read-only issue #869 dogfood receipt-only nudge loop artifact; after PR #868 receipt-only closeout, the next nudge report must name newly created or adopted issue evidence plus mapped OMX session evidence, not the last merged commit, main CI run, or release receipt.";
export const OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_CLAIM_BOUNDARY =
  "Read-only issue #885 fooks-check handoff artifact; adopt live issue, PR, mapped session, or live non-main worktree evidence when present, otherwise require exactly one run-created issue, branch, or session evidence report without mutating runtime/provider behavior.";
export const OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_CLAIM_BOUNDARY =
  "Read-only issue #1062 dogfood clean epic-only nudge artifact; a queue containing only planning epic #960 after child work completed must surface a completed-child receipt requirement and cannot claim active development from the epic alone.";
export const OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_CLAIM_BOUNDARY =
  "Read-only issue #895 operator guard for legacy review/refresh worktree residue after clean merges; preserves local residue as actionable cleanup-review evidence while keeping current active anchors limited to live issue, PR, branch, tmux, or proc evidence.";
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_ISSUE = "#720";
export const OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_ISSUE = "#1016";
export const OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_CLAIM_BOUNDARY =
  "Bounded local/static active-work receipt for fooks session-whip handling; aggregate issue/PR counts are not per-artifact identity, stale sibling worktree receipts are adoption classifiers only, and report lines omit paths and cleanup commands.";
export const OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_CLAIM_BOUNDARY =
  "Read-only compact receipt for the current session-whip/operator-check run; summarizes existing created/adopted issue, branch, session, PR, and worktree evidence from the current operator-check snapshot only, preserves empty/no-op shape, and never creates, deletes, fetches, pushes, comments, opens PRs/issues, changes tmux, or mutates worktrees during receipt rendering.";

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

export type OperatorCheckLegacyReviewResidueCleanupReviewGuard = {
  schemaVersion: typeof OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_ISSUE_URL;
  source: typeof OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_CLAIM_BOUNDARY;
  readOnly: true;
  cleanupReviewEvidence: {
    legacyReviewWorktreeResidueCount: number;
    legacyLocalResidueCleanupReviewRowCount: number;
    classification: "operator-cleanup-review-evidence";
    actionableOperatorResidue: true;
  };
  currentActiveAnchorEvidence: {
    openIssueCount?: number;
    openPullRequestCount?: number;
    mappedFooksTmuxProcSessionCount: number;
    activeArtifactReceiptCount: number;
    activeAnchorPresent: boolean;
  };
  auditProvenanceBoundary: {
    command: typeof STALE_WORKTREE_AUDIT_COMMAND;
    linkedIssue: typeof STALE_WORKTREE_AUDIT_ISSUE;
    triageLinkedIssue: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE;
    staleReviewCandidatesZeroMeansNoActiveAnchor: false;
    entriesKeepRootMeansCurrentActiveWork: false;
  };
  residueSatisfiesActiveAnchorRequirement: false;
  cleanupReviewEvidenceIsActiveWork: false;
  nudgeRediscoveryRule: string;
};

export type OperatorCheckPostReceiptNudgeAnchorBoundary = {
  schemaVersion: typeof OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_ISSUE_URL;
  source: typeof OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_CLAIM_BOUNDARY;
  readOnly: true;
  closedLegacyWorktreeBucketReceipt: {
    issue: "#866";
    activeDevelopmentEvidence: false;
  };
  mainCiReleaseSuccessReceipt: {
    allExactHeadConclusionsSuccessful: boolean;
    activeDevelopmentEvidence: false;
  };
  currentAnchorEvidence: {
    openIssueCount?: number;
    openPullRequestCount?: number;
    nonMainBranch?: string;
    mappedFooksTmuxSessionCount: number;
    concreteBlockerCount: number;
  };
  requiresFreshPostReceiptNudgeAnchor: boolean;
  acceptableFreshAnchors: [
    "new issue",
    "non-main branch",
    "mapped fooks tmux session",
    "open pull request",
    "concrete blocker",
  ];
  nudgeRule: string;
};

export type OperatorCheckReceiptOnlyNudgeLoopBoundary = {
  schemaVersion: typeof OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_ISSUE_URL;
  source: typeof OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_CLAIM_BOUNDARY;
  readOnly: true;
  priorReceipt: {
    pullRequest: "#868";
    lastMergedCommitOrMainCiRunIsActiveDevelopmentEvidence: false;
  };
  currentRequiredEvidence: {
    newlyCreatedOrAdoptedIssueCount?: number;
    mappedOmxSessionCount: number;
  };
  requiresIssueAndOmxSessionEvidence: boolean;
  satisfiesNudgeReportAnchorRequirement: boolean;
  repeatedReceiptOnlyReportAllowed: false;
  requiredReportEvidence: [
    "newly created/adopted issue evidence",
    "mapped OMX session evidence",
  ];
  prohibitedReportAnchors: [
    "last merged commit",
    "main CI run",
    "release receipt",
  ];
  nudgeRule: string;
};

export type OperatorCheckHandoffArtifactEvidence = {
  schemaVersion: typeof OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_ISSUE_URL;
  source: typeof OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_CLAIM_BOUNDARY;
  readOnly: true;
  handoffRule: "adopt-live-artifact-else-create-exactly-one";
  adoptableLiveArtifacts: [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
    "live non-main worktree",
  ];
  currentEvidence: {
    openIssueCount?: number;
    openPullRequestCount?: number;
    mappedFooksTmuxSessionCount: number;
    liveMappedFooksTmuxSessionCount: number;
    liveNonMainWorktreePresent: boolean;
    activeReceiptCount: number;
  };
  adoptedLiveArtifactPresent: boolean;
  runCreatedArtifactRequirement: {
    required: boolean;
    exactlyOne: true;
    allowedArtifactKinds: ["issue", "branch", "session"];
    concreteEvidenceRequired: [
      "artifact kind",
      "artifact identifier",
      "creation/adoption source",
      "worktree delta/ahead/proc evidence",
    ];
  };
  satisfiesHandoffRule: boolean;
  nextReportRule: string;
};

export type OperatorCheckCompletedChildReceiptBoundary = {
  schemaVersion: typeof OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_ISSUE;
  issueUrl: typeof OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_ISSUE_URL;
  source: typeof OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_CLAIM_BOUNDARY;
  readOnly: true;
  classification: "completed-child-receipt-missing" | "not-clean-epic-only-nudge";
  currentEvidence: {
    clean: boolean | null;
    branch?: string;
    ahead?: number;
    behind?: number;
    openIssueNumbers?: number[];
    openPullRequestCount?: number;
    mappedFooksTmuxSessionCount: number;
  };
  completedChildReceipt: {
    required: boolean;
    present: false;
    acceptedEvidence: [
      "completed child issue receipt",
      "merged child pull request receipt",
      "operator closeout receipt naming the completed child",
    ];
  };
  activeDevelopmentAllowedFromEpicOnlyQueue: false;
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
  legacyReviewResidueCleanupReviewGuard: OperatorCheckLegacyReviewResidueCleanupReviewGuard;
  postReceiptNudgeAnchorBoundary: OperatorCheckPostReceiptNudgeAnchorBoundary;
  receiptOnlyNudgeLoopBoundary: OperatorCheckReceiptOnlyNudgeLoopBoundary;
  handoffArtifactEvidence: OperatorCheckHandoffArtifactEvidence;
  completedChildReceiptBoundary: OperatorCheckCompletedChildReceiptBoundary;
  currentRunReceipt: OperatorActivitySnapshot["currentRunEvidence"]["receipt"];
  sessionWhipRunReceipt: OperatorCheckSessionWhipRunReceipt;
  blockers: string[];
};


export type OperatorCheckSessionWhipRunReceiptEvidenceItem = {
  kind: OperatorCheckActiveWorkReceiptKind;
  disposition: "created-or-adopted" | "adopted" | "mapped" | "present" | "stale-or-review-only";
  classification: OperatorCheckActiveWorkReceiptClassification;
  label: string;
  count?: number;
  source: string;
  reasons: string[];
};

export type OperatorCheckSessionWhipRunReceipt = {
  schemaVersion: typeof OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_ISSUE;
  source: typeof OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_CLAIM_BOUNDARY;
  readOnly: true;
  status: "active" | "idle" | "blocked";
  classification: OperatorCheckActiveWorkReceiptClassification;
  oneLine: string;
  noOp: {
    empty: boolean;
    reason: string;
  };
  counts: {
    createdOrAdoptedIssues: number;
    adoptedPullRequests: number;
    adoptedBranches: number;
    mappedSessions: number;
    adoptedWorktrees: number;
    staleOrReviewOnly: number;
    mainEchoes: number;
    blockers: number;
  };
  evidence: {
    issues: OperatorCheckSessionWhipRunReceiptEvidenceItem[];
    pullRequests: OperatorCheckSessionWhipRunReceiptEvidenceItem[];
    branches: OperatorCheckSessionWhipRunReceiptEvidenceItem[];
    sessions: OperatorCheckSessionWhipRunReceiptEvidenceItem[];
    worktrees: OperatorCheckSessionWhipRunReceiptEvidenceItem[];
  };
  mutationBoundary: {
    createsIssues: false;
    createsBranches: false;
    createsSessions: false;
    createsPullRequests: false;
    mutatesTmux: false;
    mutatesWorktrees: false;
    mutatesGitHub: false;
  };
};

export type OperatorCheckRuntimeProvenance = {
  schemaVersion: typeof OPERATOR_CHECK_PROVENANCE_SCHEMA_VERSION;
  source: "operator/check runtime provenance";
  claimBoundary: "Runtime provenance is diagnostic only; it distinguishes the executing entrypoint/build artifact from current source files and does not prove functional freshness by itself.";
  package: {
    status: "known" | "unknown";
    name?: string;
    version?: string;
    packageJsonPath?: string;
    reason?: string;
  };
  git: {
    scope: "invocation-cwd";
    cwd: string;
    head?: string;
    headStatus: "known" | "unknown";
    branch?: string;
    branchStatus: "known" | "unknown";
    source: "local git refs only for invocation cwd; no fetch performed";
    blockers: string[];
  };
  runtime: {
    node: string;
    platform: NodeJS.Platform;
    arch: string;
    argv1?: string;
    argv1Status: "known" | "unknown";
    cwd: string;
  };
  artifacts: {
    operatorCheckModulePath: string;
    operatorCheckModuleRealPath?: string;
    operatorCheckModuleMtimeMs?: number;
    cliEntrypointPath?: string;
    cliEntrypointRealPath?: string;
    cliEntrypointStatus: "known" | "unknown";
    cliEntrypointMtimeMs?: number;
    sourceOperatorCheckPath?: string;
    sourceOperatorCheckMtimeMs?: number;
    sourceNewerThanOperatorCheckModule?: boolean;
    freshnessStatus: "known" | "unknown";
    freshnessReason?: string;
    executionKind: "built-dist" | "source-or-non-dist" | "unknown";
    executionKindStatus: "known" | "unknown";
  };
};

export type OperatorCheckTimingPhase = {
  name: string;
  elapsedMs: number;
  status: "ok" | "skipped" | "unavailable";
};

export type OperatorCheckTimingReceipt = {
  schemaVersion: typeof OPERATOR_CHECK_TIMING_SCHEMA_VERSION;
  source: typeof OPERATOR_CHECK_TIMING_SOURCE;
  status: "diagnostic";
  claimBoundary: typeof OPERATOR_CHECK_TIMING_CLAIM_BOUNDARY;
  readOnly: true;
  totalMs: number;
  phases: OperatorCheckTimingPhase[];
};

export type OperatorCheckSnapshot = {
  schemaVersion: typeof OPERATOR_CHECK_SCHEMA_VERSION;
  command: typeof OPERATOR_CHECK_COMMAND;
  generatedAt: string;
  cwd: string;
  claimBoundary: typeof OPERATOR_CHECK_CLAIM_BOUNDARY;
  readOnly: true;
  source: typeof OPERATOR_CHECK_SOURCE;
  runtimeProvenance: OperatorCheckRuntimeProvenance;
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
  currentRunReceipt: OperatorActivitySnapshot["currentRunEvidence"]["receipt"];
  sessionWhipRunReceipt: OperatorCheckSessionWhipRunReceipt;
  requiredActiveArtifact: OperatorCheckRequiredActiveArtifact;
  contextTrust: OperatorContextTrustPacket;
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  sequentialPlanningHints: SequentialPlanningHint[];
  planBeforeExecuteGuards: PlanBeforeExecuteGuard[];
  longRunBudgetWarnings: LongRunBudgetWarning[];
  resetCompactHandoffRecommendations: ResetCompactHandoffRecommendation[];
  reliabilityWarningVisibility: OperatorCheckReliabilityWarningVisibility;
  resumeHandoffProjection: OperatorCheckResumeHandoffProjection;
  activity: OperatorActivitySnapshot;
  blockers: string[];
  diagnostics: {
    operatorCheckTiming: OperatorCheckTimingReceipt;
  };
};

export type OperatorCheckReliabilityWarningVisibility = {
  schemaVersion: typeof OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SCHEMA_VERSION;
  source: typeof OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SOURCE;
  status: "clear" | "advisory";
  summary: {
    existingWarningCount: number;
    planningWarningCount: number;
    combinedReliabilityWarningCount: number;
    sequentialPlanningHintCount: number;
    longRunBudgetWarningCount: number;
    resetCompactHandoffRecommendationCount: number;
    contextTrustCurrentAuthorityCount: number;
    contextTrustNonAuthorizingCount: number;
    contextTrustHistoricalOnlyCount: number;
  };
  warnings: Array<
    | {
        kind: "runtime-planning";
        issue: RuntimeTokenCostPlanningWarning["issue"];
        trigger: RuntimeTokenCostPlanningWarning["trigger"];
        status: RuntimeTokenCostPlanningWarning["status"];
        message: RuntimeTokenCostPlanningWarning["message"];
        requiredRechecks: RuntimeTokenCostPlanningWarning["requiredRechecks"];
        forbiddenClaims: RuntimeTokenCostPlanningWarning["forbiddenClaims"];
        claimBoundary: RuntimeTokenCostPlanningWarning["claimBoundary"];
      }
    | {
        kind: "sequential-planning";
        issue: SequentialPlanningHint["issue"];
        trigger: SequentialPlanningHint["trigger"];
        status: SequentialPlanningHint["status"];
        message: SequentialPlanningHint["message"];
        recommendations: SequentialPlanningHint["recommendations"];
        requiredRechecks: SequentialPlanningHint["requiredRechecks"];
        forbiddenClaims: SequentialPlanningHint["forbiddenClaims"];
        claimBoundary: SequentialPlanningHint["claimBoundary"];
      }
    | {
        kind: "combined-reliability";
        trigger: CombinedReliabilityWarning["trigger"];
        status: CombinedReliabilityWarning["status"];
        message: CombinedReliabilityWarning["message"];
        recommendedActions: CombinedReliabilityWarning["recommendedActions"];
        requiredRechecks: CombinedReliabilityWarning["requiredRechecks"];
        forbiddenClaims: CombinedReliabilityWarning["forbiddenClaims"];
        claimBoundary: CombinedReliabilityWarning["claimBoundary"];
      }
    | {
        kind: "long-run-budget";
        issue: LongRunBudgetWarning["issue"];
        trigger: LongRunBudgetWarning["trigger"];
        status: LongRunBudgetWarning["status"];
        riskLevel: LongRunBudgetWarning["riskLevel"];
        budgetBoundary: LongRunBudgetWarning["budgetBoundary"];
        message: LongRunBudgetWarning["message"];
        recommendedActions: LongRunBudgetWarning["recommendedActions"];
        requiredRechecks: LongRunBudgetWarning["requiredRechecks"];
        forbiddenClaims: LongRunBudgetWarning["forbiddenClaims"];
        claimBoundary: LongRunBudgetWarning["claimBoundary"];
      }
    | {
        kind: "reset-compact-handoff";
        issue: ResetCompactHandoffRecommendation["issue"];
        trigger: ResetCompactHandoffRecommendation["trigger"];
        status: ResetCompactHandoffRecommendation["status"];
        riskLevel: ResetCompactHandoffRecommendation["riskLevel"];
        message: ResetCompactHandoffRecommendation["message"];
        recommendedActions: ResetCompactHandoffRecommendation["recommendedActions"];
        requiredRechecks: ResetCompactHandoffRecommendation["requiredRechecks"];
        forbiddenClaims: ResetCompactHandoffRecommendation["forbiddenClaims"];
        claimBoundary: ResetCompactHandoffRecommendation["claimBoundary"];
      }
  >;
  derivedFrom: {
    contextTrustSource: OperatorContextTrustPacket["source"];
    planningWarningsField: "planningWarnings";
    sequentialPlanningHintsField: "sequentialPlanningHints";
    combinedReliabilityWarningsField: "combinedReliabilityWarnings";
    longRunBudgetWarningsField: "longRunBudgetWarnings";
    resetCompactHandoffRecommendationsField: "resetCompactHandoffRecommendations";
  };
  claimBoundary: typeof OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_CLAIM_BOUNDARY;
};

export type OperatorCheckResumeHandoffProjection = {
  schemaVersion: typeof OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SCHEMA_VERSION;
  issue: typeof OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_ISSUE;
  status: "advisory";
  compact: true;
  readOnly: true;
  source: typeof OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SOURCE;
  claimBoundary: typeof OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_CLAIM_BOUNDARY;
  derivedFrom: {
    operatorCheckCommand: typeof OPERATOR_CHECK_COMMAND;
    operatorCheckSchemaVersion: typeof OPERATOR_CHECK_SCHEMA_VERSION;
    contextTrustSchemaVersion: OperatorContextTrustPacket["schemaVersion"];
    contextTrustSource: OperatorContextTrustPacket["source"];
    fields: [
      "contextTrust.sourceOfTruth.current",
      "contextTrust.nonAuthorizing",
      "contextTrust.historicalOnly",
      "planningWarnings",
      "combinedReliabilityWarnings",
      "sequentialPlanningHints",
      "planBeforeExecuteGuards",
      "longRunBudgetWarnings",
      "resetCompactHandoffRecommendations",
      "reliabilityWarningVisibility",
    ];
  };
  summary: {
    currentAuthorityCount: number;
    staleOrHistoricalBoundaryCount: number;
    planningWarningCount: number;
    combinedReliabilityWarningCount: number;
    sequentialPlanningHintCount: number;
    planBeforeExecuteGuardCount: number;
    longRunBudgetWarningCount: number;
    resetCompactHandoffRecommendationCount: number;
    reliabilityWarningCount: number;
    stopBeforeMoreExecution: boolean;
  };
  currentAuthority: {
    status: "present" | "missing";
    entries: OperatorContextTrustEntry[];
    entryLimit: number;
    omittedCount: number;
  };
  staleHistoricalBoundary: {
    status: "clear" | "present";
    entries: OperatorContextTrustEntry[];
    entryLimit: number;
    omittedCount: number;
    instruction: string;
  };
  nextSessionAdvisory: {
    action: "recheck-current-authority" | "stop-before-more-execution";
    rationale: string;
    requiredRechecks: string[];
  };
  forbiddenClaims: string[];
};



function roundDiagnosticMs(value: number): number {
  return Number(value.toFixed(2));
}

function timeDiagnosticPhase<T>(
  phases: OperatorCheckTimingPhase[],
  name: string,
  callback: () => T,
): T {
  const startedAt = performance.now();
  try {
    const value = callback();
    phases.push({ name, elapsedMs: roundDiagnosticMs(performance.now() - startedAt), status: "ok" });
    return value;
  } catch (error) {
    phases.push({ name, elapsedMs: roundDiagnosticMs(performance.now() - startedAt), status: "unavailable" });
    throw error;
  }
}

function buildOperatorCheckTimingReceipt(phases: OperatorCheckTimingPhase[], totalMs: number): OperatorCheckTimingReceipt {
  return {
    schemaVersion: OPERATOR_CHECK_TIMING_SCHEMA_VERSION,
    source: OPERATOR_CHECK_TIMING_SOURCE,
    status: "diagnostic",
    claimBoundary: OPERATOR_CHECK_TIMING_CLAIM_BOUNDARY,
    readOnly: true,
    totalMs: roundDiagnosticMs(totalMs),
    phases: phases.map((phase) => ({ ...phase })),
  };
}

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

type OperatorCheckPackageJson = {
  name?: string;
  version?: string;
  bin?: string | Record<string, string>;
};

function readJsonFile(filePath: string): OperatorCheckPackageJson | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as OperatorCheckPackageJson;
  } catch {
    return undefined;
  }
}

function fileMtimeMs(filePath: string | undefined): number | undefined {
  if (!filePath) return undefined;
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return undefined;
  }
}

function realPathIfExists(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return undefined;
  }
}

function firstExistingAncestorPackageJson(startPath: string): string | undefined {
  let current = path.dirname(path.resolve(startPath));
  while (true) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function packageBinPath(packageJson: OperatorCheckPackageJson | undefined): string | undefined {
  if (!packageJson?.bin) return undefined;
  return typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin.fooks;
}

function packageOwnsCliArtifact(packageJson: OperatorCheckPackageJson | undefined, packageJsonPath: string | undefined, cliEntrypointPath: string | undefined): boolean {
  if (!packageJson || packageJson.name !== "fxxk-frontend-hooks") return false;
  if (!packageJsonPath || !cliEntrypointPath) return false;
  const binPath = packageBinPath(packageJson);
  if (!binPath) return false;
  const expectedCliPath = path.resolve(path.dirname(packageJsonPath), binPath);
  return path.normalize(expectedCliPath) === path.normalize(cliEntrypointPath);
}

function readGitField(cwd: string, args: string[]): { value?: string; blocker?: string } {
  try {
    return {
      value: execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        timeout: 1000,
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }).trim() || undefined,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { blocker: `git ${args.join(" ")} unavailable: ${detail}` };
  }
}

function readOperatorCheckRuntimeProvenance(cwd: string): OperatorCheckRuntimeProvenance {
  const modulePath = __filename;
  const moduleRealPath = realPathIfExists(modulePath);
  const cliEntrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
  const cliEntrypointRealPath = realPathIfExists(cliEntrypointPath);
  const packageSearchStart = cliEntrypointRealPath ?? moduleRealPath ?? cliEntrypointPath ?? modulePath;
  const candidatePackageJsonPath = firstExistingAncestorPackageJson(packageSearchStart);
  const candidatePackageJson = candidatePackageJsonPath ? readJsonFile(candidatePackageJsonPath) : undefined;
  const packageIsOwned = packageOwnsCliArtifact(candidatePackageJson, candidatePackageJsonPath, cliEntrypointRealPath ?? cliEntrypointPath);
  const packageJsonPath = packageIsOwned ? candidatePackageJsonPath : undefined;
  const packageJson = packageIsOwned ? candidatePackageJson : undefined;
  const repoRoot = packageJsonPath ? path.dirname(packageJsonPath) : undefined;
  const sourceOperatorCheckPath = repoRoot ? path.join(repoRoot, "src", "ops", "operator-check.ts") : undefined;
  const operatorCheckModuleMtimeMs = fileMtimeMs(moduleRealPath ?? modulePath);
  const sourceOperatorCheckMtimeMs = fileMtimeMs(sourceOperatorCheckPath);
  const sourceNewerThanOperatorCheckModule = sourceOperatorCheckMtimeMs !== undefined && operatorCheckModuleMtimeMs !== undefined
    ? sourceOperatorCheckMtimeMs > operatorCheckModuleMtimeMs
    : undefined;
  const head = readGitField(cwd, ["rev-parse", "HEAD"]);
  const branch = readGitField(cwd, ["branch", "--show-current"]);
  const blockers = [head.blocker, branch.blocker].filter((item): item is string => Boolean(item));
  const normalizedModulePath = path.normalize(moduleRealPath ?? modulePath);
  const executionKind = normalizedModulePath.includes(`${path.sep}dist${path.sep}`)
    ? "built-dist"
    : normalizedModulePath.includes(`${path.sep}src${path.sep}`)
      ? "source-or-non-dist"
      : "unknown";
  const freshnessReason = sourceNewerThanOperatorCheckModule === undefined
    ? "source/dist freshness comparison unavailable: source or executing module mtime could not be read"
    : undefined;

  return {
    schemaVersion: OPERATOR_CHECK_PROVENANCE_SCHEMA_VERSION,
    source: "operator/check runtime provenance",
    claimBoundary:
      "Runtime provenance is diagnostic only; it distinguishes the executing entrypoint/build artifact from current source files and does not prove functional freshness by itself.",
    package: {
      status: packageJsonPath && packageJson ? "known" : "unknown",
      name: packageJson?.name,
      version: packageJson?.version,
      packageJsonPath,
      reason: packageIsOwned
        ? undefined
        : candidatePackageJsonPath
          ? candidatePackageJson
            ? "package.json ancestor does not match fooks CLI artifact ownership"
            : "package.json could not be parsed"
          : "package.json ancestor not found from invoked CLI/module artifact",
    },
    git: {
      scope: "invocation-cwd",
      cwd,
      head: head.value,
      headStatus: head.value ? "known" : "unknown",
      branch: branch.value,
      branchStatus: branch.value ? "known" : "unknown",
      source: "local git refs only for invocation cwd; no fetch performed",
      blockers,
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      argv1: cliEntrypointPath,
      argv1Status: cliEntrypointPath ? "known" : "unknown",
      cwd,
    },
    artifacts: {
      operatorCheckModulePath: modulePath,
      operatorCheckModuleRealPath: moduleRealPath,
      operatorCheckModuleMtimeMs,
      cliEntrypointPath,
      cliEntrypointRealPath,
      cliEntrypointStatus: cliEntrypointPath ? "known" : "unknown",
      cliEntrypointMtimeMs: fileMtimeMs(cliEntrypointRealPath ?? cliEntrypointPath),
      sourceOperatorCheckPath,
      sourceOperatorCheckMtimeMs,
      sourceNewerThanOperatorCheckModule,
      freshnessStatus: sourceNewerThanOperatorCheckModule === undefined ? "unknown" : "known",
      freshnessReason,
      executionKind,
      executionKindStatus: executionKind === "unknown" ? "unknown" : "known",
    },
  };
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

function checkProjectionBlockers(blockers: string[]): string[] {
  return blockers.filter((blocker) => !isTmuxActivityNoServerBlocker(blocker));
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
  timingPhases?: OperatorCheckTimingPhase[],
): {
  receipts: OperatorCheckActiveWorkReceipt[];
  salvageReviewQueue: OperatorCheckSalvageReviewQueue;
  staleResidueLedger: OperatorCheckStaleResidueLedger;
  cleanupReviewManifest: OperatorCheckStaleResidueCleanupReviewManifest;
  blockers: string[];
} {
  try {
    const triage = timingPhases
      ? timeDiagnosticPhase(timingPhases, "build-active-work-receipts:sibling-worktree-triage", () =>
        triageOrphanLocalWorktrees(cwd, {
          runner: options.commandRunner
            ? (command, args, runnerCwd) => options.commandRunner?.(command, args, runnerCwd, 3000) ?? ""
            : undefined,
          pathExists: options.pathExists,
          now: options.now,
        }),
      )
      : triageOrphanLocalWorktrees(cwd, {
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

function buildLegacyReviewResidueCleanupReviewGuard(
  activity: OperatorActivitySnapshot,
  legacyLocalResidueCleanupReviewRowCount: number,
  activeArtifactReceiptCount: number,
): OperatorCheckLegacyReviewResidueCleanupReviewGuard {
  const openIssueCount = activity.currentRunEvidence.evidence.openIssues;
  const openPullRequestCount = activity.currentRunEvidence.evidence.openPullRequests;
  const mappedFooksTmuxProcSessionCount = activity.currentRunEvidence.evidence.fooksSessionCount;
  const activeAnchorPresent = activeArtifactReceiptCount > 0
    || (typeof openIssueCount === "number" && openIssueCount > 0)
    || (typeof openPullRequestCount === "number" && openPullRequestCount > 0)
    || mappedFooksTmuxProcSessionCount > 0
    || Boolean(activity.worktree.branch && activity.worktree.branch !== "main");

  return {
    schemaVersion: OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_ISSUE,
    issueUrl: OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_ISSUE_URL,
    source: OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_SOURCE,
    claimBoundary: OPERATOR_CHECK_LEGACY_REVIEW_RESIDUE_CLEANUP_REVIEW_GUARD_CLAIM_BOUNDARY,
    readOnly: true,
    cleanupReviewEvidence: {
      legacyReviewWorktreeResidueCount: activity.legacyWorktreeEvidence.staleClosedArtifactWorktreeCount,
      legacyLocalResidueCleanupReviewRowCount,
      classification: "operator-cleanup-review-evidence",
      actionableOperatorResidue: true,
    },
    currentActiveAnchorEvidence: {
      openIssueCount,
      openPullRequestCount,
      mappedFooksTmuxProcSessionCount,
      activeArtifactReceiptCount,
      activeAnchorPresent,
    },
    auditProvenanceBoundary: {
      command: STALE_WORKTREE_AUDIT_COMMAND,
      linkedIssue: STALE_WORKTREE_AUDIT_ISSUE,
      triageLinkedIssue: ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE,
      staleReviewCandidatesZeroMeansNoActiveAnchor: false,
      entriesKeepRootMeansCurrentActiveWork: false,
    },
    residueSatisfiesActiveAnchorRequirement: false,
    cleanupReviewEvidenceIsActiveWork: false,
    nudgeRediscoveryRule: activeAnchorPresent
      ? "Legacy review/refresh worktree residue remains cleanup-review evidence; report active work from the separate live anchor evidence already present."
      : "Legacy review/refresh worktree residue remains actionable cleanup-review evidence, but with open PR/issue/tmux/proc anchors at zero it must not be rediscovered as current active work; name a distinct live issue, branch, session, PR, proc target, or concrete blocker before claiming active development.",
  };
}

function buildPostReceiptNudgeAnchorBoundary(
  activity: OperatorActivitySnapshot,
): OperatorCheckPostReceiptNudgeAnchorBoundary {
  const nonMainBranch = activity.worktree.branch && activity.worktree.branch !== "main" ? activity.worktree.branch : undefined;
  const concreteBlockerCount = uniqueSorted([
    ...activity.blockers,
    ...activity.currentRunEvidence.blockers,
    ...(activity.optionalCounts.enabled ? activity.optionalCounts.blockers : []),
    ...activity.postMergeMainCiEvidence.blockers,
  ]).length;
  const hasFreshAnchor = Boolean(nonMainBranch)
    || (typeof activity.currentRunEvidence.evidence.openIssues === "number" && activity.currentRunEvidence.evidence.openIssues > 0)
    || (typeof activity.currentRunEvidence.evidence.openPullRequests === "number" && activity.currentRunEvidence.evidence.openPullRequests > 0)
    || activity.currentRunEvidence.evidence.fooksSessionCount > 0
    || concreteBlockerCount > 0;

  return {
    schemaVersion: OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_ISSUE,
    issueUrl: OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_ISSUE_URL,
    source: OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_SOURCE,
    claimBoundary: OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_CLAIM_BOUNDARY,
    readOnly: true,
    closedLegacyWorktreeBucketReceipt: {
      issue: "#866",
      activeDevelopmentEvidence: false,
    },
    mainCiReleaseSuccessReceipt: {
      allExactHeadConclusionsSuccessful: activity.postMergeMainCiEvidence.summary.allExactHeadConclusionsSuccessful,
      activeDevelopmentEvidence: false,
    },
    currentAnchorEvidence: {
      openIssueCount: activity.currentRunEvidence.evidence.openIssues,
      openPullRequestCount: activity.currentRunEvidence.evidence.openPullRequests,
      nonMainBranch,
      mappedFooksTmuxSessionCount: activity.currentRunEvidence.evidence.fooksSessionCount,
      concreteBlockerCount,
    },
    requiresFreshPostReceiptNudgeAnchor: !hasFreshAnchor,
    acceptableFreshAnchors: [
      "new issue",
      "non-main branch",
      "mapped fooks tmux session",
      "open pull request",
      "concrete blocker",
    ],
    nudgeRule: hasFreshAnchor
      ? "A post-receipt nudge must name the fresh issue, branch, session, PR anchor, or concrete blocker already visible in current evidence; #866 main CI/release success remains a receipt only."
      : "After the #866 receipt, the next fooks nudge must name a fresh issue, branch, session, PR anchor, or a concrete blocker; main CI/release success is receipt-only and not active development.",
  };
}

function buildReceiptOnlyNudgeLoopBoundary(
  activity: OperatorActivitySnapshot,
): OperatorCheckReceiptOnlyNudgeLoopBoundary {
  const issueCount = activity.currentRunEvidence.evidence.openIssues;
  const mappedOmxSessionCount = activity.currentRunEvidence.evidence.fooksSessionCount;
  const hasIssueEvidence = typeof issueCount === "number" && issueCount > 0;
  const hasMappedOmxSessionEvidence = mappedOmxSessionCount > 0;
  const satisfiesNudgeReportAnchorRequirement = hasIssueEvidence && hasMappedOmxSessionEvidence;

  return {
    schemaVersion: OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_ISSUE,
    issueUrl: OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_ISSUE_URL,
    source: OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_SOURCE,
    claimBoundary: OPERATOR_CHECK_RECEIPT_ONLY_NUDGE_LOOP_BOUNDARY_CLAIM_BOUNDARY,
    readOnly: true,
    priorReceipt: {
      pullRequest: "#868",
      lastMergedCommitOrMainCiRunIsActiveDevelopmentEvidence: false,
    },
    currentRequiredEvidence: {
      newlyCreatedOrAdoptedIssueCount: issueCount,
      mappedOmxSessionCount,
    },
    requiresIssueAndOmxSessionEvidence: !satisfiesNudgeReportAnchorRequirement,
    satisfiesNudgeReportAnchorRequirement,
    repeatedReceiptOnlyReportAllowed: false,
    requiredReportEvidence: [
      "newly created/adopted issue evidence",
      "mapped OMX session evidence",
    ],
    prohibitedReportAnchors: [
      "last merged commit",
      "main CI run",
      "release receipt",
    ],
    nudgeRule: satisfiesNudgeReportAnchorRequirement
      ? "The next dogfood nudge report may proceed only by naming the newly created/adopted issue evidence and mapped OMX session evidence; the PR #868 merged commit and main CI run remain receipts only."
      : "After the PR #868 receipt-only closeout, do not repeat a receipt-only nudge report; name newly created/adopted issue evidence plus mapped OMX session evidence before reporting active development, and do not use the last merged commit or main CI run as the anchor.",
  };
}

function buildCompletedChildReceiptBoundary(
  activity: OperatorActivitySnapshot,
): OperatorCheckCompletedChildReceiptBoundary {
  const cleanEpicOnlyNudge =
    activity.currentRunEvidence.mainEchoEvidence && hasOnlyPlanningEpicOpenIssue(activity.optionalCounts);
  const classification = cleanEpicOnlyNudge ? "completed-child-receipt-missing" : "not-clean-epic-only-nudge";

  return {
    schemaVersion: OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_ISSUE,
    issueUrl: OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_ISSUE_URL,
    source: OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_SOURCE,
    claimBoundary: OPERATOR_CHECK_COMPLETED_CHILD_RECEIPT_BOUNDARY_CLAIM_BOUNDARY,
    readOnly: true,
    classification,
    currentEvidence: {
      clean: activity.worktree.clean,
      branch: activity.worktree.branch,
      ahead: activity.worktree.ahead,
      behind: activity.worktree.behind,
      openIssueNumbers: activity.optionalCounts.enabled
        ? activity.optionalCounts.openIssueNumbers
        : undefined,
      openPullRequestCount: activity.currentRunEvidence.evidence.openPullRequests,
      mappedFooksTmuxSessionCount: activity.currentRunEvidence.evidence.fooksSessionCount,
    },
    completedChildReceipt: {
      required: cleanEpicOnlyNudge,
      present: false,
      acceptedEvidence: [
        "completed child issue receipt",
        "merged child pull request receipt",
        "operator closeout receipt naming the completed child",
      ],
    },
    activeDevelopmentAllowedFromEpicOnlyQueue: false,
    nudgeRule: cleanEpicOnlyNudge
      ? "A clean nudge with only planning epic #960 open is missing the completed-child receipt required after child work completes; name that receipt plus a concrete child/session artifact before reporting active development."
      : "The completed-child receipt requirement is only evaluated for clean epic-only nudges; active development still requires a concrete issue, PR, branch, session, worktree, process, or blocker outside the epic-only queue.",
  };
}

function buildHandoffArtifactEvidence(
  activity: OperatorActivitySnapshot,
  receipts: OperatorCheckActiveWorkReceipt[],
): OperatorCheckHandoffArtifactEvidence {
  const openIssueCount = activity.currentRunEvidence.evidence.openIssues;
  const openPullRequestCount = activity.currentRunEvidence.evidence.openPullRequests;
  const mappedFooksTmuxSessionCount = activity.currentRunEvidence.evidence.fooksSessionCount;
  const liveMappedFooksTmuxSessionCount = activity.tmux.sessions.filter((session) =>
    session.status !== "staleRuntimeCandidate" && session.status !== "stagedPromptOnly" && session.status !== "ancestorMaintenance"
  ).length;
  const liveNonMainWorktreePresent = Boolean(activity.worktree.branch && activity.worktree.branch !== "main");
  const activeReceiptCount = receipts.filter((receipt) => receipt.classification === "active").length;
  const adoptedLiveArtifactPresent = Boolean(
    (typeof openIssueCount === "number" && openIssueCount > 0)
    || (typeof openPullRequestCount === "number" && openPullRequestCount > 0)
    || liveMappedFooksTmuxSessionCount > 0
    || liveNonMainWorktreePresent,
  );

  return {
    schemaVersion: OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_ISSUE,
    issueUrl: OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_ISSUE_URL,
    source: OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_SOURCE,
    claimBoundary: OPERATOR_CHECK_HANDOFF_ARTIFACT_EVIDENCE_CLAIM_BOUNDARY,
    readOnly: true,
    handoffRule: "adopt-live-artifact-else-create-exactly-one",
    adoptableLiveArtifacts: [
      "open GitHub issue",
      "open GitHub pull request",
      "mapped fooks tmux session",
      "live non-main worktree",
    ],
    currentEvidence: {
      openIssueCount,
      openPullRequestCount,
      mappedFooksTmuxSessionCount,
      liveMappedFooksTmuxSessionCount,
      liveNonMainWorktreePresent,
      activeReceiptCount,
    },
    adoptedLiveArtifactPresent,
    runCreatedArtifactRequirement: {
      required: !adoptedLiveArtifactPresent,
      exactlyOne: true,
      allowedArtifactKinds: ["issue", "branch", "session"],
      concreteEvidenceRequired: [
        "artifact kind",
        "artifact identifier",
        "creation/adoption source",
        "worktree delta/ahead/proc evidence",
      ],
    },
    satisfiesHandoffRule: adoptedLiveArtifactPresent,
    nextReportRule: adoptedLiveArtifactPresent
      ? "Adopt the live issue, PR, mapped fooks tmux session, or live non-main worktree already present in this #885 fooks-check handoff report; report its concrete evidence instead of creating another artifact. This nested #885 handoff report is separate from the top-level requiredActiveArtifact issue/PR/session contract."
      : "No live PR/issue/session/worktree is present in this #885 fooks-check handoff report; create exactly one issue, branch, or session for this run, then report concrete run-created artifact evidence with delta/ahead/proc evidence before claiming active work. This nested #885 handoff report is separate from the top-level requiredActiveArtifact issue/PR/session contract.",
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
  timingPhases?: OperatorCheckTimingPhase[],
): OperatorCheckActiveWorkReceipts {
  const repoIdentity = timingPhases
    ? timeDiagnosticPhase(timingPhases, "build-active-work-receipts:repo-identity", () =>
      readRepoIdentifier(cwd, options),
    )
    : readRepoIdentifier(cwd, options);
  const baseIdentifiers = timingPhases
    ? timeDiagnosticPhase(timingPhases, "build-active-work-receipts:base-identifiers", () =>
      baseReceiptIdentifiers(activity, repoIdentity.repo, repoIdentity.blockers),
    )
    : baseReceiptIdentifiers(activity, repoIdentity.repo, repoIdentity.blockers);
  const receipts: OperatorCheckActiveWorkReceipt[] = [];

  const baseBlockers = repoIdentity.blockers;
  const counts = activity.optionalCounts;
  const issueInventoryIsCleanMainAdvisoryOnly = activity.currentRunEvidence.mainEchoEvidence
    && (hasOnlyPlanningEpicOpenIssue(counts) || hasPlanningEpicPlusSingleChildOpenIssue(counts));
  if (counts.enabled && typeof counts.openIssues === "number" && counts.openIssues > 0 && !issueInventoryIsCleanMainAdvisoryOnly) {
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
    const classification: OperatorCheckActiveWorkReceiptClassification =
      session.status === "staleRuntimeCandidate" || session.status === "stagedPromptOnly" || session.status === "ancestorMaintenance" ? "closedOrStale" : "active";
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

  const siblingReceipts = siblingWorktreeReceipts(cwd, baseIdentifiers, baseBlockers, options, timingPhases);
  const legacyLocalResidueCleanupReview = timingPhases
    ? timeDiagnosticPhase(timingPhases, "build-active-work-receipts:legacy-local-residue-cleanup-review", () =>
      buildLegacyLocalResidueCleanupReview(activity.legacyWorktreeEvidence),
    )
    : buildLegacyLocalResidueCleanupReview(activity.legacyWorktreeEvidence);
  receipts.push(...siblingReceipts.receipts);

  const blockers = checkProjectionBlockers(uniqueSorted([
    ...baseBlockers,
    ...activity.blockers,
    ...siblingReceipts.blockers,
    ...receipts.flatMap((receipt) => receipt.blockers),
  ]));
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
    legacyReviewResidueCleanupReviewGuard: buildLegacyReviewResidueCleanupReviewGuard(
      activity,
      legacyLocalResidueCleanupReview.rowCount,
      activeArtifactReceiptCount,
    ),
    postReceiptNudgeAnchorBoundary: buildPostReceiptNudgeAnchorBoundary(activity),
    receiptOnlyNudgeLoopBoundary: buildReceiptOnlyNudgeLoopBoundary(activity),
    handoffArtifactEvidence: buildHandoffArtifactEvidence(activity, receipts),
    completedChildReceiptBoundary: buildCompletedChildReceiptBoundary(activity),
    currentRunReceipt: activity.currentRunEvidence.receipt,
    sessionWhipRunReceipt: buildSessionWhipRunReceipt({
      classification,
      receipts,
      blockers,
    }),
    blockers,
  };
}


function receiptItemLabel(receipt: OperatorCheckActiveWorkReceipt): string {
  if (receipt.kind === "issue") return receipt.count === 1 ? "1 open issue" : `${receipt.count ?? 0} open issues`;
  if (receipt.kind === "pullRequest") return receipt.count === 1 ? "1 open pull request" : `${receipt.count ?? 0} open pull requests`;
  if (receipt.kind === "session") return receipt.identifiers.session?.name ?? "mapped fooks session";
  const branch = sanitizeReportToken(receipt.identifiers.worktree.branch);
  if (receipt.kind === "branch") return branch ?? (receipt.classification === "mainEcho" ? "main branch echo" : "branch evidence");
  return branch ?? "sibling worktree evidence";
}

function receiptItemDisposition(receipt: OperatorCheckActiveWorkReceipt): OperatorCheckSessionWhipRunReceiptEvidenceItem["disposition"] {
  if (receipt.classification === "closedOrStale") return "stale-or-review-only";
  if (receipt.classification === "mainEcho") return "present";
  if (receipt.kind === "issue") return "created-or-adopted";
  if (receipt.kind === "pullRequest" || receipt.kind === "branch" || receipt.kind === "worktree") return "adopted";
  return "mapped";
}

function compactReceiptItems(receipts: OperatorCheckActiveWorkReceipt[], kind: OperatorCheckActiveWorkReceiptKind): OperatorCheckSessionWhipRunReceiptEvidenceItem[] {
  return receipts
    .filter((receipt) => receipt.kind === kind)
    .map((receipt) => ({
      kind: receipt.kind,
      disposition: receiptItemDisposition(receipt),
      classification: receipt.classification,
      label: receiptItemLabel(receipt),
      count: receipt.count,
      source: receipt.source,
      reasons: receipt.reasons,
    }));
}

function buildSessionWhipRunReceipt(activeWorkReceipts: Pick<OperatorCheckActiveWorkReceipts, "receipts" | "classification" | "blockers">): OperatorCheckSessionWhipRunReceipt {
  const receipts = activeWorkReceipts.receipts;
  const issues = compactReceiptItems(receipts, "issue");
  const pullRequests = compactReceiptItems(receipts, "pullRequest");
  const branches = compactReceiptItems(receipts, "branch");
  const sessions = compactReceiptItems(receipts, "session");
  const worktrees = compactReceiptItems(receipts, "worktree");
  const activeBranches = branches.filter((item) => item.classification === "active");
  const activeWorktrees = worktrees.filter((item) => item.classification === "active");
  const activeSessions = sessions.filter((item) => item.classification === "active");
  const staleOrReviewOnly = [...branches, ...sessions, ...worktrees].filter((item) => item.classification === "closedOrStale").length;
  const mainEchoes = branches.filter((item) => item.classification === "mainEcho").length;
  const createdOrAdoptedIssues = issues
    .filter((item) => item.classification === "active")
    .reduce((sum, item) => sum + (item.count ?? 1), 0);
  const adoptedPullRequests = pullRequests
    .filter((item) => item.classification === "active")
    .reduce((sum, item) => sum + (item.count ?? 1), 0);
  const counts = {
    createdOrAdoptedIssues,
    adoptedPullRequests,
    adoptedBranches: activeBranches.length,
    mappedSessions: activeSessions.length,
    adoptedWorktrees: activeWorktrees.length,
    staleOrReviewOnly,
    mainEchoes,
    blockers: activeWorkReceipts.blockers.length,
  };
  const actionableCount = counts.createdOrAdoptedIssues + counts.adoptedPullRequests + counts.adoptedBranches + counts.mappedSessions + counts.adoptedWorktrees;
  const noOpEmpty = actionableCount === 0 && counts.blockers === 0;
  const status: OperatorCheckSessionWhipRunReceipt["status"] = counts.blockers > 0 ? "blocked" : actionableCount > 0 ? "active" : "idle";
  const summaryParts = [
    `issues=${counts.createdOrAdoptedIssues}`,
    `prs=${counts.adoptedPullRequests}`,
    `branches=${counts.adoptedBranches}`,
    `sessions=${counts.mappedSessions}`,
    `worktrees=${counts.adoptedWorktrees}`,
  ];
  if (counts.staleOrReviewOnly > 0) summaryParts.push(`staleOrReviewOnly=${counts.staleOrReviewOnly}`);
  if (counts.mainEchoes > 0) summaryParts.push(`mainEcho=${counts.mainEchoes}`);
  if (counts.blockers > 0) summaryParts.push(`blockers=${counts.blockers}`);

  return {
    schemaVersion: OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_ISSUE,
    source: OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_SOURCE,
    claimBoundary: OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_CLAIM_BOUNDARY,
    readOnly: true,
    status,
    classification: activeWorkReceipts.classification,
    oneLine: `session-whip run receipt: ${status}; ${summaryParts.join("; ")}`,
    noOp: {
      empty: noOpEmpty,
      reason: noOpEmpty
        ? "No created/adopted issue, PR, non-main branch, mapped session, or adopted worktree evidence is present in this operator-check snapshot."
        : "Current operator-check snapshot includes actionable evidence or blockers; see counts and evidence arrays.",
    },
    counts,
    evidence: {
      issues,
      pullRequests,
      branches,
      sessions,
      worktrees,
    },
    mutationBoundary: {
      createsIssues: false,
      createsBranches: false,
      createsSessions: false,
      createsPullRequests: false,
      mutatesTmux: false,
      mutatesWorktrees: false,
      mutatesGitHub: false,
    },
  };
}

function activeArtifactsFrom(activity: OperatorActivitySnapshot): OperatorCheckActiveArtifact[] {
  const artifacts: OperatorCheckActiveArtifact[] = [];
  const counts = activity.optionalCounts;
  const issueInventoryIsCleanMainAdvisoryOnly = activity.currentRunEvidence.mainEchoEvidence
    && (hasOnlyPlanningEpicOpenIssue(counts) || hasPlanningEpicPlusSingleChildOpenIssue(counts));
  if (counts.enabled && typeof counts.openIssues === "number" && counts.openIssues > 0 && !issueInventoryIsCleanMainAdvisoryOnly) {
    artifacts.push({ kind: "issue", count: counts.openIssues, source: counts.source });
  }
  if (counts.enabled && typeof counts.openPullRequests === "number" && counts.openPullRequests > 0) {
    artifacts.push({ kind: "pullRequest", count: counts.openPullRequests, source: counts.source });
  }
  const activeTmuxSessions = activity.tmux.sessions.filter((session) => session.status !== "stagedPromptOnly" && session.status !== "ancestorMaintenance");
  if (activeTmuxSessions.length > 0) {
    artifacts.push({ kind: "session", count: activeTmuxSessions.length, source: activity.tmux.command });
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

export function buildOperatorCheckReliabilityWarningVisibility(input: {
  contextTrust: OperatorContextTrustPacket;
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  sequentialPlanningHints?: SequentialPlanningHint[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  longRunBudgetWarnings: LongRunBudgetWarning[];
  resetCompactHandoffRecommendations?: ResetCompactHandoffRecommendation[];
}): OperatorCheckReliabilityWarningVisibility {
  const resetCompactHandoffRecommendations = input.resetCompactHandoffRecommendations ?? [];
  const sequentialPlanningHints = input.sequentialPlanningHints ?? [];
  const warnings: OperatorCheckReliabilityWarningVisibility["warnings"] = [
    ...input.planningWarnings.map((warning) => ({
      kind: "runtime-planning" as const,
      issue: warning.issue,
      trigger: warning.trigger,
      status: warning.status,
      message: warning.message,
      requiredRechecks: warning.requiredRechecks,
      forbiddenClaims: warning.forbiddenClaims,
      claimBoundary: warning.claimBoundary,
    })),
    ...sequentialPlanningHints.map((hint) => ({
      kind: "sequential-planning" as const,
      issue: hint.issue,
      trigger: hint.trigger,
      status: hint.status,
      message: hint.message,
      recommendations: hint.recommendations,
      requiredRechecks: hint.requiredRechecks,
      forbiddenClaims: hint.forbiddenClaims,
      claimBoundary: hint.claimBoundary,
    })),
    ...input.combinedReliabilityWarnings.map((warning) => ({
      kind: "combined-reliability" as const,
      trigger: warning.trigger,
      status: warning.status,
      message: warning.message,
      recommendedActions: warning.recommendedActions,
      requiredRechecks: warning.requiredRechecks,
      forbiddenClaims: warning.forbiddenClaims,
      claimBoundary: warning.claimBoundary,
    })),
    ...input.longRunBudgetWarnings.map((warning) => ({
      kind: "long-run-budget" as const,
      issue: warning.issue,
      trigger: warning.trigger,
      status: warning.status,
      riskLevel: warning.riskLevel,
      budgetBoundary: warning.budgetBoundary,
      message: warning.message,
      recommendedActions: warning.recommendedActions,
      requiredRechecks: warning.requiredRechecks,
      forbiddenClaims: warning.forbiddenClaims,
      claimBoundary: warning.claimBoundary,
    })),
    ...resetCompactHandoffRecommendations.map((recommendation) => ({
      kind: "reset-compact-handoff" as const,
      issue: recommendation.issue,
      trigger: recommendation.trigger,
      status: recommendation.status,
      riskLevel: recommendation.riskLevel,
      message: recommendation.message,
      recommendedActions: recommendation.recommendedActions,
      requiredRechecks: recommendation.requiredRechecks,
      forbiddenClaims: recommendation.forbiddenClaims,
      claimBoundary: recommendation.claimBoundary,
    })),
  ];

  return {
    schemaVersion: OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SCHEMA_VERSION,
    source: OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_SOURCE,
    status: warnings.length > 0 ? "advisory" : "clear",
    summary: {
      existingWarningCount: warnings.length,
      planningWarningCount: input.planningWarnings.length,
      combinedReliabilityWarningCount: input.combinedReliabilityWarnings.length,
      sequentialPlanningHintCount: sequentialPlanningHints.length,
      longRunBudgetWarningCount: input.longRunBudgetWarnings.length,
      resetCompactHandoffRecommendationCount: resetCompactHandoffRecommendations.length,
      contextTrustCurrentAuthorityCount: input.contextTrust.sourceOfTruth.current.length,
      contextTrustNonAuthorizingCount: input.contextTrust.nonAuthorizing.length,
      contextTrustHistoricalOnlyCount: input.contextTrust.historicalOnly.length,
    },
    warnings,
    derivedFrom: {
      contextTrustSource: input.contextTrust.source,
      planningWarningsField: "planningWarnings",
      sequentialPlanningHintsField: "sequentialPlanningHints",
      combinedReliabilityWarningsField: "combinedReliabilityWarnings",
      longRunBudgetWarningsField: "longRunBudgetWarnings",
      resetCompactHandoffRecommendationsField: "resetCompactHandoffRecommendations",
    },
    claimBoundary: OPERATOR_CHECK_RELIABILITY_WARNING_VISIBILITY_CLAIM_BOUNDARY,
  };
}

const RESUME_HANDOFF_ENTRY_LIMIT = 8;

export function buildOperatorCheckResumeHandoffProjection(input: {
  contextTrust: OperatorContextTrustPacket;
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  sequentialPlanningHints: SequentialPlanningHint[];
  planBeforeExecuteGuards: PlanBeforeExecuteGuard[];
  longRunBudgetWarnings: LongRunBudgetWarning[];
  resetCompactHandoffRecommendations?: ResetCompactHandoffRecommendation[];
  reliabilityWarningVisibility: OperatorCheckReliabilityWarningVisibility;
}): OperatorCheckResumeHandoffProjection {
  const resetCompactHandoffRecommendations = input.resetCompactHandoffRecommendations ?? [];
  const currentAuthority = input.contextTrust.sourceOfTruth.current.slice(0, RESUME_HANDOFF_ENTRY_LIMIT);
  const staleHistoricalEntries = [
    ...input.contextTrust.nonAuthorizing,
    ...input.contextTrust.historicalOnly,
  ];
  const staleHistoricalBoundary = staleHistoricalEntries.slice(0, RESUME_HANDOFF_ENTRY_LIMIT);
  const stopBeforeMoreExecution = input.planBeforeExecuteGuards.some((guard) => guard.stopBeforeMoreExecution);
  const requiredRechecks = uniqueSorted([
    ...resetCompactHandoffRecommendations.flatMap((recommendation) => recommendation.requiredRechecks),
    ...input.longRunBudgetWarnings.flatMap((warning) => warning.requiredRechecks),
    ...input.planBeforeExecuteGuards.flatMap((guard) => guard.requiredRechecks),
    ...input.sequentialPlanningHints.flatMap((hint) => hint.requiredRechecks),
    ...input.combinedReliabilityWarnings.flatMap((warning) => warning.requiredRechecks),
    "Run fooks check --json in the new session before treating this projection as current authority.",
  ]);
  const forbiddenClaims = uniqueSorted([
    ...resetCompactHandoffRecommendations.flatMap((recommendation) => recommendation.forbiddenClaims),
    ...input.longRunBudgetWarnings.flatMap((warning) => warning.forbiddenClaims),
    ...input.planBeforeExecuteGuards.flatMap((guard) => guard.forbiddenClaims),
    ...input.sequentialPlanningHints.flatMap((hint) => hint.forbiddenClaims),
    ...input.combinedReliabilityWarnings.flatMap((warning) => warning.forbiddenClaims),
    ...input.planningWarnings.flatMap((warning) => warning.forbiddenClaims),
    "provider/runtime telemetry",
    "provider billing/runtime proof",
    "autonomous CI/merge authority",
    "frontend behavior or product-support change",
  ]);

  return {
    schemaVersion: OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SCHEMA_VERSION,
    issue: OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_ISSUE,
    status: "advisory",
    compact: true,
    readOnly: true,
    source: OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SOURCE,
    claimBoundary: OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_CLAIM_BOUNDARY,
    derivedFrom: {
      operatorCheckCommand: OPERATOR_CHECK_COMMAND,
      operatorCheckSchemaVersion: OPERATOR_CHECK_SCHEMA_VERSION,
      contextTrustSchemaVersion: input.contextTrust.schemaVersion,
      contextTrustSource: input.contextTrust.source,
      fields: [
        "contextTrust.sourceOfTruth.current",
        "contextTrust.nonAuthorizing",
        "contextTrust.historicalOnly",
        "planningWarnings",
        "combinedReliabilityWarnings",
        "sequentialPlanningHints",
        "planBeforeExecuteGuards",
        "longRunBudgetWarnings",
        "resetCompactHandoffRecommendations",
        "reliabilityWarningVisibility",
      ],
    },
    summary: {
      currentAuthorityCount: input.contextTrust.sourceOfTruth.current.length,
      staleOrHistoricalBoundaryCount: staleHistoricalEntries.length,
      planningWarningCount: input.planningWarnings.length,
      combinedReliabilityWarningCount: input.combinedReliabilityWarnings.length,
      sequentialPlanningHintCount: input.sequentialPlanningHints.length,
      planBeforeExecuteGuardCount: input.planBeforeExecuteGuards.length,
      longRunBudgetWarningCount: input.longRunBudgetWarnings.length,
      resetCompactHandoffRecommendationCount: resetCompactHandoffRecommendations.length,
      reliabilityWarningCount: input.reliabilityWarningVisibility.summary.existingWarningCount,
      stopBeforeMoreExecution,
    },
    currentAuthority: {
      status: input.contextTrust.sourceOfTruth.current.length > 0 ? "present" : "missing",
      entries: currentAuthority,
      entryLimit: RESUME_HANDOFF_ENTRY_LIMIT,
      omittedCount: Math.max(0, input.contextTrust.sourceOfTruth.current.length - currentAuthority.length),
    },
    staleHistoricalBoundary: {
      status: staleHistoricalEntries.length > 0 ? "present" : "clear",
      entries: staleHistoricalBoundary,
      entryLimit: RESUME_HANDOFF_ENTRY_LIMIT,
      omittedCount: Math.max(0, staleHistoricalEntries.length - staleHistoricalBoundary.length),
      instruction: staleHistoricalEntries.length > 0
        ? "Treat these non-authorizing or historical entries as boundaries to avoid until rechecked from current source-of-truth evidence."
        : "No non-authorizing or historical contextTrust entries are present; still re-run fooks check before relying on this projection.",
    },
    nextSessionAdvisory: {
      action: stopBeforeMoreExecution ? "stop-before-more-execution" : "recheck-current-authority",
      rationale: stopBeforeMoreExecution
        ? "plan-before-execute guard is present; stop for a bounded plan and current-authority recheck before more execution."
        : "resume from current source-of-truth entries only after rechecking this operator/check projection in the new session.",
      requiredRechecks,
    },
    forbiddenClaims,
  };
}

export function readOperatorCheckSnapshot(cwd = process.cwd(), options: OperatorActivityOptions = {}): OperatorCheckSnapshot {
  const timingStartedAt = performance.now();
  const timingPhases: OperatorCheckTimingPhase[] = [];
  const activity = timeDiagnosticPhase(timingPhases, "read-operator-activity-snapshot", () => readOperatorActivitySnapshot(cwd, { ...options, includeRemoteCounts: true }));
  const activeArtifacts = timeDiagnosticPhase(timingPhases, "active-artifacts", () => activeArtifactsFrom(activity));
  const activeWorkReceipts = timeDiagnosticPhase(timingPhases, "build-active-work-receipts", () =>
    buildActiveWorkReceipts(cwd, activity, options, timingPhases),
  );
  const branch = activity.worktree.branch;
  const blockers = timeDiagnosticPhase(timingPhases, "check-projection-blockers", () => checkProjectionBlockers([...activity.blockers]));
  const hasActiveArtifact = activeArtifacts.length > 0;
  const optionalCountBlockers = activity.optionalCounts.enabled ? activity.optionalCounts.blockers : [];
  const blocked = activity.currentRunEvidence.blockers.length > 0 || optionalCountBlockers.length > 0 || !activity.tmux.available;
  const echoOnly = activity.currentRunEvidence.mainEchoEvidence && !hasActiveArtifact;
  const verdict: OperatorCheckVerdict = blocked
    ? "blocked"
    : hasActiveArtifact
      ? "activeArtifactPresent"
      : "idleRequiresActiveArtifact";

  const requiredArtifact = timeDiagnosticPhase(timingPhases, "required-active-artifact", () => requiredActiveArtifact({ blocked, hasActiveArtifact }));
  const contextTrust = timeDiagnosticPhase(timingPhases, "build-operator-context-trust", () => buildOperatorContextTrust({
    activeArtifacts,
    activeWorkReceipts,
    requiredActiveArtifact: requiredArtifact,
    currentRunEvidence: activity.currentRunEvidence,
    postMergeMainCiEvidence: activity.postMergeMainCiEvidence,
  }));
  const planningWarnings = timeDiagnosticPhase(timingPhases, "runtime-token-cost-planning-warnings", () => buildRuntimeTokenCostPlanningWarnings({ branch }));
  const combinedReliabilityWarnings = timeDiagnosticPhase(timingPhases, "combined-reliability-warnings", () => buildCombinedReliabilityWarnings({ contextTrust, planningWarnings }));
  const prompt = timeDiagnosticPhase(timingPhases, "read-sequential-planning-prompt", () => readSequentialPlanningPrompt(cwd));
  const sequentialPlanningHints = timeDiagnosticPhase(timingPhases, "sequential-planning-hints", () => buildSequentialPlanningHints({ branch, prompt, planningWarnings, combinedReliabilityWarnings }));
  const planBeforeExecuteGuards = timeDiagnosticPhase(timingPhases, "plan-before-execute-guards", () => buildPlanBeforeExecuteGuards({ branch, planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints }));
  const longRunBudgetWarnings = timeDiagnosticPhase(timingPhases, "long-run-budget-warnings", () => buildLongRunBudgetWarnings({ planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints, planBeforeExecuteGuards }));
  const resetCompactHandoffRecommendations = timeDiagnosticPhase(timingPhases, "reset-compact-handoff-recommendations", () => buildResetCompactHandoffRecommendations({ contextTrust, combinedReliabilityWarnings, longRunBudgetWarnings }));
  const reliabilityWarningVisibility = timeDiagnosticPhase(timingPhases, "reliability-warning-visibility", () => buildOperatorCheckReliabilityWarningVisibility({
    contextTrust,
    planningWarnings,
    sequentialPlanningHints,
    combinedReliabilityWarnings,
    longRunBudgetWarnings,
    resetCompactHandoffRecommendations,
  }));
  const resumeHandoffProjection = timeDiagnosticPhase(timingPhases, "resume-handoff-projection", () => buildOperatorCheckResumeHandoffProjection({
    contextTrust,
    planningWarnings,
    combinedReliabilityWarnings,
    sequentialPlanningHints,
    planBeforeExecuteGuards,
    longRunBudgetWarnings,
    resetCompactHandoffRecommendations,
    reliabilityWarningVisibility,
  }));
  const runtimeProvenance = timeDiagnosticPhase(timingPhases, "read-operator-check-runtime-provenance", () => readOperatorCheckRuntimeProvenance(cwd));

  return {
    schemaVersion: OPERATOR_CHECK_SCHEMA_VERSION,
    command: OPERATOR_CHECK_COMMAND,
    generatedAt: activity.generatedAt,
    cwd: activity.cwd,
    claimBoundary: OPERATOR_CHECK_CLAIM_BOUNDARY,
    readOnly: true,
    source: OPERATOR_CHECK_SOURCE,
    runtimeProvenance,
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
    currentRunReceipt: activity.currentRunEvidence.receipt,
    sessionWhipRunReceipt: activeWorkReceipts.sessionWhipRunReceipt,
    requiredActiveArtifact: requiredArtifact,
    contextTrust,
    planningWarnings,
    combinedReliabilityWarnings,
    sequentialPlanningHints,
    planBeforeExecuteGuards,
    longRunBudgetWarnings,
    resetCompactHandoffRecommendations,
    reliabilityWarningVisibility,
    resumeHandoffProjection,
    activity,
    blockers,
    diagnostics: {
      operatorCheckTiming: buildOperatorCheckTimingReceipt(timingPhases, performance.now() - timingStartedAt),
    },
  };
}
