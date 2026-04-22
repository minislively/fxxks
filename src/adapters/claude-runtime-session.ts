import fs from "node:fs";
import path from "node:path";
import { sanitizeDataKey } from "../core/paths";

type SeenFileState = {
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  lastModifiedAtMs?: number;
};

export type ClaudeRuntimeSessionState = {
  sessionKey: string;
  seenFiles: Record<string, SeenFileState>;
};

function stateRoot(cwd: string): string {
  return path.join(cwd, ".fooks", "state", "claude-runtime");
}

function emptyState(sessionKey: string): ClaudeRuntimeSessionState {
  return {
    sessionKey,
    seenFiles: {},
  };
}

export function resolveClaudeRuntimeSessionKey(sessionId?: string): string {
  return sessionId?.trim() || "default-session";
}

export function claudeRuntimeSessionPath(cwd: string, sessionKey: string): string {
  return path.join(stateRoot(cwd), `${sanitizeDataKey(sessionKey)}.json`);
}

export function readClaudeRuntimeSession(cwd: string, sessionKey: string): ClaudeRuntimeSessionState {
  const file = claudeRuntimeSessionPath(cwd, sessionKey);
  if (!fs.existsSync(file)) {
    return emptyState(sessionKey);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as ClaudeRuntimeSessionState;
    if (parsed.sessionKey !== sessionKey || typeof parsed.seenFiles !== "object" || parsed.seenFiles === null) {
      return emptyState(sessionKey);
    }
    return parsed;
  } catch {
    return emptyState(sessionKey);
  }
}

export function writeClaudeRuntimeSession(cwd: string, state: ClaudeRuntimeSessionState): string {
  const file = claudeRuntimeSessionPath(cwd, state.sessionKey);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  return file;
}

export function initializeClaudeRuntimeSession(cwd: string, sessionKey: string): string {
  return writeClaudeRuntimeSession(cwd, emptyState(sessionKey));
}

export function markClaudeRuntimeSeenFile(cwd: string, sessionKey: string, filePath: string): { statePath: string; seenCount: number } {
  const state = readClaudeRuntimeSession(cwd, sessionKey);
  const now = new Date().toISOString();
  const existing = state.seenFiles[filePath];
  let lastModifiedAtMs: number | undefined;
  try {
    lastModifiedAtMs = fs.statSync(path.join(cwd, filePath)).mtimeMs;
  } catch {
    // ignore missing file
  }
  state.seenFiles[filePath] = existing
    ? {
        ...existing,
        lastSeenAt: now,
        seenCount: existing.seenCount + 1,
        lastModifiedAtMs: lastModifiedAtMs ?? existing.lastModifiedAtMs,
      }
    : {
        firstSeenAt: now,
        lastSeenAt: now,
        seenCount: 1,
        lastModifiedAtMs,
      };

  return {
    statePath: writeClaudeRuntimeSession(cwd, state),
    seenCount: state.seenFiles[filePath].seenCount,
  };
}

export function clearClaudeRuntimeSession(cwd: string, sessionKey: string): string {
  const file = claudeRuntimeSessionPath(cwd, sessionKey);
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
  return file;
}
