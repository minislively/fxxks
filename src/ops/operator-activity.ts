import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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
export const OPERATOR_ACTIVITY_COMMAND = "status activity";
export const OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG = "--include-remote-counts";
export const OPERATOR_ACTIVITY_CLAIM_BOUNDARY =
  "Local read-only fooks operator activity snapshot; no provider messaging, no backlog invention, no git fetch, and remote issue/PR counts only when explicitly enabled.";
export const OPERATOR_ACTIVITY_TMUX_COMMAND = "tmux list-panes -a -F #{session_name}\\t#{pane_current_path}\\t#{pane_current_command}";
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
export const OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS = ["CI", "React Web Release Report"] as const;
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

export type OperatorActivityTmuxPane = {
  path: string;
  exists: boolean;
  deleted: boolean;
  current: boolean;
  command?: string;
};

export type OperatorActivityTmuxSessionStatus = "current" | "activeOrUnknown" | "staleRuntimeCandidate";

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
      openPullRequests?: number;
      blockers: string[];
    };

export type OperatorActivityCurrentRunClassification = "mainEchoNonActive" | "activeOrUnknown";

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
  source: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE;
  command: string;
  apiSurface: "gh run list";
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
  legacyWorktreeEvidence: OperatorActivityLegacyWorktreeEvidence;
  currentRunEvidence: OperatorActivityCurrentRunEvidence;
  postMergeMainCiEvidence: OperatorActivityPostMergeMainCiEvidence;
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
    const current = exists && (pathContainsCwd(cleanPanePath, currentCwd) || pathContainsCwd(currentCwd, cleanPanePath));
    if (!includesFooksSignal(pane.session, cwd) && !includesFooksSignal(cleanPanePath, cwd) && !current) continue;
    const panes = panesBySession.get(pane.session) ?? [];
    panes.push({ path: pane.path, exists, deleted, current, command: pane.command });
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
        const status: OperatorActivityTmuxSessionStatus = current ? "current" : allPanesMissing ? "staleRuntimeCandidate" : "activeOrUnknown";
        const reasons = status === "current"
          ? ["session has a pane at the current working directory"]
          : status === "staleRuntimeCandidate"
            ? ["all panes point at missing or deleted paths"]
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
): OperatorActivityPostMergeMainWorkflowDiagnostic {
  const headFilter = mainHead ? `headSha=${mainHead}` : "headSha unavailable";
  return {
    source: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE,
    command: postMergeMainCiCommandLabel(),
    apiSurface: "gh run list",
    lookup: `branch=main, workflowName=${workflow}, ${headFilter}; no git fetch or mutation performed`,
    reason,
    remoteFreshnessCaveat: OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_REMOTE_FRESHNESS_CAVEAT,
  };
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

function workflowEvidenceFromRun(
  workflow: typeof OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS[number],
  mainHead: string | undefined,
  run: GhRunListEntry | undefined,
  unavailableReason?: OperatorActivityPostMergeMainWorkflowDiagnosticReason,
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
    };
  }
  if (!run) {
    const diagnosticReason = unavailableReason ?? "empty-run";
    return {
      workflow,
      status: "unknown",
      headSha: mainHead,
      reason:
        diagnosticReason === "empty-run"
          ? `no ${workflow} run was found for the exact origin/main head`
          : `GitHub Actions run list unavailable (${diagnosticReason}); ${workflow} exact-head workflow evidence cannot be evaluated`,
      diagnostic: postMergeMainCiDiagnostic(workflow, mainHead, diagnosticReason),
    };
  }

  const runStatus = run.status;
  const conclusion = run.conclusion;
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
  };
  if (runStatus !== "completed") {
    return {
      ...base,
      status: "pending",
      reason: `${workflow} run for the exact origin/main head is ${runStatus ?? "not completed"}`,
      diagnostic: postMergeMainCiDiagnostic(workflow, mainHead, "pending"),
    };
  }
  if (conclusion === "success") {
    return {
      ...base,
      status: "success",
      reason: `${workflow} run completed successfully for the exact origin/main head`,
      diagnostic: postMergeMainCiDiagnostic(workflow, mainHead, "success"),
    };
  }
  if (conclusion) {
    return {
      ...base,
      status: "failure",
      reason: `${workflow} run for the exact origin/main head completed with conclusion ${conclusion}`,
      diagnostic: postMergeMainCiDiagnostic(workflow, mainHead, "failure"),
    };
  }
  return {
    ...base,
    status: "unknown",
    reason: `${workflow} run for the exact origin/main head is completed but has no conclusion`,
    diagnostic: postMergeMainCiDiagnostic(workflow, mainHead, "missing-conclusion"),
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
      unavailableReason = classifyPostMergeMainCiDiagnosticReason(parsed.blocker);
    }
  } catch (error) {
    const detail = errorDetail(error);
    blockers.push(`GitHub Actions run list unavailable: ${detail}`);
    unavailableReason = classifyPostMergeMainCiDiagnosticReason(detail);
  }

  const workflowEvidence = OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_WORKFLOWS.map((workflow) =>
    workflowEvidenceFromRun(
      workflow,
      mainHeadResult.head,
      mainHeadResult.head ? latestRunForWorkflow(runs, workflow, mainHeadResult.head) : undefined,
      unavailableReason,
    )
  );

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
  const fooksSessionCount = tmux.sessions.length;
  const remoteCountsAvailable = optionalCounts.enabled && optionalCounts.openIssues !== undefined && optionalCounts.openPullRequests !== undefined;
  const openIssues = optionalCounts.enabled ? optionalCounts.openIssues : undefined;
  const openPullRequests = optionalCounts.enabled ? optionalCounts.openPullRequests : undefined;
  const clean = worktree.clean === true;
  const onMain = worktree.branch === "main";
  const localDivergenceKnown = worktree.ahead !== undefined && worktree.behind !== undefined;
  const noLocalDivergence = localDivergenceKnown && worktree.ahead === 0 && worktree.behind === 0;
  const noSessions = fooksSessionCount === 0;
  const zeroRemoteCounts = remoteCountsAvailable && openIssues === 0 && openPullRequests === 0;

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
  if (zeroRemoteCounts) reasons.push("open issue and pull request counts are both zero");
  if (legacyWorktreeEvidence.staleClosedArtifactWorktreeCount > 0) {
    reasons.push("legacy closed-artifact worktree evidence is separated from active current-run evidence");
  }

  const mainEchoEvidence = blockers.length === 0 && onMain && clean && noLocalDivergence && noSessions && zeroRemoteCounts;
  const activeWorkEvidence =
    worktree.clean === false ||
    fooksSessionCount > 0 ||
    (optionalCounts.enabled && ((openIssues ?? 0) > 0 || (openPullRequests ?? 0) > 0));

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
    reasons,
    blockers: uniqueSorted(blockers),
  };
}

export function readOperatorActivitySnapshot(cwd = process.cwd(), options: OperatorActivityOptions = {}): OperatorActivitySnapshot {
  const generatedAt = options.now?.() ?? nowIso();
  const worktreeStatus = currentWorktreeEvidenceStatus(cwd, { ...options, now: () => generatedAt });
  const worktree = buildWorktreeSnapshot(worktreeStatus);
  const tmux = readTmuxActivity(cwd, options);
  const optionalCounts = readRemoteCounts(cwd, options);
  const legacyWorktreeEvidence = readLegacyWorktreeEvidence(cwd, options, generatedAt);
  const currentRunEvidence = buildCurrentRunEvidence(worktree, tmux, optionalCounts, legacyWorktreeEvidence);
  const postMergeMainCiEvidence = readPostMergeMainCiEvidence(cwd, options);
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
    legacyWorktreeEvidence,
    currentRunEvidence,
    postMergeMainCiEvidence,
    blockers: uniqueSorted([...worktree.blockers, ...tmux.blockers, ...optionalCountBlockers]),
  };
}
