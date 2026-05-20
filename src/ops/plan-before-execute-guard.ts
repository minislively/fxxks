import type { CombinedReliabilityWarning } from "./combined-reliability-warning";
import type { RuntimeTokenCostPlanningWarning } from "./runtime-token-cost-planning-warning";
import type { SequentialPlanningHint } from "./sequential-planning-hint";

export const PLAN_BEFORE_EXECUTE_GUARD_SCHEMA_VERSION = 1;
export const PLAN_BEFORE_EXECUTE_GUARD_ISSUE = "#984";
export const PLAN_BEFORE_EXECUTE_GUARD_EPIC = "#960";
export const PLAN_BEFORE_EXECUTE_GUARD_SOURCE = "deterministic plan-before-execute advisory guard";
export const PLAN_BEFORE_EXECUTE_GUARD_CLAIM_BOUNDARY =
  "Advisory plan-before-execute guard only for issue #984 under epic #960; stop-before-more-execution is a local operator recommendation, not provider billing/runtime proof, not provider/runtime hook behavior, not autonomous execution or merge authority, not CI or merge-gate enforcement, not product support expansion, and not frontend behavior change.";

export type PlanBeforeExecuteGuardTrigger =
  | "branch-issue-984"
  | "linked-issue-984"
  | "long-run-planning-warning-present"
  | "stale-reliability-overlap-with-sequential-hint";

export type PlanBeforeExecuteGuardRequiredStep =
  | "stop-before-more-execution"
  | "write-or-refresh-bounded-plan"
  | "split-long-run-into-verifiable-steps"
  | "recheck-current-authority"
  | "handoff-or-compress-current-source-of-truth";

export type PlanBeforeExecuteGuard = {
  schemaVersion: typeof PLAN_BEFORE_EXECUTE_GUARD_SCHEMA_VERSION;
  issue: typeof PLAN_BEFORE_EXECUTE_GUARD_ISSUE;
  epic: typeof PLAN_BEFORE_EXECUTE_GUARD_EPIC;
  status: "advisory";
  source: typeof PLAN_BEFORE_EXECUTE_GUARD_SOURCE;
  trigger: PlanBeforeExecuteGuardTrigger;
  stopBeforeMoreExecution: true;
  message: string;
  reasons: string[];
  requiredBeforeContinuing: PlanBeforeExecuteGuardRequiredStep[];
  requiredRechecks: string[];
  forbiddenClaims: string[];
  claimBoundary: typeof PLAN_BEFORE_EXECUTE_GUARD_CLAIM_BOUNDARY;
  derivedFrom: {
    planningWarningCount: number;
    combinedReliabilityWarningCount: number;
    sequentialPlanningHintCount: number;
    planningWarningsField: "planningWarnings";
    combinedReliabilityWarningsField: "combinedReliabilityWarnings";
    sequentialPlanningHintsField: "sequentialPlanningHints";
  };
};

function inferredIssueNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:^|[-_/])(?:issue|issues|gh)[-_/]?(\d+)(?:\D|$)/iu) ?? value.match(/#(\d+)\b/u);
  if (!match) return undefined;
  const issue = Number(match[1]);
  return Number.isInteger(issue) && issue > 0 ? issue : undefined;
}

function chooseTrigger(input: {
  branch?: string;
  linkedIssueNumber?: number;
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  sequentialPlanningHints: SequentialPlanningHint[];
}): PlanBeforeExecuteGuardTrigger | undefined {
  const branchIssueNumber = inferredIssueNumber(input.branch);
  if (input.linkedIssueNumber === 984) return "linked-issue-984";
  if (branchIssueNumber === 984) return "branch-issue-984";

  const hasLongRunWarning = input.planningWarnings.some((warning) => warning.issue === "#976");
  if (hasLongRunWarning) return "long-run-planning-warning-present";

  const hasStaleSequentialOverlap = input.combinedReliabilityWarnings.length > 0 && input.sequentialPlanningHints.length > 0;
  if (hasStaleSequentialOverlap) return "stale-reliability-overlap-with-sequential-hint";

  return undefined;
}

export function buildPlanBeforeExecuteGuards(input: {
  branch?: string;
  linkedIssueNumber?: number;
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  sequentialPlanningHints: SequentialPlanningHint[];
}): PlanBeforeExecuteGuard[] {
  const trigger = chooseTrigger(input);
  if (!trigger) return [];

  const reasons = trigger === "long-run-planning-warning-present"
    ? [
        "issue #976 long-run planning warning is present",
        "long reliability runs should stop for a bounded plan before more execution",
      ]
    : trigger === "stale-reliability-overlap-with-sequential-hint"
      ? [
          "combined reliability warning reports stale/context risk overlapping runtime-planning risk",
          "sequential-planning hint is already present, so continuing without a plan risks stale execution",
        ]
      : [
          "current branch or linked issue targets issue #984 plan-before-execute guard work",
          "this surface proves only deterministic advisory guard projection and must stay bounded",
        ];

  return [
    {
      schemaVersion: PLAN_BEFORE_EXECUTE_GUARD_SCHEMA_VERSION,
      issue: PLAN_BEFORE_EXECUTE_GUARD_ISSUE,
      epic: PLAN_BEFORE_EXECUTE_GUARD_EPIC,
      status: "advisory",
      source: PLAN_BEFORE_EXECUTE_GUARD_SOURCE,
      trigger,
      stopBeforeMoreExecution: true,
      message:
        "Stop before more execution on long or stale reliability runs: write or refresh a bounded plan, split the next run into verifiable steps, recheck current authority, and hand off or compress only current source-of-truth evidence before continuing.",
      reasons,
      requiredBeforeContinuing: [
        "stop-before-more-execution",
        "write-or-refresh-bounded-plan",
        "split-long-run-into-verifiable-steps",
        "recheck-current-authority",
        "handoff-or-compress-current-source-of-truth",
      ],
      requiredRechecks: [
        "Run fooks check --json to inspect current operator/check authority and advisory guard fields.",
        "Run fooks preflight --json before deciding whether to continue, split, or stop.",
        "Run fooks handoff --json before compressing context or handing work to a fresh agent.",
        "Treat stopBeforeMoreExecution as advisory operator guidance, not CI, merge, provider, runtime, or frontend enforcement.",
      ],
      forbiddenClaims: [
        "provider usage/billing-token proof",
        "invoice/dashboard/charged-cost proof",
        "runtime-token savings proof",
        "provider/runtime hook behavior change",
        "autonomous execution authority",
        "merge authority or merge-gate policy change",
        "CI enforcement or blocking merge policy",
        "runtime/provider support expansion",
        "frontend runtime behavior change",
      ],
      claimBoundary: PLAN_BEFORE_EXECUTE_GUARD_CLAIM_BOUNDARY,
      derivedFrom: {
        planningWarningCount: input.planningWarnings.length,
        combinedReliabilityWarningCount: input.combinedReliabilityWarnings.length,
        sequentialPlanningHintCount: input.sequentialPlanningHints.length,
        planningWarningsField: "planningWarnings",
        combinedReliabilityWarningsField: "combinedReliabilityWarnings",
        sequentialPlanningHintsField: "sequentialPlanningHints",
      },
    },
  ];
}
