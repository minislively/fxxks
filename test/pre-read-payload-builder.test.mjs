// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { reactWebFormStateFlowSource } from "./react-web-inline-sources.mjs";

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
  assert.equal(decision.payload.reactWebContext.editTargetRouting.length, 2);
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

test("pre-read payload builder preserves React Web form state-flow when context budget permits", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-form-flow-budget-"));
  try {
    const target = path.join(tempDir, "InlineRetentionForm.tsx");
    fs.writeFileSync(target, reactWebFormStateFlowSource());

    const decision = preRead.decidePreRead(target, repoRoot, "codex", {
      includeEditGuidance: false,
    });

    assert.equal(decision.decision, "payload");
    assert.ok(decision.payload.reactWebContext);
    assert.equal(decision.debug.reactWebContextBudget.included, true);
    assert.equal(decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(decision.debug.reactWebContextBudget.estimatedPayloadBytes <= decision.debug.reactWebContextBudget.maxPayloadBytes);
    assert.ok(Array.isArray(decision.payload.reactWebContext.formStateFlow));
    assert.ok(
      decision.payload.reactWebContext.formStateFlow.some(
        (item) => item.kind === "controlled-control" && item.label === "input[name=email]",
      ),
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("pre-read payload builder preserves React Web edit-target routing before lower-priority metadata", () => {
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
    assert.equal("importRoleHints" in decision.payload.reactWebContext, false);
    assert.equal("stylingVariantHints" in decision.payload.reactWebContext, false);
    assert.equal("localDependencies" in decision.payload.reactWebContext, false);
    assert.equal("renderStates" in decision.payload.reactWebContext, false);
    assert.equal("stateHints" in decision.payload.reactWebContext, false);
    assert.equal("componentApiHints" in decision.payload.reactWebContext, false);
    assert.equal("layoutRegionHints" in decision.payload.reactWebContext, false);
    assert.equal(decision.payload.reactWebContext.editTargetRouting.length, 8);
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
        {
          kind: "callback",
          label: "useMemo deps:[name]",
          priority: 4,
          source: "editGuidance.patchTargets",
          evidence: ["editGuidance.patchTargets.callback"],
        },
        {
          kind: "callback",
          label: "useCallback deps:[loadUser, userId]",
          priority: 5,
          source: "editGuidance.patchTargets",
          evidence: ["editGuidance.patchTargets.callback"],
        },
        {
          kind: "event-handler",
          label: "handleRefresh",
          priority: 6,
          source: "editGuidance.patchTargets",
          evidence: ["editGuidance.patchTargets.event-handler"],
        },
        {
          kind: "event-handler",
          label: "handleRefresh",
          priority: 7,
          source: "editGuidance.patchTargets",
          evidence: ["editGuidance.patchTargets.event-handler"],
        },
        {
          kind: "conditional-region",
          label: "useEffect",
          priority: 8,
          source: "editGuidance.patchTargets",
          evidence: ["editGuidance.patchTargets.snippet"],
        },
      ],
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
