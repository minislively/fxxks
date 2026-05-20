import type { OperatorContextTrustEntry } from "./context-trust";
import type { RuntimeTokenCostPlanningWarning } from "./runtime-token-cost-planning-warning";

export const COMBINED_RELIABILITY_WARNING_SCHEMA_VERSION = 1;
export const COMBINED_RELIABILITY_WARNING_SOURCE = "deterministic combined context/runtime reliability advisory";
export const COMBINED_RELIABILITY_WARNING_CLAIM_BOUNDARY =
  "Advisory-only overlap warning for issue #978: combines existing contextTrust/source-of-truth stale or non-authorizing evidence with existing runtime planning warnings; it does not add telemetry, change provider/runtime hooks, token/cost accounting, merge-gate policy, product claims, or frontend behavior.";

export type CombinedReliabilityWarningContextRisk = Pick<
  OperatorContextTrustEntry,
  "kind" | "source" | "reason" | "referenceField" | "contractScope" | "authority" | "count" | "live"
>;

export type CombinedReliabilityWarning = {
  schemaVersion: typeof COMBINED_RELIABILITY_WARNING_SCHEMA_VERSION;
  status: "advisory";
  source: typeof COMBINED_RELIABILITY_WARNING_SOURCE;
  trigger: "context-risk-and-runtime-planning-overlap";
  message: string;
  recommendedActions: Array<"reset-context" | "compress-current-source-of-truth" | "handoff-to-fresh-agent">;
  requiredOverlap: {
    contextRisk: CombinedReliabilityWarningContextRisk[];
    runtimePlanning: RuntimeTokenCostPlanningWarning[];
  };
  requiredRechecks: string[];
  forbiddenClaims: string[];
  claimBoundary: typeof COMBINED_RELIABILITY_WARNING_CLAIM_BOUNDARY;
};

function contextRiskRef(entry: OperatorContextTrustEntry): CombinedReliabilityWarningContextRisk {
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

function isContextOrStaleRisk(entry: OperatorContextTrustEntry): boolean {
  return entry.contractScope === "stale-residue-boundary"
    || entry.contractScope === "cleanup-review-boundary"
    || entry.contractScope === "main-echo-boundary"
    || entry.contractScope === "post-merge-receipt"
    || entry.kind.includes("stale")
    || entry.kind.includes("historical")
    || entry.authority === "receipt"
    || entry.authority === "insufficient";
}

export function buildCombinedReliabilityWarnings(input: {
  contextTrust: {
    nonAuthorizing: OperatorContextTrustEntry[];
    historicalOnly: OperatorContextTrustEntry[];
  };
  planningWarnings: RuntimeTokenCostPlanningWarning[];
}): CombinedReliabilityWarning[] {
  if (input.planningWarnings.length === 0) return [];

  const contextRisk = [...input.contextTrust.nonAuthorizing, ...input.contextTrust.historicalOnly]
    .filter(isContextOrStaleRisk)
    .map(contextRiskRef);
  if (contextRisk.length === 0) return [];

  return [
    {
      schemaVersion: COMBINED_RELIABILITY_WARNING_SCHEMA_VERSION,
      status: "advisory",
      source: COMBINED_RELIABILITY_WARNING_SOURCE,
      trigger: "context-risk-and-runtime-planning-overlap",
      message:
        "Context/stale-risk evidence overlaps runtime-planning advisory evidence; pause before continuing and either reset context, compress only verified current source-of-truth, or hand off to a fresh agent with current check/preflight/handoff output.",
      recommendedActions: ["reset-context", "compress-current-source-of-truth", "handoff-to-fresh-agent"],
      requiredOverlap: {
        contextRisk,
        runtimePlanning: input.planningWarnings,
      },
      requiredRechecks: [
        "Run fooks check --json to re-read current contextTrust authority and non-authorizing evidence.",
        "Run fooks preflight --json to confirm current recommended action before continuing.",
        "Run fooks handoff --json before fresh-agent handoff or context compression.",
        "Run fooks stale-context --stdin --json on any pasted prompt/handoff text before treating it as current authority.",
      ],
      forbiddenClaims: [
        "provider usage/billing-token proof",
        "invoice/dashboard/charged-cost proof",
        "runtime-token savings proof",
        "automatic stale-context validation beyond supplied/current surfaces",
        "merge-gate policy change",
        "frontend runtime behavior change",
      ],
      claimBoundary: COMBINED_RELIABILITY_WARNING_CLAIM_BOUNDARY,
    },
  ];
}
