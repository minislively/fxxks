import fs from "node:fs";
import path from "node:path";
import { readCodexHookPresetStatus, type CodexHookPresetStatus } from "../adapters/codex-hook-preset";
import { readCodexTrustStatus } from "../adapters/codex-runtime-trust";
import { readClaudeRuntimeStatus } from "../adapters/claude-status";
import { runtimeManifestPath } from "../adapters/shared";
import { CacheMonitor } from "../core/cache-monitor";
import { adapterDir, canonicalProjectDataDir } from "../core/paths";
import { discoverProjectFiles } from "../core/discover";

export type DoctorTarget = "all" | "codex" | "claude";
export type DoctorRuntime = "core" | "codex" | "claude";
export type DoctorCheckStatus = "pass" | "warn" | "fail";

export type DoctorCheck = {
  runtime: DoctorRuntime;
  name: string;
  status: DoctorCheckStatus;
  message: string;
  fix?: string;
  evidence?: Record<string, unknown>;
};

export type DoctorResult = {
  command: "doctor";
  target: DoctorTarget;
  healthy: boolean;
  summary: { pass: number; warn: number; fail: number };
  checks: DoctorCheck[];
  nextSteps: string[];
  claimBoundaries: string[];
};

export type DoctorOptions = {
  target?: DoctorTarget;
  cwd?: string;
  cliName?: string;
};

type FileStatus = {
  path: string;
  exists: boolean;
  valid?: boolean;
  blocker?: string;
  evidence?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return typeof property === "string" ? property : undefined;
}

function fileStatus(filePath: string, expectedRuntime?: "codex" | "claude"): FileStatus {
  if (!fs.existsSync(filePath)) {
    return { path: filePath, exists: false, blocker: `${path.basename(filePath)} is missing` };
  }

  if (!expectedRuntime || path.extname(filePath) !== ".json") {
    return { path: filePath, exists: true, valid: true };
  }

  try {
    const parsed = readJson(filePath);
    const runtime = isRecord(parsed) ? parsed.runtime : undefined;
    const valid = runtime === expectedRuntime;
    return {
      path: filePath,
      exists: true,
      valid,
      blocker: valid ? undefined : `${path.basename(filePath)} has an unexpected runtime`,
      evidence: { runtime },
    };
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      valid: false,
      blocker: `${path.basename(filePath)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function adapterChecks(runtime: "codex" | "claude", cwd: string, focused = true): DoctorCheck[] {
  const dir = adapterDir(runtime, cwd);
  const adapterJson = fileStatus(path.join(dir, "adapter.json"), runtime);
  const contextTemplate = fileStatus(path.join(dir, "context-template.md"));
  const adapterOk = adapterJson.valid === true && contextTemplate.exists;
  return [
    {
      runtime,
      name: `${capitalize(runtime)} project adapter`,
      status: adapterOk ? "pass" : focused ? "fail" : "warn",
      message: adapterOk
        ? "Adapter metadata and context template are present"
        : [adapterJson.blocker, contextTemplate.blocker].filter(Boolean).join("; ") || "Adapter artifacts are missing or invalid",
      fix: adapterOk ? undefined : `Run: fooks attach ${runtime} or fooks setup`,
      evidence: {
        directory: dir,
        adapterJson: { path: adapterJson.path, exists: adapterJson.exists, valid: adapterJson.valid },
        contextTemplate: { path: contextTemplate.path, exists: contextTemplate.exists, valid: contextTemplate.valid },
      },
    },
  ];
}

function manifestCheck(runtime: "codex" | "claude", cwd: string, focused = true): DoctorCheck {
  const { home, manifestPath } = runtimeManifestPath(runtime, cwd);
  const homeExists = fs.existsSync(home);
  if (!homeExists) {
    return {
      runtime,
      name: `${capitalize(runtime)} runtime manifest`,
      status: focused ? "fail" : "warn",
      message: `${capitalize(runtime)} runtime home not detected`,
      fix: runtime === "codex" ? "Create the Codex runtime home or set FOOKS_CODEX_HOME, then run fooks setup" : "Create the Claude runtime home or set FOOKS_CLAUDE_HOME, then run fooks setup",
      evidence: { home, manifestPath, homeExists, exists: false },
    };
  }

  if (!fs.existsSync(manifestPath)) {
    return {
      runtime,
      name: `${capitalize(runtime)} runtime manifest`,
      status: focused ? "fail" : "warn",
      message: `${capitalize(runtime)} runtime manifest is missing`,
      fix: `Run: fooks attach ${runtime} or fooks setup`,
      evidence: { home, manifestPath, homeExists, exists: false },
    };
  }

  try {
    const parsed = readJson(manifestPath);
    const runtimeMatches = isRecord(parsed) && parsed.runtime === runtime;
    const projectRootMatches = isRecord(parsed) && parsed.projectRoot === cwd;
    const runtimeBridge = isRecord(parsed) ? parsed.runtimeBridge : undefined;
    const bridgeCommand = stringProperty(runtimeBridge, "command");
    const bridgeCommandPlausible = runtime === "codex" ? Boolean(bridgeCommand?.includes("codex-runtime-hook --native-hook")) : true;
    const valid = runtimeMatches && projectRootMatches && bridgeCommandPlausible;
    return {
      runtime,
      name: `${capitalize(runtime)} runtime manifest`,
      status: valid ? "pass" : focused ? "fail" : "warn",
      message: valid ? "Manifest matches this project" : "Manifest does not match this project",
      fix: valid ? undefined : `Run: fooks attach ${runtime} or fooks setup`,
      evidence: { home, manifestPath, homeExists, exists: true, runtimeMatches, projectRootMatches, bridgeCommandPlausible },
    };
  } catch (error) {
    return {
      runtime,
      name: `${capitalize(runtime)} runtime manifest`,
      status: focused ? "fail" : "warn",
      message: `Manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      fix: `Run: fooks attach ${runtime} or fooks setup`,
      evidence: { home, manifestPath, homeExists, exists: true, valid: false },
    };
  }
}

function codexRuntimeHomeCheck(status: CodexHookPresetStatus): DoctorCheck {
  return {
    runtime: "codex",
    name: "Codex runtime home",
    status: status.homeExists ? "pass" : "fail",
    message: status.homeExists ? "Codex runtime home is present" : "Codex runtime home is missing",
    fix: status.homeExists ? undefined : "Create the Codex runtime home or set FOOKS_CODEX_HOME, then run fooks setup",
    evidence: { home: status.home, hooksPath: status.hooksPath, homeExists: status.homeExists },
  };
}

function codexHooksCheck(status: CodexHookPresetStatus): DoctorCheck {
  const ready = status.exists && status.valid !== false && status.missingEvents.length === 0;
  return {
    runtime: "codex",
    name: "Codex hooks",
    status: ready ? "pass" : "fail",
    message: ready
      ? `Hooks ready: ${status.installedEvents.join(", ")}`
      : status.blocker ?? `Missing compatible fooks hooks for: ${status.missingEvents.join(", ")}`,
    fix: ready ? undefined : "Run: fooks install codex-hooks or fooks setup",
    evidence: {
      home: status.home,
      hooksPath: status.hooksPath,
      exists: status.exists,
      valid: status.valid,
      installedEvents: status.installedEvents,
      missingEvents: status.missingEvents,
      commandMatches: status.commandMatches,
    },
  };
}

function codexTrustCheck(cwd: string): DoctorCheck {
  const status = readCodexTrustStatus(cwd);
  const lifecycleReady = status.lifecycleState === "ready" || status.lifecycleState === "attach-prepared";
  const ready = status.connectionState === "connected" && lifecycleReady;
  return {
    runtime: "codex",
    name: "Codex trust status",
    status: ready ? "pass" : "fail",
    message: `Trust status is ${status.connectionState}/${status.lifecycleState}`,
    fix: ready ? undefined : "Run: fooks setup, then fooks status codex",
    evidence: { ...status },
  };
}

function cacheHealthCheck(cwd: string): DoctorCheck {
  try {
    const monitor = new CacheMonitor(canonicalProjectDataDir(cwd));
    const report = monitor.healthReport();
    return {
      runtime: "core",
      name: "Cache health",
      status: report.status === "healthy" || report.status === "recovered" ? "pass" : report.status === "empty" ? "warn" : "fail",
      message: `Status: ${report.status}, entries: ${report.entryCount}`,
      fix: report.status === "corrupted" ? "Run: fooks scan to regenerate cache" : report.status === "empty" ? "Run: fooks scan or fooks setup to initialize cache" : undefined,
      evidence: report as unknown as Record<string, unknown>,
    };
  } catch (error) {
    return {
      runtime: "core",
      name: "Cache health",
      status: "warn",
      message: `Unable to read cache health: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function eligibleSourceFilesCheck(cwd: string): DoctorCheck {
  try {
    const targets = discoverProjectFiles(cwd);
    const components = targets.filter((item) => item.kind === "component");
    return {
      runtime: "core",
      name: "Eligible source files",
      status: components.length > 0 ? "pass" : "warn",
      message: components.length > 0 ? `Found ${components.length} React .tsx/.jsx component file(s)` : "No React .tsx/.jsx component files found",
      fix: components.length > 0 ? undefined : "Add a supported React component or use fooks extract manually for supported files",
      evidence: { componentFileCount: components.length, targetCount: targets.length, examples: components.slice(0, 5).map((item) => path.relative(cwd, item.filePath)) },
    };
  } catch (error) {
    return {
      runtime: "core",
      name: "Eligible source files",
      status: "warn",
      message: `Unable to discover eligible files: ${error instanceof Error ? error.message : String(error)}`,
      fix: "Check project file permissions and rerun fooks doctor",
    };
  }
}

function codexDoctorChecks(cwd: string, cliName: string): DoctorCheck[] {
  const hooks = readCodexHookPresetStatus(cliName);
  return [
    codexRuntimeHomeCheck(hooks),
    codexHooksCheck(hooks),
    manifestCheck("codex", cwd),
    ...adapterChecks("codex", cwd),
    codexTrustCheck(cwd),
    cacheHealthCheck(cwd),
    eligibleSourceFilesCheck(cwd),
  ];
}

function claudeDoctorChecks(cwd: string, focused = true): DoctorCheck[] {
  const status = readClaudeRuntimeStatus(cwd);
  const checks: DoctorCheck[] = [];

  checks.push({
    runtime: "claude",
    name: "Claude project adapter",
    status: status.adapter.installed ? "pass" : focused ? "fail" : "warn",
    message: status.adapter.installed ? "Adapter metadata and context template are present" : status.adapter.adapterJson.blocker ?? status.adapter.contextTemplate.blocker ?? "Adapter is not installed",
    fix: status.adapter.installed ? undefined : "Run: fooks attach claude or fooks setup",
    evidence: status.adapter as unknown as Record<string, unknown>,
  });

  checks.push({
    runtime: "claude",
    name: "Claude runtime manifest",
    status: status.manifest.valid === true ? "pass" : focused ? "fail" : "warn",
    message: status.manifest.valid === true ? "Manifest matches this project" : status.manifest.blocker ?? "Manifest is missing or invalid",
    fix: status.manifest.valid === true ? undefined : "Run: fooks attach claude or fooks setup",
    evidence: status.manifest as unknown as Record<string, unknown>,
  });

  checks.push({
    runtime: "claude",
    name: "Claude project-local hooks",
    status: status.hooks.ready ? "pass" : focused ? "fail" : "warn",
    message: status.hooks.ready
      ? `Hooks ready: ${status.hooks.installedEvents.join(", ")}`
      : status.hooks.blocker ?? `Missing project-local hooks: ${status.hooks.missingEvents.join(", ")}`,
    fix: status.hooks.ready ? undefined : "Run: fooks install claude-hooks or fooks setup",
    evidence: status.hooks as unknown as Record<string, unknown>,
  });

  if (status.blockers.length > 0) {
    checks.push({
      runtime: "claude",
      name: "Claude runtime status",
      status: focused ? "fail" : "warn",
      message: status.blockers.join("; "),
      fix: status.nextSteps[0],
      evidence: { state: status.state, mode: status.mode, ready: status.ready, blockers: status.blockers },
    });
  } else {
    checks.push({
      runtime: "claude",
      name: "Claude runtime status",
      status: "pass",
      message: `${status.state} (${status.mode})`,
      evidence: { state: status.state, mode: status.mode, ready: status.ready },
    });
  }

  return checks;
}

function aggregateChecks(cwd: string, cliName: string): DoctorCheck[] {
  return [
    ...codexDoctorChecks(cwd, cliName),
    ...claudeDoctorChecks(cwd, false),
  ];
}

function summaryFor(checks: DoctorCheck[]): DoctorResult["summary"] {
  return {
    pass: checks.filter((item) => item.status === "pass").length,
    warn: checks.filter((item) => item.status === "warn").length,
    fail: checks.filter((item) => item.status === "fail").length,
  };
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((item): item is string => Boolean(item)))];
}

export function doctorClaimBoundaries(): string[] {
  return [
    "Doctor reports local fooks configuration and runtime hook readiness only.",
    "Doctor does not prove provider health; it is not provider billing tokens, provider costs, or a ccusage replacement.",
    "Claude diagnostics cover project-local SessionStart/UserPromptSubmit context hooks only; fooks does not intercept Claude Read/tool calls.",
  ];
}

export function runDoctor(options: DoctorOptions = {}): DoctorResult {
  const target = options.target ?? "all";
  const cwd = options.cwd ?? process.cwd();
  const cliName = options.cliName ?? "fooks";
  const checks = target === "codex"
    ? codexDoctorChecks(cwd, cliName)
    : target === "claude"
      ? claudeDoctorChecks(cwd, true)
      : aggregateChecks(cwd, cliName);
  const summary = summaryFor(checks);
  return {
    command: "doctor",
    target,
    healthy: summary.fail === 0,
    summary,
    checks,
    nextSteps: unique(checks.filter((item) => item.status !== "pass").map((item) => item.fix)),
    claimBoundaries: doctorClaimBoundaries(),
  };
}

function iconFor(status: DoctorCheckStatus): string {
  if (status === "pass") return "✅";
  if (status === "warn") return "⚠️";
  return "❌";
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

export function formatDoctor(result: DoctorResult): string {
  const lines: string[] = [`fooks doctor${result.target === "all" ? "" : ` ${result.target}`}`, ""];
  for (const check of result.checks) {
    lines.push(`${iconFor(check.status)} ${check.name}`);
    lines.push(`   ${check.message}`);
    if (check.fix) {
      lines.push(`   Fix: ${check.fix}`);
    }
    lines.push("");
  }
  lines.push(`Summary: ${result.summary.pass} passed, ${result.summary.warn} warnings, ${result.summary.fail} failures`);
  lines.push(`Overall: ${result.healthy ? (result.summary.warn > 0 ? "healthy with warnings" : "healthy") : "unhealthy"}`);
  for (const boundary of result.claimBoundaries) {
    lines.push(`Boundary: ${boundary}`);
  }
  return `${lines.join("\n")}\n`;
}

export function doctorHelp(cliName = "fooks"): string {
  return `Usage: ${cliName} doctor [codex|claude] [--json]\n\nRun read-only local diagnostics for fooks setup and runtime hook readiness.\n\nExamples:\n  ${cliName} doctor\n  ${cliName} doctor codex\n  ${cliName} doctor claude\n  ${cliName} doctor codex --json\n\nBoundaries:\n  - Reports local configuration and hook readiness only.\n  - Does not prove provider health; it is not provider billing tokens, provider costs, or a ccusage replacement.\n  - Does not enable Claude Read/tool-call interception.\n`;
}
