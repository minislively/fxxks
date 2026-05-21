import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const { decidePreflightAdvisoryIntent } = require(path.join(repoRoot, "dist", "ops", "preflight-advisory-intent.js"));

function assertShape(decision) {
  assert.equal(typeof decision.shouldAttach, "boolean");
  assert.ok(["low", "medium", "high"].includes(decision.confidence));
  assert.ok(["implementation", "debugging", "test", "review-pr", "continuation", "question", "research", "unknown"].includes(decision.category));
  assert.equal(typeof decision.score, "number");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(Array.isArray(decision.skipReasons));
}

test("preflight advisory intent skips pure question and research prompts without work anchors", () => {
  const question = decidePreflightAdvisoryIntent({ prompt: "리팩토링이 뭐야?" });
  assertShape(question);
  assert.equal(question.shouldAttach, false);
  assert.equal(question.category, "question");
  assert.ok(question.skipReasons.includes("pure-question"));

  const research = decidePreflightAdvisoryIntent({ prompt: "Research better approaches for prompt routing" });
  assertShape(research);
  assert.equal(research.shouldAttach, false);
  assert.equal(research.category, "research");
  assert.ok(research.skipReasons.includes("research-without-work-anchor"));
});

test("preflight advisory intent attaches clear work prompts with repo or action anchors", () => {
  const implementation = decidePreflightAdvisoryIntent({ prompt: "src/ops/preflight.ts 수정해줘" });
  assertShape(implementation);
  assert.equal(implementation.shouldAttach, true);
  assert.equal(implementation.category, "implementation");
  assert.ok(implementation.reasons.includes("repo-anchor"));
  assert.ok(implementation.reasons.includes("work-intent:implementation"));

  const debug = decidePreflightAdvisoryIntent({ prompt: "TypeError stack trace 보고 디버깅해줘" });
  assertShape(debug);
  assert.equal(debug.shouldAttach, true);
  assert.equal(debug.category, "debugging");
  assert.ok(debug.reasons.includes("repo-anchor"));
  assert.ok(debug.reasons.includes("work-intent:debugging"));

  const testWork = decidePreflightAdvisoryIntent({ prompt: "Fix failing test test/operator-activity.test.mjs" });
  assertShape(testWork);
  assert.equal(testWork.shouldAttach, true);
  assert.equal(testWork.category, "test");
  assert.ok(testWork.reasons.includes("work-intent:test"));

  const prWork = decidePreflightAdvisoryIntent({ prompt: "PR #1001 후속 작업 진행해줘" });
  assertShape(prWork);
  assert.equal(prWork.shouldAttach, true);
  assert.equal(prWork.category, "review-pr");
  assert.ok(prWork.reasons.includes("work-intent:review-pr"));

  const researchBackedEdit = decidePreflightAdvisoryIntent({ prompt: "리서치 결과를 docs/research/context.md에 추가해줘" });
  assertShape(researchBackedEdit);
  assert.equal(researchBackedEdit.shouldAttach, true);
  assert.equal(researchBackedEdit.category, "implementation");
  assert.ok(researchBackedEdit.reasons.includes("repo-anchor"));
  assert.ok(researchBackedEdit.reasons.includes("work-intent:implementation"));
});

test("preflight advisory intent requires active runtime anchor for continuation prompts", () => {
  for (const prompt of ["ㄱㄱ", "continue", "아까 거 마저"]) {
    const noAnchor = decidePreflightAdvisoryIntent({ prompt });
    assertShape(noAnchor);
    assert.equal(noAnchor.shouldAttach, false);
    assert.equal(noAnchor.category, "continuation");
    assert.ok(noAnchor.skipReasons.includes("continuation-without-active-anchor"));

    const withAnchor = decidePreflightAdvisoryIntent({ prompt, runtime: { hasActiveWorkflow: true } });
    assertShape(withAnchor);
    assert.equal(withAnchor.shouldAttach, true);
    assert.equal(withAnchor.category, "continuation");
    assert.ok(withAnchor.reasons.includes("active-runtime-anchor"));
    assert.ok(withAnchor.reasons.includes("continuation-with-active-anchor"));
  }
});

test("preflight advisory intent gives explicit opt-out precedence over positive signals", () => {
  const decision = decidePreflightAdvisoryIntent({
    prompt: "no preflight, fix test/operator-activity.test.mjs",
    runtime: { hasActiveWorkflow: true, hasFilePath: true },
  });
  assertShape(decision);
  assert.equal(decision.shouldAttach, false);
  assert.ok(decision.skipReasons.includes("explicit-opt-out"));
  assert.equal(decision.reasons.length, 0);
});

test("preflight advisory intent attaches explicit opt-in unless opt-out is present", () => {
  const optIn = decidePreflightAdvisoryIntent({ prompt: "contextTrust 기준으로 ㄱㄱ" });
  assertShape(optIn);
  assert.equal(optIn.shouldAttach, true);
  assert.ok(optIn.reasons.includes("explicit-opt-in"));
  assert.equal(optIn.confidence, "high");

  const optOutWins = decidePreflightAdvisoryIntent({ prompt: "#fooks-preflight #fooks-no-preflight src/ops/preflight.ts 수정" });
  assertShape(optOutWins);
  assert.equal(optOutWins.shouldAttach, false);
  assert.ok(optOutWins.skipReasons.includes("explicit-opt-out"));
});

test("preflight advisory intent skips work-like prompts without repo or runtime anchors", () => {
  const decision = decidePreflightAdvisoryIntent({ prompt: "구현해줘" });
  assertShape(decision);
  assert.equal(decision.shouldAttach, false);
  assert.equal(decision.category, "implementation");
  assert.ok(decision.reasons.includes("work-intent:implementation"));
  assert.ok(decision.skipReasons.includes("work-intent-without-anchor"));
});
