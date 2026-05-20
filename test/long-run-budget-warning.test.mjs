import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const {
  LONG_RUN_BUDGET_WARNING_CLAIM_BOUNDARY,
  buildLongRunBudgetWarnings,
} = require(path.join(repoRoot, "dist", "ops", "long-run-budget-warning.js"));
const { buildRuntimeTokenCostPlanningWarnings } = require(path.join(repoRoot, "dist", "ops", "runtime-token-cost-planning-warning.js"));
const { buildCombinedReliabilityWarnings } = require(path.join(repoRoot, "dist", "ops", "combined-reliability-warning.js"));
const { buildSequentialPlanningHints } = require(path.join(repoRoot, "dist", "ops", "sequential-planning-hint.js"));
const { buildPlanBeforeExecuteGuards } = require(path.join(repoRoot, "dist", "ops", "plan-before-execute-guard.js"));

const staleContextTrust = {
  nonAuthorizing: [
    {
      kind: "stale-residue-active-boundary",
      source: "synthetic stale residue",
      reason: "cleanup-review only",
      contractScope: "stale-residue-boundary",
      authority: "insufficient",
    },
  ],
  historicalOnly: [],
};

test("long-run budget warning appears for bounded high-risk long-run planning inputs", () => {
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch: "fooks-issue-976-runtime-planning-warning" });
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust: { nonAuthorizing: [], historicalOnly: [] }, planningWarnings });
  const sequentialPlanningHints = buildSequentialPlanningHints({ branch: "fooks-issue-976-runtime-planning-warning", planningWarnings, combinedReliabilityWarnings });
  const planBeforeExecuteGuards = buildPlanBeforeExecuteGuards({ branch: "fooks-issue-976-runtime-planning-warning", planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints });

  const warnings = buildLongRunBudgetWarnings({ planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints, planBeforeExecuteGuards });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].issue, "#988");
  assert.equal(warnings[0].epic, "#960");
  assert.equal(warnings[0].status, "advisory");
  assert.equal(warnings[0].riskLevel, "high");
  assert.equal(warnings[0].budgetBoundary, "long-context-window-risk");
  assert.equal(warnings[0].trigger, "plan-before-execute-stop-with-runtime-planning");
  assert.ok(warnings[0].recommendedActions.includes("compress-current-source-of-truth"));
  assert.ok(warnings[0].recommendedActions.includes("handoff-to-fresh-agent"));
  assert.match(warnings[0].message, /pause before another long context window/);
  assert.deepEqual(warnings[0].derivedFrom, {
    planningWarningCount: 1,
    combinedReliabilityWarningCount: 0,
    sequentialPlanningHintCount: 0,
    planBeforeExecuteGuardCount: 1,
    stopBeforeMoreExecution: true,
    planningWarningsField: "planningWarnings",
    combinedReliabilityWarningsField: "combinedReliabilityWarnings",
    sequentialPlanningHintsField: "sequentialPlanningHints",
    planBeforeExecuteGuardsField: "planBeforeExecuteGuards",
    compactResumePacketField: "authoritativeResumePacket.reliabilityBoundary",
  });
  assert.match(warnings[0].claimBoundary, /Advisory\/read-only long-run budget warning/);
  assert.match(warnings[0].claimBoundary, /not provider billing\/token\/runtime proof/);
  assert.match(warnings[0].forbiddenClaims.join("\n"), /autonomous CI\/merge authority/);
  assert.match(warnings[0].forbiddenClaims.join("\n"), /frontend runtime behavior change/);
});

test("long-run budget warning can derive from stale reliability overlap plus stop guard", () => {
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch: "fooks-issue-960-runtime-token-cost-plan" });
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust: staleContextTrust, planningWarnings });
  const sequentialPlanningHints = buildSequentialPlanningHints({ branch: "fooks-issue-960-runtime-token-cost-plan", planningWarnings, combinedReliabilityWarnings });
  const planBeforeExecuteGuards = buildPlanBeforeExecuteGuards({ branch: "fooks-issue-960-runtime-token-cost-plan", planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints });

  const warnings = buildLongRunBudgetWarnings({ planningWarnings, combinedReliabilityWarnings, sequentialPlanningHints, planBeforeExecuteGuards });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].trigger, "plan-before-execute-stop-with-combined-reliability");
  assert.equal(warnings[0].derivedFrom.combinedReliabilityWarningCount, 1);
  assert.equal(warnings[0].derivedFrom.sequentialPlanningHintCount, 1);
  assert.equal(warnings[0].derivedFrom.stopBeforeMoreExecution, true);
});

test("long-run budget warning remains absent for ordinary non-risk boundaries", () => {
  const warnings = buildLongRunBudgetWarnings({
    planningWarnings: [],
    combinedReliabilityWarnings: [],
    sequentialPlanningHints: [],
    planBeforeExecuteGuards: [],
  });

  assert.deepEqual(warnings, []);
  assert.match(LONG_RUN_BUDGET_WARNING_CLAIM_BOUNDARY, /not autonomous CI\/merge authority/);
  assert.match(LONG_RUN_BUDGET_WARNING_CLAIM_BOUNDARY, /not frontend behavior change/);
});
