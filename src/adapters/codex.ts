import { scanProject } from "../core/scan";
import { extractFile } from "../core/extract";
import { detectAccountContext, finalizeAttach, installRuntimeManifest } from "./shared";
import { codexRuntimeEscapeHatches } from "./codex-runtime-prompt";
import { completeCodexInitialScan, initializeCodexTrustStatus } from "./codex-runtime-trust";
import { defaultCodexHookCommand } from "./codex-hook-preset";
import type { AttachResult } from "../core/schema";

export function attachCodex(sampleFile: string, cwd = process.cwd(), runtimeBridgeCommand = defaultCodexHookCommand()): AttachResult {
  initializeCodexTrustStatus(cwd);
  const scan = scanProject(cwd);
  const trustStatus = completeCodexInitialScan(scan.scannedAt, cwd);
  const sample = extractFile(sampleFile);
  const account = detectAccountContext(cwd);
  const attemptedAt = new Date().toISOString();
  const runtimeProof =
    account.account !== "minislively"
      ? {
          status: "blocked" as const,
          attemptedAt,
          details: ["codex adapter artifacts created", `detected-account=${account.account}`, `account-source=${account.source}`],
          blocker: "minislively account context not detected",
        }
      : (() => {
          const manifestPath = installRuntimeManifest("codex", cwd, {
            runtimeBridge: {
              command: runtimeBridgeCommand,
              supportedHookEvents: ["SessionStart", "UserPromptSubmit", "Stop"],
              scope: {
                extensions: [".tsx", ".jsx"],
                strategy: "session-repeated-read",
              },
              escapeHatches: [...codexRuntimeEscapeHatches()],
            },
          });
          if (!manifestPath) {
            return {
              status: "blocked" as const,
              attemptedAt,
              details: ["codex adapter artifacts created", `account-source=${account.source}`, "runtime-manifest-write-attempted=false"],
              blocker: "Codex runtime home not detected",
            };
          }

          return {
            status: "passed" as const,
            attemptedAt,
            artifactPath: manifestPath,
            details: [`account-context=${account.account}`, `account-source=${account.source}`, `runtime-manifest=${manifestPath}`, "codex adapter artifacts created"],
          };
        })();
  return finalizeAttach("codex", sample, runtimeProof, cwd, trustStatus);
}

export interface ExecutionContext {
  contextPath: string;
  fileCount: number;
  totalSize: number;
  prompt: string;
  handoffCommand: string;
}

// Prepare context for AI execution - execution is handed off to external runtime
export async function prepareExecutionContext(
  prompt: string,
  contextFiles: string[],
  cwd = process.cwd(),
): Promise<ExecutionContext> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  // Read and combine context files into a temporary context file
  let contextContent = "# Context Files\n\n";
  let totalSize = 0;

  for (const filePath of contextFiles) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const size = Buffer.byteLength(content, "utf8");
      totalSize += size;
      contextContent += `## ${path.basename(filePath)}\n\n${content}\n\n`;
    } catch (err) {
      console.error(`Failed to read ${filePath}:`, err);
    }
  }

  // Write temporary context file
  const tempContextPath = path.join(cwd, ".fooks", "temp-context.md");
  fs.mkdirSync(path.dirname(tempContextPath), { recursive: true });
  fs.writeFileSync(tempContextPath, contextContent);

  // Adapter contract: handoff command is abstracted, exact invocation not yet standardized
  // This allows swapping between Codex, OMX, Claude, or other runtimes
  const handoffCommand = `[runtime-adapter] ${prompt} --context ${tempContextPath}`;

  return {
    contextPath: tempContextPath,
    fileCount: contextFiles.length,
    totalSize,
    prompt,
    handoffCommand,
  };
}

// Deprecated: direct Codex execution path - identified as product blocker (300s+ timeout, no file changes)
// Kept for reference but not used in production path
export async function executeViaCodex(
  _prompt: string,
  _contextFiles: string[],
  _cwd = process.cwd(),
): Promise<{ success: boolean; modifiedFiles: string[]; error?: string }> {
  return {
    success: false,
    modifiedFiles: [],
    error: "Direct Codex execution deprecated. Use prepareExecutionContext() + handoff pattern.",
  };
}
