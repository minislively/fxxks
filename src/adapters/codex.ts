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

// Execute task via Codex CLI with prepared context
export async function executeViaCodex(
  prompt: string,
  contextFiles: string[],
  cwd = process.cwd(),
): Promise<{ success: boolean; modifiedFiles: string[]; error?: string }> {
  try {
    // Check if codex is available
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFilePromise = promisify(execFile);
    
    // Prepare context as pre-read files
    const contextArgs = contextFiles.flatMap((f) => ["--file", f]);
    
    // Execute codex with prompt and context
    const { stdout, stderr } = await execFilePromise(
      "codex",
      [prompt, ...contextArgs, "--quiet"],
      { cwd, timeout: 120000 },
    );
    
    // Parse output for modified files (simplified - would need actual parsing)
    console.log("Codex output:", stdout);
    if (stderr) console.error("Codex stderr:", stderr);
    
    return {
      success: true,
      modifiedFiles: [], // Would parse from codex output
    };
  } catch (error) {
    return {
      success: false,
      modifiedFiles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
