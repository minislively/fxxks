import { scanProject } from "../core/scan";
import { extractFile } from "../core/extract";
import { detectAccountContext, finalizeAttach, installRuntimeManifest } from "./shared";
import { completeClaudeInitialScan, initializeClaudeTrustStatus } from "./claude-runtime-trust";
import { defaultClaudeHookCommand } from "./claude-hook-preset";
import { runtimeEscapeHatches } from "./prompt-context";
import type { AttachResult } from "../core/schema";

const CLAUDE_RUNTIME_TOKEN_TELEMETRY_DETAIL = "runtime-token-telemetry=not-collected";
const CLAUDE_RUNTIME_BRIDGE_CLAIM_BOUNDARY =
  "Project-local Claude context hook only; no Claude Read interception or runtime-token savings claim.";

export function attachClaude(sampleFile: string, cwd = process.cwd(), runtimeBridgeCommand = defaultClaudeHookCommand()): AttachResult {
  initializeClaudeTrustStatus(cwd);
  const scan = scanProject(cwd);
  const trustStatus = completeClaudeInitialScan(scan.scannedAt, cwd);
  const sample = extractFile(sampleFile);
  const account = detectAccountContext(cwd);
  const attemptedAt = new Date().toISOString();
  const runtimeProof = (() => {
    const manifest = installRuntimeManifest("claude", cwd, {
      runtimeBridge: {
        command: runtimeBridgeCommand,
        supportedHookEvents: ["SessionStart", "UserPromptSubmit", "Stop"],
        scope: {
          extensions: [".tsx", ".jsx"],
          strategy: "project-local-context-hook",
        },
        escapeHatches: [...runtimeEscapeHatches()],
        claimBoundary: CLAUDE_RUNTIME_BRIDGE_CLAIM_BOUNDARY,
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
          "claude adapter artifacts created",
          CLAUDE_RUNTIME_TOKEN_TELEMETRY_DETAIL,
        ],
      };
    }

    if (manifest.status === "blocked") {
      return {
        status: "blocked" as const,
        attemptedAt,
        artifactPath: manifest.manifestPath,
        details: [
          "claude adapter artifacts created",
          CLAUDE_RUNTIME_TOKEN_TELEMETRY_DETAIL,
          `account-source=${account.source}`,
          `runtime-manifest=${manifest.manifestPath}`,
          "runtime-manifest-write-attempted=true",
          `runtime-manifest-error=${manifest.errorMessage}`,
        ],
        blocker: `Claude runtime manifest install failed: ${manifest.errorMessage}`,
      };
    }

    return {
      status: "blocked" as const,
      attemptedAt,
      artifactPath: manifest.manifestPath,
      details: [
        "claude adapter artifacts created",
        CLAUDE_RUNTIME_TOKEN_TELEMETRY_DETAIL,
        `account-source=${account.source}`,
        "runtime-manifest-write-attempted=false",
      ],
      blocker: "Claude runtime home not detected",
    };
  })();
  return finalizeAttach("claude", sample, runtimeProof, cwd, trustStatus);
}
