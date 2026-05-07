import path from "node:path";
import fs from "node:fs";
import { hashText } from "./hash";

export const FOOKS_DIR = ".fooks";
const DATA_KEY_MAX_LENGTH = 120;
const DATA_KEY_HASH_LENGTH = 12;

export function projectRoot(cwd = process.cwd()): string {
  return cwd;
}

export function canonicalProjectDataDir(cwd = process.cwd()): string {
  return path.join(cwd, FOOKS_DIR);
}

export function ensureProjectDataDirs(cwd = process.cwd()): void {
  fs.mkdirSync(path.join(canonicalProjectDataDir(cwd), "cache"), { recursive: true });
  fs.mkdirSync(path.join(canonicalProjectDataDir(cwd), "adapters"), { recursive: true });
}

export function sanitizeDataKey(key: string): string {
  const sanitized = key.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase() || "default-session";
  if (sanitized.length <= DATA_KEY_MAX_LENGTH) {
    return sanitized;
  }
  const hash = hashText(key).slice(0, DATA_KEY_HASH_LENGTH);
  const prefixLength = DATA_KEY_MAX_LENGTH - DATA_KEY_HASH_LENGTH - 1;
  const prefix = sanitized.slice(0, prefixLength).replace(/[-._]+$/u, "") || "session";
  return `${prefix}-${hash}`;
}

export function isPathInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function isSafeProjectFilePath(filePath: string, cwd = process.cwd()): boolean {
  try {
    const realProjectRoot = fs.realpathSync(cwd);
    const realFilePath = fs.realpathSync(filePath);
    return isPathInside(realProjectRoot, realFilePath);
  } catch {
    return false;
  }
}

export function configPath(cwd = process.cwd()): string {
  return path.join(canonicalProjectDataDir(cwd), "config.json");
}

export function indexPath(cwd = process.cwd()): string {
  return path.join(canonicalProjectDataDir(cwd), "index.json");
}

export function cacheFilePath(hash: string, cwd = process.cwd()): string {
  return path.join(canonicalProjectDataDir(cwd), "cache", `${hash}.json`);
}

export function adapterDir(runtime: "codex" | "claude", cwd = process.cwd()): string {
  return path.join(canonicalProjectDataDir(cwd), "adapters", runtime);
}

export function runtimeStatusPath(runtime: "codex" | "claude", cwd = process.cwd()): string {
  return path.join(adapterDir(runtime, cwd), "status.json");
}

export function sessionsDir(cwd = process.cwd()): string {
  return path.join(canonicalProjectDataDir(cwd), "sessions");
}

export function sessionDir(cwd: string, sessionKey: string): string {
  return path.join(sessionsDir(cwd), sanitizeDataKey(sessionKey));
}

export function sessionEventsPath(cwd: string, sessionKey: string): string {
  return path.join(sessionDir(cwd, sessionKey), "events.jsonl");
}

export function sessionSummaryPath(cwd: string, sessionKey: string): string {
  return path.join(sessionDir(cwd, sessionKey), "summary.json");
}

export function sessionWorktreeEvidencePath(cwd: string, sessionKey: string): string {
  return path.join(sessionDir(cwd, sessionKey), "worktree.json");
}

export function sessionsSummaryPath(cwd = process.cwd()): string {
  return path.join(sessionsDir(cwd), "summary.json");
}
