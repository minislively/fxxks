import {
  buildReactWebLabelPatchPreview,
  REACT_WEB_LABEL_PATCH_PREVIEW_CLAIM_BOUNDARY,
  type ReactWebLabelPatchPreview,
  type ReactWebLabelPatchPreviewFinding,
} from "./react-web-label-preview";
import {
  buildReactWebIssueRelatedContext,
  type ReactWebIssueRelatedContext,
} from "./react-web-issue-related-context";
import {
  findRepoOwnedConventionHintsForIssue,
  type RepoOwnedConventionHintProjection,
} from "./repo-owned-convention-hints";
import {
  buildReactWebIssueDecision,
  buildReactWebProjectionDecision,
  buildReactWebStopDecision,
  summarizeReactWebDecisions,
  type ReactWebDecision,
} from "./react-web-decision";

export const REACT_WEB_ISSUE_REPORT_SCHEMA_VERSION = "react-web-issue-report.v1" as const;
export const REACT_WEB_ISSUE_REPORT_COMMAND = "inspect react-web-issues" as const;
export const REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY =
  "Read-only React Web issue report for a narrow native JSX label/accessibility subset only: adapts label-preview findings into actionable issue cards, never edits files, does not auto-apply patches, does not claim broad accessibility coverage, and does not infer custom-component semantics." as const;

type ReactWebIssueConfidence = "high" | "medium";
type ReactWebIssueFixability = "safe-preview" | "manual-review";
type ReactWebIssueAutoFixSafety = "not-auto-applied" | "unsafe-to-auto-apply";
export type ReactWebIssuePriority = "high" | "medium" | "low";
export type ReactWebIssueTriageBucket = "safe-preview" | "high-confidence-manual-review" | "manual-review";
export type ReactWebRelatedContextQuality = "same-file-only" | "local-supporting-context" | "thin-local-context";
type ReactWebIssueKind =
  | "react-web.missing-accessible-label"
  | "react-web.ambiguous-accessible-label"
  | "react-web.empty-accessible-name"
  | "react-web.unassociated-nearby-label"
  | "react-web.duplicate-literal-id";

export type ReactWebIssueTriageEvidence = {
  safePreviewAvailable: boolean;
  confidence: ReactWebIssueConfidence;
  nativeElement: ReactWebLabelPatchPreviewFinding["element"];
  sameFileContextAvailable: boolean;
  relatedContextCount: number;
  relatedContextSources: ReactWebIssueRelatedContext["source"][];
  relatedContextQuality: ReactWebRelatedContextQuality;
  score: number;
  reasons: string[];
};

export type ReactWebIssueTriage = {
  rank: number;
  priority: ReactWebIssuePriority;
  bucket: ReactWebIssueTriageBucket;
  evidence: ReactWebIssueTriageEvidence;
};

type ReactWebIssueFixShape =
  | "safe-preview-htmlFor-association"
  | "human-reviewed-label-association"
  | "human-reviewed-placeholder-replacement"
  | "human-reviewed-button-name"
  | "human-reviewed-native-control-name"
  | "human-reviewed-accessible-name"
  | "human-reviewed-duplicate-id-association";

export type ReactWebIssueFixShapeGuidance = {
  claimBoundary: string;
  shape: ReactWebIssueFixShape;
  summary: string;
  inspectFirst: string[];
  localEvidence: {
    element: ReactWebLabelPatchPreviewFinding["element"];
    attributes: string[];
    sameFileContextAvailable: boolean;
    safePreviewAvailable: boolean;
    relatedContextCount: number;
    relatedContextSources: ReactWebIssueRelatedContext["source"][];
  };
  humanReviewRequired: true;
  autoApply: false;
};

export type ReactWebIssueContextPacket = {
  whyThisFile: string;
  relatedPattern: string;
  nearbyPrecedent: string;
  confidence: ReactWebIssueConfidence;
  excludedInference: string[];
  conventionHints: string[];
};

export type ReactWebIssueCard = {
  id: string;
  kind: ReactWebIssueKind;
  problem: string;
  whyItMatters: string;
  evidence: {
    filePath: string;
    line: number;
    endLine: number;
    context: string;
    sourceSignals: string[];
    element: ReactWebLabelPatchPreviewFinding["element"];
  };
  whereToLook: {
    filePath: string;
    line: number;
    endLine: number;
    context: string;
  };
  relatedContext: ReactWebIssueRelatedContext[];
  confidence: ReactWebIssueConfidence;
  fixability: ReactWebIssueFixability;
  autoFixSafety: ReactWebIssueAutoFixSafety;
  safetyRationale: string;
  suggestedFixIntent: string;
  suggestedAction: string;
  contextPacket: ReactWebIssueContextPacket;
  conventionHints: RepoOwnedConventionHintProjection[];
  fixShapeGuidance: ReactWebIssueFixShapeGuidance;
  triage: ReactWebIssueTriage;
  decision: ReactWebDecision;
  skipReason?: string;
  preview?: {
    type: "unified-diff-fragment";
    readOnly: true;
    text: string;
  };
};

export type ReactWebIssueFirstMinuteSummaryItem = {
  issueId: string;
  fixShape: ReactWebIssueFixShape;
  firstInspectStep: string;
  inspectFirst: string[];
  whyThisFirst: string;
  nextAction: string;
  humanDecisionNeeded: string[];
  doNotDo: string[];
  contextHints: string[];
  fixShapeGuidance: {
    claimBoundary: ReactWebIssueFixShapeGuidance["claimBoundary"];
    humanReviewRequired: true;
    autoApply: false;
  };
  decision: ReactWebDecision;
};

export type ReactWebIssueFirstMinuteSummary = {
  sourceTopIssueIds: string[];
  items: ReactWebIssueFirstMinuteSummaryItem[];
};

export type ReactWebIssueReport = {
  schemaVersion: typeof REACT_WEB_ISSUE_REPORT_SCHEMA_VERSION;
  command: typeof REACT_WEB_ISSUE_REPORT_COMMAND;
  profile: "react-web";
  filePath: string;
  readOnly: true;
  autoApply: false;
  claimBoundary: typeof REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY;
  sourcePreview: {
    schemaVersion: ReactWebLabelPatchPreview["schemaVersion"];
    claimBoundary: typeof REACT_WEB_LABEL_PATCH_PREVIEW_CLAIM_BOUNDARY;
    findingCount: number;
  };
  inScope: boolean;
  skippedReason?: string;
  summary: {
    issueCount: number;
    safePreviewCount: number;
    manualReviewCount: number;
    unsafeToAutoApplyCount: number;
  };
  decisionSummary: ReturnType<typeof summarizeReactWebDecisions>;
  stopDecision?: ReactWebDecision;
  triageRollup: {
    claimBoundary: string;
    criteria: string[];
    priorityCounts: Record<ReactWebIssuePriority, number>;
    bucketCounts: Record<ReactWebIssueTriageBucket, number>;
    rankedIssueIds: string[];
    topIssueIds: string[];
    topManualReviewIssueIds: string[];
    safePreviewIssueIds: string[];
    manualReviewIssueIds: string[];
  };
  firstMinuteSummary: ReactWebIssueFirstMinuteSummary;
  issues: ReactWebIssueCard[];
};

export type ReactWebIssueReportSummaryJson = {
  schemaVersion: "react-web-issue-report-summary.v1";
  sourceReportSchemaVersion: typeof REACT_WEB_ISSUE_REPORT_SCHEMA_VERSION;
  command: typeof REACT_WEB_ISSUE_REPORT_COMMAND;
  projection: "summary-json";
  profile: "react-web";
  filePath: string;
  readOnly: true;
  autoApply: false;
  claimBoundary: typeof REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY;
  inScope: boolean;
  skippedReason?: string;
  summary: ReactWebIssueReport["summary"];
  triageTopIds: {
    rankedIssueIds: string[];
    topIssueIds: string[];
    topManualReviewIssueIds: string[];
    safePreviewIssueIds: string[];
    manualReviewIssueIds: string[];
  };
  firstMinuteSummary: ReactWebIssueFirstMinuteSummary;
  decisionSummary: ReturnType<typeof summarizeReactWebDecisions>;
  stopDecision?: ReactWebDecision;
};

export type ReactWebIssueReportMigrationDryRunJson = {
  schemaVersion: "react-web-issue-report-migration-dry-run.v1";
  sourceReportSchemaVersion: typeof REACT_WEB_ISSUE_REPORT_SCHEMA_VERSION;
  command: typeof REACT_WEB_ISSUE_REPORT_COMMAND;
  projection: "migration-dry-run-json";
  profile: "react-web";
  filePath: string;
  readOnly: true;
  dryRunOnly: true;
  autoApply: false;
  claimBoundary: typeof REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY;
  inScope: boolean;
  skippedReason?: string;
  summary: {
    candidateCount: number;
    affectedFiles: string[];
    safePreviewCandidateCount: number;
    manualReviewCandidateCount: number;
  };
  candidates: {
    issueId: string;
    migrationCandidate: ReactWebIssueFixShape;
    affectedFile: string;
    firstInspectStep: string;
    previewAvailable: boolean;
    humanReviewRequired: true;
    autoApply: false;
    dryRunOnly: true;
    riskNotes: string[];
    decision: ReactWebDecision;
  }[];
  decisionSummary: ReturnType<typeof summarizeReactWebDecisions>;
  stopDecision?: ReactWebDecision;
};

export type ReactWebAdvisoryContextGuardResult = {
  schemaVersion: "react-web-advisory-context-guard.v1";
  advisoryFields: ("contextHints" | "conventionHints" | "contextPacket.conventionHints")[];
  protectedFields: string[];
  guardedIssueCount: number;
  guardedFirstMinuteItemCount: number;
  guardedDryRunCandidateCount: number;
};

const REACT_WEB_ADVISORY_CONTEXT_GUARD_SCHEMA_VERSION = "react-web-advisory-context-guard.v1" as const;
const ADVISORY_CONTEXT_AUTHORITY_LEAK_PATTERN =
  /\b(?:advisory convention|repo-owned convention|react-web\.native-label-context|policyBoundary|excludedInference)\b/i;

const ADVISORY_CONTEXT_FIELDS: ReactWebAdvisoryContextGuardResult["advisoryFields"] = [
  "contextHints",
  "conventionHints",
  "contextPacket.conventionHints",
];

const ADVISORY_CONTEXT_PROTECTED_FIELDS = [
  "triage.rank",
  "triage.priority",
  "triage.bucket",
  "triage.evidence",
  "firstMinuteSummary.items.firstInspectStep",
  "firstMinuteSummary.items.inspectFirst",
  "firstMinuteSummary.items.whyThisFirst",
  "firstMinuteSummary.items.nextAction",
  "migrationDryRun.candidates.firstInspectStep",
  "decision.allowedActions.applyPatch",
  "decision.allowedActions.generateCopy",
  "decision.autoApply",
  "decision.humanReviewRequired",
] as const;

function stringifyGuardValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function assertNoAdvisoryContextAuthorityLeak(label: string, value: unknown): void {
  const serialized = stringifyGuardValue(value);
  if (serialized && ADVISORY_CONTEXT_AUTHORITY_LEAK_PATTERN.test(serialized)) {
    throw new Error(`React Web advisory context guard failed: ${label} must stay source-evidence-derived`);
  }
}

function assertReactWebReadOnlyDecisionAuthority(label: string, decision: ReactWebDecision): void {
  if (decision.allowedActions.applyPatch !== false) {
    throw new Error(`React Web advisory context guard failed: ${label}.allowedActions.applyPatch must remain false`);
  }
  if (decision.allowedActions.generateCopy !== false) {
    throw new Error(`React Web advisory context guard failed: ${label}.allowedActions.generateCopy must remain false`);
  }
  if (decision.autoApply !== false) {
    throw new Error(`React Web advisory context guard failed: ${label}.autoApply must remain false`);
  }
  if (decision.humanReviewRequired !== true) {
    throw new Error(`React Web advisory context guard failed: ${label}.humanReviewRequired must remain true`);
  }
}

function advisoryContextGuardResult(options: {
  guardedIssueCount: number;
  guardedFirstMinuteItemCount: number;
  guardedDryRunCandidateCount?: number;
}): ReactWebAdvisoryContextGuardResult {
  return {
    schemaVersion: REACT_WEB_ADVISORY_CONTEXT_GUARD_SCHEMA_VERSION,
    advisoryFields: [...ADVISORY_CONTEXT_FIELDS],
    protectedFields: [...ADVISORY_CONTEXT_PROTECTED_FIELDS],
    guardedIssueCount: options.guardedIssueCount,
    guardedFirstMinuteItemCount: options.guardedFirstMinuteItemCount,
    guardedDryRunCandidateCount: options.guardedDryRunCandidateCount ?? 0,
  };
}

function issueKindFor(finding: ReactWebLabelPatchPreviewFinding): ReactWebIssueKind {
  return `react-web.${finding.kind}` as ReactWebIssueKind;
}

function problemFor(finding: ReactWebLabelPatchPreviewFinding): string {
  switch (finding.kind) {
    case "missing-accessible-label":
      return `Native ${finding.element} lacks recognized accessible-label evidence.`;
    case "ambiguous-accessible-label":
      return `Native ${finding.element} only has ambiguous accessible-label evidence.`;
    case "empty-accessible-name":
      return `Native ${finding.element} has empty accessible-name evidence.`;
    case "unassociated-nearby-label":
      return `Nearby label text is not explicitly associated with this native ${finding.element}.`;
    case "duplicate-literal-id":
      return `Native ${finding.element} has an ambiguous duplicate id association.`;
  }
}

function whyItMattersFor(finding: ReactWebLabelPatchPreviewFinding): string {
  switch (finding.kind) {
    case "missing-accessible-label":
      return "Users of assistive technology may not get a meaningful control name, making the control hard to understand or operate.";
    case "ambiguous-accessible-label":
      return "Placeholder-only labeling can disappear during input and is weaker than an explicit accessible name.";
    case "empty-accessible-name":
      return "A blank aria-label creates accessible-name evidence that communicates no useful control name.";
    case "unassociated-nearby-label":
      return "Visible label text may not be programmatically connected to the native form control.";
    case "duplicate-literal-id":
      return "Duplicate literal id values can make htmlFor/control associations ambiguous for assistive technology and DOM lookup behavior.";
  }
}

function suggestedFixIntentFor(finding: ReactWebLabelPatchPreviewFinding): string {
  switch (finding.kind) {
    case "missing-accessible-label":
      return "Add an explicit accessible label with human-reviewed copy for the native control.";
    case "ambiguous-accessible-label":
      return "Replace placeholder-only labeling with explicit label evidence or human-reviewed aria-label copy.";
    case "empty-accessible-name":
      return "Replace the empty aria-label with human-reviewed accessible-name evidence.";
    case "unassociated-nearby-label":
      return "Connect the nearby native label/control pair with htmlFor/id when the preview evidence remains valid.";
    case "duplicate-literal-id":
      return "Inspect every same-file duplicate id occurrence and choose unique, human-reviewed id/htmlFor associations.";
  }
}

function hasSafePreviewEvidence(finding: ReactWebLabelPatchPreviewFinding): boolean {
  return finding.kind === "unassociated-nearby-label" && finding.confidence === "high";
}

function fixabilityFor(finding: ReactWebLabelPatchPreviewFinding): ReactWebIssueFixability {
  return hasSafePreviewEvidence(finding) ? "safe-preview" : "manual-review";
}

function autoFixSafetyFor(finding: ReactWebLabelPatchPreviewFinding): ReactWebIssueAutoFixSafety {
  return hasSafePreviewEvidence(finding) ? "not-auto-applied" : "unsafe-to-auto-apply";
}

function safetyRationaleFor(finding: ReactWebLabelPatchPreviewFinding): string {
  if (hasSafePreviewEvidence(finding)) {
    return "The report can preview a high-confidence deterministic native htmlFor/id association from existing JSX evidence, but fooks remains read-only and does not apply it.";
  }
  if (finding.kind === "unassociated-nearby-label") {
    return "Nearby label/control evidence is not high-confidence enough for a safe preview, so fooks reports it for manual review and does not auto-apply it.";
  }
  if (finding.kind === "duplicate-literal-id") {
    return "Duplicate literal id associations require source inspection and coordinated id/htmlFor choices, so fooks reports the ambiguity and does not auto-apply it.";
  }
  return "Correct user-facing accessible-name copy requires human review, so fooks reports the issue and does not auto-apply it.";
}

function skipReasonFor(finding: ReactWebLabelPatchPreviewFinding): string {
  if (finding.kind === "unassociated-nearby-label") {
    return "Preview skipped because the nearby label/control association is not high-confidence deterministic evidence.";
  }
  if (finding.kind === "duplicate-literal-id") {
    return "Preview skipped because duplicate literal id associations must be resolved by inspecting every same-file occurrence first.";
  }
  return "Preview skipped because generated accessible-name copy would require human review.";
}

function uniqueRelatedContextSources(
  relatedContext: ReactWebIssueRelatedContext[],
): ReactWebIssueRelatedContext["source"][] {
  return [...new Set(relatedContext.map((item) => item.source))].sort();
}

function relatedContextQualityFor(relatedContext: ReactWebIssueRelatedContext[]): ReactWebRelatedContextQuality {
  const sources = new Set(relatedContext.map((item) => item.source));
  if (sources.has("local-import") || sources.has("nearby-test")) {
    return "local-supporting-context";
  }
  if (sources.has("label-preview")) return "same-file-only";
  return "thin-local-context";
}

function nativeElementWeight(element: ReactWebLabelPatchPreviewFinding["element"]): number {
  switch (element) {
    case "input":
    case "select":
    case "textarea":
      return 2;
    case "button":
      return 1;
  }
}

function triageBucketFor(issue: Pick<ReactWebIssueCard, "confidence" | "fixability">): ReactWebIssueTriageBucket {
  if (issue.fixability === "safe-preview") return "safe-preview";
  return issue.confidence === "high" ? "high-confidence-manual-review" : "manual-review";
}

function priorityFor(score: number): ReactWebIssuePriority {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function triageEvidenceFor(issue: Omit<ReactWebIssueCard, "triage">): ReactWebIssueTriageEvidence {
  const safePreviewAvailable = issue.fixability === "safe-preview" && Boolean(issue.preview);
  const sameFileContextAvailable = issue.relatedContext.some(
    (item) => item.kind === "same-file-pattern" && item.source === "label-preview",
  );
  const relatedContextSources = uniqueRelatedContextSources(issue.relatedContext);
  const relatedContextQuality = relatedContextQualityFor(issue.relatedContext);
  const reasons: string[] = [];
  let score = 0;

  if (safePreviewAvailable) {
    score += 4;
    reasons.push("safe read-only preview is available");
  }
  if (issue.confidence === "high") {
    score += 3;
    reasons.push("label-preview confidence is high");
  } else {
    score += 1;
    reasons.push("label-preview confidence is medium");
  }

  const elementWeight = nativeElementWeight(issue.evidence.element);
  score += elementWeight;
  reasons.push(`native ${issue.evidence.element} element weight +${elementWeight}`);

  if (sameFileContextAvailable) {
    score += 1;
    reasons.push("same-file JSX context is available");
  }

  if (relatedContextQuality === "local-supporting-context") {
    score += 2;
    reasons.push("related local source context is available");
  } else if (relatedContextQuality === "same-file-only") {
    score += 1;
    reasons.push("related context is same-file only");
  } else {
    reasons.push("related context is thin");
  }
  if (issue.relatedContext.length >= 3) {
    score += 1;
    reasons.push("related context has at least three local anchors");
  }

  return {
    safePreviewAvailable,
    confidence: issue.confidence,
    nativeElement: issue.evidence.element,
    sameFileContextAvailable,
    relatedContextCount: issue.relatedContext.length,
    relatedContextSources,
    relatedContextQuality,
    score,
    reasons,
  };
}

function contextAttributeSignals(context: string, element: ReactWebLabelPatchPreviewFinding["element"]): string[] {
  const elementStart = context.lastIndexOf(`<${element}`);
  const attributeContext = elementStart >= 0 ? context.slice(elementStart) : context;
  const signals = new Set<string>();
  const attrPattern = /\s([A-Za-z_:][\w:.-]*)(?:=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(attributeContext))) {
    const name = match[1];
    if (name.startsWith("/")) continue;
    const value = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (value && /^(name|type|id|htmlFor|aria-labelledby|placeholder)$/u.test(name)) {
      signals.add(`${name}=${value}`);
      continue;
    }
    signals.add(name);
  }

  const spreadPattern = /\{\s*\.\.\.\s*([^}]+?)\s*\}/g;
  while ((match = spreadPattern.exec(attributeContext))) {
    signals.add(`spread:${match[1].trim()}`);
  }

  return [...signals].sort();
}

function hasAttributeSignal(attributes: string[], name: string): boolean {
  return attributes.some((attribute) => attribute === name || attribute.startsWith(`${name}=`));
}

function fixShapeFor(options: {
  finding: ReactWebLabelPatchPreviewFinding;
  attributes: string[];
  previewAvailable: boolean;
}): ReactWebIssueFixShape {
  if (options.previewAvailable) return "safe-preview-htmlFor-association";
  if (options.finding.kind === "unassociated-nearby-label") return "human-reviewed-label-association";
  if (options.finding.kind === "ambiguous-accessible-label" && hasAttributeSignal(options.attributes, "placeholder")) {
    return "human-reviewed-placeholder-replacement";
  }
  if (options.finding.kind === "empty-accessible-name") return "human-reviewed-accessible-name";
  if (options.finding.kind === "duplicate-literal-id") return "human-reviewed-duplicate-id-association";
  if (options.finding.element === "button") return "human-reviewed-button-name";
  if (
    hasAttributeSignal(options.attributes, "name") ||
    hasAttributeSignal(options.attributes, "type") ||
    options.attributes.some((attribute) => attribute.startsWith("spread:"))
  ) {
    return "human-reviewed-native-control-name";
  }
  return "human-reviewed-accessible-name";
}

function fixShapeSummaryFor(shape: ReactWebIssueFixShape, element: ReactWebLabelPatchPreviewFinding["element"]): string {
  switch (shape) {
    case "safe-preview-htmlFor-association":
      return `Inspect the read-only htmlFor/id association preview for this native ${element}; use only after human review.`;
    case "human-reviewed-label-association":
      return `Inspect nearby same-file label/control JSX and choose a human-reviewed association shape for this native ${element}.`;
    case "human-reviewed-placeholder-replacement":
      return `Replace placeholder-only evidence with a human-reviewed label shape for this native ${element}; do not reuse placeholder text automatically.`;
    case "human-reviewed-button-name":
      return "Choose a human-reviewed accessible-name shape for this native button from visible content, nearby text, or explicit label evidence.";
    case "human-reviewed-native-control-name":
      return `Use local native ${element} attributes as hints for a human-reviewed accessible-name shape; do not generate copy automatically.`;
    case "human-reviewed-accessible-name":
      return `Choose a human-reviewed accessible-name shape for this native ${element} from local JSX context.`;
    case "human-reviewed-duplicate-id-association":
      return `Inspect duplicate same-file id evidence for this native ${element} and choose unique id/htmlFor associations manually.`;
  }
}

function fixShapeInspectFirstFor(options: {
  filePath: string;
  finding: ReactWebLabelPatchPreviewFinding;
  attributes: string[];
  previewAvailable: boolean;
  relatedContext: ReactWebIssueRelatedContext[];
}): string[] {
  const steps = [
    `Inspect ${options.filePath}:${options.finding.loc.startLine}-${options.finding.loc.endLine} (${options.finding.element}) before editing.`,
  ];
  steps.push(`Confirm the current source still matches this native ${options.finding.element} evidence before suggesting changes.`);
  if (options.attributes.length > 0) {
    steps.push(`Use current attribute evidence as hints only: ${options.attributes.slice(0, 6).join(", ")}.`);
  }
  if (options.finding.kind === "duplicate-literal-id" && options.finding.duplicateId) {
    steps.push(`Inspect duplicate id lines: ${options.finding.duplicateId.lines.join(", ")} for id "${options.finding.duplicateId.value}" before choosing replacement ids.`);
  }
  if (options.previewAvailable) {
    steps.push("Review the safe preview diff as a candidate shape; fooks still does not apply it.");
  } else {
    steps.push("Select the final label/name text manually; fooks does not generate final label/name copy.");
  }
  steps.push("If this is a custom component or the evidence changed, stop and read the source normally.");
  for (const item of options.relatedContext.slice(0, 2)) {
    const location = `${item.file}${item.line ? `:${item.line}${item.endLine && item.endLine !== item.line ? `-${item.endLine}` : ""}` : ""}`;
    steps.push(`Inspect related ${item.kind} (${item.source}) at ${location}.`);
  }
  return steps;
}

function fixShapeGuidanceFor(options: {
  filePath: string;
  finding: ReactWebLabelPatchPreviewFinding;
  previewAvailable: boolean;
  relatedContext: ReactWebIssueRelatedContext[];
}): ReactWebIssueFixShapeGuidance {
  const attributes = contextAttributeSignals(options.finding.context, options.finding.element);
  const sameFileContextAvailable = options.relatedContext.some(
    (item) => item.kind === "same-file-pattern" && item.source === "label-preview",
  );
  const shape = fixShapeFor({ finding: options.finding, attributes, previewAvailable: options.previewAvailable });
  return {
    claimBoundary:
      "Local fix-shape guidance only: uses native element, same-file JSX attributes/context, safe-preview presence, and related-context entries; it is read-only, requires human review, and does not generate accessible-name copy or infer custom-component semantics.",
    shape,
    summary: fixShapeSummaryFor(shape, options.finding.element),
    inspectFirst: fixShapeInspectFirstFor({
      filePath: options.filePath,
      finding: options.finding,
      attributes,
      previewAvailable: options.previewAvailable,
      relatedContext: options.relatedContext,
    }),
    localEvidence: {
      element: options.finding.element,
      attributes,
      sameFileContextAvailable,
      safePreviewAvailable: options.previewAvailable,
      relatedContextCount: options.relatedContext.length,
      relatedContextSources: uniqueRelatedContextSources(options.relatedContext),
    },
    humanReviewRequired: true,
    autoApply: false,
  };
}

function contextPacketRelatedPatternFor(options: {
  finding: ReactWebLabelPatchPreviewFinding;
  fixability: ReactWebIssueFixability;
  previewAvailable: boolean;
}): string {
  const base = `${issueKindFor(options.finding)} on a native ${options.finding.element}`;
  if (options.previewAvailable) {
    return `${base}; safe-preview pattern because existing JSX provides deterministic nearby label/control association evidence.`;
  }
  if (options.finding.kind === "duplicate-literal-id") {
    const lines = options.finding.duplicateId?.lines.join(",") ?? "unknown";
    return `${base}; manual-review duplicate-id pattern because same-file literal id evidence appears on lines ${lines}.`;
  }
  if (options.finding.kind === "unassociated-nearby-label") {
    return `${base}; manual-review association pattern because nearby label/control evidence is not deterministic enough for a safe preview.`;
  }
  return `${base}; ${options.fixability} pattern because final accessible-name copy requires human review.`;
}

function contextPacketNearbyPrecedentFor(relatedContext: ReactWebIssueRelatedContext[]): string {
  const precedent =
    relatedContext.find((item) => item.source === "local-import" || item.source === "nearby-test") ??
    relatedContext.find((item) => item.kind !== "same-file-pattern") ??
    relatedContext[0];

  if (!precedent) {
    return "No nearby precedent found; inspect only the source finding before considering edits.";
  }

  const location = `${precedent.file}${precedent.line ? `:${precedent.line}${precedent.endLine && precedent.endLine !== precedent.line ? `-${precedent.endLine}` : ""}` : ""}`;
  return `${precedent.kind} (${precedent.source}, ${precedent.confidence}) at ${location}: ${precedent.reason}`;
}

function excludedInferenceFor(options: {
  finding: ReactWebLabelPatchPreviewFinding;
  previewAvailable: boolean;
}): string[] {
  const excluded = [
    "Does not infer custom-component semantics.",
    "Does not claim broad accessibility coverage beyond the native JSX label subset.",
    "Does not auto-apply patches or make files editable from this report.",
  ];
  if (options.previewAvailable) {
    excluded.push("Safe preview is a candidate diff only; it is not an applied migration.");
  } else {
    excluded.push("Does not generate final accessible-name copy for manual-review cards.");
  }
  if (options.finding.kind === "unassociated-nearby-label" && !options.previewAvailable) {
    excluded.push("Does not infer htmlFor/id association when nearby label evidence is not high-confidence deterministic.");
  }
  if (options.finding.kind === "duplicate-literal-id") {
    excluded.push("Does not choose replacement ids or rewrite htmlFor associations for duplicate id cards.");
  }
  return excluded;
}

function contextPacketFor(options: {
  filePath: string;
  finding: ReactWebLabelPatchPreviewFinding;
  fixability: ReactWebIssueFixability;
  previewAvailable: boolean;
  relatedContext: ReactWebIssueRelatedContext[];
  conventionHints: RepoOwnedConventionHintProjection[];
}): ReactWebIssueContextPacket {
  return {
    whyThisFile: `Direct label-preview evidence in ${options.filePath}:${options.finding.loc.startLine}-${options.finding.loc.endLine} produced this native ${options.finding.element} issue card.`,
    relatedPattern: contextPacketRelatedPatternFor({
      finding: options.finding,
      fixability: options.fixability,
      previewAvailable: options.previewAvailable,
    }),
    nearbyPrecedent: contextPacketNearbyPrecedentFor(options.relatedContext),
    confidence: options.finding.confidence,
    excludedInference: excludedInferenceFor({
      finding: options.finding,
      previewAvailable: options.previewAvailable,
    }),
    conventionHints: options.conventionHints.map((hint) => `${hint.id}: ${hint.summary}`),
  };
}

function issueCardFor(
  filePath: string,
  finding: ReactWebLabelPatchPreviewFinding,
  index: number,
  relatedContext: ReactWebIssueRelatedContext[],
): ReactWebIssueCard {
  const isSafePreview = hasSafePreviewEvidence(finding);
  const preview = isSafePreview && finding.suggestedPatch.readOnly
    ? {
        type: finding.suggestedPatch.type,
        readOnly: true as const,
        text: finding.suggestedPatch.preview,
      }
    : undefined;
  const suggestedAction = suggestedFixIntentFor(finding);
  const safetyRationale = safetyRationaleFor(finding);
  const fixability = fixabilityFor(finding);
  const conventionHints = findRepoOwnedConventionHintsForIssue({
    profile: "react-web",
    issueKind: issueKindFor(finding),
    element: finding.element,
    filePath,
  });
  const fixShapeGuidance = fixShapeGuidanceFor({
    filePath,
    finding,
    previewAvailable: Boolean(preview),
    relatedContext,
  });
  const issueWithoutTriage = {
    id: `react-web-label-${index + 1}`,
    kind: issueKindFor(finding),
    problem: problemFor(finding),
    whyItMatters: whyItMattersFor(finding),
    evidence: {
      filePath,
      line: finding.loc.startLine,
      endLine: finding.loc.endLine,
      context: finding.context,
      sourceSignals: finding.evidence,
      element: finding.element,
    },
    whereToLook: {
      filePath,
      line: finding.loc.startLine,
      endLine: finding.loc.endLine,
      context: finding.context,
    },
    relatedContext,
    confidence: finding.confidence,
    fixability,
    autoFixSafety: autoFixSafetyFor(finding),
    safetyRationale,
    suggestedFixIntent: suggestedAction,
    suggestedAction,
    contextPacket: contextPacketFor({
      filePath,
      finding,
      fixability,
      previewAvailable: Boolean(preview),
      relatedContext,
      conventionHints,
    }),
    conventionHints,
    fixShapeGuidance,
    decision: buildReactWebIssueDecision({
      cardId: `react-web-label-${index + 1}`,
      issueKind: issueKindFor(finding),
      confidence: finding.confidence,
      fixability,
      previewAvailable: Boolean(preview),
      ...(!isSafePreview ? { skipReason: skipReasonFor(finding) } : {}),
    }),
    ...(!isSafePreview ? { skipReason: skipReasonFor(finding) } : {}),
    ...(preview ? { preview } : {}),
  };
  const evidence = triageEvidenceFor(issueWithoutTriage);
  return {
    ...issueWithoutTriage,
    triage: {
      rank: index + 1,
      priority: priorityFor(evidence.score),
      bucket: triageBucketFor(issueWithoutTriage),
      evidence,
    },
  };
}

function compareIssuePriority(a: ReactWebIssueCard, b: ReactWebIssueCard): number {
  return (
    b.triage.evidence.score - a.triage.evidence.score ||
    Number(b.triage.evidence.safePreviewAvailable) - Number(a.triage.evidence.safePreviewAvailable) ||
    (b.confidence === "high" ? 1 : 0) - (a.confidence === "high" ? 1 : 0) ||
    nativeElementWeight(b.evidence.element) - nativeElementWeight(a.evidence.element) ||
    b.triage.evidence.relatedContextCount - a.triage.evidence.relatedContextCount ||
    a.whereToLook.line - b.whereToLook.line
  );
}

function withTriageRanks(issues: ReactWebIssueCard[]): ReactWebIssueCard[] {
  const ranks = new Map<string, number>();
  [...issues].sort(compareIssuePriority).forEach((issue, index) => ranks.set(issue.id, index + 1));
  return issues.map((issue) => ({
    ...issue,
    triage: {
      ...issue.triage,
      rank: ranks.get(issue.id) ?? issue.triage.rank,
    },
  }));
}

function buildTriageRollup(issues: ReactWebIssueCard[]): ReactWebIssueReport["triageRollup"] {
  const ranked = [...issues].sort(compareIssuePriority);
  return {
    claimBoundary:
      "Conservative local triage only: ranks issue cards from existing report evidence and does not edit files, auto-apply patches, infer custom-component semantics, or claim a broad accessibility audit.",
    criteria: [
      "safe preview availability",
      "label-preview confidence",
      "native element type",
      "same-file JSX context",
      "related-context count and source quality",
    ],
    priorityCounts: {
      high: issues.filter((issue) => issue.triage.priority === "high").length,
      medium: issues.filter((issue) => issue.triage.priority === "medium").length,
      low: issues.filter((issue) => issue.triage.priority === "low").length,
    },
    bucketCounts: {
      "safe-preview": issues.filter((issue) => issue.triage.bucket === "safe-preview").length,
      "high-confidence-manual-review": issues.filter((issue) => issue.triage.bucket === "high-confidence-manual-review").length,
      "manual-review": issues.filter((issue) => issue.triage.bucket === "manual-review").length,
    },
    rankedIssueIds: ranked.map((issue) => issue.id),
    topIssueIds: ranked.slice(0, 3).map((issue) => issue.id),
    topManualReviewIssueIds: ranked
      .filter((issue) => issue.fixability === "manual-review")
      .slice(0, 3)
      .map((issue) => issue.id),
    safePreviewIssueIds: ranked
      .filter((issue) => issue.fixability === "safe-preview")
      .map((issue) => issue.id),
    manualReviewIssueIds: ranked
      .filter((issue) => issue.fixability === "manual-review")
      .map((issue) => issue.id),
  };
}

function firstInspectStepFor(issue: ReactWebIssueCard): string {
  return issue.fixShapeGuidance.inspectFirst[0] ?? `${issue.whereToLook.filePath}:${issue.whereToLook.line}-${issue.whereToLook.endLine}`;
}

function trimSummaryText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function uniqueCompactStrings(values: string[], maxItems: number, maxLength: number): string[] {
  const seen = new Set<string>();
  const compact: string[] = [];
  for (const value of values) {
    const normalized = trimSummaryText(value.replace(/\s+/g, " ").trim(), maxLength);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    compact.push(normalized);
    if (compact.length >= maxItems) break;
  }
  return compact;
}

function whyThisFirstFor(issue: ReactWebIssueCard): string {
  const reason = issue.triage.evidence.reasons[0] ?? `${issue.triage.evidence.relatedContextQuality} local context`;
  return trimSummaryText(
    `Rank ${issue.triage.rank} ${issue.triage.priority} issue because ${reason}; ${issue.triage.bucket} remains human-reviewed.`,
    180,
  );
}

function nextActionFor(issue: ReactWebIssueCard): string {
  const target = firstInspectStepFor(issue)
    .replace(/^Inspect\s+/u, "")
    .replace(/\s+before editing\.$/u, "");
  return trimSummaryText(`Inspect ${target} first; confirm current source still matches before suggesting changes.`, 180);
}

function humanDecisionNeededFor(issue: ReactWebIssueCard): string[] {
  const decisions = ["Confirm the final accessible label/name copy from current source context."];
  if (issue.fixability === "safe-preview") {
    decisions.push("Confirm the htmlFor/id association before using the preview shape.");
  } else {
    decisions.push("Choose the label/name shape from local JSX evidence.");
  }
  return uniqueCompactStrings(decisions, 2, 120);
}

function doNotDoFor(): string[] {
  return uniqueCompactStrings(
    [
      "Do not apply patches automatically from this report.",
      "Do not infer custom-component semantics.",
      "Do not generate final label/name copy automatically.",
    ],
    3,
    120,
  );
}

function conventionContextHintFor(hint: RepoOwnedConventionHintProjection): string {
  const inspectPointer = hint.inspectFirst[0]
    ?.replace(/^Inspect/u, "inspect")
    .replace(/\.$/u, "") ?? hint.summary;
  return trimSummaryText(`advisory convention ${hint.id}: ${inspectPointer}`, 100);
}

function contextHintsFor(issue: ReactWebIssueCard): string[] {
  const hints = [
    `native ${issue.evidence.element} at ${issue.whereToLook.filePath}:${issue.whereToLook.line}-${issue.whereToLook.endLine}`,
    `${issue.triage.evidence.relatedContextQuality} context`,
  ];
  for (const hint of issue.conventionHints.slice(0, 1)) {
    hints.push(conventionContextHintFor(hint));
  }
  if (issue.triage.evidence.safePreviewAvailable) {
    hints.push("safe-preview candidate available");
  }
  if (issue.triage.evidence.relatedContextSources.length > 0) {
    hints.push(`related sources: ${issue.triage.evidence.relatedContextSources.slice(0, 3).join(", ")}`);
  }
  return uniqueCompactStrings(hints, 4, 100);
}

function assertIssueCardAdvisoryContextGuard(issue: ReactWebIssueCard): void {
  assertNoAdvisoryContextAuthorityLeak(`issue ${issue.id} triage`, issue.triage);
  assertNoAdvisoryContextAuthorityLeak(`issue ${issue.id} fixShapeGuidance.inspectFirst`, issue.fixShapeGuidance.inspectFirst);
  assertReactWebReadOnlyDecisionAuthority(`issue ${issue.id} decision`, issue.decision);
}

function guardFirstMinuteSummaryItem(
  issue: ReactWebIssueCard,
  item: ReactWebIssueFirstMinuteSummaryItem,
): ReactWebIssueFirstMinuteSummaryItem {
  if (item.issueId !== issue.id) {
    throw new Error(`React Web advisory context guard failed: first-minute item ${item.issueId} must match source issue ${issue.id}`);
  }
  if (item.fixShape !== issue.fixShapeGuidance.shape) {
    throw new Error(`React Web advisory context guard failed: first-minute item ${item.issueId} fixShape must come from source issue`);
  }
  if (item.firstInspectStep !== firstInspectStepFor(issue)) {
    throw new Error(`React Web advisory context guard failed: first-minute item ${item.issueId} firstInspectStep must come from source issue evidence`);
  }
  if (JSON.stringify(item.inspectFirst) !== JSON.stringify(issue.fixShapeGuidance.inspectFirst)) {
    throw new Error(`React Web advisory context guard failed: first-minute item ${item.issueId} inspectFirst must come from source issue evidence`);
  }
  if (item.whyThisFirst !== whyThisFirstFor(issue)) {
    throw new Error(`React Web advisory context guard failed: first-minute item ${item.issueId} whyThisFirst must come from source triage evidence`);
  }
  if (item.nextAction !== nextActionFor(issue)) {
    throw new Error(`React Web advisory context guard failed: first-minute item ${item.issueId} nextAction must come from source issue evidence`);
  }
  assertNoAdvisoryContextAuthorityLeak(`first-minute item ${item.issueId} firstInspectStep`, item.firstInspectStep);
  assertNoAdvisoryContextAuthorityLeak(`first-minute item ${item.issueId} inspectFirst`, item.inspectFirst);
  assertNoAdvisoryContextAuthorityLeak(`first-minute item ${item.issueId} whyThisFirst`, item.whyThisFirst);
  assertNoAdvisoryContextAuthorityLeak(`first-minute item ${item.issueId} nextAction`, item.nextAction);
  assertReactWebReadOnlyDecisionAuthority(`first-minute item ${item.issueId} decision`, item.decision);
  return item;
}

function buildFirstMinuteSummary(
  triageRollup: ReactWebIssueReport["triageRollup"],
  issues: ReactWebIssueCard[],
): ReactWebIssueFirstMinuteSummary {
  const issuesById = new Map(issues.map((issue) => [issue.id, issue]));
  const items = triageRollup.topIssueIds
    .map((id) => issuesById.get(id))
    .filter((issue): issue is ReactWebIssueCard => Boolean(issue))
    .map((issue) => guardFirstMinuteSummaryItem(issue, {
      issueId: issue.id,
      fixShape: issue.fixShapeGuidance.shape,
      firstInspectStep: firstInspectStepFor(issue),
      inspectFirst: [...issue.fixShapeGuidance.inspectFirst],
      whyThisFirst: whyThisFirstFor(issue),
      nextAction: nextActionFor(issue),
      humanDecisionNeeded: humanDecisionNeededFor(issue),
      doNotDo: doNotDoFor(),
      contextHints: contextHintsFor(issue),
      fixShapeGuidance: {
        claimBoundary: issue.fixShapeGuidance.claimBoundary,
        humanReviewRequired: issue.fixShapeGuidance.humanReviewRequired,
        autoApply: issue.fixShapeGuidance.autoApply,
      },
      decision: buildReactWebProjectionDecision({ sourceDecision: issue.decision, projection: "summary-json" }),
    }));
  return {
    sourceTopIssueIds: [...triageRollup.topIssueIds],
    items,
  };
}

export function buildReactWebIssueReport(filePath: string, cwd = process.cwd()): ReactWebIssueReport {
  const preview = buildReactWebLabelPatchPreview(filePath, cwd);
  const issues = withTriageRanks(preview.findings.map((finding, index) =>
    issueCardFor(
      preview.filePath,
      finding,
      index,
      buildReactWebIssueRelatedContext(preview.filePath, finding, cwd),
    ),
  ));
  const triageRollup = buildTriageRollup(issues);
  const stopDecision = issues.length === 0
    ? buildReactWebStopDecision({
        state: preview.inScope ? "incomplete" : "unsupported",
        reason: preview.inScope
          ? "No React Web issue cards were produced from the current bounded label-preview evidence."
          : preview.skippedReason ?? "Unsupported React Web issue-report boundary.",
        projection: "issue-card",
        stopConditions: preview.inScope
          ? ["Do not invent issue cards when the bounded detector produced no findings."]
          : ["Unsupported domains must not be converted into React Web work orders."],
      })
    : undefined;
  const decisionSummary = summarizeReactWebDecisions(stopDecision ? [stopDecision] : issues.map((issue) => issue.decision));
  const report: ReactWebIssueReport = {
    schemaVersion: REACT_WEB_ISSUE_REPORT_SCHEMA_VERSION,
    command: REACT_WEB_ISSUE_REPORT_COMMAND,
    profile: "react-web",
    filePath: preview.filePath,
    readOnly: true,
    autoApply: false,
    claimBoundary: REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY,
    sourcePreview: {
      schemaVersion: preview.schemaVersion,
      claimBoundary: preview.claimBoundary,
      findingCount: preview.summary.findingCount,
    },
    inScope: preview.inScope,
    ...(preview.skippedReason ? { skippedReason: preview.skippedReason } : {}),
    summary: {
      issueCount: issues.length,
      safePreviewCount: issues.filter((issue) => issue.fixability === "safe-preview").length,
      manualReviewCount: issues.filter((issue) => issue.fixability === "manual-review").length,
      unsafeToAutoApplyCount: issues.filter((issue) => issue.autoFixSafety === "unsafe-to-auto-apply").length,
    },
    decisionSummary,
    ...(stopDecision ? { stopDecision } : {}),
    triageRollup,
    firstMinuteSummary: buildFirstMinuteSummary(triageRollup, issues),
    issues,
  };
  validateReactWebAdvisoryContextGuard(report);
  return report;
}

export function validateReactWebAdvisoryContextGuard(report: ReactWebIssueReport): ReactWebAdvisoryContextGuardResult {
  const issuesById = new Map(report.issues.map((issue) => [issue.id, issue]));
  if (JSON.stringify(report.firstMinuteSummary.sourceTopIssueIds) !== JSON.stringify(report.triageRollup.topIssueIds)) {
    throw new Error("React Web advisory context guard failed: first-minute sourceTopIssueIds must mirror triage topIssueIds");
  }

  for (const issue of report.issues) assertIssueCardAdvisoryContextGuard(issue);
  for (const item of report.firstMinuteSummary.items) {
    const issue = issuesById.get(item.issueId);
    if (!issue) throw new Error(`React Web advisory context guard failed: first-minute item ${item.issueId} must reference a source issue`);
    guardFirstMinuteSummaryItem(issue, item);
  }
  if (report.stopDecision) assertReactWebReadOnlyDecisionAuthority("stopDecision", report.stopDecision);

  return advisoryContextGuardResult({
    guardedIssueCount: report.issues.length,
    guardedFirstMinuteItemCount: report.firstMinuteSummary.items.length,
  });
}

export function buildReactWebIssueReportSummaryJson(report: ReactWebIssueReport): ReactWebIssueReportSummaryJson {
  return {
    schemaVersion: "react-web-issue-report-summary.v1",
    sourceReportSchemaVersion: report.schemaVersion,
    command: report.command,
    projection: "summary-json",
    profile: report.profile,
    filePath: report.filePath,
    readOnly: report.readOnly,
    autoApply: report.autoApply,
    claimBoundary: report.claimBoundary,
    inScope: report.inScope,
    ...(report.skippedReason ? { skippedReason: report.skippedReason } : {}),
    summary: report.summary,
    decisionSummary: report.decisionSummary,
    ...(report.stopDecision ? { stopDecision: { ...report.stopDecision, source: { ...report.stopDecision.source, projection: "summary-json" } } } : {}),
    triageTopIds: {
      rankedIssueIds: report.triageRollup.rankedIssueIds,
      topIssueIds: report.triageRollup.topIssueIds,
      topManualReviewIssueIds: report.triageRollup.topManualReviewIssueIds,
      safePreviewIssueIds: report.triageRollup.safePreviewIssueIds,
      manualReviewIssueIds: report.triageRollup.manualReviewIssueIds,
    },
    firstMinuteSummary: report.firstMinuteSummary,
  };
}

function guardMigrationDryRunCandidate(
  issue: ReactWebIssueCard,
  candidate: ReactWebIssueReportMigrationDryRunJson["candidates"][number],
): ReactWebIssueReportMigrationDryRunJson["candidates"][number] {
  if (candidate.issueId !== issue.id) {
    throw new Error(`React Web advisory context guard failed: dry-run candidate ${candidate.issueId} must match source issue ${issue.id}`);
  }
  if (candidate.firstInspectStep !== firstInspectStepFor(issue)) {
    throw new Error(`React Web advisory context guard failed: dry-run candidate ${candidate.issueId} firstInspectStep must come from source issue evidence`);
  }
  if (candidate.migrationCandidate !== issue.fixShapeGuidance.shape) {
    throw new Error(`React Web advisory context guard failed: dry-run candidate ${candidate.issueId} migrationCandidate must come from source issue evidence`);
  }
  assertNoAdvisoryContextAuthorityLeak(`dry-run candidate ${candidate.issueId} firstInspectStep`, candidate.firstInspectStep);
  assertReactWebReadOnlyDecisionAuthority(`dry-run candidate ${candidate.issueId} decision`, candidate.decision);
  if (candidate.autoApply !== false || candidate.dryRunOnly !== true || candidate.humanReviewRequired !== true) {
    throw new Error(`React Web advisory context guard failed: dry-run candidate ${candidate.issueId} must remain dry-run/manual-review only`);
  }
  return candidate;
}

export function validateReactWebMigrationDryRunAdvisoryContextGuard(
  report: ReactWebIssueReport,
  dryRun: ReactWebIssueReportMigrationDryRunJson,
): ReactWebAdvisoryContextGuardResult {
  const issuesById = new Map(report.issues.map((issue) => [issue.id, issue]));
  const rankedIssueIds = [...report.issues].sort((a, b) => a.triage.rank - b.triage.rank).map((issue) => issue.id);
  const candidateIssueIds = dryRun.candidates.map((candidate) => candidate.issueId);
  if (JSON.stringify(candidateIssueIds) !== JSON.stringify(rankedIssueIds)) {
    throw new Error("React Web advisory context guard failed: dry-run candidates must follow source triage rank order");
  }
  for (const candidate of dryRun.candidates) {
    const issue = issuesById.get(candidate.issueId);
    if (!issue) throw new Error(`React Web advisory context guard failed: dry-run candidate ${candidate.issueId} must reference a source issue`);
    guardMigrationDryRunCandidate(issue, candidate);
  }
  if (dryRun.stopDecision) assertReactWebReadOnlyDecisionAuthority("dryRun.stopDecision", dryRun.stopDecision);

  return advisoryContextGuardResult({
    guardedIssueCount: report.issues.length,
    guardedFirstMinuteItemCount: 0,
    guardedDryRunCandidateCount: dryRun.candidates.length,
  });
}

function migrationRiskNotesFor(issue: ReactWebIssueCard): string[] {
  const notes = [
    issue.safetyRationale,
    issue.fixability === "safe-preview"
      ? "Safe preview is a read-only shape candidate and still requires human review before use."
      : "No deterministic safe preview is available; choose the final label/name shape from local source context.",
    "Do not apply patches automatically or generate accessible-name copy from this dry run.",
    "Do not infer custom-component semantics.",
  ];
  return uniqueCompactStrings(notes, 4, 160);
}

export function buildReactWebIssueReportMigrationDryRunJson(
  report: ReactWebIssueReport,
): ReactWebIssueReportMigrationDryRunJson {
  const rankedIssues = [...report.issues].sort((a, b) => a.triage.rank - b.triage.rank);
  const candidates = rankedIssues.map((issue) => guardMigrationDryRunCandidate(issue, {
    issueId: issue.id,
    migrationCandidate: issue.fixShapeGuidance.shape,
    affectedFile: issue.whereToLook.filePath,
    firstInspectStep: firstInspectStepFor(issue),
    previewAvailable: issue.triage.evidence.safePreviewAvailable,
    humanReviewRequired: true as const,
    autoApply: false as const,
    dryRunOnly: true as const,
    riskNotes: migrationRiskNotesFor(issue),
    decision: buildReactWebProjectionDecision({ sourceDecision: issue.decision, projection: "dry-run-json" }),
  }));
  const stopDecision = candidates.length === 0
    ? buildReactWebStopDecision({
        state: report.inScope ? "incomplete" : "unsupported",
        reason: report.inScope
          ? "No dry-run candidates were produced from the current React Web issue report."
          : report.skippedReason ?? "Unsupported React Web dry-run boundary.",
        projection: "dry-run-json",
        dryRunOnly: true,
        stopConditions: report.inScope
          ? ["Do not invent dry-run candidates when no issue cards exist."]
          : ["Unsupported domains must not be converted into dry-run candidates."],
      })
    : undefined;
  const decisionSummary = summarizeReactWebDecisions(stopDecision ? [stopDecision] : candidates.map((candidate) => candidate.decision));

  const dryRun: ReactWebIssueReportMigrationDryRunJson = {
    schemaVersion: "react-web-issue-report-migration-dry-run.v1",
    sourceReportSchemaVersion: report.schemaVersion,
    command: report.command,
    projection: "migration-dry-run-json",
    profile: report.profile,
    filePath: report.filePath,
    readOnly: true,
    dryRunOnly: true,
    autoApply: false,
    claimBoundary: report.claimBoundary,
    inScope: report.inScope,
    ...(report.skippedReason ? { skippedReason: report.skippedReason } : {}),
    summary: {
      candidateCount: candidates.length,
      affectedFiles: [...new Set(candidates.map((candidate) => candidate.affectedFile))].sort(),
      safePreviewCandidateCount: candidates.filter((candidate) => candidate.previewAvailable).length,
      manualReviewCandidateCount: candidates.filter((candidate) => !candidate.previewAvailable).length,
    },
    candidates,
    decisionSummary,
    ...(stopDecision ? { stopDecision } : {}),
  };
  validateReactWebMigrationDryRunAdvisoryContextGuard(report, dryRun);
  return dryRun;
}

export function renderReactWebIssueReportText(report: ReactWebIssueReport): string {
  const lines = [
    "# React Web issue report",
    "",
    report.claimBoundary,
    "",
    `File: ${report.filePath}`,
    `Read-only: ${report.readOnly ? "yes" : "no"}`,
    `Auto-apply: ${report.autoApply ? "yes" : "no"}`,
    `In scope: ${report.inScope ? "yes" : "no"}`,
    `Issues: ${report.summary.issueCount} (safe preview: ${report.summary.safePreviewCount}, manual review: ${report.summary.manualReviewCount}, unsafe to auto-apply: ${report.summary.unsafeToAutoApplyCount})`,
  ];
  if (report.skippedReason) lines.push(`Skipped: ${report.skippedReason}`);
  if (report.issues.length === 0) return `${lines.join("\n")}\n`;

  lines.push(
    "",
    "## Triage rollup",
    report.triageRollup.claimBoundary,
    `- priority counts: high ${report.triageRollup.priorityCounts.high}, medium ${report.triageRollup.priorityCounts.medium}, low ${report.triageRollup.priorityCounts.low}`,
    `- buckets: safe preview ${report.triageRollup.bucketCounts["safe-preview"]}, high-confidence manual review ${report.triageRollup.bucketCounts["high-confidence-manual-review"]}, manual review ${report.triageRollup.bucketCounts["manual-review"]}`,
    `- ranked issue ids: ${report.triageRollup.rankedIssueIds.join(", ") || "none"}`,
    `- top manual-review ids: ${report.triageRollup.topManualReviewIssueIds.join(", ") || "none"}`,
    `- criteria: ${report.triageRollup.criteria.join("; ")}`,
  );

  if (report.firstMinuteSummary.items.length > 0) {
    lines.push(
      "",
      "## First-minute summary",
      "- Compact read-only triage from existing ranked issue evidence; inspect before editing and keep human review for final label/name decisions.",
    );
    for (const item of report.firstMinuteSummary.items) {
      lines.push(
        `- ${item.issueId}: ${item.fixShape}; first inspect: ${item.firstInspectStep}`,
        `  - why this first: ${item.whyThisFirst}`,
        `  - next action: ${item.nextAction}`,
        `  - human decision needed: ${item.humanDecisionNeeded.join("; ")}`,
        `  - do not do: ${item.doNotDo.join("; ")}`,
        `  - context hints: ${item.contextHints.join("; ")}`,
      );
    }
  }

  report.issues.forEach((issue, index) => {
    lines.push(
      "",
      `## Issue ${index + 1}: ${issue.problem}`,
      `- triage: rank ${issue.triage.rank}, ${issue.triage.priority} priority, ${issue.triage.bucket}, score ${issue.triage.evidence.score}`,
      `- triage evidence: safe preview ${issue.triage.evidence.safePreviewAvailable ? "yes" : "no"}, same-file context ${issue.triage.evidence.sameFileContextAvailable ? "yes" : "no"}, related context ${issue.triage.evidence.relatedContextCount} (${issue.triage.evidence.relatedContextQuality})`,
      `- why: ${issue.whyItMatters}`,
      `- where to look: ${issue.whereToLook.filePath}:${issue.whereToLook.line}-${issue.whereToLook.endLine}`,
      `- element: ${issue.evidence.element}`,
      `- confidence: ${issue.confidence}`,
      `- fixability: ${issue.fixability}`,
      `- auto-fix safety: ${issue.autoFixSafety}`,
      `- safety rationale: ${issue.safetyRationale}`,
      ...(issue.skipReason ? [`- skip reason: ${issue.skipReason}`] : []),
      `- suggested action: ${issue.suggestedAction}`,
      "- context packet:",
      `  - why this file: ${issue.contextPacket.whyThisFile}`,
      `  - related pattern: ${issue.contextPacket.relatedPattern}`,
      `  - nearby precedent: ${issue.contextPacket.nearbyPrecedent}`,
      `  - confidence: ${issue.contextPacket.confidence}`,
      `  - excluded inference: ${issue.contextPacket.excludedInference.join("; ")}`,
      `- fix shape: ${issue.fixShapeGuidance.shape} — ${issue.fixShapeGuidance.summary}`,
      `- evidence: ${issue.evidence.sourceSignals.join(", ")}`,
      `- context: ${issue.evidence.context}`,
    );
    if (issue.conventionHints.length > 0) {
      lines.push("- convention hints:");
      for (const hint of issue.conventionHints) {
        lines.push(`  - ${hint.id} (${hint.confidence}, advisory): ${hint.summary}`);
        lines.push(`    boundary: ${hint.policyBoundary}`);
        lines.push(`    inspect first: ${hint.inspectFirst.join("; ")}`);
      }
    }
    if (issue.fixShapeGuidance.inspectFirst.length > 0) {
      lines.push("- inspect first for fix shape:");
      for (const item of issue.fixShapeGuidance.inspectFirst) {
        lines.push(`  - ${item}`);
      }
    }
    if (issue.relatedContext.length > 0) {
      lines.push("- inspect first:");
      for (const item of issue.relatedContext) {
        const location = ` ${item.file}${item.line ? `:${item.line}${item.endLine && item.endLine !== item.line ? `-${item.endLine}` : ""}` : ""}`;
        const context = item.context ? ` — ${item.context}` : "";
        lines.push(`  - ${item.kind} (${item.confidence}, ${item.source}): ${item.reason}${location}${context}`);
      }
    }
    if (issue.preview) {
      lines.push("", "```diff", issue.preview.text, "```");
    }
  });

  return `${lines.join("\n")}\n`;
}
