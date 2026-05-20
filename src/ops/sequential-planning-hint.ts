import type { CombinedReliabilityWarning } from "./combined-reliability-warning";
import type { RuntimeTokenCostPlanningWarning } from "./runtime-token-cost-planning-warning";

export const SEQUENTIAL_PLANNING_HINT_SCHEMA_VERSION = 1;
export const SEQUENTIAL_PLANNING_HINT_ISSUE = "#982";
export const SEQUENTIAL_PLANNING_HINT_SOURCE = "deterministic sequential planning advisory";
export const SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY =
  "Advisory sequential-planning hint only for issue #982 under epic #960; does not prove provider billing/runtime token usage, change provider/runtime hooks, grant autonomous execution or merge authority, alter merge-gate policy, expand runtime/provider support, product claims, or frontend behavior.";

export type SequentialPlanningHintTrigger =
  | "branch-issue-982"
  | "linked-issue-982"
  | "combined-reliability-warning-present";

export type SequentialPlanningHintRecommendation =
  | "write-plan-before-execute"
  | "split-long-work-into-bounded-steps"
  | "checkpoint-or-compress-current-source-of-truth"
  | "handoff-before-burning-another-context-window";

export type SequentialPlanningHint = {
  schemaVersion: typeof SEQUENTIAL_PLANNING_HINT_SCHEMA_VERSION;
  issue: typeof SEQUENTIAL_PLANNING_HINT_ISSUE;
  status: "advisory";
  source: typeof SEQUENTIAL_PLANNING_HINT_SOURCE;
  trigger: SequentialPlanningHintTrigger;
  message: string;
  reasons: string[];
  recommendations: SequentialPlanningHintRecommendation[];
  requiredRechecks: string[];
  forbiddenClaims: string[];
  claimBoundary: typeof SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY;
  derivedFrom: {
    planningWarningCount: number;
    combinedReliabilityWarningCount: number;
    planningWarningsField: "planningWarnings";
    combinedReliabilityWarningsField: "combinedReliabilityWarnings";
  };
};

function inferredIssueNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:^|[-_/])(?:issue|issues|gh)[-_/]?(\d+)(?:\D|$)/iu) ?? value.match(/#(\d+)\b/u);
  if (!match) return undefined;
  const issue = Number(match[1]);
  return Number.isInteger(issue) && issue > 0 ? issue : undefined;
}

export function buildSequentialPlanningHints(input: {
  branch?: string;
  linkedIssueNumber?: number;
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
}): SequentialPlanningHint[] {
  const branchIssueNumber = inferredIssueNumber(input.branch);
  const trigger: SequentialPlanningHintTrigger | undefined = input.linkedIssueNumber === 982
    ? "linked-issue-982"
    : branchIssueNumber === 982
      ? "branch-issue-982"
      : input.combinedReliabilityWarnings.length > 0
        ? "combined-reliability-warning-present"
        : undefined;

  if (!trigger) return [];

  const reasons = trigger === "combined-reliability-warning-present"
    ? [
        "combined reliability warning already reports overlapping stale/context risk and runtime-planning risk",
        "long or sequential follow-up work should plan before executing to avoid context drift",
      ]
    : [
        "current branch or linked issue targets issue #982 sequential-planning hint work",
        "next-agent handoff should include a deterministic plan-before-execute reminder for long or sequential runs",
      ];

  return [
    {
      schemaVersion: SEQUENTIAL_PLANNING_HINT_SCHEMA_VERSION,
      issue: SEQUENTIAL_PLANNING_HINT_ISSUE,
      status: "advisory",
      source: SEQUENTIAL_PLANNING_HINT_SOURCE,
      trigger,
      message:
        "Before another long or sequential coding run, write a bounded plan, split the work, checkpoint or compress current source-of-truth evidence, and hand off to a fresh agent when context quality is at risk.",
      reasons,
      recommendations: [
        "write-plan-before-execute",
        "split-long-work-into-bounded-steps",
        "checkpoint-or-compress-current-source-of-truth",
        "handoff-before-burning-another-context-window",
      ],
      requiredRechecks: [
        "Run fooks check --json to inspect current operator/check authority and warning surfaces.",
        "Run fooks preflight --json before deciding whether to continue, split, or stop.",
        "Run fooks handoff --json before compressing context or handing work to a fresh agent.",
        "Keep implementation authority tied to a current issue, PR, branch, session, or explicit blocker.",
      ],
      forbiddenClaims: [
        "provider usage/billing-token proof",
        "invoice/dashboard/charged-cost proof",
        "runtime-token savings proof",
        "autonomous execution authority",
        "merge authority or merge-gate policy change",
        "runtime/provider support expansion",
        "frontend runtime behavior change",
      ],
      claimBoundary: SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY,
      derivedFrom: {
        planningWarningCount: input.planningWarnings.length,
        combinedReliabilityWarningCount: input.combinedReliabilityWarnings.length,
        planningWarningsField: "planningWarnings",
        combinedReliabilityWarningsField: "combinedReliabilityWarnings",
      },
    },
  ];
}
