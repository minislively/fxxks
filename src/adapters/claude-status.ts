import fs from "node:fs";
import path from "node:path";
import { adapterDir } from "../core/paths";
import { readClaudeHookPresetStatus, type ClaudeHookEvent } from "./claude-hook-preset";
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

function hookStatus(cwd: string): ClaudeHookStatus {
  const preset = readClaudeHookPresetStatus(cwd);
  const ready = preset.missingEvents.length === 0 && preset.unexpectedFooksEvents.length === 0 && !preset.disabledByLocalSettings;

  return {
    path: preset.settingsPath,
    exists: preset.exists,
    ready,
    valid: preset.valid,
    installedEvents: preset.installedEvents,
    missingEvents: preset.missingEvents,
    unexpectedFooksEvents: preset.unexpectedFooksEvents,
    commandMatches: preset.commandMatches,
    disabledByLocalSettings: preset.disabledByLocalSettings,
    blocker: preset.blocker,
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
          "Open Claude Code in this repo; fooks records/prepares the first explicit .tsx/.jsx prompt and may add bounded context on a repeated same-file UserPromptSubmit.",
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
      "Claude P0 supports project-local SessionStart/UserPromptSubmit/Stop context hooks: first eligible frontend-file prompts are recorded/prepared, repeated same-file prompts may inject bounded context, Stop cleans up session state, and fooks does not intercept Read/tool calls or claim runtime-token savings.",
    ],
  };
}
