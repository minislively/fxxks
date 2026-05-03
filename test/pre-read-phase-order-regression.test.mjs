// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const PAYLOAD_DEBUG_KEYS = [
  "complexityScore",
  "decideConfidence",
  "decideReason",
  "domainDetection",
  "frontendPayloadPolicy",
  "language",
  "mode",
];

function assertNoPayloadPlanningArtifacts(decision) {
  assert.equal("payload" in decision, false, "fallback must not expose a planned payload");
  assert.equal("readiness" in decision, false, "boundary fallback must short-circuit before readiness planning");
  for (const debugKey of ["mode", "complexityScore", "decideReason", "decideConfidence", "language"]) {
    assert.equal(debugKey in decision.debug, false, `boundary fallback must not expose payload debug.${debugKey}`);
  }
}

test("pre-read adapter phase ordering preserves boundary short-circuit and payload debug shape", () => {
  const boundaryDecision = preRead.decidePreRead(
    path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", "webview-boundary-basic.tsx"),
    repoRoot,
    "codex",
    { includeEditGuidance: true },
  );

  assert.equal(boundaryDecision.runtime, "codex");
  assert.equal(boundaryDecision.eligible, true);
  assert.equal(boundaryDecision.decision, "fallback");
  assert.deepEqual(boundaryDecision.reasons, ["unsupported-react-native-webview-boundary"]);
  assert.deepEqual(boundaryDecision.fallback, {
    action: "full-read",
    reason: "unsupported-react-native-webview-boundary",
  });
  assertNoPayloadPlanningArtifacts(boundaryDecision);
  assert.deepEqual(Object.keys(boundaryDecision.debug).sort(), ["domainDetection", "frontendPayloadPolicy"]);
  assert.equal(boundaryDecision.debug.domainDetection.classification, "webview");
  assert.equal(boundaryDecision.debug.domainDetection.profile.claimStatus, "fallback-boundary");
  assert.equal(boundaryDecision.debug.frontendPayloadPolicy.allowed, false);

  const payloadDecision = preRead.decidePreRead(
    path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"),
    repoRoot,
    "codex",
    { includeEditGuidance: true },
  );

  assert.equal(payloadDecision.runtime, "codex");
  assert.equal(payloadDecision.eligible, true);
  assert.equal(payloadDecision.decision, "payload");
  assert.deepEqual(payloadDecision.reasons, []);
  assert.equal(payloadDecision.readiness.ready, true);
  assert.ok(payloadDecision.payload);
  assert.deepEqual(Object.keys(payloadDecision.debug).sort(), PAYLOAD_DEBUG_KEYS);
  assert.equal(payloadDecision.debug.mode, "compressed");
  assert.equal(typeof payloadDecision.debug.complexityScore, "number");
  assert.deepEqual(payloadDecision.debug.decideReason, ["repeated-rendering"]);
  assert.equal(payloadDecision.debug.decideConfidence, "medium");
  assert.equal(payloadDecision.debug.language, "tsx");
  assert.equal(payloadDecision.debug.domainDetection.classification, "react-web");
  assert.equal(payloadDecision.debug.frontendPayloadPolicy.allowed, true);
});
