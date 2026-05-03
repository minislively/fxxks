import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  currentWorktreeEvidenceStatus,
  type WorktreeCurrentStatus,
  type WorktreeEvidenceOptions,
  WORKTREE_BRANCH_DIVERGENCE_SOURCE,
} from "./worktree-evidence";

export const OPERATOR_ACTIVITY_SCHEMA_VERSION = 1;
export const OPERATOR_ACTIVITY_COMMAND = "status activity";
export const OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG = "--include-remote-counts";
export const OPERATOR_ACTIVITY_CLAIM_BOUNDARY =
  "Local read-only fooks operator activity snapshot; no provider messaging, no backlog invention, no git fetch, and remote issue/PR counts only when explicitly enabled.";
export const OPERATOR_ACTIVITY_TMUX_COMMAND = "tmux list-panes -a -F #{session_name}\\t#{pane_current_path}\\t#{pane_current_command}";
export const OPERATOR_ACTIVITY_REMOTE_SOURCE = "GitHub CLI gh issue/pr list; explicit opt-in only";
export const DEFAULT_OPERATOR_ACTIVITY_TIMEOUT_MS = 1000;
export const DEFAULT_OPERATOR_ACTIVITY_REMOTE_TIMEOUT_MS = 1500;

export type OperatorActivityCommandRunner = (command: string, args: string[], cwd: string, timeoutMs: number) => string;
export type OperatorActivityPathExists = (targetPath: string) => boolean;

export type OperatorActivityOptions = WorktreeEvidenceOptions & {
  includeRemoteCounts?: boolean;
  commandRunner?: OperatorActivityCommandRunner;
  pathExists?: OperatorActivityPathExists;
  now?: () => string;
};

export type OperatorActivityWorktree = {
  clean: boolean | null;
  verdict: WorktreeCurrentStatus["worktreeVerdict"];
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  divergenceSource?: typeof WORKTREE_BRANCH_DIVERGENCE_SOURCE;
  delta: {
    source: "current git status only; no session baseline comparison";
    changedPathCount: number;
    trackedPathCount: number;
    untrackedPathCount: number;
    conflictedPathCount: number;
    changedPaths: string[];
    conflictedPaths: string[];
  };
  blockers: string[];
};

export type OperatorActivityTmuxPane = {
  path: string;
  exists: boolean;
  current: boolean;
  command?: string;
};

export type OperatorActivityTmuxSession = {
  session: string;
  paneCount: number;
  current: boolean;
  panes: OperatorActivityTmuxPane[];
};

export type OperatorActivityTmux = {
  available: boolean;
  command: typeof OPERATOR_ACTIVITY_TMUX_COMMAND;
  sessions: OperatorActivityTmuxSession[];
  blockers: string[];
};

export type OperatorActivityRemoteCounts =
  | {
      enabled: false;
      source: "disabled; pass --include-remote-counts to opt in";
    }
  | {
      enabled: true;
      source: typeof OPERATOR_ACTIVITY_REMOTE_SOURCE;
      openIssues?: number;
      openPullRequests?: number;
      blockers: string[];
    };

export type OperatorActivitySnapshot = {
  schemaVersion: typeof OPERATOR_ACTIVITY_SCHEMA_VERSION;
  command: typeof OPERATOR_ACTIVITY_COMMAND;
  generatedAt: string;
  cwd: string;
  claimBoundary: typeof OPERATOR_ACTIVITY_CLAIM_BOUNDARY;
  readOnly: true;
  worktree: OperatorActivityWorktree;
  tmux: OperatorActivityTmux;
  optionalCounts: OperatorActivityRemoteCounts;
  blockers: string[];
};

type ParsedTmuxPane = {
  session: string;
  path: string;
  command?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function errorDetail(error: unknown): string {
  const maybeError = error && typeof error === "object" ? (error as { message?: unknown; stderr?: unknown; signal?: unknown; code?: unknown }) : {};
  const stderr = maybeError.stderr;
  const stderrText = Buffer.isBuffer(stderr) ? stderr.toString("utf8").trim() : typeof stderr === "string" ? stderr.trim() : "";
  const message = typeof maybeError.message === "string" ? maybeError.message.trim() : String(error);
  const status = maybeError.signal ? `signal ${String(maybeError.signal)}` : maybeError.code !== undefined ? `code ${String(maybeError.code)}` : "";
  const detail = stderrText || message || "unknown error";
  return status ? `${detail} (${status})` : detail;
}

function safeResolve(targetPath: string): string {
  return path.resolve(targetPath.replace(/ \(deleted\)$/u, ""));
}

function pathContainsCwd(parent: string, cwd: string): boolean {
  const relative = path.relative(safeResolve(parent), safeResolve(cwd));
  return relative === "" || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function includesFooksSignal(value: string, cwd: string): boolean {
  const lower = value.replace(/\\/g, "/").toLowerCase();
  const cwdBase = path.basename(cwd).toLowerCase();
  return lower.includes("fooks") || (cwdBase.includes("fooks") && lower.includes(cwdBase));
}

function panePathDeleted(panePath: string): boolean {
  return panePath.includes("(deleted)");
}

function panePathWithoutDeletedMarker(panePath: string): string {
  return panePath.replace(/ \(deleted\)$/u, "").trim();
}

export function defaultOperatorActivityCommandRunner(command: string, args: string[], cwd: string, timeoutMs: number): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

export function parseOperatorActivityTmuxPanes(output: string): ParsedTmuxPane[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const [session, panePath, ...commandParts] = line.split("\t");
      if (!session || !panePath) return undefined;
      const command = commandParts.join("\t").trim();
      const entry: ParsedTmuxPane = { session, path: panePath };
      if (command) {
        entry.command = command;
      }
      return entry;
    })
    .filter((entry): entry is ParsedTmuxPane => Boolean(entry));
}

function buildWorktreeSnapshot(status: WorktreeCurrentStatus): OperatorActivityWorktree {
  const snapshot = status.snapshot;
  const divergence = status.branchDivergence;
  const branchFields = divergence?.kind === "available"
    ? {
        branch: divergence.branch,
        upstream: divergence.upstream,
        ahead: divergence.ahead,
        behind: divergence.behind,
        divergenceSource: divergence.source,
      }
    : divergence?.kind === "no-upstream"
      ? { branch: divergence.branch, divergenceSource: divergence.source }
      : divergence?.kind === "unknown" || divergence?.kind === "detached"
        ? { divergenceSource: divergence.source }
        : {};

  return {
    clean: snapshot?.clean ?? null,
    verdict: status.worktreeVerdict,
    ...branchFields,
    delta: {
      source: "current git status only; no session baseline comparison",
      changedPathCount: snapshot?.changedPaths.length ?? 0,
      trackedPathCount: snapshot?.trackedPaths.length ?? 0,
      untrackedPathCount: snapshot?.untrackedPaths.length ?? 0,
      conflictedPathCount: snapshot?.conflictedPaths.length ?? 0,
      changedPaths: snapshot?.changedPaths ?? [],
      conflictedPaths: snapshot?.conflictedPaths ?? [],
    },
    blockers: status.blockers,
  };
}

function readTmuxActivity(cwd: string, options: OperatorActivityOptions): OperatorActivityTmux {
  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  const pathExists = options.pathExists ?? fs.existsSync;
  const blockers: string[] = [];
  let output = "";

  try {
    output = runner("tmux", ["list-panes", "-a", "-F", "#{session_name}\t#{pane_current_path}\t#{pane_current_command}"], cwd, DEFAULT_OPERATOR_ACTIVITY_TIMEOUT_MS);
  } catch (error) {
    blockers.push(`tmux activity unavailable: ${errorDetail(error)}`);
    return {
      available: false,
      command: OPERATOR_ACTIVITY_TMUX_COMMAND,
      sessions: [],
      blockers: uniqueSorted(blockers),
    };
  }

  const currentCwd = safeResolve(cwd);
  const panesBySession = new Map<string, OperatorActivityTmuxPane[]>();
  for (const pane of parseOperatorActivityTmuxPanes(output)) {
    const cleanPanePath = panePathWithoutDeletedMarker(pane.path);
    const deleted = panePathDeleted(pane.path);
    const exists = !deleted && pathExists(cleanPanePath);
    const current = exists && (pathContainsCwd(cleanPanePath, currentCwd) || pathContainsCwd(currentCwd, cleanPanePath));
    if (!includesFooksSignal(pane.session, cwd) && !includesFooksSignal(cleanPanePath, cwd) && !current) continue;
    const panes = panesBySession.get(pane.session) ?? [];
    panes.push({ path: pane.path, exists, current, command: pane.command });
    panesBySession.set(pane.session, panes);
  }

  return {
    available: true,
    command: OPERATOR_ACTIVITY_TMUX_COMMAND,
    sessions: [...panesBySession.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([session, panes]) => ({
        session,
        paneCount: panes.length,
        current: panes.some((pane) => pane.current),
        panes,
      })),
    blockers: uniqueSorted(blockers),
  };
}

function parseGhJsonCount(output: string): number | undefined {
  try {
    const parsed = JSON.parse(output) as unknown;
    return Array.isArray(parsed) ? parsed.length : undefined;
  } catch {
    return undefined;
  }
}

function readRemoteCounts(cwd: string, options: OperatorActivityOptions): OperatorActivityRemoteCounts {
  if (!options.includeRemoteCounts) {
    return { enabled: false, source: "disabled; pass --include-remote-counts to opt in" };
  }

  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  const blockers: string[] = [];
  let openIssues: number | undefined;
  let openPullRequests: number | undefined;

  try {
    const output = runner("gh", ["issue", "list", "--state", "open", "--json", "number", "--limit", "1000"], cwd, DEFAULT_OPERATOR_ACTIVITY_REMOTE_TIMEOUT_MS);
    openIssues = parseGhJsonCount(output);
    if (openIssues === undefined) blockers.push("GitHub open issue count unavailable: unable to parse gh issue list JSON");
  } catch (error) {
    blockers.push(`GitHub open issue count unavailable: ${errorDetail(error)}`);
  }

  try {
    const output = runner("gh", ["pr", "list", "--state", "open", "--json", "number", "--limit", "1000"], cwd, DEFAULT_OPERATOR_ACTIVITY_REMOTE_TIMEOUT_MS);
    openPullRequests = parseGhJsonCount(output);
    if (openPullRequests === undefined) blockers.push("GitHub open PR count unavailable: unable to parse gh pr list JSON");
  } catch (error) {
    blockers.push(`GitHub open PR count unavailable: ${errorDetail(error)}`);
  }

  return {
    enabled: true,
    source: OPERATOR_ACTIVITY_REMOTE_SOURCE,
    openIssues,
    openPullRequests,
    blockers: uniqueSorted(blockers),
  };
}

export function readOperatorActivitySnapshot(cwd = process.cwd(), options: OperatorActivityOptions = {}): OperatorActivitySnapshot {
  const generatedAt = options.now?.() ?? nowIso();
  const worktreeStatus = currentWorktreeEvidenceStatus(cwd, { ...options, now: () => generatedAt });
  const worktree = buildWorktreeSnapshot(worktreeStatus);
  const tmux = readTmuxActivity(cwd, options);
  const optionalCounts = readRemoteCounts(cwd, options);
  const optionalCountBlockers = optionalCounts.enabled ? optionalCounts.blockers : [];

  return {
    schemaVersion: OPERATOR_ACTIVITY_SCHEMA_VERSION,
    command: OPERATOR_ACTIVITY_COMMAND,
    generatedAt,
    cwd,
    claimBoundary: OPERATOR_ACTIVITY_CLAIM_BOUNDARY,
    readOnly: true,
    worktree,
    tmux,
    optionalCounts,
    blockers: uniqueSorted([...worktree.blockers, ...tmux.blockers, ...optionalCountBlockers]),
  };
}
