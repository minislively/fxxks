import fs from "node:fs";
import path from "node:path";
import { lookupDomainMemoryReceipts, type DomainMemoryLookupResult } from "../core/domain-memory-lookup";
import { isSafeProjectFilePath } from "../core/paths";
import type { PreReadDecision } from "../core/schema";
import { decidePreRead } from "./pre-read";

export { decidePreRead };

export type CodexPreReadOptions = {
  includeDomainMemoryLookup?: boolean;
};

function toDomainMemoryLookupDebug(lookup: DomainMemoryLookupResult): NonNullable<PreReadDecision["debug"]["domainMemoryLookup"]> {
  return {
    source: "codex-pre-read opt-in domain-memory lookup",
    status: lookup.status,
    authorization: "none",
    advisoryOnly: true,
    candidateCount: lookup.candidateCount,
    freshCandidateCount: lookup.freshCandidateCount,
    ...(lookup.advisoryReceiptPath ? { advisoryReceiptPath: lookup.advisoryReceiptPath } : {}),
    safeNextAction: lookup.safeNextAction,
    reasons: lookup.reasons,
  };
}

function shouldAttachDomainMemoryLookup(decision: PreReadDecision, filePath: string, cwd: string): boolean {
  if (!decision.eligible) return false;
  const resolvedPath = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(cwd, filePath);
  try {
    if (!isSafeProjectFilePath(resolvedPath, cwd)) return false;
    return fs.statSync(resolvedPath).isFile();
  } catch {
    return false;
  }
}

export function decideCodexPreRead(filePath: string, cwd = process.cwd(), options: CodexPreReadOptions = {}) {
  const decision = decidePreRead(filePath, cwd);
  if (options.includeDomainMemoryLookup !== true || !shouldAttachDomainMemoryLookup(decision, filePath, cwd)) {
    return decision;
  }

  try {
    const lookup = lookupDomainMemoryReceipts(filePath, cwd);
    return {
      ...decision,
      debug: {
        ...decision.debug,
        domainMemoryLookup: toDomainMemoryLookupDebug(lookup),
      },
    };
  } catch {
    return decision;
  }
}
