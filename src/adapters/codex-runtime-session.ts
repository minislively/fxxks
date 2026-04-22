import fs from "node:fs";
import path from "node:path";
import { sanitizeDataKey } from "../core/paths";

type SeenFileState = {
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
};

export type CodexRuntimeSessionState = {
  sessionKey: string;
  seenFiles: Record<string, SeenFileState>;
};

function stateRoot(cwd: string): string {
  return path.join(cwd, ".fooks", "state", "codex-runtime");
}

function sanitizeKey(sessionKey: string): string {
  return sanitizeDataKey(sessionKey);
}

export function resolveCodexRuntimeSessionKey(sessionId?: string, threadId?: string): string {
  return sessionId?.trim() || threadId?.trim() || "default-session";
}

export function codexRuntimeSessionPath(cwd: string, sessionKey: string): string {
  return path.join(stateRoot(cwd), `${sanitizeKey(sessionKey)}.json`);
}

function emptyState(sessionKey: string): CodexRuntimeSessionState {
  return {
    sessionKey,
    seenFiles: {},
  };
}

export function readCodexRuntimeSession(cwd: string, sessionKey: string): CodexRuntimeSessionState {
  const file = codexRuntimeSessionPath(cwd, sessionKey);
  if (!fs.existsSync(file)) {
    return emptyState(sessionKey);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as CodexRuntimeSessionState;
    if (parsed.sessionKey !== sessionKey || typeof parsed.seenFiles !== "object" || parsed.seenFiles === null) {
      return emptyState(sessionKey);
    }
    return parsed;
  } catch {
    return emptyState(sessionKey);
  }
}

export function writeCodexRuntimeSession(cwd: string, state: CodexRuntimeSessionState): string {
  const file = codexRuntimeSessionPath(cwd, state.sessionKey);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  return file;
}

export function initializeCodexRuntimeSession(cwd: string, sessionKey: string): string {
  return writeCodexRuntimeSession(cwd, emptyState(sessionKey));
}

export function markCodexRuntimeSeenFile(cwd: string, sessionKey: string, filePath: string): { statePath: string; seenCount: number } {
  const state = readCodexRuntimeSession(cwd, sessionKey);
  const now = new Date().toISOString();
  const existing = state.seenFiles[filePath];
  state.seenFiles[filePath] = existing
    ? {
        ...existing,
        lastSeenAt: now,
        seenCount: existing.seenCount + 1,
      }
    : {
        firstSeenAt: now,
        lastSeenAt: now,
        seenCount: 1,
      };

  return {
    statePath: writeCodexRuntimeSession(cwd, state),
    seenCount: state.seenFiles[filePath].seenCount,
  };
}

export function clearCodexRuntimeSession(cwd: string, sessionKey: string): string {
  const file = codexRuntimeSessionPath(cwd, sessionKey);
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
  return file;
}
