import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isTmuxNoServerRunningError } from "./tmux-errors";

export const ARTIFACT_AUDIT_SCHEMA_VERSION = 1;
export const ARTIFACT_AUDIT_COMMAND = "status artifacts";
export const ARTIFACT_AUDIT_SCOPE = "fooks";
export const ARTIFACT_AUDIT_CLAIM_BOUNDARY =
  "Local read-only fooks artifact candidates only; does not prove inactivity and never deletes tmux sessions, worktrees, or branches.";
export const DEFAULT_ARTIFACT_AUDIT_TIMEOUT_MS = 3000;

export type ArtifactAuditStatus = "activeOrUnknown" | "likelyMerged" | "missingPath" | "candidateCleanup";
export type ArtifactAuditCommandRunner = (command: string, args: string[], cwd: string) => string;
export type ArtifactAuditPathExists = (targetPath: string) => boolean;

export type ArtifactAuditWorktree = {
  path: string;
  branch?: string;
  head?: string;
  detached: boolean;
  exists: boolean;
  current: boolean;
  status: ArtifactAuditStatus;
  reasons: string[];
  manualCleanupCommands: string[];
};

export type ArtifactAuditBranch = {
  branch: string;
  mergedIntoBase: boolean;
  current: boolean;
  checkedOut: boolean;
  status: ArtifactAuditStatus;
  reasons: string[];
  manualCleanupCommands: string[];
};

export type ArtifactAuditSessionPane = {
  path: string;
  exists: boolean;
  deleted: boolean;
  current: boolean;
  worktreePath?: string;
};

export type ArtifactAuditSession = {
  session: string;
  status: ArtifactAuditStatus;
  reasons: string[];
  panes: ArtifactAuditSessionPane[];
  manualCleanupCommands: string[];
};

export type ArtifactAuditStaleRuntimeCleanup = {
  session: string;
  stalePaths: string[];
  reason: string;
  cleanupOrder: string[];
  manualCleanupCommands: string[];
};

export type ArtifactAuditArchiveEvidence = {
  sourcePath: string;
  matchType: "branch-inspected" | "remote-branch" | "title";
  matchedRef: string;
  lineNumber: number;
};

export type ArtifactAuditStaleClosedArtifactWorktree = {
  path: string;
  branch: string;
  head?: string;
  status: "staleClosedArtifact";
  reasons: string[];
  archiveEvidence: ArtifactAuditArchiveEvidence;
  activeSessionEvidence: "no tmux panes mapped to this worktree";
  manualCleanupCommands: [];
};

export type ArtifactAuditResult = {
  schemaVersion: typeof ARTIFACT_AUDIT_SCHEMA_VERSION;
  command: typeof ARTIFACT_AUDIT_COMMAND;
  scope: typeof ARTIFACT_AUDIT_SCOPE;
  baseRef?: string;
  generatedAt: string;
  claimBoundary: typeof ARTIFACT_AUDIT_CLAIM_BOUNDARY;
  blockers: string[];
  sessions: ArtifactAuditSession[];
  staleRuntimeCleanups: ArtifactAuditStaleRuntimeCleanup[];
  staleClosedArtifactWorktrees: ArtifactAuditStaleClosedArtifactWorktree[];
  worktrees: ArtifactAuditWorktree[];
  branches: ArtifactAuditBranch[];
  manualCleanupCommands: string[];
};

export type ArtifactAuditOptions = {
  runner?: ArtifactAuditCommandRunner;
  pathExists?: ArtifactAuditPathExists;
  archiveDocsDir?: string;
  now?: () => string;
};

type ParsedWorktree = {
  path: string;
  branch?: string;
  head?: string;
  detached: boolean;
};

type ParsedPane = {
  session: string;
  path: string;
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

function normalizeBranch(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  return ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function includesFooksSignal(value: string, cwd: string): boolean {
  const lower = value.replace(/\\/g, "/").toLowerCase();
  const cwdBase = path.basename(cwd).toLowerCase();
  return lower.includes("fooks") || (cwdBase.includes("fooks") && lower.includes(cwdBase));
}

function safeResolve(targetPath: string): string {
  return path.resolve(targetPath.replace(/ \(deleted\)$/u, ""));
}

function samePath(left: string, right: string): boolean {
  return safeResolve(left) === safeResolve(right);
}

function pathContainsCwd(parent: string, cwd: string): boolean {
  return isInsidePath(cwd, parent);
}

function isInsidePath(child: string, parent: string): boolean {
  const relative = path.relative(safeResolve(parent), safeResolve(child));
  return relative === "" || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function panePathDeleted(panePath: string): boolean {
  return panePath.includes("(deleted)");
}

function panePathWithoutDeletedMarker(panePath: string): string {
  return panePath.replace(/ \(deleted\)$/u, "").trim();
}

function stalePanePaths(panes: ArtifactAuditSessionPane[]): string[] {
  return uniqueSorted(
    panes
      .filter((pane) => pane.deleted || !pane.exists)
      .map((pane) => panePathWithoutDeletedMarker(pane.path))
      .filter(Boolean),
  );
}

function normalizeArchivedBranchRef(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("refs/remotes/origin/")) return trimmed.slice("refs/remotes/origin/".length);
  if (trimmed.startsWith("origin/")) return trimmed.slice("origin/".length);
  if (trimmed.startsWith("refs/remotes/")) return "";
  return normalizeBranch(trimmed) ?? trimmed;
}

function archiveEvidenceForRef(ref: string, evidence: ArtifactAuditArchiveEvidence): { branch: string; evidence: ArtifactAuditArchiveEvidence } | undefined {
  const branch = normalizeArchivedBranchRef(ref);
  return branch ? { branch, evidence } : undefined;
}

function archiveDocCandidates(archiveDocsDir: string): string[] {
  try {
    if (!fs.existsSync(archiveDocsDir)) return [];
    return fs.readdirSync(archiveDocsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /branch-archive.*\.md$|branch.*archive.*\.md$/iu.test(name))
      .sort((left, right) => left.localeCompare(right))
      .map((name) => path.join(archiveDocsDir, name));
  } catch {
    return [];
  }
}

function addArchiveEvidence(index: Map<string, ArtifactAuditArchiveEvidence>, ref: string, evidence: ArtifactAuditArchiveEvidence): void {
  const parsed = archiveEvidenceForRef(ref, evidence);
  if (parsed && !index.has(parsed.branch)) {
    index.set(parsed.branch, parsed.evidence);
  }
}

function buildArchiveIndex(archiveDocsDir: string, cwd: string): Map<string, ArtifactAuditArchiveEvidence> {
  const index = new Map<string, ArtifactAuditArchiveEvidence>();
  for (const archiveDoc of archiveDocCandidates(archiveDocsDir)) {
    const archiveRelativeToCwd = path.relative(cwd, archiveDoc);
    const sourcePath = archiveRelativeToCwd && !archiveRelativeToCwd.startsWith("..") && !path.isAbsolute(archiveRelativeToCwd)
      ? archiveRelativeToCwd
      : path.join(path.basename(archiveDocsDir), path.basename(archiveDoc));
    let content = "";
    try {
      content = fs.readFileSync(archiveDoc, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/u);

    for (const [lineIndex, line] of lines.entries()) {
      const inspectedMatch = line.match(/^\s*Branch inspected:\s*`([^`]+)`/iu);
      if (inspectedMatch) {
        addArchiveEvidence(index, inspectedMatch[1], {
          sourcePath,
          matchType: "branch-inspected",
          matchedRef: inspectedMatch[1],
          lineNumber: lineIndex + 1,
        });
      }

      const remoteBranchMatch = line.match(/^\s*(?:[-*]\s*)?Remote branch:\s*`([^`]+)`/iu);
      if (remoteBranchMatch) {
        addArchiveEvidence(index, remoteBranchMatch[1], {
          sourcePath,
          matchType: "remote-branch",
          matchedRef: remoteBranchMatch[1],
          lineNumber: lineIndex + 1,
        });
      }
    }

    const titleIndex = lines.findIndex((line) => /^#\s+/u.test(line));
    const title = titleIndex >= 0 ? lines[titleIndex] : "";
    if (!/archive/iu.test(title)) continue;
    for (const titleRef of [...title.matchAll(/`([^`]+)`/gu)].map((match) => match[1])) {
      addArchiveEvidence(index, titleRef, {
        sourcePath,
        matchType: "title",
        matchedRef: titleRef,
        lineNumber: titleIndex + 1,
      });
    }
  }
  return index;
}

export function defaultArtifactAuditCommandRunner(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: DEFAULT_ARTIFACT_AUDIT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

export function parseGitWorktreePorcelain(output: string): ParsedWorktree[] {
  const worktrees: ParsedWorktree[] = [];
  for (const block of output.split(/\n\n/u).map((item) => item.trim()).filter(Boolean)) {
    const lines = block.split(/\r?\n/u);
    const worktreePath = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    if (!worktreePath) continue;

    const head = lines.find((line) => line.startsWith("HEAD "))?.slice("HEAD ".length);
    const branch = normalizeBranch(lines.find((line) => line.startsWith("branch "))?.slice("branch ".length));
    worktrees.push({ path: worktreePath, branch, head, detached: !branch });
  }
  return worktrees;
}

export function parseGitBranchList(output: string): string[] {
  return uniqueSorted(output.split(/\r?\n/u).map((line) => line.trim().replace(/^\*\s*/u, "")).filter(Boolean).map((line) => normalizeBranch(line) ?? line));
}

export function parseTmuxPaneList(output: string): ParsedPane[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const [session, ...pathParts] = line.split("\t");
      const panePath = pathParts.join("\t");
      return session && panePath ? { session, path: panePath } : undefined;
    })
    .filter((entry): entry is ParsedPane => Boolean(entry));
}

function readOptional(
  runner: ArtifactAuditCommandRunner,
  command: string,
  args: string[],
  cwd: string,
  blockers: string[],
  label: string,
  options: { ignoreTmuxNoServer?: boolean } = {},
): string {
  try {
    return runner(command, args, cwd);
  } catch (error) {
    if (options.ignoreTmuxNoServer && isTmuxNoServerRunningError(error)) return "";
    blockers.push(`${label} unavailable: ${errorDetail(error)}`);
    return "";
  }
}

function resolveBaseRef(runner: ArtifactAuditCommandRunner, cwd: string, blockers: string[]): string | undefined {
  for (const baseRef of ["origin/main", "main"]) {
    try {
      runner("git", ["rev-parse", "--verify", baseRef], cwd);
      return baseRef;
    } catch {
      // Try the next local read-only base candidate.
    }
  }
  blockers.push("git base ref unavailable: neither origin/main nor main could be verified");
  return undefined;
}

function checkedOutBranches(worktrees: ArtifactAuditWorktree[], ignoredStatuses: Set<ArtifactAuditStatus> = new Set()): Set<string> {
  const branches = new Set<string>();
  for (const worktree of worktrees) {
    if (!worktree.branch || ignoredStatuses.has(worktree.status)) continue;
    branches.add(worktree.branch);
  }
  return branches;
}

export function auditArtifacts(cwd = process.cwd(), options: ArtifactAuditOptions = {}): ArtifactAuditResult {
  const runner = options.runner ?? defaultArtifactAuditCommandRunner;
  const pathExists = options.pathExists ?? fs.existsSync;
  const generatedAt = options.now?.() ?? nowIso();
  const blockers: string[] = [];
  const currentCwd = safeResolve(cwd);

  const worktreeOutput = readOptional(runner, "git", ["worktree", "list", "--porcelain"], cwd, blockers, "git worktree list");
  const baseRef = resolveBaseRef(runner, cwd, blockers);
  const branchOutput = readOptional(runner, "git", ["branch", "--format=%(refname:short)"], cwd, blockers, "git branch list");
  const mergedOutput = baseRef ? readOptional(runner, "git", ["branch", "--merged", baseRef], cwd, blockers, `git branch --merged ${baseRef}`) : "";
  const blockersBeforeTmux = blockers.length;
  const tmuxOutput = readOptional(runner, "tmux", ["list-panes", "-a", "-F", "#{session_name}\t#{pane_current_path}"], cwd, blockers, "tmux pane list", { ignoreTmuxNoServer: true });
  const tmuxAvailable = blockers.length === blockersBeforeTmux;

  const parsedWorktrees = parseGitWorktreePorcelain(worktreeOutput);
  const allBranches = parseGitBranchList(branchOutput);
  const mergedBranches = new Set(parseGitBranchList(mergedOutput));
  const currentWorktree = parsedWorktrees.find((worktree) => pathContainsCwd(worktree.path, currentCwd));
  const currentBranch = currentWorktree?.branch;

  const worktrees: ArtifactAuditWorktree[] = parsedWorktrees
    .filter((worktree) => includesFooksSignal(worktree.path, cwd) || includesFooksSignal(worktree.branch ?? "", cwd))
    .map((worktree) => {
      const exists = pathExists(worktree.path);
      const current = pathContainsCwd(worktree.path, currentCwd);
      const reasons: string[] = [];
      const manualCleanupCommands: string[] = [];
      let status: ArtifactAuditStatus = "activeOrUnknown";

      if (!exists) {
        status = "missingPath";
        reasons.push("worktree path is missing from the filesystem");
        manualCleanupCommands.push("git worktree prune --dry-run");
      } else if (worktree.branch && mergedBranches.has(worktree.branch) && !current && worktree.branch !== currentBranch) {
        status = "likelyMerged";
        reasons.push(`branch is merged into ${baseRef ?? "the selected base"}`);
        manualCleanupCommands.push(`git worktree remove ${shellQuote(worktree.path)}`);
      } else {
        if (current) reasons.push("worktree is the current working directory");
        if (!worktree.branch) reasons.push("worktree is detached");
        if (worktree.branch && !mergedBranches.has(worktree.branch)) reasons.push(`branch is not reported merged into ${baseRef ?? "the selected base"}`);
        if (worktree.branch && worktree.branch === currentBranch) reasons.push("branch is the current branch");
      }

      return {
        path: worktree.path,
        branch: worktree.branch,
        head: worktree.head,
        detached: worktree.detached,
        exists,
        current,
        status,
        reasons: uniqueSorted(reasons),
        manualCleanupCommands: uniqueSorted(manualCleanupCommands),
      };
    });

  const nonCandidateCheckedOutBranches = checkedOutBranches(worktrees, new Set(["likelyMerged", "missingPath", "candidateCleanup"]));
  const allCheckedOutBranches = checkedOutBranches(worktrees);

  const branches: ArtifactAuditBranch[] = allBranches
    .filter((branch) => includesFooksSignal(branch, cwd))
    .filter((branch) => branch !== "main" && branch !== "master")
    .map((branch) => {
      const current = branch === currentBranch;
      const checkedOut = allCheckedOutBranches.has(branch);
      const reasons: string[] = [];
      const manualCleanupCommands: string[] = [];
      let status: ArtifactAuditStatus = "activeOrUnknown";
      const mergedIntoBase = mergedBranches.has(branch);

      if (current) reasons.push("branch is the current branch");
      if (!mergedIntoBase) reasons.push(`branch is not reported merged into ${baseRef ?? "the selected base"}`);
      if (nonCandidateCheckedOutBranches.has(branch)) reasons.push("branch is checked out in an active or unknown worktree");

      if (mergedIntoBase && !current && !nonCandidateCheckedOutBranches.has(branch)) {
        status = "likelyMerged";
        reasons.push(`branch is merged into ${baseRef ?? "the selected base"}`);
        if (!checkedOut) {
          manualCleanupCommands.push(`git branch -d ${shellQuote(branch)}`);
        } else {
          reasons.push("branch is checked out in a candidate worktree; remove the worktree before deleting the branch");
        }
      }

      return {
        branch,
        mergedIntoBase,
        current,
        checkedOut,
        status,
        reasons: uniqueSorted(reasons),
        manualCleanupCommands: uniqueSorted(manualCleanupCommands),
      };
    });

  const worktreeByPath = worktrees.filter((worktree) => worktree.exists).sort((left, right) => right.path.length - left.path.length);
  const panesBySession = new Map<string, ArtifactAuditSessionPane[]>();
  const parsedPanes = parseTmuxPaneList(tmuxOutput);
  for (const pane of parsedPanes) {
    const cleanPanePath = panePathWithoutDeletedMarker(pane.path);
    const deleted = panePathDeleted(pane.path);
    const exists = !deleted && pathExists(cleanPanePath);
    const current = exists && (pathContainsCwd(cleanPanePath, currentCwd) || pathContainsCwd(currentCwd, cleanPanePath));
    const mappedWorktree = exists ? worktreeByPath.find((worktree) => isInsidePath(cleanPanePath, worktree.path)) : undefined;
    if (!includesFooksSignal(pane.session, cwd) && !includesFooksSignal(cleanPanePath, cwd) && !mappedWorktree) continue;
    const panes = panesBySession.get(pane.session) ?? [];
    panes.push({
      path: pane.path,
      exists,
      deleted,
      current,
      worktreePath: mappedWorktree?.path,
    });
    panesBySession.set(pane.session, panes);
  }

  const candidateWorktreePaths = new Set(worktrees.filter((worktree) => worktree.status === "likelyMerged").map((worktree) => worktree.path));
  const sessions: ArtifactAuditSession[] = [...panesBySession.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([session, panes]) => {
      const reasons: string[] = [];
      const manualCleanupCommands: string[] = [];
      const allPanesMissing = panes.length > 0 && panes.every((pane) => pane.deleted || !pane.exists);
      const existingPanes = panes.filter((pane) => pane.exists);
      const existingPanesAllCandidateWorktrees = existingPanes.length > 0 && existingPanes.every((pane) => pane.worktreePath && candidateWorktreePaths.has(pane.worktreePath));
      const anyCurrentPane = panes.some((pane) => pane.current);
      let status: ArtifactAuditStatus = "activeOrUnknown";

      if (allPanesMissing) {
        status = "candidateCleanup";
        reasons.push("all panes point at missing or deleted paths");
      } else if (existingPanesAllCandidateWorktrees && !anyCurrentPane) {
        status = "candidateCleanup";
        reasons.push("all existing panes map to audited worktrees whose branches are likely merged");
      } else {
        if (anyCurrentPane) reasons.push("session has a pane at the current working directory");
        if (existingPanes.some((pane) => !pane.worktreePath || !candidateWorktreePaths.has(pane.worktreePath))) {
          reasons.push("session has a live pane outside likely-merged audited worktrees");
        }
      }

      if (status === "candidateCleanup") {
        manualCleanupCommands.push(`tmux kill-session -t ${shellQuote(session)}`);
      }

      return {
        session,
        status,
        reasons: uniqueSorted(reasons),
        panes,
        manualCleanupCommands,
      };
    });

  const staleRuntimeCleanups: ArtifactAuditStaleRuntimeCleanup[] = sessions
    .filter((session) => session.status === "candidateCleanup" && session.panes.every((pane) => pane.deleted || !pane.exists))
    .map((session) => ({
      session: session.session,
      stalePaths: stalePanePaths(session.panes),
      reason: "tmux/OMX/Codex session panes point only at missing or deleted worktree paths",
      cleanupOrder: [
        "Verify the PR/worktree is no longer active",
        "Stop the stale tmux session so child OMX/Codex processes release the deleted path",
        "Run any git worktree prune/remove follow-up only after the runtime is stopped",
      ],
      manualCleanupCommands: session.manualCleanupCommands,
    }));

  const paneWorktreePaths = new Set(
    sessions.flatMap((session) => session.panes.map((pane) => pane.worktreePath).filter((worktreePath): worktreePath is string => Boolean(worktreePath))),
  );
  const archiveDocsDir = options.archiveDocsDir ?? path.join(currentWorktree?.path ?? cwd, "docs");
  const archiveIndex = buildArchiveIndex(archiveDocsDir, currentWorktree?.path ?? cwd);
  const staleClosedArtifactWorktrees: ArtifactAuditStaleClosedArtifactWorktree[] = tmuxAvailable
    ? worktrees
      .filter((worktree) => worktree.branch && !worktree.current && worktree.exists && !paneWorktreePaths.has(worktree.path) && archiveIndex.has(worktree.branch))
      .map((worktree) => ({
        path: worktree.path,
        branch: worktree.branch as string,
        head: worktree.head,
        status: "staleClosedArtifact",
        reasons: uniqueSorted([
          "branch has local branch-archive evidence",
          "worktree is not the current working directory",
          "no tmux panes map to this worktree",
        ]),
        archiveEvidence: archiveIndex.get(worktree.branch as string) as ArtifactAuditArchiveEvidence,
        activeSessionEvidence: "no tmux panes mapped to this worktree",
        manualCleanupCommands: [],
      }))
    : [];

  const manualCleanupCommands = uniqueSorted([
    ...sessions.flatMap((session) => session.manualCleanupCommands),
    ...worktrees.flatMap((worktree) => worktree.manualCleanupCommands),
    ...branches.flatMap((branch) => branch.manualCleanupCommands),
  ]);

  return {
    schemaVersion: ARTIFACT_AUDIT_SCHEMA_VERSION,
    command: ARTIFACT_AUDIT_COMMAND,
    scope: ARTIFACT_AUDIT_SCOPE,
    baseRef,
    generatedAt,
    claimBoundary: ARTIFACT_AUDIT_CLAIM_BOUNDARY,
    blockers: uniqueSorted(blockers),
    sessions,
    staleRuntimeCleanups,
    staleClosedArtifactWorktrees,
    worktrees,
    branches,
    manualCleanupCommands,
  };
}
