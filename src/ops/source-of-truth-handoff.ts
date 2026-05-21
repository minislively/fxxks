import { execFileSync } from "node:child_process";
import path from "node:path";
import type { OperatorCheckSnapshot } from "./operator-check";
import type { PreflightPacket } from "./preflight";
import { STALE_CONTEXT_COMMAND } from "./stale-context";
import { buildRuntimeTokenCostPlanningWarnings, type RuntimeTokenCostPlanningWarning } from "./runtime-token-cost-planning-warning";
import { buildCombinedReliabilityWarnings, type CombinedReliabilityWarning } from "./combined-reliability-warning";
import { buildSequentialPlanningHints, readSequentialPlanningPrompt, type SequentialPlanningHint } from "./sequential-planning-hint";
import { buildPlanBeforeExecuteGuards, type PlanBeforeExecuteGuard } from "./plan-before-execute-guard";
import { buildLongRunBudgetWarnings, type LongRunBudgetWarning } from "./long-run-budget-warning";
import { buildResetCompactHandoffRecommendations, type ResetCompactHandoffRecommendation } from "./reset-compact-handoff-recommendation";

export const SOURCE_OF_TRUTH_HANDOFF_SCHEMA_VERSION = 1;
export const SOURCE_OF_TRUTH_HANDOFF_COMMAND = "handoff";
export const SOURCE_OF_TRUTH_HANDOFF_SOURCE = "fooks check/preflight plus current-branch source-of-truth handoff projection";
export const SOURCE_OF_TRUTH_HANDOFF_CLAIM_BOUNDARY =
  "Compact read-only handoff packet for fresh agent sessions; bounded to the invocation cwd/current branch/worktree, reuses operator-check/preflight contracts, performs only narrow git and gh issue/PR/status reads for linked current artifacts, and does not mutate hooks, provider/runtime behavior, stale detector scope, token/cost planning, product claims, or frontend behavior.";
export const AUTHORITATIVE_RESUME_PACKET_SCHEMA_VERSION = 1;
export const AUTHORITATIVE_RESUME_PACKET_ISSUE = "#986";
export const AUTHORITATIVE_RESUME_PACKET_SOURCE = "compact authoritative resume packet derived from source-of-truth handoff";
export const AUTHORITATIVE_RESUME_PACKET_CLAIM_BOUNDARY =
  "Compact advisory/read-only resume packet for issue #986; it reuses existing handoff/source-of-truth/context-trust/reliability warning fields before a new session, preserves the full handoff output, and is not provider billing/runtime proof, not autonomous CI/merge authority, not provider/runtime hook behavior, not product support expansion, and not frontend behavior change.";

export type SourceOfTruthHandoffCommandRunner = (command: string, args: string[], cwd: string, timeoutMs: number) => string;

export type SourceOfTruthHandoffOptions = {
  commandRunner?: SourceOfTruthHandoffCommandRunner;
  now?: () => string;
};

export type SourceOfTruthLinkedArtifact =
  | {
      status: "linked";
      source: string;
      number: number;
      state?: string;
      title?: string;
      url?: string;
      headRefName?: string;
      baseRefName?: string;
      isDraft?: boolean;
    }
  | {
      status: "not-found" | "not-inferred" | "unavailable";
      source: string;
      reason: string;
      number?: number;
    };

export type SourceOfTruthPrCheck = {
  name: string;
  status?: string;
  conclusion?: string;
  detailsUrl?: string;
};

export type SourceOfTruthHandoffPacket = {
  schemaVersion: typeof SOURCE_OF_TRUTH_HANDOFF_SCHEMA_VERSION;
  command: typeof SOURCE_OF_TRUTH_HANDOFF_COMMAND;
  generatedAt: string;
  cwd: string;
  source: typeof SOURCE_OF_TRUTH_HANDOFF_SOURCE;
  claimBoundary: typeof SOURCE_OF_TRUTH_HANDOFF_CLAIM_BOUNDARY;
  derivedFrom: {
    operatorCheckCommand: "check";
    operatorCheckSchemaVersion: 1;
    preflightCommand: "preflight";
    preflightSchemaVersion: 1;
    staleContextCommand: typeof STALE_CONTEXT_COMMAND;
  };
  scope: {
    cwd: string;
    branch?: string;
    head?: string;
    upstream?: string;
    clean: boolean | null;
    ahead?: number;
    behind?: number;
    changedPathCount: number;
    changedPaths: string[];
    changedPathLimit: number;
    source: string;
  };
  linkedArtifacts: {
    issue: SourceOfTruthLinkedArtifact;
    pullRequest: SourceOfTruthLinkedArtifact;
  };
  currentStatus: {
    operatorCheck: {
      verdict: OperatorCheckSnapshot["verdict"];
      generatedAt: string;
      blockers: string[];
      source: OperatorCheckSnapshot["source"];
    };
    preflight: PreflightPacket["guidance"] & { authorityStatus: PreflightPacket["summary"]["authorityStatus"] };
    ci: {
      source: OperatorCheckSnapshot["postMergeMainCiEvidence"]["source"];
      remoteFreshness: OperatorCheckSnapshot["postMergeMainCiEvidence"]["remoteFreshness"];
      summary: OperatorCheckSnapshot["postMergeMainCiEvidence"]["summary"];
      workflows: Array<Pick<OperatorCheckSnapshot["postMergeMainCiEvidence"]["workflowEvidence"][number], "workflow" | "status" | "conclusion" | "runStatus" | "url" | "headSha" | "reason">>;
    };
    pullRequestChecks: {
      status: "available" | "not-linked" | "unavailable";
      source: string;
      checks: SourceOfTruthPrCheck[];
      reason?: string;
    };
  };
  sourceOfTruth: {
    currentAuthority: PreflightPacket["currentAuthority"];
    authoritativeFilesAndDocs: string[];
    currentChangedFiles: string[];
  };
  staleOrHistoricalContextToAvoid: Array<{
    kind: string;
    source: string;
    reason: string;
    referenceField?: string;
  }>;
  nextRecommendedAction: {
    action: PreflightPacket["guidance"]["recommendedAction"] | "continue-implementation-for-linked-issue" | "open-pr-or-push-current-branch";
    rationale: string;
    suggestedCommands: string[];
  };
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  sequentialPlanningHints: SequentialPlanningHint[];
  planBeforeExecuteGuards: PlanBeforeExecuteGuard[];
  longRunBudgetWarnings: LongRunBudgetWarning[];
  resetCompactHandoffRecommendations: ResetCompactHandoffRecommendation[];
  authoritativeResumePacket: AuthoritativeResumePacket;
  blockers: string[];
};

export type AuthoritativeResumePacketAction =
  | "stop-before-more-execution"
  | SourceOfTruthHandoffPacket["nextRecommendedAction"]["action"];

export type AuthoritativeResumePacket = {
  schemaVersion: typeof AUTHORITATIVE_RESUME_PACKET_SCHEMA_VERSION;
  issue: typeof AUTHORITATIVE_RESUME_PACKET_ISSUE;
  status: "advisory";
  compact: true;
  beforeNewSession: true;
  source: typeof AUTHORITATIVE_RESUME_PACKET_SOURCE;
  claimBoundary: typeof AUTHORITATIVE_RESUME_PACKET_CLAIM_BOUNDARY;
  derivedFrom: {
    handoffCommand: typeof SOURCE_OF_TRUTH_HANDOFF_COMMAND;
    handoffSchemaVersion: typeof SOURCE_OF_TRUTH_HANDOFF_SCHEMA_VERSION;
    operatorCheckCommand: "check";
    preflightCommand: "preflight";
    fields: [
      "scope",
      "linkedArtifacts",
      "currentStatus.operatorCheck",
      "currentStatus.preflight",
      "sourceOfTruth.currentAuthority",
      "sourceOfTruth.authoritativeFilesAndDocs",
      "staleOrHistoricalContextToAvoid",
      "nextRecommendedAction",
      "planningWarnings",
      "combinedReliabilityWarnings",
      "sequentialPlanningHints",
      "planBeforeExecuteGuards",
      "longRunBudgetWarnings",
      "resetCompactHandoffRecommendations",
    ];
  };
  currentSourceOfTruth: {
    authorityStatus: PreflightPacket["summary"]["authorityStatus"];
    currentAuthority: PreflightPacket["currentAuthority"];
    authoritativeFilesAndDocs: string[];
    scope: {
      cwd: string;
      branch?: string;
      head?: string;
      upstream?: string;
      clean: boolean | null;
      changedPathCount: number;
      changedPaths: string[];
      changedPathLimit: number;
    };
    linkedArtifacts: {
      issue: SourceOfTruthLinkedArtifact;
      pullRequest: SourceOfTruthLinkedArtifact;
    };
  };
  staleHistoricalBoundary: {
    status: "clear" | "present";
    avoidCount: number;
    entries: SourceOfTruthHandoffPacket["staleOrHistoricalContextToAvoid"];
    entryLimit: number;
    omittedCount: number;
    instruction: string;
  };
  reliabilityBoundary: {
    planningWarningCount: number;
    combinedReliabilityWarningCount: number;
    sequentialPlanningHintCount: number;
    planBeforeExecuteGuardCount: number;
    longRunBudgetWarningCount: number;
    resetCompactHandoffRecommendationCount: number;
    longRunBudgetRiskLevel: "high" | "clear";
    staleContextReliabilityOverlap: boolean;
    stopBeforeMoreExecution: boolean;
  };
  nextSessionAdvisory: {
    action: AuthoritativeResumePacketAction;
    rationale: string;
    suggestedCommands: string[];
    requiredRechecks: string[];
  };
  forbiddenClaims: string[];
};

const GIT_SOURCE = "local git for invocation cwd/current branch; no fetch performed";
const ISSUE_SOURCE = "gh issue view <inferred issue number> --json number,title,state,url";
const PR_SOURCE = "gh pr list --head <current branch> --state all --json number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup --limit 1";
const CHANGED_PATH_LIMIT = 40;
const RESUME_CHANGED_PATH_LIMIT = 12;
const RESUME_AUTHORITATIVE_FILE_LIMIT = 12;
const RESUME_STALE_ENTRY_LIMIT = 10;
const AUTHORITATIVE_FILES_AND_DOCS = [
  "src/ops/operator-check.ts",
  "src/ops/context-trust.ts",
  "src/ops/preflight.ts",
  "src/ops/stale-context.ts",
  "src/ops/source-of-truth-handoff.ts",
  "src/ops/runtime-token-cost-planning-warning.ts",
  "src/ops/sequential-planning-hint.ts",
  "src/ops/plan-before-execute-guard.ts",
  "src/cli/index.ts",
  "docs/research/context-trust-and-stale-evidence-research.md",
  "docs/stale-context.md",
];

function run(command: string, args: string[], cwd: string, timeoutMs: number, runner?: SourceOfTruthHandoffCommandRunner): string {
  if (runner) return runner(command, args, cwd, timeoutMs);
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function tryRun(command: string, args: string[], cwd: string, timeoutMs: number, runner?: SourceOfTruthHandoffCommandRunner): { output?: string; blocker?: string } {
  try {
    return { output: run(command, args, cwd, timeoutMs, runner).trim() };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { blocker: `${command} ${args.join(" ")} unavailable: ${detail}` };
  }
}

function parseJson<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function inferIssueNumber(branch: string | undefined): number | undefined {
  if (!branch) return undefined;
  const match = branch.match(/(?:^|[-_/])(?:issue|issues|gh)[-_/]?(\d+)(?:\D|$)/iu) ?? branch.match(/#(\d+)\b/u);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function readChangedPaths(cwd: string, runner?: SourceOfTruthHandoffCommandRunner): string[] {
  const status = tryRun("git", ["status", "--porcelain=v1"], cwd, 1000, runner);
  if (!status.output) return [];
  return status.output
    .split(/\r?\n/u)
    .map((line) => line.replace(/^.. ?/u, "").trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(.+?) -> /u, ""))
    .sort((left, right) => left.localeCompare(right));
}

function linkedIssue(cwd: string, branch: string | undefined, blockers: string[], runner?: SourceOfTruthHandoffCommandRunner): SourceOfTruthLinkedArtifact {
  const issueNumber = inferIssueNumber(branch);
  if (!issueNumber) {
    return { status: "not-inferred", source: ISSUE_SOURCE, reason: "current branch name does not contain an issue number" };
  }
  const result = tryRun("gh", ["issue", "view", String(issueNumber), "--json", "number,title,state,url"], cwd, 1500, runner);
  if (result.blocker) {
    blockers.push(result.blocker);
    return { status: "unavailable", source: ISSUE_SOURCE, reason: result.blocker, number: issueNumber };
  }
  const parsed = parseJson<{ number?: number; title?: string; state?: string; url?: string }>(result.output, {});
  if (!parsed.number) {
    return { status: "not-found", source: ISSUE_SOURCE, reason: "gh returned no issue number", number: issueNumber };
  }
  return { status: "linked", source: ISSUE_SOURCE, number: parsed.number, title: parsed.title, state: parsed.state, url: parsed.url };
}

function linkedPullRequest(cwd: string, branch: string | undefined, blockers: string[], runner?: SourceOfTruthHandoffCommandRunner): { artifact: SourceOfTruthLinkedArtifact; checks: SourceOfTruthPrCheck[]; checksReason?: string } {
  if (!branch) {
    return { artifact: { status: "not-inferred", source: PR_SOURCE, reason: "current branch is unavailable" }, checks: [], checksReason: "current branch is unavailable" };
  }
  const result = tryRun("gh", ["pr", "list", "--head", branch, "--state", "all", "--json", "number,title,state,url,headRefName,baseRefName,isDraft,statusCheckRollup", "--limit", "1"], cwd, 1500, runner);
  if (result.blocker) {
    blockers.push(result.blocker);
    return { artifact: { status: "unavailable", source: PR_SOURCE, reason: result.blocker }, checks: [], checksReason: result.blocker };
  }
  const parsedList = parseJson<Array<{
    number?: number;
    title?: string;
    state?: string;
    url?: string;
    headRefName?: string;
    baseRefName?: string;
    isDraft?: boolean;
    statusCheckRollup?: Array<{ name?: string; workflowName?: string; status?: string; conclusion?: string; detailsUrl?: string }>;
  }>>(result.output, []);
  const parsed = parsedList[0] ?? {};
  if (!parsed.number) {
    return { artifact: { status: "not-found", source: PR_SOURCE, reason: `gh returned no pull request for current branch ${branch}` }, checks: [], checksReason: "no linked pull request" };
  }
  const checks = (parsed.statusCheckRollup ?? []).slice(0, 20).map((check) => ({
    name: check.name ?? check.workflowName ?? "unnamed-check",
    ...(check.status ? { status: check.status } : {}),
    ...(check.conclusion ? { conclusion: check.conclusion } : {}),
    ...(check.detailsUrl ? { detailsUrl: check.detailsUrl } : {}),
  }));
  return {
    artifact: {
      status: "linked",
      source: PR_SOURCE,
      number: parsed.number,
      title: parsed.title,
      state: parsed.state,
      url: parsed.url,
      headRefName: parsed.headRefName,
      baseRefName: parsed.baseRefName,
      isDraft: parsed.isDraft,
    },
    checks,
  };
}

function staleAvoidList(snapshot: OperatorCheckSnapshot, preflight: PreflightPacket): SourceOfTruthHandoffPacket["staleOrHistoricalContextToAvoid"] {
  return [...preflight.historicalOnly, ...preflight.nonAuthorizing].map((entry) => ({
    kind: entry.kind,
    source: entry.source,
    reason: entry.reason,
    ...(entry.referenceField ? { referenceField: entry.referenceField } : {}),
  }));
}

function nextAction(preflight: PreflightPacket, issue: SourceOfTruthLinkedArtifact, pr: SourceOfTruthLinkedArtifact, changedPathCount: number): SourceOfTruthHandoffPacket["nextRecommendedAction"] {
  if (preflight.guidance.recommendedAction === "continue-with-current-authority" && issue.status === "linked" && issue.state === "OPEN" && pr.status !== "linked" && changedPathCount > 0) {
    return {
      action: "open-pr-or-push-current-branch",
      rationale: "linked open issue and local changes exist, but no current-branch pull request was found; finish verification, then publish/link the branch or open a PR.",
      suggestedCommands: ["npm run build", "npm test", "gh pr create --fill"],
    };
  }
  if (preflight.guidance.recommendedAction === "continue-with-current-authority" && issue.status === "linked") {
    return {
      action: "continue-implementation-for-linked-issue",
      rationale: `continue against linked issue #${issue.number}; keep source authority in current files and re-run check/handoff before handing off again.`,
      suggestedCommands: ["npm run build", "npm test", "fooks check --json", "fooks handoff --json"],
    };
  }
  return {
    action: preflight.guidance.recommendedAction,
    rationale: preflight.guidance.rationale,
    suggestedCommands: ["fooks check --json", "fooks preflight --json", "fooks stale-context --stdin --json"],
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function buildAuthoritativeResumePacket(input: {
  cwd: string;
  branch?: string;
  head?: string;
  upstream?: string;
  clean: boolean | null;
  changedPaths: string[];
  issue: SourceOfTruthLinkedArtifact;
  pullRequest: SourceOfTruthLinkedArtifact;
  preflight: PreflightPacket;
  staleOrHistoricalContextToAvoid: SourceOfTruthHandoffPacket["staleOrHistoricalContextToAvoid"];
  nextRecommendedAction: SourceOfTruthHandoffPacket["nextRecommendedAction"];
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  sequentialPlanningHints: SequentialPlanningHint[];
  planBeforeExecuteGuards: PlanBeforeExecuteGuard[];
  longRunBudgetWarnings: LongRunBudgetWarning[];
  resetCompactHandoffRecommendations: ResetCompactHandoffRecommendation[];
}): AuthoritativeResumePacket {
  const stopBeforeMoreExecution = input.planBeforeExecuteGuards.some((guard) => guard.stopBeforeMoreExecution);
  const requiredRechecks = uniqueStrings([
    ...input.resetCompactHandoffRecommendations.flatMap((recommendation) => recommendation.requiredRechecks),
    ...input.longRunBudgetWarnings.flatMap((warning) => warning.requiredRechecks),
    ...input.planBeforeExecuteGuards.flatMap((guard) => guard.requiredRechecks),
    ...input.sequentialPlanningHints.flatMap((hint) => hint.requiredRechecks),
    ...input.combinedReliabilityWarnings.flatMap((warning) => warning.requiredRechecks),
    "Run fooks check --json in the new session before treating this packet as current authority.",
    "Run fooks handoff --json again before the next context compression or fresh-agent handoff.",
  ]);
  const forbiddenClaims = uniqueStrings([
    ...input.resetCompactHandoffRecommendations.flatMap((recommendation) => recommendation.forbiddenClaims),
    ...input.longRunBudgetWarnings.flatMap((warning) => warning.forbiddenClaims),
    ...input.planBeforeExecuteGuards.flatMap((guard) => guard.forbiddenClaims),
    ...input.sequentialPlanningHints.flatMap((hint) => hint.forbiddenClaims),
    ...input.combinedReliabilityWarnings.flatMap((warning) => warning.forbiddenClaims),
    ...input.planningWarnings.flatMap((warning) => warning.forbiddenClaims),
    "provider billing/runtime proof",
    "autonomous CI/merge authority",
    "frontend runtime behavior change",
  ]);
  const staleEntries = input.staleOrHistoricalContextToAvoid.slice(0, RESUME_STALE_ENTRY_LIMIT);
  const action: AuthoritativeResumePacketAction = stopBeforeMoreExecution ? "stop-before-more-execution" : input.nextRecommendedAction.action;
  const rationale = stopBeforeMoreExecution
    ? "plan-before-execute guard is present; a fresh session should recheck current authority and resume from this compact packet before more execution."
    : input.nextRecommendedAction.rationale;

  return {
    schemaVersion: AUTHORITATIVE_RESUME_PACKET_SCHEMA_VERSION,
    issue: AUTHORITATIVE_RESUME_PACKET_ISSUE,
    status: "advisory",
    compact: true,
    beforeNewSession: true,
    source: AUTHORITATIVE_RESUME_PACKET_SOURCE,
    claimBoundary: AUTHORITATIVE_RESUME_PACKET_CLAIM_BOUNDARY,
    derivedFrom: {
      handoffCommand: SOURCE_OF_TRUTH_HANDOFF_COMMAND,
      handoffSchemaVersion: SOURCE_OF_TRUTH_HANDOFF_SCHEMA_VERSION,
      operatorCheckCommand: "check",
      preflightCommand: "preflight",
      fields: [
        "scope",
        "linkedArtifacts",
        "currentStatus.operatorCheck",
        "currentStatus.preflight",
        "sourceOfTruth.currentAuthority",
        "sourceOfTruth.authoritativeFilesAndDocs",
        "staleOrHistoricalContextToAvoid",
        "nextRecommendedAction",
        "planningWarnings",
        "combinedReliabilityWarnings",
        "sequentialPlanningHints",
        "planBeforeExecuteGuards",
        "longRunBudgetWarnings",
        "resetCompactHandoffRecommendations",
      ],
    },
    currentSourceOfTruth: {
      authorityStatus: input.preflight.summary.authorityStatus,
      currentAuthority: input.preflight.currentAuthority,
      authoritativeFilesAndDocs: AUTHORITATIVE_FILES_AND_DOCS.map((entry) => path.normalize(entry)).slice(0, RESUME_AUTHORITATIVE_FILE_LIMIT),
      scope: {
        cwd: input.cwd,
        ...(input.branch ? { branch: input.branch } : {}),
        ...(input.head ? { head: input.head } : {}),
        ...(input.upstream ? { upstream: input.upstream } : {}),
        clean: input.clean,
        changedPathCount: input.changedPaths.length,
        changedPaths: input.changedPaths.slice(0, RESUME_CHANGED_PATH_LIMIT),
        changedPathLimit: RESUME_CHANGED_PATH_LIMIT,
      },
      linkedArtifacts: {
        issue: input.issue,
        pullRequest: input.pullRequest,
      },
    },
    staleHistoricalBoundary: {
      status: input.staleOrHistoricalContextToAvoid.length > 0 ? "present" : "clear",
      avoidCount: input.staleOrHistoricalContextToAvoid.length,
      entries: staleEntries,
      entryLimit: RESUME_STALE_ENTRY_LIMIT,
      omittedCount: Math.max(0, input.staleOrHistoricalContextToAvoid.length - staleEntries.length),
      instruction: input.staleOrHistoricalContextToAvoid.length > 0
        ? "Treat listed stale/historical/non-authorizing entries as boundaries to avoid until rechecked with fooks check/preflight/stale-context."
        : "No stale/historical/non-authorizing entries were present in the source handoff; still re-run fooks check before relying on this packet.",
    },
    reliabilityBoundary: {
      planningWarningCount: input.planningWarnings.length,
      combinedReliabilityWarningCount: input.combinedReliabilityWarnings.length,
      sequentialPlanningHintCount: input.sequentialPlanningHints.length,
      planBeforeExecuteGuardCount: input.planBeforeExecuteGuards.length,
      longRunBudgetWarningCount: input.longRunBudgetWarnings.length,
      resetCompactHandoffRecommendationCount: input.resetCompactHandoffRecommendations.length,
      longRunBudgetRiskLevel: input.longRunBudgetWarnings.length > 0 ? "high" : "clear",
      staleContextReliabilityOverlap: input.combinedReliabilityWarnings.length > 0,
      stopBeforeMoreExecution,
    },
    nextSessionAdvisory: {
      action,
      rationale,
      suggestedCommands: input.nextRecommendedAction.suggestedCommands,
      requiredRechecks,
    },
    forbiddenClaims,
  };
}

export function buildSourceOfTruthHandoffPacket(snapshot: OperatorCheckSnapshot, preflight: PreflightPacket, options: SourceOfTruthHandoffOptions = {}): SourceOfTruthHandoffPacket {
  const cwd = snapshot.cwd;
  const blockers = [...snapshot.blockers];
  const branch = snapshot.activity.worktree.branch ?? snapshot.runtimeProvenance.git.branch;
  const head = snapshot.runtimeProvenance.git.head;
  const upstream = snapshot.activity.worktree.upstream;
  const changedPaths = readChangedPaths(cwd, options.commandRunner);
  const issue = linkedIssue(cwd, branch, blockers, options.commandRunner);
  const prResult = linkedPullRequest(cwd, branch, blockers, options.commandRunner);
  const linkedIssueNumber = issue.status === "linked" ? issue.number : undefined;
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch, linkedIssueNumber });
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust: snapshot.contextTrust, planningWarnings });
  const prompt = (snapshot.sequentialPlanningHints ?? []).some((hint) =>
    hint.trigger === "prompt-implies-sequential-execution" || hint.trigger === "run-label-implies-sequential-execution"
  )
    ? readSequentialPlanningPrompt(cwd)
    : undefined;
  const sequentialPlanningHints = buildSequentialPlanningHints({ branch, linkedIssueNumber, prompt, planningWarnings, combinedReliabilityWarnings });
  const planBeforeExecuteGuards = buildPlanBeforeExecuteGuards({ branch, linkedIssueNumber, planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints });
  const longRunBudgetWarnings = buildLongRunBudgetWarnings({ planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints, planBeforeExecuteGuards });
  const resetCompactHandoffRecommendations = buildResetCompactHandoffRecommendations({ contextTrust: snapshot.contextTrust, combinedReliabilityWarnings, longRunBudgetWarnings });
  const staleOrHistoricalContextToAvoid = staleAvoidList(snapshot, preflight);
  const nextRecommendedAction = nextAction(preflight, issue, prResult.artifact, changedPaths.length);
  const authoritativeResumePacket = buildAuthoritativeResumePacket({
    cwd,
    branch,
    head,
    upstream,
    clean: snapshot.activity.worktree.clean,
    changedPaths,
    issue,
    pullRequest: prResult.artifact,
    preflight,
    staleOrHistoricalContextToAvoid,
    nextRecommendedAction,
    planningWarnings,
    combinedReliabilityWarnings,
    sequentialPlanningHints,
    planBeforeExecuteGuards,
    longRunBudgetWarnings,
    resetCompactHandoffRecommendations,
  });
  const workflows = snapshot.postMergeMainCiEvidence.workflowEvidence.map((workflow) => ({
    workflow: workflow.workflow,
    status: workflow.status,
    ...(workflow.conclusion ? { conclusion: workflow.conclusion } : {}),
    ...(workflow.runStatus ? { runStatus: workflow.runStatus } : {}),
    ...(workflow.url ? { url: workflow.url } : {}),
    ...(workflow.headSha ? { headSha: workflow.headSha } : {}),
    reason: workflow.reason,
  }));

  return {
    schemaVersion: SOURCE_OF_TRUTH_HANDOFF_SCHEMA_VERSION,
    command: SOURCE_OF_TRUTH_HANDOFF_COMMAND,
    generatedAt: options.now ? options.now() : new Date().toISOString(),
    cwd,
    source: SOURCE_OF_TRUTH_HANDOFF_SOURCE,
    claimBoundary: SOURCE_OF_TRUTH_HANDOFF_CLAIM_BOUNDARY,
    derivedFrom: {
      operatorCheckCommand: snapshot.command,
      operatorCheckSchemaVersion: snapshot.schemaVersion,
      preflightCommand: preflight.command,
      preflightSchemaVersion: preflight.schemaVersion,
      staleContextCommand: STALE_CONTEXT_COMMAND,
    },
    scope: {
      cwd,
      ...(branch ? { branch } : {}),
      ...(head ? { head } : {}),
      ...(upstream ? { upstream } : {}),
      clean: snapshot.activity.worktree.clean,
      ...(snapshot.activity.worktree.ahead !== undefined ? { ahead: snapshot.activity.worktree.ahead } : {}),
      ...(snapshot.activity.worktree.behind !== undefined ? { behind: snapshot.activity.worktree.behind } : {}),
      changedPathCount: changedPaths.length,
      changedPaths: changedPaths.slice(0, CHANGED_PATH_LIMIT),
      changedPathLimit: CHANGED_PATH_LIMIT,
      source: GIT_SOURCE,
    },
    linkedArtifacts: {
      issue,
      pullRequest: prResult.artifact,
    },
    currentStatus: {
      operatorCheck: {
        verdict: snapshot.verdict,
        generatedAt: snapshot.generatedAt,
        blockers: snapshot.blockers,
        source: snapshot.source,
      },
      preflight: {
        ...preflight.guidance,
        authorityStatus: preflight.summary.authorityStatus,
      },
      ci: {
        source: snapshot.postMergeMainCiEvidence.source,
        remoteFreshness: snapshot.postMergeMainCiEvidence.remoteFreshness,
        summary: snapshot.postMergeMainCiEvidence.summary,
        workflows,
      },
      pullRequestChecks: prResult.artifact.status === "linked"
        ? { status: "available", source: PR_SOURCE, checks: prResult.checks }
        : { status: prResult.artifact.status === "unavailable" ? "unavailable" : "not-linked", source: PR_SOURCE, checks: [], ...(prResult.checksReason ? { reason: prResult.checksReason } : {}) },
    },
    sourceOfTruth: {
      currentAuthority: preflight.currentAuthority,
      authoritativeFilesAndDocs: AUTHORITATIVE_FILES_AND_DOCS.map((entry) => path.normalize(entry)),
      currentChangedFiles: changedPaths.slice(0, CHANGED_PATH_LIMIT),
    },
    staleOrHistoricalContextToAvoid,
    nextRecommendedAction,
    planningWarnings,
    combinedReliabilityWarnings,
    sequentialPlanningHints,
    planBeforeExecuteGuards,
    longRunBudgetWarnings,
    resetCompactHandoffRecommendations,
    authoritativeResumePacket,
    blockers,
  };
}
