import fs from "node:fs";
import path from "node:path";

export const CLAUDE_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit"] as const;
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
