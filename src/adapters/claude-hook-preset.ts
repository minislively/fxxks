import fs from "node:fs";
import path from "node:path";

export const CLAUDE_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "Stop"] as const;
const CLAUDE_HOOK_SUFFIX = "claude-runtime-hook --native-hook";

export type ClaudeHookEvent = (typeof CLAUDE_HOOK_EVENTS)[number];

type HookCommand = {
  type: "command";
  command: string;
  statusMessage?: string;
  timeout?: number;
};

type HookMatcher = {
  matcher?: string;
  hooks?: HookCommand[];
};

type ClaudeSettingsFile = {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
};

export type ClaudeHookPresetStatus = {
  settingsPath: string;
  exists: boolean;
  valid?: boolean;
  installedEvents: ClaudeHookEvent[];
  missingEvents: ClaudeHookEvent[];
  unexpectedFooksEvents: string[];
  commandMatches?: boolean;
  disabledByLocalSettings?: boolean;
  blocker?: string;
};

export type ClaudeHookPresetInstallResult = {
  settingsPath: string;
  backupPath?: string;
  command: string;
  created: boolean;
  modified: boolean;
  installedEvents: ClaudeHookEvent[];
  skippedEvents: ClaudeHookEvent[];
  blocker?: string;
};

export function defaultClaudeHookCommand(cliName = "fooks"): string {
  return `${cliName} ${CLAUDE_HOOK_SUFFIX}`;
}

function compatibleClaudeHookCommands(cliName = "fooks"): string[] {
  return [...new Set([defaultClaudeHookCommand(cliName), defaultClaudeHookCommand("fooks")])];
}

function isLegacyNodeBridgeCommand(commandText: string): boolean {
  return /^node\s+(?:"[^"]+\/dist\/cli\/index\.js"|'[^']+\/dist\/cli\/index\.js'|\S+\/dist\/cli\/index\.js)\s+claude-runtime-hook --native-hook$/.test(commandText);
}

export function isCompatibleClaudeHookCommand(commandText: string, cliName = "fooks"): boolean {
  return compatibleClaudeHookCommands(cliName).includes(commandText) || isLegacyNodeBridgeCommand(commandText);
}

export function claudeLocalSettingsPath(cwd = process.cwd()): string {
  return path.join(cwd, ".claude", "settings.local.json");
}

function starterMatcher(event: ClaudeHookEvent, commandText: string): HookMatcher {
  const command: HookCommand = { type: "command", command: commandText };
  if (event === "SessionStart") {
    return { matcher: "startup|resume", hooks: [command] };
  }
  return { hooks: [command] };
}

function findCompatibleCommandHook(matcher: HookMatcher, cliName = "fooks"): HookCommand | undefined {
  if (!Array.isArray(matcher.hooks)) return undefined;
  return matcher.hooks.find((hook) => hook?.type === "command" && isCompatibleClaudeHookCommand(hook.command, cliName));
}

function readSettingsFile(filePath: string): ClaudeSettingsFile {
  if (!fs.existsSync(filePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ClaudeSettingsFile;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
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

export function readClaudeHookPresetStatus(cwd = process.cwd(), cliName = "fooks"): ClaudeHookPresetStatus {
  const filePath = claudeLocalSettingsPath(cwd);
  if (!fs.existsSync(filePath)) {
    return {
      settingsPath: filePath,
      exists: false,
      installedEvents: [],
      missingEvents: [...CLAUDE_HOOK_EVENTS],
      unexpectedFooksEvents: [],
      commandMatches: false,
    };
  }

  let settings: ClaudeSettingsFile;
  try {
    settings = readSettingsFile(filePath);
  } catch (error) {
    return {
      settingsPath: filePath,
      exists: true,
      valid: false,
      installedEvents: [],
      missingEvents: [...CLAUDE_HOOK_EVENTS],
      unexpectedFooksEvents: [],
      commandMatches: false,
      blocker: `Claude local settings are not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const command = defaultClaudeHookCommand(cliName);
  const installedEvents = CLAUDE_HOOK_EVENTS.filter((event) => hookCommandsForEvent(settings, event).some((item) => isCompatibleClaudeHookCommand(item, cliName)));
  const missingEvents = CLAUDE_HOOK_EVENTS.filter((event) => !installedEvents.includes(event));
  const unexpectedFooksEvents = Object.keys(settings.hooks ?? {}).filter(
    (event) => !CLAUDE_HOOK_EVENTS.includes(event as ClaudeHookEvent) && hookCommandsForEvent(settings, event).some((item) => isCompatibleClaudeHookCommand(item, cliName)),
  );
  const disabledByLocalSettings = settings.disableAllHooks === true;
  const commandMatches = installedEvents.every((event) => hookCommandsForEvent(settings, event).some((item) => item === command));
  const blocker = disabledByLocalSettings
    ? "Claude hooks are disabled by local settings"
    : unexpectedFooksEvents.length > 0
      ? `Unsupported fooks Claude hook events are installed: ${unexpectedFooksEvents.join(", ")}`
      : undefined;

  return {
    settingsPath: filePath,
    exists: true,
    valid: true,
    installedEvents,
    missingEvents,
    unexpectedFooksEvents,
    commandMatches,
    disabledByLocalSettings,
    blocker,
  };
}

function ensureEventHook(settingsFile: ClaudeSettingsFile, event: ClaudeHookEvent, command: string): boolean {
  settingsFile.hooks ||= {};
  const eventHooks = settingsFile.hooks[event] ?? [];
  const cliName = command.split(" ")[0];
  const existingHook = eventHooks.map((matcher) => findCompatibleCommandHook(matcher, cliName)).find(Boolean);
  if (existingHook) {
    existingHook.command = command;
    settingsFile.hooks[event] = eventHooks;
    return false;
  }
  settingsFile.hooks[event] = [starterMatcher(event, command), ...eventHooks];
  return true;
}

export function installClaudeHookPreset(cwd = process.cwd(), cliName = "fooks"): ClaudeHookPresetInstallResult {
  const filePath = claudeLocalSettingsPath(cwd);
  const command = defaultClaudeHookCommand(cliName);
  const created = !fs.existsSync(filePath);
  const installedEvents: ClaudeHookEvent[] = [];
  const skippedEvents: ClaudeHookEvent[] = [];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const existingRaw = created ? "" : fs.readFileSync(filePath, "utf8");
  let settingsFile: ClaudeSettingsFile;
  try {
    settingsFile = readSettingsFile(filePath);
  } catch (error) {
    return {
      settingsPath: filePath,
      command,
      created: false,
      modified: false,
      installedEvents,
      skippedEvents,
      blocker: `Claude local settings are not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  for (const event of CLAUDE_HOOK_EVENTS) {
    if (ensureEventHook(settingsFile, event, command)) {
      installedEvents.push(event);
    } else {
      skippedEvents.push(event);
    }
  }

  const nextRaw = `${JSON.stringify(settingsFile, null, 2)}\n`;
  const modified = existingRaw !== nextRaw;
  let backupPath: string | undefined;
  if (modified && !created) {
    backupPath = `${filePath}.bak-${Math.floor(Date.now() / 1000)}`;
    fs.copyFileSync(filePath, backupPath);
  }
  if (modified) {
    fs.writeFileSync(filePath, nextRaw);
  }

  return {
    settingsPath: filePath,
    backupPath,
    command,
    created,
    modified,
    installedEvents,
    skippedEvents,
  };
}
