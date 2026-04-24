import fs from "node:fs";
import path from "node:path";
import { hashText } from "../core/hash";
import { readScanIndex } from "../core/cache";
import { runtimeStatusPath } from "../core/paths";
import { scanProject } from "../core/scan";
import type { CodexActiveFileContext, CodexTrustStatus } from "../core/schema";

function now(): string {
  return new Date().toISOString();
}

function statusFile(cwd: string): string {
  return runtimeStatusPath("codex", cwd);
}

export function readCodexTrustStatus(cwd = process.cwd()): CodexTrustStatus {
  const file = statusFile(cwd);
  if (!fs.existsSync(file)) {
    return disconnectedCodexTrustStatus();
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as CodexTrustStatus;
  } catch {
    return disconnectedCodexTrustStatus();
  }
}

export function writeCodexTrustStatus(status: CodexTrustStatus, cwd = process.cwd()): CodexTrustStatus {
  const file = statusFile(cwd);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(status, null, 2));
  } catch {
    // Trust status is runtime telemetry; never crash the hook pipeline on local state write failures.
  }
  return status;
}

function disconnectedCodexTrustStatus(): CodexTrustStatus {
  return {
    runtime: "codex",
    connectionState: "disconnected",
    lifecycleState: "disconnected",
    updatedAt: now(),
  };
}

export function patchCodexTrustStatus(
  partial: Partial<CodexTrustStatus>,
  cwd = process.cwd(),
): CodexTrustStatus {
  const previous = readCodexTrustStatus(cwd);
  const next: CodexTrustStatus = {
    ...previous,
    ...partial,
    runtime: "codex",
    updatedAt: now(),
  };
  if (partial.activeFile === undefined && Object.prototype.hasOwnProperty.call(partial, "activeFile")) {
    delete next.activeFile;
  }
  return writeCodexTrustStatus(next, cwd);
}

export function initializeCodexTrustStatus(cwd = process.cwd()): CodexTrustStatus {
  return patchCodexTrustStatus({ connectionState: "connected", lifecycleState: "indexing" }, cwd);
}

export function completeCodexInitialScan(scannedAt: string, cwd = process.cwd()): CodexTrustStatus {
  return patchCodexTrustStatus({
    connectionState: "connected",
    lifecycleState: "ready",
    attachedAt: scannedAt,
    lastScanAt: scannedAt,
    lastRefreshAt: scannedAt,
  }, cwd);
}

export function markCodexReady(cwd = process.cwd()): CodexTrustStatus {
  return patchCodexTrustStatus({ connectionState: "connected", lifecycleState: "ready" }, cwd);
}

export function markCodexAttachPrepared(activeFile: CodexActiveFileContext, cwd = process.cwd()): CodexTrustStatus {
  return patchCodexTrustStatus({
    connectionState: "connected",
    lifecycleState: "attach-prepared",
    activeFile,
    lastAttachPreparedAt: now(),
  }, cwd);
}

export function clearCodexActiveFile(cwd = process.cwd()): CodexTrustStatus {
  return patchCodexTrustStatus({ activeFile: undefined, lifecycleState: "ready" }, cwd);
}

export function ensureFreshCodexContextForTarget(target: string, cwd = process.cwd()): { refreshed: boolean; scannedAt?: string } {
  const absolute = path.join(cwd, target);
  if (!fs.existsSync(absolute)) {
    patchCodexTrustStatus({ lifecycleState: "stale" }, cwd);
    return { refreshed: false };
  }

  const index = readScanIndex(cwd);
  const currentHash = hashText(fs.readFileSync(absolute, "utf8"));
  const indexed = index?.files.find((entry) => entry.filePath === target);
  if (!index || !indexed || indexed.fileHash !== currentHash) {
    patchCodexTrustStatus({ connectionState: "connected", lifecycleState: "refreshing" }, cwd);
    const refreshed = scanProject(cwd);
    patchCodexTrustStatus({
      connectionState: "connected",
      lifecycleState: "ready",
      lastScanAt: refreshed.scannedAt,
      lastRefreshAt: refreshed.scannedAt,
    }, cwd);
    return { refreshed: true, scannedAt: refreshed.scannedAt };
  }

  patchCodexTrustStatus({ connectionState: "connected", lifecycleState: "ready" }, cwd);
  return { refreshed: false, scannedAt: index.scannedAt };
}
