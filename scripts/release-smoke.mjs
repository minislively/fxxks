#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parsePackJson(stdout) {
  const parsed = JSON.parse(stdout);
  assert(Array.isArray(parsed) && parsed.length === 1, "npm pack --json should return one package entry");
  return parsed[0];
}


function assertNoForbiddenPublicClaims(label, text) {
  const forbidden = [
    /provider usage/billing-token reduction/i,
    /billing-token savings/i,
    /provider cost savings/i,
    /Claude Read interception is enabled/i,
    /Claude runtime-token savings are enabled/i,
    /automatic Claude runtime-token savings/i,
  ];
  const negatedClaimBoundary = /(?:not|no|without|nor|never|does not prove|do not claim|must not claim|cannot support|blocks?|excluded?|out of scope|is not)[^\n]{0,160}$/i;

  for (const line of text.split(/\r?\n/)) {
    for (const pattern of forbidden) {
      const match = pattern.exec(line);
      if (match) {
        const beforeMatch = line.slice(0, match.index);
        assert(negatedClaimBoundary.test(beforeMatch), `${label} contains forbidden positive claim ${pattern}: ${line}`);
      }
    }
    if (/ccusage replacement/i.test(line)) {
      assert(/not (?:a )?ccusage replacement|not provider usage/billing tokens, charged costs, or a ccusage replacement/i.test(line), `${label} contains unbounded ccusage replacement wording: ${line}`);
    }
    if (/\.omx\//i.test(line) || /\.omx\/state/i.test(line)) {
      assert(/internal|harness|planning/i.test(line), `${label} exposes .omx as product state: ${line}`);
    }
  }
}

function assertPublicSurfaceClaimBoundaries(surfaces) {
  for (const [label, text] of Object.entries(surfaces)) {
    assertNoForbiddenPublicClaims(label, text);
  }
}

function runInstalledFooks(fooksBin, args, options = {}) {
  return execFileSync(fooksBin, args, {
    cwd: options.cwd,
    encoding: "utf8",
    input: options.input,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });
}

function parseOptionalJson(stdout, label) {
  if (!stdout.trim()) return null;
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} should emit JSON when non-empty: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function runNativeHook(fooksBin, runtime, projectRoot, env, payload, label) {
  return parseOptionalJson(
    runInstalledFooks(fooksBin, [`${runtime}-runtime-hook`, "--native-hook"], {
      cwd: projectRoot,
      input: JSON.stringify(payload),
      env,
    }),
    label,
  );
}

function sanitizeDataKey(key) {
  return key.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase() || "default-session";
}

function readMetricEvents(projectRoot) {
  const sessionsDir = path.join(projectRoot, ".fooks", "sessions");
  if (!fs.existsSync(sessionsDir)) return [];
  return fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const eventsPath = path.join(sessionsDir, entry.name, "events.jsonl");
      if (!fs.existsSync(eventsPath)) return [];
      return fs.readFileSync(eventsPath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    });
}

function assertPackedFiles(packEntry) {
  const paths = new Set(packEntry.files.map((file) => file.path));
  const required = [
    "package.json",
    "README.md",
    "dist/cli/index.js",
    "dist/index.js",
    "dist/adapters/codex.js",
    "dist/adapters/claude.js",
    "dist/adapters/opencode-tool-preset.js",
    "docs/setup.md",
    "docs/release.md",
    "docs/roadmap.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
  ];

  for (const filePath of required) {
    assert(paths.has(filePath), `packed tarball missing ${filePath}`);
  }

  const forbiddenPrefixes = [
    "benchmarks/",
    "docs/archive/",
    "docs/benchmarks/",
    "docs/cli/",
    "docs/internal/",
  ];
  const forbiddenFiles = new Set([
    "docs/BENCHMARK_ENVIRONMENT_AUDIT.md",
    "docs/RISK_AND_MONITORING.md",
    "docs/codex-live-feedback-checklist.md",
    "docs/performance-vs-operational-complexity.md",
    "docs/real-environment-process-model-validation.md",
    "docs/real-repo-validation.md",
    "docs/runtime-bridge-contract.md",
    "docs/today-execution-plan.md",
  ]);

  for (const filePath of paths) {
    assert(!forbiddenFiles.has(filePath), `packed tarball includes internal doc ${filePath}`);
    assert(!forbiddenPrefixes.some((prefix) => filePath.startsWith(prefix)), `packed tarball includes non-public path ${filePath}`);
  }
}

const dryRun = parsePackJson(run("npm", ["pack", "--dry-run", "--json"]));
assertPackedFiles(dryRun);

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-pack-"));
const tarballName = run("npm", ["pack", "--pack-destination", packDir]).trim().split(/\r?\n/).at(-1);
const tarballPath = path.join(packDir, tarballName);
assert(fs.existsSync(tarballPath), `tarball not found at ${tarballPath}`);

const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-prefix-"));
run("npm", ["install", "-g", "--prefix", prefix, tarballPath]);
const fooksBin = path.join(prefix, "bin", "fooks");
assert(fs.existsSync(fooksBin), `installed fooks binary not found at ${fooksBin}`);

assertPublicSurfaceClaimBoundaries({
  "README.md": fs.readFileSync(path.join(repoRoot, "README.md"), "utf8"),
  "docs/setup.md": fs.readFileSync(path.join(repoRoot, "docs", "setup.md"), "utf8"),
  "docs/release.md": fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8"),
  "docs/roadmap.md": fs.readFileSync(path.join(repoRoot, "docs", "roadmap.md"), "utf8"),
  "docs/internal/live-hook-smoke-checklist.md": fs.existsSync(path.join(repoRoot, "docs", "internal", "live-hook-smoke-checklist.md"))
    ? fs.readFileSync(path.join(repoRoot, "docs", "internal", "live-hook-smoke-checklist.md"), "utf8")
    : "",
  "dist/cli/index.js": fs.readFileSync(path.join(repoRoot, "dist", "cli", "index.js"), "utf8"),
});

const project = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-project-"));
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-"));
const codexHome = path.join(runtimeRoot, "codex");
const claudeHome = path.join(runtimeRoot, "claude");
fs.mkdirSync(path.join(project, "src"), { recursive: true });
fs.mkdirSync(codexHome, { recursive: true });
fs.mkdirSync(claudeHome, { recursive: true });
fs.writeFileSync(
  path.join(project, "package.json"),
  `${JSON.stringify({ name: "tmp-fooks-release-smoke", repository: { url: "https://github.com/example-org/tmp-fooks-release-smoke.git" } }, null, 2)}\n`,
);
fs.writeFileSync(path.join(project, "src", "App.tsx"), "export function App(){ return <main>Hello</main>; }\n");
fs.writeFileSync(
  path.join(project, "src", "LargeForm.tsx"),
  [
    "type Field = { id: string; label: string; placeholder: string };",
    "",
    "type LargeFormProps = {",
    "  title: string;",
    "  description: string;",
    "  fields: Field[];",
    "  footerText?: string;",
    "};",
    "",
    "function fallbackFooterText(value?: string) {",
    "  return value ?? 'All fields are required before continuing.';",
    "}",
    "",
    "export function LargeForm({ title, description, fields, footerText }: LargeFormProps) {",
    "  return (",
    "    <section className=\"grid gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm\">",
    "      <header className=\"grid gap-2\">",
    "        <h2 className=\"text-lg font-semibold text-slate-900\">{title}</h2>",
    "        <p className=\"text-sm text-slate-600\">{description}</p>",
    "      </header>",
    "",
    "      <div className=\"grid gap-4 md:grid-cols-2\">",
    "        {fields.map((field) => (",
    "          <label key={field.id} className=\"grid gap-2 text-sm text-slate-700\">",
    "            <span className=\"font-medium text-slate-800\">{field.label}</span>",
    "            <input",
    "              className=\"rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200\"",
    "              placeholder={field.placeholder}",
    "            />",
    "          </label>",
    "        ))}",
    "      </div>",
    "",
    "      <footer className=\"flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500\">",
    "        <span>{fallbackFooterText(footerText)}</span>",
    "        <button className=\"inline-flex items-center rounded-md bg-slate-900 px-3 py-2 font-medium text-white\">",
    "          Continue",
    "        </button>",
    "      </footer>",
    "    </section>",
    "  );",
    "}",
    "",
  ].join("\n"),
);
const setupStdout = execFileSync(fooksBin, ["setup", "--json"], {
  cwd: project,
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: path.join(runtimeRoot, "home"),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
    FOOKS_ACTIVE_ACCOUNT: "",
    FOOKS_TARGET_ACCOUNT: "",
  },
});
const setup = JSON.parse(setupStdout);
assert(setup.ready === true, `expected setup.ready=true, got ${setup.ready}`);
assert(setup.runtimes?.codex?.state === "automatic-ready", `unexpected Codex setup state ${setup.runtimes?.codex?.state}`);
assert(setup.runtimes?.codex?.blocksOverall === true, "Codex should be the only overall-blocking runtime");
assert(setup.runtimes?.claude?.state === "context-hook-ready", `unexpected Claude setup state ${setup.runtimes?.claude?.state}`);
assert(setup.runtimes?.claude?.blocksOverall === false, "Claude readiness should be non-fatal for overall setup");
assert(setup.runtimes?.opencode?.state === "tool-ready", `unexpected opencode setup state ${setup.runtimes?.opencode?.state}`);
assert(setup.runtimes?.opencode?.blocksOverall === false, "opencode readiness should be non-fatal for overall setup");
assert(setup.attach?.runtimeProof?.details?.includes("account-source=package-repository"), "setup should derive public repo account context from package metadata");

const statusStdout = execFileSync(fooksBin, ["status"], {
  cwd: project,
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: path.join(runtimeRoot, "home"),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  },
});
const doctorStdout = execFileSync(fooksBin, ["doctor", "--json"], {
  cwd: project,
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: path.join(runtimeRoot, "home"),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  },
});
const claudeStatusStdout = execFileSync(fooksBin, ["status", "claude"], {
  cwd: project,
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: path.join(runtimeRoot, "home"),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  },
});
const compareStdout = runInstalledFooks(fooksBin, ["compare", "src/LargeForm.tsx", "--json"], {
  cwd: project,
  env: {
    ...process.env,
    HOME: path.join(runtimeRoot, "home"),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  },
});
assertPublicSurfaceClaimBoundaries({
  "fooks setup output": setupStdout,
  "fooks doctor output": doctorStdout,
  "fooks status output": statusStdout,
  "fooks status claude output": claudeStatusStdout,
  "fooks compare output": compareStdout,
});
const compare = JSON.parse(compareStdout);
assert(compare.metricTier === "estimated", `compare should expose estimated metric tier, got ${compare.metricTier}`);
assert(compare.measurement === "local-model-facing-payload", `unexpected compare measurement ${compare.measurement}`);
assert(compare.claimBoundary?.includes("not provider usage/billing tokens"), "compare should keep provider billing boundary");
assert(compare.claimBoundary?.includes("not charged costs"), "compare should keep provider cost boundary");
assert(compare.excludes?.includes("provider-tokenizer-behavior"), "compare should exclude provider tokenizer behavior");
assert(compare.excludes?.includes("runtime-hook-envelope-overhead"), "compare should exclude runtime hook envelope overhead");
assert(compare.sourceBytes > compare.modelFacingBytes, "release compare fixture should show a local payload reduction");
assert(compare.savedEstimatedTokens > 0, "release compare fixture should show positive estimated token reduction");
const status = JSON.parse(statusStdout);
assert(status.metricTier === "estimated", `status should expose estimated metric tier, got ${status.metricTier}`);
assert(status.claimBoundary?.includes("not provider usage/billing tokens"), "status should keep provider billing boundary");
assert(status.breakdown && typeof status.breakdown === "object", "status should expose runtime/source breakdown");
assert(!Object.prototype.hasOwnProperty.call(status, "sessions"), "CLI status should omit per-session contribution details");
const doctor = JSON.parse(doctorStdout);
assert(doctor.command === "doctor", `doctor command should be doctor, got ${doctor.command}`);
assert(doctor.healthy === true, `doctor should be healthy after setup, got ${doctor.healthy}`);
assert(doctor.summary?.fail === 0, `doctor should have zero failures after setup, got ${doctor.summary?.fail}`);
assert(doctor.claimBoundaries?.some((item) => item.includes("local fooks configuration")), "doctor should expose local-configuration claim boundary");
assert(fs.existsSync(path.join(codexHome, "hooks.json")), "isolated Codex hooks file should be written under FOOKS_CODEX_HOME");
const claudeLocalSettings = path.join(project, ".claude", "settings.local.json");
assert(fs.existsSync(claudeLocalSettings), "Claude project-local hooks should be installed under the project");
const claudeSettings = JSON.parse(fs.readFileSync(claudeLocalSettings, "utf8"));
assert(
  JSON.stringify(Object.keys(claudeSettings.hooks ?? {}).sort()) === JSON.stringify(["SessionStart", "Stop", "UserPromptSubmit"]),
  "Claude smoke hooks should be limited to SessionStart, UserPromptSubmit, and Stop",
);
assert(
  claudeSettings.hooks?.SessionStart?.[0]?.hooks?.[0]?.command === "fooks claude-runtime-hook --native-hook",
  "Claude SessionStart smoke hook should use the canonical fooks command",
);
assert(
  claudeSettings.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command === "fooks claude-runtime-hook --native-hook",
  "Claude UserPromptSubmit smoke hook should use the canonical fooks command",
);
assert(
  claudeSettings.hooks?.Stop?.[0]?.hooks?.[0]?.command === "fooks claude-runtime-hook --native-hook",
  "Claude Stop smoke hook should use the canonical fooks command",
);
const hookEnv = {
  ...process.env,
  HOME: path.join(runtimeRoot, "home"),
  XDG_CONFIG_HOME: path.join(runtimeRoot, "config"),
  FOOKS_CODEX_HOME: codexHome,
  FOOKS_CLAUDE_HOME: claudeHome,
};
const codexSessionId = "release-smoke-codex";
const codexStart = runNativeHook(fooksBin, "codex", project, hookEnv, {
  hook_event_name: "SessionStart",
  cwd: project,
  session_id: codexSessionId,
}, "Codex SessionStart");
assert(codexStart === null, "Codex native SessionStart should initialize without emitting context");
const firstCodexPrompt = runNativeHook(fooksBin, "codex", project, hookEnv, {
  hook_event_name: "UserPromptSubmit",
  cwd: project,
  session_id: codexSessionId,
  prompt: "Explain src/App.tsx",
}, "Codex first prompt");
assert(firstCodexPrompt === null, "Codex first eligible native prompt should record without emitting context");
const secondCodexPrompt = runNativeHook(fooksBin, "codex", project, hookEnv, {
  hook_event_name: "UserPromptSubmit",
  cwd: project,
  session_id: codexSessionId,
  prompt: "Again, explain src/App.tsx",
}, "Codex repeated prompt");
assert(
  secondCodexPrompt.hookSpecificOutput?.hookEventName === "UserPromptSubmit",
  "Codex repeated same-file native prompt should emit UserPromptSubmit context",
);
assert(
  secondCodexPrompt.hookSpecificOutput?.additionalContext?.includes("src/App.tsx"),
  "Codex repeated same-file native context should reference the target file",
);

const codexFallbackSessionId = "release-smoke-codex-fallback";
const codexFallback = runNativeHook(fooksBin, "codex", project, hookEnv, {
  hook_event_name: "UserPromptSubmit",
  cwd: project,
  session_id: codexFallbackSessionId,
  prompt: "Need exact source src/App.tsx #fooks-full-read",
}, "Codex fallback prompt");
assert(
  codexFallback?.hookSpecificOutput?.additionalContext === "fooks: full read requested · file: src/App.tsx · Read the full source file for this turn.",
  "Codex fallback hook should use bounded full-read status vocabulary",
);

const claudeStart = runNativeHook(fooksBin, "claude", project, hookEnv, {
  hook_event_name: "SessionStart",
  cwd: project,
  session_id: "release-smoke-claude",
}, "Claude SessionStart");
const claudeStartContext = claudeStart.hookSpecificOutput?.additionalContext ?? "";
assert(
  claudeStartContext.includes("fooks: active")
    && claudeStartContext.includes("no Read interception")
    && claudeStartContext.includes("first prompt triggers context"),
  "Claude native SessionStart should emit bounded readiness context",
);
const firstClaudePrompt = runNativeHook(fooksBin, "claude", project, hookEnv, {
  hook_event_name: "UserPromptSubmit",
  cwd: project,
  session_id: "release-smoke-claude",
  prompt: "Explain src/App.tsx",
}, "Claude first prompt");
assert(firstClaudePrompt === null, "Claude first eligible native prompt should record without emitting context");
const secondClaudePrompt = runNativeHook(fooksBin, "claude", project, hookEnv, {
  hook_event_name: "UserPromptSubmit",
  cwd: project,
  session_id: "release-smoke-claude",
  prompt: "Again, explain src/App.tsx",
}, "Claude repeated prompt");
assert(
  secondClaudePrompt.hookSpecificOutput?.hookEventName === "UserPromptSubmit",
  "Claude repeated same-file native prompt should emit UserPromptSubmit context",
);
assert(
  secondClaudePrompt.hookSpecificOutput?.additionalContext?.includes("src/App.tsx"),
  "Claude repeated same-file native context should reference the target file",
);

const postHookStatusStdout = runInstalledFooks(fooksBin, ["status"], {
  cwd: project,
  env: hookEnv,
});
assertPublicSurfaceClaimBoundaries({
  "post-hook fooks status output": postHookStatusStdout,
});
const postHookStatus = JSON.parse(postHookStatusStdout);
assert(postHookStatus.metricTier === "estimated", `post-hook status should expose estimated metric tier, got ${postHookStatus.metricTier}`);
assert(postHookStatus.claimBoundary?.includes("not provider usage/billing tokens"), "post-hook status should keep provider billing boundary");
assert(!Object.prototype.hasOwnProperty.call(postHookStatus, "sessions"), "post-hook CLI status should omit per-session contribution details");
assert(postHookStatus.breakdown?.byRuntime?.codex?.eventCount >= 2, "post-hook status should include Codex hook metric events");
assert(postHookStatus.breakdown?.byRuntime?.claude?.eventCount >= 2, "post-hook status should include Claude hook metric events");
assert(postHookStatus.breakdown?.byMeasurementSource?.["automatic-hook"]?.eventCount >= 2, "post-hook status should include automatic-hook source metrics");
assert(postHookStatus.breakdown?.byMeasurementSource?.["project-local-context-hook"]?.eventCount >= 2, "post-hook status should include Claude project-local context-hook source metrics");
assert(postHookStatus.breakdown?.byRuntimeAndSource?.["codex:automatic-hook"]?.injectCount >= 1, "post-hook status should include Codex repeated-file inject evidence");
assert(postHookStatus.breakdown?.byRuntimeAndSource?.["claude:project-local-context-hook"]?.injectCount >= 1, "post-hook status should include Claude repeated-file inject evidence");

const metricEvents = readMetricEvents(project);
const codexFallbackMetricKey = `codex:automatic-hook:${codexFallbackSessionId}`;
const fallbackEvent = metricEvents.find((event) => event.metricSessionKey === codexFallbackMetricKey && event.action === "fallback");
assert(fallbackEvent, "Codex fallback smoke should record a fallback metric event");
assert(fallbackEvent.estimated?.savedEstimatedBytes === 0, "fallback metric should not produce positive estimated byte savings");
assert(fallbackEvent.estimated?.savedEstimatedTokens === 0, "fallback metric should not produce positive estimated token savings");
const recordEvents = metricEvents.filter((event) => event.action === "record");
assert(recordEvents.length >= 2, "Codex and Claude hook smokes should record first eligible prompts");
assert(
  recordEvents.every((event) => event.estimated?.savedEstimatedBytes === 0 && event.estimated?.savedEstimatedTokens === 0),
  "record-only hook metrics should not produce positive estimated savings",
);
const codexSummaryDir = path.join(project, ".fooks", "sessions", sanitizeDataKey(`codex:automatic-hook:${codexSessionId}`));
const claudeSummaryDir = path.join(project, ".fooks", "sessions", sanitizeDataKey("claude:project-local-context-hook:release-smoke-claude"));
assert(fs.existsSync(path.join(codexSummaryDir, "summary.json")), "Codex hook-smoke session summary should be persisted");
assert(fs.existsSync(path.join(claudeSummaryDir, "summary.json")), "Claude hook-smoke session summary should be persisted");
assert(fs.existsSync(path.join(project, ".opencode", "tools", "fooks_extract.ts")), "opencode helper should be installed project-locally");
assert(fs.existsSync(path.join(project, ".opencode", "commands", "fooks-extract.md")), "opencode slash command should be installed project-locally");

console.log(JSON.stringify({
  ok: true,
  package: dryRun.id,
  tarball: tarballPath,
  installedBinary: fooksBin,
  setupSummary: setup.summary,
  hookSmokeEvidence: {
    codex: {
      sessionStart: "recorded",
      firstPrompt: "record-only",
      repeatedPrompt: secondCodexPrompt.hookSpecificOutput.hookEventName,
      fallbackSavingsGuard: "zero-savings",
    },
    claude: {
      sessionStart: claudeStart.hookSpecificOutput.hookEventName,
      firstPrompt: "record-only",
      repeatedPrompt: secondClaudePrompt.hookSpecificOutput.hookEventName,
    },
    status: {
      metricTier: postHookStatus.metricTier,
      latestSessionCount: postHookStatus.latestSessionCount,
      runtimeSources: Object.keys(postHookStatus.breakdown.byRuntimeAndSource ?? {}).sort(),
      claimBoundary: postHookStatus.claimBoundary,
    },
    doctor: {
      healthy: doctor.healthy,
      summary: doctor.summary,
      claimBoundaries: doctor.claimBoundaries,
    },
    compare: {
      measurement: compare.measurement,
      metricTier: compare.metricTier,
      reductionPercent: compare.reductionPercent,
      savedEstimatedTokens: compare.savedEstimatedTokens,
      claimBoundary: compare.claimBoundary,
    },
  },
  accountDetails: setup.attach.runtimeProof.details.filter((detail) => detail.startsWith("account-")),
}, null, 2));
