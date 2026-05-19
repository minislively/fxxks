export const RUNTIME_TOKEN_COST_PLANNING_WARNING_SCHEMA_VERSION = 1;
export const RUNTIME_TOKEN_COST_PLANNING_WARNING_ISSUE = "#960";
export const RUNTIME_TOKEN_COST_PLANNING_WARNING_FOLLOWUP_ISSUE = "#976";
export const RUNTIME_TOKEN_COST_PLANNING_WARNING_SOURCE = "deterministic runtime/token-cost planning advisory";
export const RUNTIME_TOKEN_COST_PLANNING_WARNING_CLAIM_BOUNDARY =
  "Advisory planning warning only for issues #960/#976; does not change provider/runtime hooks, real billing/token accounting, merge-gate policy, frontend behavior, or product claims.";

export type RuntimeTokenCostPlanningWarningIssue =
  | typeof RUNTIME_TOKEN_COST_PLANNING_WARNING_ISSUE
  | typeof RUNTIME_TOKEN_COST_PLANNING_WARNING_FOLLOWUP_ISSUE;

export type RuntimeTokenCostPlanningWarningTrigger =
  | "branch-issue-960"
  | "linked-issue-960"
  | "branch-issue-976"
  | "linked-issue-976";

export type RuntimeTokenCostPlanningWarning = {
  schemaVersion: typeof RUNTIME_TOKEN_COST_PLANNING_WARNING_SCHEMA_VERSION;
  issue: RuntimeTokenCostPlanningWarningIssue;
  status: "advisory";
  source: typeof RUNTIME_TOKEN_COST_PLANNING_WARNING_SOURCE;
  trigger: RuntimeTokenCostPlanningWarningTrigger;
  prerequisiteIssues: ["#961", "#962", "#963"];
  message: string;
  requiredRechecks: string[];
  forbiddenClaims: string[];
  claimBoundary: typeof RUNTIME_TOKEN_COST_PLANNING_WARNING_CLAIM_BOUNDARY;
};

function inferredIssueNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:^|[-_/])(?:issue|issues|gh)[-_/]?(\d+)(?:\D|$)/iu) ?? value.match(/#(\d+)\b/u);
  if (!match) return undefined;
  const issue = Number(match[1]);
  return Number.isInteger(issue) && issue > 0 ? issue : undefined;
}

export function buildRuntimeTokenCostPlanningWarnings(input: {
  branch?: string;
  linkedIssueNumber?: number;
}): RuntimeTokenCostPlanningWarning[] {
  const branchIssueNumber = inferredIssueNumber(input.branch);
  const issueNumber = input.linkedIssueNumber === 960 || input.linkedIssueNumber === 976
    ? input.linkedIssueNumber
    : branchIssueNumber === 960 || branchIssueNumber === 976
      ? branchIssueNumber
      : undefined;
  const trigger: RuntimeTokenCostPlanningWarningTrigger | undefined = input.linkedIssueNumber === 960
    ? "linked-issue-960"
    : input.linkedIssueNumber === 976
      ? "linked-issue-976"
      : branchIssueNumber === 960
        ? "branch-issue-960"
        : branchIssueNumber === 976
          ? "branch-issue-976"
          : undefined;

  if (!trigger) return [];

  const issue: RuntimeTokenCostPlanningWarningIssue = issueNumber === 976
    ? RUNTIME_TOKEN_COST_PLANNING_WARNING_FOLLOWUP_ISSUE
    : RUNTIME_TOKEN_COST_PLANNING_WARNING_ISSUE;
  const message = issueNumber === 976
    ? "Issue #976 long AI coding runs should pause for an explicit plan/checkpoint/compression or handoff review before context quality degrades; this is advisory runtime planning evidence only, not token billing telemetry."
    : "Issue #960 runtime/token-cost work must stay in planning/advisory mode unless current source-of-truth evidence confirms the #961 preflight, #962 stale-context, and #963 handoff contracts are already in place.";

  return [
    {
      schemaVersion: RUNTIME_TOKEN_COST_PLANNING_WARNING_SCHEMA_VERSION,
      issue,
      status: "advisory",
      source: RUNTIME_TOKEN_COST_PLANNING_WARNING_SOURCE,
      trigger,
      prerequisiteIssues: ["#961", "#962", "#963"],
      message,
      requiredRechecks: [
        "Run fooks check --json to inspect current operator/check authority.",
        "Run fooks preflight --json to inspect current preflight guidance.",
        "Run fooks handoff --json to inspect current source-of-truth handoff state before fresh-agent handoff.",
        "Use separate explicit implementation approval before changing provider/runtime hooks or token/cost accounting.",
      ],
      forbiddenClaims: [
        "provider usage/billing-token proof",
        "invoice/dashboard/charged-cost proof",
        "runtime-token savings proof",
        "merge-gate policy change",
        "frontend runtime behavior change",
      ],
      claimBoundary: RUNTIME_TOKEN_COST_PLANNING_WARNING_CLAIM_BOUNDARY,
    },
  ];
}
