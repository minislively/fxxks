// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));
const preReadSource = fs.readFileSync(path.join(repoRoot, "src", "adapters", "pre-read.ts"), "utf8");
const preReadStackSource = fs.readFileSync(path.join(repoRoot, "src", "adapters", "pre-read-stack.ts"), "utf8");

test("pre-read centralizes payload success decision construction", () => {
  assert.match(preReadStackSource, /function buildPreReadPayloadDecision\(/);
  assert.match(preReadStackSource, /function buildPreReadDecisionFromPayloadPlan\(/);
  assert.match(preReadStackSource, /return buildPreReadPayloadDecision\(\{/);
  assert.match(preReadSource, /buildPreReadDecisionFromPayloadPlan/);
  assert.doesNotMatch(preReadSource, /return \{\s*\n\s*runtime,[\s\S]*?decision: "payload",[\s\S]*?payload,[\s\S]*?readiness,/);
});

test("pre-read centralizes payload debug construction", () => {
  assert.match(preReadStackSource, /function buildPreReadPayloadDebug\(/);
  assert.match(preReadStackSource, /const debug = buildPreReadPayloadDebug\(\{/);
  assert.doesNotMatch(preReadSource, /const debug = \{\s*\n\s*mode: result\.mode,[\s\S]*?language: result\.language,[\s\S]*?domainDetection,/);
});

test("pre-read centralizes payload preparation phase", () => {
  assert.match(preReadStackSource, /function buildPreReadPayloadPlan\(/);
  assert.match(preReadSource, /const \{ payload, readiness, debug \} = buildPreReadPayloadPlan\(\{/);
  assert.doesNotMatch(preReadSource, /const result = extractFile\(resolvedPath\);[\s\S]*?const readiness = assessPayloadReadiness\(result, payload\);/);
});

test("pre-read centralizes payload plan outcome decision", () => {
  assert.match(preReadStackSource, /function buildPreReadDecisionFromPayloadPlan\(/);
  assert.match(preReadSource, /return buildPreReadDecisionFromPayloadPlan\(\{/);
  assert.doesNotMatch(preReadSource, /if \(readiness\.ready\) \{[\s\S]*?const profileGate = assessFrontendProfilePayloadReuse\(extension, domainDetection, payload, frontendPayloadPolicy\);/);
});

test("pre-read payload builder preserves React Web payload success envelope", () => {
  const decision = preRead.decidePreRead(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), repoRoot, "codex", {
    includeEditGuidance: true,
  });

  assert.equal(decision.runtime, "codex");
  assert.equal(decision.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.equal(decision.eligible, true);
  assert.equal(decision.decision, "payload");
  assert.deepEqual(decision.reasons, []);
  assert.equal(decision.readiness.ready, true);
  assert.ok(decision.payload);
  assert.equal(decision.debug.mode, "compressed");
  assert.equal(typeof decision.debug.complexityScore, "number");
  assert.deepEqual(decision.debug.decideReason, ["repeated-rendering"]);
  assert.equal(decision.debug.decideConfidence, "medium");
  assert.equal(decision.debug.language, "tsx");
  assert.equal(decision.debug.domainDetection.classification, "react-web");
  assert.equal(decision.debug.frontendPayloadPolicy.allowed, true);
});
