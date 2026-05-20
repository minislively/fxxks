import type { CombinedReliabilityWarning } from "./combined-reliability-warning";
import type { PlanBeforeExecuteGuard } from "./plan-before-execute-guard";
import type { RuntimeTokenCostPlanningWarning } from "./runtime-token-cost-planning-warning";
import type { SequentialPlanningHint } from "./sequential-planning-hint";

export const LONG_RUN_BUDGET_WARNING_SCHEMA_VERSION = 1;
export const LONG_RUN_BUDGET_WARNING_ISSUE = "#988";
export const LONG_RUN_BUDGET_WARNING_EPIC = "#960";
export const LONG_RUN_BUDGET_WARNING_SOURCE = "deterministic long-run budget advisory";
export const LONG_RUN_BUDGET_WARNING_CLAIM_BOUNDARY =
  "Advisory/read-only long-run budget warning only for issue #988 under epic #960; derived from existing runtime planning, combined reliability, sequential-planning, plan-before-execute, and compact resume packet fields, not provider billing/token/runtime proof, not autonomous CI/merge authority, not provider/runtime hook behavior, not product support expansion, and not frontend behavior change.";

export type LongRunBudgetWarningTrigger =
  | "plan-before-execute-stop-with-runtime-planning"
  | "plan-before-execute-stop-with-combined-reliability"
  | "plan-before-execute-stop-with-sequential-planning";

export type LongRunBudgetRiskLevel = "high";

export type LongRunBudgetWarningAction =
  | "pause-before-next-long-run"
  | "refresh-bounded-plan"
  | "compress-current-source-of-truth"
  | "handoff-to-fresh-agent";

export type LongRunBudgetWarning = {
  schemaVersion: typeof LONG_RUN_BUDGET_WARNING_SCHEMA_VERSION;
  issue: typeof LONG_RUN_BUDGET_WARNING_ISSUE;
  epic: typeof LONG_RUN_BUDGET_WARNING_EPIC;
  status: "advisory";
  source: typeof LONG_RUN_BUDGET_WARNING_SOURCE;
  trigger: LongRunBudgetWarningTrigger;
  riskLevel: LongRunBudgetRiskLevel;
  budgetBoundary: "long-context-window-risk";
  message: string;
  recommendedActions: LongRunBudgetWarningAction[];
  requiredRechecks: string[];
  forbiddenClaims: string[];
  claimBoundary: typeof LONG_RUN_BUDGET_WARNING_CLAIM_BOUNDARY;
  derivedFrom: {
    planningWarningCount: number;
    combinedReliabilityWarningCount: number;
    sequentialPlanningHintCount: number;
    planBeforeExecuteGuardCount: number;
    stopBeforeMoreExecution: true;
    planningWarningsField: "planningWarnings";
    combinedReliabilityWarningsField: "combinedReliabilityWarnings";
    sequentialPlanningHintsField: "sequentialPlanningHints";
    planBeforeExecuteGuardsField: "planBeforeExecuteGuards";
    compactResumePacketField: "authoritativeResumePacket.reliabilityBoundary";
  };
};

function chooseTrigger(input: {
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  sequentialPlanningHints: SequentialPlanningHint[];
  planBeforeExecuteGuards: PlanBeforeExecuteGuard[];
}): LongRunBudgetWarningTrigger | undefined {
  const stopBeforeMoreExecution = input.planBeforeExecuteGuards.some((guard) => guard.stopBeforeMoreExecution);
  if (!stopBeforeMoreExecution) return undefined;

  const hasRuntimePlanningStop = input.planBeforeExecuteGuards.some((guard) => guard.trigger === "long-run-planning-warning-present")
    && input.planningWarnings.length > 0;
  if (hasRuntimePlanningStop) return "plan-before-execute-stop-with-runtime-planning";

  if (input.combinedReliabilityWarnings.length > 0) return "plan-before-execute-stop-with-combined-reliability";
  if (input.sequentialPlanningHints.length > 0) return "plan-before-execute-stop-with-sequential-planning";

  return undefined;
}

export function buildLongRunBudgetWarnings(input: {
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  sequentialPlanningHints: SequentialPlanningHint[];
  planBeforeExecuteGuards: PlanBeforeExecuteGuard[];
}): LongRunBudgetWarning[] {
  const trigger = chooseTrigger(input);
  if (!trigger) return [];

  return [
    {
      schemaVersion: LONG_RUN_BUDGET_WARNING_SCHEMA_VERSION,
      issue: LONG_RUN_BUDGET_WARNING_ISSUE,
      epic: LONG_RUN_BUDGET_WARNING_EPIC,
      status: "advisory",
      source: LONG_RUN_BUDGET_WARNING_SOURCE,
      trigger,
      riskLevel: "high",
      budgetBoundary: "long-context-window-risk",
      message:
        "Long-run budget risk is high enough to pause before another long context window: refresh a bounded plan, compress current source-of-truth evidence, or hand off to a fresh agent before continuing.",
      recommendedActions: [
        "pause-before-next-long-run",
        "refresh-bounded-plan",
        "compress-current-source-of-truth",
        "handoff-to-fresh-agent",
      ],
      requiredRechecks: [
        "Run fooks check --json to inspect current advisory warning fields.",
        "Run fooks preflight --json before deciding whether to continue normally, split work, compress, or hand off.",
        "Run fooks handoff --json before context compression or fresh-agent handoff.",
        "Treat this warning as a deterministic budget-risk boundary only, not token, billing, runtime, CI, merge, or frontend proof.",
      ],
      forbiddenClaims: [
        "provider usage/billing-token proof",
        "invoice/dashboard/charged-cost proof",
        "runtime-token savings proof",
        "provider/runtime hook behavior change",
        "autonomous CI/merge authority",
        "merge authority or merge-gate policy change",
        "runtime/provider support expansion",
        "frontend runtime behavior change",
      ],
      claimBoundary: LONG_RUN_BUDGET_WARNING_CLAIM_BOUNDARY,
      derivedFrom: {
        planningWarningCount: input.planningWarnings.length,
        combinedReliabilityWarningCount: input.combinedReliabilityWarnings.length,
        sequentialPlanningHintCount: input.sequentialPlanningHints.length,
        planBeforeExecuteGuardCount: input.planBeforeExecuteGuards.length,
        stopBeforeMoreExecution: true,
        planningWarningsField: "planningWarnings",
        combinedReliabilityWarningsField: "combinedReliabilityWarnings",
        sequentialPlanningHintsField: "sequentialPlanningHints",
        planBeforeExecuteGuardsField: "planBeforeExecuteGuards",
        compactResumePacketField: "authoritativeResumePacket.reliabilityBoundary",
      },
    },
  ];
}
