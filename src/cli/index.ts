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
          targetAccount: process.env.FOOKS_TARGET_ACCOUNT ?? "<your-github-org>",
        },
        null,
        2,
      ),
    );
  }
  return { config, cacheDir: path.join(cwd, ".fooks", "cache"), created };
}

type SetupState = "ready" | "partial" | "blocked";
type RuntimeName = "codex" | "claude" | "opencode";
type RuntimeSetupState = "automatic-ready" | "handoff-ready" | "tool-ready" | "manual-step-required" | "partial" | "blocked";

type RuntimeReadiness = {
  runtime: RuntimeName;
  state: RuntimeSetupState;
  mode: string;
  ready: boolean;
  blocksOverall: boolean;
  details: unknown;
  blockers: string[];
  nextSteps: string[];
  notes: string[];
};


type SetupScopeSummary = {
  schemaVersion: 1;
  command: "setup";
  projectRoot: string;
  packageInstall: {
    scope: "global-cli";
    command: "npm install -g oh-my-fooks";
    installsCommand: string;
    mutatedBySetup: false;
    note: string;
  };
  projectLocal: {
    scope: "project-local";
    root: string;
    paths: string[];
    note: string;
  };
  userRuntime: {
    scope: "user-home-runtime";
    paths: string[];
    note: string;
  };
  nonGoals: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return typeof property === "string" ? property : undefined;
}

function objectProperty(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return isRecord(property) ? property : undefined;
}

function addUniquePath(paths: string[], maybePath: string | undefined): void {
  if (maybePath && !paths.includes(maybePath)) {
    paths.push(maybePath);
  }
}

function runtimeInstallPaths(runtimeReadiness: RuntimeReadiness | undefined): string[] {
  const paths: string[] = [];
  const details = objectProperty(runtimeReadiness, "details");
  const install = objectProperty(details, "install");
  addUniquePath(paths, stringProperty(install, "artifactPath"));
  addUniquePath(paths, stringProperty(install, "commandPath"));
  return paths;
}

function runtimeManifestPathFromAttach(attach: unknown): string | undefined {
  return stringProperty(objectProperty(attach, "runtimeProof"), "artifactPath");
}

function runtimeManifestPathFromReadiness(runtimeReadiness: RuntimeReadiness | undefined): string | undefined {
  const details = objectProperty(runtimeReadiness, "details");
  const attach = objectProperty(details, "attach");
  return runtimeManifestPathFromAttach(attach);
}

function buildSetupScopeSummary(options: {
  cwd: string;
  displayCliName: string;
  initialized: { config: string; cacheDir: string };
  attach?: unknown;
  hooks?: unknown;
  claude?: RuntimeReadiness;
  opencode?: RuntimeReadiness;
}): SetupScopeSummary {
  const projectLocalPaths = [options.initialized.config, options.initialized.cacheDir];
  for (const opencodePath of runtimeInstallPaths(options.opencode)) {
    addUniquePath(projectLocalPaths, opencodePath);
  }

  const userRuntimePaths: string[] = [];
  addUniquePath(userRuntimePaths, stringProperty(options.hooks, "hooksPath"));
  addUniquePath(userRuntimePaths, runtimeManifestPathFromAttach(options.attach));
  addUniquePath(userRuntimePaths, runtimeManifestPathFromReadiness(options.claude));

  return {
    schemaVersion: 1,
    command: "setup",
    projectRoot: options.cwd,
    packageInstall: {
      scope: "global-cli",
      command: "npm install -g oh-my-fooks",
      installsCommand: options.displayCliName,
      mutatedBySetup: false,
      note: "The npm package install makes the fooks command available globally; fooks setup does not install or update the npm package.",
    },
    projectLocal: {
      scope: "project-local",
      root: options.cwd,
      paths: projectLocalPaths,
      note: "fooks setup is run from one project root and may create or update only this project's .fooks/.opencode artifacts for project-local state.",
    },
    userRuntime: {
      scope: "user-home-runtime",
      paths: userRuntimePaths,
      note: "fooks setup may create or update runtime-home files such as Codex hooks/manifests and Claude handoff manifests; tests can isolate these homes with FOOKS_CODEX_HOME/FOOKS_CLAUDE_HOME.",
    },
    nonGoals: [
      "No --scope option is required for setup.",
      "No interactive setup prompt is required.",
      "Setup behavior is unchanged; this object only documents where the existing setup flow writes.",
    ],
  };
}

function setupClaimBoundaries(): string[] {
  return [
    "Codex setup installs the automatic fooks hook path when Codex trust checks pass.",
    "Claude setup prepares manual/shared handoff artifacts only; it does not enable automatic hooks or prompt interception.",
    "opencode setup prepares a manual/semi-automatic custom tool and slash command only; it does not intercept read calls or prove runtime-token savings.",
    "Projects without supported React .tsx/.jsx component candidates stay blocked for automatic setup instead of pretending unrelated files are ready.",
  ];
}

function setupSummary(runtimes: Record<RuntimeName, RuntimeReadiness>): string[] {
  return [
    `codex:${runtimes.codex.state}${runtimes.codex.ready ? ":ready" : ":not-ready"}`,
    `claude:${runtimes.claude.state}${runtimes.claude.ready ? ":ready" : ":not-ready"}`,
    `opencode:${runtimes.opencode.state}${runtimes.opencode.ready ? ":ready" : ":not-ready"}`,
  ];
}

function codexRuntimeReadiness(
  state: SetupState,
  ready: boolean,
  attach: unknown,
  hooks: unknown,
  status: unknown,
  blockers: string[],
): RuntimeReadiness {
  return {
    runtime: "codex",
    state: ready ? "automatic-ready" : state === "ready" ? "partial" : state,
    mode: "automatic-runtime-hook",
    ready,
    blocksOverall: true,
    details: { attach, hooks, status },
    blockers,
    nextSteps: ready
      ? [
          "Open Codex in this repo and work normally; fooks will run through the installed Codex hooks.",
          "Use fooks status codex if you want to inspect the runtime trust state.",
        ]
      : [
          "Fix Codex setup blockers, then run fooks setup again.",
          "Use fooks status codex for current runtime state and inspect runtimes.codex.blockers above.",
        ],
    notes: ["Codex is the only runtime in this setup command with an automatic hook path today."],
  };
}

function blockedClaudeReadiness(blockers: string[], details: unknown = null): RuntimeReadiness {
  return {
    runtime: "claude",
    state: "blocked",
    mode: "manual-shared-handoff",
    ready: false,
    blocksOverall: false,
    details,
    blockers,
    nextSteps: [
      "Fix the Claude handoff blocker if you want Claude-ready artifacts, then run fooks setup again.",
      "Until then, use fooks extract <file> --model-payload for explicit manual handoff.",
    ],
    notes: [
      "Claude automatic hooks are not enabled by fooks setup.",
      "Claude support remains manual/shared handoff oriented; this is non-fatal for Codex readiness.",
    ],
  };
}

function claudeRuntimeReadiness(attach: { runtimeProof?: { status?: string; blocker?: string } }): RuntimeReadiness {
  if (attach.runtimeProof?.status === "passed") {
    return {
      runtime: "claude",
      state: "handoff-ready",
      mode: "manual-shared-handoff",
      ready: true,
      blocksOverall: false,
      details: { attach },
      blockers: [],
      nextSteps: [
        "Use fooks extract <file> --model-payload or the generated Claude handoff artifacts when sharing reduced context with Claude.",
        "Do not describe this as Claude prompt interception or automatic Claude token savings.",
      ],
      notes: [
        "Claude automatic hooks are not enabled by fooks setup.",
        "Claude readiness means manual/shared handoff artifacts were prepared successfully.",
      ],
    };
  }

  return blockedClaudeReadiness([attach.runtimeProof?.blocker ?? "Claude handoff proof blocked"], { attach });
}

function opencodeRuntimeReadiness(installResult: unknown): RuntimeReadiness {
  return {
    runtime: "opencode",
    state: "tool-ready",
    mode: "manual/semi-automatic-custom-tool",
    ready: true,
    blocksOverall: false,
    details: { install: installResult },
    blockers: [],
    nextSteps: [
      "Open opencode in this project and run /fooks-extract path/to/File.tsx when you want a fooks model-facing payload.",
      "Use fooks install opencode-tool explicitly if you need to repair or refresh the opencode helper artifacts.",
    ],
    notes: [
      "opencode setup does not intercept read calls.",
      "opencode setup does not prove automatic runtime-token savings.",
    ],
  };
}

function manualOpenCodeReadiness(blockers: string[], details: unknown = null): RuntimeReadiness {
  return {
    runtime: "opencode",
    state: "manual-step-required",
    mode: "manual/semi-automatic-custom-tool",
    ready: false,
    blocksOverall: false,
    details,
    blockers,
    nextSteps: [
      "Add a supported React .tsx/.jsx component, then run fooks setup again or fooks install opencode-tool explicitly.",
      "Use fooks extract <file> --model-payload manually for supported files if you do not want project-local opencode helper artifacts.",
    ],
    notes: [
      "opencode setup does not intercept read calls.",
      "opencode setup does not prove automatic runtime-token savings.",
    ],
  };
}

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
    const status = readCodexTrustStatus(cwd);
    const runtimes: Record<RuntimeName, RuntimeReadiness> = {
      codex: codexRuntimeReadiness("blocked", false, null, null, status, blockers),
      claude: blockedClaudeReadiness(["No React/TSX component file found for Claude handoff proof"]),
      opencode: manualOpenCodeReadiness(["No React/TSX component file found for opencode helper proof"]),
    };

    return {
      command: "setup",
      runtime: "codex",
      ready: false,
      state: "blocked" satisfies SetupState,
      initialized,
      attach: null,
      hooks: null,
      status,
      runtimes,
      scope: buildSetupScopeSummary({ cwd, displayCliName, initialized, attach: null, hooks: null, claude: runtimes.claude, opencode: runtimes.opencode }),
      summary: setupSummary(runtimes),
      claimBoundaries: setupClaimBoundaries(),
      blockers,
      nextSteps: [
        "Add a React/TSX component to this project, then run fooks setup again.",
        "For non-React projects, use fooks extract/scan manually only if you know the files are supported.",
      ],
    };
  }

  const [
    { attachCodex },
    { attachClaude },
    { installCodexHookPreset },
    { installOpenCodeToolPreset },
    { readCodexTrustStatus },
  ] = await Promise.all([
    import("../adapters/codex.js"),
    import("../adapters/claude.js"),
    import("../adapters/codex-hook-preset.js"),
    import("../adapters/opencode-tool-preset.js"),
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

  let claude: RuntimeReadiness;
  try {
    claude = claudeRuntimeReadiness(attachClaude(sampleFile, cwd));
  } catch (error) {
    claude = blockedClaudeReadiness([`Claude handoff setup failed: ${error instanceof Error ? error.message : String(error)}`]);
  }

  let opencode: RuntimeReadiness;
  try {
    opencode = opencodeRuntimeReadiness(installOpenCodeToolPreset(cwd, displayCliName));
  } catch (error) {
    opencode = manualOpenCodeReadiness([`opencode helper setup failed: ${error instanceof Error ? error.message : String(error)}`]);
  }

  const runtimes: Record<RuntimeName, RuntimeReadiness> = {
    codex: codexRuntimeReadiness(state, ready, attach, hooks, status, blockers),
    claude,
    opencode,
  };

  return {
    command: "setup",
    runtime: "codex",
    ready,
    state,
    initialized,
    attach,
    hooks,
    status,
    runtimes,
    scope: buildSetupScopeSummary({ cwd, displayCliName, initialized, attach, hooks, claude, opencode }),
    summary: setupSummary(runtimes),
    claimBoundaries: setupClaimBoundaries(),
    blockers,
    nextSteps: ready
      ? [
          "Open Codex in this repo and work normally; fooks will run through the installed Codex hooks.",
          "Use fooks status codex if you want to inspect the runtime trust state.",
          "Claude and opencode entries under runtimes are non-fatal handoff/tool readiness summaries, not automatic hook claims.",
        ]
      : [
          "Fix setup blockers, then run fooks setup again.",
          "Use fooks status codex for current runtime state and inspect the blockers field above.",
          "Claude and opencode entries under runtimes are non-fatal handoff/tool readiness summaries, not automatic hook claims.",
        ],
  };
}

function printHelp(displayCliName: string): void {
  console.log(`Usage: ${displayCliName} <init|setup|run|scan|extract|decide|attach|install|status|codex-pre-read|codex-runtime-hook>

Everyday commands:
  ${displayCliName} setup
      Prepare one-command readiness for supported runtimes:
      - Codex: automatic runtime hook path when trust checks pass.
      - Claude: manual/shared handoff artifacts only; no automatic hooks or prompt interception.
      - opencode: manual/semi-automatic custom tool and slash command; no read interception or runtime-token claim.

  ${displayCliName} run <prompt>
  ${displayCliName} extract <file> [--model-payload] [--json]
  ${displayCliName} install codex-hooks
  ${displayCliName} install opencode-tool
  ${displayCliName} codex-pre-read <file> [--json]
  ${displayCliName} status
  ${displayCliName} status codex
  ${displayCliName} status claude
  ${displayCliName} status cache
  ${displayCliName} codex-runtime-hook --event <SessionStart|UserPromptSubmit|Stop> [--session-id <id>] [--prompt <text>] [--json]
  ${displayCliName} codex-runtime-hook --native-hook

Install: npm install -g oh-my-fooks
CLI command: ${displayCliName}`);
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
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp(displayCliName);
    return;
  }

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
      if (arg1 === "codex-hooks") {
        const { installCodexHookPreset } = await import("../adapters/codex-hook-preset.js");
        print(installCodexHookPreset(displayCliName));
        return;
      }
      if (arg1 === "opencode-tool") {
        const { installOpenCodeToolPreset } = await import("../adapters/opencode-tool-preset.js");
        print(installOpenCodeToolPreset(process.cwd(), displayCliName));
        return;
      }
      throw new Error("install expects 'codex-hooks' or 'opencode-tool'");
    }
    case "status": {
      if (!arg1) {
        const { readProjectMetricSummary } = await import("../core/session-metrics.js");
        print(readProjectMetricSummary(process.cwd()));
        return;
      }
      if (arg1 === "codex") {
        const { readCodexTrustStatus } = await import("../adapters/codex-runtime-trust.js");
        print(readCodexTrustStatus(process.cwd()));
        return;
      }
      if (arg1 === "claude") {
        const { readClaudeRuntimeStatus } = await import("../adapters/claude-status.js");
        print(readClaudeRuntimeStatus(process.cwd()));
        return;
      }
      if (arg1 === "cache") {
        const { canonicalProjectDataDir } = await import("../core/paths.js");
        const { CacheMonitor } = await import("../core/cache-monitor.js");
        const monitor = new CacheMonitor(canonicalProjectDataDir(process.cwd()));
        print(monitor.healthReport());
        return;
      }
      throw new Error("status expects no argument, 'codex', 'claude', or 'cache'");
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
      console.error(`Unknown command: ${command}`);
      printHelp(displayCliName);
      process.exitCode = 1;
  }
}

void run();
