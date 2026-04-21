import fs from "node:fs";
import path from "node:path";
import { adapterDir } from "../core/paths";
import { claudeLocalSettingsPath, CLAUDE_HOOK_EVENTS, defaultClaudeHookCommand, isCompatibleClaudeHookCommand, type ClaudeHookEvent } from "./claude-hook-preset";
import { runtimeManifestPath } from "./shared";

type ClaudeStatusState = "context-hook-ready" | "handoff-ready" | "blocked";
type ClaudeStatusMode = "automatic-context-hook" | "manual-shared-handoff";

type FileStatus = {
  path: string;
  exists: boolean;
  valid?: boolean;
  blocker?: string;
};

type ClaudeManifestStatus = {
  home: string;
  path: string;
  homeExists: boolean;
  exists: boolean;
  valid?: boolean;
  runtimeMatches?: boolean;
  projectRootMatches?: boolean;
  blocker?: string;
};

type HookCommand = {
  type?: unknown;
  command?: unknown;
};

type HookMatcher = {
  hooks?: unknown;
};

type ClaudeSettingsFile = {
  hooks?: Record<string, HookMatcher[]>;
  disableAllHooks?: unknown;
};

export type ClaudeHookStatus = {
  path: string;
  exists: boolean;
  ready: boolean;
  valid?: boolean;
  installedEvents: ClaudeHookEvent[];
  missingEvents: ClaudeHookEvent[];
  unexpectedFooksEvents: string[];
  commandMatches?: boolean;
  disabledByLocalSettings?: boolean;
  blocker?: string;
};

export type ClaudeRuntimeStatus = {
  runtime: "claude";
  state: ClaudeStatusState;
  mode: ClaudeStatusMode;
  ready: boolean;
  blockers: string[];
  adapter: {
    installed: boolean;
    directory: string;
    adapterJson: FileStatus;
    contextTemplate: FileStatus;
  };
  manifest: ClaudeManifestStatus;
  hooks: ClaudeHookStatus;
  nextSteps: string[];
  notes: string[];
};

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function adapterJsonStatus(filePath: string): FileStatus {
  if (!fs.existsSync(filePath)) {
    return { path: filePath, exists: false, blocker: "Claude adapter metadata is missing" };
  }

  try {
    const parsed = readJson(filePath) as { runtime?: unknown };
    if (parsed.runtime !== "claude") {
      return { path: filePath, exists: true, valid: false, blocker: "Claude adapter metadata has an unexpected runtime" };
    }
    return { path: filePath, exists: true, valid: true };
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      valid: false,
      blocker: `Claude adapter metadata is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function contextTemplateStatus(filePath: string): FileStatus {
  if (!fs.existsSync(filePath)) {
    return { path: filePath, exists: false, blocker: "Claude context template is missing" };
  }
  return { path: filePath, exists: true, valid: true };
}

function manifestStatus(cwd: string): ClaudeManifestStatus {
  const { home, manifestPath } = runtimeManifestPath("claude", cwd);
  const homeExists = fs.existsSync(home);
  if (!homeExists) {
    return {
      home,
      path: manifestPath,
      homeExists,
      exists: false,
      blocker: "Claude runtime home not detected",
    };
  }

  if (!fs.existsSync(manifestPath)) {
    return {
      home,
      path: manifestPath,
      homeExists,
      exists: false,
      blocker: "Claude runtime manifest is missing",
    };
  }

  try {
    const parsed = readJson(manifestPath) as { runtime?: unknown; projectRoot?: unknown };
    const runtimeMatches = parsed.runtime === "claude";
    const projectRootMatches = parsed.projectRoot === cwd;
    const valid = runtimeMatches && projectRootMatches;
    return {
      home,
      path: manifestPath,
      homeExists,
      exists: true,
      valid,
      runtimeMatches,
      projectRootMatches,
      blocker: valid ? undefined : "Claude runtime manifest does not match this project",
    };
  } catch (error) {
    return {
      home,
      path: manifestPath,
      homeExists,
      exists: true,
      valid: false,
      blocker: `Claude runtime manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function hookCommandsForEvent(settings: ClaudeSettingsFile, event: string): string[] {
  const matchers = settings.hooks?.[event] ?? [];
  if (!Array.isArray(matchers)) return [];
  return matchers.flatMap((matcher) => {
    if (!Array.isArray(matcher?.hooks)) return [];
    return (matcher.hooks as HookCommand[])
      .filter((hook) => hook?.type === "command" && typeof hook.command === "string")
      .map((hook) => hook.command as string);
  });
}

function hookStatus(cwd: string): ClaudeHookStatus {
  const filePath = claudeLocalSettingsPath(cwd);
  if (!fs.existsSync(filePath)) {
    return {
      path: filePath,
      exists: false,
      ready: false,
      installedEvents: [],
      missingEvents: [...CLAUDE_HOOK_EVENTS],
      unexpectedFooksEvents: [],
      commandMatches: false,
    };
  }

  let settings: ClaudeSettingsFile;
  try {
    settings = readJson(filePath) as ClaudeSettingsFile;
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      ready: false,
      valid: false,
      installedEvents: [],
      missingEvents: [...CLAUDE_HOOK_EVENTS],
      unexpectedFooksEvents: [],
      commandMatches: false,
      blocker: `Claude local settings are not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const command = defaultClaudeHookCommand("fooks");
  const installedEvents = CLAUDE_HOOK_EVENTS.filter((event) => hookCommandsForEvent(settings, event).some((item) => isCompatibleClaudeHookCommand(item, "fooks"))) as ClaudeHookEvent[];
  const missingEvents = CLAUDE_HOOK_EVENTS.filter((event) => !installedEvents.includes(event)) as ClaudeHookEvent[];
  const unexpectedFooksEvents = Object.keys(settings.hooks ?? {}).filter(
    (event) => !CLAUDE_HOOK_EVENTS.includes(event as ClaudeHookEvent) && hookCommandsForEvent(settings, event).some((item) => isCompatibleClaudeHookCommand(item, "fooks")),
  );
  const disabledByLocalSettings = settings.disableAllHooks === true;
  const commandMatches = installedEvents.every((event) => hookCommandsForEvent(settings, event).some((item) => item === command));
  const blocker = disabledByLocalSettings
    ? "Claude hooks are disabled by local settings"
    : unexpectedFooksEvents.length > 0
      ? `Unsupported fooks Claude hook events are installed: ${unexpectedFooksEvents.join(", ")}`
      : undefined;

  return {
    path: filePath,
    exists: true,
    ready: missingEvents.length === 0 && unexpectedFooksEvents.length === 0 && !disabledByLocalSettings,
    valid: true,
    installedEvents,
    missingEvents,
    unexpectedFooksEvents,
    commandMatches,
    disabledByLocalSettings,
    blocker,
  };
}

function blockersFrom(...items: Array<FileStatus | ClaudeManifestStatus | ClaudeHookStatus>): string[] {
  return items.flatMap((item) => (item.blocker ? [item.blocker] : []));
}

export function readClaudeRuntimeStatus(cwd = process.cwd()): ClaudeRuntimeStatus {
  const directory = adapterDir("claude", cwd);
  const adapterJson = adapterJsonStatus(path.join(directory, "adapter.json"));
  const contextTemplate = contextTemplateStatus(path.join(directory, "context-template.md"));
  const manifest = manifestStatus(cwd);
  const hooks = hookStatus(cwd);
  const baseBlockers = blockersFrom(adapterJson, contextTemplate, manifest);
  const blockers = blockersFrom(adapterJson, contextTemplate, manifest, hooks);
  const handoffReady = baseBlockers.length === 0;
  const state: ClaudeStatusState = handoffReady ? (hooks.ready ? "context-hook-ready" : hooks.blocker ? "blocked" : "handoff-ready") : "blocked";
  const ready = state === "context-hook-ready" || state === "handoff-ready";

  return {
    runtime: "claude",
    state,
    mode: state === "context-hook-ready" ? "automatic-context-hook" : "manual-shared-handoff",
    ready,
    blockers,
    adapter: {
      installed: adapterJson.valid === true && contextTemplate.valid === true,
      directory,
      adapterJson,
      contextTemplate,
    },
    manifest,
    hooks,
    nextSteps: state === "context-hook-ready"
      ? [
          "Open Claude Code in this repo; fooks can add bounded context on SessionStart and explicit .tsx/.jsx UserPromptSubmit prompts.",
          "Use fooks status claude to inspect project-local hook readiness.",
        ]
      : handoffReady
        ? [
            "Run fooks install claude-hooks to enable project-local Claude context hooks.",
            "Manual/shared handoff remains available with fooks extract <file> --model-payload.",
          ]
        : [
            "Run fooks attach claude or fooks setup after ensuring the Claude runtime home exists.",
            "Use fooks extract <file> --model-payload for explicit manual handoff until Claude status becomes ready.",
          ],
    notes: [
      "Claude P0 uses project-local context hooks in .claude/settings.local.json only; fooks does not mutate ~/.claude/settings.json.",
      "Claude P0 supports SessionStart/UserPromptSubmit context injection only; it does not intercept Read/tool calls or claim runtime-token savings.",
    ],
  };
}
