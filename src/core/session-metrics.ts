import fs from "node:fs";
import path from "node:path";
import { sessionEventsPath, sessionSummaryPath, sessionsSummaryPath, sanitizeDataKey } from "./paths";
import type { CodexRuntimeHookInput, ContextMode } from "./schema";

export const FOOKS_SESSION_METRICS_SCHEMA_VERSION = 1;
export const FOOKS_SESSION_METRIC_TIER = "estimated" as const;
export const ESTIMATED_BYTES_PER_TOKEN = 4;
export const FOOKS_METRIC_CLAIM_BOUNDARY =
  "Estimated local context-size telemetry only; values are not provider billing tokens, provider costs, or a ccusage replacement.";

type MetricTier = typeof FOOKS_SESSION_METRIC_TIER;
type HookEventName = CodexRuntimeHookInput["hookEventName"];
export type FooksSessionMetricAction = "inject" | "fallback" | "record" | "noop";

export type FooksEstimatedUsage = {
  originalEstimatedBytes: number;
  actualEstimatedBytes: number;
  savedEstimatedBytes: number;
  originalEstimatedTokens: number;
  actualEstimatedTokens: number;
  savedEstimatedTokens: number;
  savingsRatio: number;
};

export type FooksSessionMetricEvent = {
  schemaVersion: typeof FOOKS_SESSION_METRICS_SCHEMA_VERSION;
  timestamp: string;
  runtime: "codex";
  sessionKey: string;
  hookEventName: HookEventName;
  action: FooksSessionMetricAction;
  filePath?: string;
  reasons: string[];
  contextMode?: ContextMode;
  contextModeReason?: string;
  fallbackReason?: string;
  metricTier: MetricTier;
  comparableForSavings: boolean;
  estimated: FooksEstimatedUsage;
  observedOpportunity?: {
    originalEstimatedBytes: number;
    originalEstimatedTokens: number;
  };
};

export type FooksSessionMetricSummary = {
  schemaVersion: typeof FOOKS_SESSION_METRICS_SCHEMA_VERSION;
  metricTier: MetricTier;
  sessionKey: string;
  sanitizedSessionKey: string;
  startedAt: string;
  updatedAt: string;
  stoppedAt?: string;
  eventCount: number;
  comparableEventCount: number;
  injectCount: number;
  fallbackCount: number;
  recordCount: number;
  noopCount: number;
  observedOpportunityCount: number;
  observedOriginalEstimatedBytes: number;
  observedOriginalEstimatedTokens: number;
  totals: FooksEstimatedUsage;
  claimBoundary: string;
};

export type FooksSessionMetricContribution = Pick<
  FooksSessionMetricSummary,
  | "sessionKey"
  | "sanitizedSessionKey"
  | "startedAt"
  | "updatedAt"
  | "stoppedAt"
  | "eventCount"
  | "comparableEventCount"
  | "injectCount"
  | "fallbackCount"
  | "recordCount"
  | "noopCount"
  | "observedOpportunityCount"
  | "observedOriginalEstimatedBytes"
  | "observedOriginalEstimatedTokens"
  | "totals"
>;

export type FooksProjectMetricSummaryFile = {
  schemaVersion: typeof FOOKS_SESSION_METRICS_SCHEMA_VERSION;
  metricTier: MetricTier;
  updatedAt: string;
  sessionCount: number;
  eventCount: number;
  comparableEventCount: number;
  injectCount: number;
  fallbackCount: number;
  recordCount: number;
  noopCount: number;
  observedOpportunityCount: number;
  observedOriginalEstimatedBytes: number;
  observedOriginalEstimatedTokens: number;
  totals: FooksEstimatedUsage;
  latestSessionKeys: string[];
  sessions: Record<string, FooksSessionMetricContribution>;
  claimBoundary: string;
};

export type FooksProjectMetricStatus = Omit<FooksProjectMetricSummaryFile, "sessions" | "latestSessionKeys"> & {
  latestSessionCount: number;
};

export type RecordFooksSessionMetricInput = {
  runtime: "codex";
  hookEventName: HookEventName;
  action: FooksSessionMetricAction;
  filePath?: string;
  reasons?: string[];
  contextMode?: ContextMode;
  contextModeReason?: string;
  fallbackReason?: string;
  originalEstimatedBytes?: number;
  actualEstimatedBytes?: number;
  comparableForSavings?: boolean;
  observedOriginalEstimatedBytes?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function nonNegativeInteger(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

export function estimateTextBytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function estimateFileBytes(filePath: string): number | undefined {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() ? stats.size : undefined;
  } catch {
    return undefined;
  }
}

export function estimateTokensFromBytes(bytes: number): number {
  const safeBytes = nonNegativeInteger(bytes);
  return safeBytes === 0 ? 0 : Math.ceil(safeBytes / ESTIMATED_BYTES_PER_TOKEN);
}

function roundRatio(value: number): number {
  return Number(value.toFixed(4));
}

function emptyUsage(): FooksEstimatedUsage {
  return {
    originalEstimatedBytes: 0,
    actualEstimatedBytes: 0,
    savedEstimatedBytes: 0,
    originalEstimatedTokens: 0,
    actualEstimatedTokens: 0,
    savedEstimatedTokens: 0,
    savingsRatio: 0,
  };
}

function usageFromBytes(originalBytes: number, actualBytes: number): FooksEstimatedUsage {
  const originalEstimatedBytes = nonNegativeInteger(originalBytes);
  const actualEstimatedBytes = nonNegativeInteger(actualBytes);
  const savedEstimatedBytes = Math.max(0, originalEstimatedBytes - actualEstimatedBytes);
  const originalEstimatedTokens = estimateTokensFromBytes(originalEstimatedBytes);
  const actualEstimatedTokens = estimateTokensFromBytes(actualEstimatedBytes);
  const savedEstimatedTokens = Math.max(0, originalEstimatedTokens - actualEstimatedTokens);
  return {
    originalEstimatedBytes,
    actualEstimatedBytes,
    savedEstimatedBytes,
    originalEstimatedTokens,
    actualEstimatedTokens,
    savedEstimatedTokens,
    savingsRatio: originalEstimatedBytes === 0 ? 0 : roundRatio(savedEstimatedBytes / originalEstimatedBytes),
  };
}

function recomputeUsageRatio(usage: FooksEstimatedUsage): FooksEstimatedUsage {
  return {
    ...usage,
    savingsRatio: usage.originalEstimatedBytes === 0 ? 0 : roundRatio(usage.savedEstimatedBytes / usage.originalEstimatedBytes),
  };
}

function addUsage(left: FooksEstimatedUsage, right: FooksEstimatedUsage): FooksEstimatedUsage {
  return recomputeUsageRatio({
    originalEstimatedBytes: left.originalEstimatedBytes + right.originalEstimatedBytes,
    actualEstimatedBytes: left.actualEstimatedBytes + right.actualEstimatedBytes,
    savedEstimatedBytes: left.savedEstimatedBytes + right.savedEstimatedBytes,
    originalEstimatedTokens: left.originalEstimatedTokens + right.originalEstimatedTokens,
    actualEstimatedTokens: left.actualEstimatedTokens + right.actualEstimatedTokens,
    savedEstimatedTokens: left.savedEstimatedTokens + right.savedEstimatedTokens,
    savingsRatio: 0,
  });
}

function truncateString(value: string, maxLength = 240): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}

function sanitizeReasons(reasons: string[] | undefined): string[] {
  return (reasons ?? []).slice(0, 12).map((reason) => truncateString(reason));
}

function readJsonFile<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function emptySessionSummary(sessionKey: string, timestamp = nowIso()): FooksSessionMetricSummary {
  return {
    schemaVersion: FOOKS_SESSION_METRICS_SCHEMA_VERSION,
    metricTier: FOOKS_SESSION_METRIC_TIER,
    sessionKey,
    sanitizedSessionKey: sanitizeDataKey(sessionKey),
    startedAt: timestamp,
    updatedAt: timestamp,
    eventCount: 0,
    comparableEventCount: 0,
    injectCount: 0,
    fallbackCount: 0,
    recordCount: 0,
    noopCount: 0,
    observedOpportunityCount: 0,
    observedOriginalEstimatedBytes: 0,
    observedOriginalEstimatedTokens: 0,
    totals: emptyUsage(),
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
  };
}

function emptyProjectSummaryFile(timestamp = nowIso()): FooksProjectMetricSummaryFile {
  return {
    schemaVersion: FOOKS_SESSION_METRICS_SCHEMA_VERSION,
    metricTier: FOOKS_SESSION_METRIC_TIER,
    updatedAt: timestamp,
    sessionCount: 0,
    eventCount: 0,
    comparableEventCount: 0,
    injectCount: 0,
    fallbackCount: 0,
    recordCount: 0,
    noopCount: 0,
    observedOpportunityCount: 0,
    observedOriginalEstimatedBytes: 0,
    observedOriginalEstimatedTokens: 0,
    totals: emptyUsage(),
    latestSessionKeys: [],
    sessions: {},
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
  };
}

function isSessionSummary(value: FooksSessionMetricSummary | null): value is FooksSessionMetricSummary {
  return Boolean(value && value.schemaVersion === FOOKS_SESSION_METRICS_SCHEMA_VERSION && value.metricTier === FOOKS_SESSION_METRIC_TIER);
}

function isProjectSummaryFile(value: FooksProjectMetricSummaryFile | null): value is FooksProjectMetricSummaryFile {
  return Boolean(value && value.schemaVersion === FOOKS_SESSION_METRICS_SCHEMA_VERSION && value.metricTier === FOOKS_SESSION_METRIC_TIER && value.sessions);
}

export function readSessionMetricSummary(cwd: string, sessionKey: string): FooksSessionMetricSummary {
  const summary = readJsonFile<FooksSessionMetricSummary>(sessionSummaryPath(cwd, sessionKey));
  return isSessionSummary(summary) ? summary : emptySessionSummary(sessionKey);
}

function contributionFromSession(summary: FooksSessionMetricSummary): FooksSessionMetricContribution {
  return {
    sessionKey: summary.sessionKey,
    sanitizedSessionKey: summary.sanitizedSessionKey,
    startedAt: summary.startedAt,
    updatedAt: summary.updatedAt,
    stoppedAt: summary.stoppedAt,
    eventCount: summary.eventCount,
    comparableEventCount: summary.comparableEventCount,
    injectCount: summary.injectCount,
    fallbackCount: summary.fallbackCount,
    recordCount: summary.recordCount,
    noopCount: summary.noopCount,
    observedOpportunityCount: summary.observedOpportunityCount,
    observedOriginalEstimatedBytes: summary.observedOriginalEstimatedBytes,
    observedOriginalEstimatedTokens: summary.observedOriginalEstimatedTokens,
    totals: summary.totals,
  };
}

function readProjectSummaryFile(cwd: string): FooksProjectMetricSummaryFile {
  const summary = readJsonFile<FooksProjectMetricSummaryFile>(sessionsSummaryPath(cwd));
  return isProjectSummaryFile(summary) ? summary : emptyProjectSummaryFile();
}

function recomputeProjectSummaryFile(summary: FooksProjectMetricSummaryFile, timestamp = nowIso()): FooksProjectMetricSummaryFile {
  const contributions = Object.values(summary.sessions).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  let totals = emptyUsage();
  for (const contribution of contributions) {
    totals = addUsage(totals, contribution.totals);
  }
  return {
    ...summary,
    updatedAt: timestamp,
    sessionCount: contributions.length,
    eventCount: contributions.reduce((total, contribution) => total + contribution.eventCount, 0),
    comparableEventCount: contributions.reduce((total, contribution) => total + contribution.comparableEventCount, 0),
    injectCount: contributions.reduce((total, contribution) => total + contribution.injectCount, 0),
    fallbackCount: contributions.reduce((total, contribution) => total + contribution.fallbackCount, 0),
    recordCount: contributions.reduce((total, contribution) => total + contribution.recordCount, 0),
    noopCount: contributions.reduce((total, contribution) => total + contribution.noopCount, 0),
    observedOpportunityCount: contributions.reduce((total, contribution) => total + contribution.observedOpportunityCount, 0),
    observedOriginalEstimatedBytes: contributions.reduce((total, contribution) => total + contribution.observedOriginalEstimatedBytes, 0),
    observedOriginalEstimatedTokens: contributions.reduce((total, contribution) => total + contribution.observedOriginalEstimatedTokens, 0),
    totals,
    latestSessionKeys: contributions.slice(0, 20).map((contribution) => contribution.sessionKey),
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
  };
}

export function refreshProjectMetricSummaryFromSession(cwd: string, sessionKey: string): FooksProjectMetricStatus {
  const sessionSummary = readSessionMetricSummary(cwd, sessionKey);
  const projectSummary = readProjectSummaryFile(cwd);
  projectSummary.sessions[sessionSummary.sanitizedSessionKey] = contributionFromSession(sessionSummary);
  const updated = recomputeProjectSummaryFile(projectSummary);
  writeJsonAtomic(sessionsSummaryPath(cwd), updated);
  return toProjectMetricStatus(updated);
}

function toProjectMetricStatus(summary: FooksProjectMetricSummaryFile): FooksProjectMetricStatus {
  const { sessions: _sessions, latestSessionKeys, ...status } = summary;
  return {
    ...status,
    latestSessionCount: latestSessionKeys.length,
  };
}

export function readProjectMetricSummary(cwd = process.cwd()): FooksProjectMetricStatus {
  return toProjectMetricStatus(readProjectSummaryFile(cwd));
}

function writeSessionSummary(cwd: string, summary: FooksSessionMetricSummary): void {
  writeJsonAtomic(sessionSummaryPath(cwd, summary.sessionKey), summary);
}

function appendSessionEvent(cwd: string, sessionKey: string, event: FooksSessionMetricEvent): void {
  const file = sessionEventsPath(cwd, sessionKey);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(event)}\n`);
}

export function initializeSessionMetricSummary(cwd: string, sessionKey: string): FooksSessionMetricSummary {
  const existing = readJsonFile<FooksSessionMetricSummary>(sessionSummaryPath(cwd, sessionKey));
  const summary = isSessionSummary(existing) ? existing : emptySessionSummary(sessionKey);
  writeSessionSummary(cwd, summary);
  refreshProjectMetricSummaryFromSession(cwd, sessionKey);
  return summary;
}

export function finalizeSessionMetricSummary(cwd: string, sessionKey: string): FooksSessionMetricSummary {
  const timestamp = nowIso();
  const summary = {
    ...readSessionMetricSummary(cwd, sessionKey),
    updatedAt: timestamp,
    stoppedAt: timestamp,
  } satisfies FooksSessionMetricSummary;
  writeSessionSummary(cwd, summary);
  refreshProjectMetricSummaryFromSession(cwd, sessionKey);
  return summary;
}

export function recordFooksSessionMetricEvent(cwd: string, sessionKey: string, input: RecordFooksSessionMetricInput): FooksSessionMetricSummary {
  const timestamp = nowIso();
  const comparableForSavings = Boolean(input.comparableForSavings);
  const originalBytes = comparableForSavings ? nonNegativeInteger(input.originalEstimatedBytes) : 0;
  const actualBytes = comparableForSavings ? nonNegativeInteger(input.actualEstimatedBytes) : 0;
  const eventUsage = comparableForSavings ? usageFromBytes(originalBytes, actualBytes) : emptyUsage();
  const observedOriginalEstimatedBytes = nonNegativeInteger(input.observedOriginalEstimatedBytes ?? input.originalEstimatedBytes);
  const observedOpportunity = !comparableForSavings && observedOriginalEstimatedBytes > 0;
  const event: FooksSessionMetricEvent = {
    schemaVersion: FOOKS_SESSION_METRICS_SCHEMA_VERSION,
    timestamp,
    runtime: input.runtime,
    sessionKey,
    hookEventName: input.hookEventName,
    action: input.action,
    filePath: input.filePath,
    reasons: sanitizeReasons(input.reasons),
    contextMode: input.contextMode,
    contextModeReason: input.contextModeReason ? truncateString(input.contextModeReason) : undefined,
    fallbackReason: input.fallbackReason ? truncateString(input.fallbackReason) : undefined,
    metricTier: FOOKS_SESSION_METRIC_TIER,
    comparableForSavings,
    estimated: eventUsage,
    observedOpportunity: observedOpportunity
      ? {
          originalEstimatedBytes: observedOriginalEstimatedBytes,
          originalEstimatedTokens: estimateTokensFromBytes(observedOriginalEstimatedBytes),
        }
      : undefined,
  };

  appendSessionEvent(cwd, sessionKey, event);

  const summary = readSessionMetricSummary(cwd, sessionKey);
  const updated: FooksSessionMetricSummary = {
    ...summary,
    updatedAt: timestamp,
    eventCount: summary.eventCount + 1,
    comparableEventCount: summary.comparableEventCount + (comparableForSavings ? 1 : 0),
    injectCount: summary.injectCount + (input.action === "inject" ? 1 : 0),
    fallbackCount: summary.fallbackCount + (input.action === "fallback" ? 1 : 0),
    recordCount: summary.recordCount + (input.action === "record" ? 1 : 0),
    noopCount: summary.noopCount + (input.action === "noop" ? 1 : 0),
    observedOpportunityCount: summary.observedOpportunityCount + (observedOpportunity ? 1 : 0),
    observedOriginalEstimatedBytes: summary.observedOriginalEstimatedBytes + (observedOpportunity ? observedOriginalEstimatedBytes : 0),
    observedOriginalEstimatedTokens:
      summary.observedOriginalEstimatedTokens + (observedOpportunity ? estimateTokensFromBytes(observedOriginalEstimatedBytes) : 0),
    totals: addUsage(summary.totals, eventUsage),
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
  };
  writeSessionSummary(cwd, updated);
  refreshProjectMetricSummaryFromSession(cwd, sessionKey);
  return updated;
}

export function initializeSessionMetricSummarySafe(cwd: string, sessionKey: string): void {
  try {
    initializeSessionMetricSummary(cwd, sessionKey);
  } catch {
    // Metrics are observational only; hook behavior must not depend on telemetry writes.
  }
}

export function finalizeSessionMetricSummarySafe(cwd: string, sessionKey: string): void {
  try {
    finalizeSessionMetricSummary(cwd, sessionKey);
  } catch {
    // Metrics are observational only; hook behavior must not depend on telemetry writes.
  }
}

export function recordFooksSessionMetricEventSafe(cwd: string, sessionKey: string, input: RecordFooksSessionMetricInput): void {
  try {
    recordFooksSessionMetricEvent(cwd, sessionKey, input);
  } catch {
    // Metrics are observational only; hook behavior must not depend on telemetry writes.
  }
}
