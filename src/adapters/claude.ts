import { extractFile } from "../core/extract";
import { detectAccountContext, finalizeAttach, installRuntimeManifest } from "./shared";
import type { AttachResult } from "../core/schema";

export function attachClaude(sampleFile: string, cwd = process.cwd()): AttachResult {
  const sample = extractFile(sampleFile);
  const account = detectAccountContext(cwd);
  const attemptedAt = new Date().toISOString();
  const runtimeProof =
    account.account === "expected-account-placeholder"
      ? {
          status: "blocked" as const,
          attemptedAt,
          details: ["claude adapter artifacts created", `detected-account=${account.account}`, `account-source=${account.source}`],
          blocker: "expected account context not detected (configure FOOKS_ACTIVE_ACCOUNT)",
        }
      : (() => {
          const manifestPath = installRuntimeManifest("claude", cwd);
          if (manifestPath) {
            return {
              status: "passed" as const,
              attemptedAt,
              artifactPath: manifestPath,
              details: [`account-context=${account.account}`, `account-source=${account.source}`, `runtime-manifest=${manifestPath}`, "claude adapter artifacts created"],
            };
          }

          return {
            status: "blocked" as const,
            attemptedAt,
            details: ["claude adapter artifacts created", `account-source=${account.source}`, "runtime-manifest-write-attempted=false"],
            blocker: "Claude runtime home not detected",
          };
        })();
  return finalizeAttach("claude", sample, runtimeProof, cwd);
}
