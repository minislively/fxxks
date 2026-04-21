import path from "node:path";
import fs from "node:fs";

export const FOOKS_DIR = ".fooks";

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
  return key.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase() || "default-session";
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

export function sessionsSummaryPath(cwd = process.cwd()): string {
  return path.join(sessionsDir(cwd), "summary.json");
}
