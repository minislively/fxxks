#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { ExtractionResult } from "../core/schema";

function print(value: unknown): void {
  console.log(JSON.stringify(value));
}

function roundMs(value: number): number {
  return Number(value.toFixed(2));
}

async function timedImport<T>(specifier: string): Promise<{ module: T; durationMs: number }> {
  const startedAt = performance.now();
  const module = (await import(specifier)) as T;
  return { module, durationMs: roundMs(performance.now() - startedAt) };
}

function printWithTimings(value: unknown): { resultSerializeMs: number; stdoutWriteMs: number } {
  const serializeStartedAt = performance.now();
  const serialized = JSON.stringify(value, null, 2);
  const resultSerializeMs = roundMs(performance.now() - serializeStartedAt);
  const stdoutStartedAt = performance.now();
  process.stdout.write(`${serialized}\n`);
  const stdoutWriteMs = roundMs(performance.now() - stdoutStartedAt);
  return { resultSerializeMs, stdoutWriteMs };
}

function maybeWriteBenchTiming(
  command: string,
  breakdown: Record<string, number>,
): void {
  const timingPath = process.env.FOOKS_BENCH_TIMING_PATH?.trim();
  if (!timingPath) {
    return;
  }

  try {
    fs.writeFileSync(
      timingPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          command,
          commandPathBreakdown: breakdown,
        },
        null,
        2,
      ),
    );
  } catch {
    // Benchmark-only transport failures must never change default CLI behavior.
  }
}

function requireFilePath(maybePath: string | undefined): string {
  if (!maybePath) {
    throw new Error("Missing file path argument");
  }
  const fullPath = path.resolve(maybePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${maybePath}`);
  }
  return fullPath;
}

function asBase(result: ExtractionResult): Omit<ExtractionResult, "mode"> {
  const { mode: _mode, ...rest } = result;
  return rest;
}

async function resolveAttachSampleFile(cwd = process.cwd()): Promise<string> {
  const { discoverProjectFiles } = await import("../core/discover.js");
  const target = discoverProjectFiles(cwd).find((item) => item.kind === "component");
  if (!target) {
    throw new Error("No React/TSX component file found for attach contract proof");
  }
  return target.filePath;
}

async function initializeProject(cwd = process.cwd()): Promise<{ config: string; cacheDir: string; created: boolean }> {
  const { ensureProjectDataDirs, configPath } = await import("../core/paths.js");
  ensureProjectDataDirs(cwd);
  const config = configPath(cwd);
  const created = !fs.existsSync(config);
  if (created) {
    fs.writeFileSync(
      config,
      JSON.stringify(
        {
          version: 1,
          createdAt: new Date().toISOString(),
          targetAccount: process.env.FOOKS_TARGET_ACCOUNT ?? "minislively",
        },
        null,
        2,
      ),
    );
  }
  return { config, cacheDir: path.join(cwd, ".fooks", "cache"), created };
}

type SetupState = "ready" | "partial" | "blocked";

async function runSetup(displayCliName: string, cwd = process.cwd()): Promise<Record<string, unknown>> {
  const initialized = await initializeProject(cwd);
  const blockers: string[] = [];

  let sampleFile: string | null = null;
  try {
    sampleFile = await resolveAttachSampleFile(cwd);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }

  if (!sampleFile) {
    const { readCodexTrustStatus } = await import("../adapters/codex-runtime-trust.js");
    return {
      command: "setup",
      runtime: "codex",
      ready: false,
      state: "blocked" satisfies SetupState,
      initialized,
      attach: null,
      hooks: null,
      status: readCodexTrustStatus(cwd),
      blockers,
      nextSteps: [
        "Add a React/TSX component to this project, then run fooks setup again.",
        "For non-React projects, use fooks extract/scan manually only if you know the files are supported.",
      ],
    };
  }

  const [{ attachCodex }, { installCodexHookPreset }, { readCodexTrustStatus }] = await Promise.all([
    import("../adapters/codex.js"),
    import("../adapters/codex-hook-preset.js"),
    import("../adapters/codex-runtime-trust.js"),
  ]);

  const bridgeCommand = `${displayCliName} codex-runtime-hook --native-hook`;
  const attach = attachCodex(sampleFile, cwd, bridgeCommand);
  if (attach.runtimeProof.status === "blocked") {
    blockers.push(attach.runtimeProof.blocker ?? "Codex attach blocked");
  }

  let hooks: ReturnType<typeof installCodexHookPreset> | null = null;
  try {
    hooks = installCodexHookPreset(displayCliName);
  } catch (error) {
    blockers.push(`Codex hook preset install failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const status = readCodexTrustStatus(cwd);
  const allHookEventsReady = hooks ? hooks.installedEvents.length + hooks.skippedEvents.length === 3 : false;
  const ready =
    attach.runtimeProof.status === "passed" &&
    allHookEventsReady &&
    status.connectionState === "connected" &&
    status.lifecycleState === "ready";
  const state: SetupState = ready ? "ready" : "partial";

  return {
    command: "setup",
    runtime: "codex",
    ready,
    state,
    initialized,
    attach,
    hooks,
    status,
    blockers,
    nextSteps: ready
      ? [
          "Open Codex in this repo and work normally; fooks will run through the installed Codex hooks.",
          "Use fooks status codex if you want to inspect the runtime trust state.",
        ]
      : [
          "Fix setup blockers, then run fooks setup again.",
          "Use fooks status codex for current runtime state and inspect the blockers field above.",
        ],
  };
}

function parseExtractArgs(args: string[]): { filePath: string; modelPayload: boolean } {
  let filePath: string | undefined;
  let modelPayload = false;

  for (const arg of args) {
    if (arg === "--model-payload") {
      modelPayload = true;
      continue;
    }
    if (arg === "--json") {
      continue;
    }
    if (!filePath) {
      filePath = arg;
      continue;
    }
    throw new Error(`Unexpected extract argument: ${arg}`);
  }

  return { filePath: requireFilePath(filePath), modelPayload };
}

function parseCodexRuntimeHookArgs(args: string[]): {
  nativeHook: boolean;
  event: "SessionStart" | "UserPromptSubmit" | "Stop";
  prompt?: string;
  sessionId?: string;
  threadId?: string;
  turnId?: string;
} {
  let nativeHook = false;
  let event: "SessionStart" | "UserPromptSubmit" | "Stop" | undefined;
  let prompt: string | undefined;
  let sessionId: string | undefined;
  let threadId: string | undefined;
  let turnId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--json":
        break;
      case "--native-hook":
        nativeHook = true;
        break;
      case "--event":
        event = args[index + 1] as typeof event;
        index += 1;
        break;
      case "--prompt":
        prompt = args[index + 1];
        index += 1;
        break;
      case "--session-id":
        sessionId = args[index + 1];
        index += 1;
        break;
      case "--thread-id":
        threadId = args[index + 1];
        index += 1;
        break;
      case "--turn-id":
        turnId = args[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`Unexpected codex-runtime-hook argument: ${arg}`);
    }
  }

  if (nativeHook) {
    return { nativeHook, event: "SessionStart", prompt, sessionId, threadId, turnId };
  }

  if (event !== "SessionStart" && event !== "UserPromptSubmit" && event !== "Stop") {
    throw new Error("codex-runtime-hook requires --event <SessionStart|UserPromptSubmit|Stop>");
  }

  return { nativeHook, event, prompt, sessionId, threadId, turnId };
}

async function readStdinJson(): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function isRecognizedCliName(name: string): boolean {
  return name === "fooks";
}

async function run(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const [arg1] = rest;
  const invokedName = path.basename(process.argv[1] ?? "fooks");
  const cliName = isRecognizedCliName(invokedName) ? invokedName : "fooks";
  const displayCliName = cliName;
  const commandStartedAt = performance.now();

  switch (command) {
    case "init": {
      const { config, cacheDir } = await initializeProject(process.cwd());
      print({ config, cacheDir });
      return;
    }
    case "setup": {
      print(await runSetup(displayCliName, process.cwd()));
      return;
    }
    case "run": {
      const { runTask } = await import("./run.js");
      const prompt = rest.join(" ");
      if (!prompt) {
        console.error("Usage: fooks run <prompt>");
        process.exit(1);
      }
      const result = await runTask({ prompt });
      if (result.success) {
        console.log(`✓ Done: ${(result.durationMs / 1000).toFixed(1)}s, processed ${result.filesProcessed} files, estimated extraction opportunity ${result.reductionPercent}%`);
      } else {
        console.error(`✗ Failed: ${result.error}`);
        console.error("Fix: Check file syntax or run with --mode=raw");
        process.exit(1);
      }
      return;
    }
    case "scan": {
      const pathsImport = await timedImport<typeof import("../core/paths")>("../core/paths.js");
      const scanImport = await timedImport<typeof import("../core/scan")>("../core/scan.js");
      const ensureProjectDataDirsStartedAt = performance.now();
      pathsImport.module.ensureProjectDataDirs();
      const ensureProjectDataDirsMs = roundMs(performance.now() - ensureProjectDataDirsStartedAt);
      const commandDispatchMs = roundMs(performance.now() - commandStartedAt);
      const commandDispatchResidualMs = roundMs(Math.max(0, commandDispatchMs - pathsImport.durationMs - scanImport.durationMs - ensureProjectDataDirsMs));
      const result = scanImport.module.scanProject();
      const { resultSerializeMs, stdoutWriteMs } = printWithTimings(result);
      maybeWriteBenchTiming("scan", {
        commandDispatchMs,
        pathsModuleImportMs: pathsImport.durationMs,
        scanModuleImportMs: scanImport.durationMs,
        ensureProjectDataDirsMs,
        commandDispatchResidualMs,
        resultSerializeMs,
        stdoutWriteMs,
      });
      return;
    }
    case "extract": {
      const { extractFile } = await import("../core/extract.js");
      const { filePath: file, modelPayload } = parseExtractArgs(rest);
      const result = extractFile(file);
      if (modelPayload) {
        const { toModelFacingPayload } = await import("../core/payload/model-facing.js");
        print(toModelFacingPayload(result));
        return;
      }
      print(result);
      return;
    }
    case "decide": {
      const [{ extractFile }, { decideMode }] = await Promise.all([
        import("../core/extract.js"),
        import("../core/decide.js"),
      ]);
      const file = requireFilePath(arg1);
      const extracted = extractFile(file);
      const result = decideMode(asBase(extracted));
      print({ filePath: file, ...result });
      return;
    }
    case "attach": {
      const runtime = arg1;
      if (runtime !== "codex" && runtime !== "claude") {
        throw new Error("attach expects 'codex' or 'claude'");
      }
      const sampleFile = await resolveAttachSampleFile();
      const result =
        runtime === "codex"
          ? (await import("../adapters/codex.js")).attachCodex(
              sampleFile,
              process.cwd(),
              `${displayCliName} codex-runtime-hook --native-hook`,
            )
          : (await import("../adapters/claude.js")).attachClaude(sampleFile);
      print(result);
      return;
    }
    case "install": {
      if (arg1 !== "codex-hooks") {
        throw new Error("install expects 'codex-hooks'");
      }
      const { installCodexHookPreset } = await import("../adapters/codex-hook-preset.js");
      print(installCodexHookPreset(displayCliName));
      return;
    }
    case "status": {
      if (arg1 === "codex") {
        const { readCodexTrustStatus } = await import("../adapters/codex-runtime-trust.js");
        print(readCodexTrustStatus(process.cwd()));
        return;
      }
      if (arg1 === "cache") {
        const { canonicalProjectDataDir } = await import("../core/paths.js");
        const { CacheMonitor } = await import("../core/cache-monitor.js");
        const monitor = new CacheMonitor(canonicalProjectDataDir(process.cwd()));
        print(monitor.healthReport());
        return;
      }
      throw new Error("status expects 'codex' or 'cache'");
    }
    case "codex-pre-read": {
      const { decideCodexPreRead } = await import("../adapters/codex-pre-read.js");
      const file = requireFilePath(arg1);
      print(decideCodexPreRead(file, process.cwd()));
      return;
    }
    case "codex-runtime-hook": {
      const { handleCodexRuntimeHook } = await import("../adapters/codex-runtime-hook.js");
      const options = parseCodexRuntimeHookArgs(rest);
      if (options.nativeHook) {
        const { handleCodexNativeHookPayload } = await import("../adapters/codex-native-hook.js");
        const payload = await readStdinJson();
        const output = handleCodexNativeHookPayload(payload, process.cwd());
        if (output) {
          print(output);
        }
        return;
      }
      print(
        handleCodexRuntimeHook(
          {
            hookEventName: options.event,
            prompt: options.prompt,
            sessionId: options.sessionId,
            threadId: options.threadId,
            turnId: options.turnId,
          },
          process.cwd(),
        ),
      );
      return;
    }
    default:
      console.error(`Unknown command: ${command ?? "<none>"}`);
      console.error(`Usage: ${displayCliName} <init|setup|run|scan|extract|decide|attach|install|status|codex-pre-read|codex-runtime-hook>`);
      console.error(`       ${displayCliName} setup`);
      console.error(`       ${displayCliName} run <prompt>`);
      console.error(`       ${displayCliName} extract <file> [--model-payload] [--json]`);
      console.error(`       ${displayCliName} install codex-hooks`);
      console.error(`       ${displayCliName} codex-pre-read <file> [--json]`);
      console.error(`       ${displayCliName} status codex
       ${displayCliName} status cache`);
      console.error(`       ${displayCliName} codex-runtime-hook --event <SessionStart|UserPromptSubmit|Stop> [--session-id <id>] [--prompt <text>] [--json]`);
      console.error(`       ${displayCliName} codex-runtime-hook --native-hook`);
      process.exitCode = 1;
  }
}

void run();
