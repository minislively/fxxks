import fs from "node:fs";
import path from "node:path";
import { handleClaudeRuntimeHook, type ClaudeRuntimeHookEvent, type ClaudeRuntimeHookInput } from "./claude-runtime-hook";

type NativePayload = Record<string, unknown>;

export type ClaudeNativeHookOutput = {
  hookSpecificOutput: {
    hookEventName: ClaudeRuntimeHookEvent;
    additionalContext: string;
  };
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readHookEventName(payload: NativePayload): ClaudeRuntimeHookEvent | null {
  const raw = safeString(payload.hook_event_name ?? payload.hookEventName ?? payload.event ?? payload.name).trim();
  if (raw === "SessionStart" || raw === "UserPromptSubmit") return raw;
  return null;
}

function readPrompt(payload: NativePayload): string {
  const candidates = [payload.prompt, payload.input, payload.user_prompt, payload.userPrompt, payload.text];
  for (const candidate of candidates) {
    const value = safeString(candidate).trim();
    if (value) return value;
  }
  return "";
}

function findAttachedProjectRoot(startCwd: string): string | null {
  let current = path.resolve(startCwd);
  while (true) {
    if (fs.existsSync(path.join(current, ".fooks", "adapters", "claude", "adapter.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function toHookSpecificOutput(hookEventName: ClaudeRuntimeHookEvent, additionalContext: string): ClaudeNativeHookOutput {
  return {
    hookSpecificOutput: {
      hookEventName,
      additionalContext,
    },
  };
}

export function handleClaudeNativeHookPayload(payload: NativePayload, fallbackCwd = process.cwd()): ClaudeNativeHookOutput | null {
  const hookEventName = readHookEventName(payload);
  if (!hookEventName) return null;

  const payloadCwd = safeString(payload.cwd).trim() || fallbackCwd;
  const projectRoot = findAttachedProjectRoot(payloadCwd);
  if (!projectRoot) return null;

  const input: ClaudeRuntimeHookInput = {
    hookEventName,
    prompt: hookEventName === "UserPromptSubmit" ? readPrompt(payload) : undefined,
    sessionId: safeString(payload.session_id ?? payload.sessionId) || undefined,
    cwd: projectRoot,
  };

  const decision = handleClaudeRuntimeHook(input, projectRoot);
  if ((decision.action === "inject" || decision.action === "fallback") && decision.additionalContext) {
    return toHookSpecificOutput(hookEventName, decision.additionalContext);
  }

  return null;
}
