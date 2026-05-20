import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const { buildRuntimeTokenCostPlanningWarnings } = require(path.join(repoRoot, "dist", "ops", "runtime-token-cost-planning-warning.js"));
const { buildCombinedReliabilityWarnings } = require(path.join(repoRoot, "dist", "ops", "combined-reliability-warning.js"));
const { buildSequentialPlanningHints } = require(path.join(repoRoot, "dist", "ops", "sequential-planning-hint.js"));
const { buildPlanBeforeExecuteGuards } = require(path.join(repoRoot, "dist", "ops", "plan-before-execute-guard.js"));
const { buildLongRunBudgetWarnings } = require(path.join(repoRoot, "dist", "ops", "long-run-budget-warning.js"));
const {
  RESET_COMPACT_HANDOFF_RECOMMENDATION_CLAIM_BOUNDARY,
  buildResetCompactHandoffRecommendations,
} = require(path.join(repoRoot, "dist", "ops", "reset-compact-handoff-recommendation.js"));

const contextTrust = {
  source: "fooks check --json operator-check projection",
  nonAuthorizing: [
    {
      kind: "stale-residue-active-boundary",
      source: "synthetic stale residue",
      reason: "cleanup-review only",
      referenceField: "activeWorkReceipts.staleResidueActiveBoundary",
      contractScope: "stale-residue-boundary",
      authority: "insufficient",
    },
  ],
  historicalOnly: [],
};

function highCostInputs() {
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch: "fooks-issue-976-runtime-planning-warning" });
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust, planningWarnings });
  const sequentialPlanningHints = buildSequentialPlanningHints({ branch: "fooks-issue-976-runtime-planning-warning", planningWarnings, combinedReliabilityWarnings });
  const planBeforeExecuteGuards = buildPlanBeforeExecuteGuards({ branch: "fooks-issue-976-runtime-planning-warning", planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints });
  const longRunBudgetWarnings = buildLongRunBudgetWarnings({ planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints, planBeforeExecuteGuards });
  return { combinedReliabilityWarnings, longRunBudgetWarnings };
}

test("reset/compact/handoff recommendation appears only for stale context plus high-cost pressure", () => {
  const { combinedReliabilityWarnings, longRunBudgetWarnings } = highCostInputs();
  const recommendations = buildResetCompactHandoffRecommendations({ contextTrust, combinedReliabilityWarnings, longRunBudgetWarnings });

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].issue, "#996");
  assert.equal(recommendations[0].epic, "#960");
  assert.equal(recommendations[0].status, "advisory");
  assert.equal(recommendations[0].riskLevel, "high");
  assert.equal(recommendations[0].trigger, "stale-context-and-high-cost-pressure");
  assert.deepEqual(recommendations[0].recommendedActions, ["reset-context", "compact-current-source-of-truth", "handoff-to-fresh-agent"]);
  assert.equal(recommendations[0].requiredOverlap.contextRisk[0].contractScope, "stale-residue-boundary");
  assert.equal(recommendations[0].requiredOverlap.combinedReliabilityWarningCount, 1);
  assert.equal(recommendations[0].requiredOverlap.longRunBudgetWarningCount, 1);
  assert.deepEqual(recommendations[0].derivedFrom, {
    contextTrustSource: contextTrust.source,
    contextTrustNonAuthorizingCount: 1,
    contextTrustHistoricalOnlyCount: 0,
    combinedReliabilityWarningsField: "combinedReliabilityWarnings",
    longRunBudgetWarningsField: "longRunBudgetWarnings",
  });
  assert.match(recommendations[0].message, /reset context, compact only current source-of-truth evidence, or hand off/);
  assert.match(recommendations[0].claimBoundary, /Advisory\/read-only reset, compact, or handoff recommendation/);
  assert.match(recommendations[0].claimBoundary, /not provider billing\/token\/runtime proof/);
  assert.match(recommendations[0].forbiddenClaims.join("\n"), /autonomous CI\/merge authority/);
  assert.match(recommendations[0].forbiddenClaims.join("\n"), /frontend runtime behavior change/);
});

test("reset/compact/handoff recommendation does not overwarn for low-risk inputs", () => {
  assert.deepEqual(buildResetCompactHandoffRecommendations({ contextTrust, combinedReliabilityWarnings: [], longRunBudgetWarnings: [] }), []);

  const { combinedReliabilityWarnings, longRunBudgetWarnings } = highCostInputs();
  assert.deepEqual(buildResetCompactHandoffRecommendations({
    contextTrust: { ...contextTrust, nonAuthorizing: [], historicalOnly: [] },
    combinedReliabilityWarnings,
    longRunBudgetWarnings,
  }), []);

  assert.deepEqual(buildResetCompactHandoffRecommendations({
    contextTrust,
    combinedReliabilityWarnings,
    longRunBudgetWarnings: [],
  }), []);
  assert.match(RESET_COMPACT_HANDOFF_RECOMMENDATION_CLAIM_BOUNDARY, /not autonomous CI\/merge authority/);
});
