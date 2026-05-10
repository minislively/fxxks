import path from "node:path";
import { extractFile } from "./extract";
import { toModelFacingPayload } from "./payload/model-facing";
import type { ReactWebContextMetadataV0, SourceRange } from "./schema";
import type { ReactWebLabelPatchPreviewFinding } from "./react-web-label-preview";

export type ReactWebRelatedContextKind =
  | "same-file-pattern"
  | "react-web-context-anchor"
  | "test-candidate"
  | "manual-review-note";

export type ReactWebRelatedContextConfidence = "high" | "medium" | "low";

export type ReactWebRelatedContextSource =
  | "label-preview"
  | "react-web-context-metadata"
  | "fixture-convention"
  | "issue-safety";

export type ReactWebIssueRelatedContext = {
  kind: ReactWebRelatedContextKind;
  reason: string;
  confidence: ReactWebRelatedContextConfidence;
  source: ReactWebRelatedContextSource;
  action: "inspect-first";
  filePath?: string;
  line?: number;
  endLine?: number;
  context?: string;
};

const RELATED_CONTEXT_LIMIT = 3;
const ISSUE_REPORT_TEST_FILE = "test/react-web-issue-report.test.mjs";

type ContextAnchorCandidate = {
  label: string;
  kind: string;
  loc?: SourceRange;
};

function absolutePathFor(filePath: string, cwd: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
}

export function getReactWebIssueContextMetadata(
  filePath: string,
  cwd: string,
): ReactWebContextMetadataV0 | undefined {
  try {
    const result = extractFile(absolutePathFor(filePath, cwd));
    const payload = toModelFacingPayload(result, cwd, {
      includeEditGuidance: true,
      includeReactWebContextMetadata: true,
    });
    return payload.reactWebContext;
  } catch {
    return undefined;
  }
}

function sameFilePatternFor(
  filePath: string,
  finding: ReactWebLabelPatchPreviewFinding,
): ReactWebIssueRelatedContext {
  return {
    kind: "same-file-pattern",
    reason: "Inspect the exact same-file JSX evidence that produced this issue before choosing a fix.",
    confidence: finding.confidence,
    source: "label-preview",
    action: "inspect-first",
    filePath,
    line: finding.loc.startLine,
    endLine: finding.loc.endLine,
    context: finding.context,
  };
}

function anchorCandidates(metadata: ReactWebContextMetadataV0 | undefined): ContextAnchorCandidate[] {
  if (!metadata) return [];
  const candidates: ContextAnchorCandidate[] = [];
  const add = (candidate: ContextAnchorCandidate) => {
    if (!candidate.loc) return;
    candidates.push(candidate);
  };

  for (const anchor of metadata.a11yAnchors ?? []) {
    add({ label: anchor.label, kind: `a11y:${anchor.kind}`, loc: anchor.loc });
  }
  for (const flow of metadata.formStateFlow ?? []) {
    add({ label: flow.label, kind: `form-state:${flow.kind}`, loc: flow.loc });
  }
  for (const route of metadata.editTargetRouting ?? []) {
    add({ label: route.label, kind: `edit-target:${route.kind}`, loc: route.loc });
  }
  for (const region of metadata.layoutRegionHints ?? []) {
    add({ label: region.label, kind: `layout:${region.kind}`, loc: region.loc });
  }

  return candidates;
}

function nearestAnchorFor(
  filePath: string,
  finding: ReactWebLabelPatchPreviewFinding,
  metadata: ReactWebContextMetadataV0 | undefined,
): ReactWebIssueRelatedContext | undefined {
  const issueLine = finding.loc.startLine;
  const nearest = anchorCandidates(metadata)
    .map((candidate) => ({
      candidate,
      distance: Math.min(Math.abs(candidate.loc!.startLine - issueLine), Math.abs(candidate.loc!.endLine - issueLine)),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!nearest) return undefined;
  const { candidate, distance } = nearest;
  return {
    kind: "react-web-context-anchor",
    reason: `Inspect the nearest React Web context anchor (${candidate.kind}) before editing this control.`,
    confidence: distance <= 3 ? "high" : "medium",
    source: "react-web-context-metadata",
    action: "inspect-first",
    filePath,
    line: candidate.loc?.startLine,
    endLine: candidate.loc?.endLine,
    context: candidate.label,
  };
}

function testCandidateFor(): ReactWebIssueRelatedContext {
  return {
    kind: "test-candidate",
    reason: "Update or add a regression case around this issue shape before broadening React Web issue-card behavior.",
    confidence: "medium",
    source: "fixture-convention",
    action: "inspect-first",
    filePath: ISSUE_REPORT_TEST_FILE,
    context: "React Web issue report regression surface",
  };
}

function manualReviewNoteFor(
  filePath: string,
  finding: ReactWebLabelPatchPreviewFinding,
): ReactWebIssueRelatedContext | undefined {
  if (finding.kind === "unassociated-nearby-label" && finding.confidence === "high") return undefined;
  return {
    kind: "manual-review-note",
    reason: "Human review is required before writing accessible-name copy or accepting a weak label association.",
    confidence: "medium",
    source: "issue-safety",
    action: "inspect-first",
    filePath,
    line: finding.loc.startLine,
    endLine: finding.loc.endLine,
    context: finding.context,
  };
}

export function buildReactWebIssueRelatedContext(
  filePath: string,
  finding: ReactWebLabelPatchPreviewFinding,
  metadata: ReactWebContextMetadataV0 | undefined,
): ReactWebIssueRelatedContext[] {
  const entries = [
    sameFilePatternFor(filePath, finding),
    nearestAnchorFor(filePath, finding, metadata),
    testCandidateFor(),
    manualReviewNoteFor(filePath, finding),
  ].filter((entry): entry is ReactWebIssueRelatedContext => Boolean(entry));

  return entries.slice(0, RELATED_CONTEXT_LIMIT);
}
