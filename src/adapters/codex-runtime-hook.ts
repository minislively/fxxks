import path from "node:path";
import { decideCodexPreRead } from "./codex-pre-read";
import { hasFullReadEscapeHatch, resolvePromptFileContext } from "./codex-runtime-prompt";
import { buildPreReadReuseStatus } from "./codex-runtime-status";
import { clearCodexActiveFile, ensureFreshCodexContextForTarget, markCodexAttachPrepared, markCodexReady } from "./codex-runtime-trust";
import {
  clearCodexRuntimeSession,
  initializeCodexRuntimeSession,
  markCodexRuntimeSeenFile,
  resolveCodexRuntimeSessionKey,
} from "./codex-runtime-session";
import type { CodexRuntimeHookDecision, CodexRuntimeHookInput, ContextMode, ModelFacingPayload } from "../core/schema";
import {
  estimateFileBytes,
  estimateTextBytes,
  finalizeSessionMetricSummarySafe,
  initializeSessionMetricSummarySafe,
  recordFooksSessionMetricEventSafe,
} from "../core/session-metrics";

function payloadContextMode(payload: ModelFacingPayload): ContextMode {
  return payload.useOriginal ? "light-minimal" : "light";
}

function buildAdditionalContext(filePath: string, payload: ModelFacingPayload, contextMode: ContextMode): string {
  return [
    `${buildPreReadReuseStatus(payload.mode)} · file: ${filePath} · context-mode: ${contextMode}`,
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function targetEstimatedBytes(cwd: string, filePath: string): number | undefined {
  return estimateFileBytes(path.join(cwd, filePath));
}

function recordRuntimeDecisionMetric(
  cwd: string,
  sessionKey: string,
  decision: CodexRuntimeHookDecision,
  options: {
    originalEstimatedBytes?: number;
    actualEstimatedBytes?: number;
    comparableForSavings?: boolean;
    observedOriginalEstimatedBytes?: number;
  } = {},
): void {
  recordFooksSessionMetricEventSafe(cwd, sessionKey, {
    runtime: "codex",
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

function fallbackDecision(
  hookEventName: CodexRuntimeHookInput["hookEventName"],
  filePath: string | undefined,
  statePath: string | undefined,
  reasons: string[],
  repeatedFile: boolean,
  eligible: boolean,
  escapeHatchUsed: boolean,
  fallbackReason: string,
  policy?: ReturnType<typeof resolvePromptFileContext>["policy"],
  decision?: ReturnType<typeof decideCodexPreRead>,
): CodexRuntimeHookDecision {
  return {
    runtime: "codex",
    hookEventName,
    action: "fallback",
    filePath,
    reasons,
    statePath,
    debug: {
      repeatedFile,
      eligible,
      escapeHatchUsed,
      decision,
    },
    contextMode: "full",
    contextModeReason: fallbackReason,
    contextBudget: policy?.contextBudget,
    promptSpecificity: policy?.promptSpecificity,
    contextPolicyVersion: policy?.contextPolicyVersion,
    fallback: {
      action: "full-read",
      reason: fallbackReason,
    },
  };
}

export function handleCodexRuntimeHook(input: CodexRuntimeHookInput, cwd = process.cwd()): CodexRuntimeHookDecision {
  const hookEventName = input.hookEventName;
  const sessionKey = resolveCodexRuntimeSessionKey(input.sessionId, input.threadId);

  if (hookEventName === "SessionStart") {
    const statePath = initializeCodexRuntimeSession(cwd, sessionKey);
    markCodexReady(cwd);
    initializeSessionMetricSummarySafe(cwd, sessionKey);
    return {
      runtime: "codex",
      hookEventName,
      action: "noop",
      reasons: [],
      statePath,
      contextMode: "no-op",
      contextModeReason: "session-start",
      debug: {
        repeatedFile: false,
        eligible: false,
        escapeHatchUsed: false,
      },
    };
  }

  if (hookEventName === "Stop") {
    const statePath = clearCodexRuntimeSession(cwd, sessionKey);
    clearCodexActiveFile(cwd);
    finalizeSessionMetricSummarySafe(cwd, sessionKey);
    return {
      runtime: "codex",
      hookEventName,
      action: "noop",
      reasons: [],
      statePath,
      contextMode: "no-op",
      contextModeReason: "session-stop",
      debug: {
        repeatedFile: false,
        eligible: false,
        escapeHatchUsed: false,
      },
    };
  }

  const prompt = input.prompt ?? "";
  const promptContext = resolvePromptFileContext(prompt, cwd);
  const target = promptContext.filePath;
  const policy = promptContext.policy;
  const escapeHatchUsed = hasFullReadEscapeHatch(prompt);

  if (!target) {
    const runtimeDecision: CodexRuntimeHookDecision = {
      runtime: "codex",
      hookEventName,
      action: "noop",
      reasons: ["no-eligible-file-in-prompt"],
      contextMode: policy.contextMode,
      contextModeReason: policy.contextModeReason,
      contextBudget: policy.contextBudget,
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        repeatedFile: false,
        eligible: false,
        escapeHatchUsed,
      },
    };
    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision);
    return runtimeDecision;
  }

  if (escapeHatchUsed) {
    markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
    const runtimeDecision = fallbackDecision(
      hookEventName,
      target,
      undefined,
      ["escape-hatch-full-read"],
      false,
      true,
      true,
      "escape-hatch-full-read",
      policy,
    );
    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: originalEstimatedBytes,
      comparableForSavings: originalEstimatedBytes !== undefined,
    });
    return runtimeDecision;
  }

  const freshness = ensureFreshCodexContextForTarget(target, cwd);
  const { statePath, seenCount } = markCodexRuntimeSeenFile(cwd, sessionKey, target);
  const repeatedFile = seenCount >= 2;

  if (!repeatedFile) {
    markCodexReady(cwd);
    const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
    const runtimeDecision: CodexRuntimeHookDecision = {
      runtime: "codex",
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
        escapeHatchUsed: false,
      },
    };
    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
      observedOriginalEstimatedBytes: originalEstimatedBytes,
    });
    return runtimeDecision;
  }

  let decision: ReturnType<typeof decideCodexPreRead>;
  try {
    decision = decideCodexPreRead(path.join(cwd, target), cwd);
  } catch {
    markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
    const runtimeDecision = fallbackDecision(
      hookEventName,
      target,
      statePath,
      ["repeated-file", "payload-build-failed"],
      true,
      true,
      false,
      "payload-build-failed",
      policy,
    );
    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: originalEstimatedBytes,
      comparableForSavings: originalEstimatedBytes !== undefined,
    });
    return runtimeDecision;
  }

  if (decision.decision === "payload" && decision.payload) {
    const contextMode = payloadContextMode(decision.payload);
    const additionalContext = buildAdditionalContext(target, decision.payload, contextMode);
    markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
    const runtimeDecision: CodexRuntimeHookDecision = {
      runtime: "codex",
      hookEventName,
      action: "inject",
      filePath: target,
      reasons: freshness.refreshed ? ["repeated-file", "refreshed-before-attach"] : ["repeated-file"],
      statePath,
      additionalContext,
      contextMode,
      contextModeReason: contextMode === "light-minimal" ? "repeated-exact-file-tiny-raw-original" : "repeated-exact-file-payload",
      contextBudget: policy.contextBudget,
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        repeatedFile: true,
        eligible: true,
        escapeHatchUsed: false,
        decision,
      },
    };
    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: estimateTextBytes(additionalContext),
      comparableForSavings: originalEstimatedBytes !== undefined,
    });
    return runtimeDecision;
  }

  markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
  const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
  const runtimeDecision = fallbackDecision(
    hookEventName,
    target,
    statePath,
    decision.reasons,
    true,
    decision.eligible,
    false,
    decision.fallback?.reason ?? decision.reasons[0] ?? "raw-mode",
    policy,
    decision,
  );
  recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
    originalEstimatedBytes,
    actualEstimatedBytes: originalEstimatedBytes,
    comparableForSavings: originalEstimatedBytes !== undefined,
  });
  return runtimeDecision;
}
