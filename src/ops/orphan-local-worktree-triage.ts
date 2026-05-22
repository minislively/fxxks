import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isTmuxNoServerRunningError } from "./tmux-errors";
import { parseAndSummarizeWorktreeStatus } from "../core/worktree-status";

export const ORPHAN_LOCAL_WORKTREE_TRIAGE_SCHEMA_VERSION = 2;
export const ORPHAN_LOCAL_WORKTREE_TRIAGE_COMMAND = "status orphan-worktrees";
export const ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE = "#711";
export const ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE_URL = "https://github.com/minislively/fooks/issues/711";
export const ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE = "#843";
export const ORPHAN_LOCAL_AHEAD_SALVAGE_QUEUE_ISSUE_URL = "https://github.com/minislively/fooks/issues/843";
export const ORPHAN_LOCAL_WORKTREE_ACTIVE_PR_CLEANUP_GUARD_ISSUE = "#1047";
export const ORPHAN_LOCAL_WORKTREE_TRIAGE_CLAIM_BOUNDARY =
  "Read-only issue #711 local sibling worktree salvage/delete decision artifact; does not fetch, delete branches/worktrees, open PRs, auto-delete local-only commits, or change runtime/provider/merge-gate policy.";
export const DEFAULT_ORPHAN_LOCAL_WORKTREE_TRIAGE_TIMEOUT_MS = 3000;

export type OrphanLocalWorktreeCategory = "safe-cleanup" | "salvage-review" | "manual-review-noise" | "keep";
export type OrphanLocalWorktreeCommandRunner = (command: string, args: string[], cwd: string) => string;
export type OrphanLocalWorktreePathExists = (targetPath: string) => boolean;

export const ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE = "gh pr list --state open --json number,url,headRefName --limit 200";
export const ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE =
  "gh pr list --state closed --json number,url,headRefName,state,closedAt --limit 200";

export type OrphanLocalWorktreePullRequestEvidence =
  | { state: "none"; source: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE }
  | { state: "open"; source: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE; pullRequests: { number?: number; url?: string; headRefName?: string }[] }
  | { state: "unknown"; source: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE; reason: string };

export type OrphanLocalWorktreeClosedPullRequestEvidence =
  | { state: "none"; source: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE }
  | {
      state: "closed";
      source: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE;
      pullRequests: { number?: number; url?: string; headRefName?: string; state?: string; closedAt?: string }[];
    }
  | { state: "unknown"; source: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE; reason: string };

export type OrphanLocalWorktreeOperatorDecision =
  | "keep-active-evidence"
  | "salvage-before-delete"
  | "delete-candidate-after-operator-confirmation"
  | "manual-review-blocked";

export type OrphanLocalWorktreeDecisionRow = {
  path: string;
  branch?: string;
  category: OrphanLocalWorktreeCategory;
  decision: OrphanLocalWorktreeOperatorDecision;
  decisionLabel: string;
  evidenceSummary: string;
  salvageCommand: string;
  deleteCommand: string;
  operatorConfirmationRequired: true;
  localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically";
};

export type OrphanLocalWorktreeDiffEvidence = {
  source: string;
  changed: boolean | "unknown";
  summary: string;
};

export type OrphanLocalWorktreeEntry = {
  path: string;
  branch?: string;
  head?: string;
  current: boolean;
  exists: boolean;
  category: OrphanLocalWorktreeCategory;
  reasons: string[];
  dirty: boolean | "unknown";
  changedPathCount?: number;
  aheadOfBase?: number;
  behindBase?: number;
  baseRef?: string;
  diffEvidence: OrphanLocalWorktreeDiffEvidence;
  remoteBranchExists: boolean | "unknown";
  remoteBranchRef?: string;
  openPullRequest: OrphanLocalWorktreePullRequestEvidence;
  closedPullRequest: OrphanLocalWorktreeClosedPullRequestEvidence;
  activeTmuxPaneCount: number;
  manualReviewCommands: string[];
  manualCleanupCommands: string[];
};

export type OrphanLocalWorktreeTriageResult = {
  schemaVersion: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_SCHEMA_VERSION;
  command: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_COMMAND;
  linkedIssue: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE;
  linkedIssueUrl: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE_URL;
  generatedAt: string;
  cwd: string;
  siblingRoot?: string;
  baseRef?: string;
  claimBoundary: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_CLAIM_BOUNDARY;
  readOnly: true;
  categories: Record<OrphanLocalWorktreeCategory, OrphanLocalWorktreeEntry[]>;
  entries: OrphanLocalWorktreeEntry[];
  decisionTable: OrphanLocalWorktreeDecisionRow[];
  operatorWorksheet: {
    issue: typeof ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE;
    readOnly: true;
    requiredConfirmation: string;
    localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically";
  };
  blockers: string[];
};

export type OrphanLocalWorktreeTriageOptions = {
  runner?: OrphanLocalWorktreeCommandRunner;
  pathExists?: OrphanLocalWorktreePathExists;
  now?: () => string;
};

type ParsedWorktree = {
  path: string;
  branch?: string;
  head?: string;
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

function safeResolve(targetPath: string): string {
  return path.resolve(targetPath.replace(/ \(deleted\)$/u, ""));
}

function isInsidePath(child: string, parent: string): boolean {
  const relative = path.relative(safeResolve(parent), safeResolve(child));
  return relative === "" || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function isDetachedReviewWorktreePath(worktreePath: string): boolean {
  return /^fooks-pr-\d+-review$/u.test(path.basename(safeResolve(worktreePath)));
}

function detachedReviewWorktreePullRequestNumber(worktreePath: string): number | undefined {
  const match = path.basename(safeResolve(worktreePath)).match(/^fooks-pr-(\d+)-review$/u);
  if (!match) return undefined;
  const pullRequestNumber = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(pullRequestNumber) ? pullRequestNumber : undefined;
}

function parseCount(output: string): number | undefined {
  const parsed = Number.parseInt(output.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function remoteBranchName(remoteRef: string): string {
  const normalized = remoteRef.startsWith("refs/remotes/") ? remoteRef.slice("refs/remotes/".length) : remoteRef;
  const firstSlash = normalized.indexOf("/");
  return firstSlash >= 0 ? normalized.slice(firstSlash + 1) : normalized;
}

function readOptional(
  runner: OrphanLocalWorktreeCommandRunner,
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

function resolveBaseRef(runner: OrphanLocalWorktreeCommandRunner, cwd: string, blockers: string[]): string | undefined {
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

export function defaultOrphanLocalWorktreeCommandRunner(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: DEFAULT_ORPHAN_LOCAL_WORKTREE_TRIAGE_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

export function parseOrphanLocalWorktreePorcelain(output: string): ParsedWorktree[] {
  const worktrees: ParsedWorktree[] = [];
  for (const block of output.split(/\n\n/u).map((item) => item.trim()).filter(Boolean)) {
    const lines = block.split(/\r?\n/u);
    const worktreePath = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    if (!worktreePath) continue;
    worktrees.push({
      path: worktreePath,
      head: lines.find((line) => line.startsWith("HEAD "))?.slice("HEAD ".length),
      branch: normalizeBranch(lines.find((line) => line.startsWith("branch "))?.slice("branch ".length)),
    });
  }
  return worktrees;
}

export function parseOrphanLocalWorktreeRemoteBranches(output: string): Set<string> {
  return new Set(output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map(remoteBranchName));
}

export function parseOrphanLocalWorktreeTmuxPanes(output: string): ParsedPane[] {
  return output.split(/\r?\n/u).map((line) => line.trimEnd()).filter(Boolean).map((line) => {
    const [session, ...pathParts] = line.split("\t");
    const panePath = pathParts.join("\t");
    return session && panePath ? { session, path: panePath } : undefined;
  }).filter((entry): entry is ParsedPane => Boolean(entry));
}

function readOpenPullRequestIndex(runner: OrphanLocalWorktreeCommandRunner, cwd: string): { pullRequestsByHead: Map<string, { number?: number; url?: string; headRefName?: string }[]>; blocker?: string } {
  try {
    const output = runner("gh", ["pr", "list", "--state", "open", "--json", "number,url,headRefName", "--limit", "200"], cwd);
    const parsed = JSON.parse(output) as { number?: number; url?: string; headRefName?: string }[];
    const pullRequestsByHead = new Map<string, { number?: number; url?: string; headRefName?: string }[]>();
    if (!Array.isArray(parsed)) return { pullRequestsByHead };
    for (const pullRequest of parsed) {
      if (!pullRequest.headRefName) continue;
      const entries = pullRequestsByHead.get(pullRequest.headRefName) ?? [];
      entries.push(pullRequest);
      pullRequestsByHead.set(pullRequest.headRefName, entries);
    }
    return { pullRequestsByHead };
  } catch (error) {
    return { pullRequestsByHead: new Map(), blocker: `gh open PR list unavailable: ${errorDetail(error)}` };
  }
}

function readClosedPullRequestIndex(
  runner: OrphanLocalWorktreeCommandRunner,
  cwd: string,
): {
  pullRequestsByHead: Map<string, { number?: number; url?: string; headRefName?: string; state?: string; closedAt?: string }[]>;
  blocker?: string;
} {
  try {
    const output = runner("gh", ["pr", "list", "--state", "closed", "--json", "number,url,headRefName,state,closedAt", "--limit", "200"], cwd);
    const parsed = JSON.parse(output) as { number?: number; url?: string; headRefName?: string; state?: string; closedAt?: string }[];
    const pullRequestsByHead = new Map<string, { number?: number; url?: string; headRefName?: string; state?: string; closedAt?: string }[]>();
    if (!Array.isArray(parsed)) return { pullRequestsByHead };
    for (const pullRequest of parsed) {
      if (!pullRequest.headRefName) continue;
      const entries = pullRequestsByHead.get(pullRequest.headRefName) ?? [];
      entries.push(pullRequest);
      pullRequestsByHead.set(pullRequest.headRefName, entries);
    }
    return { pullRequestsByHead };
  } catch (error) {
    return { pullRequestsByHead: new Map(), blocker: `gh closed PR list unavailable: ${errorDetail(error)}` };
  }
}

function openPullRequestEvidence(
  branch: string | undefined,
  worktreePath: string,
  pullRequestIndex: ReturnType<typeof readOpenPullRequestIndex>,
): OrphanLocalWorktreePullRequestEvidence {
  if (pullRequestIndex.blocker) return { state: "unknown", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE, reason: pullRequestIndex.blocker };
  const detachedReviewPullRequestNumber = branch ? undefined : detachedReviewWorktreePullRequestNumber(worktreePath);
  if (detachedReviewPullRequestNumber !== undefined) {
    const pullRequests = [...pullRequestIndex.pullRequestsByHead.values()]
      .flat()
      .filter((pullRequest) => pullRequest.number === detachedReviewPullRequestNumber);
    return pullRequests.length > 0
      ? { state: "open", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE, pullRequests }
      : { state: "none", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE };
  }
  if (!branch) return { state: "unknown", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE, reason: "branch unknown" };
  const pullRequests = pullRequestIndex.pullRequestsByHead.get(branch) ?? [];
  return pullRequests.length > 0
    ? { state: "open", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE, pullRequests }
    : { state: "none", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_PR_SOURCE };
}

function closedPullRequestEvidence(
  branch: string | undefined,
  worktreePath: string,
  pullRequestIndex: ReturnType<typeof readClosedPullRequestIndex>,
): OrphanLocalWorktreeClosedPullRequestEvidence {
  if (pullRequestIndex.blocker) return { state: "unknown", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE, reason: pullRequestIndex.blocker };
  const detachedReviewPullRequestNumber = branch ? undefined : detachedReviewWorktreePullRequestNumber(worktreePath);
  if (detachedReviewPullRequestNumber !== undefined) {
    const pullRequests = [...pullRequestIndex.pullRequestsByHead.values()]
      .flat()
      .filter((pullRequest) => pullRequest.number === detachedReviewPullRequestNumber);
    return pullRequests.length > 0
      ? { state: "closed", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE, pullRequests }
      : { state: "none", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE };
  }
  if (!branch) return { state: "unknown", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE, reason: "branch unknown" };
  const pullRequests = pullRequestIndex.pullRequestsByHead.get(branch) ?? [];
  return pullRequests.length > 0
    ? { state: "closed", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE, pullRequests }
    : { state: "none", source: ORPHAN_LOCAL_WORKTREE_TRIAGE_CLOSED_PR_SOURCE };
}

function worktreeStatus(runner: OrphanLocalWorktreeCommandRunner, worktreePath: string): { dirty: boolean | "unknown"; changedPathCount?: number; changedPaths?: string[]; blocker?: string } {
  try {
    const summary = parseAndSummarizeWorktreeStatus(runner("git", ["status", "--porcelain=v1", "-z"], worktreePath), { nulTerminated: true });
    return { dirty: !summary.clean, changedPathCount: summary.changedPaths.length, changedPaths: summary.changedPaths };
  } catch (error) {
    return { dirty: "unknown", blocker: `git status unavailable for ${worktreePath}: ${errorDetail(error)}` };
  }
}

function divergenceFromBase(
  runner: OrphanLocalWorktreeCommandRunner,
  worktreePath: string,
  baseRef: string | undefined,
): { ahead?: number; behind?: number; blocker?: string } {
  if (!baseRef) return {};
  try {
    const output = runner("git", ["rev-list", "--left-right", "--count", `${baseRef}...HEAD`], worktreePath).trim();
    const [behindText, aheadText] = output.split(/\s+/u);
    const behind = Number.parseInt(behindText ?? "", 10);
    const ahead = Number.parseInt(aheadText ?? "", 10);
    if (!Number.isFinite(ahead) || !Number.isFinite(behind)) {
      return { blocker: `git rev-list --left-right --count ${baseRef}...HEAD returned an unparsable count for ${worktreePath}` };
    }
    return { ahead, behind };
  } catch (error) {
    return { blocker: `git rev-list --left-right --count ${baseRef}...HEAD unavailable for ${worktreePath}: ${errorDetail(error)}` };
  }
}

function diffEvidenceAgainstBase(runner: OrphanLocalWorktreeCommandRunner, worktreePath: string, baseRef: string | undefined): OrphanLocalWorktreeDiffEvidence {
  const source = baseRef ? `git diff --shortstat ${baseRef}...HEAD` : "git diff --shortstat <base>...HEAD";
  if (!baseRef) {
    return { source, changed: "unknown", summary: "base ref unavailable" };
  }
  try {
    const summary = runner("git", ["diff", "--shortstat", `${baseRef}...HEAD`], worktreePath).trim();
    return {
      source,
      changed: summary.length > 0,
      summary: summary || "no committed diff against base",
    };
  } catch (error) {
    return { source, changed: "unknown", summary: `git diff unavailable: ${errorDetail(error)}` };
  }
}


function concreteCleanupCommand(entry: OrphanLocalWorktreeEntry): string {
  if (entry.category !== "safe-cleanup") return "not a delete candidate from this artifact";
  const commands = [`git worktree remove ${shellQuote(entry.path)}`];
  if (entry.branch) commands.push(`git branch -d ${shellQuote(entry.branch)}`);
  return commands.join(" && ");
}

function concreteSalvageCommand(entry: OrphanLocalWorktreeEntry): string {
  if (!entry.exists) return `test -e ${shellQuote(entry.path)} || git worktree prune --dry-run`;
  const commands = [`git -C ${shellQuote(entry.path)} status --short --branch`];
  if (entry.aheadOfBase !== undefined && entry.aheadOfBase > 0) {
    commands.push(`git -C ${shellQuote(entry.path)} log --oneline --decorate --max-count=20 ${entry.baseRef ?? "origin/main"}..HEAD`);
  }
  if (entry.dirty === true || entry.dirty === "unknown") {
    commands.push(`git -C ${shellQuote(entry.path)} diff --stat`);
  }
  return commands.join(" && ");
}

function summarizeDecisionEvidence(entry: OrphanLocalWorktreeEntry): string {
  const pullRequestEvidence = entry.openPullRequest.state === "open"
    ? `open-pr:${entry.openPullRequest.pullRequests.map((pullRequest) => pullRequest.number ? `#${pullRequest.number}` : pullRequest.url ?? pullRequest.headRefName ?? "unknown").join(",")}`
    : `open-pr:${entry.openPullRequest.state}`;
  const closedPullRequestEvidence = entry.closedPullRequest.state === "closed"
    ? `closed-pr:${entry.closedPullRequest.pullRequests.map((pullRequest) => pullRequest.number ? `#${pullRequest.number}` : pullRequest.url ?? pullRequest.headRefName ?? "unknown").join(",")}`
    : `closed-pr:${entry.closedPullRequest.state}`;
  return [
    `current:${entry.current ? "yes" : "no"}`,
    `exists:${entry.exists ? "yes" : "no"}`,
    `dirty:${String(entry.dirty)}`,
    `ahead:${entry.aheadOfBase ?? "unknown"}`,
    `behind:${entry.behindBase ?? "unknown"}`,
    `diff:${entry.diffEvidence.changed === true ? entry.diffEvidence.summary : String(entry.diffEvidence.changed)}`,
    `remote:${String(entry.remoteBranchExists)}`,
    pullRequestEvidence,
    closedPullRequestEvidence,
    `tmux-panes:${entry.activeTmuxPaneCount}`,
  ].join("; ");
}

function decisionForEntry(entry: OrphanLocalWorktreeEntry): Pick<OrphanLocalWorktreeDecisionRow, "decision" | "decisionLabel" | "salvageCommand" | "deleteCommand"> {
  if (entry.category === "safe-cleanup") {
    return {
      decision: "delete-candidate-after-operator-confirmation",
      decisionLabel: "DELETE CANDIDATE after confirming no needed local state",
      salvageCommand: concreteSalvageCommand(entry),
      deleteCommand: concreteCleanupCommand(entry),
    };
  }

  if (entry.category === "salvage-review") {
    return {
      decision: "salvage-before-delete",
      decisionLabel: "SALVAGE FIRST; do not delete until local-only evidence is reviewed",
      salvageCommand: concreteSalvageCommand(entry),
      deleteCommand: "defer deletion; preserve or cherry-pick local-only commits before any manual cleanup",
    };
  }

  if (entry.category === "manual-review-noise") {
    const detachedReviewWorktree = !entry.branch && isDetachedReviewWorktreePath(entry.path);
    return {
      decision: "manual-review-blocked",
      decisionLabel: detachedReviewWorktree
        ? "NON-ACTIVE detached PR review worktree noise; manual review only"
        : "NON-ACTIVE closed-PR remote worktree noise; manual review only",
      salvageCommand: concreteSalvageCommand(entry),
      deleteCommand: "none from this artifact",
    };
  }

  if (
    entry.dirty === "unknown" ||
    (entry.remoteBranchExists === "unknown" && entry.openPullRequest.state !== "open") ||
    entry.openPullRequest.state === "unknown" ||
    !entry.exists
  ) {
    return {
      decision: "manual-review-blocked",
      decisionLabel: "MANUAL REVIEW BLOCKED by incomplete local evidence",
      salvageCommand: concreteSalvageCommand(entry),
      deleteCommand: "none from this artifact",
    };
  }

  return {
    decision: "keep-active-evidence",
    decisionLabel: "KEEP because active PR, remote branch, current worktree, tmux pane, or detached evidence exists",
    salvageCommand: concreteSalvageCommand(entry),
    deleteCommand: "none from this artifact",
  };
}

function buildDecisionTable(entries: OrphanLocalWorktreeEntry[]): OrphanLocalWorktreeDecisionRow[] {
  return entries.map((entry) => {
    const decision = decisionForEntry(entry);
    return {
      path: entry.path,
      branch: entry.branch,
      category: entry.category,
      ...decision,
      evidenceSummary: summarizeDecisionEvidence(entry),
      operatorConfirmationRequired: true,
      localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically",
    };
  });
}

function classifyEntry(input: {
  path: string;
  current: boolean;
  exists: boolean;
  branch?: string;
  dirty: boolean | "unknown";
  changedPaths?: string[];
  ahead?: number;
  remoteBranchExists: boolean | "unknown";
  openPullRequest: OrphanLocalWorktreePullRequestEvidence;
  closedPullRequest: OrphanLocalWorktreeClosedPullRequestEvidence;
  activeTmuxPaneCount: number;
  baseRef?: string;
}): Pick<OrphanLocalWorktreeEntry, "category" | "reasons" | "manualCleanupCommands" | "manualReviewCommands"> {
  const reasons: string[] = [];
  const manualCleanupCommands: string[] = [];
  const manualReviewCommands: string[] = [];
  const detachedReviewWorktree = !input.branch && isDetachedReviewWorktreePath(input.path);
  const onlyFooksSessionTaskResidue = input.changedPaths?.length === 1 && input.changedPaths[0] === ".fooks-session-task.txt";

  if (input.current) reasons.push("worktree is the current working directory");
  if (!input.exists) reasons.push("worktree path is missing from the filesystem");
  if (detachedReviewWorktree) reasons.push("detached fooks PR review worktree leftover naming was detected");
  else if (!input.branch) reasons.push("worktree is detached or branch is unknown");
  if (input.activeTmuxPaneCount > 0) reasons.push("one or more tmux panes are mapped inside this worktree");
  if (input.remoteBranchExists === true) reasons.push("a local remote-tracking branch exists for this branch");
  if (input.remoteBranchExists === false) reasons.push("no local remote-tracking branch exists for this branch");
  if (input.openPullRequest.state === "open") {
    reasons.push("an open pull request exists for this branch");
    reasons.push(`active PR cleanup guard: branch/worktree/remote cleanup is unsafe while this PR remains open; wait for an intentional merged/closed PR state with required checks terminal (${ORPHAN_LOCAL_WORKTREE_ACTIVE_PR_CLEANUP_GUARD_ISSUE})`);
  }
  if (input.openPullRequest.state === "none") reasons.push("no open pull request was found for this branch");
  if (input.openPullRequest.state === "unknown") reasons.push("open pull request evidence is unavailable");
  if (input.closedPullRequest.state === "closed") {
    const pullRequests = input.closedPullRequest.pullRequests
      .map((pullRequest) => pullRequest.number ? `#${pullRequest.number}` : pullRequest.url ?? pullRequest.headRefName ?? "unknown")
      .join(", ");
    reasons.push(`closed pull request evidence exists for this branch (${pullRequests})`);
  }
  if (input.closedPullRequest.state === "none") reasons.push("no closed pull request was found for this branch");
  if (input.closedPullRequest.state === "unknown") reasons.push("closed pull request evidence is unavailable");
  if (input.dirty === true) reasons.push("worktree has uncommitted changes");
  if (input.dirty === false) reasons.push("worktree is clean");
  if (input.dirty === "unknown") reasons.push("worktree cleanliness is unknown");
  if (input.ahead !== undefined && input.ahead > 0) reasons.push(`HEAD has ${input.ahead} commit(s) not reachable from ${input.baseRef ?? "the selected base"}`);
  if (input.ahead === 0) reasons.push(`HEAD has no commits ahead of ${input.baseRef ?? "the selected base"}`);
  if (onlyFooksSessionTaskResidue) {
    reasons.push("only .fooks-session-task.txt residue is present; treat as superseded investigation cleanup evidence, not active development");
  }

  const closedPrRemoteResidue =
    input.remoteBranchExists === true &&
    input.openPullRequest.state !== "open" &&
    input.closedPullRequest.state === "closed";
  const detachedReviewResidue =
    detachedReviewWorktree &&
    !input.current &&
    input.exists &&
    input.activeTmuxPaneCount === 0 &&
    input.openPullRequest.state !== "open";
  const protectedByActiveEvidence =
    input.current ||
    input.activeTmuxPaneCount > 0 ||
    (input.remoteBranchExists === true && !closedPrRemoteResidue) ||
    input.openPullRequest.state === "open" ||
    (!input.branch && !detachedReviewResidue);
  if (protectedByActiveEvidence) {
    manualReviewCommands.push("inspect active worktree/PR/remote evidence before cleanup");
    return { category: "keep", reasons: uniqueSorted(reasons), manualCleanupCommands, manualReviewCommands: uniqueSorted(manualReviewCommands) };
  }

  if (detachedReviewResidue) {
    manualReviewCommands.push("inspect detached review worktree commits before any manual cleanup decision");
    manualReviewCommands.push("do not count this detached PR review leftover as active work without a fresh open issue, PR, or mapped session");
    manualReviewCommands.push("do not auto-delete, push, or mutate local-only detached review commits from this artifact");
    return { category: "manual-review-noise", reasons: uniqueSorted(reasons), manualCleanupCommands, manualReviewCommands: uniqueSorted(manualReviewCommands) };
  }

  if (closedPrRemoteResidue) {
    manualReviewCommands.push("inspect closed PR and remote branch evidence before adopting or deleting this worktree");
    manualReviewCommands.push("do not count this closed-PR remote worktree as active adoption evidence without a fresh open issue, PR, or mapped session");
    return { category: "manual-review-noise", reasons: uniqueSorted(reasons), manualCleanupCommands, manualReviewCommands: uniqueSorted(manualReviewCommands) };
  }

  if (input.remoteBranchExists === false && input.ahead !== undefined && input.ahead > 0) {
    manualReviewCommands.push(`git -C <worktree> log --oneline --decorate --max-count=20 ${input.baseRef ?? "origin/main"}..HEAD`);
    manualReviewCommands.push("review or cherry-pick local-only commits before deleting any branch/worktree");
    return { category: "salvage-review", reasons: uniqueSorted(reasons), manualCleanupCommands, manualReviewCommands: uniqueSorted(manualReviewCommands) };
  }

  if (
    input.remoteBranchExists === false &&
    input.openPullRequest.state === "none" &&
    (input.dirty === false || onlyFooksSessionTaskResidue) &&
    input.ahead === 0 &&
    input.activeTmuxPaneCount === 0
  ) {
    manualCleanupCommands.push("git worktree remove <path>");
    if (input.branch) manualCleanupCommands.push(`git branch -d ${shellQuote(input.branch)}`);
    return { category: "safe-cleanup", reasons: uniqueSorted(reasons), manualCleanupCommands: uniqueSorted(manualCleanupCommands), manualReviewCommands };
  }

  if (input.remoteBranchExists === false && (input.dirty === true || input.dirty === "unknown" || input.ahead === undefined || input.openPullRequest.state === "unknown")) {
    manualReviewCommands.push("inspect dirty/unknown local-only evidence before deleting any branch/worktree");
    return { category: "salvage-review", reasons: uniqueSorted(reasons), manualCleanupCommands, manualReviewCommands: uniqueSorted(manualReviewCommands) };
  }

  manualReviewCommands.push("inspect unresolved orphan evidence before cleanup");
  return { category: "keep", reasons: uniqueSorted(reasons), manualCleanupCommands, manualReviewCommands: uniqueSorted(manualReviewCommands) };
}

export function triageOrphanLocalWorktrees(cwd = process.cwd(), options: OrphanLocalWorktreeTriageOptions = {}): OrphanLocalWorktreeTriageResult {
  const runner = options.runner ?? defaultOrphanLocalWorktreeCommandRunner;
  const pathExists = options.pathExists ?? fs.existsSync;
  const generatedAt = options.now?.() ?? nowIso();
  const blockers: string[] = [];
  const worktreeOutput = readOptional(runner, "git", ["worktree", "list", "--porcelain"], cwd, blockers, "git worktree list");
  const baseRef = resolveBaseRef(runner, cwd, blockers);
  const remoteBranches = parseOrphanLocalWorktreeRemoteBranches(readOptional(runner, "git", ["branch", "-r", "--format=%(refname:short)"], cwd, blockers, "git remote branch list"));
  const tmuxOutput = readOptional(runner, "tmux", ["list-panes", "-a", "-F", "#{session_name}\t#{pane_current_path}"], cwd, blockers, "tmux pane list", { ignoreTmuxNoServer: true });
  const pullRequestIndex = readOpenPullRequestIndex(runner, cwd);
  if (pullRequestIndex.blocker) blockers.push(pullRequestIndex.blocker);
  const closedPullRequestIndex = readClosedPullRequestIndex(runner, cwd);

  const parsedWorktrees = parseOrphanLocalWorktreePorcelain(worktreeOutput);
  const currentWorktree = parsedWorktrees.find((worktree) => isInsidePath(cwd, worktree.path));
  const siblingRoot = currentWorktree ? path.dirname(safeResolve(currentWorktree.path)) : undefined;
  const panes = parseOrphanLocalWorktreeTmuxPanes(tmuxOutput);
  const candidateWorktrees = parsedWorktrees.filter((worktree) => {
    if (!siblingRoot) return true;
    return path.dirname(safeResolve(worktree.path)) === siblingRoot;
  });

  const entries = candidateWorktrees.map((worktree) => {
    const exists = pathExists(worktree.path);
    const current = isInsidePath(cwd, worktree.path);
    const status = exists ? worktreeStatus(runner, worktree.path) : { dirty: "unknown" as const, blocker: `worktree path is missing: ${worktree.path}` };
    if (status.blocker) blockers.push(status.blocker);
    const divergence = exists ? divergenceFromBase(runner, worktree.path, baseRef) : {};
    if (divergence.blocker) blockers.push(divergence.blocker);
    const diffEvidence = exists ? diffEvidenceAgainstBase(runner, worktree.path, baseRef) : { source: "git diff --shortstat <base>...HEAD", changed: "unknown" as const, summary: "worktree path is missing" };
    const branch = worktree.branch;
    const remoteBranchExists = branch ? remoteBranches.has(branch) : "unknown";
    const openPullRequest = openPullRequestEvidence(branch, worktree.path, pullRequestIndex);
    const closedPullRequest = closedPullRequestEvidence(branch, worktree.path, closedPullRequestIndex);
    const activeTmuxPaneCount = panes.filter((pane) => exists && isInsidePath(pane.path, worktree.path)).length;
    const classified = classifyEntry({
      path: worktree.path,
      current,
      exists,
      branch,
      dirty: status.dirty,
      changedPaths: status.changedPaths,
      ahead: divergence.ahead,
      remoteBranchExists,
      openPullRequest,
      closedPullRequest,
      activeTmuxPaneCount,
      baseRef,
    });

    return {
      path: worktree.path,
      branch,
      head: worktree.head,
      current,
      exists,
      dirty: status.dirty,
      changedPathCount: status.changedPathCount,
      aheadOfBase: divergence.ahead,
      behindBase: divergence.behind,
      baseRef,
      diffEvidence,
      remoteBranchExists,
      remoteBranchRef: branch && remoteBranchExists === true ? [...remoteBranches].find((remoteBranch) => remoteBranch === branch) : undefined,
      openPullRequest,
      closedPullRequest,
      activeTmuxPaneCount,
      ...classified,
    } satisfies OrphanLocalWorktreeEntry;
  }).sort((left, right) => left.path.localeCompare(right.path));

  return {
    schemaVersion: ORPHAN_LOCAL_WORKTREE_TRIAGE_SCHEMA_VERSION,
    command: ORPHAN_LOCAL_WORKTREE_TRIAGE_COMMAND,
    linkedIssue: ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE,
    linkedIssueUrl: ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE_URL,
    generatedAt,
    cwd,
    siblingRoot,
    baseRef,
    claimBoundary: ORPHAN_LOCAL_WORKTREE_TRIAGE_CLAIM_BOUNDARY,
    readOnly: true,
    categories: {
      "safe-cleanup": entries.filter((entry) => entry.category === "safe-cleanup"),
      "salvage-review": entries.filter((entry) => entry.category === "salvage-review"),
      "manual-review-noise": entries.filter((entry) => entry.category === "manual-review-noise"),
      keep: entries.filter((entry) => entry.category === "keep"),
    },
    entries,
    decisionTable: buildDecisionTable(entries),
    operatorWorksheet: {
      issue: ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE,
      readOnly: true,
      requiredConfirmation: "Record owner, reviewed evidence, and explicit manual keep/salvage/delete outcome before running any cleanup command.",
      localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically",
    },
    blockers: uniqueSorted(blockers),
  };
}
