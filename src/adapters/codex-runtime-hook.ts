import fs from "node:fs";
import path from "node:path";
import { decidePreRead } from "./pre-read";
import { hasFullReadEscapeHatch, resolvePromptFileContext } from "./prompt-context";
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
import { finalizeWorktreeEvidenceSafe, initializeWorktreeEvidenceSafe } from "../core/worktree-evidence";

const EDIT_INTENT_PATTERN = /\b(?:update|fix|change|add|remove|refactor|patch|modify)\b/i;
const FRONTEND_EXTENSIONS = new Set([".tsx", ".jsx"]);
const EDIT_GUIDANCE_CONTEXT_MAX_BYTES = 8_192;

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

export function isEditIntentPrompt(prompt: string): boolean {
  return EDIT_INTENT_PATTERN.test(prompt);
}

function hasSingleExactFrontendTarget(
  policy: ReturnType<typeof resolvePromptFileContext>["policy"],
  target: string,
  cwd: string,
): boolean {
  if (policy.promptSpecificity !== "exact-file") return false;
  if (policy.targets.length !== 1) return false;
  if (policy.targets[0]?.filePath !== target || !policy.targets[0]?.exists) return false;
  if (!FRONTEND_EXTENSIONS.has(path.extname(target))) return false;
  return fs.existsSync(path.join(cwd, target));
}

export function hasPositiveFreshness(target: string, cwd: string, freshness: ReturnType<typeof ensureFreshCodexContextForTarget>): boolean {
  return fs.existsSync(path.join(cwd, target)) && Boolean(freshness.scannedAt);
}

function canAttemptRuntimeEditGuidance(
  prompt: string,
  target: string,
  cwd: string,
  policy: ReturnType<typeof resolvePromptFileContext>["policy"],
  freshness: ReturnType<typeof ensureFreshCodexContextForTarget>,
): boolean {
  return hasSingleExactFrontendTarget(policy, target, cwd) && isEditIntentPrompt(prompt) && hasPositiveFreshness(target, cwd, freshness);
}

function hasMatchingEditGuidance(payload: ModelFacingPayload): boolean {
  return Boolean(
    payload.sourceFingerprint &&
      payload.editGuidance?.freshness.fileHash === payload.sourceFingerprint.fileHash &&
      payload.editGuidance.freshness.lineCount === payload.sourceFingerprint.lineCount,
  );
}

function editGuidanceBudgetLimit(originalEstimatedBytes: number | undefined): number {
  if (originalEstimatedBytes === undefined) return EDIT_GUIDANCE_CONTEXT_MAX_BYTES;
  return Math.min(EDIT_GUIDANCE_CONTEXT_MAX_BYTES, Math.max(originalEstimatedBytes * 2, 4_096));
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
  decision?: ReturnType<typeof decidePreRead>,
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
    initializeWorktreeEvidenceSafe(cwd, sessionKey);
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
    finalizeWorktreeEvidenceSafe(cwd, sessionKey);
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
  const promptContext = resolvePromptFileContext(prompt, cwd, "codex-ts-js-beta");
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

  let decision: ReturnType<typeof decidePreRead>;
  try {
    decision = decidePreRead(path.join(cwd, target), cwd);
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

  const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
  const editGuidanceAllowed =
    decision.decision === "payload" &&
    Boolean(decision.payload?.sourceFingerprint) &&
    canAttemptRuntimeEditGuidance(prompt, target, cwd, policy, freshness);
  if (editGuidanceAllowed) {
    try {
      const optInDecision = decidePreRead(path.join(cwd, target), cwd, "codex", { includeEditGuidance: true });
      if (optInDecision.decision === "payload" && optInDecision.payload && hasMatchingEditGuidance(optInDecision.payload)) {
        const optInContextMode = payloadContextMode(optInDecision.payload);
        const optInAdditionalContext = buildAdditionalContext(target, optInDecision.payload, optInContextMode);
        const estimatedContextBytes = estimateTextBytes(optInAdditionalContext);
        if (estimatedContextBytes <= editGuidanceBudgetLimit(originalEstimatedBytes)) {
          decision = optInDecision;
        }
      }
    } catch {
      // If the optional edit-guidance pass fails, keep the already-built compact payload.
    }
  }

  if (decision.decision === "payload" && decision.payload) {
    const contextMode = payloadContextMode(decision.payload);
    const additionalContext = buildAdditionalContext(target, decision.payload, contextMode);
    markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    const editGuidanceIncluded = hasMatchingEditGuidance(decision.payload);
    const runtimeDecision: CodexRuntimeHookDecision = {
      runtime: "codex",
      hookEventName,
      action: "inject",
      filePath: target,
      reasons: [
        "repeated-file",
        ...(freshness.refreshed ? ["refreshed-before-attach"] : []),
        ...(editGuidanceIncluded ? ["edit-guidance-opt-in"] : []),
      ],
      statePath,
      additionalContext,
      contextMode,
      contextModeReason: editGuidanceIncluded
        ? "repeated-exact-file-edit-guidance"
        : contextMode === "light-minimal"
          ? "repeated-exact-file-tiny-raw-original"
          : "repeated-exact-file-payload",
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
      comparableForSavings: editGuidanceIncluded ? false : originalEstimatedBytes !== undefined,
    });
    return runtimeDecision;
  }

  markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
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
