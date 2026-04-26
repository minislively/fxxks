import fs from "node:fs";
import path from "node:path";
import { sessionEventsPath, sessionSummaryPath, sessionsSummaryPath, sanitizeDataKey } from "./paths";
import type { ContextMode } from "./schema";

export const FOOKS_SESSION_METRICS_SCHEMA_VERSION = 1;
export const FOOKS_SESSION_METRIC_TIER = "estimated" as const;
export const ESTIMATED_BYTES_PER_TOKEN = 4;
export const FOOKS_METRIC_CLAIM_BOUNDARY =
  "Estimated local context-size telemetry only; values are not provider usage/billing tokens, invoices, dashboards, charged costs, or a ccusage replacement.";

export type FooksMetricRuntime = "codex" | "claude";
export type FooksMeasurementSource = "automatic-hook" | "project-local-context-hook" | "manual-handoff" | "local-simulation";
type MetricTier = typeof FOOKS_SESSION_METRIC_TIER;
export type FooksSessionMetricAction = "inject" | "fallback" | "record" | "noop";

export type FooksMetricIdentityOptions = {
  runtime?: FooksMetricRuntime;
  measurementSource?: FooksMeasurementSource;
};

export type FooksEstimatedUsage = {
  originalEstimatedBytes: number;
  actualEstimatedBytes: number;
  savedEstimatedBytes: number;
  originalEstimatedTokens: number;
  actualEstimatedTokens: number;
  savedEstimatedTokens: number;
  savingsRatio: number;
};

export type FooksMetricAggregate = {
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
};

export type FooksMetricBreakdown = {
  byRuntime: Partial<Record<FooksMetricRuntime, FooksMetricAggregate>>;
  byMeasurementSource: Partial<Record<FooksMeasurementSource, FooksMetricAggregate>>;
  byRuntimeAndSource: Record<string, FooksMetricAggregate>;
};

export type FooksSessionMetricEvent = {
  schemaVersion: typeof FOOKS_SESSION_METRICS_SCHEMA_VERSION;
  timestamp: string;
  metricTier: MetricTier;
  claimBoundary: string;
  runtime: FooksMetricRuntime;
  measurementSource: FooksMeasurementSource;
  rawSessionKey: string;
  metricSessionKey: string;
  sessionKey: string;
  eventName: string;
  hookEventName?: string;
  action: FooksSessionMetricAction;
  filePath?: string;
  reasons: string[];
  contextMode?: ContextMode;
  contextModeReason?: string;
  fallbackReason?: string;
  comparableForSavings: boolean;
  estimated: FooksEstimatedUsage;
  observedOpportunity?: {
    originalEstimatedBytes: number;
    originalEstimatedTokens: number;
  };
};

export type FooksSessionMetricSummary = FooksMetricAggregate & {
  schemaVersion: typeof FOOKS_SESSION_METRICS_SCHEMA_VERSION;
  metricTier: MetricTier;
  runtime: FooksMetricRuntime;
  measurementSource: FooksMeasurementSource;
  rawSessionKey: string;
  metricSessionKey: string;
  sessionKey: string;
  sanitizedSessionKey: string;
  startedAt: string;
  updatedAt: string;
  stoppedAt?: string;
  claimBoundary: string;
};

export type FooksSessionMetricContribution = Pick<
  FooksSessionMetricSummary,
  | "runtime"
  | "measurementSource"
  | "rawSessionKey"
  | "metricSessionKey"
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

export type FooksProjectMetricSummaryFile = FooksMetricAggregate & {
  schemaVersion: typeof FOOKS_SESSION_METRICS_SCHEMA_VERSION;
  metricTier: MetricTier;
  updatedAt: string;
  sessionCount: number;
  latestSessionKeys: string[];
  sessions: Record<string, FooksSessionMetricContribution>;
  breakdown: FooksMetricBreakdown;
  claimBoundary: string;
};

export type FooksProjectMetricStatus = Omit<FooksProjectMetricSummaryFile, "sessions" | "latestSessionKeys"> & {
  latestSessionCount: number;
};

export type RecordFooksSessionMetricInput = {
  runtime: FooksMetricRuntime;
  measurementSource?: FooksMeasurementSource;
  eventName?: string;
  hookEventName?: string;
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

type MetricIdentity = {
  runtime: FooksMetricRuntime;
  measurementSource: FooksMeasurementSource;
  rawSessionKey: string;
  metricSessionKey: string;
};

const MEASUREMENT_SOURCES: FooksMeasurementSource[] = ["automatic-hook", "project-local-context-hook", "manual-handoff", "local-simulation"];
const RUNTIMES: FooksMetricRuntime[] = ["codex", "claude"];

function nowIso(): string {
  return new Date().toISOString();
}

function defaultMeasurementSource(runtime: FooksMetricRuntime): FooksMeasurementSource {
  return runtime === "claude" ? "project-local-context-hook" : "automatic-hook";
}

export function metricSessionKey(rawSessionKey: string, options: Required<FooksMetricIdentityOptions>): string {
  return `${options.runtime}:${options.measurementSource}:${rawSessionKey}`;
}

function parseMetricSessionKey(value: string): MetricIdentity | null {
  for (const runtime of RUNTIMES) {
    for (const measurementSource of MEASUREMENT_SOURCES) {
      const prefix = `${runtime}:${measurementSource}:`;
      if (value.startsWith(prefix)) {
        const rawSessionKey = value.slice(prefix.length) || "default-session";
        return {
          runtime,
          measurementSource,
          rawSessionKey,
          metricSessionKey: value,
        };
      }
    }
  }
  return null;
}

function resolveMetricIdentity(rawOrMetricSessionKey: string, options: FooksMetricIdentityOptions = {}): MetricIdentity {
  if (!options.runtime && !options.measurementSource) {
    const parsed = parseMetricSessionKey(rawOrMetricSessionKey);
    if (parsed) return parsed;
  }
  const runtime = options.runtime ?? "codex";
  const measurementSource = options.measurementSource ?? defaultMeasurementSource(runtime);
  const rawSessionKey = rawOrMetricSessionKey || "default-session";
  return {
    runtime,
    measurementSource,
    rawSessionKey,
    metricSessionKey: metricSessionKey(rawSessionKey, { runtime, measurementSource }),
  };
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

function emptyAggregate(): FooksMetricAggregate {
  return {
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

function addAggregate(left: FooksMetricAggregate, right: FooksMetricAggregate): FooksMetricAggregate {
  return {
    eventCount: left.eventCount + right.eventCount,
    comparableEventCount: left.comparableEventCount + right.comparableEventCount,
    injectCount: left.injectCount + right.injectCount,
    fallbackCount: left.fallbackCount + right.fallbackCount,
    recordCount: left.recordCount + right.recordCount,
    noopCount: left.noopCount + right.noopCount,
    observedOpportunityCount: left.observedOpportunityCount + right.observedOpportunityCount,
    observedOriginalEstimatedBytes: left.observedOriginalEstimatedBytes + right.observedOriginalEstimatedBytes,
    observedOriginalEstimatedTokens: left.observedOriginalEstimatedTokens + right.observedOriginalEstimatedTokens,
    totals: addUsage(left.totals, right.totals),
  };
}

function aggregateFromContribution(contribution: FooksSessionMetricContribution): FooksMetricAggregate {
  return {
    eventCount: nonNegativeInteger(contribution.eventCount),
    comparableEventCount: nonNegativeInteger(contribution.comparableEventCount),
    injectCount: nonNegativeInteger(contribution.injectCount),
    fallbackCount: nonNegativeInteger(contribution.fallbackCount),
    recordCount: nonNegativeInteger(contribution.recordCount),
    noopCount: nonNegativeInteger(contribution.noopCount),
    observedOpportunityCount: nonNegativeInteger(contribution.observedOpportunityCount),
    observedOriginalEstimatedBytes: nonNegativeInteger(contribution.observedOriginalEstimatedBytes),
    observedOriginalEstimatedTokens: nonNegativeInteger(contribution.observedOriginalEstimatedTokens),
    totals: contribution.totals ?? emptyUsage(),
  };
}

function addBreakdownAggregate<T extends string>(target: Partial<Record<T, FooksMetricAggregate>>, key: T, aggregate: FooksMetricAggregate): void {
  target[key] = addAggregate(target[key] ?? emptyAggregate(), aggregate);
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

function emptySessionSummary(rawSessionKey: string, identity = resolveMetricIdentity(rawSessionKey), timestamp = nowIso()): FooksSessionMetricSummary {
  return {
    schemaVersion: FOOKS_SESSION_METRICS_SCHEMA_VERSION,
    metricTier: FOOKS_SESSION_METRIC_TIER,
    runtime: identity.runtime,
    measurementSource: identity.measurementSource,
    rawSessionKey: identity.rawSessionKey,
    metricSessionKey: identity.metricSessionKey,
    sessionKey: identity.metricSessionKey,
    sanitizedSessionKey: sanitizeDataKey(identity.metricSessionKey),
    startedAt: timestamp,
    updatedAt: timestamp,
    ...emptyAggregate(),
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
  };
}

function emptyBreakdown(): FooksMetricBreakdown {
  return {
    byRuntime: {},
    byMeasurementSource: {},
    byRuntimeAndSource: {},
  };
}

function emptyProjectSummaryFile(timestamp = nowIso()): FooksProjectMetricSummaryFile {
  return {
    schemaVersion: FOOKS_SESSION_METRICS_SCHEMA_VERSION,
    metricTier: FOOKS_SESSION_METRIC_TIER,
    updatedAt: timestamp,
    sessionCount: 0,
    ...emptyAggregate(),
    latestSessionKeys: [],
    sessions: {},
    breakdown: emptyBreakdown(),
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
  };
}

function isSessionSummary(value: FooksSessionMetricSummary | null): value is FooksSessionMetricSummary {
  return Boolean(value && value.schemaVersion === FOOKS_SESSION_METRICS_SCHEMA_VERSION && value.metricTier === FOOKS_SESSION_METRIC_TIER);
}

function isProjectSummaryFile(value: FooksProjectMetricSummaryFile | null): value is FooksProjectMetricSummaryFile {
  return Boolean(value && value.schemaVersion === FOOKS_SESSION_METRICS_SCHEMA_VERSION && value.metricTier === FOOKS_SESSION_METRIC_TIER && value.sessions);
}

function normalizeSessionSummary(summary: FooksSessionMetricSummary, identity: MetricIdentity): FooksSessionMetricSummary {
  const normalizedIdentity = {
    runtime: summary.runtime ?? identity.runtime,
    measurementSource: summary.measurementSource ?? identity.measurementSource,
    rawSessionKey: summary.rawSessionKey ?? identity.rawSessionKey,
    metricSessionKey: summary.metricSessionKey ?? identity.metricSessionKey,
  };
  return {
    ...emptySessionSummary(normalizedIdentity.rawSessionKey, normalizedIdentity, summary.startedAt),
    ...summary,
    runtime: normalizedIdentity.runtime,
    measurementSource: normalizedIdentity.measurementSource,
    rawSessionKey: normalizedIdentity.rawSessionKey,
    metricSessionKey: normalizedIdentity.metricSessionKey,
    sessionKey: normalizedIdentity.metricSessionKey,
    sanitizedSessionKey: sanitizeDataKey(normalizedIdentity.metricSessionKey),
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
  };
}

export function readSessionMetricSummary(cwd: string, sessionKey: string, options: FooksMetricIdentityOptions = {}): FooksSessionMetricSummary {
  const identity = resolveMetricIdentity(sessionKey, options);
  const summary =
    readJsonFile<FooksSessionMetricSummary>(sessionSummaryPath(cwd, identity.metricSessionKey)) ??
    readJsonFile<FooksSessionMetricSummary>(sessionSummaryPath(cwd, sessionKey));
  return isSessionSummary(summary) ? normalizeSessionSummary(summary, identity) : emptySessionSummary(identity.rawSessionKey, identity);
}

function contributionFromSession(summary: FooksSessionMetricSummary): FooksSessionMetricContribution {
  return {
    runtime: summary.runtime,
    measurementSource: summary.measurementSource,
    rawSessionKey: summary.rawSessionKey,
    metricSessionKey: summary.metricSessionKey,
    sessionKey: summary.metricSessionKey,
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

function normalizeContribution(contribution: FooksSessionMetricContribution): FooksSessionMetricContribution {
  const seedKey = contribution.metricSessionKey ?? contribution.sessionKey ?? contribution.rawSessionKey ?? "default-session";
  const seedIdentity = contribution.metricSessionKey
    ? (parseMetricSessionKey(contribution.metricSessionKey) ?? resolveMetricIdentity(contribution.metricSessionKey))
    : resolveMetricIdentity(seedKey, {
        runtime: contribution.runtime,
        measurementSource: contribution.measurementSource,
      });
  const runtime = contribution.runtime ?? seedIdentity.runtime;
  const measurementSource = contribution.measurementSource ?? seedIdentity.measurementSource;
  const rawSessionKey = contribution.rawSessionKey ?? seedIdentity.rawSessionKey;
  const normalizedIdentity = resolveMetricIdentity(rawSessionKey, { runtime, measurementSource });
  return {
    ...contribution,
    runtime,
    measurementSource,
    rawSessionKey,
    metricSessionKey: normalizedIdentity.metricSessionKey,
    sessionKey: normalizedIdentity.metricSessionKey,
    sanitizedSessionKey: sanitizeDataKey(normalizedIdentity.metricSessionKey),
    totals: contribution.totals ?? emptyUsage(),
  };
}

function readProjectSummaryFile(cwd: string): FooksProjectMetricSummaryFile {
  const summary = readJsonFile<FooksProjectMetricSummaryFile>(sessionsSummaryPath(cwd));
  return isProjectSummaryFile(summary) ? recomputeProjectSummaryFile(summary) : emptyProjectSummaryFile();
}

function recomputeProjectSummaryFile(summary: FooksProjectMetricSummaryFile, timestamp = nowIso()): FooksProjectMetricSummaryFile {
  const contributions = Object.values(summary.sessions).map(normalizeContribution).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  let aggregate = emptyAggregate();
  const breakdown = emptyBreakdown();
  for (const contribution of contributions) {
    const contributionAggregate = aggregateFromContribution(contribution);
    aggregate = addAggregate(aggregate, contributionAggregate);
    addBreakdownAggregate(breakdown.byRuntime, contribution.runtime, contributionAggregate);
    addBreakdownAggregate(breakdown.byMeasurementSource, contribution.measurementSource, contributionAggregate);
    breakdown.byRuntimeAndSource[`${contribution.runtime}:${contribution.measurementSource}`] = addAggregate(
      breakdown.byRuntimeAndSource[`${contribution.runtime}:${contribution.measurementSource}`] ?? emptyAggregate(),
      contributionAggregate,
    );
  }
  return {
    ...summary,
    schemaVersion: FOOKS_SESSION_METRICS_SCHEMA_VERSION,
    metricTier: FOOKS_SESSION_METRIC_TIER,
    updatedAt: timestamp,
    sessionCount: contributions.length,
    ...aggregate,
    latestSessionKeys: contributions.slice(0, 20).map((contribution) => contribution.metricSessionKey),
    sessions: Object.fromEntries(contributions.map((contribution) => [contribution.sanitizedSessionKey, contribution])),
    breakdown,
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
  };
}

export function refreshProjectMetricSummaryFromSession(cwd: string, sessionKey: string, options: FooksMetricIdentityOptions = {}): FooksProjectMetricStatus {
  const sessionSummary = readSessionMetricSummary(cwd, sessionKey, options);
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
  writeJsonAtomic(sessionSummaryPath(cwd, summary.metricSessionKey), summary);
}

function appendSessionEvent(cwd: string, metricSessionKeyValue: string, event: FooksSessionMetricEvent): void {
  const file = sessionEventsPath(cwd, metricSessionKeyValue);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(event)}\n`);
}

export function initializeSessionMetricSummary(cwd: string, sessionKey: string, options: FooksMetricIdentityOptions = {}): FooksSessionMetricSummary {
  const identity = resolveMetricIdentity(sessionKey, options);
  const existing = readJsonFile<FooksSessionMetricSummary>(sessionSummaryPath(cwd, identity.metricSessionKey));
  const summary = isSessionSummary(existing) ? normalizeSessionSummary(existing, identity) : emptySessionSummary(identity.rawSessionKey, identity);
  writeSessionSummary(cwd, summary);
  refreshProjectMetricSummaryFromSession(cwd, identity.metricSessionKey);
  return summary;
}

export function finalizeSessionMetricSummary(cwd: string, sessionKey: string, options: FooksMetricIdentityOptions = {}): FooksSessionMetricSummary {
  const identity = resolveMetricIdentity(sessionKey, options);
  const timestamp = nowIso();
  const summary = {
    ...readSessionMetricSummary(cwd, identity.metricSessionKey),
    updatedAt: timestamp,
    stoppedAt: timestamp,
  } satisfies FooksSessionMetricSummary;
  writeSessionSummary(cwd, summary);
  refreshProjectMetricSummaryFromSession(cwd, identity.metricSessionKey);
  return summary;
}

export function recordFooksSessionMetricEvent(cwd: string, sessionKey: string, input: RecordFooksSessionMetricInput): FooksSessionMetricSummary {
  const identity = resolveMetricIdentity(sessionKey, { runtime: input.runtime, measurementSource: input.measurementSource });
  const timestamp = nowIso();
  const comparableForSavings = Boolean(input.comparableForSavings);
  const originalBytes = comparableForSavings ? nonNegativeInteger(input.originalEstimatedBytes) : 0;
  const actualBytes = comparableForSavings ? nonNegativeInteger(input.actualEstimatedBytes) : 0;
  const eventUsage = comparableForSavings ? usageFromBytes(originalBytes, actualBytes) : emptyUsage();
  const observedOriginalEstimatedBytes = nonNegativeInteger(input.observedOriginalEstimatedBytes ?? input.originalEstimatedBytes);
  const observedOpportunity = !comparableForSavings && observedOriginalEstimatedBytes > 0;
  const eventName = input.eventName ?? input.hookEventName ?? "unknown";
  const event: FooksSessionMetricEvent = {
    schemaVersion: FOOKS_SESSION_METRICS_SCHEMA_VERSION,
    timestamp,
    metricTier: FOOKS_SESSION_METRIC_TIER,
    claimBoundary: FOOKS_METRIC_CLAIM_BOUNDARY,
    runtime: identity.runtime,
    measurementSource: identity.measurementSource,
    rawSessionKey: identity.rawSessionKey,
    metricSessionKey: identity.metricSessionKey,
    sessionKey: identity.metricSessionKey,
    eventName,
    hookEventName: input.hookEventName,
    action: input.action,
    filePath: input.filePath,
    reasons: sanitizeReasons(input.reasons),
    contextMode: input.contextMode,
    contextModeReason: input.contextModeReason ? truncateString(input.contextModeReason) : undefined,
    fallbackReason: input.fallbackReason ? truncateString(input.fallbackReason) : undefined,
    comparableForSavings,
    estimated: eventUsage,
    observedOpportunity: observedOpportunity
      ? {
          originalEstimatedBytes: observedOriginalEstimatedBytes,
          originalEstimatedTokens: estimateTokensFromBytes(observedOriginalEstimatedBytes),
        }
      : undefined,
  };

  appendSessionEvent(cwd, identity.metricSessionKey, event);

  const summary = readSessionMetricSummary(cwd, identity.metricSessionKey);
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
  refreshProjectMetricSummaryFromSession(cwd, identity.metricSessionKey);
  return updated;
}

export function initializeSessionMetricSummarySafe(cwd: string, sessionKey: string, options: FooksMetricIdentityOptions = {}): void {
  try {
    initializeSessionMetricSummary(cwd, sessionKey, options);
  } catch {
    // Metrics are observational only; hook behavior must not depend on telemetry writes.
  }
}

export function finalizeSessionMetricSummarySafe(cwd: string, sessionKey: string, options: FooksMetricIdentityOptions = {}): void {
  try {
    finalizeSessionMetricSummary(cwd, sessionKey, options);
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
