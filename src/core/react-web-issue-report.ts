import {
  buildReactWebLabelPatchPreview,
  REACT_WEB_LABEL_PATCH_PREVIEW_CLAIM_BOUNDARY,
  type ReactWebLabelPatchPreview,
  type ReactWebLabelPatchPreviewFinding,
} from "./react-web-label-preview";
import {
  buildReactWebIssueRelatedContext,
  getReactWebIssueContextMetadata,
  type ReactWebIssueRelatedContext,
} from "./react-web-issue-related-context";

export const REACT_WEB_ISSUE_REPORT_SCHEMA_VERSION = "react-web-issue-report.v1" as const;
export const REACT_WEB_ISSUE_REPORT_COMMAND = "inspect react-web-issues" as const;
export const REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY =
  "Read-only React Web issue report for a narrow native JSX label/accessibility subset only: adapts label-preview findings into actionable issue cards, never edits files, does not auto-apply patches, does not claim broad accessibility coverage, and does not infer custom-component semantics." as const;

type ReactWebIssueConfidence = "high" | "medium";
type ReactWebIssueFixability = "safe-preview" | "manual-review";
type ReactWebIssueAutoFixSafety = "not-auto-applied" | "unsafe-to-auto-apply";
type ReactWebIssueKind =
  | "react-web.missing-accessible-label"
  | "react-web.ambiguous-accessible-label"
  | "react-web.unassociated-nearby-label";

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
  skipReason?: string;
  preview?: {
    type: "unified-diff-fragment";
    readOnly: true;
    text: string;
  };
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
  issues: ReactWebIssueCard[];
};

function issueKindFor(finding: ReactWebLabelPatchPreviewFinding): ReactWebIssueKind {
  return `react-web.${finding.kind}` as ReactWebIssueKind;
}

function problemFor(finding: ReactWebLabelPatchPreviewFinding): string {
  switch (finding.kind) {
    case "missing-accessible-label":
      return `Native ${finding.element} lacks recognized accessible-label evidence.`;
    case "ambiguous-accessible-label":
      return `Native ${finding.element} only has ambiguous accessible-label evidence.`;
    case "unassociated-nearby-label":
      return `Nearby label text is not explicitly associated with this native ${finding.element}.`;
  }
}

function whyItMattersFor(finding: ReactWebLabelPatchPreviewFinding): string {
  switch (finding.kind) {
    case "missing-accessible-label":
      return "Users of assistive technology may not get a meaningful control name, making the control hard to understand or operate.";
    case "ambiguous-accessible-label":
      return "Placeholder-only labeling can disappear during input and is weaker than an explicit accessible name.";
    case "unassociated-nearby-label":
      return "Visible label text may not be programmatically connected to the native form control.";
  }
}

function suggestedFixIntentFor(finding: ReactWebLabelPatchPreviewFinding): string {
  switch (finding.kind) {
    case "missing-accessible-label":
      return "Add an explicit accessible label with human-reviewed copy for the native control.";
    case "ambiguous-accessible-label":
      return "Replace placeholder-only labeling with explicit label evidence or human-reviewed aria-label copy.";
    case "unassociated-nearby-label":
      return "Connect the nearby native label/control pair with htmlFor/id when the preview evidence remains valid.";
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
  return "Correct user-facing accessible-name copy requires human review, so fooks reports the issue and does not auto-apply it.";
}

function skipReasonFor(finding: ReactWebLabelPatchPreviewFinding): string {
  if (finding.kind === "unassociated-nearby-label") {
    return "Preview skipped because the nearby label/control association is not high-confidence deterministic evidence.";
  }
  return "Preview skipped because generated accessible-name copy would require human review.";
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
  return {
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
    fixability: fixabilityFor(finding),
    autoFixSafety: autoFixSafetyFor(finding),
    safetyRationale,
    suggestedFixIntent: suggestedAction,
    suggestedAction,
    ...(!isSafePreview ? { skipReason: skipReasonFor(finding) } : {}),
    ...(preview ? { preview } : {}),
  };
}

export function buildReactWebIssueReport(filePath: string, cwd = process.cwd()): ReactWebIssueReport {
  const preview = buildReactWebLabelPatchPreview(filePath, cwd);
  const contextMetadata = preview.inScope && preview.findings.length > 0
    ? getReactWebIssueContextMetadata(preview.filePath, cwd)
    : undefined;
  const issues = preview.findings.map((finding, index) =>
    issueCardFor(
      preview.filePath,
      finding,
      index,
      buildReactWebIssueRelatedContext(preview.filePath, finding, contextMetadata),
    ),
  );
  return {
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
    issues,
  };
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

  report.issues.forEach((issue, index) => {
    lines.push(
      "",
      `## Issue ${index + 1}: ${issue.problem}`,
      `- why: ${issue.whyItMatters}`,
      `- where to look: ${issue.whereToLook.filePath}:${issue.whereToLook.line}-${issue.whereToLook.endLine}`,
      `- element: ${issue.evidence.element}`,
      `- confidence: ${issue.confidence}`,
      `- fixability: ${issue.fixability}`,
      `- auto-fix safety: ${issue.autoFixSafety}`,
      `- safety rationale: ${issue.safetyRationale}`,
      ...(issue.skipReason ? [`- skip reason: ${issue.skipReason}`] : []),
      `- suggested action: ${issue.suggestedAction}`,
      `- evidence: ${issue.evidence.sourceSignals.join(", ")}`,
      `- context: ${issue.evidence.context}`,
    );
    if (issue.relatedContext.length > 0) {
      lines.push("- inspect first:");
      for (const item of issue.relatedContext) {
        const location = item.filePath ? ` ${item.filePath}${item.line ? `:${item.line}${item.endLine && item.endLine !== item.line ? `-${item.endLine}` : ""}` : ""}` : "";
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
