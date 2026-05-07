import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(__filename), "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function defaultGit(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function optionalGit(repoRoot, args, runGit = defaultGit) {
  try {
    return { ok: true, value: runGit(repoRoot, args) };
  } catch (error) {
    return { ok: false, value: "", error: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function githubReleaseUrl(repository, tagName) {
  return repository && tagName ? `https://github.com/${repository}/releases/tag/${encodeURIComponent(tagName)}` : null;
}

export function buildReleaseProvenance({ repoRoot = defaultRepoRoot, env = process.env, runGit = defaultGit } = {}) {
  const pkg = readJson(path.join(repoRoot, "package.json"));
  const commit = optionalGit(repoRoot, ["rev-parse", "HEAD"], runGit);
  const exactTags = optionalGit(repoRoot, ["tag", "--points-at", "HEAD"], runGit);
  const expectedVersionTag = `v${pkg.version}`;
  const tagsAtHead = normalizeLines(exactTags.value);
  const versionTagPresent = tagsAtHead.includes(expectedVersionTag);
  const repository = env.GITHUB_REPOSITORY || null;
  const blockers = [];

  if (!commit.ok || !commit.value) blockers.push("git commit SHA unavailable");
  if (!exactTags.ok) blockers.push("git tags at HEAD unavailable");
  if (!versionTagPresent) blockers.push(`${expectedVersionTag} does not point at HEAD`);

  const releaseUrl = githubReleaseUrl(repository, expectedVersionTag);
  const status = blockers.length === 0 ? "release-provenance-ready" : "release-provenance-blocked";

  return {
    schemaVersion: "release-provenance.v1",
    generatedAt: new Date().toISOString(),
    status,
    claimable: blockers.length === 0,
    blockers,
    package: {
      name: pkg.name,
      version: pkg.version,
      expectedVersionTag,
    },
    git: {
      commitSha: commit.value || null,
      tagsAtHead,
      versionTagPresent,
    },
    github: {
      repository,
      releaseUrl,
      releaseStatus: releaseUrl ? "release-url-derived-from-version-tag" : "repository-unavailable",
    },
    claimBoundary:
      "Release provenance only: ties local smoke evidence to package version, git commit, and exact version tag; it does not publish, tag, mutate releases, or claim provider billing, runtime-token, latency, or broad performance results.",
  };
}

export function assertReleaseProvenanceGate(provenance) {
  if (provenance?.claimable === true) return;
  throw new Error(`release provenance gate failed: ${(provenance?.blockers || ["unknown blocker"]).join("; ")}`);
}

export function renderReleaseProvenanceMarkdown(provenance) {
  return `# Release provenance\n\n${provenance.claimBoundary}\n\n- status: ${provenance.status}\n- package: ${provenance.package.name}@${provenance.package.version}\n- expected tag: ${provenance.package.expectedVersionTag}\n- commit: ${provenance.git.commitSha || "unavailable"}\n- tags at HEAD: ${provenance.git.tagsAtHead.length > 0 ? provenance.git.tagsAtHead.join(", ") : "none"}\n- GitHub release URL: ${provenance.github.releaseUrl || "unavailable"}\n- claimable: ${provenance.claimable ? "yes" : "no"}\n\n## Blockers\n\n${provenance.blockers.length > 0 ? provenance.blockers.map((blocker) => `- ${blocker}`).join("\n") : "- none"}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const provenance = buildReleaseProvenance({ repoRoot: defaultRepoRoot });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(provenance, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReleaseProvenanceMarkdown(provenance));
  }

  process.stdout.write(`${JSON.stringify(provenance, null, 2)}\n`);
}
