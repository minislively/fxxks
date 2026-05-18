import { execFileSync } from "node:child_process";
import path from "node:path";
import type { FooksProjectMetricStatus } from "./session-metrics";

export const WORK_ITEM_DASHBOARD_SCHEMA_VERSION = 2;
export const WORK_ITEM_DASHBOARD_SOURCE = "fooks status docs-backed work-item projection";
export const WORK_ITEM_DASHBOARD_CLAIM_BOUNDARY =
  "Docs-backed active-work dashboard projection only; separates observed local evidence, conservative inference, required next action, and non-claims without changing runtime/provider behavior or rewriting TUI.";

export type WorkItemEvidenceKind = "issue" | "branch" | "session" | "worktree" | "pullRequest" | "metricReceipt" | "architectureDoc" | "domainHint";
export type WorkItemFrontendDomain = "react-web" | "react-native" | "webview" | "tui" | "shared" | "unknown";
export const WORK_ITEM_FRONTEND_DOMAIN_TAXONOMY: WorkItemFrontendDomain[] = ["react-web", "react-native", "webview", "tui", "shared", "unknown"];
export type WorkItemEvidenceClass = "Source evidence" | "Local command evidence" | "Workflow evidence" | "Session evidence" | "Receipt evidence";
export type WorkItemState = "uninspected" | "evidence-ready" | "fallback-required" | "context-issued" | "receipt-recorded" | "active-work" | "blocked";
export type WorkItemNextActionKind = "inspect" | "verify" | "link" | "open-pr" | "continue" | "fallback";

export type WorkItemEvidence = {
  kind: WorkItemEvidenceKind;
  evidenceClass: WorkItemEvidenceClass;
  observed: string;
  source: string;
  fresh: boolean | "unknown";
  supports: string;
  doesNotSupport: string;
};

export type WorkItemNextAction = {
  kind: WorkItemNextActionKind;
  label: string;
  command?: string;
  reason: string;
  closesWhen: string;
};

export type WorkItem = {
  id: string;
  title: string;
  state: WorkItemState;
  frontendDomain: WorkItemFrontendDomain;
  observed: string[];
  inferred: string[];
  requiredNextAction: WorkItemNextAction;
  evidence: WorkItemEvidence[];
  nonClaims: string[];
};

export type WorkItemArchitectureAudit = {
  scope: "status" | "check" | "tui";
  currentSurface: string;
  docsBackedTarget: string;
  divergence: string;
  firstPassAction: string;
};

export type WorkItemDashboard = {
  schemaVersion: typeof WORK_ITEM_DASHBOARD_SCHEMA_VERSION;
  source: typeof WORK_ITEM_DASHBOARD_SOURCE;
  generatedAt: string;
  claimBoundary: typeof WORK_ITEM_DASHBOARD_CLAIM_BOUNDARY;
  readOnly: true;
  generatedFrom: {
    command: "status";
    docs: ["docs/product-direction.md", "docs/frontend-domains.md", "docs/evidence-model.md", "docs/workflow-architecture.md", "docs/state-contract.md"];
  };
  anchors: {
    repo?: string;
    issue?: string;
    issueUrl?: string;
    branch?: string;
    worktree: string;
    session?: string;
    pullRequest?: string;
    pullRequestUrl?: string;
  };
  architectureAudit: WorkItemArchitectureAudit[];
  workItems: WorkItem[];
  nextActions: WorkItemNextAction[];
  frontendDomainTaxonomy: WorkItemFrontendDomain[];
  tuiCompatibility: {
    modelOnly: true;
    sharedTypes: ["WorkItem", "Evidence", "NextAction"];
    note: string;
  };
};

type GitSnapshot = {
  repo?: string;
  branch?: string;
  head?: string;
  clean: boolean | null;
  changedPathCount?: number;
  blocker?: string;
};

type CommandResult = { ok: true; stdout: string } | { ok: false; error: string };

function runGit(cwd: string, args: string[]): CommandResult {
  try {
    return {
      ok: true,
      stdout: execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        timeout: 1000,
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }).trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function stdoutOrUndefined(result: CommandResult): string | undefined {
  return result.ok ? result.stdout : undefined;
}

function canonicalRepoIdentifier(remoteUrl: string | undefined): string | undefined {
  const trimmed = remoteUrl?.trim();
  if (!trimmed) return undefined;
  const ssh = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/u);
  if (ssh) return `${ssh[1]}/${ssh[2].replace(/\.git$/u, "")}`;
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/^\/+|\.git$/gu, "");
    return pathname ? `${parsed.hostname}/${pathname}` : parsed.hostname;
  } catch {
    return trimmed.replace(/\.git$/u, "");
  }
}

function readGitSnapshot(cwd: string): GitSnapshot {
  const status = runGit(cwd, ["status", "--porcelain=v1"]);
  const branch = stdoutOrUndefined(runGit(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]));
  const head = stdoutOrUndefined(runGit(cwd, ["rev-parse", "--short", "HEAD"]));
  const repo = canonicalRepoIdentifier(stdoutOrUndefined(runGit(cwd, ["config", "--get", "remote.origin.url"])));
  if (!status.ok) {
    return { repo, branch, head, clean: null, blocker: `git worktree evidence unavailable: ${status.error}` };
  }
  const changedPathCount = status.stdout === "" ? 0 : status.stdout.split(/\r?\n/u).filter(Boolean).length;
  return { repo, branch, head, clean: changedPathCount === 0, changedPathCount };
}

function issueFromBranch(branch: string | undefined): string | undefined {
  const match = branch?.match(/(?:^|[-_/#])issue[-_/#]?(\d{2,})(?=$|[-_/#])/iu) ?? branch?.match(/(?:^|[-_/#])#(\d{2,})(?=$|[-_/#])/u);
  return match ? `#${match[1]}` : undefined;
}

function sessionFromEnv(): string | undefined {
  const explicit = process.env.FOOKS_SESSION_ID || process.env.OMX_SESSION_ID;
  if (explicit) return explicit;
  const tmux = process.env.TMUX_PANE;
  return tmux ? `tmux-pane:${tmux}` : undefined;
}

function prFromEnv(): { pullRequest?: string; pullRequestUrl?: string } {
  const url = process.env.FOOKS_PULL_REQUEST_URL || process.env.PR_URL;
  const number = process.env.FOOKS_PULL_REQUEST || process.env.PR_NUMBER;
  if (url) return { pullRequest: number ? `#${number.replace(/^#/u, "")}` : url, pullRequestUrl: url };
  return number ? { pullRequest: `#${number.replace(/^#/u, "")}` } : {};
}

function metricEvidence(metricStatus: FooksProjectMetricStatus): WorkItemEvidence {
  return {
    kind: "metricReceipt",
    evidenceClass: "Receipt evidence",
    observed: `${metricStatus.eventCount} metric event(s), ${metricStatus.sessionCount} session summary item(s), ${metricStatus.latestSessionCount} latest session key(s) summarized`,
    source: "fooks status metric summary",
    fresh: "unknown",
    supports: "local estimated context-size telemetry exists for this checkout when events are present",
    doesNotSupport: "provider usage, billing tokens, invoices, charged costs, runtime UI correctness, or completed active work",
  };
}

function worktreeEvidence(snapshot: GitSnapshot, cwd: string): WorkItemEvidence {
  const observed = snapshot.clean === null
    ? "git worktree state unavailable"
    : `branch ${snapshot.branch ?? "unknown"} at ${snapshot.head ?? "unknown"}; ${snapshot.clean ? "clean" : "dirty"} (${snapshot.changedPathCount ?? 0} changed path(s))`;
  return {
    kind: "worktree",
    evidenceClass: "Workflow evidence",
    observed,
    source: "git status/rev-parse local snapshot",
    fresh: snapshot.clean === null ? "unknown" : true,
    supports: `local worktree evidence for ${path.basename(cwd)}`,
    doesNotSupport: "merged PR status, remote freshness, or completion without a closeout receipt",
  };
}

function docsEvidence(): WorkItemEvidence {
  return {
    kind: "architectureDoc",
    evidenceClass: "Source evidence",
    observed: "#921 architecture docs define evidence, receipts, active work, workflow states, and state-to-next-action vocabulary",
    source: "docs/product-direction.md, docs/evidence-model.md, docs/workflow-architecture.md, docs/state-contract.md",
    fresh: true,
    supports: "conservative WorkItem/Evidence/NextAction vocabulary for CLI/TUI shared model",
    doesNotSupport: "runtime/provider behavior changes or a broad TUI rewrite",
  };
}

function displayFrontendDomain(frontendDomain: WorkItemFrontendDomain): string {
  switch (frontendDomain) {
    case "react-web":
      return "React Web";
    case "react-native":
      return "React Native";
    case "webview":
      return "WebView";
    case "tui":
      return "TUI";
    case "shared":
      return "Shared";
    case "unknown":
      return "Unknown-domain";
  }
}

function frontendDomainFor(snapshot: GitSnapshot): WorkItemFrontendDomain {
  const branch = snapshot.branch?.toLowerCase() ?? "";
  if (/(^|[-_/#])react[-_]web($|[-_/#])|(^|[-_/#])web($|[-_/#])/.test(branch)) return "react-web";
  if (/(^|[-_/#])react[-_]native($|[-_/#])|(^|[-_/#])rn($|[-_/#])/.test(branch)) return "react-native";
  if (/(^|[-_/#])webview($|[-_/#])/.test(branch)) return "webview";
  if (/(^|[-_/#])tui($|[-_/#])|(^|[-_/#])terminal[-_]ui($|[-_/#])/.test(branch)) return "tui";
  if (/(^|[-_/#])shared($|[-_/#])/.test(branch)) return "shared";
  return "unknown";
}

function domainHintEvidence(frontendDomain: WorkItemFrontendDomain, snapshot: GitSnapshot): WorkItemEvidence {
  const observed = frontendDomain === "unknown"
    ? `no frontend work domain hinted by branch ${snapshot.branch ?? "unknown"}`
    : `${frontendDomain} frontend work domain hinted by branch ${snapshot.branch ?? "unknown"}`;
  return {
    kind: "domainHint",
    evidenceClass: "Workflow evidence",
    observed,
    source: "local branch naming plus WorkItem frontend domain taxonomy",
    fresh: snapshot.branch ? true : "unknown",
    supports: "React Web / React Native / WebView / TUI / Shared / Unknown work-domain hint representation in the shared WorkItem model",
    doesNotSupport: "runtime UI correctness, broad framework support, detector expansion, or changes to fooks' own TUI board",
  };
}

function hasActiveWorkAnchor(snapshot: GitSnapshot, anchors: WorkItemDashboard["anchors"]): boolean {
  return Boolean(anchors.issue || anchors.pullRequest || snapshot.clean === false);
}

function workItemStateFor(snapshot: GitSnapshot, anchors: WorkItemDashboard["anchors"]): WorkItemState {
  if (snapshot.blocker) return "blocked";
  return hasActiveWorkAnchor(snapshot, anchors) ? "active-work" : "evidence-ready";
}

function nextActionFor(snapshot: GitSnapshot, anchors: WorkItemDashboard["anchors"]): WorkItemNextAction {
  if (snapshot.blocker) {
    return {
      kind: "inspect",
      label: "Inspect local git/worktree evidence before acting",
      command: "fooks status worktree",
      reason: snapshot.blocker,
      closesWhen: "worktree evidence is available or the blocker is recorded in a receipt",
    };
  }
  if (!anchors.issue) {
    return {
      kind: "link",
      label: "Link an open issue before treating this as active product work",
      reason: "docs-backed active-work state needs an issue, branch, session, worktree, or PR anchor; branch did not expose an issue number",
      closesWhen: "an open issue or equivalent active-work receipt is recorded",
    };
  }
  if (!anchors.pullRequest) {
    return {
      kind: "open-pr",
      label: "Open or link the PR after focused verification passes",
      command: "gh pr create",
      reason: "issue/branch/worktree anchors exist, but no PR anchor is present in the local dashboard inputs",
      closesWhen: "a PR URL/number is linked to the work item",
    };
  }
  return {
    kind: "verify",
    label: "Verify and close active work with a fresh receipt",
    command: "npm test",
    reason: "issue, branch, worktree, and PR anchors are present; active work still needs test/review closeout evidence",
    closesWhen: "targeted verification and review receipts are recorded",
  };
}

export function buildWorkItemDashboard(cwd: string, metricStatus: FooksProjectMetricStatus): WorkItemDashboard {
  const snapshot = readGitSnapshot(cwd);
  const issue = issueFromBranch(snapshot.branch);
  const pr = prFromEnv();
  const anchors: WorkItemDashboard["anchors"] = {
    repo: snapshot.repo,
    issue,
    issueUrl: snapshot.repo && issue ? `https://${snapshot.repo}/issues/${issue.slice(1)}` : undefined,
    branch: snapshot.branch,
    worktree: cwd,
    session: sessionFromEnv(),
    ...pr,
  };
  const action = nextActionFor(snapshot, anchors);
  const frontendDomain = frontendDomainFor(snapshot);
  const evidence = [docsEvidence(), domainHintEvidence(frontendDomain, snapshot), worktreeEvidence(snapshot, cwd), metricEvidence(metricStatus)];
  if (issue) {
    evidence.push({
      kind: "issue",
      evidenceClass: "Workflow evidence",
      observed: `${issue} inferred from branch ${snapshot.branch}`,
      source: "local branch naming convention",
      fresh: true,
      supports: "an active-work issue anchor candidate for this checkout",
      doesNotSupport: "the issue is open remotely unless checked by a separate GitHub receipt",
    });
  }
  if (anchors.session) {
    evidence.push({
      kind: "session",
      evidenceClass: "Session evidence",
      observed: anchors.session,
      source: "OMX/FOOKS/TMUX environment",
      fresh: true,
      supports: "a local session anchor for this dashboard invocation",
      doesNotSupport: "submitted work or review completion by itself",
    });
  }

  return {
    schemaVersion: WORK_ITEM_DASHBOARD_SCHEMA_VERSION,
    source: WORK_ITEM_DASHBOARD_SOURCE,
    generatedAt: new Date().toISOString(),
    claimBoundary: WORK_ITEM_DASHBOARD_CLAIM_BOUNDARY,
    readOnly: true,
    generatedFrom: {
      command: "status",
      docs: ["docs/product-direction.md", "docs/frontend-domains.md", "docs/evidence-model.md", "docs/workflow-architecture.md", "docs/state-contract.md"],
    },
    anchors,
    frontendDomainTaxonomy: WORK_ITEM_FRONTEND_DOMAIN_TAXONOMY,
    architectureAudit: [
      {
        scope: "status",
        currentSurface: "bare fooks status primarily returns estimated metric telemetry",
        docsBackedTarget: "next-action-centered active-work dashboard that separates observed evidence, inference, required next action, and non-claims",
        divergence: "metric receipts are useful but are not active-work closeout evidence by themselves; bare status now includes bounded local git probing for worktree evidence",
        firstPassAction: "attach a WorkItem dashboard projection to fooks status without removing existing metric fields",
      },
      {
        scope: "check",
        currentSurface: "fooks check reports operator active-artifact boundaries and handoff requirements",
        docsBackedTarget: "shared Evidence and NextAction vocabulary reusable by status/check/TUI surfaces",
        divergence: "check already carries conservative boundaries but uses operator-specific shapes",
        firstPassAction: "keep check behavior unchanged and model the shared vocabulary in a separate projection",
      },
      {
        scope: "tui",
        currentSurface: "TUI-related code is source/payload metadata and tests, not a rewritten action board",
        docsBackedTarget: "TUI is represented as a user-project frontend work domain in WorkItem/Evidence/NextAction without runtime/provider changes",
        divergence: "no common board model existed before this pass",
        firstPassAction: "export shared model types, include the TUI frontend domain, and do not rewrite fooks' own TUI board",
      },
    ],
    workItems: [
      {
        id: issue ? `work-item-${issue.slice(1)}` : "work-item-unlinked",
        title: issue ? `Active ${displayFrontendDomain(frontendDomain)} work ${issue}` : "Unlinked work item candidate",
        state: workItemStateFor(snapshot, anchors),
        frontendDomain,
        observed: evidence.map((item) => item.observed),
        inferred: [
          issue ? `${issue} is the local issue anchor inferred from branch naming.` : "No issue anchor was inferred from branch naming.",
          snapshot.clean === false ? "The worktree has uncommitted local changes and still needs verification/closeout." : "Clean worktree evidence still needs a scoped receipt before active work is complete.",
        ],
        requiredNextAction: action,
        evidence,
        nonClaims: [
          "This dashboard does not prove provider usage or billing-token savings.",
          "This dashboard does not prove runtime UI correctness.",
          "A TUI-domain work item means a user-developed terminal UI target, not fooks' own rendering surface.",
          "This dashboard does not close active work without test/review/PR receipt evidence.",
        ],
      },
    ],
    nextActions: [action],
    tuiCompatibility: {
      modelOnly: true,
      sharedTypes: ["WorkItem", "Evidence", "NextAction"],
      note: "The model represents TUI as a user-project frontend domain for status/explain consumers; this pass intentionally does not rewrite fooks' own TUI board.",
    },
  };
}

export type Evidence = WorkItemEvidence;
export type NextAction = WorkItemNextAction;
