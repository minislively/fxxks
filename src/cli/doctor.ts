import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readCodexHookPresetStatus, type CodexHookPresetStatus } from "../adapters/codex-hook-preset";
import { readCodexTrustStatus } from "../adapters/codex-runtime-trust";
import { readClaudeRuntimeStatus } from "../adapters/claude-status";
import { runtimeManifestPath } from "../adapters/shared";
import { CacheMonitor } from "../core/cache-monitor";
import { adapterDir, canonicalProjectDataDir } from "../core/paths";
import { discoverProjectFiles } from "../core/discover";
import { readReactWebActivationMode, type ReactWebActivationModeResult, type ReactWebActivationVerdict } from "../core/react-web-activation-mode";
import { readReactWebStatus } from "../core/react-web-status";
import { discoverSetupEligibleSources } from "../core/setup-eligibility";
import { currentWorktreeEvidenceStatus, WORKTREE_BRANCH_DIVERGENCE_SOURCE } from "../core/worktree-evidence";

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

export type DoctorReadiness = {
  state: "ready" | "ready-with-warnings" | "unhealthy";
  headline: string;
  firstBlocker?: string;
  nextAction: string;
};

export type DoctorReactWebActivationReadiness = {
  available: boolean;
  state: "ready" | "partial" | "blocked";
  latestEvidenceId: string | null;
  latestDecision: "use" | "fallback" | "deny" | null;
  freshness: "current" | "stale" | "missing-source-file" | "unavailable";
  claimBoundary: string;
  repeatedFileRuntime: {
    verdict: ReactWebActivationVerdict | "unavailable";
    positive: boolean;
    reasons: string[];
  };
  profileGateAdvisory: {
    verdict: ReactWebActivationVerdict | "unavailable";
    reasons: string[];
  };
  globMatchAdvisory: {
    verdict: ReactWebActivationVerdict | "unavailable";
    reasons: string[];
  };
  deferredTriggers: string[];
  risks: string[];
  nextAction: string;
  readError?: string;
};

export type DoctorResult = {
  command: "doctor";
  target: DoctorTarget;
  healthy: boolean;
  summary: { pass: number; warn: number; fail: number };
  readiness: DoctorReadiness;
  checks: DoctorCheck[];
  nextSteps: string[];
  claimBoundaries: string[];
  reactWebActivation?: DoctorReactWebActivationReadiness;
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

function executableExists(command: string): boolean {
  const pathValue = process.env.PATH;
  if (!pathValue) return false;

  const pathExts = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const extension of pathExts) {
      const candidate = path.join(directory, `${command}${extension}`);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
      } catch {
        // Keep scanning PATH. Optional host-tooling checks must stay read-only,
        // non-throwing, and non-blocking.
      }
    }
  }

  return false;
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
    const eligible = discoverSetupEligibleSources(cwd);
    const targets = discoverProjectFiles(cwd);
    const components = targets.filter((item) => item.kind === "component");
    const betaCandidates = eligible.codexTsJsBetaFiles;

    if (components.length > 0) {
      return {
        runtime: "core",
        name: "Eligible source files",
        status: "pass",
        message: `Found ${components.length} React .tsx/.jsx component file(s)`,
        evidence: {
          componentFileCount: components.length,
          codexTsJsBetaFileCount: betaCandidates.length,
          targetCount: targets.length,
          examples: components.slice(0, 5).map((item) => path.relative(cwd, item.filePath)),
        },
      };
    }

    if (betaCandidates.length > 0) {
      return {
        runtime: "core",
        name: "Eligible source files",
        status: "pass",
        message: `Found ${betaCandidates.length} strong Codex .ts/.js beta file(s); Claude/opencode helper setup still requires React .tsx/.jsx components`,
        fix: "Add a React component if you also want Claude/opencode helper setup, or keep using Codex-only setup for the TS/JS beta path",
        evidence: {
          componentFileCount: components.length,
          codexTsJsBetaFileCount: betaCandidates.length,
          targetCount: targets.length,
          examples: betaCandidates.slice(0, 5).map((item) => path.relative(cwd, item)),
        },
      };
    }

    return {
      runtime: "core",
      name: "Eligible source files",
      status: "warn",
      message: "No React .tsx/.jsx component files or strong Codex .ts/.js beta files found",
      fix: "Add a supported React component or a strong TS/JS beta file, or use fooks extract manually for supported files",
      evidence: { componentFileCount: components.length, codexTsJsBetaFileCount: betaCandidates.length, targetCount: targets.length, examples: [] },
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

function claudeTypeScriptLspCheck(): DoctorCheck {
  const available = executableExists("typescript-language-server");
  return {
    runtime: "claude",
    name: "Claude optional TypeScript language server",
    status: available ? "pass" : "warn",
    message: available ? "typescript-language-server is available" : "typescript-language-server is not installed; this optional host tool does not block fooks hooks",
    fix: available ? undefined : "Optional: npm install -g typescript-language-server typescript",
    evidence: { command: "typescript-language-server", available },
  };
}

function worktreeTrackingDivergenceCheck(cwd: string): DoctorCheck | undefined {
  try {
    const status = currentWorktreeEvidenceStatus(cwd);
    const snapshot = status.snapshot;
    const divergence = status.branchDivergence ?? snapshot?.branchDivergence;
    if (!snapshot?.clean || divergence?.kind !== "available" || (divergence.ahead === 0 && divergence.behind === 0)) {
      return undefined;
    }

    return {
      runtime: "core",
      name: "Worktree upstream divergence",
      status: "warn",
      message: `Worktree is clean, but branch differs from configured upstream ref: behind ${divergence.behind}, ahead ${divergence.ahead} vs ${divergence.upstream} (${WORKTREE_BRANCH_DIVERGENCE_SOURCE}).`,
      fix: "Run git fetch/pull outside fooks if you want to update local refs or integrate upstream changes.",
      evidence: {
        clean: snapshot.clean,
        branch: divergence.branch,
        upstream: divergence.upstream,
        ahead: divergence.ahead,
        behind: divergence.behind,
        source: divergence.source,
      },
    };
  } catch (error) {
    return undefined;
  }
}

function worktreeHealthCheck(cwd: string): DoctorCheck {
  try {
    const result = spawnSync("git", ["worktree", "list", "--porcelain"], { cwd, encoding: "utf8" });
    if (result.error || result.status !== 0) {
      return {
        runtime: "core",
        name: "Worktree health",
        status: "pass",
        message: "Worktree check skipped (not a git repository or git unavailable)",
        evidence: { status: result.status, stderr: result.stderr },
      };
    }
    const blocks = result.stdout.split("\n\n").filter(Boolean);
    const issues: string[] = [];
    let deletedCount = 0;

    for (const block of blocks) {
      const lines = block.split("\n");
      const worktreePath = lines.find((l) => l.startsWith("worktree "))?.slice(9);
      if (worktreePath && !fs.existsSync(worktreePath)) {
        deletedCount++;
        issues.push(`deleted: ${worktreePath}`);
      }
    }

    if (issues.length === 0) {
      return {
        runtime: "core",
        name: "Worktree health",
        status: "pass",
        message: "All worktrees are healthy",
        evidence: { worktreeCount: blocks.length },
      };
    }

    return {
      runtime: "core",
      name: "Worktree health",
      status: "warn",
      message: `Found ${issues.length} worktree issue(s): ${issues.join("; ")}`,
      fix: "Run: git worktree prune && rm -rf <deleted-worktree-path>",
      evidence: { deletedCount, issues, worktreeCount: blocks.length },
    };
  } catch (error) {
    return {
      runtime: "core",
      name: "Worktree health",
      status: "pass",
      message: `Worktree check skipped: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function tmuxSessionHealthCheck(): DoctorCheck {
  try {
    const result = spawnSync("tmux", ["ls"], { encoding: "utf8", timeout: 5000 });
    if (result.error || result.status !== 0) {
      return {
        runtime: "core",
        name: "Tmux session health",
        status: "pass",
        message: "Tmux session check skipped (tmux unavailable)",
        evidence: { status: result.status, stderr: result.stderr },
      };
    }
    const sessions = result.stdout.split("\n").filter(Boolean);
    const zombieSessions: string[] = [];

    for (const sessionLine of sessions) {
      const sessionName = sessionLine.split(":")[0];
      if (!sessionName) continue;
      const paneResult = spawnSync("tmux", ["display-message", "-t", sessionName, "-p", "#{pane_current_path}"], { encoding: "utf8", timeout: 5000 });
      if (paneResult.error || paneResult.status !== 0) continue;
      const panePath = paneResult.stdout.trim();
      if (panePath.includes("(deleted)") || (panePath && !fs.existsSync(panePath))) {
        zombieSessions.push(sessionName);
      }
    }

    if (zombieSessions.length === 0) {
      return {
        runtime: "core",
        name: "Tmux session health",
        status: "pass",
        message: `All ${sessions.length} tmux session(s) are healthy`,
        evidence: { sessionCount: sessions.length },
      };
    }

    return {
      runtime: "core",
      name: "Tmux session health",
      status: "warn",
      message: `Found ${zombieSessions.length} zombie tmux session(s): ${zombieSessions.join(", ")}`,
      fix: "Run: tmux kill-session -t <session-name>",
      evidence: { zombieSessions, sessionCount: sessions.length },
    };
  } catch (error) {
    return {
      runtime: "core",
      name: "Tmux session health",
      status: "pass",
      message: `Tmux session check skipped: ${error instanceof Error ? error.message : String(error)}`,
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

  if (focused) {
    checks.push(claudeTypeScriptLspCheck());
  }

  return checks;
}

function aggregateChecks(cwd: string, cliName: string): DoctorCheck[] {
  const checks = [
    ...codexDoctorChecks(cwd, cliName),
    ...claudeDoctorChecks(cwd, false),
  ];
  const divergenceCheck = worktreeTrackingDivergenceCheck(cwd);
  if (divergenceCheck) {
    checks.push(divergenceCheck);
  }
  if (process.env.FOOKS_OPERATOR === "1") {
    checks.push(worktreeHealthCheck(cwd));
    checks.push(tmuxSessionHealthCheck());
  }
  return checks;
}

function activationStateFor(verdict: ReactWebActivationVerdict | "unavailable", latestEvidenceId: string | null): DoctorReactWebActivationReadiness["state"] {
  if (!latestEvidenceId || verdict === "blocked" || verdict === "unavailable") {
    return "blocked";
  }
  if (verdict === "deferred") {
    return "partial";
  }
  return "ready";
}

function activationNextAction(
  state: DoctorReactWebActivationReadiness["state"],
  latestEvidenceId: string | null,
  activationMode: ReactWebActivationModeResult | null,
): string {
  if (!latestEvidenceId) {
    return "Create one repeated same-file React Web Codex cycle, then rerun fooks doctor codex to inspect activation readiness.";
  }
  if (!activationMode) {
    return "Inspect the latest React Web evidence artifact, then rerun fooks doctor codex.";
  }
  if (state === "ready") {
    return "React Web repeated-file/profile-gate runtime activation is ready on the bounded Codex lane; keep glob-match advisory-only and leave deferred triggers unchanged unless a later lane explicitly promotes them.";
  }
  if (activationMode.verdict === "blocked") {
    return "Inspect the latest React Web evidence boundary blockers, fix the source-context issue if needed, and rerun fooks doctor codex.";
  }
  return "Review the deferred repeated-file/profile-gate/glob-match reasons, address freshness or evidence gaps if appropriate, and rerun fooks doctor codex.";
}

function readReactWebActivationReadiness(cwd: string): DoctorReactWebActivationReadiness {
  try {
    const status = readReactWebStatus(cwd);
    const activationMode = status.latestEvidenceId ? readReactWebActivationMode(cwd, "latest") : null;
    const verdict = activationMode?.verdict ?? "unavailable";
    const state = activationStateFor(verdict, status.latestEvidenceId);
    return {
      available: Boolean(activationMode),
      state,
      latestEvidenceId: status.latestEvidenceId,
      latestDecision: status.latestDecision,
      freshness: status.freshness.status,
      claimBoundary: activationMode?.claimBoundary ?? status.claimBoundary,
      repeatedFileRuntime: {
        verdict,
        positive: activationMode?.supportedTrigger.positive ?? false,
        reasons: activationMode?.supportedTrigger.reasons ?? [],
      },
      profileGateAdvisory: {
        verdict: activationMode?.profileGate.verdict ?? "unavailable",
        reasons: activationMode?.profileGate.reasons ?? [],
      },
      globMatchAdvisory: {
        verdict: activationMode?.globMatch.verdict ?? "unavailable",
        reasons: activationMode?.globMatch.reasons ?? [],
      },
      deferredTriggers: activationMode?.deferredTriggers.map((item) => item.name) ?? [...status.activationMode.deferredTriggers],
      risks: [...status.risks],
      nextAction: activationNextAction(state, status.latestEvidenceId, activationMode),
    };
  } catch (error) {
    const readError = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      state: "blocked",
      latestEvidenceId: null,
      latestDecision: null,
      freshness: "unavailable",
      claimBoundary: "Local React Web activation readiness only: doctor reports bounded readiness and advisory state from existing evidence/status surfaces without changing runtime behavior or widening support claims.",
      repeatedFileRuntime: {
        verdict: "unavailable",
        positive: false,
        reasons: ["activation-readiness-unavailable"],
      },
      profileGateAdvisory: {
        verdict: "unavailable",
        reasons: ["activation-readiness-unavailable"],
      },
      globMatchAdvisory: {
        verdict: "unavailable",
        reasons: ["activation-readiness-unavailable"],
      },
      deferredTriggers: ["always-on", "model-decision"],
      risks: [`unable to read React Web activation readiness: ${readError}`],
      nextAction: "Repair the latest React Web evidence/status artifact read path, then rerun fooks doctor codex.",
      readError,
    };
  }
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

function firstNonPassingCheck(checks: DoctorCheck[]): DoctorCheck | undefined {
  return checks.find((item) => item.status === "fail") ?? checks.find((item) => item.status === "warn");
}

function targetLabel(target: DoctorTarget): string {
  if (target === "all") return "local fooks setup";
  return `${capitalize(target)} readiness`;
}

function readinessFor(target: DoctorTarget, summary: DoctorResult["summary"], checks: DoctorCheck[], nextSteps: string[]): DoctorReadiness {
  const firstIssue = firstNonPassingCheck(checks);
  if (summary.fail > 0) {
    return {
      state: "unhealthy",
      headline: `${targetLabel(target)} is not ready: ${summary.fail} failing check(s) need attention.`,
      firstBlocker: firstIssue ? `${firstIssue.name}: ${firstIssue.message}` : undefined,
      nextAction: nextSteps[0] ?? "Review the failing checks above, fix the first blocker, then rerun fooks doctor.",
    };
  }

  if (summary.warn > 0) {
    return {
      state: "ready-with-warnings",
      headline: `${targetLabel(target)} is usable, with ${summary.warn} warning(s) to review.`,
      firstBlocker: firstIssue ? `${firstIssue.name}: ${firstIssue.message}` : undefined,
      nextAction: nextSteps[0] ?? "Review warnings when convenient; rerun fooks doctor after changes.",
    };
  }

  return {
    state: "ready",
    headline: `${targetLabel(target)} is ready.`,
    nextAction: target === "all" ? "Open your agent in this repo and work normally." : `Open ${capitalize(target)} in this repo and use your original prompt directly.`,
  };
}

export function doctorClaimBoundaries(): string[] {
  return [
    "Doctor reports local fooks configuration and runtime hook readiness only.",
    "Doctor does not prove provider health; it is not provider usage/billing tokens, invoices, dashboards, charged costs, or a ccusage replacement.",
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
  const nextSteps = unique(checks.filter((item) => item.status !== "pass").map((item) => item.fix));
  const reactWebActivation = target === "claude" ? undefined : readReactWebActivationReadiness(cwd);
  return {
    command: "doctor",
    target,
    healthy: summary.fail === 0,
    summary,
    readiness: readinessFor(target, summary, checks, nextSteps),
    checks,
    nextSteps,
    claimBoundaries: doctorClaimBoundaries(),
    reactWebActivation,
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
  lines.push(`Status: ${result.readiness.state}`);
  lines.push(`Why: ${result.readiness.headline}`);
  if (result.readiness.firstBlocker) {
    lines.push(`First blocker: ${result.readiness.firstBlocker}`);
  }
  lines.push(`Next action: ${result.readiness.nextAction}`);
  lines.push("");
  if (result.reactWebActivation) {
    lines.push("React Web activation");
    lines.push(`- state: ${result.reactWebActivation.state}`);
    lines.push(`- latest evidence id: ${result.reactWebActivation.latestEvidenceId ?? "none"}`);
    lines.push(`- repeated-file runtime: ${result.reactWebActivation.repeatedFileRuntime.verdict}`);
    lines.push(`- profile-gate runtime gate: ${result.reactWebActivation.profileGateAdvisory.verdict}`);
    lines.push(`- glob-match advisory: ${result.reactWebActivation.globMatchAdvisory.verdict}`);
    lines.push(`- deferred triggers: ${result.reactWebActivation.deferredTriggers.join(", ")}`);
    if (result.reactWebActivation.repeatedFileRuntime.reasons.length > 0) {
      lines.push(`- repeated-file reasons: ${result.reactWebActivation.repeatedFileRuntime.reasons.join(", ")}`);
    }
    if (result.reactWebActivation.profileGateAdvisory.reasons.length > 0) {
      lines.push(`- profile-gate reasons: ${result.reactWebActivation.profileGateAdvisory.reasons.join(", ")}`);
    }
    if (result.reactWebActivation.globMatchAdvisory.reasons.length > 0) {
      lines.push(`- glob-match reasons: ${result.reactWebActivation.globMatchAdvisory.reasons.join(", ")}`);
    }
    if (result.reactWebActivation.risks.length > 0) {
      lines.push(`- risks: ${result.reactWebActivation.risks.join(", ")}`);
    }
    if (result.reactWebActivation.readError) {
      lines.push(`- read error: ${result.reactWebActivation.readError}`);
    }
    lines.push(`- next activation action: ${result.reactWebActivation.nextAction}`);
    lines.push("");
  }
  lines.push("Checks");
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
  return `Usage: ${cliName} doctor [codex|claude] [--json]\n\nRun read-only local diagnostics for fooks setup and runtime hook readiness.\n\nExamples:\n  ${cliName} doctor\n  ${cliName} doctor codex\n  ${cliName} doctor claude\n  ${cliName} doctor codex --json\n\nBoundaries:\n  - Reports local configuration and hook readiness only.\n  - Does not prove provider health; it is not provider usage/billing tokens, invoices, dashboards, charged costs, or a ccusage replacement.\n  - Does not enable Claude Read/tool-call interception.\n`;
}
