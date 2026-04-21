import { extractFile } from "../core/extract";
import { detectAccountContext, finalizeAttach, installRuntimeManifest } from "./shared";
import type { AttachResult } from "../core/schema";

export function attachClaude(sampleFile: string, cwd = process.cwd()): AttachResult {
  const sample = extractFile(sampleFile);
  const account = detectAccountContext(cwd);
  const attemptedAt = new Date().toISOString();
  const runtimeProof = (() => {
    const manifest = installRuntimeManifest("claude", cwd);
    if (manifest.status === "passed") {
      return {
        status: "passed" as const,
        attemptedAt,
        artifactPath: manifest.manifestPath,
        details: [`account-context=${account.account}`, `account-source=${account.source}`, `runtime-manifest=${manifest.manifestPath}`, "claude adapter artifacts created"],
      };
    }

    if (manifest.status === "blocked") {
      return {
        status: "blocked" as const,
        attemptedAt,
        artifactPath: manifest.manifestPath,
        details: [
          "claude adapter artifacts created",
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
      details: ["claude adapter artifacts created", `account-source=${account.source}`, "runtime-manifest-write-attempted=false"],
      blocker: "Claude runtime home not detected",
    };
  })();
  return finalizeAttach("claude", sample, runtimeProof, cwd);
}
