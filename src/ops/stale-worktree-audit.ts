import { execFileSync } from "node:child_process";
import type { OrphanLocalWorktreeEntry, OrphanLocalWorktreeTriageResult } from "./orphan-local-worktree-triage";
import { triageOrphanLocalWorktrees } from "./orphan-local-worktree-triage";

export const STALE_WORKTREE_AUDIT_SCHEMA_VERSION = 1;
export const STALE_WORKTREE_AUDIT_COMMAND = "worktree:audit";
export const STALE_WORKTREE_STATUS_COMMAND = "status stale-worktrees";
export const STALE_WORKTREE_AUDIT_ISSUE = "#854";
export const STALE_WORKTREE_AUDIT_ISSUE_URL = "https://github.com/minislively/fooks/issues/854";
export const STALE_WORKTREE_AUDIT_CLAIM_BOUNDARY =
  "Read-only stale worktree audit; does not fetch, prune, remove worktrees, delete branches, push, kill tmux sessions, write report files, or mutate runtime state. Cleanup commands in nested triage data are manual worksheet suggestions only.";
export const STALE_WORKTREE_OPEN_ISSUE_SOURCE = "gh issue list --state open --json number,url,title --limit 200";
export const STALE_WORKTREE_AUDIT_TIMEOUT_MS = 3000;

export type StaleWorktreeAuditCommand = typeof STALE_WORKTREE_AUDIT_COMMAND | typeof STALE_WORKTREE_STATUS_COMMAND;
export type StaleWorktreeAuditRunner = (command: string, args: string[], cwd: string) => string;

export type StaleWorktreeOpenIssueEvidence =
  | { state: "none"; source: typeof STALE_WORKTREE_OPEN_ISSUE_SOURCE; checkedIssueNumbers: number[] }
  | { state: "open"; source: typeof STALE_WORKTREE_OPEN_ISSUE_SOURCE; checkedIssueNumbers: number[]; issues: { number: number; url?: string; title?: string }[] }
  | { state: "unknown"; source: typeof STALE_WORKTREE_OPEN_ISSUE_SOURCE; checkedIssueNumbers: number[]; reason: string };

export type StaleWorktreeCandidate = {
  path: string;
  branch?: string;
  orphanCategory: OrphanLocalWorktreeEntry["category"];
  dirty: OrphanLocalWorktreeEntry["dirty"];
  aheadOfBase?: number;
  behindBase?: number;
  remoteBranchExists: OrphanLocalWorktreeEntry["remoteBranchExists"];
  openPullRequest: OrphanLocalWorktreeEntry["openPullRequest"];
  openIssue: StaleWorktreeOpenIssueEvidence;
  diffEvidence: OrphanLocalWorktreeEntry["diffEvidence"];
  decision: "stale-review-candidate";
  decisionReason: string;
};

export type StaleWorktreeAuditResult = {
  schemaVersion: typeof STALE_WORKTREE_AUDIT_SCHEMA_VERSION;
  command: StaleWorktreeAuditCommand;
  linkedIssue: typeof STALE_WORKTREE_AUDIT_ISSUE;
  linkedIssueUrl: typeof STALE_WORKTREE_AUDIT_ISSUE_URL;
  readOnly: true;
  claimBoundary: typeof STALE_WORKTREE_AUDIT_CLAIM_BOUNDARY;
  openIssueSource: typeof STALE_WORKTREE_OPEN_ISSUE_SOURCE;
  staleReviewCandidateRule: "open PR=0 + open issue=0 + local diff check completed";
  staleReviewCandidates: StaleWorktreeCandidate[];
  entries: Array<OrphanLocalWorktreeEntry & { openIssue: StaleWorktreeOpenIssueEvidence; staleReviewCandidate: boolean }>;
  triage: OrphanLocalWorktreeTriageResult;
  blockers: string[];
};

export type StaleWorktreeAuditOptions = {
  command?: StaleWorktreeAuditCommand;
  runner?: StaleWorktreeAuditRunner;
  triage?: OrphanLocalWorktreeTriageResult | ((cwd: string) => OrphanLocalWorktreeTriageResult);
};

function defaultRunner(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: STALE_WORKTREE_AUDIT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
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

function uniqueSortedNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function referencedIssueNumbers(entry: Pick<OrphanLocalWorktreeEntry, "path" | "branch">): number[] {
  const haystack = [entry.branch, entry.path].filter(Boolean).join(" ");
  const issueNumbers: number[] = [];
  for (const match of haystack.matchAll(/(?:^|[^a-z0-9])(?:issue[-_/]?|#)(\d{1,6})(?=$|[^a-z0-9])/giu)) {
    const issueNumber = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(issueNumber)) issueNumbers.push(issueNumber);
  }
  return uniqueSortedNumbers(issueNumbers);
}

function readOpenIssueIndex(runner: StaleWorktreeAuditRunner, cwd: string): { openIssuesByNumber: Map<number, { number: number; url?: string; title?: string }>; blocker?: string } {
  try {
    const output = runner("gh", ["issue", "list", "--state", "open", "--json", "number,url,title", "--limit", "200"], cwd);
    const parsed = JSON.parse(output) as { number?: number; url?: string; title?: string }[];
    const openIssuesByNumber = new Map<number, { number: number; url?: string; title?: string }>();
    if (!Array.isArray(parsed)) return { openIssuesByNumber };
    for (const issue of parsed) {
      if (typeof issue.number !== "number") continue;
      openIssuesByNumber.set(issue.number, { number: issue.number, url: issue.url, title: issue.title });
    }
    return { openIssuesByNumber };
  } catch (error) {
    return { openIssuesByNumber: new Map(), blocker: `gh open issue list unavailable: ${errorDetail(error)}` };
  }
}

function openIssueEvidence(entry: OrphanLocalWorktreeEntry, issueIndex: ReturnType<typeof readOpenIssueIndex>): StaleWorktreeOpenIssueEvidence {
  const checkedIssueNumbers = referencedIssueNumbers(entry);
  if (issueIndex.blocker) {
    return { state: "unknown", source: STALE_WORKTREE_OPEN_ISSUE_SOURCE, checkedIssueNumbers, reason: issueIndex.blocker };
  }
  const issues = checkedIssueNumbers.map((issueNumber) => issueIndex.openIssuesByNumber.get(issueNumber)).filter((issue): issue is { number: number; url?: string; title?: string } => Boolean(issue));
  return issues.length > 0
    ? { state: "open", source: STALE_WORKTREE_OPEN_ISSUE_SOURCE, checkedIssueNumbers, issues }
    : { state: "none", source: STALE_WORKTREE_OPEN_ISSUE_SOURCE, checkedIssueNumbers };
}

function isStaleReviewCandidate(entry: OrphanLocalWorktreeEntry, openIssue: StaleWorktreeOpenIssueEvidence): boolean {
  return !entry.current &&
    entry.activeTmuxPaneCount === 0 &&
    entry.openPullRequest.state === "none" &&
    openIssue.state === "none" &&
    entry.diffEvidence.changed !== "unknown" &&
    entry.dirty !== "unknown";
}

export function buildStaleWorktreeAudit(cwd = process.cwd(), options: StaleWorktreeAuditOptions = {}): StaleWorktreeAuditResult {
  const runner = options.runner ?? defaultRunner;
  const triage = typeof options.triage === "function"
    ? options.triage(cwd)
    : options.triage ?? triageOrphanLocalWorktrees(cwd);
  const issueIndex = readOpenIssueIndex(runner, cwd);
  const blockers = [...triage.blockers];
  if (issueIndex.blocker) blockers.push(issueIndex.blocker);

  const entries = triage.entries.map((entry) => {
    const openIssue = openIssueEvidence(entry, issueIndex);
    return {
      ...entry,
      openIssue,
      staleReviewCandidate: isStaleReviewCandidate(entry, openIssue),
    };
  });

  const staleReviewCandidates = entries.filter((entry) => entry.staleReviewCandidate).map((entry) => ({
    path: entry.path,
    branch: entry.branch,
    orphanCategory: entry.category,
    dirty: entry.dirty,
    aheadOfBase: entry.aheadOfBase,
    behindBase: entry.behindBase,
    remoteBranchExists: entry.remoteBranchExists,
    openPullRequest: entry.openPullRequest,
    openIssue: entry.openIssue,
    diffEvidence: entry.diffEvidence,
    decision: "stale-review-candidate" as const,
    decisionReason: "open PR=0, open issue=0, and local diff evidence was checked before stale review classification",
  }));

  return {
    schemaVersion: STALE_WORKTREE_AUDIT_SCHEMA_VERSION,
    command: options.command ?? STALE_WORKTREE_AUDIT_COMMAND,
    linkedIssue: STALE_WORKTREE_AUDIT_ISSUE,
    linkedIssueUrl: STALE_WORKTREE_AUDIT_ISSUE_URL,
    readOnly: true,
    claimBoundary: STALE_WORKTREE_AUDIT_CLAIM_BOUNDARY,
    openIssueSource: STALE_WORKTREE_OPEN_ISSUE_SOURCE,
    staleReviewCandidateRule: "open PR=0 + open issue=0 + local diff check completed",
    staleReviewCandidates,
    entries,
    triage,
    blockers: uniqueSortedStrings(blockers),
  };
}
