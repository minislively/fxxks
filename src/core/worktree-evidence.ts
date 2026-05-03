import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseAndSummarizeWorktreeStatus } from "./worktree-status";
import { sessionWorktreeEvidencePath } from "./paths";

export const WORKTREE_EVIDENCE_SCHEMA_VERSION = 1;
export const WORKTREE_EVIDENCE_CLAIM_BOUNDARY =
  "Local git worktree evidence only; does not mutate files or prove provider/runtime savings.";
export const WORKTREE_STATUS_COMMAND = "git status --porcelain=v1 -z";
export const WORKTREE_BRANCH_DIVERGENCE_COMMANDS = [
  "git symbolic-ref --quiet --short HEAD",
  "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
  "git rev-list --left-right --count HEAD...@{u}",
] as const;
export const WORKTREE_BRANCH_DIVERGENCE_SOURCE = "local tracking refs only; no fetch performed";
export const DEFAULT_WORKTREE_STATUS_TIMEOUT_MS = 1000;

export type WorktreeStatusRunner = (cwd: string) => string;
export type WorktreeGitRunner = (cwd: string, args: string[]) => string;

export type BranchDivergence =
  | { kind: "available"; branch: string; upstream: string; ahead: number; behind: number; source: typeof WORKTREE_BRANCH_DIVERGENCE_SOURCE }
  | { kind: "no-upstream"; branch: string; source: typeof WORKTREE_BRANCH_DIVERGENCE_SOURCE }
  | { kind: "detached"; source: typeof WORKTREE_BRANCH_DIVERGENCE_SOURCE }
  | { kind: "unknown"; reason: string; source: typeof WORKTREE_BRANCH_DIVERGENCE_SOURCE };

export type WorktreeSnapshot = {
  capturedAt: string;
  clean: boolean;
  changedPaths: string[];
  trackedPaths: string[];
  untrackedPaths: string[];
  ignoredPaths: string[];
  conflictedPaths: string[];
  branchDivergence?: BranchDivergence;
};

export type WorktreeDelta = {
  newDirtyPaths: string[];
  resolvedDirtyPaths: string[];
  stillDirtyPaths: string[];
  conflictedPaths: string[];
};

export type WorktreeEvidenceFile = {
  schemaVersion: typeof WORKTREE_EVIDENCE_SCHEMA_VERSION;
  claimBoundary: typeof WORKTREE_EVIDENCE_CLAIM_BOUNDARY;
  command: typeof WORKTREE_STATUS_COMMAND;
  baseline?: WorktreeSnapshot;
  latest?: WorktreeSnapshot;
  delta?: WorktreeDelta;
  blockers: string[];
};

export type WorktreeCaptureResult = {
  snapshot?: WorktreeSnapshot;
  blockers: string[];
};

export type WorktreeEvidenceResult = {
  path: string;
  evidence: WorktreeEvidenceFile;
};

export type WorktreeCurrentStatus = {
  schemaVersion: typeof WORKTREE_EVIDENCE_SCHEMA_VERSION;
  claimBoundary: typeof WORKTREE_EVIDENCE_CLAIM_BOUNDARY;
  command: typeof WORKTREE_STATUS_COMMAND;
  cwd: string;
  capturedAt: string;
  snapshot?: WorktreeSnapshot;
  blockers: string[];
  branchDivergence?: BranchDivergence;
};

export type WorktreeEvidenceOptions = {
  runner?: WorktreeStatusRunner;
  gitRunner?: WorktreeGitRunner;
  now?: () => string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueSorted(paths: string[]): string[] {
  return [...new Set(paths)].sort((left, right) => left.localeCompare(right));
}

function emptyEvidence(blockers: string[] = []): WorktreeEvidenceFile {
  return {
    schemaVersion: WORKTREE_EVIDENCE_SCHEMA_VERSION,
    claimBoundary: WORKTREE_EVIDENCE_CLAIM_BOUNDARY,
    command: WORKTREE_STATUS_COMMAND,
    blockers,
  };
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

function blockerFromError(error: unknown): string {
  return `worktree status unavailable: ${errorDetail(error)}`;
}

function gitFailureReason(error: unknown): string {
  return errorDetail(error);
}

export function defaultWorktreeGitRunner(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: DEFAULT_WORKTREE_STATUS_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function parseAheadBehind(output: string): { ahead: number; behind: number } | undefined {
  const [left, right] = output.trim().split(/\s+/);
  const ahead = Number.parseInt(left ?? "", 10);
  const behind = Number.parseInt(right ?? "", 10);
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return undefined;
  return { ahead, behind };
}

export function captureBranchDivergence(cwd = process.cwd(), options: Pick<WorktreeEvidenceOptions, "gitRunner"> = {}): BranchDivergence {
  const gitRunner = options.gitRunner ?? defaultWorktreeGitRunner;
  let branch: string;

  try {
    branch = gitRunner(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]).trim();
    if (!branch) {
      return { kind: "detached", source: WORKTREE_BRANCH_DIVERGENCE_SOURCE };
    }
  } catch {
    return { kind: "detached", source: WORKTREE_BRANCH_DIVERGENCE_SOURCE };
  }

  let upstream: string;
  try {
    upstream = gitRunner(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).trim();
    if (!upstream) {
      return { kind: "no-upstream", branch, source: WORKTREE_BRANCH_DIVERGENCE_SOURCE };
    }
  } catch {
    return { kind: "no-upstream", branch, source: WORKTREE_BRANCH_DIVERGENCE_SOURCE };
  }

  try {
    const parsed = parseAheadBehind(gitRunner(cwd, ["rev-list", "--left-right", "--count", "HEAD...@{u}"]));
    if (!parsed) {
      return { kind: "unknown", reason: "unable to parse git rev-list ahead/behind counts", source: WORKTREE_BRANCH_DIVERGENCE_SOURCE };
    }
    return { kind: "available", branch, upstream, ...parsed, source: WORKTREE_BRANCH_DIVERGENCE_SOURCE };
  } catch (error) {
    return { kind: "unknown", reason: gitFailureReason(error), source: WORKTREE_BRANCH_DIVERGENCE_SOURCE };
  }
}

export function defaultWorktreeStatusRunner(cwd: string): string {
  return execFileSync("git", ["status", "--porcelain=v1", "-z"], {
    cwd,
    encoding: "utf8",
    timeout: DEFAULT_WORKTREE_STATUS_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

export function captureWorktreeSnapshot(cwd = process.cwd(), options: WorktreeEvidenceOptions = {}): WorktreeCaptureResult {
  const capturedAt = options.now?.() ?? nowIso();
  const runner = options.runner ?? defaultWorktreeStatusRunner;
  const branchDivergence = captureBranchDivergence(cwd, options);

  try {
    const output = runner(cwd);
    const summary = parseAndSummarizeWorktreeStatus(output, { nulTerminated: true });
    return {
      snapshot: {
        capturedAt,
        clean: summary.clean,
        changedPaths: uniqueSorted(summary.changedPaths),
        trackedPaths: uniqueSorted(summary.trackedPaths),
        untrackedPaths: uniqueSorted(summary.untrackedPaths),
        ignoredPaths: uniqueSorted(summary.ignoredPaths),
        conflictedPaths: uniqueSorted(summary.conflictedPaths),
        branchDivergence,
      },
      blockers: [],
    };
  } catch (error) {
    return {
      blockers: [blockerFromError(error)],
    };
  }
}

export function computeWorktreeDelta(baseline: WorktreeSnapshot, latest: WorktreeSnapshot): WorktreeDelta {
  const baselineDirty = new Set(baseline.changedPaths);
  const latestDirty = new Set(latest.changedPaths);
  return {
    newDirtyPaths: uniqueSorted(latest.changedPaths.filter((filePath) => !baselineDirty.has(filePath))),
    resolvedDirtyPaths: uniqueSorted(baseline.changedPaths.filter((filePath) => !latestDirty.has(filePath))),
    stillDirtyPaths: uniqueSorted(latest.changedPaths.filter((filePath) => baselineDirty.has(filePath))),
    conflictedPaths: uniqueSorted(latest.conflictedPaths),
  };
}

export function readWorktreeEvidence(cwd: string, sessionKey: string): WorktreeEvidenceFile | null {
  const filePath = sessionWorktreeEvidencePath(cwd, sessionKey);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as WorktreeEvidenceFile;
}

export function writeWorktreeEvidence(cwd: string, sessionKey: string, evidence: WorktreeEvidenceFile): string {
  const filePath = sessionWorktreeEvidencePath(cwd, sessionKey);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return filePath;
}

function unwrittenEvidenceResult(cwd: string, sessionKey: string, evidence: WorktreeEvidenceFile, error: unknown): WorktreeEvidenceResult {
  return {
    path: sessionWorktreeEvidencePath(cwd, sessionKey),
    evidence: {
      ...evidence,
      blockers: uniqueSorted([...evidence.blockers, `worktree evidence write failed: ${errorDetail(error)}`]),
    },
  };
}

function readExistingEvidenceForUpdate(cwd: string, sessionKey: string): WorktreeEvidenceFile {
  try {
    return readWorktreeEvidence(cwd, sessionKey) ?? emptyEvidence();
  } catch (error) {
    return emptyEvidence([`existing worktree evidence unreadable: ${errorDetail(error)}`]);
  }
}

export function initializeWorktreeEvidenceSafe(
  cwd: string,
  sessionKey: string,
  options: WorktreeEvidenceOptions = {},
): WorktreeEvidenceResult {
  const capture = captureWorktreeSnapshot(cwd, options);
  const evidence = emptyEvidence(capture.blockers);
  if (capture.snapshot) {
    evidence.baseline = capture.snapshot;
  }
  try {
    const filePath = writeWorktreeEvidence(cwd, sessionKey, evidence);
    return { path: filePath, evidence };
  } catch (error) {
    return unwrittenEvidenceResult(cwd, sessionKey, evidence, error);
  }
}

export function finalizeWorktreeEvidenceSafe(
  cwd: string,
  sessionKey: string,
  options: WorktreeEvidenceOptions = {},
): WorktreeEvidenceResult {
  const evidence = readExistingEvidenceForUpdate(cwd, sessionKey);
  const capture = captureWorktreeSnapshot(cwd, options);
  evidence.blockers = uniqueSorted([...evidence.blockers, ...capture.blockers]);
  if (capture.snapshot) {
    evidence.latest = capture.snapshot;
  }
  if (evidence.baseline && evidence.latest) {
    evidence.delta = computeWorktreeDelta(evidence.baseline, evidence.latest);
  }
  try {
    const filePath = writeWorktreeEvidence(cwd, sessionKey, evidence);
    return { path: filePath, evidence };
  } catch (error) {
    return unwrittenEvidenceResult(cwd, sessionKey, evidence, error);
  }
}

export function currentWorktreeEvidenceStatus(cwd = process.cwd(), options: WorktreeEvidenceOptions = {}): WorktreeCurrentStatus {
  const capturedAt = options.now?.() ?? nowIso();
  const capture = captureWorktreeSnapshot(cwd, { ...options, now: () => capturedAt });
  return {
    schemaVersion: WORKTREE_EVIDENCE_SCHEMA_VERSION,
    claimBoundary: WORKTREE_EVIDENCE_CLAIM_BOUNDARY,
    command: WORKTREE_STATUS_COMMAND,
    cwd,
    capturedAt,
    snapshot: capture.snapshot,
    blockers: capture.blockers,
    branchDivergence: capture.snapshot?.branchDivergence ?? captureBranchDivergence(cwd, options),
  };
}
