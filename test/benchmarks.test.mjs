import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));
const {
  loadFixtureSet,
  loadPreservationExpectations,
  loadModeExpectations,
  evaluatePreservation,
  evaluateMode,
} = await import(path.join(repoRoot, "benchmarks", "scripts", "lib.mjs"));

function runScript(relativeScriptPath, envOverrides = {}) {
  return JSON.parse(
    execFileSync(process.execPath, [path.join(repoRoot, relativeScriptPath)], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, FOOKS_BENCH_REPEAT_COUNT: "2", ...envOverrides },
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}

test("benchmark fixture manifest keeps the phase-1 v1 corpus", () => {
  const fixtureSet = loadFixtureSet();
  assert.equal(fixtureSet.version, "v1");
  assert.deepEqual(
    fixtureSet.fixtures.map((fixture) => fixture.filePath),
    [
      path.join("fixtures", "raw", "SimpleButton.tsx"),
      path.join("fixtures", "compressed", "FormSection.tsx"),
      path.join("fixtures", "hybrid", "DashboardPanel.tsx"),
    ],
  );
});

test("preservation evaluator keeps the critical lightweight signals for configured fixtures", () => {
  const expectations = loadPreservationExpectations();
  const extracted = extractFile(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"));
  const result = evaluatePreservation(extracted, expectations["form-form-section"]);
  assert.equal(result.passed, true);
  assert.equal(result.preserved.exports, true);
  assert.equal(result.preserved.componentName, true);
  assert.equal(result.preserved.props, true);
  assert.equal(result.preserved.styleSystem, true);
  assert.equal(result.preserved.importHint, true);
});

test("mode evaluator accepts allowed alternatives and reports mismatches", () => {
  assert.equal(evaluateMode("compressed", { expectedModes: ["compressed", "hybrid"] }).passed, true);
  const mismatch = evaluateMode("raw", { expectedModes: ["compressed"] });
  assert.equal(mismatch.passed, false);
  assert.deepEqual(mismatch.expectedModes, ["compressed"]);
});

test("scan-cache benchmark script emits expanded scenarios and writes the latest artifact", () => {
  const result = runScript(path.join("benchmarks", "scripts", "scan-cache.mjs"));
  assert.equal(result.kind, "scan-cache-bench");
  assert.equal(result.layer, "cli-e2e");
  assert.ok(result.runs.cold.avgMs > 0);
  assert.ok("partialSingle" in result.runs);
  assert.ok("partialMulti" in result.runs);
  assert.ok("rescanAfterInvalidation" in result.runs);
  assert.ok(result.runs.cold.observability.timingsMs.discovery >= 0);
  assert.ok(result.runs.warm.observability.counters.metadataReuseCount > 0);
  assert.ok(Array.isArray(result.runs.partialSingle.observability.slowFiles));
  assert.ok(result.runs.warm.runtimeBreakdown.scanCoreMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.commandDispatchMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.pathsModuleImportMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.scanModuleImportMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.ensureProjectDataDirsMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.commandDispatchResidualMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.resultSerializeMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.stdoutWriteMs >= 0);
  assert.ok(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.commandPathUnattributedMs >= 0);
  assert.ok(["captured", "partial", "missing", "invalid"].includes(result.runs.warm.runtimeBreakdown.outsideScanBreakdown.transportStatus));
  assert.ok(result.harnessBreakdown.stdoutParseMsByScenario.warmAvgMs >= 0);
  assert.ok(result.harnessBreakdown.bareNodeProcessAvgMs >= 0);
  assert.ok(result.harnessBreakdown.cliBootstrapNoCommandAvgMs >= 0);
  assert.ok(result.harnessBreakdown.cliBootstrapResidualAvgMs >= 0);
  assert.ok(result.harnessBreakdown.artifactWriteMs >= 0);
  assert.ok(fs.existsSync(result.artifacts.latestPath));
});

test("legacy bench:cache wrapper still resolves to the new scan-cache suite", () => {
  const result = runScript(path.join("scripts", "benchmark-cache.mjs"));
  assert.equal(result.kind, "scan-cache-bench");
  assert.ok(fs.existsSync(result.artifacts.latestPath));
});

test("extract benchmark script emits file-type metrics for the v1 fixtures", () => {
  const result = runScript(path.join("benchmarks", "scripts", "extract.mjs"));
  assert.equal(result.kind, "extract-bench-suite");
  assert.equal(result.fixtures.length, 3);
  for (const fixture of result.fixtures) {
    assert.ok(fixture.rawBytes > 0);
    assert.ok(fixture.extractBytes > 0);
    assert.equal(typeof fixture.reductionPct, "number");
    assert.ok(["raw", "compressed", "hybrid"].includes(fixture.mode));
  }
  assert.ok(fs.existsSync(result.artifacts.latestPath));
});

test("small raw benchmark fixture uses original-source minimal payload", () => {
  const file = path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx");
  const extracted = extractFile(file);
  const payload = toModelFacingPayload(extracted, repoRoot);
  assert.equal(extracted.mode, "raw");
  assert.equal(extracted.useOriginal, true);
  assert.equal(extracted.meta.rawSizeBytes, 356);
  assert.deepEqual(payload, {
    mode: "raw",
    filePath: path.join("fixtures", "raw", "SimpleButton.tsx"),
    useOriginal: true,
    rawText: fs.readFileSync(file, "utf8"),
  });
});

test("gate benchmark script evaluates preservation and mode-decision checks", () => {
  const result = runScript(path.join("benchmarks", "scripts", "gate.mjs"));
  assert.equal(result.kind, "gate-summary");
  assert.equal(result.preservation.fixtures.length, 3);
  assert.equal(result.modeDecision.fixtures.length, 3);
  assert.equal(typeof result.gates.passed, "boolean");
  assert.ok(result.gates.results.length >= 8);
});

test("run-all benchmark script emits the canonical envelope", () => {
  const result = runScript(path.join("benchmarks", "scripts", "run-all.mjs"));
  assert.equal(result.benchmarkVersion, "1.0.0");
  assert.equal(result.fixtureSetVersion, "v1");
  assert.ok(result.runId);
  assert.ok(result.gitSha);
  assert.ok(result.suites.scanCache);
  assert.ok(result.suites.scanCache.harnessBreakdown.stdoutParseMsByScenario.warmAvgMs >= 0);
  assert.ok(result.suites.scanCache.harnessBreakdown.bareNodeProcessAvgMs >= 0);
  assert.ok(result.suites.scanCache.harnessBreakdown.cliBootstrapNoCommandAvgMs >= 0);
  assert.ok(result.suites.scanCache.harnessBreakdown.cliBootstrapResidualAvgMs >= 0);
  assert.ok(result.suites.scanCache.harnessBreakdown.artifactWriteMs >= 0);
  assert.ok(result.suites.scanCache.runs.warm.runtimeBreakdown.outsideScanBreakdown.commandPathMeasuredMs >= 0);
  assert.ok(Array.isArray(result.suites.extract));
  assert.ok(result.suites.stability);
  assert.ok(result.suites.preservation);
  assert.ok(result.suites.modeDecision);
  assert.ok(result.gates);
  assert.ok(fs.existsSync(result.artifacts.latestPath));
});
