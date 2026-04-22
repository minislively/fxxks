import { scanProject } from "../core/scan";
import { extractFile } from "../core/extract";
import { detectAccountContext, finalizeAttach, installRuntimeManifest } from "./shared";
import { codexRuntimeEscapeHatches } from "./codex-runtime-prompt";
import { classifyPromptContext } from "../core/context-policy";
import type { PromptContextPolicy } from "../core/context-policy";
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
  // This is a local artifact/readiness check only. A passed result means the
  // manifest and adapter files were written; it does not mean Codex runtime
  // telemetry was collected or that runtime-token savings were measured.
  const runtimeProof = (() => {
    const manifest = installRuntimeManifest("codex", cwd, {
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

    if (manifest.status === "passed") {
      return {
        status: "passed" as const,
        attemptedAt,
        artifactPath: manifest.manifestPath,
        details: [
          `account-context=${account.account}`,
          `account-source=${account.source}`,
          `runtime-manifest=${manifest.manifestPath}`,
          "codex adapter artifacts created",
          "runtime-token-telemetry=not-collected",
        ],
      };
    }

    if (manifest.status === "blocked") {
      return {
        status: "blocked" as const,
        attemptedAt,
        artifactPath: manifest.manifestPath,
        details: [
          "codex adapter artifacts created",
          "runtime-token-telemetry=not-collected",
          `account-source=${account.source}`,
          `runtime-manifest=${manifest.manifestPath}`,
          "runtime-manifest-write-attempted=true",
          `runtime-manifest-error=${manifest.errorMessage}`,
        ],
        blocker: `Codex runtime manifest install failed: ${manifest.errorMessage}`,
      };
    }

    return {
      status: "blocked" as const,
      attemptedAt,
      artifactPath: manifest.manifestPath,
      details: ["codex adapter artifacts created", "runtime-token-telemetry=not-collected", `account-source=${account.source}`, "runtime-manifest-write-attempted=false"],
      blocker: "Codex runtime home not detected",
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
  contextMode: PromptContextPolicy["contextMode"];
  contextModeReason: string;
  contextBudget: PromptContextPolicy["contextBudget"];
  promptSpecificity: PromptContextPolicy["promptSpecificity"];
  contextPolicyVersion: PromptContextPolicy["contextPolicyVersion"];
}

// Prepare context for AI execution - execution is handed off to external runtime
export async function prepareExecutionContext(
  prompt: string,
  contextFiles: string[],
  cwd = process.cwd(),
  contextPolicy: PromptContextPolicy = classifyPromptContext(prompt, cwd),
): Promise<ExecutionContext> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  // Read and combine context files into a temporary context file.
  // Relative paths are resolved against cwd so handoff behavior is stable when
  // callers run fooks from another process directory.
  let totalSize = 0;
  const metadata = {
    contextMode: contextPolicy.contextMode,
    contextModeReason: contextPolicy.contextModeReason,
    contextBudget: contextPolicy.contextBudget,
    promptSpecificity: contextPolicy.promptSpecificity,
    contextPolicyVersion: contextPolicy.contextPolicyVersion,
  };
  let contextContent = `# Context Files\n\n<!-- fooks-context-policy ${JSON.stringify(metadata)} -->\n\n`;

  for (const filePath of contextFiles) {
    try {
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
      const content = fs.readFileSync(resolvedPath, "utf8");
      const size = Buffer.byteLength(content, "utf8");
      totalSize += size;
      contextContent += `## ${path.relative(cwd, resolvedPath) || path.basename(resolvedPath)}\n\n${content}\n\n`;
    } catch (err) {
      console.error(`Failed to read ${filePath}:`, err);
    }
  }

  // Write temporary context file
  const tempContextPath = path.join(cwd, ".fooks", "temp-context.md");
  fs.mkdirSync(path.dirname(tempContextPath), { recursive: true });
  fs.writeFileSync(tempContextPath, contextContent);

  // Adapter contract: handoff command is abstracted, exact invocation not yet standardized
  // This keeps the reduced context reusable across supported coding runtimes such as Codex and Claude.
  const handoffCommand = `[runtime-adapter] ${prompt} --context ${tempContextPath}`;

  return {
    contextPath: tempContextPath,
    fileCount: contextFiles.length,
    totalSize,
    prompt,
    handoffCommand,
    contextMode: contextPolicy.contextMode,
    contextModeReason: contextPolicy.contextModeReason,
    contextBudget: contextPolicy.contextBudget,
    promptSpecificity: contextPolicy.promptSpecificity,
    contextPolicyVersion: contextPolicy.contextPolicyVersion,
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
