import type { OperatorActivitySnapshot } from "./operator-activity";
import type {
  OperatorCheckActiveArtifact,
  OperatorCheckActiveWorkReceipts,
  OperatorCheckRequiredActiveArtifact,
} from "./operator-check";

export const OPERATOR_CONTEXT_TRUST_SCHEMA_VERSION = 1;
export const OPERATOR_CONTEXT_TRUST_SOURCE = "fooks check --json operator-check projection";
export const OPERATOR_CONTEXT_TRUST_RESEARCH_REFERENCE = "docs/research/context-trust-and-stale-evidence-research.md";
export const OPERATOR_CONTEXT_TRUST_CLAIM_BOUNDARY =
  "Read-only context trust projection over evidence already computed by operator-check; it separates current authority, advisory guidance, historical receipts, and non-authorizing caveats without performing stale detection, handoff generation, or additional git/gh/tmux/filesystem reads. The parent operator-check schema remains version 1 because this packet is additive and consumers should ignore unknown fields.";

export type OperatorContextTrustEntryAuthority =
  | "current-work"
  | "handoff-candidate"
  | "receipt"
  | "guidance"
  | "insufficient";

export type OperatorContextTrustContractScope =
  | "top-level-active-artifact"
  | "active-artifact-guidance"
  | "post-merge-receipt"
  | "stale-residue-boundary"
  | "cleanup-review-boundary"
  | "handoff-artifact-boundary"
  | "main-echo-boundary";

export type OperatorContextTrustEntry = {
  kind: string;
  source: string;
  reason: string;
  referenceField?: string;
  count?: number;
  live?: boolean;
  authority?: OperatorContextTrustEntryAuthority;
  contractScope: OperatorContextTrustContractScope;
};

export type OperatorContextTrustPacket = {
  schemaVersion: typeof OPERATOR_CONTEXT_TRUST_SCHEMA_VERSION;
  source: typeof OPERATOR_CONTEXT_TRUST_SOURCE;
  researchReference: typeof OPERATOR_CONTEXT_TRUST_RESEARCH_REFERENCE;
  claimBoundary: typeof OPERATOR_CONTEXT_TRUST_CLAIM_BOUNDARY;
  sourceOfTruth: {
    current: OperatorContextTrustEntry[];
  };
  advisoryOnly: OperatorContextTrustEntry[];
  historicalOnly: OperatorContextTrustEntry[];
  nonAuthorizing: OperatorContextTrustEntry[];
};

export type BuildOperatorContextTrustInput = {
  activeArtifacts: OperatorCheckActiveArtifact[];
  activeWorkReceipts: OperatorCheckActiveWorkReceipts;
  requiredActiveArtifact: OperatorCheckRequiredActiveArtifact;
  currentRunEvidence: OperatorActivitySnapshot["currentRunEvidence"];
  postMergeMainCiEvidence: OperatorActivitySnapshot["postMergeMainCiEvidence"];
};

function activeArtifactReason(artifact: OperatorCheckActiveArtifact): string {
  switch (artifact.kind) {
    case "issue":
      return "Existing operator-check activeArtifacts reports aggregate open issue count; count-only current-work presence, not per-issue identity.";
    case "pullRequest":
      return "Existing operator-check activeArtifacts reports aggregate open pull request count; count-only current-work presence, not per-PR identity.";
    case "session":
      return "Existing operator-check activeArtifacts reports mapped fooks session presence; session-count authority mirrors the top-level operator-check contract.";
  }
}

function currentEntriesFromActiveArtifacts(activeArtifacts: OperatorCheckActiveArtifact[]): OperatorContextTrustEntry[] {
  return activeArtifacts.map((artifact) => ({
    kind: artifact.kind,
    source: artifact.source,
    reason: activeArtifactReason(artifact),
    referenceField: "activeArtifacts",
    count: artifact.count,
    authority: "current-work" as const,
    contractScope: "top-level-active-artifact" as const,
  }));
}

function advisoryEntries(input: BuildOperatorContextTrustInput): OperatorContextTrustEntry[] {
  const requiredActiveArtifact = input.requiredActiveArtifact;
  const postReceipt = input.activeWorkReceipts.postReceiptNudgeAnchorBoundary;
  const receiptLoop = input.activeWorkReceipts.receiptOnlyNudgeLoopBoundary;
  return [
    {
      kind: "required-active-artifact-guidance",
      source: "requiredActiveArtifact",
      reason: requiredActiveArtifact.message,
      referenceField: "requiredActiveArtifact",
      authority: "guidance",
      contractScope: "active-artifact-guidance",
    },
    {
      kind: "dogfood-handoff-guidance",
      source: "requiredActiveArtifact.dogfoodHandoff",
      reason: requiredActiveArtifact.dogfoodHandoff.nextAction,
      referenceField: "requiredActiveArtifact.dogfoodHandoff",
      authority: "guidance",
      contractScope: "active-artifact-guidance",
    },
    {
      kind: "post-receipt-nudge-anchor-guidance",
      source: postReceipt.source,
      reason: postReceipt.nudgeRule,
      referenceField: "activeWorkReceipts.postReceiptNudgeAnchorBoundary",
      authority: "guidance",
      contractScope: "active-artifact-guidance",
    },
    {
      kind: "receipt-only-nudge-loop-guidance",
      source: receiptLoop.source,
      reason: receiptLoop.nudgeRule,
      referenceField: "activeWorkReceipts.receiptOnlyNudgeLoopBoundary",
      authority: "guidance",
      contractScope: "active-artifact-guidance",
    },
  ];
}

function historicalEntries(input: BuildOperatorContextTrustInput): OperatorContextTrustEntry[] {
  const entries: OperatorContextTrustEntry[] = [];
  const postMerge = input.postMergeMainCiEvidence;
  if (postMerge.summary.exactHeadWorkflowCount > 0) {
    entries.push({
      kind: "post-merge-main-ci-receipt",
      source: postMerge.source,
      reason: "Post-merge main CI exact-head evidence is a historical receipt and does not authorize current active work.",
      referenceField: "postMergeMainCiEvidence",
      count: postMerge.summary.exactHeadWorkflowCount,
      authority: "receipt",
      contractScope: "post-merge-receipt",
    });
  }

  return entries;
}

function nonAuthorizingEntries(input: BuildOperatorContextTrustInput): OperatorContextTrustEntry[] {
  const entries: OperatorContextTrustEntry[] = [];
  const currentRun = input.currentRunEvidence;
  if (currentRun.mainEchoEvidence) {
    entries.push({
      kind: "main-echo-boundary",
      source: currentRun.source,
      reason: currentRun.reasons.join("; ") || "Current run is a main-echo boundary and does not authorize active work by itself.",
      referenceField: "postMergeMainEchoBoundary",
      live: true,
      authority: "insufficient",
      contractScope: "main-echo-boundary",
    });
  }

  const staleResidue = input.activeWorkReceipts.staleResidueActiveBoundary;
  if (staleResidue.staleResidueCount > 0) {
    entries.push({
      kind: "stale-residue-active-boundary",
      source: staleResidue.source,
      reason: staleResidue.reminder,
      referenceField: "activeWorkReceipts.staleResidueActiveBoundary",
      count: staleResidue.staleResidueCount,
      authority: "insufficient",
      contractScope: "stale-residue-boundary",
    });
  }

  const localOnly = input.activeWorkReceipts.localOnlyResidueActiveBoundary;
  if (localOnly.cleanupReviewResidueEvidence.totalLocalOnlyResidueCount > 0) {
    entries.push({
      kind: "local-only-residue-active-boundary",
      source: localOnly.source,
      reason: localOnly.reminder,
      referenceField: "activeWorkReceipts.localOnlyResidueActiveBoundary",
      count: localOnly.cleanupReviewResidueEvidence.totalLocalOnlyResidueCount,
      authority: "insufficient",
      contractScope: "cleanup-review-boundary",
    });
  }

  const legacyReview = input.activeWorkReceipts.legacyReviewWorktreeResidueBoundary;
  if (legacyReview.legacyReviewWorktreeResidueCount > 0) {
    entries.push({
      kind: "legacy-review-worktree-residue",
      source: legacyReview.source,
      reason: legacyReview.nudgeRule,
      referenceField: "activeWorkReceipts.legacyReviewWorktreeResidueBoundary",
      count: legacyReview.legacyReviewWorktreeResidueCount,
      authority: "insufficient",
      contractScope: "cleanup-review-boundary",
    });
  }

  const cleanupGuard = input.activeWorkReceipts.legacyReviewResidueCleanupReviewGuard;
  const cleanupReviewResidueCount = cleanupGuard.cleanupReviewEvidence.legacyReviewWorktreeResidueCount
    + cleanupGuard.cleanupReviewEvidence.legacyLocalResidueCleanupReviewRowCount;
  if (cleanupReviewResidueCount > 0) {
    entries.push({
      kind: "legacy-review-residue-cleanup-review",
      source: cleanupGuard.source,
      reason: cleanupGuard.nudgeRediscoveryRule,
      referenceField: "activeWorkReceipts.legacyReviewResidueCleanupReviewGuard",
      count: cleanupReviewResidueCount,
      authority: "insufficient",
      contractScope: "cleanup-review-boundary",
    });
  }

  const handoff = input.activeWorkReceipts.handoffArtifactEvidence;
  if (handoff.currentEvidence.liveNonMainWorktreePresent) {
    entries.push({
      kind: "live-non-main-worktree-handoff-candidate",
      source: handoff.source,
      reason: "Live non-main worktree is adoptable #885 handoff evidence, but does not satisfy the top-level issue/PR/mapped-session active-artifact contract by itself.",
      referenceField: "activeWorkReceipts.handoffArtifactEvidence.currentEvidence.liveNonMainWorktreePresent",
      live: true,
      authority: "handoff-candidate",
      contractScope: "handoff-artifact-boundary",
    });
  }

  if (handoff.currentEvidence.mappedFooksTmuxSessionCount > 0 && handoff.currentEvidence.liveMappedFooksTmuxSessionCount === 0) {
    entries.push({
      kind: "mapped-session-live-handoff-caveat",
      source: handoff.source,
      reason: "Mapped-session presence may mirror top-level active-artifact/session-count evidence, but #885 handoff authority still lacks a live mapped fooks tmux session.",
      referenceField: "activeWorkReceipts.handoffArtifactEvidence.currentEvidence.liveMappedFooksTmuxSessionCount",
      count: handoff.currentEvidence.mappedFooksTmuxSessionCount,
      live: false,
      authority: "insufficient",
      contractScope: "handoff-artifact-boundary",
    });
  }

  return entries;
}

export function buildOperatorContextTrust(input: BuildOperatorContextTrustInput): OperatorContextTrustPacket {
  return {
    schemaVersion: OPERATOR_CONTEXT_TRUST_SCHEMA_VERSION,
    source: OPERATOR_CONTEXT_TRUST_SOURCE,
    researchReference: OPERATOR_CONTEXT_TRUST_RESEARCH_REFERENCE,
    claimBoundary: OPERATOR_CONTEXT_TRUST_CLAIM_BOUNDARY,
    sourceOfTruth: {
      current: currentEntriesFromActiveArtifacts(input.activeArtifacts),
    },
    advisoryOnly: advisoryEntries(input),
    historicalOnly: historicalEntries(input),
    nonAuthorizing: nonAuthorizingEntries(input),
  };
}
