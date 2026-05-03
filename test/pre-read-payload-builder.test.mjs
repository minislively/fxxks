// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

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
