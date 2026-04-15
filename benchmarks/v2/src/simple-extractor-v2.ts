/**
 * Benchmark v2 extractor.
 *
 * This version intentionally stays heuristic/regex based, but it now decides
 * mode from source complexity before truncation and emits a structured hybrid
 * payload for large mixed files instead of a tiny summary string.
 */

import * as fs from "fs";
import { calculateTokenMetrics } from "./token-counter";

export interface SimpleExtractionResultV2 {
  success: boolean;
  rawBytes: number;
  payloadBytes: number;
  rawTokens: number;
  extractedTokens: number;
  tokenDelta: number;
  savingsRatio: number;
  compressionRatio: number;
  extractionMode: "raw" | "extract" | "hybrid";
  extractedContent: string;
  fallback?: {
    used: boolean;
    reason: string;
  };
  metadata: {
    durationMs: number;
    extractionMethod: string;
    fidelity: "simplified" | "partial-real" | "real";
  };
}

type ImportSummary = {
  from: string;
  bindings: string;
};

type SnippetSummary = {
  label: string;
  code: string;
  reason: string;
};

type Analysis = {
  importCount: number;
  imports: ImportSummary[];
  typeNames: string[];
  signatures: string[];
  hooks: string[];
  stateSummary: string[];
  effects: string[];
  eventHandlers: string[];
  sideEffectRefs: string[];
  propsShape: string[];
  components: string[];
  conditionals: string[];
  repeatedBlocks: string[];
  jsxDepthEstimate: number;
  snippets: SnippetSummary[];
};

export function extractFileSimpleV2(filePath: string): SimpleExtractionResultV2 {
  const startTime = Date.now();

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const rawBytes = Buffer.byteLength(content, "utf-8");
    const analysis = analyzeContent(content);
    const extractionMode = determineModeV2(rawBytes, analysis);
    const extracted = performExtractionV2(content, analysis, extractionMode);
    const payloadBytes = Buffer.byteLength(extracted, "utf-8");
    const tokenMetrics = calculateTokenMetrics(content, extracted);

    return {
      success: true,
      rawBytes,
      payloadBytes,
      rawTokens: tokenMetrics.rawTokens,
      extractedTokens: tokenMetrics.extractedTokens,
      tokenDelta: tokenMetrics.tokenDelta,
      savingsRatio: tokenMetrics.savingsRatio,
      compressionRatio: payloadBytes > 0 ? rawBytes / payloadBytes : 1,
      extractionMode,
      extractedContent: extracted,
      fallback: { used: false, reason: "" },
      metadata: {
        durationMs: Date.now() - startTime,
        extractionMethod: extractionMode === "hybrid" ? "simple-ast-v2-structured-hybrid" : "simple-ast-v2",
        fidelity: extractionMode === "hybrid" ? "partial-real" : "simplified",
      },
    };
  } catch (error) {
    return {
      success: false,
      rawBytes: 0,
      payloadBytes: 0,
      rawTokens: 0,
      extractedTokens: 0,
      tokenDelta: 0,
      savingsRatio: 0,
      compressionRatio: 1,
      extractionMode: "raw",
      extractedContent: "",
      fallback: {
        used: true,
        reason: error instanceof Error ? error.message : "extraction-error",
      },
      metadata: {
        durationMs: Date.now() - startTime,
        extractionMethod: "fallback",
        fidelity: "simplified",
      },
    };
  }
}

function analyzeContent(content: string): Analysis {
  const imports = [...content.matchAll(/import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?/g)].map((match) => ({
    bindings: compactWhitespace(match[1]),
    from: match[2],
  }));

  const localTypeNames = [
    ...content.matchAll(/\b(?:interface|type)\s+([A-Za-z0-9_]+)/g),
    ...content.matchAll(/:\s*([A-Za-z0-9_]+(?:Props|Component))/g),
  ].map((match) => match[1]);

  const hooks = unique([...content.matchAll(/\b(use[A-Z][A-Za-z0-9_]*)\b/g)].map((match) => match[1])).slice(0, 10);
  const stateSummary = [...content.matchAll(/const\s*\[\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\]\s*=\s*useState/g)].map(
    (match) => `${match[1]}, ${match[2]}`,
  );
  const eventHandlers = unique([
    ...[...content.matchAll(/\b(on[A-Z][A-Za-z0-9_]*)\s*=/g)].map((match) => match[1]),
    ...[...content.matchAll(/\b(handle[A-Z][A-Za-z0-9_]*)\b/g)].map((match) => match[1]),
  ]);
  const sideEffectRefs = unique(
    [...content.matchAll(/\b(window|document|fetch|localStorage|sessionStorage|setTimeout|setInterval)\b/g)].map((match) => match[1]),
  );

  const components = unique(
    [...content.matchAll(/<([A-Za-z][A-Za-z0-9]*)\b/g)]
      .map((match) => match[1])
      .filter((name) => name !== "Fragment"),
  ).slice(0, 12);

  const signatures = unique([
    ...[...content.matchAll(/(?:export\s+)?(?:default\s+)?function\s+[A-Za-z0-9_]+\s*\([^)]*\)(?:\s*:\s*[^{=\n]+)?/g)].map(
      (match) => compactWhitespace(match[0]),
    ),
    ...[...content.matchAll(/(?:export\s+)?const\s+[A-Za-z0-9_]+\s*:[^=]+=\s*\([\s\S]*?\)\s*=>/g)].map((match) =>
      compactWhitespace(match[0]),
    ),
    ...[...content.matchAll(/(?:export\s+)?const\s+[A-Za-z0-9_]+\s*=\s*\([\s\S]*?\)\s*=>/g)].map((match) =>
      compactWhitespace(match[0]),
    ),
  ]).slice(0, 4);

  const propsShape = extractPropsShape(content);
  const conditionals = collectConditionals(content);
  const repeatedBlocks = content.includes(".map(") ? ["array-map-render"] : [];
  const jsxDepthEstimate = estimateJsxDepth(content);

  const snippets: SnippetSummary[] = [];
  for (const hookName of ["useEffect", "useLayoutEffect"]) {
    const hookSnippet = captureCallSnippet(content, hookName);
    if (hookSnippet) {
      snippets.push({ label: hookName, code: hookSnippet, reason: "effect-hook" });
    }
  }

  for (const helper of ["handleSave", "handleReset", "disableDecimalPlace", "getCurrencySymbol"]) {
    const helperSnippet = captureConstFunctionSnippet(content, helper);
    if (helperSnippet) {
      snippets.push({ label: helper, code: helperSnippet, reason: "helper-function" });
    }
  }

  if (conditionals[0]) {
    snippets.push({ label: "conditional", code: conditionals[0], reason: "conditional-render" });
  }

  return {
    importCount: imports.length,
    imports,
    typeNames: unique(localTypeNames).slice(0, 6),
    signatures,
    hooks,
    stateSummary: unique(stateSummary).slice(0, 6),
    effects: hooks.filter((hook) => hook === "useEffect" || hook === "useLayoutEffect"),
    eventHandlers,
    sideEffectRefs,
    propsShape,
    components,
    conditionals,
    repeatedBlocks,
    jsxDepthEstimate,
    snippets: dedupeSnippets(snippets).slice(0, 4),
  };
}

function determineModeV2(rawBytes: number, analysis: Analysis): "raw" | "extract" | "hybrid" {
  const simpleRaw =
    rawBytes < 500 &&
    analysis.hooks.length <= 1 &&
    analysis.conditionals.length <= 1 &&
    analysis.eventHandlers.length <= 1 &&
    analysis.jsxDepthEstimate <= 2;

  if (simpleRaw) {
    return "raw";
  }

  const hybridSignals = [
    rawBytes > 3000,
    analysis.importCount >= 6,
    analysis.hooks.length >= 3,
    analysis.conditionals.length >= 2,
    analysis.eventHandlers.length >= 1,
    analysis.jsxDepthEstimate >= 2,
    analysis.propsShape.length >= 3,
  ].filter(Boolean).length;

  return hybridSignals >= 2 ? "hybrid" : "extract";
}

function performExtractionV2(content: string, analysis: Analysis, mode: "raw" | "extract" | "hybrid"): string {
  if (mode === "raw") {
    return content.trim();
  }

  if (mode === "hybrid") {
    const payload = pruneEmpty({
      mode,
      imports: analysis.imports.slice(0, 6),
      signatures: analysis.signatures.slice(0, 3),
      contract: pruneEmpty({
        typeNames: analysis.typeNames.slice(0, 4),
        propsShape: analysis.propsShape.slice(0, 8),
      }),
      behavior: pruneEmpty({
        hooks: analysis.hooks.slice(0, 8),
        stateSummary: analysis.stateSummary.slice(0, 6),
        effects: analysis.effects.slice(0, 3),
        eventHandlers: analysis.eventHandlers.slice(0, 6),
        sideEffectRefs: analysis.sideEffectRefs.slice(0, 4),
      }),
      structure: pruneEmpty({
        components: analysis.components.slice(0, 10),
        conditionals: analysis.conditionals.slice(0, 4),
        repeatedBlocks: analysis.repeatedBlocks.slice(0, 3),
        jsxDepthEstimate: analysis.jsxDepthEstimate,
      }),
      snippets: analysis.snippets.slice(0, 3),
    });

    return JSON.stringify(payload, null, 2);
  }

  const parts: string[] = [];

  if (analysis.imports.length > 0) {
    parts.push(`// Imports: ${analysis.imports.slice(0, 6).map((entry) => entry.from).join(", ")}`);
  }
  if (analysis.typeNames.length > 0) {
    parts.push(`// Types: ${analysis.typeNames.join(", ")}`);
  }
  if (analysis.signatures.length > 0) {
    parts.push(...analysis.signatures.slice(0, 3));
  }
  if (analysis.hooks.length > 0) {
    parts.push(`// Hooks: ${analysis.hooks.slice(0, 6).join(", ")}`);
  }
  if (analysis.components.length > 0) {
    parts.push(`// Components: ${analysis.components.slice(0, 6).join(" > ")}`);
  }

  return parts.join("\n");
}

function collectConditionals(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const matches: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes("&&") && !line.includes("?")) continue;

    const excerpt = compactWhitespace(lines.slice(index, Math.min(index + 5, lines.length)).join("\n")).slice(0, 140);
    if (excerpt) matches.push(excerpt);
  }

  return unique(matches).slice(0, 8);
}

function extractPropsShape(content: string): string[] {
  const destructured = content.match(/const\s+[A-Za-z0-9_]+\s*(?::\s*[^=]+)?=\s*\(\s*\{([\s\S]*?)\}\s*\)\s*=>/);
  if (!destructured) return [];

  return destructured[1]
    .split(",")
    .map((part) => part.trim())
    .map((part) => part.replace(/[:=].*$/, "").trim())
    .filter(Boolean)
    .map((name) => `${name}: unknown`)
    .slice(0, 10);
}

function estimateJsxDepth(content: string): number {
  const tagPattern = /<\/?([A-Za-z][A-Za-z0-9]*)\b[^>]*?>/g;
  const selfClosingPattern = /\/>$/;
  let depth = 0;
  let maxDepth = 0;

  for (const match of content.matchAll(tagPattern)) {
    const tag = match[0];
    if (tag.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    depth += 1;
    maxDepth = Math.max(maxDepth, depth);

    if (selfClosingPattern.test(tag)) {
      depth = Math.max(0, depth - 1);
    }
  }

  return maxDepth;
}

function captureCallSnippet(content: string, callName: string): string | null {
  const callIndex = content.indexOf(`${callName}(`);
  if (callIndex === -1) return null;

  const openIndex = content.indexOf("(", callIndex);
  if (openIndex === -1) return null;

  const balanced = captureBalanced(content, openIndex, "(", ")");
  if (!balanced) return null;

  const afterIndex = openIndex + balanced.length;
  const semicolonIndex = content.indexOf(";", afterIndex);
  const snippet = `${content.slice(callIndex, openIndex)}${balanced}${semicolonIndex === -1 ? "" : ";"}`;
  return trimSnippet(snippet);
}

function captureConstFunctionSnippet(content: string, functionName: string): string | null {
  const matcher = new RegExp(`const\\\\s+${functionName}\\\\s*=`, "m");
  const nameMatch = matcher.exec(content);
  if (!nameMatch || nameMatch.index === undefined) return null;

  const start = nameMatch.index;
  const braceIndex = content.indexOf("{", start);
  if (braceIndex === -1) return null;

  const balanced = captureBalanced(content, braceIndex, "{", "}");
  if (!balanced) return null;

  const end = braceIndex + balanced.length;
  const semicolonIndex = content.indexOf(";", end);
  const snippet = content.slice(start, semicolonIndex === -1 ? end : semicolonIndex + 1);
  return trimSnippet(snippet);
}

function captureBalanced(content: string, startIndex: number, openChar: string, closeChar: string): string | null {
  let depth = 0;
  let inString: string | null = null;
  let escaping = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === inString) {
        inString = null;
      }

      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      inString = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return content.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function trimSnippet(value: string): string {
  return value
    .split("\n")
    .slice(0, 12)
    .join("\n")
    .trim();
}

function pruneEmpty<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === "object") return Object.keys(entry as Record<string, unknown>).length > 0;
      return true;
    }),
  ) as T;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function dedupeSnippets(snippets: SnippetSummary[]): SnippetSummary[] {
  const seen = new Set<string>();
  return snippets.filter((snippet) => {
    const key = `${snippet.label}:${snippet.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
