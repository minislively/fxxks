export const RUNTIME_TOKEN_COST_PLANNING_WARNING_SCHEMA_VERSION = 1;
export const RUNTIME_TOKEN_COST_PLANNING_WARNING_ISSUE = "#960";
export const RUNTIME_TOKEN_COST_PLANNING_WARNING_SOURCE = "deterministic issue #960 runtime/token-cost planning advisory";
export const RUNTIME_TOKEN_COST_PLANNING_WARNING_CLAIM_BOUNDARY =
  "Advisory planning warning only for issue #960; does not change provider/runtime hooks, real billing/token accounting, merge-gate policy, frontend behavior, or product claims.";

export type RuntimeTokenCostPlanningWarningTrigger = "branch-issue-960" | "linked-issue-960";

export type RuntimeTokenCostPlanningWarning = {
  schemaVersion: typeof RUNTIME_TOKEN_COST_PLANNING_WARNING_SCHEMA_VERSION;
  issue: typeof RUNTIME_TOKEN_COST_PLANNING_WARNING_ISSUE;
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
  const trigger: RuntimeTokenCostPlanningWarningTrigger | undefined = input.linkedIssueNumber === 960
    ? "linked-issue-960"
    : inferredIssueNumber(input.branch) === 960
      ? "branch-issue-960"
      : undefined;

  if (!trigger) return [];

  return [
    {
      schemaVersion: RUNTIME_TOKEN_COST_PLANNING_WARNING_SCHEMA_VERSION,
      issue: RUNTIME_TOKEN_COST_PLANNING_WARNING_ISSUE,
      status: "advisory",
      source: RUNTIME_TOKEN_COST_PLANNING_WARNING_SOURCE,
      trigger,
      prerequisiteIssues: ["#961", "#962", "#963"],
      message: "Issue #960 runtime/token-cost work must stay in planning/advisory mode unless current source-of-truth evidence confirms the #961 preflight, #962 stale-context, and #963 handoff contracts are already in place.",
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
