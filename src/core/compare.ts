import { extractFile } from "./extract";
import { toModelFacingPayload } from "./payload/model-facing";
import {
  FOOKS_METRIC_CLAIM_BOUNDARY,
  FOOKS_SESSION_METRIC_TIER,
  estimateTextBytes,
  estimateTokensFromBytes,
} from "./session-metrics";
import type { OutputMode } from "./schema";
import {
  formatReactWebContextSummary,
  reactWebContextSummaryFor,
  type ReactWebContextSummary,
} from "./react-web-context-summary";

export const FOOKS_COMPARE_CLAIM_BOUNDARY = `${FOOKS_METRIC_CLAIM_BOUNDARY} Compare values are local model-facing payload estimates, not provider tokenizer output, not runtime hook envelope overhead, and not provider invoice/dashboard/charged-cost proof.`;

export type FooksCompareUserSummary = {
  verdict: "estimated-reduction" | "no-estimated-reduction";
  headline: string;
  nextAction: string;
};

export type FooksCompareReactWebContextSummary = ReactWebContextSummary;

export type FooksCompareResult = {
  filePath: string;
  mode: OutputMode;
  useOriginal: boolean;
  userSummary: FooksCompareUserSummary;
  sourceBytes: number;
  modelFacingBytes: number;
  estimatedSourceTokens: number;
  estimatedModelFacingTokens: number;
  savedEstimatedBytes: number;
  savedEstimatedTokens: number;
  reductionPercent: number;
  payloadLarger: boolean;
  nonSavingReason?: "original-source-preserved-for-small-raw-file" | "model-facing-payload-not-smaller";
  reactWebContextSummary?: FooksCompareReactWebContextSummary;
  metricTier: typeof FOOKS_SESSION_METRIC_TIER;
  measurement: "local-model-facing-payload";
  excludes: string[];
  claimBoundary: string;
};


function roundPercent(value: number): number {
  return Number(value.toFixed(2));
}

function nonSavingReason(useOriginal: boolean, payloadLarger: boolean): FooksCompareResult["nonSavingReason"] {
  if (useOriginal) return "original-source-preserved-for-small-raw-file";
  if (payloadLarger) return "model-facing-payload-not-smaller";
  return undefined;
}

function userSummaryFor(options: {
  mode: OutputMode;
  savedEstimatedTokens: number;
  reductionPercent: number;
  useOriginal: boolean;
  payloadLarger: boolean;
}): FooksCompareUserSummary {
  if (options.savedEstimatedTokens > 0 && !options.useOriginal && !options.payloadLarger) {
    return {
      verdict: "estimated-reduction",
      headline: `Estimated ${options.reductionPercent}% smaller model-facing payload (${options.savedEstimatedTokens} fewer local estimated tokens).`,
      nextAction: "Use fooks setup for repeated same-file Codex work, or inspect --json for exact local payload evidence.",
    };
  }

  if (options.useOriginal) {
    return {
      verdict: "no-estimated-reduction",
      headline: "No compact payload used: fooks preserved the original source for this small/raw file.",
      nextAction: "Try compare on a larger supported React .tsx/.jsx component, or use extract --model-payload for manual handoff.",
    };
  }

  return {
    verdict: "no-estimated-reduction",
    headline: `No estimated reduction for ${options.mode} output: the model-facing payload is not smaller than the source.`,
    nextAction: "Treat this as a fallback/no-savings case; inspect --json before using it as evidence.",
  };
}

export function formatCompare(result: FooksCompareResult): string {
  const proofLine = result.userSummary.verdict === "estimated-reduction"
    ? `Local proof: source ${result.sourceBytes} bytes / ${result.estimatedSourceTokens} est tokens → model-facing ${result.modelFacingBytes} bytes / ${result.estimatedModelFacingTokens} est tokens; saved ${result.savedEstimatedBytes} bytes / ${result.savedEstimatedTokens} est tokens.`
    : `Local proof: source ${result.sourceBytes} bytes / ${result.estimatedSourceTokens} est tokens → model-facing ${result.modelFacingBytes} bytes / ${result.estimatedModelFacingTokens} est tokens; no local estimate savings for this file.`;
  const reactWebContextLine = result.reactWebContextSummary
    ? formatReactWebContextSummary(result.reactWebContextSummary)
    : undefined;
  const lines = [
    `fooks compare ${result.filePath}`,
    "",
    `Verdict: ${result.userSummary.verdict}`,
    `Why: ${result.userSummary.headline}`,
    `Mode: ${result.mode}${result.useOriginal ? " (original source preserved)" : ""}`,
    proofLine,
    ...(reactWebContextLine ? [reactWebContextLine] : []),
    `Next action: ${result.userSummary.nextAction}`,
    "",
    "Boundary: Local model-facing payload estimate only; not provider tokenizer output, billing tokens, invoices, dashboards, or charged costs.",
    "Details: Run `fooks compare <file> --json` for exact byte counts, exclusions, and claim boundary text.",
  ];
  return `${lines.join("\n")}\n`;
}

export function compareModelFacingPayload(filePath: string, cwd = process.cwd()): FooksCompareResult {
  const extracted = extractFile(filePath);
  const payload = toModelFacingPayload(extracted, cwd);
  const useOriginal = extracted.useOriginal === true;
  const contextPayload = toModelFacingPayload(extracted, cwd, {
    includeDomainPayload: true,
    includeReactWebContextMetadata: true,
  });
  const reactWebContextSummary = reactWebContextSummaryFor(contextPayload, useOriginal);
  const sourceBytes = extracted.meta.rawSizeBytes;
  const modelFacingBytes = estimateTextBytes(JSON.stringify(payload));
  const estimatedSourceTokens = estimateTokensFromBytes(sourceBytes);
  const estimatedModelFacingTokens = estimateTokensFromBytes(modelFacingBytes);
  const savedEstimatedBytes = Math.max(0, sourceBytes - modelFacingBytes);
  const savedEstimatedTokens = Math.max(0, estimatedSourceTokens - estimatedModelFacingTokens);
  const reductionPercent = sourceBytes === 0 ? 0 : roundPercent((savedEstimatedBytes / sourceBytes) * 100);
  const payloadLarger = modelFacingBytes >= sourceBytes;

  return {
    filePath: payload.filePath,
    mode: extracted.mode,
    useOriginal,
    userSummary: userSummaryFor({ mode: extracted.mode, savedEstimatedTokens, reductionPercent, useOriginal, payloadLarger }),
    sourceBytes,
    modelFacingBytes,
    estimatedSourceTokens,
    estimatedModelFacingTokens,
    savedEstimatedBytes,
    savedEstimatedTokens,
    reductionPercent,
    payloadLarger,
    ...(payloadLarger || useOriginal ? { nonSavingReason: nonSavingReason(useOriginal, payloadLarger) } : {}),
    ...(reactWebContextSummary ? { reactWebContextSummary } : {}),
    metricTier: FOOKS_SESSION_METRIC_TIER,
    measurement: "local-model-facing-payload",
    excludes: [
      "provider-tokenizer-behavior",
      "runtime-hook-envelope-overhead",
      "optional-edit-guidance-overhead",
      "provider-billing-tokens",
      "provider-costs",
    ],
    claimBoundary: FOOKS_COMPARE_CLAIM_BOUNDARY,
  };
}
