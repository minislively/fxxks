import fs from "node:fs";
import path from "node:path";
import { decidePreRead } from "./pre-read";
import { hasFullReadEscapeHatch, resolvePromptFileContext } from "./prompt-context";
import { appendProjectKnowledgeBlock, resolveProjectKnowledgeContext } from "../core/project-knowledge";
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

const EDIT_INTENT_PATTERN = /\b(?:update|fix|change|add|remove|refactor|patch|modify|implement|rename|replace|adjust|simplify|rewrite)\b/i;
const FRONTEND_EXTENSIONS = new Set([".tsx", ".jsx"]);
const EDIT_GUIDANCE_CONTEXT_MAX_BYTES = 8_192;

type RuntimeReactWebContext = NonNullable<ModelFacingPayload["reactWebContext"]>;
type RuntimeReactWebContextArrayKey = Exclude<{
  [Key in keyof RuntimeReactWebContext]: RuntimeReactWebContext[Key] extends unknown[] | undefined ? Key : never;
}[keyof RuntimeReactWebContext], undefined>;
type PackedRuntimeReactWebContext = {
  schemaVersion: RuntimeReactWebContext["schemaVersion"];
  freshness: RuntimeReactWebContext["freshness"];
  scope: {
    kind: RuntimeReactWebContext["scope"]["kind"];
    filePath: RuntimeReactWebContext["scope"]["filePath"];
    componentName?: RuntimeReactWebContext["scope"]["componentName"];
  };
} & Partial<Pick<RuntimeReactWebContext, RuntimeReactWebContextArrayKey>>;

const RUNTIME_REACT_WEB_CONTEXT_PACKING_PRIORITY: RuntimeReactWebContextArrayKey[] = [
  "editTargetRouting",
  "formStateFlow",
  "a11yAnchors",
  "intentTargets",
  "stateHints",
  "layoutRegionHints",
  "componentApiHints",
  "stylingVariantHints",
  "importRoleHints",
  "renderStates",
  "localDependencies",
];

function payloadContextMode(payload: ModelFacingPayload): ContextMode {
  return payload.useOriginal ? "light-minimal" : "light";
}

function payloadContextModeReason(
  phase: "first-seen" | "repeated",
  contextMode: ContextMode,
  payload: ModelFacingPayload,
  editGuidanceIncluded: boolean,
): string {
  if (editGuidanceIncluded) return `${phase}-exact-file-edit-guidance`;
  if (contextMode === "light-minimal") return `${phase}-exact-file-tiny-raw-original`;
  return payload.domainPayload?.domain === "react-web"
    ? `${phase}-exact-file-react-web-payload`
    : `${phase}-exact-file-narrow-payload`;
}

function minimalRuntimeReactWebContext(reactWebContext: RuntimeReactWebContext): PackedRuntimeReactWebContext {
  return {
    schemaVersion: reactWebContext.schemaVersion,
    freshness: reactWebContext.freshness,
    scope: {
      kind: reactWebContext.scope.kind,
      filePath: reactWebContext.scope.filePath,
      componentName: reactWebContext.scope.componentName,
    },
  };
}

function optimizedReactWebRuntimePayload(payload: ModelFacingPayload, reactWebContext?: PackedRuntimeReactWebContext): unknown {
  return {
    filePath: payload.filePath,
    sourceFingerprint: payload.sourceFingerprint,
    domainPayload: payload.domainPayload,
    ...(payload.editGuidance ? { editGuidance: payload.editGuidance } : {}),
    ...(reactWebContext ? { reactWebContext } : {}),
  };
}

function buildRuntimeContextPayload(payload: ModelFacingPayload, reactWebContext?: PackedRuntimeReactWebContext): { optimized: boolean; payload: unknown } {
  if (payload.domainPayload?.domain === "react-web" && !payload.useOriginal) {
    return {
      optimized: true,
      payload: optimizedReactWebRuntimePayload(payload, reactWebContext),
    };
  }
  return { optimized: false, payload };
}

function renderAdditionalContext(
  filePath: string,
  payloadMode: ModelFacingPayload["mode"],
  contextMode: ContextMode,
  runtimeContextPayload: ReturnType<typeof buildRuntimeContextPayload>,
): string {
  return [
    `${buildPreReadReuseStatus(payloadMode)} · file: ${filePath} · context-mode: ${contextMode}`,
    JSON.stringify(runtimeContextPayload.payload, null, runtimeContextPayload.optimized ? undefined : 2),
  ].join("\n");
}

function renderOptimizedReactWebAdditionalContext(
  filePath: string,
  payload: ModelFacingPayload,
  contextMode: ContextMode,
  reactWebContext?: PackedRuntimeReactWebContext,
): string {
  return renderAdditionalContext(filePath, payload.mode, contextMode, buildRuntimeContextPayload(payload, reactWebContext));
}

function compactRuntimeReactWebContext(
  filePath: string,
  payload: ModelFacingPayload,
  contextMode: ContextMode,
  maxOptimizedContextBytes?: number,
): PackedRuntimeReactWebContext | undefined {
  if (!payload.reactWebContext) return undefined;

  const fits = (reactWebContext?: PackedRuntimeReactWebContext): boolean => {
    if (maxOptimizedContextBytes === undefined) return true;
    const additionalContext = renderOptimizedReactWebAdditionalContext(filePath, payload, contextMode, reactWebContext);
    return estimateTextBytes(additionalContext) <= maxOptimizedContextBytes;
  };

  const compactContext = minimalRuntimeReactWebContext(payload.reactWebContext);
  if (!fits(compactContext)) return undefined;

  for (const field of RUNTIME_REACT_WEB_CONTEXT_PACKING_PRIORITY) {
    const values = payload.reactWebContext[field];
    if (!Array.isArray(values) || values.length === 0) continue;

    const fullCandidate = { ...compactContext, [field]: values };
    if (fits(fullCandidate)) {
      Object.assign(compactContext, { [field]: values });
      continue;
    }

    for (let itemCount = values.length - 1; itemCount > 0; itemCount -= 1) {
      const partialCandidate = { ...compactContext, [field]: values.slice(0, itemCount) };
      if (fits(partialCandidate)) {
        Object.assign(compactContext, { [field]: values.slice(0, itemCount) });
        break;
      }
    }
  }

  return compactContext;
}

type RuntimeReactWebContextPackingSummary = NonNullable<NonNullable<CodexRuntimeHookDecision["debug"]>["reactWebContextPacking"]>;

function summarizeRuntimeReactWebContextPacking(
  reactWebContext: PackedRuntimeReactWebContext | undefined,
): RuntimeReactWebContextPackingSummary {
  if (!reactWebContext) {
    return {
      included: false,
      reason: "not-emitted",
      fields: [],
      totalAnchors: 0,
      priority: [...RUNTIME_REACT_WEB_CONTEXT_PACKING_PRIORITY],
    };
  }

  const fields = RUNTIME_REACT_WEB_CONTEXT_PACKING_PRIORITY.flatMap((field) => {
    const values = reactWebContext[field];
    return Array.isArray(values) && values.length > 0 ? [{ name: field, count: values.length }] : [];
  });

  return {
    included: true,
    reason: "packed",
    fields,
    totalAnchors: fields.reduce((total, field) => total + field.count, 0),
    priority: [...RUNTIME_REACT_WEB_CONTEXT_PACKING_PRIORITY],
  };
}

function buildAdditionalContext(
  filePath: string,
  payload: ModelFacingPayload,
  contextMode: ContextMode,
  maxOptimizedContextBytes?: number,
): { additionalContext: string; reactWebContextPacking?: RuntimeReactWebContextPackingSummary } {
  if (payload.domainPayload?.domain === "react-web" && !payload.useOriginal) {
    const runtimeReactWebContextBudget = payload.editGuidance
      ? editGuidanceBudgetLimit(maxOptimizedContextBytes)
      : maxOptimizedContextBytes;
    const reactWebContext = compactRuntimeReactWebContext(filePath, payload, contextMode, runtimeReactWebContextBudget);
    return {
      additionalContext: renderOptimizedReactWebAdditionalContext(filePath, payload, contextMode, reactWebContext),
      reactWebContextPacking: summarizeRuntimeReactWebContextPacking(reactWebContext),
    };
  }

  return {
    additionalContext: renderAdditionalContext(filePath, payload.mode, contextMode, buildRuntimeContextPayload(payload)),
  };
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
    appliedRuleIds: decision.projectKnowledge?.appliedRuleIds,
    family: decision.projectKnowledge?.family,
    matchReasons: decision.projectKnowledge?.matchReasons,
    evidencePaths: decision.projectKnowledge?.evidencePaths,
    authority: decision.projectKnowledge?.authority,
    rulesPath: decision.projectKnowledge?.rulesPath,
    mode: decision.projectKnowledge?.mode,
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

  const resolvedTargetPath = path.join(cwd, target);
  if (!fs.existsSync(resolvedTargetPath)) {
    const runtimeDecision: CodexRuntimeHookDecision = {
      runtime: "codex",
      hookEventName,
      action: "noop",
      filePath: target,
      reasons: ["eligible-file-target-missing"],
      contextMode: "no-op",
      contextModeReason: "eligible-file-target-missing",
      contextBudget: { ...policy.contextBudget, selectedFiles: 0, totalBytes: 0, skippedFiles: policy.contextBudget.selectedFiles },
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
      const optInDecision = decidePreRead(path.join(cwd, target), cwd, "codex", {
        includeEditGuidance: true,
        includeReactWebContextMetadata: true,
      });
      if (optInDecision.decision === "payload" && optInDecision.payload && hasMatchingEditGuidance(optInDecision.payload)) {
        const optInContextMode = payloadContextMode(optInDecision.payload);
        const optInAdditionalContext = buildAdditionalContext(target, optInDecision.payload, optInContextMode, originalEstimatedBytes);
        const estimatedContextBytes = estimateTextBytes(optInAdditionalContext.additionalContext);
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
    const runtimeContext = buildAdditionalContext(target, decision.payload, contextMode, originalEstimatedBytes);
    const projectKnowledge = resolveProjectKnowledgeContext(prompt, [target], cwd);
    const additionalContext = appendProjectKnowledgeBlock(runtimeContext.additionalContext, projectKnowledge?.block);
    const { reactWebContextPacking } = runtimeContext;
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
      contextModeReason: payloadContextModeReason("repeated", contextMode, decision.payload, editGuidanceIncluded),
      contextBudget: policy.contextBudget,
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      ...(projectKnowledge ? { projectKnowledge: projectKnowledge.metadata } : {}),
      debug: {
        repeatedFile: true,
        eligible: true,
        escapeHatchUsed: false,
        decision,
        ...(reactWebContextPacking ? { reactWebContextPacking } : {}),
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
