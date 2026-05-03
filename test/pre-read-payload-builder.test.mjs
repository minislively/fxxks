// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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
  assert.ok(decision.payload.reactWebContext);
  assert.equal("editTargetRouting" in decision.payload.reactWebContext, false);
  assert.equal(decision.debug.reactWebContextBudget.included, true);
  assert.equal(decision.debug.reactWebContextBudget.reason, "within-budget");
});

test("pre-read payload builder omits React Web context metadata when payload budget is exceeded", () => {
  const decision = preRead.decidePreRead(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), repoRoot, "codex", {
    includeEditGuidance: true,
  });
  assert.equal(decision.decision, "payload");
  assert.ok(decision.payload.reactWebContext);

  const originalStringify = JSON.stringify;
  try {
    JSON.stringify = (value, replacer, space) => {
      const json = originalStringify(value, replacer, space);
      if (value && typeof value === "object" && "reactWebContext" in value) {
        return `${json}${"x".repeat(20_000)}`;
      }
      return json;
    };

    const budgeted = preRead.decidePreRead(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), repoRoot, "codex", {
      includeEditGuidance: true,
    });

    assert.equal(budgeted.decision, "payload");
    assert.equal("reactWebContext" in budgeted.payload, false);
    assert.equal(budgeted.payload.domainPayload.domain, "react-web");
    assert.equal(budgeted.debug.reactWebContextBudget.included, false);
    assert.equal(budgeted.debug.reactWebContextBudget.reason, "budget-exceeded");
  } finally {
    JSON.stringify = originalStringify;
  }
});

test("pre-read payload builder trims React Web edit-target routing as an ordered prefix before metadata fallback", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-routing-budget-"));
  try {
    const target = path.join(tempDir, "HookEffectPanel.tsx");
    const source = fs.readFileSync(path.join(repoRoot, "fixtures", "compressed", "HookEffectPanel.tsx"), "utf8");
    fs.writeFileSync(target, `${source}\n/* ${"budget-pad ".repeat(600)} */\n`);

    const decision = preRead.decidePreRead(target, repoRoot, "codex", {
      includeEditGuidance: true,
    });

    assert.equal(decision.decision, "payload");
    assert.ok(decision.payload.reactWebContext);
    assert.equal(decision.debug.reactWebContextBudget.included, true);
    assert.equal(decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(decision.debug.reactWebContextBudget.estimatedPayloadBytes <= decision.debug.reactWebContextBudget.maxPayloadBytes);
    assert.equal(decision.payload.reactWebContext.editTargetRouting.length < 8, true);
    assert.deepEqual(
      decision.payload.reactWebContext.editTargetRouting.map((item) => ({
        kind: item.kind,
        label: item.label,
        priority: item.priority,
        source: item.source,
        evidence: item.evidence,
      })),
      [
        {
          kind: "primary-component",
          label: "HookEffectPanel",
          priority: 1,
          source: "editGuidance.patchTargets",
          evidence: ["editGuidance.patchTargets.component"],
        },
        {
          kind: "props-contract",
          label: "HookEffectPanelProps",
          priority: 2,
          source: "editGuidance.patchTargets",
          evidence: ["editGuidance.patchTargets.props"],
        },
        {
          kind: "effect",
          label: "useEffect deps:[loadUser, userId]",
          priority: 3,
          source: "editGuidance.patchTargets",
          evidence: ["editGuidance.patchTargets.effect"],
        },
      ],
    );
    assert.ok(decision.payload.reactWebContext.stateHints.length > 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
