import fs from "node:fs";
import path from "node:path";

const ELIGIBLE_EXTENSIONS = new Set([".tsx", ".jsx"]);
const ESCAPE_HATCH_TOKENS = ["#fooks-full-read", "#fooks-disable-pre-read"] as const;
const FILE_TOKEN_PATTERN = /(?:[A-Za-z]:)?[A-Za-z0-9_./\\-]+\.(?:tsx|jsx)\b/g;

function trimPromptToken(token: string): string {
  return token.replace(/^[`"'([{<]+/, "").replace(/[`"')\]}>:;,!?]+$/, "");
}

function isWithinCwd(resolved: string, cwd: string): boolean {
  const relativeToCwd = path.relative(cwd, resolved);
  return relativeToCwd === "" || (!relativeToCwd.startsWith(`..${path.sep}`) && relativeToCwd !== ".." && !path.isAbsolute(relativeToCwd));
}

function normalizeCandidate(token: string, cwd: string): string | null {
  const cleaned = trimPromptToken(token);
  if (!cleaned) return null;

  const resolved = path.isAbsolute(cleaned) ? path.resolve(cleaned) : path.resolve(cwd, cleaned);
  const extension = path.extname(resolved).toLowerCase();
  if (!ELIGIBLE_EXTENSIONS.has(extension)) return null;
  if (!isWithinCwd(resolved, cwd)) return null;

  const relativeToCwd = path.relative(cwd, resolved);

  if (fs.existsSync(resolved)) {
    return relativeToCwd || path.basename(resolved);
  }

  if (path.isAbsolute(cleaned)) return null;
  return relativeToCwd || path.basename(resolved);
}

export function extractPromptTarget(prompt: string, cwd = process.cwd()): string | null {
  for (const match of prompt.matchAll(FILE_TOKEN_PATTERN)) {
    const normalized = normalizeCandidate(match[0], cwd);
    if (normalized) return normalized;
  }
  return null;
}

export function hasFullReadEscapeHatch(prompt: string): boolean {
  return ESCAPE_HATCH_TOKENS.some((token) => prompt.includes(token));
}

export function codexRuntimeEscapeHatches(): readonly string[] {
  return ESCAPE_HATCH_TOKENS;
}


export function resolvePromptFileContext(prompt: string, cwd = process.cwd()): { filePath?: string; source: "prompt-target" | "none" } {
  const filePath = extractPromptTarget(prompt, cwd);
  return filePath ? { filePath, source: "prompt-target" } : { source: "none" };
}
