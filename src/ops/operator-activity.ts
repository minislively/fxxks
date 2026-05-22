import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { isTmuxNoServerRunningError } from "./tmux-errors";
import {
  ARTIFACT_AUDIT_CLAIM_BOUNDARY,
  ARTIFACT_AUDIT_COMMAND,
  DEFAULT_ARTIFACT_AUDIT_TIMEOUT_MS,
  auditArtifacts,
  type ArtifactAuditArchiveEvidence,
} from "./artifact-audit";
import {
  currentWorktreeEvidenceStatus,
  type WorktreeCurrentStatus,
  type WorktreeEvidenceOptions,
  WORKTREE_BRANCH_DIVERGENCE_SOURCE,
} from "../reporting/worktree-evidence";

export const OPERATOR_ACTIVITY_SCHEMA_VERSION = 1;
export const OPERATOR_ACTIVITY_PROVENANCE_SCHEMA_VERSION = 1;
export const OPERATOR_ACTIVITY_COMMAND = "status activity";
export const OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG = "--include-remote-counts";
export const OPERATOR_ACTIVITY_CLAIM_BOUNDARY =
  "Local read-only fooks operator activity snapshot; no provider messaging, no backlog invention, no git fetch, and remote issue/PR counts only when explicitly enabled.";
export const OPERATOR_ACTIVITY_TMUX_COMMAND = "tmux list-panes -a -F #{session_name}\\t#{pane_current_path}\\t#{pane_current_command}\\t#{pane_id}";
export const OPERATOR_ACTIVITY_REMOTE_SOURCE = "GitHub CLI gh issue/pr list; explicit opt-in only";
export const DEFAULT_OPERATOR_ACTIVITY_TIMEOUT_MS = 1000;
export const DEFAULT_OPERATOR_ACTIVITY_REMOTE_TIMEOUT_MS = 1500;
export const OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT = 5;
export const OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE = "status activity current-run dogfood reminder";
export const OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY =
  "Current-run operator reminder evidence only; read-only, bounded to this snapshot, and not cleanup authority or runtime/provider behavior.";
export const OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE =
  "GitHub Actions run list for exact local origin/main head; read-only and no fetch performed";
export const OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_CLAIM_BOUNDARY =
  "Read-only post-merge main CI evidence for the exact local origin/main head only; missing exact-head workflow evidence stays unknown or pending and never becomes success.";
export const OPERATOR_ACTIVITY_TIMING_SCHEMA_VERSION = 1;
export const OPERATOR_ACTIVITY_TIMING_SOURCE = "fooks status activity diagnostic timing";
export const OPERATOR_ACTIVITY_TIMING_CLAIM_BOUNDARY =
  "Diagnostic/read-only operator activity subphase timing only; not current-work authority, not cleanup authority, not provider billing/runtime proof, and not a source-of-truth semantic input.";
export const OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_ISSUE = "#910";
export const OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_SOURCE = "operator/activity issue #910 staged OMX prompt pane evidence";
export const OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_CLAIM_BOUNDARY =
  "Read-only issue #910 operator artifact; a current OMX pane with only a staged prompt placeholder, no submitted/working/tool-output evidence, only .fooks-session-task.txt delta, and ahead=0 is not active development proof.";
export const OPERATOR_ACTIVITY_TMUX_CAPTURE_COMMAND = "tmux capture-pane -pt <pane_id> -S -200";
export const OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS = ["CI", "React Web Release Report"] as const;
export const OPERATOR_ACTIVITY_PLANNING_EPIC_ISSUE_NUMBER = 960;
const OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_RUN_LIST_ARGS = [
  "run",
  "list",
  "--branch",
  "main",
  "--limit",
  "50",
  "--json",
  "databaseId,status,conclusion,createdAt,updatedAt,headBranch,headSha,event,name,workflowName,url",
] as const;
const OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_API_WORKFLOW_RUNS_SOURCE =
  "GitHub REST API workflow-runs fallback for exact local origin/main head; read-only and no fetch performed";
const OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_API_WORKFLOW_RUNS_SURFACE = "gh api actions workflow-runs";
const OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_REMOTE_FRESHNESS_CAVEAT =
  "remote freshness not verified; local origin/main was not fetched before this read-only lookup";

export type OperatorActivityCommandRunner = (command: string, args: string[], cwd: string, timeoutMs: number) => string;
export type OperatorActivityPathExists = (targetPath: string) => boolean;

export type OperatorActivityOptions = WorktreeEvidenceOptions & {
  includeRemoteCounts?: boolean;
  includeRemoteWorkflowEvidence?: boolean;
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

export type OperatorActivityPanePromptEvidence = {
  inspected: boolean;
  source: typeof OPERATOR_ACTIVITY_TMUX_CAPTURE_COMMAND;
  classification: "submittedOrWorkingEvidence" | "stagedPromptOnly" | "unavailable";
  submittedOrWorkingEvidence: boolean;
  reasons: string[];
};

export type OperatorActivityTmuxPane = {
  path: string;
  exists: boolean;
  deleted: boolean;
  current: boolean;
  ancestorOfCurrentCwd?: boolean;
  command?: string;
  paneId?: string;
  promptEvidence?: OperatorActivityPanePromptEvidence;
};

export type OperatorActivityTmuxSessionStatus = "current" | "activeOrUnknown" | "staleRuntimeCandidate" | "stagedPromptOnly" | "ancestorMaintenance";

export type OperatorActivityTmuxSession = {
  session: string;
  paneCount: number;
  current: boolean;
  status: OperatorActivityTmuxSessionStatus;
  reasons: string[];
  panes: OperatorActivityTmuxPane[];
  manualCleanupCommands: string[];
  cleanupOrder: string[];
};

export type OperatorActivityTmux = {
  available: boolean;
  command: typeof OPERATOR_ACTIVITY_TMUX_COMMAND;
  sessions: OperatorActivityTmuxSession[];
  blockers: string[];
};

export type OperatorActivityLegacyWorktreeEntry = {
  path: string;
  branch: string;
  head?: string;
  status: "staleClosedArtifact";
  reasons: string[];
  archiveEvidence: ArtifactAuditArchiveEvidence;
  activeSessionEvidence: "no tmux panes mapped to this worktree";
};

export type OperatorActivityLegacyWorktreeEvidence = {
  available: boolean;
  source: typeof ARTIFACT_AUDIT_COMMAND;
  claimBoundary: typeof ARTIFACT_AUDIT_CLAIM_BOUNDARY;
  staleClosedArtifactWorktreeCount: number;
  entries: OperatorActivityLegacyWorktreeEntry[];
  entryLimit: typeof OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT;
  omittedEntryCount: number;
  cleanupCommandsIncluded: false;
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
      openIssueNumbers?: number[];
      openPullRequests?: number;
      blockers: string[];
    };

export type OperatorActivityCurrentRunClassification = "mainEchoNonActive" | "activeOrUnknown";

export type OperatorActivityCurrentRunReceipt = {
  status: "active" | "idle";
  active: boolean;
  oneLine: string;
  evidenceKinds: Array<"issue" | "pullRequest" | "branch" | "session" | "delta">;
  advisoryOnly: true;
  readOnly: true;
  claimBoundary: typeof OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY;
};

export type OperatorActivityStagedOmxPromptEvidence = {
  issue: typeof OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_ISSUE;
  source: typeof OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_SOURCE;
  claimBoundary: typeof OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_CLAIM_BOUNDARY;
  readOnly: true;
  classification: "stagedPromptOnly" | "activeOrUnknown";
  stagedPromptOnlySessionCount: number;
  preventsActiveWorkEvidence: boolean;
  conditions: {
    onlyFooksSessionTaskDelta: boolean;
    aheadZero: boolean;
    requiresNoSubmittedPromptOrWorkEvidence: true;
    requiresCurrentOmxPane: true;
  };
  sessionNames: string[];
  reasons: string[];
};

export type OperatorActivityCurrentRunEvidence = {
  available: boolean;
  source: typeof OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE;
  claimBoundary: typeof OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY;
  classification: OperatorActivityCurrentRunClassification;
  mainEchoEvidence: boolean;
  activeWorkEvidence: boolean;
  remoteCountsRequired: true;
  evidence: {
    branch?: string;
    upstream?: string;
    clean: boolean | null;
    ahead?: number;
    behind?: number;
    fooksSessionCount: number;
    openIssues?: number;
    openPullRequests?: number;
    legacyStaleClosedArtifactWorktreeCount: number;
  };
  receipt: OperatorActivityCurrentRunReceipt;
  reasons: string[];
  blockers: string[];
};

export type OperatorActivityPostMergeMainWorkflowEvidenceStatus = "success" | "failure" | "pending" | "unknown";
export type OperatorActivityPostMergeMainWorkflowDiagnosticReason =
  | "success"
  | "failure"
  | "pending"
  | "empty-run"
  | "origin-main-head-unavailable"
  | "remote-workflow-evidence-disabled"
  | "timeout"
  | "auth"
  | "rate-limit"
  | "parse-error"
  | "unavailable"
  | "missing-conclusion";

export type OperatorActivityPostMergeMainWorkflowDiagnostic = {
  source: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE | typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_API_WORKFLOW_RUNS_SOURCE;
  command: string;
  apiSurface: "gh run list" | typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_API_WORKFLOW_RUNS_SURFACE;
  lookup: string;
  reason: OperatorActivityPostMergeMainWorkflowDiagnosticReason;
  remoteFreshnessCaveat: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_REMOTE_FRESHNESS_CAVEAT;
};

export type OperatorActivityPostMergeMainWorkflowEvidence = {
  workflow: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS[number];
  status: OperatorActivityPostMergeMainWorkflowEvidenceStatus;
  conclusion?: string;
  runStatus?: string;
  runId?: number;
  url?: string;
  headSha?: string;
  headBranch?: string;
  event?: string;
  updatedAt?: string;
  reason: string;
  diagnostic: OperatorActivityPostMergeMainWorkflowDiagnostic;
  primaryDiagnostic?: OperatorActivityPostMergeMainWorkflowDiagnostic;
  fallbackDiagnostic?: OperatorActivityPostMergeMainWorkflowDiagnostic;
};

export type OperatorActivityPostMergeMainCiEvidence = {
  available: boolean;
  source: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE;
  claimBoundary: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_CLAIM_BOUNDARY;
  readOnly: true;
  exactHeadRequired: true;
  mainRef: "origin/main";
  mainHeadSource: "local origin/main tracking ref; no fetch performed";
  remoteFreshness: "not verified";
  mainHead?: string;
  workflowEvidence: OperatorActivityPostMergeMainWorkflowEvidence[];
  summary: {
    exactHeadWorkflowCount: number;
    successCount: number;
    pendingCount: number;
    unknownCount: number;
    failureCount: number;
    allExactHeadConclusionsSuccessful: boolean;
  };
  blockers: string[];
};

export type OperatorActivityRuntimeProvenance = {
  schemaVersion: typeof OPERATOR_ACTIVITY_PROVENANCE_SCHEMA_VERSION;
  source: "operator/activity runtime provenance";
  claimBoundary: "Runtime provenance is diagnostic only; it distinguishes the executing entrypoint/build artifact from current source files and does not prove functional freshness by itself.";
  package: {
    status: "known" | "unknown";
    name?: string;
    version?: string;
    packageJsonPath?: string;
    reason?: string;
  };
  git: {
    scope: "invocation-cwd";
    cwd: string;
    head?: string;
    headStatus: "known" | "unknown";
    branch?: string;
    branchStatus: "known" | "unknown";
    source: "local git refs only for invocation cwd; no fetch performed";
    blockers: string[];
  };
  runtime: {
    node: string;
    platform: NodeJS.Platform;
    arch: string;
    argv1?: string;
    argv1Status: "known" | "unknown";
    cwd: string;
  };
  artifacts: {
    operatorActivityModulePath: string;
    operatorActivityModuleRealPath?: string;
    operatorActivityModuleMtimeMs?: number;
    cliEntrypointPath?: string;
    cliEntrypointRealPath?: string;
    cliEntrypointStatus: "known" | "unknown";
    cliEntrypointMtimeMs?: number;
    sourceOperatorActivityPath?: string;
    sourceOperatorActivityMtimeMs?: number;
    sourceNewerThanOperatorActivityModule?: boolean;
    freshnessStatus: "known" | "unknown";
    freshnessReason?: string;
    executionKind: "built-dist" | "source-or-non-dist" | "unknown";
    executionKindStatus: "known" | "unknown";
  };
};

export type OperatorDiagnosticTimingPhase = {
  name: string;
  elapsedMs: number;
  status: "ok" | "skipped" | "unavailable";
};

export type OperatorActivityTimingReceipt = {
  schemaVersion: typeof OPERATOR_ACTIVITY_TIMING_SCHEMA_VERSION;
  source: typeof OPERATOR_ACTIVITY_TIMING_SOURCE;
  status: "diagnostic";
  claimBoundary: typeof OPERATOR_ACTIVITY_TIMING_CLAIM_BOUNDARY;
  readOnly: true;
  totalMs: number;
  phases: OperatorDiagnosticTimingPhase[];
};

export type OperatorActivitySnapshot = {
  schemaVersion: typeof OPERATOR_ACTIVITY_SCHEMA_VERSION;
  command: typeof OPERATOR_ACTIVITY_COMMAND;
  generatedAt: string;
  cwd: string;
  claimBoundary: typeof OPERATOR_ACTIVITY_CLAIM_BOUNDARY;
  readOnly: true;
  runtimeProvenance: OperatorActivityRuntimeProvenance;
  worktree: OperatorActivityWorktree;
  tmux: OperatorActivityTmux;
  optionalCounts: OperatorActivityRemoteCounts;
  legacyWorktreeEvidence: OperatorActivityLegacyWorktreeEvidence;
  stagedOmxPromptEvidence: OperatorActivityStagedOmxPromptEvidence;
  currentRunEvidence: OperatorActivityCurrentRunEvidence;
  postMergeMainCiEvidence: OperatorActivityPostMergeMainCiEvidence;
  blockers: string[];
  diagnostics: {
    operatorActivityTiming: OperatorActivityTimingReceipt;
  };
};

type ParsedTmuxPane = {
  session: string;
  path: string;
  command?: string;
  paneId?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function roundDiagnosticMs(value: number): number {
  return Number(value.toFixed(2));
}

function timeDiagnosticPhase<T>(
  phases: OperatorDiagnosticTimingPhase[],
  name: string,
  callback: () => T,
): T {
  const startedAt = performance.now();
  try {
    const value = callback();
    phases.push({ name, elapsedMs: roundDiagnosticMs(performance.now() - startedAt), status: "ok" });
    return value;
  } catch (error) {
    phases.push({ name, elapsedMs: roundDiagnosticMs(performance.now() - startedAt), status: "unavailable" });
    throw error;
  }
}

function buildOperatorActivityTimingReceipt(phases: OperatorDiagnosticTimingPhase[], totalMs: number): OperatorActivityTimingReceipt {
  return {
    schemaVersion: OPERATOR_ACTIVITY_TIMING_SCHEMA_VERSION,
    source: OPERATOR_ACTIVITY_TIMING_SOURCE,
    status: "diagnostic",
    claimBoundary: OPERATOR_ACTIVITY_TIMING_CLAIM_BOUNDARY,
    readOnly: true,
    totalMs: roundDiagnosticMs(totalMs),
    phases: phases.map((phase) => ({ ...phase })),
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

type OperatorActivityPackageJson = {
  name?: string;
  version?: string;
  bin?: string | Record<string, string>;
};

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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
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

function readJsonFile(filePath: string): OperatorActivityPackageJson | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as OperatorActivityPackageJson;
  } catch {
    return undefined;
  }
}

function fileMtimeMs(filePath: string | undefined): number | undefined {
  if (!filePath) return undefined;
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return undefined;
  }
}

function realPathIfExists(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return undefined;
  }
}

function firstExistingAncestorPackageJson(startPath: string): string | undefined {
  let current = path.dirname(path.resolve(startPath));
  while (true) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function packageBinPath(packageJson: OperatorActivityPackageJson | undefined): string | undefined {
  if (!packageJson?.bin) return undefined;
  return typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin.fooks;
}

function packageOwnsCliArtifact(packageJson: OperatorActivityPackageJson | undefined, packageJsonPath: string | undefined, cliEntrypointPath: string | undefined): boolean {
  if (!packageJson || packageJson.name !== "fxxk-frontend-hooks") return false;
  if (!packageJsonPath || !cliEntrypointPath) return false;
  const binPath = packageBinPath(packageJson);
  if (!binPath) return false;
  const expectedCliPath = path.resolve(path.dirname(packageJsonPath), binPath);
  return path.normalize(expectedCliPath) === path.normalize(cliEntrypointPath);
}

function readGitField(cwd: string, args: string[]): { value?: string; blocker?: string } {
  try {
    return {
      value: execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        timeout: DEFAULT_OPERATOR_ACTIVITY_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }).trim() || undefined,
    };
  } catch (error) {
    return { blocker: `git ${args.join(" ")} unavailable: ${errorDetail(error)}` };
  }
}

function readOperatorActivityRuntimeProvenance(cwd: string): OperatorActivityRuntimeProvenance {
  const modulePath = __filename;
  const moduleRealPath = realPathIfExists(modulePath);
  const cliEntrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
  const cliEntrypointRealPath = realPathIfExists(cliEntrypointPath);
  const packageSearchStart = cliEntrypointRealPath ?? moduleRealPath ?? cliEntrypointPath ?? modulePath;
  const candidatePackageJsonPath = firstExistingAncestorPackageJson(packageSearchStart);
  const candidatePackageJson = candidatePackageJsonPath ? readJsonFile(candidatePackageJsonPath) : undefined;
  const packageIsOwned = packageOwnsCliArtifact(candidatePackageJson, candidatePackageJsonPath, cliEntrypointRealPath ?? cliEntrypointPath);
  const packageJsonPath = packageIsOwned ? candidatePackageJsonPath : undefined;
  const packageJson = packageIsOwned ? candidatePackageJson : undefined;
  const repoRoot = packageJsonPath ? path.dirname(packageJsonPath) : undefined;
  const sourceOperatorActivityPath = repoRoot ? path.join(repoRoot, "src", "ops", "operator-activity.ts") : undefined;
  const operatorActivityModuleMtimeMs = fileMtimeMs(moduleRealPath ?? modulePath);
  const sourceOperatorActivityMtimeMs = fileMtimeMs(sourceOperatorActivityPath);
  const sourceNewerThanOperatorActivityModule =
    sourceOperatorActivityMtimeMs !== undefined && operatorActivityModuleMtimeMs !== undefined
      ? sourceOperatorActivityMtimeMs > operatorActivityModuleMtimeMs
      : undefined;
  const head = readGitField(cwd, ["rev-parse", "HEAD"]);
  const branch = readGitField(cwd, ["branch", "--show-current"]);
  const blockers = [head.blocker, branch.blocker].filter((item): item is string => Boolean(item));
  const normalizedModulePath = path.normalize(moduleRealPath ?? modulePath);
  const executionKind = normalizedModulePath.includes(`${path.sep}dist${path.sep}`)
    ? "built-dist"
    : normalizedModulePath.includes(`${path.sep}src${path.sep}`)
      ? "source-or-non-dist"
      : "unknown";
  const freshnessReason = sourceNewerThanOperatorActivityModule === undefined
    ? "source/dist freshness comparison unavailable: source or executing module mtime could not be read"
    : undefined;

  return {
    schemaVersion: OPERATOR_ACTIVITY_PROVENANCE_SCHEMA_VERSION,
    source: "operator/activity runtime provenance",
    claimBoundary:
      "Runtime provenance is diagnostic only; it distinguishes the executing entrypoint/build artifact from current source files and does not prove functional freshness by itself.",
    package: {
      status: packageJsonPath && packageJson ? "known" : "unknown",
      name: packageJson?.name,
      version: packageJson?.version,
      packageJsonPath,
      reason: packageIsOwned
        ? undefined
        : candidatePackageJsonPath
          ? candidatePackageJson
            ? "package.json ancestor does not match fooks CLI artifact ownership"
            : "package.json could not be parsed"
          : "package.json ancestor not found from invoked CLI/module artifact",
    },
    git: {
      scope: "invocation-cwd",
      cwd,
      head: head.value,
      headStatus: head.value ? "known" : "unknown",
      branch: branch.value,
      branchStatus: branch.value ? "known" : "unknown",
      source: "local git refs only for invocation cwd; no fetch performed",
      blockers,
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      argv1: cliEntrypointPath,
      argv1Status: cliEntrypointPath ? "known" : "unknown",
      cwd,
    },
    artifacts: {
      operatorActivityModulePath: modulePath,
      operatorActivityModuleRealPath: moduleRealPath,
      operatorActivityModuleMtimeMs,
      cliEntrypointPath,
      cliEntrypointRealPath,
      cliEntrypointStatus: cliEntrypointPath ? "known" : "unknown",
      cliEntrypointMtimeMs: fileMtimeMs(cliEntrypointRealPath ?? cliEntrypointPath),
      sourceOperatorActivityPath,
      sourceOperatorActivityMtimeMs,
      sourceNewerThanOperatorActivityModule,
      freshnessStatus: sourceNewerThanOperatorActivityModule === undefined ? "unknown" : "known",
      freshnessReason,
      executionKind,
      executionKindStatus: executionKind === "unknown" ? "unknown" : "known",
    },
  };
}

export function parseOperatorActivityTmuxPanes(output: string): ParsedTmuxPane[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const [session, panePath, commandRaw, paneIdRaw] = line.split("\t");
      if (!session || !panePath) return undefined;
      const command = commandRaw?.trim();
      const paneId = paneIdRaw?.trim();
      const entry: ParsedTmuxPane = { session, path: panePath };
      if (command) entry.command = command;
      if (paneId) entry.paneId = paneId;
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

function hasOnlyFooksSessionTaskDelta(worktree: OperatorActivityWorktree): boolean {
  return worktree.delta.changedPathCount === 1 && worktree.delta.changedPaths[0] === ".fooks-session-task.txt";
}

function reportToken(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/[^A-Za-z0-9._/#:-]+/gu, "-").slice(0, 80);
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function buildCurrentRunReceipt(input: {
  worktree: OperatorActivityWorktree;
  fooksSessionCount: number;
  openIssues?: number;
  openPullRequests?: number;
  mainEchoEvidence: boolean;
  advisoryPlanningEpicOnly: boolean;
}): OperatorActivityCurrentRunReceipt {
  const evidenceKinds: OperatorActivityCurrentRunReceipt["evidenceKinds"] = [];
  const activeParts: string[] = [];
  const idleParts: string[] = [];

  if (typeof input.openIssues === "number" && input.openIssues > 0 && !input.advisoryPlanningEpicOnly) {
    evidenceKinds.push("issue");
    activeParts.push(plural(input.openIssues, "open issue"));
  }
  if (typeof input.openPullRequests === "number" && input.openPullRequests > 0) {
    evidenceKinds.push("pullRequest");
    activeParts.push(plural(input.openPullRequests, "open PR"));
  }
  if (input.worktree.branch && input.worktree.branch !== "main" && !hasOnlyFooksSessionTaskDelta(input.worktree)) {
    evidenceKinds.push("branch");
    activeParts.push(`branch ${reportToken(input.worktree.branch) ?? "non-main"}`);
  }
  if (input.fooksSessionCount > 0) {
    evidenceKinds.push("session");
    activeParts.push(plural(input.fooksSessionCount, "mapped fooks session"));
  }
  if (input.worktree.clean === false && !hasOnlyFooksSessionTaskDelta(input.worktree)) {
    evidenceKinds.push("delta");
    activeParts.push(`dirty worktree with ${plural(input.worktree.delta.changedPathCount, "changed path")}`);
  }

  if (input.worktree.branch === "main") idleParts.push("clean main");
  else if (input.worktree.branch) idleParts.push(`branch ${reportToken(input.worktree.branch)}`);
  else idleParts.push("unknown branch");
  if (input.worktree.ahead === 0 && input.worktree.behind === 0) idleParts.push("zero divergence");
  if (input.fooksSessionCount === 0) idleParts.push("no mapped fooks sessions");
  if (input.openIssues === 0 && input.openPullRequests === 0) idleParts.push("zero open issues/PRs");
  if (input.advisoryPlanningEpicOnly) idleParts.push("only planning epic #960 is open");
  if (input.worktree.clean === false && hasOnlyFooksSessionTaskDelta(input.worktree)) {
    idleParts.push(".fooks-session-task.txt-only delta is not active work proof");
  }

  const active = evidenceKinds.length > 0 && !input.mainEchoEvidence;
  const oneLine = active
    ? `Current fooks run appears active: ${activeParts.join(", ")}.`
    : `Current fooks run is idle/non-active: ${idleParts.join(", ")}.`;

  return {
    status: active ? "active" : "idle",
    active,
    oneLine,
    evidenceKinds: [...new Set(evidenceKinds)] as OperatorActivityCurrentRunReceipt["evidenceKinds"],
    advisoryOnly: true,
    readOnly: true,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
  };
}

function hasOmxSignal(pane: ParsedTmuxPane, cleanPanePath: string): boolean {
  const haystack = [pane.session, cleanPanePath, pane.command ?? ""].join("\n").replace(/\\/g, "/").toLowerCase();
  return haystack.includes("omx");
}

function hasSubmittedPromptOrWorkEvidence(capturedPane: string): boolean {
  return /\bUserPromptSubmit\b|\bWorking\b|tool[- ]output|tool[- ]call|hookEventName["': ]+UserPromptSubmit/iu.test(capturedPane);
}

function inspectPanePromptEvidence(
  cwd: string,
  runner: OperatorActivityCommandRunner,
  pane: ParsedTmuxPane,
  cleanPanePath: string,
  current: boolean,
  worktree: OperatorActivityWorktree,
): OperatorActivityPanePromptEvidence | undefined {
  const onlyTaskDelta = hasOnlyFooksSessionTaskDelta(worktree);
  const aheadZero = worktree.ahead === 0;
  if (!current || !pane.paneId || !hasOmxSignal(pane, cleanPanePath) || !onlyTaskDelta || !aheadZero) return undefined;

  try {
    const capturedPane = runner("tmux", ["capture-pane", "-pt", pane.paneId, "-S", "-200"], cwd, DEFAULT_OPERATOR_ACTIVITY_TIMEOUT_MS);
    const submittedOrWorkingEvidence = hasSubmittedPromptOrWorkEvidence(capturedPane);
    return {
      inspected: true,
      source: OPERATOR_ACTIVITY_TMUX_CAPTURE_COMMAND,
      classification: submittedOrWorkingEvidence ? "submittedOrWorkingEvidence" : "stagedPromptOnly",
      submittedOrWorkingEvidence,
      reasons: submittedOrWorkingEvidence
        ? ["captured pane includes UserPromptSubmit, Working, or tool-output evidence"]
        : ["captured pane lacks UserPromptSubmit, Working, and tool-output evidence while only .fooks-session-task.txt is dirty and ahead=0"],
    };
  } catch {
    return {
      inspected: false,
      source: OPERATOR_ACTIVITY_TMUX_CAPTURE_COMMAND,
      classification: "unavailable",
      submittedOrWorkingEvidence: false,
      reasons: ["tmux pane capture unavailable; staged prompt-only classification was not applied"],
    };
  }
}

function readTmuxActivity(cwd: string, worktree: OperatorActivityWorktree, options: OperatorActivityOptions): OperatorActivityTmux {
  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  const pathExists = options.pathExists ?? fs.existsSync;
  const blockers: string[] = [];
  let output = "";

  try {
    output = runner("tmux", ["list-panes", "-a", "-F", "#{session_name}\t#{pane_current_path}\t#{pane_current_command}\t#{pane_id}"], cwd, DEFAULT_OPERATOR_ACTIVITY_TIMEOUT_MS);
  } catch (error) {
    if (isTmuxNoServerRunningError(error)) {
      return {
        available: true,
        command: OPERATOR_ACTIVITY_TMUX_COMMAND,
        sessions: [],
        blockers: [],
      };
    }
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
    const paneInsideCurrentCwd = exists && pathContainsCwd(currentCwd, cleanPanePath);
    const ancestorOfCurrentCwd = exists && !paneInsideCurrentCwd && pathContainsCwd(cleanPanePath, currentCwd);
    const current = paneInsideCurrentCwd;
    if (!includesFooksSignal(pane.session, cwd) && !includesFooksSignal(cleanPanePath, cwd) && !current) continue;
    const panes = panesBySession.get(pane.session) ?? [];
    const promptEvidence = inspectPanePromptEvidence(cwd, runner, pane, cleanPanePath, current, worktree);
    panes.push({
      path: pane.path,
      exists,
      deleted,
      current,
      ...(ancestorOfCurrentCwd ? { ancestorOfCurrentCwd: true } : {}),
      ...(pane.command ? { command: pane.command } : {}),
      ...(pane.paneId ? { paneId: pane.paneId } : {}),
      ...(promptEvidence ? { promptEvidence } : {}),
    });
    panesBySession.set(pane.session, panes);
  }

  return {
    available: true,
    command: OPERATOR_ACTIVITY_TMUX_COMMAND,
    sessions: [...panesBySession.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([session, panes]) => {
        const current = panes.some((pane) => pane.current);
        const allPanesMissing = panes.length > 0 && panes.every((pane) => pane.deleted || !pane.exists);
        const ancestorMaintenance = !current && panes.length > 0 && panes.some((pane) => pane.ancestorOfCurrentCwd) && panes.every((pane) => pane.ancestorOfCurrentCwd || pane.deleted || !pane.exists);
        const stagedPromptOnly = current && panes.some((pane) => pane.current) && panes.every((pane) => {
          if (!pane.current) return pane.deleted || !pane.exists;
          return pane.promptEvidence?.classification === "stagedPromptOnly";
        });
        const status: OperatorActivityTmuxSessionStatus = stagedPromptOnly
          ? "stagedPromptOnly"
          : current
            ? "current"
            : allPanesMissing
              ? "staleRuntimeCandidate"
              : ancestorMaintenance
                ? "ancestorMaintenance"
                : "activeOrUnknown";
        const reasons = status === "stagedPromptOnly"
          ? ["current OMX pane has only staged prompt-placeholder evidence; no UserPromptSubmit, Working, or tool-output evidence was captured"]
          : status === "current"
            ? ["session has a pane at the current working directory"]
            : status === "staleRuntimeCandidate"
              ? ["all panes point at missing or deleted paths"]
              : status === "ancestorMaintenance"
                ? ["session pane is at an ancestor of the current checkout; ancestor maintenance panes do not prove active work for this repo"]
                : ["session has live panes away from the current working directory; activity is unknown"];
        const manualCleanupCommands = status === "staleRuntimeCandidate" ? [`tmux kill-session -t ${shellQuote(session)}`] : [];
        const cleanupOrder = status === "staleRuntimeCandidate"
          ? [
              "Verify the PR/worktree is no longer active",
              "Stop the stale tmux/OMX/Codex session manually",
              "Run any git worktree prune/remove follow-up only after the runtime is stopped",
            ]
          : [];
        return {
          session,
          paneCount: panes.length,
          current,
          status,
          reasons,
          panes,
          manualCleanupCommands,
          cleanupOrder,
        };
      }),
    blockers: uniqueSorted(blockers),
  };
}

function buildStagedOmxPromptEvidence(
  worktree: OperatorActivityWorktree,
  tmux: OperatorActivityTmux,
): OperatorActivityStagedOmxPromptEvidence {
  const stagedSessions = tmux.sessions.filter((session) => session.status === "stagedPromptOnly");
  const onlyFooksSessionTaskDelta = hasOnlyFooksSessionTaskDelta(worktree);
  const aheadZero = worktree.ahead === 0;
  const reasons: string[] = [];

  if (onlyFooksSessionTaskDelta) reasons.push("only .fooks-session-task.txt is dirty in the current worktree delta");
  else reasons.push("current worktree delta is not limited to .fooks-session-task.txt");
  if (aheadZero) reasons.push("local ahead count is zero");
  else reasons.push(worktree.ahead === undefined ? "local ahead count is unavailable" : "local ahead count is non-zero");
  if (stagedSessions.length > 0) {
    reasons.push(`${stagedSessions.length} current OMX session(s) were classified as staged prompt-only evidence`);
  } else {
    reasons.push("no current OMX session met the staged prompt-only evidence boundary");
  }

  return {
    issue: OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_ISSUE,
    source: OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_SOURCE,
    claimBoundary: OPERATOR_ACTIVITY_STAGED_OMX_PROMPT_CLAIM_BOUNDARY,
    readOnly: true,
    classification: stagedSessions.length > 0 ? "stagedPromptOnly" : "activeOrUnknown",
    stagedPromptOnlySessionCount: stagedSessions.length,
    preventsActiveWorkEvidence: stagedSessions.length > 0,
    conditions: {
      onlyFooksSessionTaskDelta,
      aheadZero,
      requiresNoSubmittedPromptOrWorkEvidence: true,
      requiresCurrentOmxPane: true,
    },
    sessionNames: stagedSessions.map((session) => session.session),
    reasons,
  };
}

function artifactAuditUnavailable(blockers: string[]): boolean {
  return blockers.some((blocker) => blocker.startsWith("git worktree list unavailable"));
}

function readLegacyWorktreeEvidence(cwd: string, options: OperatorActivityOptions, generatedAt: string): OperatorActivityLegacyWorktreeEvidence {
  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  const pathExists = options.pathExists ?? fs.existsSync;

  try {
    const audit = auditArtifacts(cwd, {
      runner: (command, args, auditCwd) => runner(command, args, auditCwd, DEFAULT_ARTIFACT_AUDIT_TIMEOUT_MS),
      pathExists,
      now: () => generatedAt,
    });
    const entries = audit.staleClosedArtifactWorktrees.slice(0, OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT).map((worktree) => ({
      path: worktree.path,
      branch: worktree.branch,
      head: worktree.head,
      status: worktree.status,
      reasons: worktree.reasons,
      archiveEvidence: worktree.archiveEvidence,
      activeSessionEvidence: worktree.activeSessionEvidence,
    }));

    return {
      available: !artifactAuditUnavailable(audit.blockers),
      source: ARTIFACT_AUDIT_COMMAND,
      claimBoundary: ARTIFACT_AUDIT_CLAIM_BOUNDARY,
      staleClosedArtifactWorktreeCount: audit.staleClosedArtifactWorktrees.length,
      entries,
      entryLimit: OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT,
      omittedEntryCount: Math.max(0, audit.staleClosedArtifactWorktrees.length - entries.length),
      cleanupCommandsIncluded: false,
      blockers: audit.blockers,
    };
  } catch (error) {
    return {
      available: false,
      source: ARTIFACT_AUDIT_COMMAND,
      claimBoundary: ARTIFACT_AUDIT_CLAIM_BOUNDARY,
      staleClosedArtifactWorktreeCount: 0,
      entries: [],
      entryLimit: OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT,
      omittedEntryCount: 0,
      cleanupCommandsIncluded: false,
      blockers: [`artifact audit unavailable: ${errorDetail(error)}`],
    };
  }
}

function parseGhJsonCount(output: string): number | undefined {
  try {
    const parsed = JSON.parse(output) as unknown;
    return Array.isArray(parsed) ? parsed.length : undefined;
  } catch {
    return undefined;
  }
}

function parseGhIssueNumbers(output: string): number[] | undefined {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const numbers: number[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) return undefined;
      const number = (entry as { number?: unknown }).number;
      if (typeof number !== "number" || !Number.isInteger(number)) return undefined;
      numbers.push(number);
    }
    return numbers;
  } catch {
    return undefined;
  }
}

export function hasOnlyPlanningEpicOpenIssue(counts: OperatorActivityRemoteCounts): boolean {
  return Boolean(
    counts.enabled
    && counts.openIssues === 1
    && (counts.openPullRequests ?? 0) === 0
    && counts.openIssueNumbers?.length === 1
    && counts.openIssueNumbers[0] === OPERATOR_ACTIVITY_PLANNING_EPIC_ISSUE_NUMBER,
  );
}

function readRemoteCounts(cwd: string, options: OperatorActivityOptions): OperatorActivityRemoteCounts {
  if (!options.includeRemoteCounts) {
    return { enabled: false, source: "disabled; pass --include-remote-counts to opt in" };
  }

  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  const blockers: string[] = [];
  let openIssues: number | undefined;
  const returnOpenIssueNumbers: number[] = [];
  let openPullRequests: number | undefined;

  try {
    const output = runner("gh", ["issue", "list", "--state", "open", "--json", "number", "--limit", "1000"], cwd, DEFAULT_OPERATOR_ACTIVITY_REMOTE_TIMEOUT_MS);
    openIssues = parseGhJsonCount(output);
    const openIssueNumbers = parseGhIssueNumbers(output);
    if (openIssueNumbers !== undefined && openIssueNumbers.length > 0) {
      returnOpenIssueNumbers.push(...openIssueNumbers);
    }
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
    ...(returnOpenIssueNumbers.length > 0 ? { openIssueNumbers: returnOpenIssueNumbers } : {}),
    openPullRequests,
    blockers: uniqueSorted(blockers),
  };
}

type GhRunListEntry = {
  databaseId?: number;
  status?: string;
  conclusion?: string;
  createdAt?: string;
  updatedAt?: string;
  headBranch?: string;
  headSha?: string;
  event?: string;
  name?: string;
  workflowName?: string;
  url?: string;
};

type GhWorkflowRunEntry = {
  id?: number;
  name?: string;
  display_title?: string;
  status?: string;
  conclusion?: string | null;
  created_at?: string;
  updated_at?: string;
  head_branch?: string;
  head_sha?: string;
  event?: string;
  html_url?: string;
  url?: string;
};

type PostMergeMainCiFallbackResult = {
  runs: GhRunListEntry[];
  repo?: string;
  blocker?: string;
};

function readLocalOriginMainHead(cwd: string, options: OperatorActivityOptions): { head?: string; blockers: string[] } {
  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  try {
    const head = runner("git", ["rev-parse", "--verify", "origin/main"], cwd, DEFAULT_OPERATOR_ACTIVITY_TIMEOUT_MS).trim();
    return head ? { head, blockers: [] } : { blockers: ["origin/main head unavailable: git rev-parse returned empty output"] };
  } catch (error) {
    return { blockers: [`origin/main head unavailable: ${errorDetail(error)}`] };
  }
}

function parseGhRunList(output: string): { runs: GhRunListEntry[]; blocker?: string } {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!Array.isArray(parsed)) return { runs: [], blocker: "GitHub Actions run list unavailable: gh returned non-array JSON" };
    return { runs: parsed.filter((item): item is GhRunListEntry => Boolean(item) && typeof item === "object") as GhRunListEntry[] };
  } catch (error) {
    return { runs: [], blocker: `GitHub Actions run list unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function parseGithubRepoIdentifier(remoteUrl: string): string | undefined {
  const trimmed = remoteUrl.trim().replace(/\.git$/u, "");
  const sshMatch = /^git@github\.com:([^/]+\/[^/]+)$/u.exec(trimmed);
  if (sshMatch) return sshMatch[1];
  const httpsMatch = /^https?:\/\/github\.com\/([^/]+\/[^/]+)$/u.exec(trimmed);
  if (httpsMatch) return httpsMatch[1];
  return undefined;
}

function readGithubRepoIdentifier(cwd: string, options: OperatorActivityOptions): { repo?: string; blocker?: string } {
  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  try {
    const remoteUrl = runner("git", ["config", "--get", "remote.origin.url"], cwd, DEFAULT_OPERATOR_ACTIVITY_TIMEOUT_MS);
    const repo = parseGithubRepoIdentifier(remoteUrl);
    return repo ? { repo } : { blocker: "GitHub Actions workflow-runs fallback unavailable: remote.origin.url is not a GitHub repository URL" };
  } catch (error) {
    return { blocker: `GitHub Actions workflow-runs fallback unavailable: ${errorDetail(error)}` };
  }
}

function parseGhWorkflowRuns(output: string): { runs: GhRunListEntry[]; blocker?: string } {
  try {
    const parsed = JSON.parse(output) as unknown;
    const maybeRuns = parsed && typeof parsed === "object" ? (parsed as { workflow_runs?: unknown }).workflow_runs : undefined;
    if (!Array.isArray(maybeRuns)) return { runs: [], blocker: "GitHub Actions workflow-runs fallback unavailable: gh api returned non-array workflow_runs JSON" };
    const runs = maybeRuns
      .filter((item): item is GhWorkflowRunEntry => Boolean(item) && typeof item === "object")
      .map((run) => ({
        databaseId: run.id,
        status: run.status,
        conclusion: run.conclusion ?? undefined,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        headBranch: run.head_branch,
        headSha: run.head_sha,
        event: run.event,
        name: run.name || run.display_title,
        workflowName: run.name,
        url: run.html_url || run.url,
      }));
    return { runs };
  } catch (error) {
    return { runs: [], blocker: `GitHub Actions workflow-runs fallback unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function postMergeMainCiCommandLabel(): string {
  return `gh ${OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_RUN_LIST_ARGS.join(" ")}`;
}

function classifyPostMergeMainCiDiagnosticReason(detail: string): OperatorActivityPostMergeMainWorkflowDiagnosticReason {
  const normalized = detail.toLowerCase();
  if (/timed? ?out|timeout|etimedout/.test(normalized)) return "timeout";
  if (/rate.?limit|secondary rate limit|too many requests|http 429/.test(normalized)) return "rate-limit";
  if (/auth|credential|unauthori[sz]ed|forbidden|http 401|http 403|bad credentials/.test(normalized)) return "auth";
  if (/non-array json|json|parse|unexpected token/.test(normalized)) return "parse-error";
  return "unavailable";
}

function postMergeMainCiDiagnostic(
  workflow: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS[number],
  mainHead: string | undefined,
  reason: OperatorActivityPostMergeMainWorkflowDiagnosticReason,
  overrides: Partial<Pick<OperatorActivityPostMergeMainWorkflowDiagnostic, "source" | "command" | "apiSurface">> = {},
): OperatorActivityPostMergeMainWorkflowDiagnostic {
  const headFilter = mainHead ? `headSha=${mainHead}` : "headSha unavailable";
  return {
    source: overrides.source ?? OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE,
    command: overrides.command ?? postMergeMainCiCommandLabel(),
    apiSurface: overrides.apiSurface ?? "gh run list",
    lookup: `branch=main, workflowName=${workflow}, ${headFilter}; no git fetch or mutation performed`,
    reason,
    remoteFreshnessCaveat: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_REMOTE_FRESHNESS_CAVEAT,
  };
}

function postMergeMainCiFallbackDiagnostic(
  workflow: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS[number],
  mainHead: string | undefined,
  repo: string,
  reason: OperatorActivityPostMergeMainWorkflowDiagnosticReason,
): OperatorActivityPostMergeMainWorkflowDiagnostic {
  return postMergeMainCiDiagnostic(workflow, mainHead, reason, {
    source: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_API_WORKFLOW_RUNS_SOURCE,
    command: `gh api --method GET repos/${repo}/actions/runs -f branch=main -f head_sha=${mainHead ?? ""} -f per_page=100`,
    apiSurface: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_API_WORKFLOW_RUNS_SURFACE,
  });
}

function readPostMergeMainCiWorkflowRunsFallback(
  cwd: string,
  options: OperatorActivityOptions,
  mainHead: string | undefined,
): PostMergeMainCiFallbackResult {
  if (!mainHead) return { runs: [] };
  const repoResult = readGithubRepoIdentifier(cwd, options);
  if (!repoResult.repo) return { runs: [], blocker: repoResult.blocker };
  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  const args = [
    "api",
    "--method",
    "GET",
    `repos/${repoResult.repo}/actions/runs`,
    "-f",
    "branch=main",
    "-f",
    `head_sha=${mainHead}`,
    "-f",
    "per_page=100",
  ];
  try {
    const output = runner("gh", args, cwd, DEFAULT_OPERATOR_ACTIVITY_REMOTE_TIMEOUT_MS);
    const parsed = parseGhWorkflowRuns(output);
    if (parsed.blocker) {
      return { runs: [], blocker: parsed.blocker, repo: repoResult.repo };
    }
    return { runs: parsed.runs, repo: repoResult.repo };
  } catch (error) {
    const detail = errorDetail(error);
    return { runs: [], blocker: `GitHub Actions workflow-runs fallback unavailable: ${detail}`, repo: repoResult.repo };
  }
}

function workflowNameOf(run: GhRunListEntry): string {
  return run.workflowName || run.name || "";
}

function latestRunForWorkflow(runs: GhRunListEntry[], workflow: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS[number], mainHead: string): GhRunListEntry | undefined {
  return runs
    .filter((run) => run.headSha === mainHead)
    .filter((run) => run.headBranch === "main")
    .filter((run) => workflowNameOf(run) === workflow)
    .sort((left, right) => String(right.updatedAt ?? right.createdAt ?? "").localeCompare(String(left.updatedAt ?? left.createdAt ?? "")))[0];
}

function diagnosticReasonFromRun(run: GhRunListEntry | undefined, fallbackBlocker?: string): OperatorActivityPostMergeMainWorkflowDiagnosticReason {
  if (!run) return fallbackBlocker ? classifyPostMergeMainCiDiagnosticReason(fallbackBlocker) : "empty-run";
  if (run.status !== "completed") return "pending";
  if (run.conclusion === "success") return "success";
  if (run.conclusion) return "failure";
  return "missing-conclusion";
}

type PostMergeMainCiDiagnosticOverrides = {
  primaryDiagnostic?: OperatorActivityPostMergeMainWorkflowDiagnostic;
  fallbackDiagnostic?: OperatorActivityPostMergeMainWorkflowDiagnostic;
};

function workflowEvidenceFromRun(
  workflow: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS[number],
  mainHead: string | undefined,
  run: GhRunListEntry | undefined,
  unavailableReason?: OperatorActivityPostMergeMainWorkflowDiagnosticReason,
  diagnosticOverrides: PostMergeMainCiDiagnosticOverrides = {},
): OperatorActivityPostMergeMainWorkflowEvidence {
  if (!mainHead) {
    const diagnosticReason = unavailableReason ?? "origin-main-head-unavailable";
    return {
      workflow,
      status: "unknown",
      reason:
        diagnosticReason === "remote-workflow-evidence-disabled"
          ? "remote workflow evidence disabled; exact-head workflow evidence was not inspected"
          : "origin/main head is unavailable; exact-head workflow evidence cannot be evaluated",
      diagnostic: postMergeMainCiDiagnostic(workflow, mainHead, diagnosticReason),
      ...diagnosticOverrides,
    };
  }
  if (!run) {
    const diagnosticReason = unavailableReason ?? "empty-run";
    const diagnostic =
      diagnosticOverrides.fallbackDiagnostic && !unavailableReason
        ? diagnosticOverrides.fallbackDiagnostic
        : postMergeMainCiDiagnostic(workflow, mainHead, diagnosticReason);
    return {
      workflow,
      status: "unknown",
      headSha: mainHead,
      reason:
        diagnosticReason === "empty-run"
          ? `no ${workflow} run was found for the exact origin/main head`
          : `GitHub Actions run list unavailable (${diagnosticReason}); ${workflow} exact-head workflow evidence cannot be evaluated`,
      diagnostic,
      ...diagnosticOverrides,
    };
  }

  const runStatus = run.status;
  const conclusion = run.conclusion;
  const successDiagnostic = diagnosticOverrides.fallbackDiagnostic ?? postMergeMainCiDiagnostic(workflow, mainHead, "success");
  const pendingDiagnostic = diagnosticOverrides.fallbackDiagnostic ?? postMergeMainCiDiagnostic(workflow, mainHead, "pending");
  const failureDiagnostic = diagnosticOverrides.fallbackDiagnostic ?? postMergeMainCiDiagnostic(workflow, mainHead, "failure");
  const missingConclusionDiagnostic = diagnosticOverrides.fallbackDiagnostic ?? postMergeMainCiDiagnostic(workflow, mainHead, "missing-conclusion");
  const base = {
    workflow,
    conclusion,
    runStatus,
    runId: run.databaseId,
    url: run.url,
    headSha: run.headSha,
    headBranch: run.headBranch,
    event: run.event,
    updatedAt: run.updatedAt,
    ...diagnosticOverrides,
  };
  if (runStatus !== "completed") {
    return {
      ...base,
      status: "pending",
      reason: `${workflow} run for the exact origin/main head is ${runStatus ?? "not completed"}`,
      diagnostic: pendingDiagnostic,
    };
  }
  if (conclusion === "success") {
    return {
      ...base,
      status: "success",
      reason: `${workflow} run completed successfully for the exact origin/main head`,
      diagnostic: successDiagnostic,
    };
  }
  if (conclusion) {
    return {
      ...base,
      status: "failure",
      reason: `${workflow} run for the exact origin/main head completed with conclusion ${conclusion}`,
      diagnostic: failureDiagnostic,
    };
  }
  return {
    ...base,
    status: "unknown",
    reason: `${workflow} run for the exact origin/main head is completed but has no conclusion`,
    diagnostic: missingConclusionDiagnostic,
  };
}

function summarizePostMergeMainCiEvidence(
  workflowEvidence: OperatorActivityPostMergeMainWorkflowEvidence[],
): OperatorActivityPostMergeMainCiEvidence["summary"] {
  const successCount = workflowEvidence.filter((item) => item.status === "success").length;
  const pendingCount = workflowEvidence.filter((item) => item.status === "pending").length;
  const unknownCount = workflowEvidence.filter((item) => item.status === "unknown").length;
  const failureCount = workflowEvidence.filter((item) => item.status === "failure").length;
  return {
    exactHeadWorkflowCount: workflowEvidence.filter((item) => Boolean(item.runId)).length,
    successCount,
    pendingCount,
    unknownCount,
    failureCount,
    allExactHeadConclusionsSuccessful:
      workflowEvidence.length === OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS.length
      && successCount === OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS.length,
  };
}

function remoteWorkflowEvidenceEnabled(options: OperatorActivityOptions): boolean {
  return options.includeRemoteWorkflowEvidence ?? options.includeRemoteCounts ?? false;
}

function readPostMergeMainCiEvidence(cwd: string, options: OperatorActivityOptions): OperatorActivityPostMergeMainCiEvidence {
  if (!remoteWorkflowEvidenceEnabled(options)) {
    const workflowEvidence = OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS.map((workflow) =>
      workflowEvidenceFromRun(workflow, undefined, undefined, "remote-workflow-evidence-disabled")
    );
    const blockers = ["remote workflow evidence disabled; pass --include-remote-counts to inspect exact-head post-merge main CI evidence"];
    return {
      available: false,
      source: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE,
      claimBoundary: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_CLAIM_BOUNDARY,
      readOnly: true,
      exactHeadRequired: true,
      mainRef: "origin/main",
      mainHeadSource: "local origin/main tracking ref; no fetch performed",
      remoteFreshness: "not verified",
      workflowEvidence,
      summary: summarizePostMergeMainCiEvidence(workflowEvidence),
      blockers,
    };
  }

  const runner = options.commandRunner ?? defaultOperatorActivityCommandRunner;
  const mainHeadResult = readLocalOriginMainHead(cwd, options);
  const blockers = [...mainHeadResult.blockers];
  let runs: GhRunListEntry[] = [];

  let unavailableReason: OperatorActivityPostMergeMainWorkflowDiagnosticReason | undefined;
  let primaryFailureDetail: string | undefined;
  try {
    const output = runner(
      "gh",
      [...OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_GH_RUN_LIST_ARGS],
      cwd,
      DEFAULT_OPERATOR_ACTIVITY_REMOTE_TIMEOUT_MS,
    );
    const parsed = parseGhRunList(output);
    runs = parsed.runs;
    if (parsed.blocker) {
      blockers.push(parsed.blocker);
      primaryFailureDetail = parsed.blocker;
      unavailableReason = classifyPostMergeMainCiDiagnosticReason(parsed.blocker);
    }
  } catch (error) {
    const detail = errorDetail(error);
    const blocker = `GitHub Actions run list unavailable: ${detail}`;
    blockers.push(blocker);
    primaryFailureDetail = detail;
    unavailableReason = classifyPostMergeMainCiDiagnosticReason(detail);
  }

  const fallback = unavailableReason ? readPostMergeMainCiWorkflowRunsFallback(cwd, options, mainHeadResult.head) : undefined;
  if (fallback?.blocker) blockers.push(fallback.blocker);
  if (fallback && !fallback.blocker) {
    runs = fallback.runs;
    blockers.splice(0, blockers.length, ...blockers.filter((blocker) => !blocker.startsWith("GitHub Actions run list unavailable")));
    unavailableReason = undefined;
  }

  const workflowEvidence = OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS.map((workflow) => {
    const run = mainHeadResult.head ? latestRunForWorkflow(runs, workflow, mainHeadResult.head) : undefined;
    const primaryDiagnostic = primaryFailureDetail ? postMergeMainCiDiagnostic(workflow, mainHeadResult.head, classifyPostMergeMainCiDiagnosticReason(primaryFailureDetail)) : undefined;
    const fallbackDiagnostic = fallback?.repo
      ? postMergeMainCiFallbackDiagnostic(
          workflow,
          mainHeadResult.head,
          fallback.repo,
          diagnosticReasonFromRun(run, fallback.blocker),
        )
      : undefined;
    return workflowEvidenceFromRun(
      workflow,
      mainHeadResult.head,
      run,
      unavailableReason,
      {
        ...(primaryDiagnostic ? { primaryDiagnostic } : {}),
        ...(fallbackDiagnostic ? { fallbackDiagnostic } : {}),
      },
    );
  });

  return {
    available: blockers.length === 0,
    source: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE,
    claimBoundary: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_CLAIM_BOUNDARY,
    readOnly: true,
    exactHeadRequired: true,
    mainRef: "origin/main",
    mainHeadSource: "local origin/main tracking ref; no fetch performed",
    remoteFreshness: "not verified",
    mainHead: mainHeadResult.head,
    workflowEvidence,
    summary: summarizePostMergeMainCiEvidence(workflowEvidence),
    blockers: uniqueSorted(blockers),
  };
}

function buildCurrentRunEvidence(
  worktree: OperatorActivityWorktree,
  tmux: OperatorActivityTmux,
  optionalCounts: OperatorActivityRemoteCounts,
  legacyWorktreeEvidence: OperatorActivityLegacyWorktreeEvidence,
): OperatorActivityCurrentRunEvidence {
  const blockers: string[] = [];
  const reasons: string[] = [];
  const fooksSessionCount = tmux.sessions.filter((session) => session.status !== "stagedPromptOnly" && session.status !== "ancestorMaintenance").length;
  const stagedPromptOnlySessionCount = tmux.sessions.filter((session) => session.status === "stagedPromptOnly").length;
  const ancestorMaintenanceSessionCount = tmux.sessions.filter((session) => session.status === "ancestorMaintenance").length;
  const remoteCountsAvailable = optionalCounts.enabled && optionalCounts.openIssues !== undefined && optionalCounts.openPullRequests !== undefined;
  const openIssues = optionalCounts.enabled ? optionalCounts.openIssues : undefined;
  const openPullRequests = optionalCounts.enabled ? optionalCounts.openPullRequests : undefined;
  const clean = worktree.clean === true;
  const onMain = worktree.branch === "main";
  const localDivergenceKnown = worktree.ahead !== undefined && worktree.behind !== undefined;
  const noLocalDivergence = localDivergenceKnown && worktree.ahead === 0 && worktree.behind === 0;
  const noSessions = fooksSessionCount === 0;
  const zeroRemoteCounts = remoteCountsAvailable && openIssues === 0 && openPullRequests === 0;
  const advisoryPlanningEpicOnly = hasOnlyPlanningEpicOpenIssue(optionalCounts);
  const remoteCountsIdle = zeroRemoteCounts || advisoryPlanningEpicOnly;

  if (!optionalCounts.enabled) {
    blockers.push("remote issue/PR counts disabled; pass --include-remote-counts to prove zero open issue/PR reminder evidence");
  } else if (!remoteCountsAvailable) {
    blockers.push("remote issue/PR counts unavailable; cannot prove zero open issue/PR reminder evidence");
  }
  if (!tmux.available) blockers.push("tmux session evidence unavailable; cannot prove zero local fooks sessions");

  if (onMain) reasons.push("current branch is main");
  else reasons.push(worktree.branch ? `current branch is ${worktree.branch}, not main` : "current branch is unknown");
  if (clean) reasons.push("current worktree is clean");
  else reasons.push("current worktree is not clean or cleanliness is unknown");
  if (noLocalDivergence) reasons.push("local tracking divergence is zero");
  else reasons.push(localDivergenceKnown ? "local tracking divergence is non-zero" : "local tracking divergence is unavailable");
  if (noSessions) reasons.push("no fooks-like tmux sessions are mapped to this snapshot");
  else reasons.push(`${fooksSessionCount} fooks-like tmux session(s) are mapped to this snapshot`);
  if (stagedPromptOnlySessionCount > 0) {
    reasons.push(`${stagedPromptOnlySessionCount} staged OMX prompt-only session(s) were not counted as active work evidence`);
  }
  if (ancestorMaintenanceSessionCount > 0) {
    reasons.push(`${ancestorMaintenanceSessionCount} ancestor maintenance tmux session(s) were not counted as active work evidence`);
  }
  if (zeroRemoteCounts) reasons.push("open issue and pull request counts are both zero");
  if (advisoryPlanningEpicOnly) reasons.push("only open issue is planning epic #960; it is advisory and not active work evidence");
  if (legacyWorktreeEvidence.staleClosedArtifactWorktreeCount > 0) {
    reasons.push("legacy closed-artifact worktree evidence is separated from active current-run evidence");
  }

  const mainEchoEvidence = blockers.length === 0 && onMain && clean && noLocalDivergence && noSessions && remoteCountsIdle;
  const activeWorkEvidence =
    (Boolean(worktree.branch) && worktree.branch !== "main" && !hasOnlyFooksSessionTaskDelta(worktree)) ||
    (worktree.clean === false && !hasOnlyFooksSessionTaskDelta(worktree)) ||
    fooksSessionCount > 0 ||
    (optionalCounts.enabled && (((openIssues ?? 0) > 0 && !advisoryPlanningEpicOnly) || (openPullRequests ?? 0) > 0));
  const receipt = buildCurrentRunReceipt({
    worktree,
    fooksSessionCount,
    openIssues,
    openPullRequests,
    mainEchoEvidence,
    advisoryPlanningEpicOnly,
  });

  return {
    available: blockers.length === 0,
    source: OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
    classification: mainEchoEvidence ? "mainEchoNonActive" : "activeOrUnknown",
    mainEchoEvidence,
    activeWorkEvidence,
    remoteCountsRequired: true,
    evidence: {
      branch: worktree.branch,
      upstream: worktree.upstream,
      clean: worktree.clean,
      ahead: worktree.ahead,
      behind: worktree.behind,
      fooksSessionCount,
      openIssues,
      openPullRequests,
      legacyStaleClosedArtifactWorktreeCount: legacyWorktreeEvidence.staleClosedArtifactWorktreeCount,
    },
    receipt,
    reasons,
    blockers: uniqueSorted(blockers),
  };
}

export function readOperatorActivitySnapshot(cwd = process.cwd(), options: OperatorActivityOptions = {}): OperatorActivitySnapshot {
  const timingStartedAt = performance.now();
  const timingPhases: OperatorDiagnosticTimingPhase[] = [];
  const generatedAt = options.now?.() ?? nowIso();
  const worktreeStatus = timeDiagnosticPhase(timingPhases, "current-worktree-evidence-status", () =>
    currentWorktreeEvidenceStatus(cwd, { ...options, now: () => generatedAt })
  );
  const worktree = timeDiagnosticPhase(timingPhases, "build-worktree-snapshot", () => buildWorktreeSnapshot(worktreeStatus));
  const tmux = timeDiagnosticPhase(timingPhases, "read-tmux-activity", () => readTmuxActivity(cwd, worktree, options));
  const optionalCounts = timeDiagnosticPhase(timingPhases, "read-remote-counts", () => readRemoteCounts(cwd, options));
  const legacyWorktreeEvidence = timeDiagnosticPhase(timingPhases, "read-legacy-worktree-evidence", () => readLegacyWorktreeEvidence(cwd, options, generatedAt));
  const stagedOmxPromptEvidence = timeDiagnosticPhase(timingPhases, "build-staged-omx-prompt-evidence", () => buildStagedOmxPromptEvidence(worktree, tmux));
  const currentRunEvidence = timeDiagnosticPhase(timingPhases, "build-current-run-evidence", () => buildCurrentRunEvidence(worktree, tmux, optionalCounts, legacyWorktreeEvidence));
  const postMergeMainCiEvidence = timeDiagnosticPhase(timingPhases, "read-post-merge-main-ci-evidence", () => readPostMergeMainCiEvidence(cwd, options));
  const optionalCountBlockers = optionalCounts.enabled ? optionalCounts.blockers : [];
  const runtimeProvenance = timeDiagnosticPhase(timingPhases, "read-operator-activity-runtime-provenance", () => readOperatorActivityRuntimeProvenance(cwd));

  return {
    schemaVersion: OPERATOR_ACTIVITY_SCHEMA_VERSION,
    command: OPERATOR_ACTIVITY_COMMAND,
    generatedAt,
    cwd,
    claimBoundary: OPERATOR_ACTIVITY_CLAIM_BOUNDARY,
    readOnly: true,
    runtimeProvenance,
    worktree,
    tmux,
    optionalCounts,
    legacyWorktreeEvidence,
    stagedOmxPromptEvidence,
    currentRunEvidence,
    postMergeMainCiEvidence,
    blockers: uniqueSorted([...worktree.blockers, ...tmux.blockers, ...optionalCountBlockers]),
    diagnostics: {
      operatorActivityTiming: buildOperatorActivityTimingReceipt(timingPhases, performance.now() - timingStartedAt),
    },
  };
}
