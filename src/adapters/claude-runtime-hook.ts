import fs from "node:fs";
import path from "node:path";
import { decidePreRead } from "./pre-read";
import { clearClaudeRuntimeSession, initializeClaudeRuntimeSession, markClaudeRuntimeSeenFile, resolveClaudeRuntimeSessionKey } from "./claude-runtime-session";
import { clearClaudeActiveFile, ensureFreshClaudeContextForTarget, markClaudeAttachPrepared } from "./claude-runtime-trust";
import { extractPromptTargets, hasFullReadEscapeHatch, resolvePromptFileContext } from "./prompt-context";
import {
  clampAdditionalContext,
  boundedFallbackContext,
  sessionStartContext,
  CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS,
} from "./claude-runtime-status";
import type { ContextBudget, ContextMode, ModelFacingPayload, PromptSpecificity } from "../core/schema";
import {
  estimateFileBytes,
  estimateTextBytes,
  finalizeSessionMetricSummarySafe,
  initializeSessionMetricSummarySafe,
  recordFooksSessionMetricEventSafe,
} from "../core/session-metrics";
import { finalizeWorktreeEvidenceSafe, initializeWorktreeEvidenceSafe } from "../core/worktree-evidence";

export { CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS };

export type ClaudeRuntimeHookEvent = "SessionStart" | "UserPromptSubmit" | "Stop";

export type ClaudeRuntimeHookInput = {
  hookEventName: ClaudeRuntimeHookEvent;
  prompt?: string;
  sessionId?: string;
  cwd?: string;
};

export type ClaudeRuntimeHookDecision = {
  runtime: "claude";
  hookEventName: ClaudeRuntimeHookEvent;
  action: "noop" | "record" | "inject" | "fallback";
  filePath?: string;
  reasons: string[];
  additionalContext?: string;
  statePath?: string;
  contextMode?: ContextMode;
  contextModeReason?: string;
  contextBudget?: ContextBudget;
  promptSpecificity?: PromptSpecificity;
  contextPolicyVersion?: "context-policy.v1";
  debug?: {
    repeatedFile: boolean;
    eligible: boolean;
    bounded: boolean;
    escapeHatchUsed?: boolean;
    decision?: ReturnType<typeof decidePreRead>;
  };
  fallback?: {
    action: "full-read";
    reason: string;
  };
};

function payloadContextMode(payload: NonNullable<ReturnType<typeof decidePreRead>["payload"]>): ContextMode {
  return payload.useOriginal ? "light-minimal" : "light";
}

function payloadContextModeReason(
  phase: "first-seen" | "repeated",
  contextMode: ContextMode,
  payload: NonNullable<ReturnType<typeof decidePreRead>["payload"]>,
  editGuidanceIncluded: boolean,
): string {
  if (editGuidanceIncluded) return `${phase}-exact-file-edit-guidance`;
  if (contextMode === "light-minimal") return `${phase}-exact-file-tiny-raw-original`;
  return payload.domainPayload?.domain === "react-web"
    ? `${phase}-exact-file-react-web-payload`
    : `${phase}-exact-file-narrow-payload`;
}

function buildPayloadContext(
  filePath: string,
  payload: NonNullable<ReturnType<typeof decidePreRead>["payload"]>,
  contextMode: ContextMode,
): { context: string; truncated: boolean; removedSections: string[] } {
  const prefix = [
    `fooks: Claude context hook · file: ${filePath} · context-mode: ${contextMode}`,
    "fooks does not intercept Claude Read or claim runtime-token savings.",
    "",
  ].join("\n");
  const maxPayloadChars = CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS - prefix.length;
  const removedSections: string[] = [];
  const workingPayload = { ...payload } as Record<string, unknown>;
  const sectionsToRemove = ["style", "snippets", "structure", "behavior"];

  let json = JSON.stringify(workingPayload, null, 2);
  while (json.length > maxPayloadChars && sectionsToRemove.length > 0) {
    const section = sectionsToRemove.shift()!;
    if (workingPayload[section] !== undefined) {
      delete workingPayload[section];
      removedSections.push(section);
      json = JSON.stringify(workingPayload, null, 2);
    }
  }

  const rawContext = `${prefix}${json}`;
  const truncated = removedSections.length > 0 || rawContext.length > CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS;
  const context = clampAdditionalContext(rawContext);
  return { context, truncated, removedSections };
}

function targetEstimatedBytes(cwd: string, filePath: string): number | undefined {
  return estimateFileBytes(path.join(cwd, filePath));
}

function truncatedReason(removedSections: string[]): string {
  return removedSections.length > 0 ? `truncated: ${removedSections.join(", ")}` : "truncated: max-additional-context";
}

const EDIT_INTENT_PATTERN = /\b(?:update|fix|change|add|remove|refactor|patch|modify|implement|rename|replace|adjust|simplify|rewrite)\b/i;
const FRONTEND_EXTENSIONS = new Set([".tsx", ".jsx"]);

export function isClaudeEditIntentPrompt(prompt: string): boolean {
  return EDIT_INTENT_PATTERN.test(prompt);
}

function hasSingleExactFrontendTarget(
  prompt: string,
  policy: ReturnType<typeof resolvePromptFileContext>["policy"],
  target: string,
  cwd: string,
): boolean {
  const allExplicitCodeTargets = extractPromptTargets(prompt, cwd, "codex-ts-js-beta");
  if (allExplicitCodeTargets.length !== 1 || allExplicitCodeTargets[0]?.filePath !== target) return false;
  if (policy.promptSpecificity !== "exact-file") return false;
  if (policy.targets.length !== 1) return false;
  if (policy.targets[0]?.filePath !== target || !policy.targets[0]?.exists) return false;
  if (!FRONTEND_EXTENSIONS.has(path.extname(target))) return false;
  return fs.existsSync(path.join(cwd, target));
}

function hasPositiveFreshness(target: string, cwd: string, freshness: ReturnType<typeof ensureFreshClaudeContextForTarget>): boolean {
  return fs.existsSync(path.join(cwd, target)) && Boolean(freshness.scannedAt);
}

function canAttemptRuntimeEditGuidance(
  prompt: string,
  target: string,
  cwd: string,
  policy: ReturnType<typeof resolvePromptFileContext>["policy"],
  freshness: ReturnType<typeof ensureFreshClaudeContextForTarget>,
): boolean {
  return hasSingleExactFrontendTarget(prompt, policy, target, cwd) && isClaudeEditIntentPrompt(prompt) && hasPositiveFreshness(target, cwd, freshness);
}

function hasMatchingEditGuidance(payload: ModelFacingPayload): boolean {
  return Boolean(
    payload.sourceFingerprint &&
      payload.editGuidance?.freshness.fileHash === payload.sourceFingerprint.fileHash &&
      payload.editGuidance.freshness.lineCount === payload.sourceFingerprint.lineCount,
  );
}

function recordClaudeMetric(
  cwd: string,
  sessionKey: string,
  decision: ClaudeRuntimeHookDecision,
  options: {
    originalEstimatedBytes?: number;
    actualEstimatedBytes?: number;
    comparableForSavings?: boolean;
    observedOriginalEstimatedBytes?: number;
  } = {},
): void {
  recordFooksSessionMetricEventSafe(cwd, sessionKey, {
    runtime: "claude",
    measurementSource: "project-local-context-hook",
    eventName: decision.hookEventName,
    hookEventName: decision.hookEventName,
    action: decision.action,
    filePath: decision.filePath,
    reasons: decision.reasons,
    contextMode: decision.contextMode,
    contextModeReason: decision.contextModeReason,
    fallbackReason: decision.fallback?.reason,
    originalEstimatedBytes: options.originalEstimatedBytes,
    actualEstimatedBytes: options.actualEstimatedBytes,
    comparableForSavings: options.comparableForSavings,
    observedOriginalEstimatedBytes: options.observedOriginalEstimatedBytes,
  });
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
      repeatedFile: false,
      eligible: false,
      bounded: true,
      escapeHatchUsed: false,
    },
  };
}

const VALID_CLAUDE_HOOK_EVENTS = new Set<ClaudeRuntimeHookEvent>(["SessionStart", "UserPromptSubmit", "Stop"]);

export function handleClaudeRuntimeHook(input: ClaudeRuntimeHookInput, cwd = process.cwd()): ClaudeRuntimeHookDecision {
  const hookEventName = input.hookEventName;
  if (!VALID_CLAUDE_HOOK_EVENTS.has(hookEventName)) {
    return noopDecision({ ...input, hookEventName: "UserPromptSubmit" }, ["unrecognized-hook-event"]);
  }
  const sessionKey = resolveClaudeRuntimeSessionKey(input.sessionId);

  if (hookEventName === "SessionStart") {
    const statePath = initializeClaudeRuntimeSession(cwd, sessionKey);
    initializeSessionMetricSummarySafe(cwd, sessionKey, { runtime: "claude", measurementSource: "project-local-context-hook" });
    initializeWorktreeEvidenceSafe(cwd, sessionKey);
    return {
      runtime: "claude",
      hookEventName,
      action: "inject",
      reasons: ["session-start-context"],
      additionalContext: sessionStartContext(),
      statePath,
      contextMode: "light-minimal",
      contextModeReason: "claude-session-start-readiness",
      debug: {
        repeatedFile: false,
        eligible: true,
        bounded: true,
        escapeHatchUsed: false,
      },
    };
  }

  if (hookEventName === "Stop") {
    const statePath = clearClaudeRuntimeSession(cwd, sessionKey);
    clearClaudeActiveFile(cwd);
    finalizeSessionMetricSummarySafe(cwd, sessionKey, { runtime: "claude", measurementSource: "project-local-context-hook" });
    finalizeWorktreeEvidenceSafe(cwd, sessionKey);
    return {
      runtime: "claude",
      hookEventName,
      action: "noop",
      reasons: ["session-stop"],
      statePath,
      contextMode: "no-op",
      contextModeReason: "session-stop",
      debug: {
        repeatedFile: false,
        eligible: false,
        bounded: true,
        escapeHatchUsed: false,
      },
    };
  }

  const prompt = input.prompt ?? "";
  const promptContext = resolvePromptFileContext(prompt, cwd);
  const target = promptContext.filePath;
  const policy = promptContext.policy;

  if (!target) {
    const decision = noopDecision(input, ["no-eligible-file-in-prompt"], policy);
    recordClaudeMetric(cwd, sessionKey, decision);
    return decision;
  }

  const resolvedTarget = path.join(cwd, target);
  if (!fs.existsSync(resolvedTarget)) {
    const decision = noopDecision(input, ["eligible-file-target-missing"], policy);
    recordClaudeMetric(cwd, sessionKey, decision);
    return decision;
  }

  const escapeHatchUsed = hasFullReadEscapeHatch(prompt);
  if (escapeHatchUsed) {
    const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
    const runtimeDecision: ClaudeRuntimeHookDecision = {
      runtime: "claude",
      hookEventName,
      action: "fallback",
      filePath: target,
      reasons: ["escape-hatch-full-read"],
      additionalContext: boundedFallbackContext(target, "escape-hatch-full-read"),
      contextMode: "full",
      contextModeReason: "escape-hatch-full-read",
      contextBudget: policy.contextBudget,
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        repeatedFile: false,
        eligible: true,
        bounded: true,
        escapeHatchUsed: true,
      },
      fallback: {
        action: "full-read",
        reason: "escape-hatch-full-read",
      },
    };
    markClaudeAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    recordClaudeMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: originalEstimatedBytes,
      comparableForSavings: originalEstimatedBytes !== undefined,
    });
    return runtimeDecision;
  }

  const { statePath, seenCount } = markClaudeRuntimeSeenFile(cwd, sessionKey, target);
  const repeatedFile = seenCount >= 2;

  const freshness = repeatedFile ? ensureFreshClaudeContextForTarget(target, cwd) : { refreshed: false };
  const refreshed = freshness.refreshed;

  if (!repeatedFile) {
    if (process.env.FOOKS_CLAUDE_FIRST_SEEN_INJECT === "1") {
      let preRead: ReturnType<typeof decidePreRead> | undefined;
      try {
        preRead = decidePreRead(resolvedTarget, cwd, "claude");
      } catch {
        // fall through to default record behavior
      }
      if (preRead?.decision === "payload" && preRead.payload) {
        const contextMode = payloadContextMode(preRead.payload);
        const { context: additionalContext, truncated, removedSections } = buildPayloadContext(target, preRead.payload, contextMode);
        const reasons = ["first-seen-file", "first-seen-inject"];
        if (truncated) {
          reasons.push(`truncated: ${removedSections.join(", ")}`);
        }
        const decision: ClaudeRuntimeHookDecision = {
          runtime: "claude",
          hookEventName,
          action: "inject",
          filePath: target,
          reasons,
          additionalContext,
          statePath,
          contextMode,
          contextModeReason: payloadContextModeReason("first-seen", contextMode, preRead.payload, false),
          contextBudget: policy.contextBudget,
          promptSpecificity: policy.promptSpecificity,
          contextPolicyVersion: policy.contextPolicyVersion,
          debug: {
            repeatedFile: false,
            eligible: true,
            bounded: true,
            escapeHatchUsed: false,
          },
        };
        markClaudeAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
        recordClaudeMetric(cwd, sessionKey, decision, {
          originalEstimatedBytes: targetEstimatedBytes(cwd, target),
          actualEstimatedBytes: estimateTextBytes(additionalContext),
          comparableForSavings: true,
        });
        return decision;
      }
    }

    const decision: ClaudeRuntimeHookDecision = {
      runtime: "claude",
      hookEventName,
      action: "record",
      filePath: target,
      reasons: ["first-seen-file", "context-mode:no-op"],
      statePath,
      contextMode: "no-op",
      contextModeReason: "first-turn-exact-file-record-only",
      contextBudget: { ...policy.contextBudget, selectedFiles: 0, totalBytes: 0, skippedFiles: policy.contextBudget.selectedFiles },
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        repeatedFile: false,
        eligible: true,
        bounded: true,
        escapeHatchUsed: false,
      },
    };
    recordClaudeMetric(cwd, sessionKey, decision, {
      observedOriginalEstimatedBytes: targetEstimatedBytes(cwd, target),
    });
    return decision;
  }

  let decision: ReturnType<typeof decidePreRead>;
  try {
    decision = decidePreRead(resolvedTarget, cwd, "claude");
  } catch (error) {
    markClaudeAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
    const runtimeDecision: ClaudeRuntimeHookDecision = {
      runtime: "claude",
      hookEventName,
      action: "fallback",
      filePath: target,
      reasons: ["repeated-file", "payload-build-failed"],
      additionalContext: boundedFallbackContext(target, error instanceof Error ? error.message : String(error)),
      statePath,
      contextMode: "full",
      contextModeReason: "payload-build-failed",
      contextBudget: policy.contextBudget,
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        repeatedFile: true,
        eligible: true,
        bounded: true,
        escapeHatchUsed: false,
      },
      fallback: {
        action: "full-read",
        reason: "payload-build-failed",
      },
    };
    recordClaudeMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: originalEstimatedBytes,
      comparableForSavings: originalEstimatedBytes !== undefined,
    });
    return runtimeDecision;
  }

  const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
  const editGuidanceAllowed =
    decision.decision === "payload" &&
    Boolean(decision.payload?.sourceFingerprint) &&
    canAttemptRuntimeEditGuidance(prompt, target, cwd, policy, freshness);
  if (editGuidanceAllowed) {
    try {
      const optInDecision = decidePreRead(resolvedTarget, cwd, "claude", { includeEditGuidance: true });
      if (optInDecision.decision === "payload" && optInDecision.payload && hasMatchingEditGuidance(optInDecision.payload)) {
        const optInContextMode = payloadContextMode(optInDecision.payload);
        const optInPayloadContext = buildPayloadContext(target, optInDecision.payload, optInContextMode);
        if (!optInPayloadContext.truncated && optInPayloadContext.context.length <= CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS) {
          decision = optInDecision;
        }
      }
    } catch {
      // Optional edit guidance must never make the Claude hook fail.
    }
  }

  if (decision.decision === "payload" && decision.payload) {
    const contextMode = payloadContextMode(decision.payload);
    const { context: additionalContext, truncated, removedSections } = buildPayloadContext(target, decision.payload, contextMode);
    const editGuidanceIncluded = hasMatchingEditGuidance(decision.payload);
    const reasons = [
      "repeated-file",
      ...(refreshed ? ["refreshed-before-inject"] : []),
      ...(editGuidanceIncluded ? ["edit-guidance-opt-in"] : []),
    ];
    if (truncated) {
      reasons.push(truncatedReason(removedSections));
    }
    const runtimeDecision: ClaudeRuntimeHookDecision = {
      runtime: "claude",
      hookEventName,
      action: "inject",
      filePath: target,
      reasons,
      additionalContext,
      statePath,
      contextMode,
      contextModeReason: payloadContextModeReason("repeated", contextMode, decision.payload, editGuidanceIncluded),
      contextBudget: policy.contextBudget,
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        repeatedFile: true,
        eligible: true,
        bounded: true,
        escapeHatchUsed: false,
        decision,
      },
    };
    markClaudeAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    recordClaudeMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: estimateTextBytes(additionalContext),
      comparableForSavings: editGuidanceIncluded ? false : originalEstimatedBytes !== undefined,
    });
    return runtimeDecision;
  }

  markClaudeAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
  const runtimeDecision: ClaudeRuntimeHookDecision = {
    runtime: "claude",
    hookEventName,
    action: "fallback",
    filePath: target,
    reasons: decision.reasons.includes("repeated-file") ? decision.reasons : ["repeated-file", ...decision.reasons],
    additionalContext: boundedFallbackContext(target, decision.fallback?.reason ?? decision.reasons[0] ?? "full-read"),
    statePath,
    contextMode: "full",
    contextModeReason: decision.fallback?.reason ?? decision.reasons[0] ?? "full-read",
    contextBudget: policy.contextBudget,
    promptSpecificity: policy.promptSpecificity,
    contextPolicyVersion: policy.contextPolicyVersion,
    debug: {
      repeatedFile: true,
      eligible: decision.eligible,
      bounded: true,
      escapeHatchUsed: false,
    },
    fallback: {
      action: "full-read",
      reason: decision.fallback?.reason ?? decision.reasons[0] ?? "full-read",
    },
  };
  recordClaudeMetric(cwd, sessionKey, runtimeDecision, {
    originalEstimatedBytes,
    actualEstimatedBytes: originalEstimatedBytes,
    comparableForSavings: originalEstimatedBytes !== undefined,
  });
  return runtimeDecision;
}
