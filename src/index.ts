export { scanProject } from "./core/scan";
export { extractFile } from "./core/extract";
export { toModelFacingPayload } from "./core/payload/model-facing";
export { compareModelFacingPayload } from "./core/compare";
export { assessPayloadReadiness } from "./core/payload/readiness";
export { decideMode } from "./core/decide";
export { classifyPromptContext, discoverRelevantFilesByPolicy, extractPromptTargets } from "./core/context-policy";
export { attachCodex } from "./adapters/codex";
export { attachClaude } from "./adapters/claude";
export { decideCodexPreRead } from "./adapters/codex-pre-read";
export { extractPromptTarget, hasFullReadEscapeHatch, codexRuntimeEscapeHatches } from "./adapters/codex-runtime-prompt";
export {
  resolveCodexRuntimeSessionKey,
  codexRuntimeSessionPath,
  readCodexRuntimeSession,
  initializeCodexRuntimeSession,
  markCodexRuntimeSeenFile,
  clearCodexRuntimeSession,
} from "./adapters/codex-runtime-session";
export { handleCodexRuntimeHook } from "./adapters/codex-runtime-hook";
export { handleCodexNativeHookPayload } from "./adapters/codex-native-hook";
export { installCodexHookPreset } from "./adapters/codex-hook-preset";

export { readCodexTrustStatus } from "./adapters/codex-runtime-trust";
export { parseWorktreeStatus, summarizeWorktreeStatus, parseAndSummarizeWorktreeStatus } from "./core/worktree-status";
export {
  WORKTREE_EVIDENCE_CLAIM_BOUNDARY,
  WORKTREE_EVIDENCE_SCHEMA_VERSION,
  WORKTREE_STATUS_COMMAND,
  captureWorktreeSnapshot,
  computeWorktreeDelta,
  currentWorktreeEvidenceStatus,
  defaultWorktreeStatusRunner,
  finalizeWorktreeEvidenceSafe,
  initializeWorktreeEvidenceSafe,
  readWorktreeEvidence,
  writeWorktreeEvidence,
} from "./reporting/worktree-evidence";
export type {
  GitPorcelainStatusCode,
  ParseWorktreeStatusOptions,
  WorktreeChangeKind,
  WorktreeStatusEntry,
  WorktreeStatusSummary,
} from "./core/worktree-status";
export type {
  WorktreeCaptureResult,
  WorktreeCurrentStatus,
  WorktreeDelta,
  WorktreeEvidenceFile,
  WorktreeEvidenceOptions,
  WorktreeEvidenceResult,
  WorktreeSnapshot,
  WorktreeStatusRunner,
} from "./reporting/worktree-evidence";

export {
  ARTIFACT_AUDIT_CLAIM_BOUNDARY,
  ARTIFACT_AUDIT_COMMAND,
  ARTIFACT_AUDIT_SCHEMA_VERSION,
  ARTIFACT_AUDIT_SCOPE,
  auditArtifacts,
  defaultArtifactAuditCommandRunner,
  parseGitBranchList,
  parseGitWorktreePorcelain,
  parseTmuxPaneList,
} from "./ops/artifact-audit";
export type {
  ArtifactAuditArchiveEvidence,
  ArtifactAuditBranch,
  ArtifactAuditCommandRunner,
  ArtifactAuditOptions,
  ArtifactAuditPathExists,
  ArtifactAuditResult,
  ArtifactAuditSession,
  ArtifactAuditSessionPane,
  ArtifactAuditStaleClosedArtifactWorktree,
  ArtifactAuditStaleRuntimeCleanup,
  ArtifactAuditStatus,
  ArtifactAuditWorktree,
} from "./ops/artifact-audit";

export {
  ORPHAN_LOCAL_WORKTREE_TRIAGE_CLAIM_BOUNDARY,
  ORPHAN_LOCAL_WORKTREE_TRIAGE_COMMAND,
  ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE,
  ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE_URL,
  ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE,
  ORPHAN_LOCAL_WORKTREE_TRIAGE_SCHEMA_VERSION,
  defaultOrphanLocalWorktreeCommandRunner,
  parseOrphanLocalWorktreePorcelain,
  parseOrphanLocalWorktreeRemoteBranches,
  parseOrphanLocalWorktreeTmuxPanes,
  triageOrphanLocalWorktrees,
} from "./ops/orphan-local-worktree-triage";
export type {
  OrphanLocalWorktreeCategory,
  OrphanLocalWorktreeCommandRunner,
  OrphanLocalWorktreeEntry,
  OrphanLocalWorktreePathExists,
  OrphanLocalWorktreePullRequestEvidence,
  OrphanLocalWorktreeTriageOptions,
  OrphanLocalWorktreeTriageResult,
} from "./ops/orphan-local-worktree-triage";
export {
  REACT_WEB_STATUS_CLAIM_BOUNDARY,
  REACT_WEB_STATUS_COMMAND,
  REACT_WEB_STATUS_SCHEMA_VERSION,
  readReactWebStatus,
  renderReactWebStatusText,
} from "./reporting/react-web-status";
export type {
  ReactWebBoundaryState,
  ReactWebFreshnessState,
  ReactWebProfileStatus,
  ReactWebStatusResult,
} from "./reporting/react-web-status";
export {
  REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS,
  REACT_WEB_ACTIVATION_MODE_CLAIM_BOUNDARY,
  REACT_WEB_ACTIVATION_MODE_COMMAND,
  REACT_WEB_ACTIVATION_MODE_MODE,
  REACT_WEB_ACTIVATION_MODE_SCHEMA_VERSION,
  REACT_WEB_ACTIVATION_SUPPORTED_TRIGGER,
  buildReactWebActivationMode,
  buildReactWebActivationModeFromRuntimeDecision,
  readReactWebActivationMode,
  renderReactWebActivationModeMarkdown,
  summarizeReactWebActivationMode,
} from "./reporting/react-web-activation-mode";
export type {
  ReactWebActivationDeferredTrigger,
  ReactWebActivationModeResult,
  ReactWebActivationModeSummary,
  ReactWebActivationVerdict,
} from "./reporting/react-web-activation-mode";
export {
  REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT,
  REACT_WEB_RANKED_BUNDLE_CLAIM_BOUNDARY,
  REACT_WEB_RANKED_BUNDLE_COMMAND,
  REACT_WEB_RANKED_BUNDLE_MODE,
  REACT_WEB_RANKED_BUNDLE_SCHEMA_VERSION,
  buildReactWebRankedBundle,
  readReactWebRankedBundle,
  renderReactWebRankedBundleMarkdown,
  summarizeReactWebRankedBundle,
} from "./reporting/react-web-ranked-bundle";
export type {
  ReactWebRankedBundleEntry,
  ReactWebRankedBundleEntryClass,
  ReactWebRankedBundleEntrySource,
  ReactWebRankedBundleResult,
  ReactWebRankedBundleSummary,
  ReactWebRankedBundleVerdict,
} from "./reporting/react-web-ranked-bundle";

export {
  REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY,
  REACT_WEB_ISSUE_REPORT_COMMAND,
  REACT_WEB_ISSUE_REPORT_SCHEMA_VERSION,
  buildReactWebIssueReport,
  renderReactWebIssueReportText,
} from "./core/react-web-issue-report";
export type { ReactWebIssueCard, ReactWebIssueReport } from "./core/react-web-issue-report";
