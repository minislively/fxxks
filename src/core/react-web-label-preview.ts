import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { detectDomainFromSource } from "./domain-detector";
import type { SourceRange } from "./schema";

export const REACT_WEB_LABEL_PATCH_PREVIEW_SCHEMA_VERSION = "react-web-label-patch-preview.v1" as const;
export const REACT_WEB_LABEL_PATCH_PREVIEW_CLAIM_BOUNDARY =
  "Read-only React Web JSX label preview only: detects a narrow set of native interactive elements with missing or ambiguous accessible-label evidence and suggests deterministic patch fragments without editing files or claiming full accessibility coverage." as const;

type ReactWebLabelFindingKind = "missing-accessible-label" | "ambiguous-accessible-label";
type ReactWebLabelConfidence = "high" | "medium";
type ReactWebInteractiveElement = "button" | "input" | "select" | "textarea";

export type ReactWebLabelPatchPreviewFinding = {
  kind: ReactWebLabelFindingKind;
  element: ReactWebInteractiveElement;
  loc: SourceRange;
  context: string;
  confidence: ReactWebLabelConfidence;
  reason: string;
  evidence: string[];
  suggestedPatch: {
    type: "unified-diff-fragment";
    readOnly: true;
    attribute: "aria-label";
    insertion: string;
    preview: string;
  };
};

export type ReactWebLabelPatchPreview = {
  schemaVersion: typeof REACT_WEB_LABEL_PATCH_PREVIEW_SCHEMA_VERSION;
  command: "inspect react-web-label-preview";
  profile: "react-web";
  filePath: string;
  readOnly: true;
  autoApply: false;
  claimBoundary: typeof REACT_WEB_LABEL_PATCH_PREVIEW_CLAIM_BOUNDARY;
  inScope: boolean;
  skippedReason?: string;
  summary: {
    findingCount: number;
    missingCount: number;
    ambiguousCount: number;
  };
  findings: ReactWebLabelPatchPreviewFinding[];
};

type JsxInteractiveNode = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

type AttributeSnapshot = {
  values: Map<string, string>;
};

const INTERACTIVE_TAGS = new Set<ReactWebInteractiveElement>(["button", "input", "select", "textarea"]);
const FINDING_LIMIT = 24;

function sourceRangeOf(sourceFile: ts.SourceFile, node: ts.Node): SourceRange {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return { startLine: start.line + 1, endLine: end.line + 1 };
}

function compactText(value: string, max = 120): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length > max ? `${compacted.slice(0, Math.max(0, max - 1))}…` : compacted;
}

function jsxAttributeText(initializer: ts.JsxAttribute["initializer"]): string | undefined {
  if (!initializer) return "true";
  if (ts.isStringLiteral(initializer)) return initializer.text.trim();
  if (ts.isJsxExpression(initializer) && initializer.expression) return compactText(initializer.expression.getText());
  return compactText(initializer.getText());
}

function attributesOf(node: JsxInteractiveNode): AttributeSnapshot {
  const values = new Map<string, string>();
  for (const property of node.attributes.properties) {
    if (!ts.isJsxAttribute(property)) continue;
    const name = property.name.getText();
    const value = jsxAttributeText(property.initializer);
    if (value) values.set(name, value);
  }
  return { values };
}

function tagNameOf(node: JsxInteractiveNode | ts.JsxOpeningElement): string {
  return node.tagName.getText();
}

function jsxVisibleText(node: ts.JsxElement): string {
  const parts: string[] = [];
  for (const child of node.children) {
    if (ts.isJsxText(child)) {
      parts.push(child.getText());
      continue;
    }
    if (ts.isJsxExpression(child) && child.expression) {
      if (ts.isStringLiteralLike(child.expression)) parts.push(child.expression.text);
      continue;
    }
    if (ts.isJsxElement(child)) {
      const nestedTag = tagNameOf(child.openingElement).toLowerCase();
      if (nestedTag === "svg" || nestedTag === "img") continue;
      parts.push(jsxVisibleText(child));
    }
  }
  return compactText(parts.join(" "));
}

function hasNonEmptyAttr(values: Map<string, string>, ...names: string[]): boolean {
  return names.some((name) => Boolean(values.get(name)?.trim()));
}

function isWrappedByLabel(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxElement(current) && tagNameOf(current.openingElement).toLowerCase() === "label") return true;
    current = current.parent;
  }
  return false;
}

function collectHtmlForIds(sourceFile: ts.SourceFile): Set<string> {
  const ids = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (tagNameOf(node).toLowerCase() === "label") {
        for (const property of node.attributes.properties) {
          if (!ts.isJsxAttribute(property) || property.name.getText() !== "htmlFor") continue;
          const value = jsxAttributeText(property.initializer);
          if (value) ids.add(value);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return ids;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function suggestedLabelFor(element: ReactWebInteractiveElement, values: Map<string, string>, kind: ReactWebLabelFindingKind): string {
  const name = values.get("name");
  const type = values.get("type");
  const placeholder = values.get("placeholder");
  if (kind === "ambiguous-accessible-label" && placeholder) return `TODO: replace placeholder-only label: ${placeholder}`;
  if (name) return `TODO: describe ${element} ${name}`;
  if (type && element === "input") return `TODO: describe ${type} input`;
  return `TODO: describe ${element}`;
}

function lineContext(lines: string[], loc: SourceRange): string {
  return compactText(lines[loc.startLine - 1] ?? "");
}

function patchPreviewFor(options: {
  relativePath: string;
  sourceFile: ts.SourceFile;
  sourceText: string;
  node: JsxInteractiveNode;
  loc: SourceRange;
  insertion: string;
}): string {
  const start = options.node.getStart(options.sourceFile);
  const end = options.node.getEnd();
  const selfClosingInsertAt = options.sourceText[end - 3] === " " ? end - 3 : end - 2;
  const insertAt = ts.isJsxSelfClosingElement(options.node) ? selfClosingInsertAt : end - 1;
  const before = options.sourceText.slice(start, insertAt);
  const after = options.sourceText.slice(insertAt, end);
  const original = compactText(options.sourceText.slice(start, end), 160);
  const updated = compactText(`${before}${options.insertion}${after}`, 180);
  return [
    `--- a/${options.relativePath}`,
    `+++ b/${options.relativePath}`,
    `@@ -${options.loc.startLine},1 +${options.loc.startLine},1 @@`,
    `-${original}`,
    `+${updated}`,
  ].join("\n");
}

function classifyLabelEvidence(options: {
  node: JsxInteractiveNode;
  tag: ReactWebInteractiveElement;
  attrs: AttributeSnapshot;
  labelledIds: Set<string>;
}): { labelled: true; evidence: string[] } | { labelled: false; kind: ReactWebLabelFindingKind; confidence: ReactWebLabelConfidence; reason: string; evidence: string[] } | undefined {
  const { node, tag, attrs, labelledIds } = options;
  const values = attrs.values;
  const evidence: string[] = [`jsx.${tag}`];

  if (tag === "input" && values.get("type")?.toLowerCase() === "hidden") return undefined;

  if (hasNonEmptyAttr(values, "aria-label")) return { labelled: true, evidence: [...evidence, `jsx.${tag}.aria-label`] };
  if (hasNonEmptyAttr(values, "aria-labelledby")) return { labelled: true, evidence: [...evidence, `jsx.${tag}.aria-labelledby`] };
  if (hasNonEmptyAttr(values, "title")) return { labelled: true, evidence: [...evidence, `jsx.${tag}.title`] };

  if (tag === "button") {
    const visibleText = ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent) ? jsxVisibleText(node.parent) : "";
    if (visibleText) return { labelled: true, evidence: [...evidence, "jsx.button.visible-text"] };
    return {
      labelled: false,
      kind: "missing-accessible-label",
      confidence: "high",
      reason: "Native button has no non-empty visible text, aria-label, aria-labelledby, or title evidence in this JSX element.",
      evidence,
    };
  }

  const id = values.get("id");
  if (id && labelledIds.has(id)) return { labelled: true, evidence: [...evidence, "jsx.label.htmlFor"] };
  if (isWrappedByLabel(node)) return { labelled: true, evidence: [...evidence, "jsx.label.wrapper"] };

  if (tag === "input" && ["button", "submit", "reset"].includes(values.get("type")?.toLowerCase() ?? "") && hasNonEmptyAttr(values, "value")) {
    return { labelled: true, evidence: [...evidence, "jsx.input.value"] };
  }
  if (tag === "input" && values.get("type")?.toLowerCase() === "image" && hasNonEmptyAttr(values, "alt")) {
    return { labelled: true, evidence: [...evidence, "jsx.input.alt"] };
  }

  if (hasNonEmptyAttr(values, "placeholder")) {
    return {
      labelled: false,
      kind: "ambiguous-accessible-label",
      confidence: "medium",
      reason: "Only placeholder text was found; the preview treats placeholder-only evidence as ambiguous and suggests an explicit accessible label.",
      evidence: [...evidence, `jsx.${tag}.placeholder`],
    };
  }

  return {
    labelled: false,
    kind: "missing-accessible-label",
    confidence: "high",
    reason: `Native ${tag} has no aria-label, aria-labelledby, title, associated label, or other narrow label evidence recognized by this preview.`,
    evidence,
  };
}

export function buildReactWebLabelPatchPreview(filePath: string, cwd = process.cwd()): ReactWebLabelPatchPreview {
  const fullPath = path.resolve(filePath);
  const relativePath = path.relative(cwd, fullPath) || path.basename(fullPath);
  const sourceText = fs.readFileSync(fullPath, "utf8");
  const detection = detectDomainFromSource(sourceText, fullPath);
  const base = {
    schemaVersion: REACT_WEB_LABEL_PATCH_PREVIEW_SCHEMA_VERSION,
    command: "inspect react-web-label-preview" as const,
    profile: "react-web" as const,
    filePath: relativePath,
    readOnly: true as const,
    autoApply: false as const,
    claimBoundary: REACT_WEB_LABEL_PATCH_PREVIEW_CLAIM_BOUNDARY,
  };

  if (detection.classification !== "react-web") {
    return {
      ...base,
      inScope: false,
      skippedReason: `domain-classification:${detection.classification}`,
      summary: { findingCount: 0, missingCount: 0, ambiguousCount: 0 },
      findings: [],
    };
  }

  const sourceFile = ts.createSourceFile(fullPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = sourceText.split(/\r?\n/);
  const labelledIds = collectHtmlForIds(sourceFile);
  const findings: ReactWebLabelPatchPreviewFinding[] = [];

  const visit = (node: ts.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && findings.length < FINDING_LIMIT) {
      const tag = tagNameOf(node).toLowerCase();
      if (INTERACTIVE_TAGS.has(tag as ReactWebInteractiveElement)) {
        const element = tag as ReactWebInteractiveElement;
        const attrs = attributesOf(node);
        const labelEvidence = classifyLabelEvidence({ node, tag: element, attrs, labelledIds });
        if (labelEvidence && !labelEvidence.labelled) {
          const loc = sourceRangeOf(sourceFile, node);
          const label = suggestedLabelFor(element, attrs.values, labelEvidence.kind);
          const insertion = ` aria-label="${escapeAttribute(label)}"`;
          findings.push({
            kind: labelEvidence.kind,
            element,
            loc,
            context: lineContext(lines, loc),
            confidence: labelEvidence.confidence,
            reason: labelEvidence.reason,
            evidence: labelEvidence.evidence,
            suggestedPatch: {
              type: "unified-diff-fragment",
              readOnly: true,
              attribute: "aria-label",
              insertion,
              preview: patchPreviewFor({ relativePath, sourceFile, sourceText, node, loc, insertion }),
            },
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    ...base,
    inScope: true,
    summary: {
      findingCount: findings.length,
      missingCount: findings.filter((finding) => finding.kind === "missing-accessible-label").length,
      ambiguousCount: findings.filter((finding) => finding.kind === "ambiguous-accessible-label").length,
    },
    findings,
  };
}

export function renderReactWebLabelPatchPreviewText(preview: ReactWebLabelPatchPreview): string {
  const lines = [
    "# React Web label patch preview",
    "",
    preview.claimBoundary,
    "",
    `File: ${preview.filePath}`,
    `Read-only: ${preview.readOnly ? "yes" : "no"}`,
    `In scope: ${preview.inScope ? "yes" : "no"}`,
    `Findings: ${preview.summary.findingCount} (missing: ${preview.summary.missingCount}, ambiguous: ${preview.summary.ambiguousCount})`,
  ];
  if (preview.skippedReason) lines.push(`Skipped: ${preview.skippedReason}`);
  if (preview.findings.length === 0) return `${lines.join("\n")}\n`;

  preview.findings.forEach((finding, index) => {
    lines.push(
      "",
      `## Finding ${index + 1}: ${finding.kind}`,
      `- element: ${finding.element}`,
      `- line: ${finding.loc.startLine}`,
      `- confidence: ${finding.confidence}`,
      `- reason: ${finding.reason}`,
      `- context: ${finding.context}`,
      `- evidence: ${finding.evidence.join(", ")}`,
      "",
      "```diff",
      finding.suggestedPatch.preview,
      "```",
    );
  });
  return `${lines.join("\n")}\n`;
}
