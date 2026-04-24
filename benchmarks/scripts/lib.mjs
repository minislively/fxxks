import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { execFileSync, execSync, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, "../..");
export const benchmarksRoot = path.join(repoRoot, "benchmarks");
export const resultsRoot = path.join(benchmarksRoot, "results");
export const latestResultsRoot = path.join(resultsRoot, "latest");
export const historyResultsRoot = path.join(resultsRoot, "history");
export const benchmarkVersion = "1.0.0";
export const defaultRepeatCount = 10;
export const defaultFixtureCopyCount = 20;

const require = createRequire(import.meta.url);
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const helperServerPath = path.join(benchmarksRoot, "scripts", "scan-helper-server.mjs");
const helperClientPath = path.join(benchmarksRoot, "scripts", "scan-helper-client.mjs");
const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const { decideMode } = require(path.join(repoRoot, "dist", "core", "decide.js"));
const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));

function runProcess(command, args, { cwd = repoRoot, env = process.env } = {}) {
  const startedAt = performance.now();
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8" });
  return {
    durationMs: round(performance.now() - startedAt),
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runBareNodeProcess(cwd = repoRoot) {
  return runProcess(process.execPath, ["-e", "0"], { cwd });
}

function runCliBootstrapNoCommand(cwd = repoRoot) {
  return runProcess(process.execPath, [cliPath], { cwd });
}

function connectToHelper(socketPath, payload) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let raw = "";
    let settled = false;
    socket.setEncoding("utf8");
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    socket.on("connect", () => {
      socket.write(`${JSON.stringify(payload)}\n`);
    });
    socket.on("data", (chunk) => {
      raw += chunk;
      if (!raw.includes("\n")) return;
      socket.end();
      try {
        finish(resolve)(JSON.parse(raw.trim()));
      } catch (error) {
        finish(reject)(error);
      }
    });
    socket.on("error", finish(reject));
    socket.on("end", () => {
      if (!raw.trim()) {
        finish(reject)(new Error("Helper closed without a payload"));
      }
    });
  });
}

async function waitForHelperReady(socketPath, deadlineMs = 3000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < deadlineMs) {
    try {
      const response = await connectToHelper(socketPath, { command: "ping" });
      if (response?.ok) {
        return round(performance.now() - startedAt);
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error(`Timed out waiting for helper readiness at ${socketPath}`);
}

function makeHelperSocketPath() {
  const tempRoot = process.platform === "darwin" ? "/tmp" : os.tmpdir();
  const dir = fs.mkdtempSync(path.join(tempRoot, "fh-"));
  return {
    dir,
    socketPath: path.join(dir, "s.sock"),
  };
}

async function startHelperServer() {
  const { dir, socketPath } = makeHelperSocketPath();
  const startedAt = performance.now();
  const helper = spawn(process.execPath, [helperServerPath, socketPath], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "pipe"],
    env: process.env,
  });
  let stderr = "";
  let spawnError = null;
  let exitedEarly = false;
  helper.stderr.setEncoding("utf8");
  helper.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  helper.on("error", (error) => {
    spawnError = error;
  });
  helper.once("exit", () => {
    exitedEarly = true;
  });
  try {
    const readyMs = await waitForHelperReady(socketPath);
    return {
      dir,
      socketPath,
      process: helper,
      startupMs: round(performance.now() - startedAt),
      readyMs,
      stop: async () => {
        try {
          await connectToHelper(socketPath, { command: "shutdown" });
        } catch {
          // Ignore shutdown RPC failures and terminate below.
        }
        if (helper.exitCode === null && helper.signalCode === null && !helper.killed) {
          helper.kill();
        }
        if (helper.exitCode === null && helper.signalCode === null) {
          await new Promise((resolve) => helper.once("exit", resolve));
        }
        fs.rmSync(dir, { recursive: true, force: true });
        helper.stderr.removeAllListeners();
      },
    };
  } catch (error) {
    if (helper.exitCode === null && helper.signalCode === null && !helper.killed) {
      helper.kill();
    }
    if (helper.exitCode === null && helper.signalCode === null) {
      await new Promise((resolve) => helper.once("exit", resolve));
    }
    fs.rmSync(dir, { recursive: true, force: true });
    helper.stderr.removeAllListeners();
    const details = [
      `socket=${socketPath}`,
      `exitCode=${helper.exitCode ?? "null"}`,
      `signal=${helper.signalCode ?? "null"}`,
      `exitedEarly=${exitedEarly}`,
    ];
    if (spawnError) {
      details.push(`spawnError=${spawnError.message}`);
    }
    if (stderr.trim()) {
      details.push(`stderr=${stderr.trim()}`);
    }
    throw new Error(`Failed to start benchmark helper (${details.join(", ")})`, { cause: error });
  }
}

async function runDirectHelperScan(socketPath, cwd) {
  const startedAt = performance.now();
  const response = await connectToHelper(socketPath, { command: "scan", cwd });
  const cliWallMs = round(performance.now() - startedAt);
  return {
    cliWallMs,
    stdoutParseMs: 0,
    value: response.result,
    timingPayload: {
      status: "captured",
      commandPathBreakdown: {
        commandDispatchMs: round(response.commandPathBreakdown?.helperRequestMs ?? cliWallMs),
        ...response.commandPathBreakdown,
      },
    },
  };
}

function runHelperLauncherScan(socketPath, cwd) {
  const timingDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-helper-launcher-"));
  const timingPath = path.join(timingDir, "launcher-timing.json");
  try {
    const cliExecution = measure(() => execFileSync(process.execPath, [helperClientPath, socketPath, cwd], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, FOOKS_BENCH_TIMING_PATH: timingPath },
    }));
    const stdoutParse = measure(() => JSON.parse(cliExecution.value));
    const timingPayload = readBenchTimingPayload(timingPath);
    return {
      cliWallMs: cliExecution.durationMs,
      stdoutParseMs: stdoutParse.durationMs,
      value: stdoutParse.value,
      timingPayload,
    };
  } finally {
    fs.rmSync(timingDir, { recursive: true, force: true });
  }
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values, avg) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function relativeToRepo(filePath) {
  return path.relative(repoRoot, filePath) || path.basename(filePath);
}

export function relativeToCwd(filePath, cwd) {
  return path.relative(cwd, filePath) || path.basename(filePath);
}

export function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

export function resolveRepeatCount() {
  const raw = Number(process.env.FOOKS_BENCH_REPEAT_COUNT ?? defaultRepeatCount);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : defaultRepeatCount;
}

export function resolveFixtureCopyCount() {
  const raw = Number(process.env.FOOKS_BENCH_COPY_COUNT ?? defaultFixtureCopyCount);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : defaultFixtureCopyCount;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadFixtureSet() {
  return readJson(path.join(benchmarksRoot, "fixtures", "phase1-fixtures.json"));
}

export function loadPreservationExpectations() {
  return readJson(path.join(benchmarksRoot, "expected", "preservation.json"));
}

export function loadModeExpectations() {
  return readJson(path.join(benchmarksRoot, "expected", "modes.json"));
}

export function ensureResultsDirs() {
  fs.mkdirSync(latestResultsRoot, { recursive: true });
  fs.mkdirSync(historyResultsRoot, { recursive: true });
}

export function benchmarkMetadata({ runId, fixtureSetVersion }) {
  let gitSha = "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    gitSha = "unknown";
  }

  return {
    benchmarkVersion,
    runId,
    gitSha,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    fixtureSetVersion,
  };
}

export function createEnvelope({ runId, fixtureSetVersion, suites, gates }) {
  return {
    ...benchmarkMetadata({ runId, fixtureSetVersion }),
    suites,
    gates,
  };
}

export function writeResultArtifacts(fileName, payload, runId = payload.runId ?? new Date().toISOString()) {
  ensureResultsDirs();
  const latestPath = path.join(latestResultsRoot, fileName);
  const historyPath = path.join(historyResultsRoot, `${runId.replace(/[:.]/g, "-")}-${fileName}`);
  const serialize = measure(() => JSON.stringify(payload, null, 2));
  const latestWrite = measure(() => fs.writeFileSync(latestPath, serialize.value));
  const historyWrite = measure(() => fs.writeFileSync(historyPath, serialize.value));
  return {
    latestPath,
    historyPath,
    harnessBreakdown: {
      artifactSerializeMs: serialize.durationMs,
      latestArtifactWriteMs: latestWrite.durationMs,
      historyArtifactWriteMs: historyWrite.durationMs,
      artifactWriteMs: round(latestWrite.durationMs + historyWrite.durationMs),
    },
  };
}

export function mergeHarnessBreakdown(base = {}, addition = {}) {
  const merged = { ...base, ...addition };
  if (base?.stdoutParseMsByScenario || addition?.stdoutParseMsByScenario) {
    merged.stdoutParseMsByScenario = {
      ...(base?.stdoutParseMsByScenario ?? {}),
      ...(addition?.stdoutParseMsByScenario ?? {}),
    };
  }
  return merged;
}

export function summariseNumbers(values) {
  const avg = mean(values);
  return {
    avgMs: round(avg),
    minMs: round(Math.min(...values)),
    maxMs: round(Math.max(...values)),
    stddevMs: round(stddev(values, avg)),
  };
}

export function aggregateScenario(samples) {
  const durations = samples.map((sample) => sample.durationMs);
  const counts = samples[0];
  const summary = summariseNumbers(durations);
  const observability = aggregateObservability(samples.map((sample) => sample.observability).filter(Boolean));
  const commandPathBreakdown = aggregateNumericObjects(samples.map((sample) => sample.commandPathBreakdown), {});
  const transportStatuses = samples.map((sample) => sample.timingTransportStatus);
  const runtimeBreakdown = deriveRuntimeBreakdown(summary.avgMs, observability, commandPathBreakdown, transportStatuses);
  return {
    ...summary,
    fileCount: counts.fileCount,
    changedFileCount: counts.changedFileCount,
    cacheHitCount: counts.cacheHitCount,
    cacheMissCount: counts.cacheMissCount,
    invalidatedFileCount: counts.invalidatedFileCount,
    observability,
    runtimeBreakdown,
  };
}

function aggregateNumericObjects(samples, fallback = {}) {
  if (!samples.length) return fallback;
  const keys = new Set(samples.flatMap((sample) => Object.keys(sample ?? {})));
  return Object.fromEntries(
    [...keys].map((key) => {
      const values = samples.map((sample) => sample?.[key]).filter((value) => typeof value === "number");
      return [key, values.length ? round(mean(values)) : fallback[key]];
    }),
  );
}

function aggregateObservability(samples) {
  if (!samples.length) return undefined;
  return {
    timingsMs: aggregateNumericObjects(samples.map((sample) => sample.timingsMs), {}),
    counters: aggregateNumericObjects(samples.map((sample) => sample.counters), {}),
    discovery: aggregateNumericObjects(samples.map((sample) => sample.discovery), {}),
    slowFiles: samples.find((sample) => Array.isArray(sample.slowFiles) && sample.slowFiles.length)?.slowFiles ?? [],
  };
}

function aggregateTransportStatus(statuses) {
  if (!statuses.length) return "missing";
  if (statuses.every((status) => status === "captured")) return "captured";
  if (statuses.some((status) => status === "captured")) return "partial";
  if (statuses.some((status) => status === "invalid")) return "invalid";
  return "missing";
}

function deriveRuntimeBreakdown(cliWallMs, observability, commandPathBreakdown = {}, transportStatuses = []) {
  const scanCoreMs = round(observability?.timingsMs?.total ?? 0);
  const outsideScanMs = round(Math.max(0, cliWallMs - scanCoreMs));
  const commandDispatchMs = round(commandPathBreakdown.commandDispatchMs ?? 0);
  const pathsModuleImportMs = round(commandPathBreakdown.pathsModuleImportMs ?? 0);
  const scanModuleImportMs = round(commandPathBreakdown.scanModuleImportMs ?? 0);
  const ensureProjectDataDirsMs = round(commandPathBreakdown.ensureProjectDataDirsMs ?? 0);
  const commandDispatchResidualMs = round(commandPathBreakdown.commandDispatchResidualMs ?? Math.max(0, commandDispatchMs - pathsModuleImportMs - scanModuleImportMs - ensureProjectDataDirsMs));
  const resultSerializeMs = round(commandPathBreakdown.resultSerializeMs ?? 0);
  const stdoutWriteMs = round(commandPathBreakdown.stdoutWriteMs ?? 0);
  const commandPathMeasuredMs = round(commandDispatchMs + resultSerializeMs + stdoutWriteMs);
  const commandPathUnattributedMs = round(Math.max(0, outsideScanMs - commandPathMeasuredMs));
  return {
    cliWallMs: round(cliWallMs),
    scanCoreMs,
    outsideScanMs,
    scanCoreRatio: cliWallMs > 0 ? round(scanCoreMs / cliWallMs, 4) : 0,
    outsideScanRatio: cliWallMs > 0 ? round(outsideScanMs / cliWallMs, 4) : 0,
    outsideScanBreakdown: {
      commandDispatchMs,
      pathsModuleImportMs,
      scanModuleImportMs,
      ensureProjectDataDirsMs,
      commandDispatchResidualMs,
      resultSerializeMs,
      stdoutWriteMs,
      commandPathMeasuredMs,
      commandPathUnattributedMs,
      transportStatus: aggregateTransportStatus(transportStatuses),
    },
  };
}

function readBenchTimingPayload(timingPath) {
  if (!fs.existsSync(timingPath)) {
    return { status: "missing", commandPathBreakdown: {} };
  }

  try {
    const payload = JSON.parse(fs.readFileSync(timingPath, "utf8"));
    return {
      status: payload?.schemaVersion === 1 && typeof payload?.commandPathBreakdown === "object" ? "captured" : "invalid",
      commandPathBreakdown: payload?.commandPathBreakdown ?? {},
    };
  } catch {
    return { status: "invalid", commandPathBreakdown: {} };
  } finally {
    fs.rmSync(timingPath, { force: true });
  }
}

function runCliJsonWithTiming(args, cwd = repoRoot, envOverrides = {}) {
  const timingDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-bench-timing-"));
  const timingPath = path.join(timingDir, "command-path.json");
  try {
    const cliExecution = measure(() => execFileSync(process.execPath, [cliPath, ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...envOverrides, FOOKS_BENCH_TIMING_PATH: timingPath },
    }));
    const stdoutParse = measure(() => JSON.parse(cliExecution.value));
    const timingPayload = readBenchTimingPayload(timingPath);
    return {
      cliWallMs: cliExecution.durationMs,
      stdoutParseMs: stdoutParse.durationMs,
      value: stdoutParse.value,
      timingPayload,
    };
  } finally {
    fs.rmSync(timingDir, { recursive: true, force: true });
  }
}

export function measure(fn) {
  const startedAt = performance.now();
  const value = fn();
  return {
    durationMs: round(performance.now() - startedAt),
    value,
  };
}

export function makeBenchmarkProject(copyCount = resolveFixtureCopyCount()) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-bench-"));
  const componentsDir = path.join(tempDir, "src", "components");
  fs.mkdirSync(componentsDir, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "Button.types.ts"), path.join(componentsDir, "Button.types.ts"));
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "fooks-benchmark",
        repository: { url: "https://github.com/minislively/fooks-benchmark.git" },
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < copyCount; index += 1) {
    const simpleSource = `${fs.readFileSync(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), "utf8").trimEnd()}\n// benchmark-simple-copy:${index}\n`;
    fs.writeFileSync(path.join(componentsDir, `SimpleButton${index}.tsx`), simpleSource);

    const utilBaseName = `FormSection${index}.utils`;
    const formSource = fs
      .readFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), "utf8")
      .replace("./FormSection.utils", `./${utilBaseName}`);
    const utilSource = `${fs.readFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.utils.ts"), "utf8").trimEnd()}\n// benchmark-form-util-copy:${index}\n`;
    fs.writeFileSync(path.join(componentsDir, `${utilBaseName}.ts`), utilSource);
    fs.writeFileSync(path.join(componentsDir, `FormSection${index}.tsx`), `${formSource.trimEnd()}\n// benchmark-form-copy:${index}\n`);

    const dashboardSource = `${fs.readFileSync(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"), "utf8").trimEnd()}\n// benchmark-dashboard-copy:${index}\n`;
    fs.writeFileSync(path.join(componentsDir, `DashboardPanel${index}.tsx`), dashboardSource);
  }

  return tempDir;
}

export function appendMarker(filePath, marker) {
  const source = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, `${source.trimEnd()}\n${marker}\n`);
}

export function clearProjectState(cwd) {
  fs.rmSync(path.join(cwd, ".fooks"), { recursive: true, force: true });
}

export function runScanScenario(cwd, changedFileCount = 0, invalidatedFileCount = 0) {
  const { cliWallMs, stdoutParseMs, value, timingPayload } = runCliJsonWithTiming(["scan"], cwd);
  return {
    durationMs: cliWallMs,
    fileCount: value.files.length,
    changedFileCount,
    cacheHitCount: value.reusedCacheEntries,
    cacheMissCount: value.refreshedEntries,
    invalidatedFileCount,
    stdoutParseMs,
    commandPathBreakdown: timingPayload.commandPathBreakdown,
    timingTransportStatus: timingPayload.status,
    observability: value.observability,
    result: value,
  };
}

function toScenarioSample(execution, changedFileCount = 0, invalidatedFileCount = 0) {
  return {
    durationMs: execution.cliWallMs,
    fileCount: execution.value.files.length,
    changedFileCount,
    cacheHitCount: execution.value.reusedCacheEntries,
    cacheMissCount: execution.value.refreshedEntries,
    invalidatedFileCount,
    stdoutParseMs: execution.stdoutParseMs ?? 0,
    commandPathBreakdown: execution.timingPayload?.commandPathBreakdown ?? {},
    timingTransportStatus: execution.timingPayload?.status ?? "missing",
    observability: execution.value.observability,
    result: execution.value,
  };
}

export async function runProcessModelProbeSuite({ repeatCount = resolveRepeatCount() } = {}) {
  const currentCliSamples = [];
  const launcherToHelperSamples = [];
  const directHelperSamples = [];
  const helperStartupSamples = [];
  let totalFiles = 0;

  for (let index = 0; index < repeatCount; index += 1) {
    const benchmarkProject = makeBenchmarkProject();
    try {
      runScanScenario(benchmarkProject);
      const baselineWarm = runScanScenario(benchmarkProject);
      const helper = await startHelperServer();
      try {
        helperStartupSamples.push(helper.readyMs);
        const launcherToHelper = runHelperLauncherScan(helper.socketPath, benchmarkProject);
        const directHelper = await runDirectHelperScan(helper.socketPath, benchmarkProject);
        totalFiles = baselineWarm.fileCount;
        currentCliSamples.push(baselineWarm);
        launcherToHelperSamples.push(toScenarioSample(launcherToHelper));
        directHelperSamples.push(toScenarioSample(directHelper));
      } finally {
        await helper.stop();
      }
    } finally {
      fs.rmSync(benchmarkProject, { recursive: true, force: true });
    }
  }

  const runs = {
    currentCliWarm: aggregateScenario(currentCliSamples),
    launcherToHelperWarm: aggregateScenario(launcherToHelperSamples),
    directHelperWarm: aggregateScenario(directHelperSamples),
  };

  return {
    kind: "process-model-probe",
    layer: "cli-e2e",
    repeatCount,
    totalFiles,
    helperStartupAvgMs: round(mean(helperStartupSamples)),
    runs,
    deltas: {
      launcherVsCurrentWarmMs: round(runs.launcherToHelperWarm.avgMs - runs.currentCliWarm.avgMs),
      directVsCurrentWarmMs: round(runs.directHelperWarm.avgMs - runs.currentCliWarm.avgMs),
      launcherVsDirectMs: round(runs.launcherToHelperWarm.avgMs - runs.directHelperWarm.avgMs),
    },
  };
}

export function runScanCacheSuite({ repeatCount = resolveRepeatCount() } = {}) {
  const coldSamples = [];
  const warmSamples = [];
  const partialSingleSamples = [];
  const partialMultiSamples = [];
  const rescanAfterInvalidationSamples = [];
  let totalFiles = 0;
  let kindCounts = { components: 0, linkedTs: 0 };

  for (let index = 0; index < repeatCount; index += 1) {
    const benchmarkProject = makeBenchmarkProject();
    try {
      const cold = runScanScenario(benchmarkProject);
      const warm = runScanScenario(benchmarkProject);

      const singleFile = path.join(benchmarkProject, "src", "components", "DashboardPanel7.tsx");
      appendMarker(singleFile, `// benchmark-single-invalidation:${index}`);
      const partialSingle = runScanScenario(benchmarkProject, 1, 1);

      const multiFiles = [
        path.join(benchmarkProject, "src", "components", "FormSection7.tsx"),
        path.join(benchmarkProject, "src", "components", "SimpleButton7.tsx"),
      ];
      multiFiles.forEach((filePath, offset) => appendMarker(filePath, `// benchmark-multi-invalidation:${index}:${offset}`));
      const partialMulti = runScanScenario(benchmarkProject, multiFiles.length, multiFiles.length);

      clearProjectState(benchmarkProject);
      const rescanAfterInvalidation = runScanScenario(benchmarkProject, cold.fileCount, cold.fileCount);

      totalFiles = cold.fileCount;
      kindCounts = {
        components: cold.result.files.filter((item) => item.kind === "component").length,
        linkedTs: cold.result.files.filter((item) => item.kind === "linked-ts").length,
      };

      coldSamples.push({ ...cold, changedFileCount: cold.fileCount });
      warmSamples.push({ ...warm, changedFileCount: 0 });
      partialSingleSamples.push(partialSingle);
      partialMultiSamples.push(partialMulti);
      rescanAfterInvalidationSamples.push(rescanAfterInvalidation);
    } finally {
      fs.rmSync(benchmarkProject, { recursive: true, force: true });
    }
  }

  const runs = {
    cold: aggregateScenario(coldSamples),
    warm: aggregateScenario(warmSamples),
    partialSingle: aggregateScenario(partialSingleSamples),
    partialMulti: aggregateScenario(partialMultiSamples),
    rescanAfterInvalidation: aggregateScenario(rescanAfterInvalidationSamples),
  };

  const bareNodeSamples = [];
  const cliBootstrapSamples = [];

  for (let index = 0; index < repeatCount; index += 1) {
    const bareNode = runBareNodeProcess(repoRoot);
    const cliBootstrap = runCliBootstrapNoCommand(repoRoot);
    bareNodeSamples.push(bareNode.durationMs);
    cliBootstrapSamples.push(cliBootstrap.durationMs);
  }

  const bareNodeAvgMs = round(mean(bareNodeSamples));
  const cliBootstrapAvgMs = round(mean(cliBootstrapSamples));
  const cliBootstrapResidualMs = round(Math.max(0, cliBootstrapAvgMs - bareNodeAvgMs));

  const harnessBreakdown = {
    stdoutParseMsByScenario: {
      coldAvgMs: round(mean(coldSamples.map((sample) => sample.stdoutParseMs))),
      warmAvgMs: round(mean(warmSamples.map((sample) => sample.stdoutParseMs))),
      partialSingleAvgMs: round(mean(partialSingleSamples.map((sample) => sample.stdoutParseMs))),
      partialMultiAvgMs: round(mean(partialMultiSamples.map((sample) => sample.stdoutParseMs))),
      rescanAfterInvalidationAvgMs: round(mean(rescanAfterInvalidationSamples.map((sample) => sample.stdoutParseMs))),
    },
    bareNodeProcessAvgMs: bareNodeAvgMs,
    cliBootstrapNoCommandAvgMs: cliBootstrapAvgMs,
    cliBootstrapResidualAvgMs: cliBootstrapResidualMs,
  };

  return {
    kind: "scan-cache-bench",
    layer: "cli-e2e",
    repeatCount,
    totalFiles,
    kindCounts,
    harnessBreakdown,
    runs,
    ratios: {
      warmVsCold: round(runs.warm.avgMs / runs.cold.avgMs),
      partialSingleVsCold: round(runs.partialSingle.avgMs / runs.cold.avgMs),
      partialMultiVsCold: round(runs.partialMulti.avgMs / runs.cold.avgMs),
      rescanVsCold: round(runs.rescanAfterInvalidation.avgMs / runs.cold.avgMs),
    },
  };
}

function baseExtractionResult(result) {
  const { mode, ...rest } = result;
  return rest;
}

export function runExtractSuite() {
  const { fixtures } = loadFixtureSet();
  const records = fixtures.map((fixture) => {
    const absolutePath = path.join(repoRoot, fixture.filePath);
    const sourceBytes = Buffer.byteLength(fs.readFileSync(absolutePath, "utf8"), "utf8");
    const extraction = measure(() => extractFile(absolutePath));
    const decide = measure(() => decideMode(baseExtractionResult(extraction.value)));
    const extractBytes = Buffer.byteLength(JSON.stringify(extraction.value), "utf8");
    const modelPayload = toModelFacingPayload(extraction.value, repoRoot);
    const modelPayloadBytes = Buffer.byteLength(JSON.stringify(modelPayload), "utf8");

    return {
      kind: "extract-bench",
      layer: "core",
      fixtureId: fixture.id,
      file: fixture.filePath,
      type: fixture.type,
      rawBytes: sourceBytes,
      extractBytes,
      reductionPct: round((1 - (extractBytes / sourceBytes)) * 100),
      modelPayloadBytes,
      modelPayloadReductionPct: round((1 - (modelPayloadBytes / sourceBytes)) * 100),
      extractMs: extraction.durationMs,
      decideMs: decide.durationMs,
      mode: extraction.value.mode,
      componentName: extraction.value.componentName,
      importCount: extraction.value.meta.importCount,
    };
  });

  return {
    kind: "extract-bench-suite",
    layer: "core",
    fixtures: records,
  };
}

export function runStabilitySuite({ repeatCount = resolveRepeatCount(), scanScenarios } = {}) {
  const stableScanScenarios = scanScenarios ?? runScanCacheSuite({ repeatCount }).runs;
  const { fixtures } = loadFixtureSet();
  const extract = fixtures.map((fixture) => {
    const absolutePath = path.join(repoRoot, fixture.filePath);
    const extractTimings = [];
    const decideTimings = [];

    for (let index = 0; index < repeatCount; index += 1) {
      const extraction = measure(() => extractFile(absolutePath));
      const decision = measure(() => decideMode(baseExtractionResult(extraction.value)));
      extractTimings.push(extraction.durationMs);
      decideTimings.push(decision.durationMs);
    }

    return {
      fixtureId: fixture.id,
      file: fixture.filePath,
      type: fixture.type,
      extract: summariseNumbers(extractTimings),
      decide: summariseNumbers(decideTimings),
    };
  });

  return {
    kind: "stability-bench",
    repeatCount,
    scanScenarios: stableScanScenarios,
    extract,
  };
}

export function evaluatePreservation(extracted, expectation) {
  const exports = (expectation.exportNames ?? []).every((name) => extracted.exports.some((item) => item.name === name));
  const componentName = expectation.componentName ? extracted.componentName === expectation.componentName : true;
  const props = (expectation.propsPresent ?? []).every((prop) => (extracted.contract?.propsSummary ?? []).some((summary) => summary.includes(prop)));
  const hooks = (expectation.hookUsage ?? []).every((hook) => (extracted.behavior?.hooks ?? []).includes(hook));
  const styleSystem = expectation.styleSystem ? (extracted.style?.system ?? "unknown") === expectation.styleSystem : true;
  const importHint = typeof expectation.minimumImportCount === "number" ? extracted.meta.importCount >= expectation.minimumImportCount : true;

  const preserved = { exports, componentName, props, hooks, styleSystem, importHint };
  const values = Object.values(preserved);
  const preservedCount = values.filter(Boolean).length;

  return {
    passed: values.every(Boolean),
    preserved,
    preservedCount,
    preservationRate: round(preservedCount / values.length, 4),
  };
}

export function evaluateMode(actualMode, expectation) {
  const expectedModes = expectation.expectedModes ?? [];
  return {
    passed: expectedModes.includes(actualMode),
    expectedModes,
    actualMode,
  };
}

export function runGateSuite() {
  const { fixtures } = loadFixtureSet();
  const preservationExpectations = loadPreservationExpectations();
  const modeExpectations = loadModeExpectations();

  const preservation = [];
  const modeDecision = [];

  for (const fixture of fixtures) {
    const absolutePath = path.join(repoRoot, fixture.filePath);
    const extracted = extractFile(absolutePath);
    const preservationResult = evaluatePreservation(extracted, preservationExpectations[fixture.id] ?? {});
    const modeResult = evaluateMode(extracted.mode, modeExpectations[fixture.id] ?? {});

    preservation.push({
      fixtureId: fixture.id,
      file: fixture.filePath,
      type: fixture.type,
      ...preservationResult,
    });

    modeDecision.push({
      fixtureId: fixture.id,
      file: fixture.filePath,
      type: fixture.type,
      ...modeResult,
    });
  }

  return {
    kind: "gate-bench",
    preservation: {
      fixtures: preservation,
      passed: preservation.every((item) => item.passed),
    },
    modeDecision: {
      fixtures: modeDecision,
      passed: modeDecision.every((item) => item.passed),
    },
  };
}

export function computeFinalGates({ scanCache, extract, gateSuite }) {
  const results = [
    {
      name: "warmAvgMs <= coldAvgMs",
      passed: scanCache.runs.warm.avgMs <= scanCache.runs.cold.avgMs,
      actual: scanCache.runs.warm.avgMs,
      expected: `<= ${scanCache.runs.cold.avgMs}`,
    },
    {
      name: "partialSingleAvgMs <= coldAvgMs",
      passed: scanCache.runs.partialSingle.avgMs <= scanCache.runs.cold.avgMs,
      actual: scanCache.runs.partialSingle.avgMs,
      expected: `<= ${scanCache.runs.cold.avgMs}`,
    },
    ...extract.fixtures
      .map((fixture) => {
        const lowerBound = loadFixtureSet().fixtures.find((item) => item.id === fixture.fixtureId)?.reductionLowerBound;
        if (typeof lowerBound !== "number") {
          return null;
        }
        return {
          name: `${fixture.fixtureId} modelPayloadReductionPct >= lowerBound`,
          passed: (fixture.modelPayloadReductionPct ?? fixture.reductionPct) >= lowerBound,
          actual: fixture.modelPayloadReductionPct ?? fixture.reductionPct,
          expected: `>= ${lowerBound}`,
        };
      })
      .filter(Boolean),
    ...gateSuite.preservation.fixtures.map((fixture) => ({
      name: `${fixture.fixtureId} critical metadata preserved`,
      passed: fixture.passed,
      actual: fixture.preserved,
      expected: true,
    })),
    ...gateSuite.modeDecision.fixtures.map((fixture) => ({
      name: `${fixture.fixtureId} actualMode ∈ expectedModes`,
      passed: fixture.passed,
      actual: fixture.actualMode,
      expected: fixture.expectedModes,
    })),
  ];

  return {
    passed: results.every((item) => item.passed),
    results,
  };
}

export function printSummaryLines(lines) {
  for (const line of lines) {
    console.error(line);
  }
}

export function formatDispatchSubBreakdown(run) {
  const breakdown = run.runtimeBreakdown.outsideScanBreakdown;
  const parts = [];
  if (typeof breakdown.pathsModuleImportMs === "number") {
    parts.push(`paths import ${breakdown.pathsModuleImportMs}ms`);
  }
  if (typeof breakdown.scanModuleImportMs === "number") {
    parts.push(`scan import ${breakdown.scanModuleImportMs}ms`);
  }
  if (typeof breakdown.ensureProjectDataDirsMs === "number") {
    parts.push(`ensure dirs ${breakdown.ensureProjectDataDirsMs}ms`);
  }
  if (typeof breakdown.commandDispatchResidualMs === "number") {
    parts.push(`dispatch residual ${breakdown.commandDispatchResidualMs}ms`);
  }
  return parts.length ? parts.join(" / ") : "n/a";
}

export function formatOutsideScanBreakdown(run) {
  const breakdown = run.runtimeBreakdown.outsideScanBreakdown;
  return `dispatch ${breakdown.commandDispatchMs}ms / serialize ${breakdown.resultSerializeMs}ms / stdout ${breakdown.stdoutWriteMs}ms / unattributed ${breakdown.commandPathUnattributedMs}ms (${breakdown.transportStatus})`;
}

export function formatHarnessBreakdown(harnessBreakdown = {}) {
  const warmParse = harnessBreakdown.stdoutParseMsByScenario?.warmAvgMs;
  const artifactWriteMs = harnessBreakdown.artifactWriteMs;
  const bareNodeProcessAvgMs = harnessBreakdown.bareNodeProcessAvgMs;
  const cliBootstrapNoCommandAvgMs = harnessBreakdown.cliBootstrapNoCommandAvgMs;
  const cliBootstrapResidualAvgMs = harnessBreakdown.cliBootstrapResidualAvgMs;
  const parts = [];
  if (typeof warmParse === "number") {
    parts.push(`warm stdout parse ${warmParse}ms`);
  }
  if (typeof bareNodeProcessAvgMs === "number") {
    parts.push(`bare node ${bareNodeProcessAvgMs}ms`);
  }
  if (typeof cliBootstrapNoCommandAvgMs === "number") {
    parts.push(`cli bootstrap ${cliBootstrapNoCommandAvgMs}ms`);
  }
  if (typeof cliBootstrapResidualAvgMs === "number") {
    parts.push(`bootstrap residual ${cliBootstrapResidualAvgMs}ms`);
  }
  if (typeof artifactWriteMs === "number") {
    parts.push(`artifact write ${artifactWriteMs}ms`);
  }
  return parts.length ? parts.join(" / ") : "n/a";
}

export function scanCacheSummary(report, latestPath) {
  return [
    `fooks benchmark | scan-cache | latest: ${relativeToRepo(latestPath)}`,
    `- cold avg: ${report.runs.cold.avgMs}ms`,
    `- warm avg: ${report.runs.warm.avgMs}ms (${report.ratios.warmVsCold}x of cold)`,
    `- partial(single) avg: ${report.runs.partialSingle.avgMs}ms (${report.ratios.partialSingleVsCold}x of cold)`,
    `- partial(multi) avg: ${report.runs.partialMulti.avgMs}ms (${report.ratios.partialMultiVsCold}x of cold)`,
    `- rescan after invalidation avg: ${report.runs.rescanAfterInvalidation.avgMs}ms`,
    `- warm runtime split: cli ${report.runs.warm.runtimeBreakdown.cliWallMs}ms / scan ${report.runs.warm.runtimeBreakdown.scanCoreMs}ms / outside-scan ${report.runs.warm.runtimeBreakdown.outsideScanMs}ms`,
    `- warm outside-scan breakdown: ${formatOutsideScanBreakdown(report.runs.warm)}`,
    `- warm dispatch sub-breakdown: ${formatDispatchSubBreakdown(report.runs.warm)}`,
    `- harness overhead: ${formatHarnessBreakdown(report.harnessBreakdown)}`,
  ];
}

export function extractSummary(report, latestPath) {
  const lines = [
    `fooks benchmark | extract | latest: ${relativeToRepo(latestPath)}`,
  ];
  for (const fixture of report.fixtures) {
    lines.push(`- ${fixture.fixtureId}: ${fixture.mode}, ${fixture.reductionPct}% reduction, extract ${fixture.extractMs}ms, decide ${fixture.decideMs}ms`);
  }
  return lines;
}

export function stabilitySummary(report, latestPath) {
  return [
    `fooks benchmark | stability | latest: ${relativeToRepo(latestPath)}`,
    `- repeat count: ${report.repeatCount}`,
    `- cold avg/min/max: ${report.scanScenarios.cold.avgMs}/${report.scanScenarios.cold.minMs}/${report.scanScenarios.cold.maxMs}ms`,
    `- warm avg/min/max: ${report.scanScenarios.warm.avgMs}/${report.scanScenarios.warm.minMs}/${report.scanScenarios.warm.maxMs}ms`,
    ...report.extract.map((fixture) => `- ${fixture.fixtureId}: extract avg ${fixture.extract.avgMs}ms, decide avg ${fixture.decide.avgMs}ms`),
  ];
}

export function gateSummary(report, latestPath) {
  return [
    `fooks benchmark | gate | latest: ${relativeToRepo(latestPath)}`,
    `- preservation passed: ${report.preservation.passed}`,
    `- mode decision passed: ${report.modeDecision.passed}`,
  ];
}

export function processModelProbeSummary(report, latestPath) {
  return [
    `fooks benchmark | process-model-probe | latest: ${relativeToRepo(latestPath)}`,
    `- current warm avg: ${report.runs.currentCliWarm.avgMs}ms`,
    `- launcher -> helper warm avg: ${report.runs.launcherToHelperWarm.avgMs}ms`,
    `- direct helper warm avg: ${report.runs.directHelperWarm.avgMs}ms`,
    `- helper startup avg: ${report.helperStartupAvgMs}ms`,
    `- delta (launcher - current): ${report.deltas.launcherVsCurrentWarmMs}ms`,
    `- delta (direct - current): ${report.deltas.directVsCurrentWarmMs}ms`,
    `- delta (launcher - direct): ${report.deltas.launcherVsDirectMs}ms`,
  ];
}

export async function runAllSuites({ repeatCount = resolveRepeatCount() } = {}) {
  const fixtureSet = loadFixtureSet();
  const runId = new Date().toISOString();
  const scanCache = runScanCacheSuite({ repeatCount });
  const processModelProbe = await runProcessModelProbeSuite({ repeatCount });
  const extract = runExtractSuite();
  const stability = runStabilitySuite({ repeatCount, scanScenarios: scanCache.runs });
  const gateSuite = runGateSuite();
  const gates = computeFinalGates({ scanCache, extract, gateSuite });
  const envelope = createEnvelope({
    runId,
    fixtureSetVersion: fixtureSet.version,
    suites: {
      scanCache,
      processModelProbe,
      extract: extract.fixtures,
      stability,
      preservation: gateSuite.preservation,
      modeDecision: gateSuite.modeDecision,
    },
    gates,
  });
  return { runId, fixtureSetVersion: fixtureSet.version, envelope, scanCache, processModelProbe, extract, stability, gateSuite, gates };
}
