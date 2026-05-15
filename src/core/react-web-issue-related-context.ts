import fs from "node:fs";
import path from "node:path";
import type { ReactWebLabelPatchPreviewFinding } from "./react-web-label-preview";

export type ReactWebRelatedContextKind =
  | "same-file-pattern"
  | "imported-local-component"
  | "same-directory-source"
  | "nearby-test";

export type ReactWebRelatedContextConfidence = "high" | "medium" | "low";

export type ReactWebRelatedContextSource =
  | "label-preview"
  | "htmlFor-target-resolution"
  | "local-import"
  | "same-directory"
  | "nearby-test";

export type ReactWebIssueRelatedContext = {
  kind: ReactWebRelatedContextKind;
  file: string;
  reason: string;
  confidence: ReactWebRelatedContextConfidence;
  source: ReactWebRelatedContextSource;
  action: "inspect-first";
  line?: number;
  endLine?: number;
  context?: string;
};

const RELATED_CONTEXT_LIMIT = 5;
const CONTROL_CONTEXT_NAME = /^(?:FormField|FormSection|Form|Field|Input|Label|Control|Wrapper)(?:[A-Z.]|$)/i;
const TEST_FILE_PATTERN = /(?:^|[.-])(?:test|spec)\.[cm]?[jt]sx?$/i;
const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

type SourceSnapshot = {
  absolutePath: string;
  relativePath: string;
  dir: string;
  basename: string;
  source: string;
  lines: string[];
};

type ImportCandidate = {
  file: string;
  importedNames: string[];
  moduleSpecifier: string;
};

function absolutePathFor(filePath: string, cwd: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
}

function toRelative(filePath: string, cwd: string): string {
  const relative = path.relative(cwd, filePath);
  return relative && !relative.startsWith("..") ? relative.split(path.sep).join("/") : filePath.split(path.sep).join("/");
}

function compactText(value: string, max = 140): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length > max ? `${compacted.slice(0, Math.max(0, max - 1))}…` : compacted;
}

function readSnapshot(filePath: string, cwd: string): SourceSnapshot | undefined {
  try {
    const absolutePath = absolutePathFor(filePath, cwd);
    const source = fs.readFileSync(absolutePath, "utf8");
    const relativePath = toRelative(absolutePath, cwd);
    return {
      absolutePath,
      relativePath,
      dir: path.dirname(absolutePath),
      basename: path.basename(absolutePath, path.extname(absolutePath)),
      source,
      lines: source.split(/\r?\n/),
    };
  } catch {
    return undefined;
  }
}

function lineContext(snapshot: SourceSnapshot, line: number | undefined): string | undefined {
  if (!line) return undefined;
  return compactText(snapshot.lines[line - 1] ?? "") || undefined;
}

function sameFilePatternFor(
  snapshot: SourceSnapshot,
  finding: ReactWebLabelPatchPreviewFinding,
): ReactWebIssueRelatedContext {
  return {
    kind: "same-file-pattern",
    file: snapshot.relativePath,
    reason: "Inspect the same-file native JSX evidence that produced this issue before choosing a fix.",
    confidence: finding.confidence,
    source: "label-preview",
    action: "inspect-first",
    line: finding.loc.startLine,
    endLine: finding.loc.endLine,
    context: finding.context,
  };
}

function sameFileSimilarPatternFor(
  snapshot: SourceSnapshot,
  finding: ReactWebLabelPatchPreviewFinding,
): ReactWebIssueRelatedContext | undefined {
  const tagPattern = new RegExp(`<${finding.element}(?:\\s|>|/)`, "i");
  const candidateIndex = snapshot.lines.findIndex((line, index) => {
    const lineNumber = index + 1;
    return lineNumber !== finding.loc.startLine && tagPattern.test(line);
  });
  if (candidateIndex < 0) return undefined;
  const line = candidateIndex + 1;
  return {
    kind: "same-file-pattern",
    file: snapshot.relativePath,
    reason: `Compare a nearby same-file native ${finding.element} pattern before editing this issue.`,
    confidence: "medium",
    source: "label-preview",
    action: "inspect-first",
    line,
    context: lineContext(snapshot, line),
  };
}

function parseImportedNames(importClause: string): string[] {
  const names = new Set<string>();
  const defaultMatch = importClause.match(/^\s*([A-Z][A-Za-z0-9_$]*)\s*(?:,|$)/);
  if (defaultMatch) names.add(defaultMatch[1]);
  const namespaceMatch = importClause.match(/\*\s+as\s+([A-Z][A-Za-z0-9_$]*)/);
  if (namespaceMatch) names.add(namespaceMatch[1]);
  const namedMatch = importClause.match(/\{([^}]+)\}/s);
  if (namedMatch) {
    for (const part of namedMatch[1].split(",")) {
      const alias = part.trim().match(/(?:as\s+)?([A-Z][A-Za-z0-9_$]*)$/);
      if (alias) names.add(alias[1]);
    }
  }
  return [...names];
}

function resolveLocalImport(snapshot: SourceSnapshot, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = path.resolve(snapshot.dir, specifier);
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  const resolved = candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
  return resolved;
}

function importedLocalComponentCandidates(snapshot: SourceSnapshot, cwd: string): ReactWebIssueRelatedContext[] {
  const imports: ImportCandidate[] = [];
  const importPattern = /import\s+([^;]*?)\s+from\s+["']([^"']+)["']/gs;
  for (const match of snapshot.source.matchAll(importPattern)) {
    const importClause = match[1] ?? "";
    const moduleSpecifier = match[2] ?? "";
    const resolved = resolveLocalImport(snapshot, moduleSpecifier);
    if (!resolved) continue;
    const importedNames = parseImportedNames(importClause);
    const resolvedBase = path.basename(resolved, path.extname(resolved));
    const hasControlEvidence = CONTROL_CONTEXT_NAME.test(resolvedBase) || importedNames.some((name) => CONTROL_CONTEXT_NAME.test(name));
    if (!hasControlEvidence) continue;
    imports.push({ file: toRelative(resolved, cwd), importedNames, moduleSpecifier });
  }

  return imports.slice(0, 2).map((candidate) => ({
    kind: "imported-local-component" as const,
    file: candidate.file,
    reason: `Inspect imported local wrapper/control evidence (${candidate.importedNames.join(", ") || candidate.moduleSpecifier}) before editing native JSX around this issue.`,
    confidence: "medium" as const,
    source: "local-import" as const,
    action: "inspect-first" as const,
    context: candidate.moduleSpecifier,
  }));
}

function sameDirectorySourceCandidates(snapshot: SourceSnapshot, cwd: string, excludedFiles = new Set<string>()): ReactWebIssueRelatedContext[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(snapshot.dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(snapshot.dir, entry.name))
    .filter((candidate) => candidate !== snapshot.absolutePath)
    .filter((candidate) => SOURCE_EXTENSIONS.includes(path.extname(candidate)))
    .filter((candidate) => !TEST_FILE_PATTERN.test(path.basename(candidate)))
    .filter((candidate) => CONTROL_CONTEXT_NAME.test(path.basename(candidate, path.extname(candidate))))
    .filter((candidate) => !excludedFiles.has(toRelative(candidate, cwd)))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 2)
    .map((candidate) => ({
      kind: "same-directory-source" as const,
      file: toRelative(candidate, cwd),
      reason: "Inspect same-directory form/control source naming evidence before changing this issue card's target file.",
      confidence: "low" as const,
      source: "same-directory" as const,
      action: "inspect-first" as const,
      context: path.basename(candidate),
    }));
}

function nearbyTestCandidates(snapshot: SourceSnapshot, cwd: string): ReactWebIssueRelatedContext[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(snapshot.dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const basePattern = new RegExp(`^${snapshot.basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[.-](?:test|spec)\\.[cm]?[jt]sx?$`, "i");
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(snapshot.dir, entry.name))
    .filter((candidate) => TEST_FILE_PATTERN.test(path.basename(candidate)) || basePattern.test(path.basename(candidate)))
    .sort((a, b) => {
      const aSame = basePattern.test(path.basename(a)) ? 0 : 1;
      const bSame = basePattern.test(path.basename(b)) ? 0 : 1;
      return aSame - bSame || a.localeCompare(b);
    })
    .slice(0, 2)
    .map((candidate) => ({
      kind: "nearby-test" as const,
      file: toRelative(candidate, cwd),
      reason: "Inspect nearby test coverage for this component before editing behavior.",
      confidence: basePattern.test(path.basename(candidate)) ? "medium" as const : "low" as const,
      source: "nearby-test" as const,
      action: "inspect-first" as const,
      context: path.basename(candidate),
    }));
}

function dedupeByKindFileLine(entries: ReactWebIssueRelatedContext[]): ReactWebIssueRelatedContext[] {
  const seen = new Set<string>();
  const deduped: ReactWebIssueRelatedContext[] = [];
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.file}:${entry.line ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

export function buildReactWebIssueRelatedContext(
  filePath: string,
  finding: ReactWebLabelPatchPreviewFinding,
  cwd = process.cwd(),
): ReactWebIssueRelatedContext[] {
  const snapshot = readSnapshot(filePath, cwd);
  if (!snapshot) return [];

  const importedCandidates = importedLocalComponentCandidates(snapshot, cwd);
  const importedFiles = new Set(importedCandidates.map((entry) => entry.file));
  const sameDirectoryCandidates = sameDirectorySourceCandidates(snapshot, cwd, importedFiles);
  const entries = dedupeByKindFileLine([
    sameFilePatternFor(snapshot, finding),
    ...importedCandidates,
    ...nearbyTestCandidates(snapshot, cwd),
    ...sameDirectoryCandidates,
    sameFileSimilarPatternFor(snapshot, finding),
  ].filter((entry): entry is ReactWebIssueRelatedContext => Boolean(entry)));

  return entries.slice(0, RELATED_CONTEXT_LIMIT);
}
