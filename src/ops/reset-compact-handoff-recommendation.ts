import type { OperatorContextTrustEntry, OperatorContextTrustPacket } from "./context-trust";
import type { CombinedReliabilityWarning } from "./combined-reliability-warning";
import type { LongRunBudgetWarning } from "./long-run-budget-warning";

export const RESET_COMPACT_HANDOFF_RECOMMENDATION_SCHEMA_VERSION = 1;
export const RESET_COMPACT_HANDOFF_RECOMMENDATION_ISSUE = "#996";
export const RESET_COMPACT_HANDOFF_RECOMMENDATION_EPIC = "#960";
export const RESET_COMPACT_HANDOFF_RECOMMENDATION_SOURCE = "deterministic reset/compact/handoff advisory";
export const RESET_COMPACT_HANDOFF_RECOMMENDATION_CLAIM_BOUNDARY =
  "Advisory/read-only reset, compact, or handoff recommendation for issue #996 under epic #960; derived only from existing contextTrust/source-of-truth, combined reliability, and long-run budget warning fields, not provider billing/token/runtime proof, not autonomous CI/merge authority, not provider/runtime hook behavior, not product support expansion, and not frontend behavior change.";

export type ResetCompactHandoffRecommendationAction =
  | "reset-context"
  | "compact-current-source-of-truth"
  | "handoff-to-fresh-agent";

export type ResetCompactHandoffRecommendationContextRisk = Pick<
  OperatorContextTrustEntry,
  "kind" | "source" | "reason" | "referenceField" | "contractScope" | "authority" | "count" | "live"
>;

export type ResetCompactHandoffRecommendation = {
  schemaVersion: typeof RESET_COMPACT_HANDOFF_RECOMMENDATION_SCHEMA_VERSION;
  issue: typeof RESET_COMPACT_HANDOFF_RECOMMENDATION_ISSUE;
  epic: typeof RESET_COMPACT_HANDOFF_RECOMMENDATION_EPIC;
  status: "advisory";
  source: typeof RESET_COMPACT_HANDOFF_RECOMMENDATION_SOURCE;
  trigger: "stale-context-and-high-cost-pressure";
  riskLevel: "high";
  message: string;
  recommendedActions: ResetCompactHandoffRecommendationAction[];
  requiredOverlap: {
    contextRisk: ResetCompactHandoffRecommendationContextRisk[];
    combinedReliabilityWarningCount: number;
    longRunBudgetWarningCount: number;
  };
  requiredRechecks: string[];
  forbiddenClaims: string[];
  derivedFrom: {
    contextTrustSource: OperatorContextTrustPacket["source"];
    contextTrustNonAuthorizingCount: number;
    contextTrustHistoricalOnlyCount: number;
    combinedReliabilityWarningsField: "combinedReliabilityWarnings";
    longRunBudgetWarningsField: "longRunBudgetWarnings";
  };
  claimBoundary: typeof RESET_COMPACT_HANDOFF_RECOMMENDATION_CLAIM_BOUNDARY;
};

function contextRiskRef(entry: OperatorContextTrustEntry): ResetCompactHandoffRecommendationContextRisk {
  return {
    kind: entry.kind,
    source: entry.source,
    reason: entry.reason,
    ...(entry.referenceField ? { referenceField: entry.referenceField } : {}),
    contractScope: entry.contractScope,
    ...(entry.authority ? { authority: entry.authority } : {}),
    ...(entry.count !== undefined ? { count: entry.count } : {}),
    ...(entry.live !== undefined ? { live: entry.live } : {}),
  };
}

export function buildResetCompactHandoffRecommendations(input: {
  contextTrust: Pick<OperatorContextTrustPacket, "source" | "nonAuthorizing" | "historicalOnly">;
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
  longRunBudgetWarnings: LongRunBudgetWarning[];
}): ResetCompactHandoffRecommendation[] {
  const highCostWarnings = input.longRunBudgetWarnings.filter((warning) => warning.riskLevel === "high");
  if (input.combinedReliabilityWarnings.length === 0 || highCostWarnings.length === 0) return [];

  const contextRisk = [...input.contextTrust.nonAuthorizing, ...input.contextTrust.historicalOnly].map(contextRiskRef);
  if (contextRisk.length === 0) return [];

  return [
    {
      schemaVersion: RESET_COMPACT_HANDOFF_RECOMMENDATION_SCHEMA_VERSION,
      issue: RESET_COMPACT_HANDOFF_RECOMMENDATION_ISSUE,
      epic: RESET_COMPACT_HANDOFF_RECOMMENDATION_EPIC,
      status: "advisory",
      source: RESET_COMPACT_HANDOFF_RECOMMENDATION_SOURCE,
      trigger: "stale-context-and-high-cost-pressure",
      riskLevel: "high",
      message:
        "Stale/non-authorizing context evidence overlaps high long-run budget pressure; before continuing, reset context, compact only current source-of-truth evidence, or hand off to a fresh agent with current check/preflight/handoff output.",
      recommendedActions: ["reset-context", "compact-current-source-of-truth", "handoff-to-fresh-agent"],
      requiredOverlap: {
        contextRisk,
        combinedReliabilityWarningCount: input.combinedReliabilityWarnings.length,
        longRunBudgetWarningCount: highCostWarnings.length,
      },
      requiredRechecks: [
        "Run fooks check --json to re-read contextTrust current authority and stale/non-authorizing boundaries.",
        "Run fooks preflight --json before deciding to continue, reset, compact, or hand off.",
        "Run fooks handoff --json before context compression or fresh-agent handoff.",
        "Run fooks stale-context --stdin --json on pasted prompt or handoff text before treating it as current authority.",
      ],
      forbiddenClaims: [
        "provider usage/billing-token proof",
        "invoice/dashboard/charged-cost proof",
        "runtime-token savings proof",
        "provider/runtime hook behavior change",
        "autonomous CI/merge authority",
        "merge-gate policy change",
        "runtime/provider support expansion",
        "frontend runtime behavior change",
      ],
      derivedFrom: {
        contextTrustSource: input.contextTrust.source,
        contextTrustNonAuthorizingCount: input.contextTrust.nonAuthorizing.length,
        contextTrustHistoricalOnlyCount: input.contextTrust.historicalOnly.length,
        combinedReliabilityWarningsField: "combinedReliabilityWarnings",
        longRunBudgetWarningsField: "longRunBudgetWarnings",
      },
      claimBoundary: RESET_COMPACT_HANDOFF_RECOMMENDATION_CLAIM_BOUNDARY,
    },
  ];
}
