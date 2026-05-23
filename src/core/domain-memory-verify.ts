import { createHash } from "node:crypto";
import path from "node:path";
import type { DomainDetectionResult } from "./domain-profiles/types";

export const DOMAIN_MEMORY_VERIFY_SCHEMA_VERSION = "domain-memory-verify.v1" as const;

export type DomainMemoryVerifyStatus = "fresh" | "stale" | "incompatible" | "unsupported";
export type DomainMemoryVerifyCheck = "match" | "mismatch" | "missing";
export type DomainMemoryVerifySafeNextAction = "reuse-for-report-only" | "rerun-inspect-domain" | "full-read";

export type DomainMemoryVerifyResult = {
  schemaVersion: typeof DOMAIN_MEMORY_VERIFY_SCHEMA_VERSION;
  command: "domain-memory verify";
  filePath: string;
  receiptPath: string;
  status: DomainMemoryVerifyStatus;
  checks: {
    receiptSchema: DomainMemoryVerifyCheck;
    fileScope: DomainMemoryVerifyCheck;
    sourceFingerprint: DomainMemoryVerifyCheck;
    domainLane: DomainMemoryVerifyCheck;
    claimBoundary: DomainMemoryVerifyCheck;
    policyBoundary: "report-only" | "mismatch" | "missing";
    runtimeOrCacheReuse: false;
  };
  reasons: string[];
  nonClaims: string[];
  safeNextAction: DomainMemoryVerifySafeNextAction;
};

export type VerifyDomainMemoryReceiptOptions = {
  receipt: unknown;
  receiptPath: string;
  filePath: string;
  cwd: string;
  sourceText: string;
  domainDetection: DomainDetectionResult;
};

const NON_CLAIMS = [
  "does not authorize runtime reuse",
  "does not authorize pre-read reuse",
  "does not authorize cache reuse",
  "does not authorize model-facing payload reuse",
  "does not expand React Native, WebView, or TUI support",
  "does not use concern or domain evidence as authorization",
  "does not claim provider-token, billing, cost, latency, or runtime-token savings",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceFingerprintFor(sourceText: string): { fileHash: string; lineCount: number } {
  return {
    fileHash: `sha256:${createHash("sha256").update(sourceText).digest("hex")}`,
    lineCount: sourceText.length === 0 ? 0 : sourceText.split(/\r\n|\r|\n/u).length,
  };
}

function relativeFilePath(filePath: string, cwd: string): string {
  return path.relative(cwd, filePath) || path.basename(filePath);
}

function normalizeReceiptFilePath(receiptFilePath: unknown, cwd: string): string | undefined {
  if (typeof receiptFilePath !== "string" || receiptFilePath.trim() === "") return undefined;
  return path.resolve(cwd, receiptFilePath);
}

function checkFromBoolean(value: boolean | undefined): DomainMemoryVerifyCheck {
  if (value === undefined) return "missing";
  return value ? "match" : "mismatch";
}

function statusFor(checks: DomainMemoryVerifyResult["checks"]): DomainMemoryVerifyStatus {
  if (checks.receiptSchema !== "match" || checks.policyBoundary !== "report-only") return "unsupported";
  if (checks.fileScope === "mismatch" || checks.domainLane === "mismatch" || checks.claimBoundary === "mismatch") return "incompatible";
  if (
    checks.fileScope === "missing" ||
    checks.domainLane === "missing" ||
    checks.claimBoundary === "missing"
  ) {
    return "incompatible";
  }
  if (checks.sourceFingerprint !== "match") return "stale";
  return "fresh";
}

function safeNextActionFor(status: DomainMemoryVerifyStatus): DomainMemoryVerifySafeNextAction {
  if (status === "fresh") return "reuse-for-report-only";
  if (status === "stale") return "rerun-inspect-domain";
  return "full-read";
}

function reasonsFor(checks: DomainMemoryVerifyResult["checks"]): string[] {
  const reasons: string[] = [];
  if (checks.receiptSchema === "missing") reasons.push("missing domain-memory.v1 receipt schema");
  if (checks.receiptSchema === "mismatch") reasons.push("unsupported receipt schema");
  if (checks.fileScope === "missing") reasons.push("missing receipt file scope");
  if (checks.fileScope === "mismatch") reasons.push("receipt file scope does not match requested file");
  if (checks.sourceFingerprint === "missing") reasons.push("missing receipt source fingerprint");
  if (checks.sourceFingerprint === "mismatch") reasons.push("receipt source fingerprint is stale");
  if (checks.domainLane === "missing") reasons.push("missing receipt domain lane");
  if (checks.domainLane === "mismatch") reasons.push("receipt domain lane does not match current source");
  if (checks.claimBoundary === "missing") reasons.push("missing receipt claim boundary");
  if (checks.claimBoundary === "mismatch") reasons.push("receipt claim boundary does not match current source");
  if (checks.policyBoundary === "missing") reasons.push("missing report-only policy boundary");
  if (checks.policyBoundary === "mismatch") reasons.push("receipt attempts to exceed report-only runtime/cache boundary");
  if (reasons.length === 0) reasons.push("receipt is fresh for report-only evidence");
  return reasons;
}

function policyBoundaryFor(receipt: Record<string, unknown>): "report-only" | "mismatch" | "missing" {
  const policy = isRecord(receipt.policy) ? receipt.policy : undefined;
  const receiptMeta = isRecord(receipt.receipt) ? receipt.receipt : undefined;
  if (!policy || !receiptMeta) return "missing";

  const allowed = policy.allowed;
  const allowedMeaning = typeof policy.allowedMeaning === "string" ? policy.allowedMeaning : "";
  const runtimeOrCacheReuse = receiptMeta.runtimeOrCacheReuse;
  if (allowed !== false || runtimeOrCacheReuse !== false) return "mismatch";
  if (
    !/report-only/i.test(allowedMeaning) ||
    !/runtime/i.test(allowedMeaning) ||
    !/pre-read/i.test(allowedMeaning) ||
    !/cache/i.test(allowedMeaning)
  ) {
    return "mismatch";
  }
  return "report-only";
}

export function verifyDomainMemoryReceipt(options: VerifyDomainMemoryReceiptOptions): DomainMemoryVerifyResult {
  const receipt = isRecord(options.receipt) ? options.receipt : undefined;
  const scope = receipt && isRecord(receipt.scope) ? receipt.scope : undefined;
  const domain = receipt && isRecord(receipt.domain) ? receipt.domain : undefined;
  const receiptFingerprint = scope && isRecord(scope.sourceFingerprint) ? scope.sourceFingerprint : undefined;
  const currentFingerprint = sourceFingerprintFor(options.sourceText);
  const receiptFilePath = normalizeReceiptFilePath(scope?.filePath, options.cwd);
  const currentFilePath = path.resolve(options.filePath);

  const receiptSchema = receipt?.schemaVersion === undefined
    ? "missing"
    : receipt.schemaVersion === "domain-memory.v1"
      ? "match"
      : "mismatch";
  const fileScope = checkFromBoolean(receiptFilePath ? receiptFilePath === currentFilePath : undefined);
  const sourceFingerprint = checkFromBoolean(
    receiptFingerprint
      ? receiptFingerprint.fileHash === currentFingerprint.fileHash && receiptFingerprint.lineCount === currentFingerprint.lineCount
      : undefined,
  );
  const domainLane = checkFromBoolean(typeof domain?.lane === "string" ? domain.lane === options.domainDetection.classification : undefined);
  const claimBoundary = checkFromBoolean(
    typeof domain?.claimBoundary === "string" ? domain.claimBoundary === options.domainDetection.profile.claimBoundary : undefined,
  );
  const policyBoundary = receipt ? policyBoundaryFor(receipt) : "missing";

  const checks: DomainMemoryVerifyResult["checks"] = {
    receiptSchema,
    fileScope,
    sourceFingerprint,
    domainLane,
    claimBoundary,
    policyBoundary,
    runtimeOrCacheReuse: false,
  };
  const status = statusFor(checks);

  return {
    schemaVersion: DOMAIN_MEMORY_VERIFY_SCHEMA_VERSION,
    command: "domain-memory verify",
    filePath: relativeFilePath(options.filePath, options.cwd),
    receiptPath: relativeFilePath(options.receiptPath, options.cwd),
    status,
    checks,
    reasons: reasonsFor(checks),
    nonClaims: [...NON_CLAIMS],
    safeNextAction: safeNextActionFor(status),
  };
}

export function unsupportedDomainMemoryVerifyResult(options: {
  filePath: string;
  receiptPath: string;
  cwd: string;
  reason: string;
}): DomainMemoryVerifyResult {
  return {
    schemaVersion: DOMAIN_MEMORY_VERIFY_SCHEMA_VERSION,
    command: "domain-memory verify",
    filePath: relativeFilePath(options.filePath, options.cwd),
    receiptPath: relativeFilePath(options.receiptPath, options.cwd),
    status: "unsupported",
    checks: {
      receiptSchema: "missing",
      fileScope: "missing",
      sourceFingerprint: "missing",
      domainLane: "missing",
      claimBoundary: "missing",
      policyBoundary: "missing",
      runtimeOrCacheReuse: false,
    },
    reasons: [options.reason],
    nonClaims: [...NON_CLAIMS],
    safeNextAction: "full-read",
  };
}
