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

test("pre-read centralizes payload success decision construction", () => {
  assert.match(preReadSource, /function buildPreReadPayloadDecision\(/);
  assert.match(preReadSource, /return buildPreReadPayloadDecision\(\{/);
  assert.doesNotMatch(preReadSource, /return \{\s*\n\s*runtime,[\s\S]*?decision: "payload",[\s\S]*?payload,[\s\S]*?readiness,/);
});

test("pre-read centralizes payload debug construction", () => {
  assert.match(preReadSource, /function buildPreReadPayloadDebug\(/);
  assert.match(preReadSource, /const debug = buildPreReadPayloadDebug\(\{/);
  assert.doesNotMatch(preReadSource, /const debug = \{\s*\n\s*mode: result\.mode,[\s\S]*?language: result\.language,[\s\S]*?domainDetection,/);
});

test("pre-read centralizes payload preparation phase", () => {
  assert.match(preReadSource, /function buildPreReadPayloadPlan\(/);
  assert.match(preReadSource, /const \{ payload, readiness, debug \} = buildPreReadPayloadPlan\(\{/);
  assert.doesNotMatch(preReadSource, /const result = extractFile\(resolvedPath\);[\s\S]*?const readiness = assessPayloadReadiness\(result, payload\);/);
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
