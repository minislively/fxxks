import { extractFile } from "./extract";
import { toModelFacingPayload } from "./payload/model-facing";
import {
  FOOKS_METRIC_CLAIM_BOUNDARY,
  FOOKS_SESSION_METRIC_TIER,
  estimateTextBytes,
  estimateTokensFromBytes,
} from "./session-metrics";
import type { OutputMode } from "./schema";

export const FOOKS_COMPARE_CLAIM_BOUNDARY = `${FOOKS_METRIC_CLAIM_BOUNDARY} Compare values are local model-facing payload estimates, not provider tokenizer output, not runtime hook envelope overhead, and not provider costs.`;

export type FooksCompareResult = {
  filePath: string;
  mode: OutputMode;
  useOriginal: boolean;
  sourceBytes: number;
  modelFacingBytes: number;
  estimatedSourceTokens: number;
  estimatedModelFacingTokens: number;
  savedEstimatedBytes: number;
  savedEstimatedTokens: number;
  reductionPercent: number;
  payloadLarger: boolean;
  nonSavingReason?: "original-source-preserved-for-small-raw-file" | "model-facing-payload-not-smaller";
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

export function compareModelFacingPayload(filePath: string, cwd = process.cwd()): FooksCompareResult {
  const extracted = extractFile(filePath);
  const payload = toModelFacingPayload(extracted, cwd);
  const sourceBytes = extracted.meta.rawSizeBytes;
  const modelFacingBytes = estimateTextBytes(JSON.stringify(payload));
  const estimatedSourceTokens = estimateTokensFromBytes(sourceBytes);
  const estimatedModelFacingTokens = estimateTokensFromBytes(modelFacingBytes);
  const savedEstimatedBytes = Math.max(0, sourceBytes - modelFacingBytes);
  const savedEstimatedTokens = Math.max(0, estimatedSourceTokens - estimatedModelFacingTokens);
  const reductionPercent = sourceBytes === 0 ? 0 : roundPercent((savedEstimatedBytes / sourceBytes) * 100);
  const payloadLarger = modelFacingBytes >= sourceBytes;
  const useOriginal = extracted.useOriginal === true;

  return {
    filePath: payload.filePath,
    mode: extracted.mode,
    useOriginal,
    sourceBytes,
    modelFacingBytes,
    estimatedSourceTokens,
    estimatedModelFacingTokens,
    savedEstimatedBytes,
    savedEstimatedTokens,
    reductionPercent,
    payloadLarger,
    ...(payloadLarger || useOriginal ? { nonSavingReason: nonSavingReason(useOriginal, payloadLarger) } : {}),
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
