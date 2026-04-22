import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { adapterDir, canonicalProjectDataDir, ensureProjectDataDirs } from "../core/paths";
import type { AttachResult, ClaudeTrustStatus, CodexTrustStatus, ExtractionResult } from "../core/schema";

type AccountDetection = {
  account: string;
  source: "env" | "config" | "git-remote" | "package-repository" | "unknown";
};

export type RuntimeManifestInstallResult =
  | {
      status: "missing";
      home: string;
      manifestPath: string;
    }
  | {
      status: "blocked";
      home: string;
      manifestPath: string;
      errorMessage: string;
    }
  | {
      status: "passed";
      home: string;
      manifestPath: string;
    };

function extractGithubOwner(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  const match = normalized.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match?.[1] ?? null;
}

function configAccount(cwd: string): string | null {
  const configFile = path.join(canonicalProjectDataDir(cwd), "config.json");
  if (!fs.existsSync(configFile)) return null;
  const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as { targetAccount?: string };
  return config.targetAccount ?? null;
}

function gitRemoteAccount(cwd: string): string | null {
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return extractGithubOwner(remote);
  } catch {
    return null;
  }
}

function packageRepositoryAccount(cwd: string): string | null {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { repository?: string | { url?: string } };
  const repoValue = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  return extractGithubOwner(repoValue);
}

export function detectAccountContext(cwd = process.cwd()): AccountDetection {
  const envAccount = process.env.FOOKS_ACTIVE_ACCOUNT?.trim();
  if (envAccount) {
    return { account: envAccount, source: "env" };
  }

  const configuredAccount = configAccount(cwd);
  if (configuredAccount && !isPlaceholderAccount(configuredAccount)) {
    return { account: configuredAccount, source: "config" };
  }

  const remoteAccount = gitRemoteAccount(cwd);
  if (remoteAccount) {
    return { account: remoteAccount, source: "git-remote" };
  }

  const repositoryAccount = packageRepositoryAccount(cwd);
  if (repositoryAccount) {
    return { account: repositoryAccount, source: "package-repository" };
  }

  return { account: "unknown", source: "unknown" };
}

export function isPlaceholderAccount(account: string): boolean {
  return account === "expected-account-placeholder" || account === "<your-github-org>";
}

export function accountContext(cwd = process.cwd()): string {
  return detectAccountContext(cwd).account;
}

export function contractProof(sample: ExtractionResult): { passed: boolean; details: string[] } {
  const details: string[] = [];
  if (sample.filePath) details.push("filePath");
  if (sample.fileHash) details.push("fileHash");
  if (["raw", "compressed", "hybrid"].includes(sample.mode)) details.push("mode");
  if (Array.isArray(sample.exports)) details.push("exports");
  if (sample.meta?.generatedAt) details.push("meta.generatedAt");
  return { passed: details.length >= 5, details };
}

export function writeAdapterFiles(runtime: "codex" | "claude", cwd = process.cwd()): string[] {
  ensureProjectDataDirs(cwd);
  const dir = adapterDir(runtime, cwd);
  fs.mkdirSync(dir, { recursive: true });
  const files = [
    path.join(dir, "adapter.json"),
    path.join(dir, "context-template.md"),
  ];
  fs.writeFileSync(files[0], JSON.stringify({ runtime, installedAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(files[1], `# ${runtime} adapter\n\nUse fooks output as pre-read context before opening the full source file.\n`);
  return files;
}

export function runtimeHome(runtime: "codex" | "claude"): string {
  const override = runtime === "codex" ? process.env.FOOKS_CODEX_HOME : process.env.FOOKS_CLAUDE_HOME;
  if (override) {
    return override;
  }
  return path.join(os.homedir(), runtime === "codex" ? ".codex" : ".claude");
}

export function runtimeManifestPath(runtime: "codex" | "claude", cwd = process.cwd()): { home: string; manifestPath: string } {
  const home = runtimeHome(runtime);
  const projectName = path.basename(cwd).replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  return {
    home,
    manifestPath: path.join(home, "fooks", "attachments", `${projectName}.json`),
  };
}

export function installRuntimeManifest(
  runtime: "codex" | "claude",
  cwd = process.cwd(),
  metadata: Record<string, unknown> = {},
): RuntimeManifestInstallResult {
  const { home, manifestPath } = runtimeManifestPath(runtime, cwd);

  if (!fs.existsSync(home)) {
    return { status: "missing", home, manifestPath };
  }

  const manifestBody = JSON.stringify(
    {
      runtime,
      projectRoot: cwd,
      installedAt: new Date().toISOString(),
      ...metadata,
    },
    null,
    2,
  );

  try {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, manifestBody);
    return { status: "passed", home, manifestPath };
  } catch (error) {
    return {
      status: "blocked",
      home,
      manifestPath,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export function finalizeAttach(
  runtime: "codex" | "claude",
  sample: ExtractionResult,
  runtimeProof: AttachResult["runtimeProof"],
  cwd = process.cwd(),
  trustStatus?: CodexTrustStatus | ClaudeTrustStatus,
): AttachResult {
  return {
    runtime,
    accountContext: accountContext(cwd),
    filesCreated: writeAdapterFiles(runtime, cwd).map((file) => path.relative(cwd, file)),
    contractProof: contractProof(sample),
    runtimeProof,
    trustStatus,
  };
}
