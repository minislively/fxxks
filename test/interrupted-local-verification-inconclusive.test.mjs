import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyLocalVerificationEvidence } from "./helpers/local-verification-classifier.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(repoRoot, "docs", "dogfood", "interrupted-local-verification-inconclusive-1027.md");

test("issue #1027 classifies interrupted local verification as inconclusive without current failure evidence", () => {
  assert.deepEqual(classifyLocalVerificationEvidence({ exitCode: 130 }), {
    classification: "inconclusive",
    reason: "interrupted-local-verifier",
    operatorCue: "Interrupted local verification exit 130 is inconclusive unless backed by current focused command failure or current-head CI failure.",
  });

  assert.deepEqual(classifyLocalVerificationEvidence({ exitCode: 130, boundedRerunPassed: true }), {
    classification: "inconclusive",
    reason: "interrupted-local-verifier-rerun-passed",
    operatorCue: "Interrupted local verification exit 130 is stale inconclusive evidence; cite the bounded rerun pass as current local verification.",
  });
});

test("issue #1027 keeps true blockers tied to current focused failure or current-head CI failure", () => {
  assert.equal(
    classifyLocalVerificationEvidence({ exitCode: 130, currentFocusedCommandFailure: true }).classification,
    "blocker",
  );
  assert.equal(
    classifyLocalVerificationEvidence({ exitCode: 130, currentHeadCiFailure: true }).classification,
    "blocker",
  );
  assert.equal(classifyLocalVerificationEvidence({ exitCode: 0 }).classification, "current-local-result");
});

test("issue #1027 dogfood doc preserves the interrupted-verifier boundary", () => {
  const doc = fs.readFileSync(docPath, "utf8");

  assert.match(doc, /# Issue #1027 interrupted local verification inconclusive guard/);
  assert.match(doc, /#960 reliability\/session-handoff lane/);
  assert.match(doc, /exits `130` because it was interrupted is inconclusive evidence by itself/);
  assert.match(doc, /Do not report an interrupted local verifier as a branch blocker/);
  assert.match(doc, /current-head\s+CI is passing/);
  assert.match(doc, /Current focused command failure: blocker/);
  assert.match(doc, /Current-head CI failure: blocker/);
  assert.match(doc, /Interrupted local command with exit `130`: inconclusive/);
  assert.match(doc, /bounded rerun that passes/);
  assert.match(doc, /bounded rerun pass is current local verification\s+evidence/);
  assert.match(doc, /does not change merge policy, provider\/runtime hooks, telemetry,\s+billing\/token proof, detector scope, product claims, or frontend behavior/);
});
