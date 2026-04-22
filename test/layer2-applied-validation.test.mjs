import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { validate } = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "validate-r4-applied.js"));
const { parseCodexRuntimeTokens } = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "runtime-token-metrics.js"));
const { summarizeRepeatedPairs } = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "r4-repeated-summary.js"));
const fixtureRoot = path.join(repoRoot, "benchmarks", "layer2-frontend-task", "fixtures", "r4-applied-pass", "combobox");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function runArtifact({ prompt = 1000, runtime = 1000, latency = 1000, status = "applied-code-run-validated", validation = "applied-acceptance-validated" } = {}) {
  return {
    status,
    validation: { status: validation },
    metrics: {
      promptTokensApprox: prompt,
      runtimeTokensTotal: runtime,
      runtimeTokenClaimAvailable: runtime !== null,
      latencyMs: latency,
    },
  };
}

test("R4 applied acceptance validator passes a complete candidate tree", () => {
  const result = validate(fixtureRoot);

  assert.equal(result.status, "applied-acceptance-validated");
  assert.equal(result.summary.requiredGateCount, 6);
  assert.equal(result.summary.passedRequiredGateCount, 6);
  assert.equal(result.gates.find((gate) => gate.name.includes("file tree")).passed, true);
  assert.equal(result.gates.find((gate) => gate.name.includes("source hygiene")).passed, true);
  assert.equal(result.gates.find((gate) => gate.name.includes("TypeScript")).status, "passed");
});

test("R4 applied acceptance validator fails local circular imports", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-r4-cycle-"));
  try {
    copyDir(fixtureRoot, tempRoot);
    fs.appendFileSync(path.join(tempRoot, "types", "combobox-types.ts"), "\nimport '../components/Combobox';\n");

    const result = validate(tempRoot, { typecheck: "skip" });
    const circularGate = result.gates.find((gate) => gate.name.includes("no cycles"));

    assert.equal(result.status, "applied-acceptance-failed");
    assert.equal(circularGate.passed, false);
    assert.ok(circularGate.cycles.some((cycle) => cycle.includes("types/combobox-types.ts")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("R4 applied acceptance validator fails external imports and JSX", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-r4-hygiene-"));
  try {
    copyDir(fixtureRoot, tempRoot);
    fs.writeFileSync(
      path.join(tempRoot, "components", "ComboboxInput.tsx"),
      "import React from 'react';\nexport function ComboboxInput(){ return <input />; }\n",
    );

    const result = validate(tempRoot, { typecheck: "skip" });
    const hygieneGate = result.gates.find((gate) => gate.name.includes("source hygiene"));
    const measured = hygieneGate.measured.find((entry) => entry.file === "components/ComboboxInput.tsx");

    assert.equal(result.status, "applied-acceptance-failed");
    assert.equal(hygieneGate.passed, false);
    assert.deepEqual(measured.externalImports, ["react"]);
    assert.ok(measured.jsxTagMatches.some((match) => match.includes("input")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("R4 applied acceptance validator allows TSX-safe generic type parameters", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-r4-generics-"));
  try {
    copyDir(fixtureRoot, tempRoot);
    fs.writeFileSync(
      path.join(tempRoot, "components", "ComboboxItem.tsx"),
      [
        "import type { ComboboxItemProps, ComboboxItemModel } from '../types';",
        "export function ComboboxItem<TValue>(props: ComboboxItemProps<TValue>): ComboboxItemModel<TValue> {",
        "  return { kind: 'item', value: props.value, label: String(props.value) };",
        "}",
        "",
      ].join("\n"),
    );

    const result = validate(tempRoot, { typecheck: "skip" });
    const hygieneGate = result.gates.find((gate) => gate.name.includes("source hygiene"));
    const measured = hygieneGate.measured.find((entry) => entry.file === "components/ComboboxItem.tsx");

    assert.equal(hygieneGate.passed, true);
    assert.deepEqual(measured.jsxTagMatches, []);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("R4 applied acceptance validator accepts type-only barrel exports", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-r4-type-barrel-"));
  try {
    copyDir(fixtureRoot, tempRoot);
    fs.writeFileSync(
      path.join(tempRoot, "types", "index.ts"),
      "export type { ComboboxItemProps, ComboboxOption } from './combobox-types';\n",
    );

    const result = validate(tempRoot, { typecheck: "skip" });
    const barrelGate = result.gates.find((gate) => gate.name.includes("barrel exports"));
    const measured = barrelGate.measured.find((entry) => entry.file === "types/index.ts");

    assert.equal(barrelGate.passed, true);
    assert.deepEqual(measured.missing, []);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Codex runtime-token parser extracts CLI tokens used without billing semantics", () => {
  assert.equal(parseCodexRuntimeTokens("tokens used\n52,485\n"), 52485);
  assert.equal(parseCodexRuntimeTokens("debug", "tokens used: 1,234"), 1234);
  assert.equal(parseCodexRuntimeTokens("no usage here"), null);
});

test("R4 repeated summary can classify a narrow L1 candidate", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({ prompt: 10000, runtime: 1000 + index * 10, latency: 1000 + index * 10 }),
    fooksArtifact: runArtifact({ prompt: 1200, runtime: 700 + index * 10, latency: 800 + index * 10 }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "narrow-l1-candidate");
  assert.equal(summary.acceptedPairCount, 5);
  assert.equal(summary.medians.promptReductionPct, 88);
  assert.ok(summary.medians.runtimeTokenReductionPct > 0);
  assert.ok(summary.medians.latencyReductionPct > 0);
  assert.match(summary.claimBoundary.join("\n"), /not provider billing tokens or costs/);
});

test("R4 repeated summary blocks claims when accepted pairs are insufficient or regress", () => {
  const pairs = [
    {
      vanillaArtifact: runArtifact({ prompt: 10000, runtime: 1000, latency: 1000 }),
      fooksArtifact: runArtifact({ prompt: 1200, runtime: 700, latency: 800 }),
    },
    {
      vanillaArtifact: runArtifact({ prompt: 10000, runtime: 1000, latency: 1000 }),
      fooksArtifact: runArtifact({ prompt: 1200, runtime: 1400, latency: 1200 }),
    },
    {
      vanillaArtifact: runArtifact({ prompt: 10000, runtime: 1000, latency: 1000 }),
      fooksArtifact: runArtifact({ prompt: 1200, runtime: null, latency: 1200, status: "applied-code-run-failed", validation: "applied-acceptance-failed" }),
    },
  ];

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "insufficient-accepted-pairs");
  assert.equal(summary.acceptedPairCount, 2);
  assert.equal(summary.outliers.runtimeTokenRegressionCount, 1);
  assert.equal(summary.outliers.latencyRegressionCount, 1);
});

test("R4 repeated summary treats missing artifacts as failed pairs", () => {
  const missingPath = path.join(os.tmpdir(), `fooks-missing-${Date.now()}.json`);
  const summary = summarizeRepeatedPairs({
    requiredAcceptedPairs: 1,
    pairs: [{ vanillaPath: missingPath, fooksArtifact: runArtifact() }],
  });

  assert.equal(summary.classification, "insufficient-accepted-pairs");
  assert.equal(summary.acceptedPairCount, 0);
  assert.equal(summary.failedPairCount, 1);
  assert.equal(summary.pairs[0].vanilla.validationStatus, "artifact-unavailable");
  assert.match(summary.pairs[0].vanilla.artifactError, /ENOENT/);
});
