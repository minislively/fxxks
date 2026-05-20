import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const {
  PLAN_BEFORE_EXECUTE_GUARD_CLAIM_BOUNDARY,
  buildPlanBeforeExecuteGuards,
} = require(path.join(repoRoot, "dist", "ops", "plan-before-execute-guard.js"));
const { buildRuntimeTokenCostPlanningWarnings } = require(path.join(repoRoot, "dist", "ops", "runtime-token-cost-planning-warning.js"));
const { buildCombinedReliabilityWarnings } = require(path.join(repoRoot, "dist", "ops", "combined-reliability-warning.js"));
const { buildSequentialPlanningHints } = require(path.join(repoRoot, "dist", "ops", "sequential-planning-hint.js"));

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

test("plan-before-execute guard stops long-run planning warnings before more execution", () => {
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch: "fooks-issue-976-runtime-planning-warning" });
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust: { nonAuthorizing: [], historicalOnly: [] }, planningWarnings });
  const sequentialPlanningHints = buildSequentialPlanningHints({ branch: "fooks-issue-976-runtime-planning-warning", planningWarnings, combinedReliabilityWarnings });

  const guards = buildPlanBeforeExecuteGuards({
    branch: "fooks-issue-976-runtime-planning-warning",
    planningWarnings,
    combinedReliabilityWarnings,
    sequentialPlanningHints,
  });

  assert.equal(guards.length, 1);
  assert.equal(guards[0].issue, "#984");
  assert.equal(guards[0].epic, "#960");
  assert.equal(guards[0].trigger, "long-run-planning-warning-present");
  assert.equal(guards[0].stopBeforeMoreExecution, true);
  assert.ok(guards[0].requiredBeforeContinuing.includes("write-or-refresh-bounded-plan"));
  assert.match(guards[0].message, /Stop before more execution/);
  assert.equal(guards[0].derivedFrom.planningWarningCount, 1);
  assert.equal(guards[0].derivedFrom.sequentialPlanningHintCount, 0);
  assert.match(guards[0].claimBoundary, /Advisory plan-before-execute guard only/);
  assert.match(guards[0].forbiddenClaims.join("\n"), /provider usage\/billing-token proof/);
  assert.match(guards[0].forbiddenClaims.join("\n"), /autonomous execution authority/);
  assert.match(guards[0].forbiddenClaims.join("\n"), /merge authority or merge-gate policy change/);
  assert.match(guards[0].forbiddenClaims.join("\n"), /frontend runtime behavior change/);
});

test("plan-before-execute guard uses sequential hint plus stale reliability overlap as deterministic stop advice", () => {
  const planningWarnings = buildRuntimeTokenCostPlanningWarnings({ branch: "fooks-issue-960-runtime-token-cost-plan" });
  const combinedReliabilityWarnings = buildCombinedReliabilityWarnings({ contextTrust: staleContextTrust, planningWarnings });
  const sequentialPlanningHints = buildSequentialPlanningHints({ branch: "fooks-issue-960-runtime-token-cost-plan", planningWarnings, combinedReliabilityWarnings });

  const guards = buildPlanBeforeExecuteGuards({
    branch: "fooks-issue-960-runtime-token-cost-plan",
    planningWarnings,
    combinedReliabilityWarnings,
    sequentialPlanningHints,
  });

  assert.equal(guards.length, 1);
  assert.equal(guards[0].trigger, "stale-reliability-overlap-with-sequential-hint");
  assert.equal(guards[0].derivedFrom.combinedReliabilityWarningCount, 1);
  assert.equal(guards[0].derivedFrom.sequentialPlanningHintCount, 1);
  assert.deepEqual(guards[0].derivedFrom, {
    planningWarningCount: 1,
    combinedReliabilityWarningCount: 1,
    sequentialPlanningHintCount: 1,
    planningWarningsField: "planningWarnings",
    combinedReliabilityWarningsField: "combinedReliabilityWarnings",
    sequentialPlanningHintsField: "sequentialPlanningHints",
  });
});

test("plan-before-execute guard remains absent for ordinary non-reliability handoffs", () => {
  const guards = buildPlanBeforeExecuteGuards({
    branch: "fooks-issue-963-source-of-truth-handoff",
    planningWarnings: [],
    combinedReliabilityWarnings: [],
    sequentialPlanningHints: [],
  });

  assert.deepEqual(guards, []);
  assert.match(PLAN_BEFORE_EXECUTE_GUARD_CLAIM_BOUNDARY, /not provider billing\/runtime proof/);
  assert.match(PLAN_BEFORE_EXECUTE_GUARD_CLAIM_BOUNDARY, /not frontend behavior change/);
});
