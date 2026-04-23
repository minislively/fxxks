import fs from "node:fs";
import path from "node:path";
import { hashText } from "../core/hash";
import { readScanIndex } from "../core/cache";
import { runtimeStatusPath } from "../core/paths";
import { scanProject } from "../core/scan";
import type { ClaudeActiveFileContext, ClaudeTrustStatus } from "../core/schema";

function now(): string {
  return new Date().toISOString();
}

function statusFile(cwd: string): string {
  return runtimeStatusPath("claude", cwd);
}

export function readClaudeTrustStatus(cwd = process.cwd()): ClaudeTrustStatus {
  const file = statusFile(cwd);
  if (!fs.existsSync(file)) {
    return {
      runtime: "claude",
      connectionState: "disconnected",
      lifecycleState: "disconnected",
      updatedAt: now(),
    };
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ClaudeTrustStatus;
  } catch {
    return {
      runtime: "claude",
      connectionState: "disconnected",
      lifecycleState: "disconnected",
      updatedAt: now(),
    };
  }
}

export function writeClaudeTrustStatus(status: ClaudeTrustStatus, cwd = process.cwd()): ClaudeTrustStatus {
  const file = statusFile(cwd);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(status, null, 2));
  } catch {
    // swallow write failures to avoid crashing the hook pipeline
  }
  return status;
}

export function patchClaudeTrustStatus(
  partial: Partial<ClaudeTrustStatus>,
  cwd = process.cwd(),
): ClaudeTrustStatus {
  const previous = readClaudeTrustStatus(cwd);
  const next: ClaudeTrustStatus = {
    ...previous,
    ...partial,
    runtime: "claude",
    updatedAt: now(),
  };
  if (partial.activeFile === undefined && Object.prototype.hasOwnProperty.call(partial, "activeFile")) {
    delete next.activeFile;
  }
  return writeClaudeTrustStatus(next, cwd);
}

export function initializeClaudeTrustStatus(cwd = process.cwd()): ClaudeTrustStatus {
  return patchClaudeTrustStatus({ connectionState: "connected", lifecycleState: "indexing" }, cwd);
}

export function completeClaudeInitialScan(scannedAt: string, cwd = process.cwd()): ClaudeTrustStatus {
  return patchClaudeTrustStatus({
    connectionState: "connected",
    lifecycleState: "ready",
    attachedAt: scannedAt,
    lastScanAt: scannedAt,
    lastRefreshAt: scannedAt,
  }, cwd);
}

export function markClaudeReady(cwd = process.cwd()): ClaudeTrustStatus {
  return patchClaudeTrustStatus({ connectionState: "connected", lifecycleState: "ready" }, cwd);
}

export function markClaudeAttachPrepared(activeFile: ClaudeActiveFileContext, cwd = process.cwd()): ClaudeTrustStatus {
  return patchClaudeTrustStatus({
    connectionState: "connected",
    lifecycleState: "attach-prepared",
    activeFile,
    lastAttachPreparedAt: now(),
  }, cwd);
}

export function clearClaudeActiveFile(cwd = process.cwd()): ClaudeTrustStatus {
  return patchClaudeTrustStatus({ activeFile: undefined, lifecycleState: "ready" }, cwd);
}

export function ensureFreshClaudeContextForTarget(target: string, cwd = process.cwd()): { refreshed: boolean; scannedAt?: string } {
  const absolute = path.join(cwd, target);
  if (!fs.existsSync(absolute)) {
    patchClaudeTrustStatus({ lifecycleState: "stale" }, cwd);
    return { refreshed: false };
  }

  const index = readScanIndex(cwd);
  const currentHash = hashText(fs.readFileSync(absolute, "utf8"));
  const indexed = index?.files.find((entry) => entry.filePath === target);
  if (!index || !indexed || indexed.fileHash !== currentHash) {
    patchClaudeTrustStatus({ connectionState: "connected", lifecycleState: "refreshing" }, cwd);
    const refreshed = scanProject(cwd);
    patchClaudeTrustStatus({
      connectionState: "connected",
      lifecycleState: "ready",
      lastScanAt: refreshed.scannedAt,
      lastRefreshAt: refreshed.scannedAt,
    }, cwd);
    return { refreshed: true, scannedAt: refreshed.scannedAt };
  }

  return { refreshed: false, scannedAt: index.scannedAt };
}
