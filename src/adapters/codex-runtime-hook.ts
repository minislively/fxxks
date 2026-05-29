import fs from "node:fs";
import path from "node:path";
import { decidePreRead } from "./pre-read";
import { hasFullReadEscapeHatch, resolvePromptFileContext } from "./prompt-context";
import { discoverProjectFiles } from "../core/discover";
import { detectDomainFromSource } from "../core/domain-detector";
import { lookupDomainMemoryReceipts } from "../core/domain-memory-lookup";
import type { DomainMemoryLookupResult } from "../core/domain-memory-lookup";
import { unsupportedDomainMemoryVerifyResult, verifyDomainMemoryReceipt } from "../core/domain-memory-verify";
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
import { decidePreflightAdvisoryIntent } from "../ops/preflight-advisory-intent";
import type { PreflightAdvisoryDecision, PreflightAdvisoryRuntimeSignals } from "../ops/preflight-advisory-intent";
import {
  estimateFileBytes,
  estimateTextBytes,
  finalizeSessionMetricSummarySafe,
  initializeSessionMetricSummarySafe,
  recordFooksSessionMetricEventSafe,
} from "../core/session-metrics";
import { finalizeWorktreeEvidenceSafe, initializeWorktreeEvidenceSafe } from "../reporting/worktree-evidence";
import { emitReactWebEvidenceArtifact } from "../reporting/react-web-evidence-artifact";
import { buildReactWebActivationModeFromRuntimeDecision, summarizeReactWebActivationMode } from "../reporting/react-web-activation-mode";
import { buildReactWebFactGraphConsumerDryRun, type ReactWebFactGraphConsumerDryRun } from "../core/react-web-fact-graph-consumer";

const EDIT_INTENT_PATTERN = /\b(?:update|fix|change|add|remove|refactor|patch|modify|implement|rename|replace|adjust|simplify|rewrite)\b/i;
const FRONTEND_EXTENSIONS = new Set([".tsx", ".jsx"]);
const EDIT_GUIDANCE_CONTEXT_MAX_BYTES = 8_192;
const PREFLIGHT_ADVISORY_CONTEXT_MARKER = "FOOKS PREFLIGHT ADVISORY";
const DOMAIN_MEMORY_ADVISORY_CONTEXT_MARKER = "FOOKS DOMAIN MEMORY ADVISORY";
const PREFLIGHT_ISSUE_OR_PR_PATTERN = /(?:#\d+\b|\b(?:issue|issues|pr|pull\s+request)\s*#?\d+\b)/iu;
const PREFLIGHT_TEST_COMMAND_PATTERN = /(?:\bnpm\s+(?:run\s+)?test\b|\bnode\s+--test\b|\bpytest\b|\bvitest\b|\bjest\b|테스트)/iu;
const PREFLIGHT_STACK_OR_ERROR_PATTERN = /(?:\b(?:typeerror|referenceerror|syntaxerror|stack\s+trace|traceback|failed|failure|exception|error)\b|에러|오류|실패|스택|이상한데)/iu;

type RuntimeReactWebContext = NonNullable<ModelFacingPayload["reactWebContext"]>;
type RuntimeReactWebContextArrayKey = Exclude<{
  [Key in keyof RuntimeReactWebContext]: RuntimeReactWebContext[Key] extends unknown[] | undefined ? Key : never;
}[keyof RuntimeReactWebContext], undefined>;
type PackedRuntimeReactWebFactGraph = {
  schemaVersion: "react-web-fact-graph-runtime-context.v1";
  freshnessStatus: ReactWebFactGraphConsumerDryRun["graphSummary"]["freshnessStatus"];
  freshnessVerified: true;
  selectedAnchors: Array<{
    rank: number;
    type: string;
    kind: string;
    label: string;
    loc?: string;
  }>;
  deferredAnchorCount: number;
  boundary: "advisory-current-source-only";
};

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
  "formStateRoles",
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
  promptSpecificity: ReturnType<typeof resolvePromptFileContext>["policy"]["promptSpecificity"],
): string {
  if (editGuidanceIncluded) return `${phase}-exact-file-edit-guidance`;
  if (contextMode === "light-minimal") {
    return promptSpecificity === "file-hinted" ? `${phase}-file-hinted-tiny-raw-original` : `${phase}-exact-file-tiny-raw-original`;
  }
  const targetPrefix = promptSpecificity === "file-hinted" ? "file-hinted" : "exact-file";
  return payload.domainPayload?.domain === "react-web"
    ? `${phase}-${targetPrefix}-react-web-payload`
    : `${phase}-${targetPrefix}-narrow-payload`;
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

function optimizedReactWebRuntimePayload(
  payload: ModelFacingPayload,
  reactWebContext?: PackedRuntimeReactWebContext,
  reactWebFactGraph?: PackedRuntimeReactWebFactGraph,
): unknown {
  return {
    filePath: payload.filePath,
    sourceFingerprint: payload.sourceFingerprint,
    domainPayload: payload.domainPayload,
    ...(payload.editGuidance ? { editGuidance: payload.editGuidance } : {}),
    ...(reactWebContext ? { reactWebContext } : {}),
    ...(reactWebFactGraph ? { reactWebFactGraph } : {}),
  };
}

function buildRuntimeContextPayload(
  payload: ModelFacingPayload,
  reactWebContext?: PackedRuntimeReactWebContext,
  reactWebFactGraph?: PackedRuntimeReactWebFactGraph,
): { optimized: boolean; payload: unknown } {
  if (payload.domainPayload?.domain === "react-web" && !payload.useOriginal) {
    return {
      optimized: true,
      payload: optimizedReactWebRuntimePayload(payload, reactWebContext, reactWebFactGraph),
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
  reactWebFactGraph?: PackedRuntimeReactWebFactGraph,
): string {
  return renderAdditionalContext(filePath, payload.mode, contextMode, buildRuntimeContextPayload(payload, reactWebContext, reactWebFactGraph));
}

function compactRuntimeReactWebContext(
  filePath: string,
  payload: ModelFacingPayload,
  contextMode: ContextMode,
  maxOptimizedContextBytes?: number,
  reactWebFactGraph?: PackedRuntimeReactWebFactGraph,
): PackedRuntimeReactWebContext | undefined {
  if (!payload.reactWebContext) return undefined;

  const fits = (reactWebContext?: PackedRuntimeReactWebContext): boolean => {
    if (maxOptimizedContextBytes === undefined) return true;
    const additionalContext = renderOptimizedReactWebAdditionalContext(filePath, payload, contextMode, reactWebContext, reactWebFactGraph);
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
type RuntimeReactWebFactGraphPackingSummary = NonNullable<NonNullable<CodexRuntimeHookDecision["debug"]>["reactWebFactGraphPacking"]>;
type RuntimeReactWebFactGraphPackingReason = RuntimeReactWebFactGraphPackingSummary["reason"];
type CodexRuntimeDebug = NonNullable<CodexRuntimeHookDecision["debug"]>;
type PreflightAdvisoryDebugReceipt = NonNullable<CodexRuntimeDebug["preflightAdvisoryIntent"]>;
type DomainMemoryAdvisoryDebugReceipt = NonNullable<CodexRuntimeDebug["domainMemoryAdvisory"]>;
type DomainMemoryLookupDebugReceipt = NonNullable<CodexRuntimeDebug["domainMemoryLookup"]>;

function unquotePromptPath(value: string): string {
  return value.replace(/^["'`]+|["'`,.;:)]+$/gu, "");
}

function resolveDomainMemoryReceiptHint(prompt: string, cwd: string): { receiptPath?: string; reasons: string[] } {
  const match =
    /(?:--receipt|domain-memory\s+receipt|domain\s+memory\s+receipt)\s+(?<path>["'`]?[^\s"'`]+\.json["'`]?)/iu.exec(prompt);
  const rawPath = match?.groups?.path;
  if (!rawPath) return { reasons: [] };

  const receiptPath = path.resolve(cwd, unquotePromptPath(rawPath));
  const relative = path.relative(cwd, receiptPath) || path.basename(receiptPath);
  if (!fs.existsSync(receiptPath) || !fs.statSync(receiptPath).isFile()) {
    return {
      receiptPath,
      reasons: [`domain-memory receipt hint not readable: ${relative}`],
    };
  }
  return { receiptPath, reasons: [] };
}

function verifyDomainMemoryAdvisory(
  prompt: string,
  target: string,
  cwd: string,
): { requested: boolean; result?: ReturnType<typeof verifyDomainMemoryReceipt>; debug: DomainMemoryAdvisoryDebugReceipt } {
  const hint = resolveDomainMemoryReceiptHint(prompt, cwd);
  if (!hint.receiptPath && hint.reasons.length === 0) {
    return { requested: false, debug: { requested: false, reasons: [] } };
  }

  const filePath = path.join(cwd, target);
  const receiptPath = hint.receiptPath ?? path.join(cwd, "__missing-domain-memory-receipt__.json");
  const sourceText = fs.readFileSync(filePath, "utf8");
  let receipt: unknown;
  let result: ReturnType<typeof verifyDomainMemoryReceipt>;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    result = verifyDomainMemoryReceipt({
      receipt,
      receiptPath,
      filePath,
      cwd,
      sourceText,
      domainDetection: detectDomainFromSource(sourceText, filePath),
    });
  } catch (error) {
    result = unsupportedDomainMemoryVerifyResult({
      filePath,
      receiptPath,
      cwd,
      reason: hint.reasons[0] ?? `domain-memory receipt could not be verified: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return {
    requested: true,
    result,
    debug: {
      requested: true,
      receiptPath: result.receiptPath,
      status: result.status,
      safeNextAction: result.safeNextAction,
      reasons: result.reasons,
    },
  };
}

function renderDomainMemoryAdvisoryContext(result: ReturnType<typeof verifyDomainMemoryReceipt>): string {
  return [
    DOMAIN_MEMORY_ADVISORY_CONTEXT_MARKER,
    `- Source: explicit prompt-provided receipt ${result.receiptPath}; verified against ${result.filePath}.`,
    `- Status: ${result.status}; safe next action: ${result.safeNextAction}.`,
    `- Reasons: ${result.reasons.join(", ")}.`,
    `- Non-claims: ${result.nonClaims.join("; ")}.`,
    "- Boundary: advisory-only report evidence; does not authorize runtime reuse, pre-read reuse, cache reuse, model-facing payload reuse, setup readiness, support expansion, or provider token/cost/billing/runtime savings claims.",
  ].join("\n");
}

function modelTextValue(value: string | undefined): string {
  return JSON.stringify(value ?? "");
}

function renderAutomaticDomainMemoryAdvisoryContext(result: DomainMemoryLookupResult): string {
  return [
    DOMAIN_MEMORY_ADVISORY_CONTEXT_MARKER,
    `- Source: automatic project-local lookup ${modelTextValue(result.advisoryReceiptPath)}; verified against ${modelTextValue(result.filePath)}.`,
    `- Authorization: ${result.authorization}; advisoryOnly: ${result.advisoryOnly}.`,
    `- Status: ${result.status}; safe next action: ${result.safeNextAction}.`,
    `- Reasons: ${result.reasons.join(", ")}.`,
    `- Non-claims: ${result.nonClaims.join("; ")}.`,
    "- Boundary: advisory-only report evidence; does not authorize runtime reuse, pre-read reuse, cache reuse, model-facing payload reuse, setup readiness, support expansion, or provider token/cost/billing/runtime savings claims.",
  ].join("\n");
}

function domainMemoryLookupDebugReceipt(result: DomainMemoryLookupResult): DomainMemoryLookupDebugReceipt {
  return {
    source: "automatic project-local lookup",
    status: result.status,
    authorization: result.authorization,
    advisoryOnly: result.advisoryOnly,
    candidateCount: result.candidateCount,
    freshCandidateCount: result.freshCandidateCount,
    ...(result.advisoryReceiptPath ? { advisoryReceiptPath: result.advisoryReceiptPath } : {}),
    safeNextAction: result.safeNextAction,
    reasons: result.reasons,
  };
}

function unsupportedAutomaticDomainMemoryLookupDebug(reason: string): DomainMemoryLookupDebugReceipt {
  return {
    source: "automatic project-local lookup",
    status: "unsupported",
    authorization: "none",
    advisoryOnly: true,
    candidateCount: 0,
    freshCandidateCount: 0,
    safeNextAction: "full-read",
    reasons: [reason],
  };
}

function attachDomainMemoryAdvisoryDebug(
  runtimeDecision: CodexRuntimeHookDecision,
  receipt: DomainMemoryAdvisoryDebugReceipt,
): CodexRuntimeHookDecision {
  const debug = runtimeDecision.debug ?? {
    repeatedFile: false,
    eligible: false,
    escapeHatchUsed: false,
  };
  runtimeDecision.debug = {
    ...debug,
    domainMemoryAdvisory: receipt,
  };
  return runtimeDecision;
}

function attachDomainMemoryLookupDebug(
  runtimeDecision: CodexRuntimeHookDecision,
  receipt: DomainMemoryLookupDebugReceipt,
): CodexRuntimeHookDecision {
  const debug = runtimeDecision.debug ?? {
    repeatedFile: false,
    eligible: false,
    escapeHatchUsed: false,
  };
  runtimeDecision.debug = {
    ...debug,
    domainMemoryLookup: receipt,
  };
  return runtimeDecision;
}

function preflightAdvisoryDebugReceipt(decision: PreflightAdvisoryDecision): PreflightAdvisoryDebugReceipt {
  return {
    shouldAttach: decision.shouldAttach,
    confidence: decision.confidence,
    category: decision.category,
    score: decision.score,
    reasons: [...decision.reasons],
    skipReasons: [...decision.skipReasons],
  };
}

function buildPreflightAdvisoryRuntimeSignals(
  prompt: string,
  target: string | undefined,
): PreflightAdvisoryRuntimeSignals {
  return {
    hasFilePath: Boolean(target),
    hasRepoAnchor: Boolean(target),
    hasIssueOrPrReference: PREFLIGHT_ISSUE_OR_PR_PATTERN.test(prompt),
    hasTestCommand: PREFLIGHT_TEST_COMMAND_PATTERN.test(prompt),
    hasStackTraceOrError: PREFLIGHT_STACK_OR_ERROR_PATTERN.test(prompt),
  };
}

function renderPreflightAdvisoryContext(decision: PreflightAdvisoryDecision): string | undefined {
  if (!decision.shouldAttach) return undefined;

  return [
    PREFLIGHT_ADVISORY_CONTEXT_MARKER,
    "- Source: local preflight advisory intent scorer; no new evidence collection was performed.",
    `- Intent: ${decision.category} (confidence: ${decision.confidence}, score: ${decision.score}).`,
    `- Reasons: ${decision.reasons.length > 0 ? decision.reasons.join(", ") : "none"}.`,
    "- Boundary: advisory-only; does not block, create authority, run cleanup, run commands, or change provider/tool behavior.",
    "- Reminder: stale/local-only residue is cleanup-review context, not current-work authority unless separately evidenced.",
  ].join("\n");
}

function preflightAdvisoryReasons(advisory: string | undefined): string[] {
  return advisory ? ["preflight-advisory-attached"] : [];
}

function attachPreflightAdvisoryDebug(
  runtimeDecision: CodexRuntimeHookDecision,
  decision: PreflightAdvisoryDecision,
): CodexRuntimeHookDecision {
  const debug = runtimeDecision.debug ?? {
    repeatedFile: false,
    eligible: false,
    escapeHatchUsed: false,
  };
  runtimeDecision.debug = {
    ...debug,
    preflightAdvisoryIntent: preflightAdvisoryDebugReceipt(decision),
  };
  return runtimeDecision;
}

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

export function runtimeReactWebFactGraphPackingSummary(
  reason: RuntimeReactWebFactGraphPackingReason,
  reactWebFactGraph?: PackedRuntimeReactWebFactGraph,
  dryRun?: ReactWebFactGraphConsumerDryRun,
): RuntimeReactWebFactGraphPackingSummary {
  return {
    included: reason === "fresh-anchors-packed",
    reason,
    selectedAnchorCount: reactWebFactGraph?.selectedAnchors.length ?? dryRun?.selectedAnchors.length ?? 0,
    deferredAnchorCount: reactWebFactGraph?.deferredAnchorCount ?? dryRun?.deferredAnchors.length ?? 0,
    freshnessStatus: reactWebFactGraph?.freshnessStatus ?? dryRun?.graphSummary.freshnessStatus ?? "unknown",
  };
}

export function summarizeRuntimeReactWebFactGraphDryRun(
  dryRun: ReactWebFactGraphConsumerDryRun,
  options: { budgetExceeded?: boolean } = {},
): RuntimeReactWebFactGraphPackingSummary {
  if (!dryRun.inScope) {
    return runtimeReactWebFactGraphPackingSummary("out-of-scope", undefined, dryRun);
  }
  if (dryRun.graphSummary.freshnessStatus !== "fresh") {
    return runtimeReactWebFactGraphPackingSummary("freshness-not-fresh", undefined, dryRun);
  }
  if (dryRun.selectedAnchors.length === 0) {
    return runtimeReactWebFactGraphPackingSummary("no-anchors-selected", undefined, dryRun);
  }
  if (options.budgetExceeded) {
    return runtimeReactWebFactGraphPackingSummary("budget-exceeded", undefined, dryRun);
  }
  return runtimeReactWebFactGraphPackingSummary("fresh-anchors-packed", undefined, dryRun);
}

function compactRuntimeReactWebFactGraph(filePath: string, cwd: string): {
  graph?: PackedRuntimeReactWebFactGraph;
  packing: RuntimeReactWebFactGraphPackingSummary;
} {
  const dryRun = buildReactWebFactGraphConsumerDryRun(path.join(cwd, filePath), cwd, {
    verifyFreshness: true,
    maxAnchors: 3,
  });
  const basePacking = summarizeRuntimeReactWebFactGraphDryRun(dryRun);
  if (basePacking.reason !== "fresh-anchors-packed") {
    return { packing: basePacking };
  }
  const graph: PackedRuntimeReactWebFactGraph = {
    schemaVersion: "react-web-fact-graph-runtime-context.v1",
    freshnessStatus: dryRun.graphSummary.freshnessStatus,
    freshnessVerified: true,
    selectedAnchors: dryRun.selectedAnchors.map((anchor) => {
      const loc = anchor.sourceRefs[0]?.loc;
      return {
        rank: anchor.rank,
        type: anchor.anchorType,
        kind: anchor.kind,
        label: anchor.label,
        ...(loc ? { loc: `${loc.startLine}-${loc.endLine}` } : {}),
      };
    }),
    deferredAnchorCount: dryRun.deferredAnchors.length,
    boundary: "advisory-current-source-only",
  };
  return { graph, packing: runtimeReactWebFactGraphPackingSummary("fresh-anchors-packed", graph, dryRun) };
}

function runtimeReactWebFactGraphOutOfScopePacking(): RuntimeReactWebFactGraphPackingSummary {
  return runtimeReactWebFactGraphPackingSummary("out-of-scope");
}

function attachReactWebFactGraphPackingDebug(
  runtimeDecision: CodexRuntimeHookDecision,
  packing: RuntimeReactWebFactGraphPackingSummary | undefined,
): CodexRuntimeHookDecision {
  if (!packing) return runtimeDecision;
  const debug = runtimeDecision.debug ?? {
    repeatedFile: false,
    eligible: false,
    escapeHatchUsed: false,
  };
  runtimeDecision.debug = {
    ...debug,
    reactWebFactGraphPacking: packing,
  };
  return runtimeDecision;
}

function buildAdditionalContext(
  filePath: string,
  payload: ModelFacingPayload,
  contextMode: ContextMode,
  maxOptimizedContextBytes?: number,
  cwd = process.cwd(),
  includeReactWebFactGraph = true,
): { additionalContext: string; reactWebContextPacking?: RuntimeReactWebContextPackingSummary; reactWebFactGraphPacking?: RuntimeReactWebFactGraphPackingSummary } {
  if (payload.domainPayload?.domain === "react-web" && !payload.useOriginal) {
    const runtimeReactWebContextBudget = payload.editGuidance
      ? editGuidanceBudgetLimit(maxOptimizedContextBytes)
      : maxOptimizedContextBytes;
    const reactWebContext = compactRuntimeReactWebContext(filePath, payload, contextMode, runtimeReactWebContextBudget);
    let reactWebFactGraph: PackedRuntimeReactWebFactGraph | undefined;
    let reactWebFactGraphPacking: RuntimeReactWebFactGraphPackingSummary;
    if (!payload.editGuidance) {
      reactWebFactGraphPacking = runtimeReactWebFactGraphPackingSummary("no-edit-guidance");
    } else if (!includeReactWebFactGraph) {
      reactWebFactGraphPacking = runtimeReactWebFactGraphOutOfScopePacking();
    } else {
      const compacted = compactRuntimeReactWebFactGraph(filePath, cwd);
      reactWebFactGraph = compacted.graph;
      reactWebFactGraphPacking = compacted.packing;
    }
    if (reactWebFactGraph && runtimeReactWebContextBudget !== undefined) {
      const contextWithGraph = renderOptimizedReactWebAdditionalContext(filePath, payload, contextMode, reactWebContext, reactWebFactGraph);
      if (estimateTextBytes(contextWithGraph) > runtimeReactWebContextBudget) {
        reactWebFactGraphPacking = runtimeReactWebFactGraphPackingSummary("budget-exceeded", reactWebFactGraph);
        reactWebFactGraph = undefined;
      }
    }
    return {
      additionalContext: renderOptimizedReactWebAdditionalContext(filePath, payload, contextMode, reactWebContext, reactWebFactGraph),
      reactWebContextPacking: summarizeRuntimeReactWebContextPacking(reactWebContext),
      reactWebFactGraphPacking,
    };
  }

  return {
    additionalContext: renderAdditionalContext(filePath, payload.mode, contextMode, buildRuntimeContextPayload(payload)),
  };
}

function targetEstimatedBytes(cwd: string, filePath: string): number | undefined {
  return estimateFileBytes(path.join(cwd, filePath));
}

function resolveFileHintedGlobMatchContext(
  prompt: string,
  cwd: string,
): { filePath?: string; source: "prompt-target" | "none"; policy: ReturnType<typeof resolvePromptFileContext>["policy"] } {
  const promptContext = resolvePromptFileContext(prompt, cwd, "codex-ts-js-beta");
  const policy = promptContext.policy;
  const hintedTarget = policy.targets[0];

  if (promptContext.filePath && (!hintedTarget || hintedTarget.exists)) {
    return promptContext;
  }

  if (
    policy.promptSpecificity !== "exact-file" ||
    policy.targets.length !== 1 ||
    !hintedTarget ||
    hintedTarget.exists ||
    path.basename(hintedTarget.filePath) !== hintedTarget.filePath
  ) {
    return promptContext;
  }

  const matches = discoverProjectFiles(cwd)
    .filter((target) => target.kind === "component")
    .map((target) => target.filePath)
    .filter((filePath) => path.basename(filePath).toLowerCase() === hintedTarget.filePath.toLowerCase());

  if (matches.length !== 1) {
    return promptContext;
  }

  const matchedTarget = path.relative(cwd, matches[0]) || path.basename(matches[0]);
  return {
    filePath: matchedTarget,
    source: "prompt-target",
    policy: {
      ...policy,
      promptSpecificity: "file-hinted",
      selectionSource: "keyword-discovery",
      contextMode: "light",
      contextModeReason: "file-hinted-glob-match-target",
      contextBudget: {
        maxFiles: 1,
        selectedFiles: 1,
        totalBytes: targetEstimatedBytes(cwd, matchedTarget) ?? 0,
        skippedFiles: 0,
      },
    },
  };
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

function attachReactWebEvidenceArtifact(
  cwd: string,
  runtimeDecision: CodexRuntimeHookDecision,
): CodexRuntimeHookDecision {
  const debug = runtimeDecision.debug ?? {
    repeatedFile: false,
    eligible: false,
    escapeHatchUsed: false,
  };
  try {
    const artifact = emitReactWebEvidenceArtifact(cwd, runtimeDecision);
    if (artifact) {
      runtimeDecision.debug = {
        ...debug,
        reactWebEvidenceArtifact: artifact,
      };
    }
  } catch (error) {
    runtimeDecision.debug = {
      ...debug,
      reactWebEvidenceArtifact: {
        emitted: false,
        reason: error instanceof Error ? error.message : String(error),
      },
    };
  }
  return runtimeDecision;
}

function attachReactWebActivationDebug(
  runtimeDecision: CodexRuntimeHookDecision,
  options: { promoted: boolean },
  cwd: string,
): CodexRuntimeHookDecision {
  const activationMode = buildReactWebActivationModeFromRuntimeDecision(cwd, runtimeDecision);
  const debug = runtimeDecision.debug ?? {
    repeatedFile: false,
    eligible: false,
    escapeHatchUsed: false,
  };
  runtimeDecision.debug = {
    ...debug,
    reactWebActivationMode: {
      ...summarizeReactWebActivationMode(activationMode),
      promoted: options.promoted,
    },
  };
  return runtimeDecision;
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
  const promptContext = resolveFileHintedGlobMatchContext(prompt, cwd);
  const target = promptContext.filePath;
  const policy = promptContext.policy;
  const escapeHatchUsed = hasFullReadEscapeHatch(prompt);
  const preflightAdvisoryIntent = decidePreflightAdvisoryIntent({
    prompt,
    runtime: buildPreflightAdvisoryRuntimeSignals(prompt, target),
  });
  const preflightAdvisoryContext = renderPreflightAdvisoryContext(preflightAdvisoryIntent);

  if (!target) {
    const runtimeDecision: CodexRuntimeHookDecision = {
      runtime: "codex",
      hookEventName,
      action: "noop",
      reasons: ["no-eligible-file-in-prompt", ...preflightAdvisoryReasons(preflightAdvisoryContext)],
      additionalContext: preflightAdvisoryContext,
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
    attachPreflightAdvisoryDebug(runtimeDecision, preflightAdvisoryIntent);
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
    attachPreflightAdvisoryDebug(runtimeDecision, preflightAdvisoryIntent);
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
    attachReactWebFactGraphPackingDebug(runtimeDecision, runtimeReactWebFactGraphOutOfScopePacking());
    attachPreflightAdvisoryDebug(runtimeDecision, preflightAdvisoryIntent);
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
      reasons: ["first-seen-file", "context-mode:no-op", ...preflightAdvisoryReasons(preflightAdvisoryContext)],
      statePath,
      additionalContext: preflightAdvisoryContext,
      contextMode: "no-op",
      contextModeReason: policy.promptSpecificity === "file-hinted" ? "first-turn-file-hinted-record-only" : "first-turn-exact-file-record-only",
      contextBudget: { ...policy.contextBudget, selectedFiles: 0, totalBytes: 0, skippedFiles: policy.contextBudget.selectedFiles },
      promptSpecificity: policy.promptSpecificity,
      contextPolicyVersion: policy.contextPolicyVersion,
      debug: {
        repeatedFile: false,
        eligible: true,
        escapeHatchUsed: false,
      },
    };
    attachPreflightAdvisoryDebug(runtimeDecision, preflightAdvisoryIntent);
    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
      observedOriginalEstimatedBytes: originalEstimatedBytes,
      ...(preflightAdvisoryContext
        ? {
            actualEstimatedBytes: estimateTextBytes(preflightAdvisoryContext),
            comparableForSavings: false,
          }
        : {}),
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
    attachPreflightAdvisoryDebug(runtimeDecision, preflightAdvisoryIntent);
    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: originalEstimatedBytes,
      comparableForSavings: originalEstimatedBytes !== undefined,
    });
    return runtimeDecision;
  }

  const originalEstimatedBytes = targetEstimatedBytes(cwd, target);
  const domainMemoryAdvisory = verifyDomainMemoryAdvisory(prompt, target, cwd);
  if (domainMemoryAdvisory.requested && domainMemoryAdvisory.result?.status !== "fresh") {
    markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    const runtimeDecision = fallbackDecision(
      hookEventName,
      target,
      statePath,
      [
        "repeated-file",
        "domain-memory-receipt-not-fresh",
        ...(domainMemoryAdvisory.result ? [`domain-memory-receipt:${domainMemoryAdvisory.result.status}`] : []),
      ],
      true,
      true,
      false,
      "domain-memory-receipt-not-fresh",
      policy,
      decision,
    );
    attachPreflightAdvisoryDebug(runtimeDecision, preflightAdvisoryIntent);
    attachDomainMemoryAdvisoryDebug(runtimeDecision, domainMemoryAdvisory.debug);
    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: originalEstimatedBytes,
      comparableForSavings: originalEstimatedBytes !== undefined,
    });
    return attachReactWebEvidenceArtifact(cwd, runtimeDecision);
  }

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
        const optInAdditionalContext = buildAdditionalContext(target, optInDecision.payload, optInContextMode, originalEstimatedBytes, cwd, false);
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
    const runtimeContext = buildAdditionalContext(target, decision.payload, contextMode, originalEstimatedBytes, cwd);
    const projectKnowledge = resolveProjectKnowledgeContext(prompt, [target], cwd);
    let domainMemoryLookupDebug: DomainMemoryLookupDebugReceipt | undefined;
    let automaticAdvisoryContext: string | undefined;
    let automaticDomainMemoryReason: string | undefined;
    if (!domainMemoryAdvisory.requested) {
      try {
        const lookupResult = lookupDomainMemoryReceipts(path.join(cwd, target), cwd);
        domainMemoryLookupDebug = domainMemoryLookupDebugReceipt(lookupResult);
        if (lookupResult.status === "fresh") {
          automaticAdvisoryContext = renderAutomaticDomainMemoryAdvisoryContext(lookupResult);
          automaticDomainMemoryReason = "domain-memory-automatic-advisory:fresh";
        }
      } catch (error) {
        domainMemoryLookupDebug = unsupportedAutomaticDomainMemoryLookupDebug(
          `domain-memory automatic lookup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const advisoryContext = domainMemoryAdvisory.result?.status === "fresh"
      ? renderDomainMemoryAdvisoryContext(domainMemoryAdvisory.result)
      : automaticAdvisoryContext;
    const additionalContext = appendProjectKnowledgeBlock(
      [runtimeContext.additionalContext, advisoryContext].filter(Boolean).join("\n\n"),
      projectKnowledge?.block,
    );
    const { reactWebContextPacking, reactWebFactGraphPacking } = runtimeContext;
    markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    const editGuidanceIncluded = hasMatchingEditGuidance(decision.payload);
    const runtimeDecision: CodexRuntimeHookDecision = {
      runtime: "codex",
      hookEventName,
      action: "inject",
      filePath: target,
      reasons: [
        "repeated-file",
        ...(policy.promptSpecificity === "file-hinted" ? ["glob-match-runtime-target"] : []),
        ...(freshness.refreshed ? ["refreshed-before-attach"] : []),
        ...(editGuidanceIncluded ? ["edit-guidance-opt-in"] : []),
        ...(automaticDomainMemoryReason ? [automaticDomainMemoryReason] : []),
      ],
      statePath,
      additionalContext,
      contextMode,
      contextModeReason: payloadContextModeReason("repeated", contextMode, decision.payload, editGuidanceIncluded, policy.promptSpecificity),
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
        ...(reactWebFactGraphPacking ? { reactWebFactGraphPacking } : {}),
      },
    };
    attachPreflightAdvisoryDebug(runtimeDecision, preflightAdvisoryIntent);
    if (domainMemoryAdvisory.requested) {
      attachDomainMemoryAdvisoryDebug(runtimeDecision, domainMemoryAdvisory.debug);
    } else if (domainMemoryLookupDebug) {
      attachDomainMemoryLookupDebug(runtimeDecision, domainMemoryLookupDebug);
    }

    if (decision.payload.domainPayload?.domain === "react-web" && !decision.payload.useOriginal) {
      const activationMode = buildReactWebActivationModeFromRuntimeDecision(cwd, runtimeDecision);
      const promoted =
        activationMode?.profileGate.verdict === "would-activate" || activationMode?.globMatch.verdict === "would-activate";
      if (!activationMode || !promoted) {
        const activationFallbackBase = fallbackDecision(
          hookEventName,
          target,
          statePath,
          ["repeated-file", "activation-mode-not-promoted"],
          true,
          true,
          false,
          "activation-mode-not-promoted",
          policy,
          decision,
        );
        const activationFallback = attachReactWebActivationDebug(
          attachReactWebFactGraphPackingDebug(
            attachPreflightAdvisoryDebug(activationFallbackBase, preflightAdvisoryIntent),
            runtimeReactWebFactGraphOutOfScopePacking(),
          ),
          { promoted: false },
          cwd,
        );
        recordRuntimeDecisionMetric(cwd, sessionKey, activationFallback, {
          originalEstimatedBytes,
          actualEstimatedBytes: originalEstimatedBytes,
          comparableForSavings: originalEstimatedBytes !== undefined,
        });
        return attachReactWebEvidenceArtifact(cwd, activationFallback);
      }

      attachReactWebActivationDebug(runtimeDecision, { promoted: true }, cwd);
    }

    recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
      originalEstimatedBytes,
      actualEstimatedBytes: estimateTextBytes(additionalContext),
      comparableForSavings: editGuidanceIncluded ? false : originalEstimatedBytes !== undefined,
    });
    return attachReactWebEvidenceArtifact(cwd, runtimeDecision);
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
  attachReactWebFactGraphPackingDebug(runtimeDecision, runtimeReactWebFactGraphOutOfScopePacking());
  attachPreflightAdvisoryDebug(runtimeDecision, preflightAdvisoryIntent);
  if (domainMemoryAdvisory.requested) {
    attachDomainMemoryAdvisoryDebug(runtimeDecision, domainMemoryAdvisory.debug);
  }
  recordRuntimeDecisionMetric(cwd, sessionKey, runtimeDecision, {
    originalEstimatedBytes,
    actualEstimatedBytes: originalEstimatedBytes,
    comparableForSavings: originalEstimatedBytes !== undefined,
  });
  return attachReactWebEvidenceArtifact(cwd, runtimeDecision);
}
