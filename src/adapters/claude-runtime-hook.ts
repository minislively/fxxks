import fs from "node:fs";
import path from "node:path";
import { decideCodexPreRead } from "./codex-pre-read";
import { resolvePromptFileContext } from "./codex-runtime-prompt";
import type { ContextBudget, ContextMode, PromptSpecificity } from "../core/schema";

export const CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS = 9000;

export type ClaudeRuntimeHookEvent = "SessionStart" | "UserPromptSubmit";

export type ClaudeRuntimeHookInput = {
  hookEventName: ClaudeRuntimeHookEvent;
  prompt?: string;
  sessionId?: string;
  cwd?: string;
};

export type ClaudeRuntimeHookDecision = {
  runtime: "claude";
  hookEventName: ClaudeRuntimeHookEvent;
  action: "noop" | "inject" | "fallback";
  filePath?: string;
  reasons: string[];
  additionalContext?: string;
  contextMode?: ContextMode;
  contextModeReason?: string;
  contextBudget?: ContextBudget;
  promptSpecificity?: PromptSpecificity;
  contextPolicyVersion?: "context-policy.v1";
  debug?: {
    eligible: boolean;
    bounded: boolean;
  };
  fallback?: {
    action: "full-read";
    reason: string;
  };
};

function clampAdditionalContext(value: string): string {
  if (value.length <= CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS) return value;
  return `${value.slice(0, CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS - 126).trimEnd()}\n\n[fooks: context truncated to stay within Claude hook additionalContext cap. Read the full source file if exact code is required.]`;
}

function boundedFallbackContext(filePath: string | undefined, reason: string): string {
  const target = filePath ?? "requested frontend file";
  return clampAdditionalContext(
    `fooks: Claude context hook fallback · file: ${target} · reason: ${reason} · Read the full source file for this turn. No Claude Read interception or runtime-token savings is claimed.`,
  );
}

function payloadContextMode(payload: NonNullable<ReturnType<typeof decideCodexPreRead>["payload"]>): ContextMode {
  return payload.useOriginal ? "light-minimal" : "light";
}

function buildPayloadContext(filePath: string, payload: NonNullable<ReturnType<typeof decideCodexPreRead>["payload"]>, contextMode: ContextMode): string {
  return clampAdditionalContext([
    `fooks: Claude context hook · file: ${filePath} · context-mode: ${contextMode}`,
    "This is bounded model-facing context for the explicit frontend file prompt. fooks does not intercept Claude Read/tool calls and does not claim Claude runtime-token savings.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n"));
}

function sessionStartContext(): string {
  return clampAdditionalContext([
    "fooks: Claude context hook is active for this project.",
    "When the user explicitly prompts about an existing in-project .tsx or .jsx file, fooks may add bounded model-facing context through UserPromptSubmit.",
    "P0 boundary: fooks does not intercept Claude Read/tool calls and does not claim Claude runtime-token savings.",
  ].join("\n"));
}

function noopDecision(input: ClaudeRuntimeHookInput, reasons: string[], policy?: ReturnType<typeof resolvePromptFileContext>["policy"]): ClaudeRuntimeHookDecision {
  return {
    runtime: "claude",
    hookEventName: input.hookEventName,
    action: "noop",
    reasons,
    contextMode: policy?.contextMode,
    contextModeReason: policy?.contextModeReason,
    contextBudget: policy?.contextBudget,
    promptSpecificity: policy?.promptSpecificity,
    contextPolicyVersion: policy?.contextPolicyVersion,
    debug: {
      eligible: false,
      bounded: true,
    },
  };
}

export function handleClaudeRuntimeHook(input: ClaudeRuntimeHookInput, cwd = process.cwd()): ClaudeRuntimeHookDecision {
  const hookEventName = input.hookEventName;

  if (hookEventName === "SessionStart") {
    return {
      runtime: "claude",
      hookEventName,
      action: "inject",
      reasons: ["session-start-context"],
      additionalContext: sessionStartContext(),
      contextMode: "light-minimal",
      contextModeReason: "claude-session-start-readiness",
      debug: {
        eligible: true,
        bounded: true,
      },
    };
  }

  const prompt = input.prompt ?? "";
  const promptContext = resolvePromptFileContext(prompt, cwd);
  const target = promptContext.filePath;
  const policy = promptContext.policy;

  if (!target) {
    return noopDecision(input, ["no-eligible-file-in-prompt"], policy);
  }

  const resolvedTarget = path.join(cwd, target);
  if (!fs.existsSync(resolvedTarget)) {
    return noopDecision(input, ["eligible-file-target-missing"], policy);
  }

  let decision: ReturnType<typeof decideCodexPreRead>;
  try {
    decision = decideCodexPreRead(resolvedTarget, cwd);
  } catch (error) {
    return {
      runtime: "claude",
      hookEventName,
      action: "fallback",
      filePath: target,
      reasons: ["payload-build-failed"],
      additionalContext: boundedFallbackContext(target, error instanceof Error ? error.message : String(error)),
      contextMode: "full",
      contextModeReason: "payload-build-failed",
      contextBudget: policy.contextBudget,
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        eligible: true,
        bounded: true,
      },
      fallback: {
        action: "full-read",
        reason: "payload-build-failed",
      },
    };
  }

  if (decision.decision === "payload" && decision.payload) {
    const contextMode = payloadContextMode(decision.payload);
    return {
      runtime: "claude",
      hookEventName,
      action: "inject",
      filePath: target,
      reasons: ["first-eligible-file-prompt"],
      additionalContext: buildPayloadContext(target, decision.payload, contextMode),
      contextMode,
      contextModeReason: contextMode === "light-minimal" ? "first-exact-file-tiny-raw-original" : "first-exact-file-payload",
      contextBudget: policy.contextBudget,
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        eligible: true,
        bounded: true,
      },
    };
  }

  return {
    runtime: "claude",
    hookEventName,
    action: "fallback",
    filePath: target,
    reasons: decision.reasons,
    additionalContext: boundedFallbackContext(target, decision.fallback?.reason ?? decision.reasons[0] ?? "full-read"),
    contextMode: "full",
    contextModeReason: decision.fallback?.reason ?? decision.reasons[0] ?? "full-read",
    contextBudget: policy.contextBudget,
    promptSpecificity: policy.promptSpecificity,
    contextPolicyVersion: policy.contextPolicyVersion,
    debug: {
      eligible: decision.eligible,
      bounded: true,
    },
    fallback: {
      action: "full-read",
      reason: decision.fallback?.reason ?? decision.reasons[0] ?? "full-read",
    },
  };
}
