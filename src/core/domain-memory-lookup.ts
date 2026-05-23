import fs from "node:fs";
import path from "node:path";
import { detectDomainFromSource } from "./domain-detector";
import {
  type DomainMemoryVerifyResult,
  type DomainMemoryVerifySafeNextAction,
  unsupportedDomainMemoryVerifyResult,
  verifyDomainMemoryReceipt,
} from "./domain-memory-verify";

export const DOMAIN_MEMORY_LOOKUP_SCHEMA_VERSION = "domain-memory-lookup.v1" as const;
export const DOMAIN_MEMORY_LOOKUP_DIR = path.join(".fooks", "domain-memory");

export type DomainMemoryLookupStatus =
  | "not-found"
  | "fresh"
  | "stale"
  | "incompatible"
  | "unsupported"
  | "ambiguous";

export type DomainMemoryLookupCandidate = {
  receiptPath: string;
  status: DomainMemoryVerifyResult["status"];
  safeNextAction: DomainMemoryVerifyResult["safeNextAction"];
  reasons: string[];
  verifyResult: DomainMemoryVerifyResult;
};

export type DomainMemoryLookupResult = {
  schemaVersion: typeof DOMAIN_MEMORY_LOOKUP_SCHEMA_VERSION;
  command: "domain-memory lookup";
  filePath: string;
  lookupDir: string;
  status: DomainMemoryLookupStatus;
  authorization: "none";
  advisoryOnly: true;
  advisoryReceiptPath?: string;
  candidateCount: number;
  freshCandidateCount: number;
  candidates: DomainMemoryLookupCandidate[];
  reasons: string[];
  nonClaims: string[];
  safeNextAction: DomainMemoryVerifySafeNextAction;
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

function relativeFilePath(filePath: string, cwd: string): string {
  return path.relative(cwd, filePath) || path.basename(filePath);
}

function lookupDirPath(cwd: string): string {
  return path.join(cwd, DOMAIN_MEMORY_LOOKUP_DIR);
}

function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function listReceiptJsonFiles(dir: string, cwd: string): { files: string[]; error?: string } {
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(resolved);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".json")) files.push(resolved);
    }
  };
  try {
    if (!fs.existsSync(dir)) return { files };
    const dirStat = fs.lstatSync(dir);
    if (dirStat.isSymbolicLink()) return { files: [], error: "lookup directory must not be a symlink" };
    if (!dirStat.isDirectory()) return { files };
    const realCwd = fs.realpathSync(cwd);
    const realDir = fs.realpathSync(dir);
    if (!isPathInside(realDir, realCwd)) {
      return { files: [], error: "lookup directory must stay inside the project root" };
    }
    visit(dir);
    return { files: files.sort((left, right) => left.localeCompare(right)) };
  } catch (error) {
    return { files: [], error: `lookup directory could not be read: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function safeNextActionFor(status: DomainMemoryLookupStatus): DomainMemoryVerifySafeNextAction {
  if (status === "fresh") return "reuse-for-report-only";
  if (status === "stale" || status === "not-found") return "rerun-inspect-domain";
  return "full-read";
}

function aggregateStatus(candidates: DomainMemoryLookupCandidate[]): DomainMemoryLookupStatus {
  if (candidates.length === 0) return "not-found";
  if (candidates.some((candidate) => candidate.status === "unsupported")) return "unsupported";
  if (candidates.some((candidate) => candidate.status === "incompatible")) return "incompatible";
  if (candidates.some((candidate) => candidate.status === "stale")) return "stale";
  const fresh = candidates.filter((candidate) => candidate.status === "fresh");
  if (fresh.length > 1) return "ambiguous";
  if (fresh.length === 1 && candidates.length === 1) return "fresh";
  return "not-found";
}

function reasonsFor(
  status: DomainMemoryLookupStatus,
  candidates: DomainMemoryLookupCandidate[],
  lookupDir: string,
  lookupError?: string,
): string[] {
  if (lookupError) return [lookupError];
  if (status === "not-found") return [`no domain-memory receipt JSON files found in ${lookupDir}`];
  if (status === "fresh") return ["exactly one fresh domain-memory receipt found for report-only evidence"];
  if (status === "ambiguous") return ["multiple fresh domain-memory receipts found; refusing to select one automatically"];
  const matching = candidates.filter((candidate) => candidate.status === status);
  return matching.length > 0
    ? matching.flatMap((candidate) => candidate.reasons.map((reason) => `${candidate.receiptPath}: ${reason}`))
    : [`domain-memory lookup resolved ${status}`];
}

export function lookupDomainMemoryReceipts(filePath: string, cwd = process.cwd()): DomainMemoryLookupResult {
  const resolvedCwd = path.resolve(cwd);
  const resolvedFile = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(resolvedCwd, filePath);
  const sourceText = fs.readFileSync(resolvedFile, "utf8");
  const domainDetection = detectDomainFromSource(sourceText, resolvedFile);
  const dir = lookupDirPath(resolvedCwd);
  const { files: receiptPaths, error: lookupError } = listReceiptJsonFiles(dir, resolvedCwd);
  const candidates = receiptPaths.map((receiptPath): DomainMemoryLookupCandidate => {
    let verifyResult: DomainMemoryVerifyResult;
    try {
      verifyResult = verifyDomainMemoryReceipt({
        receipt: JSON.parse(fs.readFileSync(receiptPath, "utf8")),
        receiptPath,
        filePath: resolvedFile,
        cwd: resolvedCwd,
        sourceText,
        domainDetection,
      });
    } catch (error) {
      verifyResult = unsupportedDomainMemoryVerifyResult({
        filePath: resolvedFile,
        receiptPath,
        cwd: resolvedCwd,
        reason: `receipt JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    return {
      receiptPath: verifyResult.receiptPath,
      status: verifyResult.status,
      safeNextAction: verifyResult.safeNextAction,
      reasons: verifyResult.reasons,
      verifyResult,
    };
  });
  const status = lookupError ? "unsupported" : aggregateStatus(candidates);
  const freshCandidates = candidates.filter((candidate) => candidate.status === "fresh");
  const advisoryReceiptPath = status === "fresh" ? freshCandidates[0]?.receiptPath : undefined;
  const relativeLookupDir = relativeFilePath(dir, resolvedCwd);

  return {
    schemaVersion: DOMAIN_MEMORY_LOOKUP_SCHEMA_VERSION,
    command: "domain-memory lookup",
    filePath: relativeFilePath(resolvedFile, resolvedCwd),
    lookupDir: relativeLookupDir,
    status,
    authorization: "none",
    advisoryOnly: true,
    ...(advisoryReceiptPath ? { advisoryReceiptPath } : {}),
    candidateCount: candidates.length,
    freshCandidateCount: freshCandidates.length,
    candidates,
    reasons: reasonsFor(status, candidates, relativeLookupDir, lookupError),
    nonClaims: [...NON_CLAIMS],
    safeNextAction: safeNextActionFor(status),
  };
}
