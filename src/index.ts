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
export {
  OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_CLAIM_BOUNDARY,
  OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_ISSUE,
  OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SCHEMA_VERSION,
  OPERATOR_CHECK_ACTIVE_WORK_RECEIPT_SOURCE,
  OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_CLAIM_BOUNDARY,
  OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_ISSUE,
  OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_SCHEMA_VERSION,
  OPERATOR_CHECK_SESSION_WHIP_RUN_RECEIPT_SOURCE,
  OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_CLAIM_BOUNDARY,
  OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_ISSUE,
  OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_ISSUE_URL,
  OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_SCHEMA_VERSION,
  OPERATOR_CHECK_POST_RECEIPT_NUDGE_ANCHOR_SOURCE,
  OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_CLAIM_BOUNDARY,
  OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SCHEMA_VERSION,
  OPERATOR_CHECK_SALVAGE_REVIEW_QUEUE_SOURCE,
  OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_CLAIM_BOUNDARY,
  OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE,
  OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_ISSUE_URL,
  OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SCHEMA_VERSION,
  OPERATOR_CHECK_STALE_RESIDUE_CLEANUP_REVIEW_MANIFEST_SOURCE,
  OPERATOR_CHECK_CLAIM_BOUNDARY,
  OPERATOR_CHECK_COMMAND,
  OPERATOR_CHECK_SCHEMA_VERSION,
  OPERATOR_CHECK_SOURCE,
  OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_CLAIM_BOUNDARY,
  OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_ISSUE,
  OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SCHEMA_VERSION,
  OPERATOR_CHECK_RESUME_HANDOFF_PROJECTION_SOURCE,
  buildOperatorCheckResumeHandoffProjection,
  readOperatorCheckSnapshot,
} from "./ops/operator-check";
export type {
  OperatorCheckActiveArtifact,
  OperatorCheckActiveArtifactKind,
  OperatorCheckActiveWorkReceipt,
  OperatorCheckActiveWorkReceiptClassification,
  OperatorCheckActiveWorkReceiptIdentifiers,
  OperatorCheckActiveWorkReceiptKind,
  OperatorCheckActiveWorkReceipts,
  OperatorCheckPostReceiptNudgeAnchorBoundary,
  OperatorCheckRequiredActiveArtifact,
  OperatorCheckResumeHandoffProjection,
  OperatorCheckSalvageReviewQueue,
  OperatorCheckSessionWhipRunReceipt,
  OperatorCheckSessionWhipRunReceiptEvidenceItem,
  OperatorCheckSalvageReviewQueueItem,
  OperatorCheckSnapshot,
  OperatorCheckStaleResidueCleanupReviewManifest,
  OperatorCheckStaleResidueCleanupReviewManualAction,
  OperatorCheckStaleResidueCleanupReviewRiskClass,
  OperatorCheckStaleResidueCleanupReviewRow,
  OperatorCheckStaleResidueLedger,
  OperatorCheckStaleResidueLedgerCategory,
  OperatorCheckStaleResidueLedgerClass,
  OperatorCheckStaleResidueLedgerNextReviewAction,
  OperatorCheckVerdict,
} from "./ops/operator-check";

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
  ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE,
  ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE_URL,
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
  OrphanLocalWorktreeDecisionRow,
  OrphanLocalWorktreeDiffEvidence,
  OrphanLocalWorktreeOperatorDecision,
  OrphanLocalWorktreeEntry,
  OrphanLocalWorktreePathExists,
  OrphanLocalWorktreePullRequestEvidence,
  OrphanLocalWorktreeTriageOptions,
  OrphanLocalWorktreeTriageResult,
} from "./ops/orphan-local-worktree-triage";
export {
  SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY,
  SEQUENTIAL_PLANNING_HINT_FOLLOWUP_ISSUE,
  SEQUENTIAL_PLANNING_HINT_ISSUE,
  SEQUENTIAL_PLANNING_HINT_SCHEMA_VERSION,
  SEQUENTIAL_PLANNING_HINT_SOURCE,
  buildSequentialPlanningHints,
  readSequentialPlanningPrompt,
} from "./ops/sequential-planning-hint";
export type {
  SequentialPlanningHint,
  SequentialPlanningHintRecommendation,
  SequentialPlanningHintTrigger,
} from "./ops/sequential-planning-hint";

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
  buildReactWebIssueReportMigrationDryRunJson,
  buildReactWebIssueReportSummaryJson,
  renderReactWebIssueReportText,
} from "./core/react-web-issue-report";
export {
  REACT_WEB_DECISION_SCHEMA_VERSION,
  buildReactWebIssueDecision,
  buildReactWebProjectionDecision,
  buildReactWebStopDecision,
  failClosedReactWebDecision,
  summarizeReactWebDecisions,
} from "./core/react-web-decision";
export {
  REACT_WEB_DECISION_HANDOFF_BENCHMARK_CLAIM_BOUNDARY,
  REACT_WEB_DECISION_HANDOFF_BENCHMARK_SCHEMA_VERSION,
  REACT_WEB_DECISION_HANDOFF_COMPARISON_ARMS,
  REACT_WEB_DECISION_STOP_BENCHMARK_SCHEMA_VERSION,
  evaluateReactWebDecisionHandoffBenchmark,
  evaluateReactWebDecisionStopBenchmark,
} from "./core/react-web-decision-handoff-benchmark";
export type {
  ReactWebIssueCard,
  ReactWebIssuePriority,
  ReactWebIssueReport,
  ReactWebIssueReportMigrationDryRunJson,
  ReactWebIssueReportSummaryJson,
  ReactWebIssueTriageBucket,
  ReactWebIssueTriage,
  ReactWebIssueTriageEvidence,
  ReactWebRelatedContextQuality,
} from "./core/react-web-issue-report";

export type {
  BuildReactWebIssueDecisionOptions,
  ReactWebDecision,
  ReactWebDecisionAllowedActions,
  ReactWebDecisionConfidence,
  ReactWebDecisionState,
} from "./core/react-web-decision";
export type {
  EvaluateReactWebDecisionHandoffBenchmarkInput,
  ReactWebDecisionDryRunHandoff,
  ReactWebDecisionDryRunHandoffTask,
  ReactWebDecisionHandoffBenchmark,
  ReactWebDecisionHandoffComparisonArm,
  ReactWebDecisionHandoffTask,
  ReactWebDecisionStopBenchmark,
  ReactWebDecisionStopBenchmarkEntry,
  ReactWebDecisionStopHandoff,
} from "./core/react-web-decision-handoff-benchmark";
export {
  WORK_ITEM_DASHBOARD_SCHEMA_VERSION,
  WORK_ITEM_DASHBOARD_SOURCE,
  WORK_ITEM_DASHBOARD_CLAIM_BOUNDARY,
  buildWorkItemDashboard,
  type WorkItem,
  type WorkItemCurrentAuthorityStatus,
  type WorkItemCurrentAuthoritySummary,
  type WorkItemEvidence,
  type WorkItemNextAction,
  type WorkItemDashboard,
  type WorkItemArchitectureAudit,
} from "./core/work-item-dashboard";
export {
  WORK_ITEM_EXPLAIN_SCHEMA_VERSION,
  WORK_ITEM_EXPLAIN_CLAIM_BOUNDARY,
  buildWorkItemExplain,
  renderWorkItemExplainText,
  type WorkItemExplainArtifact,
  type WorkItemExplainRejectedEvidence,
  type WorkItemExplainResult,
} from "./core/work-item-explain";

export {
  STALE_CONTEXT_CLAIM_BOUNDARY,
  STALE_CONTEXT_COMMAND,
  STALE_CONTEXT_RESEARCH_REFERENCE,
  STALE_CONTEXT_SCHEMA_VERSION,
  auditStaleContextText,
  renderStaleContextAuditText,
} from "./ops/stale-context";
export type {
  StaleContextAuditResult,
  StaleContextAuthority,
  StaleContextEvidence,
  StaleContextFreshness,
  StaleContextSeverity,
  StaleContextWarning,
  StaleContextWarningKind,
} from "./ops/stale-context";
export {
  AUTHORITATIVE_RESUME_PACKET_CLAIM_BOUNDARY,
  AUTHORITATIVE_RESUME_PACKET_ISSUE,
  AUTHORITATIVE_RESUME_PACKET_SCHEMA_VERSION,
  AUTHORITATIVE_RESUME_PACKET_SOURCE,
  SOURCE_OF_TRUTH_HANDOFF_CLAIM_BOUNDARY,
  SOURCE_OF_TRUTH_HANDOFF_COMMAND,
  SOURCE_OF_TRUTH_HANDOFF_SCHEMA_VERSION,
  SOURCE_OF_TRUTH_HANDOFF_SOURCE,
  buildSourceOfTruthHandoffPacket,
} from "./ops/source-of-truth-handoff";
export type {
  AuthoritativeResumePacket,
  AuthoritativeResumePacketAction,
  SourceOfTruthHandoffCommandRunner,
  SourceOfTruthHandoffOptions,
  SourceOfTruthHandoffPacket,
  SourceOfTruthLinkedArtifact,
  SourceOfTruthPrCheck,
} from "./ops/source-of-truth-handoff";
export {
  COMBINED_RELIABILITY_WARNING_CLAIM_BOUNDARY,
  COMBINED_RELIABILITY_WARNING_SCHEMA_VERSION,
  COMBINED_RELIABILITY_WARNING_SOURCE,
  buildCombinedReliabilityWarnings,
} from "./ops/combined-reliability-warning";
export type {
  CombinedReliabilityWarning,
  CombinedReliabilityWarningContextRisk,
} from "./ops/combined-reliability-warning";
export {
  LONG_RUN_BUDGET_WARNING_CLAIM_BOUNDARY,
  LONG_RUN_BUDGET_WARNING_EPIC,
  LONG_RUN_BUDGET_WARNING_ISSUE,
  LONG_RUN_BUDGET_WARNING_SCHEMA_VERSION,
  LONG_RUN_BUDGET_WARNING_SOURCE,
  buildLongRunBudgetWarnings,
} from "./ops/long-run-budget-warning";
export type {
  LongRunBudgetRiskLevel,
  LongRunBudgetWarning,
  LongRunBudgetWarningAction,
  LongRunBudgetWarningTrigger,
} from "./ops/long-run-budget-warning";

export {
  FACT_GRAPH_REPORT_CLAIM_BOUNDARY,
  FACT_GRAPH_REPORT_NON_CLAIMS,
  FACT_GRAPH_REPORT_PRODUCER,
  FACT_GRAPH_REPORT_SCHEMA_VERSION,
  buildFactGraphMetrics,
  buildFactGraphReport,
} from "./core/fact-graph";
export type {
  BuildFactGraphReportOptions,
  FactEdge,
  FactGraphConfidence,
  FactGraphDomain,
  FactGraphExtractorRef,
  FactGraphFreshness,
  FactGraphFreshnessStatus,
  FactGraphPrimitive,
  FactGraphProperties,
  FactGraphPropertyValue,
  FactGraphReport,
  FactGraphReportMetrics,
  FactGraphReportPolicy,
  FactGraphSourceRef,
  FactNode,
} from "./core/fact-graph";

export {
  REACT_WEB_FACT_GRAPH_ADVISORY_BOUNDARY,
  REACT_WEB_FACT_GRAPH_COMMAND,
  REACT_WEB_FACT_GRAPH_EXTRACTOR_ID,
  REACT_WEB_FACT_GRAPH_EXTRACTOR_VERSION,
  REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION,
  buildReactWebFactGraphInspection,
  renderReactWebFactGraphInspectionText,
} from "./core/react-web-fact-graph";
export type { ReactWebFactGraphInspection } from "./core/react-web-fact-graph";

export {
  REACT_WEB_FACT_GRAPH_CONSUMER_CLAIM_BOUNDARY,
  REACT_WEB_FACT_GRAPH_CONSUMER_COMMAND,
  REACT_WEB_FACT_GRAPH_CONSUMER_DEFAULT_MAX_ANCHORS,
  REACT_WEB_FACT_GRAPH_CONSUMER_MAX_ANCHORS,
  REACT_WEB_FACT_GRAPH_CONSUMER_MIN_ANCHORS,
  REACT_WEB_FACT_GRAPH_CONSUMER_SCHEMA_VERSION,
  buildReactWebFactGraphConsumerDryRun,
  normalizeReactWebFactGraphConsumerMaxAnchors,
  renderReactWebFactGraphConsumerDryRunText,
  selectReactWebFactGraphAnchors,
} from "./core/react-web-fact-graph-consumer";

export {
  REACT_WEB_FACT_GRAPH_FRESHNESS_CLAIM_BOUNDARY,
  REACT_WEB_FACT_GRAPH_FRESHNESS_COMMAND,
  REACT_WEB_FACT_GRAPH_FRESHNESS_SCHEMA_VERSION,
  buildReactWebFactGraphFreshnessExpected,
  buildReactWebFactGraphFreshnessVerification,
  renderReactWebFactGraphFreshnessVerificationText,
  summarizeReactWebFactGraphFreshnessVerification,
  verifyReactWebFactGraphFreshness,
} from "./core/react-web-fact-graph-freshness";
export type {
  ReactWebFactGraphFreshnessActual,
  ReactWebFactGraphFreshnessCheck,
  ReactWebFactGraphFreshnessCheckStatus,
  ReactWebFactGraphFreshnessExpected,
  ReactWebFactGraphFreshnessSummary,
  ReactWebFactGraphFreshnessVerification,
} from "./core/react-web-fact-graph-freshness";

export type {
  ReactWebFactGraphAnchor,
  ReactWebFactGraphAnchorDeferredReason,
  ReactWebFactGraphAnchorType,
  ReactWebFactGraphConsumerAuthorization,
  ReactWebFactGraphConsumerDryRun,
  ReactWebFactGraphConsumerOptions,
} from "./core/react-web-fact-graph-consumer";
