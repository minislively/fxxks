import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { validate } = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "validate-r4-applied.js"));
const { parseCodexRuntimeTokens, parseCodexRuntimeUsage } = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "runtime-token-metrics.js"));
const { summarizeRepeatedPairs } = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "r4-repeated-summary.js"));
const CodexWrapper = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "codex-wrapper.js"));
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

function runArtifact({
  prompt = 1000,
  runtime = 1000,
  latency = 1000,
  status = "applied-code-run-validated",
  validation = "applied-acceptance-validated",
  taskIdentity,
  targetIdentity,
  model,
  setupIdentity,
  targetFile,
  runtimeTokensInput,
  runtimeTokensOutput,
  runtimeTokenSource,
} = {}) {
  return {
    status,
    validation: { status: validation },
    taskIdentity,
    targetIdentity,
    targetFile,
    model,
    setupIdentity,
    metrics: {
      promptTokensApprox: prompt,
      runtimeTokensInput: runtimeTokensInput ?? null,
      runtimeTokensOutput: runtimeTokensOutput ?? null,
      runtimeTokensTotal: runtime,
      runtimeTokenSource: runtimeTokenSource ?? (runtime !== null ? "codex-cli-output" : null),
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

  const usage = parseCodexRuntimeUsage("Input tokens: 1,000\nOutput tokens: 234\nTotal tokens: 1,234");
  assert.deepEqual(
    {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      source: usage.source,
    },
    {
      inputTokens: 1000,
      outputTokens: 234,
      totalTokens: 1234,
      source: "codex-cli-output",
    },
  );
  assert.match(usage.claimBoundary, /not provider billing tokens or costs/);
});

test("R4 repeated summary can classify a narrow L1 candidate", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({ prompt: 10000, runtime: 1000 + index * 10, latency: 1000 + index * 10, taskIdentity: "r4-combobox", model: "gpt-5.4-mini", setupIdentity: "setup-main" }),
    fooksArtifact: runArtifact({ prompt: 1200, runtime: 700 + index * 10, latency: 800 + index * 10, taskIdentity: "r4-combobox", model: "gpt-5.4-mini", setupIdentity: "setup-main" }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "narrow-l1-candidate");
  assert.equal(summary.candidate.status, "candidate-evidence");
  assert.equal(summary.candidate.achieved, true);
  assert.equal(summary.acceptedPairCount, 5);
  assert.equal(summary.distributions.runtimeTokenReductionPct.length, 5);
  assert.equal(summary.medians.promptReductionPct, 88);
  assert.ok(summary.medians.runtimeTokenReductionPct > 0);
  assert.ok(summary.medians.latencyReductionPct > 0);
  assert.equal(summary.identity.inherited, false);
  assert.equal(Object.hasOwn(summary.pairs[0].vanilla, "runtimeTokenClaimAvailable"), false);
  assert.equal(summary.pairs[0].vanilla.runtimeTokenTelemetryAvailable, true);
  assert.equal(summary.pairs[0].vanilla.runtimeTokenSource, "codex-cli-output");
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
  assert.equal(summary.claimability.stableTimeOrLatencySavings, false);
  assert.match(summary.claimBoundary.join("\n"), /not provider billing tokens or costs/);
  assert.match(summary.claimBoundary.join("\n"), /not product claimability/i);
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
  assert.equal(summary.candidate.status, "insufficient-accepted-pairs");
  assert.equal(summary.acceptedPairCount, 2);
  assert.equal(summary.outliers.runtimeTokenRegressionCount, 1);
  assert.equal(summary.outliers.latencyRegressionCount, 1);
  assert.equal(summary.claimability.providerInvoiceOrBillingSavings, false);
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
});

test("R4 repeated summary treats missing artifacts as failed pairs", () => {
  const missingPath = path.join(os.tmpdir(), `fooks-missing-${Date.now()}.json`);
  const summary = summarizeRepeatedPairs({
    requiredAcceptedPairs: 1,
    pairs: [{ vanillaPath: missingPath, fooksArtifact: runArtifact() }],
  });

  assert.equal(summary.classification, "insufficient-accepted-pairs");
  assert.equal(summary.candidate.status, "insufficient-accepted-pairs");
  assert.equal(summary.acceptedPairCount, 0);
  assert.equal(summary.failedPairCount, 1);
  assert.equal(summary.pairs[0].vanilla.validationStatus, "artifact-unavailable");
  assert.match(summary.pairs[0].vanilla.artifactError, /ENOENT/);
});

test("R4 repeated summary downgrades mixed model/setup identity instead of cherry-picking candidate evidence", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({
      prompt: 10000,
      runtime: 1000 + index,
      latency: 1000 + index,
      taskIdentity: index === 4 ? "r4-combobox-alt" : "r4-combobox",
      model: index === 4 ? "gpt-5.4-mini-alt" : "gpt-5.4-mini",
      setupIdentity: index === 4 ? "setup-alt" : "setup-main",
    }),
    fooksArtifact: runArtifact({
      prompt: 1200,
      runtime: 700 + index,
      latency: 800 + index,
      taskIdentity: index === 4 ? "r4-combobox-alt" : "r4-combobox",
      model: index === 4 ? "gpt-5.4-mini-alt" : "gpt-5.4-mini",
      setupIdentity: index === 4 ? "setup-alt" : "setup-main",
    }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "mixed-identity");
  assert.equal(summary.candidate.status, "mixed-identity");
  assert.equal(summary.identity.mixed, true);
  assert.deepEqual(summary.identity.mixedReasons.sort(), ["mixed-model", "mixed-setup-identity", "mixed-task-identity"].sort());
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
  assert.equal(summary.claimability.stableTimeOrLatencySavings, false);
});

test("R4 repeated summary refuses candidate evidence when identity is missing", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({ runtime: 1000 + index, latency: 1000 + index }),
    fooksArtifact: runArtifact({ runtime: 700 + index, latency: 800 + index }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "missing-identity");
  assert.equal(summary.candidate.status, "missing-identity");
  assert.deepEqual(summary.identity.missingReasons.sort(), ["missing-model", "missing-setup-identity", "missing-task-identity"].sort());
  assert.equal(summary.candidate.achieved, false);
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
});

test("R4 repeated summary allows run-level identity defaults but reports inherited identity sources", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({ runtime: 1000 + index, latency: 1000 + index }),
    fooksArtifact: runArtifact({ runtime: 700 + index, latency: 800 + index }),
  }));

  const summary = summarizeRepeatedPairs({
    requiredAcceptedPairs: 5,
    taskIdentity: "r4-combobox",
    model: "gpt-5.4-mini",
    setupIdentity: "setup-main",
    pairs,
  });

  assert.equal(summary.classification, "narrow-l1-candidate");
  assert.equal(summary.candidate.status, "candidate-evidence");
  assert.equal(summary.identity.missing, false);
  assert.equal(summary.identity.inherited, true);
  assert.ok(summary.identity.inheritedReasons.includes("vanilla-taskIdentity-from-run.taskIdentity"));
  assert.ok(summary.identity.inheritedReasons.includes("fooks-model-from-run.model"));
  assert.ok(summary.identity.inheritedReasons.includes("vanilla-setupIdentity-from-run.setupIdentity"));
  assert.equal(summary.pairs[4].vanilla.identity.sources.taskIdentity, "run.taskIdentity");
  assert.equal(summary.pairs[4].vanilla.identity.sources.model, "run.model");
  assert.equal(summary.pairs[4].vanilla.identity.sources.setupIdentity, "run.setupIdentity");
  assert.match(summary.identity.sourcePolicy, /resolved/);
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
});

test("R4 repeated summary requires explicit setup identity before candidate evidence", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({ runtime: 1000 + index, latency: 1000 + index, taskIdentity: "r4-combobox", model: "gpt-5.4-mini" }),
    fooksArtifact: runArtifact({ runtime: 700 + index, latency: 800 + index, taskIdentity: "r4-combobox", model: "gpt-5.4-mini" }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "missing-identity");
  assert.equal(summary.candidate.status, "missing-identity");
  assert.deepEqual(summary.identity.missingReasons, ["missing-setup-identity"]);
  assert.equal(summary.taskIdentity, "r4-combobox");
  assert.equal(summary.model, "gpt-5.4-mini");
  assert.equal(summary.setupIdentity, null);
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
});

test("R4 repeated summary rejects partial missing identity among accepted pairs", () => {
  const cases = [
    {
      name: "task",
      missingReason: "missing-task-identity",
      mutate: (identity, index) => (index === 4 ? { ...identity, taskIdentity: undefined } : identity),
    },
    {
      name: "model",
      missingReason: "missing-model",
      mutate: (identity, index) => (index === 4 ? { ...identity, model: undefined } : identity),
    },
    {
      name: "setup",
      missingReason: "missing-setup-identity",
      mutate: (identity, index) => (index === 4 ? { ...identity, setupIdentity: undefined } : identity),
    },
  ];

  for (const testCase of cases) {
    const baseIdentity = { taskIdentity: "r4-combobox", model: "gpt-5.4-mini", setupIdentity: "setup-main" };
    const pairs = Array.from({ length: 5 }, (_, index) => {
      const identity = testCase.mutate(baseIdentity, index);
      return {
        pairIndex: index + 1,
        vanillaArtifact: runArtifact({ runtime: 1000 + index, latency: 1000 + index, ...identity }),
        fooksArtifact: runArtifact({ runtime: 700 + index, latency: 800 + index, ...identity }),
      };
    });

    const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

    assert.equal(summary.classification, "missing-identity", testCase.name);
    assert.equal(summary.candidate.status, "missing-identity", testCase.name);
    assert.ok(summary.identity.missingReasons.includes(testCase.missingReason), testCase.name);
    assert.equal(summary.candidate.achieved, false, testCase.name);
  }
});

test("R4 repeated summary does not collapse different same-basename targets", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({
      runtime: 1000 + index,
      latency: 1000 + index,
      targetFile: index === 4 ? "/repo/a/Component.tsx" : "/repo/b/Component.tsx",
      model: "gpt-5.4-mini",
      setupIdentity: "setup-main",
    }),
    fooksArtifact: runArtifact({
      runtime: 700 + index,
      latency: 800 + index,
      targetFile: index === 4 ? "/repo/a/Component.tsx" : "/repo/b/Component.tsx",
      model: "gpt-5.4-mini",
      setupIdentity: "setup-main",
    }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "mixed-identity");
  assert.equal(summary.candidate.status, "mixed-identity");
  assert.ok(summary.identity.acceptedTaskIdentities.some((value) => value.includes("/a/Component.tsx")));
  assert.ok(summary.identity.acceptedTaskIdentities.some((value) => value.includes("/b/Component.tsx")));
  assert.ok(summary.identity.mixedReasons.includes("mixed-task-identity"));
});

test("R4 repeated summary marks accepted pairs without runtime telemetry unavailable", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({ runtime: null, latency: 1000 + index, taskIdentity: "r4-combobox", model: "gpt-5.4-mini", setupIdentity: "setup-main" }),
    fooksArtifact: runArtifact({ runtime: null, latency: 800 + index, taskIdentity: "r4-combobox", model: "gpt-5.4-mini", setupIdentity: "setup-main" }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "runtime-token-unavailable");
  assert.equal(summary.candidate.status, "runtime-token-unavailable");
  assert.equal(summary.runtimeTokenComparablePairCount, 0);
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
});

test("R4 repeated summary preserves structured runtime-token fields when available", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({
      runtimeTokensInput: 800 + index,
      runtimeTokensOutput: 200,
      runtime: 1000 + index,
      latency: 1000 + index,
      taskIdentity: "r4-combobox",
      model: "gpt-5.4-mini",
      setupIdentity: "setup-main",
    }),
    fooksArtifact: runArtifact({
      runtimeTokensInput: 500 + index,
      runtimeTokensOutput: 200,
      runtime: 700 + index,
      latency: 800 + index,
      taskIdentity: "r4-combobox",
      model: "gpt-5.4-mini",
      setupIdentity: "setup-main",
    }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "narrow-l1-candidate");
  assert.equal(summary.pairs[0].vanilla.runtimeTokensInput, 800);
  assert.equal(summary.pairs[0].vanilla.runtimeTokensOutput, 200);
  assert.equal(summary.pairs[0].vanilla.runtimeTokensTotal, 1000);
  assert.equal(summary.pairs[0].fooks.runtimeTokensInput, 500);
  assert.equal(summary.pairs[0].fooks.runtimeTokensOutput, 200);
  assert.equal(summary.claimability.providerBillingTokenSavings, false);
});

test("R4 repeated summary reports diagnostic candidate status when accepted pairs regress", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => ({
    pairIndex: index + 1,
    vanillaArtifact: runArtifact({ runtime: 1000, latency: 1000, taskIdentity: "r4-combobox", model: "gpt-5.4-mini", setupIdentity: "setup-main" }),
    fooksArtifact: runArtifact({ runtime: 1400 + index, latency: 1200 + index, taskIdentity: "r4-combobox", model: "gpt-5.4-mini", setupIdentity: "setup-main" }),
  }));

  const summary = summarizeRepeatedPairs({ requiredAcceptedPairs: 5, pairs });

  assert.equal(summary.classification, "diagnostic-only");
  assert.equal(summary.candidate.status, "diagnostic-only");
  assert.equal(summary.candidate.achieved, false);
  assert.equal(summary.outliers.runtimeTokenRegressionCount, 5);
  assert.equal(summary.distributions.runtimeTokenReductionPct.length, 5);
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
});

test("R4 repeated runner defaults summary output into project-local .fooks evidence with seed pairs", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-r4-default-"));
  try {
    const seedArgs = [];
    for (let index = 1; index <= 5; index += 1) {
      const vanillaPath = path.join(tempRoot, `vanilla-${index}.json`);
      const fooksPath = path.join(tempRoot, `fooks-${index}.json`);
      fs.writeFileSync(vanillaPath, JSON.stringify(runArtifact({ prompt: 10_000, runtime: 1_000 + index, latency: 1_000 + index })));
      fs.writeFileSync(fooksPath, JSON.stringify(runArtifact({ prompt: 1_200, runtime: 800 + index, latency: 850 + index })));
      seedArgs.push(`--seed-pair=${vanillaPath}:${fooksPath}`);
    }

    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-r4-repeated.js"),
      "--run-id=runtime-smoke",
      "--task-id=runtime-smoke-task",
      "--required-accepted=5",
      "--max-pairs=5",
      ...seedArgs,
    ], { cwd: tempRoot, encoding: "utf8" });

    const summaryLine = JSON.parse(stdout);
    const summaryPath = path.join(tempRoot, ".fooks", "evidence", "runtime", "runtime-smoke", "summary.json");
    const pairsDir = path.join(tempRoot, ".fooks", "evidence", "runtime", "runtime-smoke", "pairs");
    assert.equal(path.resolve(summaryLine.output), fs.realpathSync(summaryPath));
    assert.equal(summaryLine.runId, "runtime-smoke");
    assert.equal(summaryLine.candidateStatus, "candidate-evidence");
    assert.equal(fs.existsSync(summaryPath), true);
    assert.equal(fs.existsSync(pairsDir), true);

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    assert.equal(summary.classification, "narrow-l1-candidate");
    assert.equal(summary.candidate.status, "candidate-evidence");
    assert.equal(summary.taskIdentity, "runtime-smoke-task");
    assert.equal(summary.model, "gpt-5.4-mini");
    assert.match(summary.setupIdentity, /requiredAccepted=5/);
    assert.equal(summary.claimability.providerInvoiceOrBillingSavings, false);
    assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
    assert.equal(summary.claimability.stableTimeOrLatencySavings, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("R4 repeated runner explicit output override avoids default .fooks evidence", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-r4-explicit-"));
  try {
    const seedArgs = [];
    for (let index = 1; index <= 5; index += 1) {
      const vanillaPath = path.join(tempRoot, `vanilla-${index}.json`);
      const fooksPath = path.join(tempRoot, `fooks-${index}.json`);
      fs.writeFileSync(vanillaPath, JSON.stringify(runArtifact({ runtime: 1_000 + index, latency: 1_000 + index })));
      fs.writeFileSync(fooksPath, JSON.stringify(runArtifact({ runtime: 800 + index, latency: 850 + index })));
      seedArgs.push(`--seed-pair=${vanillaPath}:${fooksPath}`);
    }
    const explicitOutput = path.join(tempRoot, "explicit", "summary.json");

    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-r4-repeated.js"),
      "--run-id=runtime-explicit",
      `--output=${explicitOutput}`,
      "--required-accepted=5",
      "--max-pairs=5",
      ...seedArgs,
    ], { cwd: tempRoot, encoding: "utf8" });

    const summaryLine = JSON.parse(stdout);
    assert.equal(path.resolve(summaryLine.output), explicitOutput);
    assert.equal(fs.existsSync(explicitOutput), true);
    assert.equal(fs.existsSync(path.join(tempRoot, ".fooks")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("R4 repeated runner success still requires verifier to inspect candidate status", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-r4-diagnostic-"));
  try {
    const seedArgs = [];
    for (let index = 1; index <= 5; index += 1) {
      const vanillaPath = path.join(tempRoot, `vanilla-${index}.json`);
      const fooksPath = path.join(tempRoot, `fooks-${index}.json`);
      fs.writeFileSync(vanillaPath, JSON.stringify(runArtifact({ runtime: 1_000, latency: 1_000 })));
      fs.writeFileSync(fooksPath, JSON.stringify(runArtifact({ runtime: 1_400 + index, latency: 1_200 + index })));
      seedArgs.push(`--seed-pair=${vanillaPath}:${fooksPath}`);
    }

    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-r4-repeated.js"),
      "--run-id=runtime-diagnostic",
      "--task-id=runtime-diagnostic-task",
      "--required-accepted=5",
      "--max-pairs=5",
      ...seedArgs,
    ], { cwd: tempRoot, encoding: "utf8" });

    const summaryLine = JSON.parse(stdout);
    assert.equal(summaryLine.acceptedPairCount, 5);
    assert.equal(summaryLine.candidateStatus, "diagnostic-only");

    const summaryPath = path.join(tempRoot, ".fooks", "evidence", "runtime", "runtime-diagnostic", "summary.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    assert.equal(summary.candidate.achieved, false);
    assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Codex wrapper artifacts include structured runtime usage without billing semantics", async () => {
  const tempBin = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-bin-"));
  const codexPath = path.join(tempBin, "codex");
  try {
    fs.writeFileSync(
      codexPath,
      [
        "#!/usr/bin/env node",
        "const fs = require('fs');",
        "const outIndex = process.argv.indexOf('-o');",
        "if (outIndex !== -1) fs.writeFileSync(process.argv[outIndex + 1], 'ok');",
        "console.error('Input tokens: 1,000');",
        "console.error('Output tokens: 234');",
        "console.error('Total tokens: 1,234');",
      ].join("\n"),
      { mode: 0o755 },
    );
    const wrapper = new CodexWrapper({ model: "test-model", timeoutMs: 1000, command: codexPath });
    const result = await wrapper.run("context", "task");

    assert.equal(result.success, true);
    assert.deepEqual(
      {
        inputTokens: result.runtimeUsage.inputTokens,
        outputTokens: result.runtimeUsage.outputTokens,
        totalTokens: result.runtimeUsage.totalTokens,
        source: result.runtimeUsage.source,
      },
      {
        inputTokens: 1000,
        outputTokens: 234,
        totalTokens: 1234,
        source: "codex-cli-output",
      },
    );
    assert.match(result.runtimeUsage.claimBoundary, /not provider billing tokens or costs/);
  } finally {
    fs.rmSync(tempBin, { recursive: true, force: true });
  }
});
