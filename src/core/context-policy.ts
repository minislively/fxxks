import fs from "node:fs";
import path from "node:path";
import type { FileTarget } from "./discover";

const REACT_EXTENSIONS = new Set([".tsx", ".jsx"]);
const CODEX_TS_JS_BETA_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const ESCAPE_HATCH_TOKENS = ["#fooks-full-read", "#fooks-disable-pre-read"] as const;
const FILE_TOKEN_PATTERN = /(?:[A-Za-z]:)?[A-Za-z0-9_./\\-]+\.(?:tsx|jsx|ts|js)\b/g;
const STOPWORDS = new Set(["add", "the", "fix", "update", "to", "for", "with", "from", "and", "this", "that"]);

export type ContextCapability = "react-only" | "codex-ts-js-beta";

export type PromptSpecificity = "exact-file" | "file-hinted" | "ambiguous";
export type ContextMode = "no-op" | "light" | "light-minimal" | "full" | "auto";
export type ContextSelectionSource = "explicit-path" | "keyword-discovery" | "none";

export type PromptTarget = {
  filePath: string;
  exists: boolean;
  source: "explicit-path";
};

export type ContextBudget = {
  maxFiles: number;
  selectedFiles: number;
  totalBytes: number;
  skippedFiles: number;
};

export type PromptContextPolicy = {
  promptSpecificity: PromptSpecificity;
  targets: PromptTarget[];
  selectionSource: ContextSelectionSource;
  contextMode: ContextMode;
  contextModeReason: string;
  contextBudget: ContextBudget;
  contextPolicyVersion: "context-policy.v1";
};

function trimPromptToken(token: string): string {
  return token.replace(/^[`"'([{<]+/, "").replace(/[`"')\]}>:;,!?]+$/, "");
}

function isWithinCwd(resolved: string, cwd: string): boolean {
  const relativeToCwd = path.relative(cwd, resolved);
  return relativeToCwd === "" || (!relativeToCwd.startsWith(`..${path.sep}`) && relativeToCwd !== ".." && !path.isAbsolute(relativeToCwd));
}

function eligibleExtensions(capability: ContextCapability): ReadonlySet<string> {
  return capability === "codex-ts-js-beta" ? CODEX_TS_JS_BETA_EXTENSIONS : REACT_EXTENSIONS;
}

function normalizeCandidate(token: string, cwd: string, capability: ContextCapability): PromptTarget | null {
  const cleaned = trimPromptToken(token);
  if (!cleaned) return null;

  const resolved = path.isAbsolute(cleaned) ? path.resolve(cleaned) : path.resolve(cwd, cleaned);
  const extension = path.extname(resolved).toLowerCase();
  if (!eligibleExtensions(capability).has(extension)) return null;
  if (!isWithinCwd(resolved, cwd)) return null;

  const relativeToCwd = path.relative(cwd, resolved) || path.basename(resolved);
  if (path.isAbsolute(cleaned) && !fs.existsSync(resolved)) return null;

  return {
    filePath: relativeToCwd,
    exists: fs.existsSync(resolved),
    source: "explicit-path",
  };
}

function uniqueTargets(targets: PromptTarget[]): PromptTarget[] {
  const seen = new Set<string>();
  const unique: PromptTarget[] = [];
  for (const target of targets) {
    if (seen.has(target.filePath)) continue;
    seen.add(target.filePath);
    unique.push(target);
  }
  return unique;
}

function emptyBudget(maxFiles: number): ContextBudget {
  return { maxFiles, selectedFiles: 0, totalBytes: 0, skippedFiles: 0 };
}

function totalBytes(cwd: string, files: string[]): number {
  let total = 0;
  for (const filePath of files) {
    try {
      total += fs.statSync(path.resolve(cwd, filePath)).size;
    } catch {
      // Missing files are intentionally skipped in the budget.
    }
  }
  return total;
}

export function extractPromptTargets(prompt: string, cwd = process.cwd(), capability: ContextCapability = "react-only"): PromptTarget[] {
  return uniqueTargets([...prompt.matchAll(FILE_TOKEN_PATTERN)].map((match) => normalizeCandidate(match[0], cwd, capability)).filter((target): target is PromptTarget => Boolean(target)));
}

export function extractPromptTarget(prompt: string, cwd = process.cwd(), capability: ContextCapability = "react-only"): string | null {
  return extractPromptTargets(prompt, cwd, capability)[0]?.filePath ?? null;
}

export function hasFullReadEscapeHatch(prompt: string): boolean {
  return ESCAPE_HATCH_TOKENS.some((token) => prompt.includes(token));
}

export function runtimeEscapeHatches(): readonly string[] {
  return ESCAPE_HATCH_TOKENS;
}

export function codexRuntimeEscapeHatches(): readonly string[] {
  return runtimeEscapeHatches();
}

export function classifyPromptContext(prompt: string, cwd = process.cwd(), capability: ContextCapability = "react-only"): PromptContextPolicy {
  const targets = extractPromptTargets(prompt, cwd, capability);
  if (targets.length > 0) {
    const selected = targets.filter((target) => target.exists).slice(0, 1);
    return {
      promptSpecificity: "exact-file",
      targets,
      selectionSource: "explicit-path",
      contextMode: selected.length > 0 ? "light" : "no-op",
      contextModeReason: selected.length > 0 ? "exact-file-existing-target" : "exact-file-new-or-missing-target",
      contextBudget: {
        maxFiles: 1,
        selectedFiles: selected.length,
        totalBytes: totalBytes(cwd, selected.map((target) => target.filePath)),
        skippedFiles: targets.length - selected.length,
      },
      contextPolicyVersion: "context-policy.v1",
    };
  }

  return {
    promptSpecificity: "ambiguous",
    targets: [],
    selectionSource: "none",
    contextMode: "auto",
    contextModeReason: "no-explicit-file-target",
    contextBudget: emptyBudget(5),
    contextPolicyVersion: "context-policy.v1",
  };
}

export function resolvePromptFileContext(prompt: string, cwd = process.cwd(), capability: ContextCapability = "react-only"): { filePath?: string; source: "prompt-target" | "none"; policy: PromptContextPolicy } {
  const policy = classifyPromptContext(prompt, cwd, capability);
  const filePath = policy.targets.find((target) => target.exists)?.filePath ?? policy.targets[0]?.filePath;
  return filePath ? { filePath, source: "prompt-target", policy } : { source: "none", policy };
}

function promptKeywords(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

export function discoverRelevantFilesByPolicy(
  prompt: string,
  allFiles: FileTarget[],
  cwd = process.cwd(),
  maxFiles = 5,
  capability: ContextCapability = "react-only",
): { files: string[]; policy: PromptContextPolicy } {
  const explicitPolicy = classifyPromptContext(prompt, cwd, capability);
  if (explicitPolicy.promptSpecificity === "exact-file") {
    const files = explicitPolicy.targets.filter((target) => target.exists).slice(0, 1).map((target) => target.filePath);
    return {
      files,
      policy: {
        ...explicitPolicy,
        contextMode: files.length > 0 ? "light" : "no-op",
        contextModeReason: files.length > 0 ? "exact-file-existing-target" : "exact-file-new-or-missing-target",
        contextBudget: {
          maxFiles: 1,
          selectedFiles: files.length,
          totalBytes: totalBytes(cwd, files),
          skippedFiles: explicitPolicy.targets.length - files.length,
        },
      },
    };
  }

  const keywords = promptKeywords(prompt);
  const scored = allFiles.map((target) => {
    const fileName = path.basename(target.filePath).toLowerCase();
    const fileDir = path.dirname(target.filePath).toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      if (fileName.includes(keyword)) score += 10;
      if (fileDir.includes(keyword)) score += 5;
    }
    if (target.kind === "component") score += 3;
    return { filePath: target.filePath, score };
  });

  const files = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles)
    .map((entry) => entry.filePath);

  return {
    files,
    policy: {
      ...explicitPolicy,
      selectionSource: files.length > 0 ? "keyword-discovery" : "none",
      contextMode: files.length > 0 ? "auto" : "no-op",
      contextModeReason: files.length > 0 ? "ambiguous-keyword-discovery" : "ambiguous-no-relevant-files",
      contextBudget: {
        maxFiles,
        selectedFiles: files.length,
        totalBytes: totalBytes(cwd, files),
        skippedFiles: Math.max(0, allFiles.length - files.length),
      },
    },
  };
}
