import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReactWebProfileRunnerEvidence, renderReactWebProfileRunnerMarkdown } from "./react-web-profile-runner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");
const SUPPORTED_PROFILES = Object.freeze(["react-web"]);

function parseProfile(argv) {
  const profile = argv.find((arg) => !arg.startsWith("-"));
  if (!profile) {
    throw new Error(`profile name required; supported profiles: ${SUPPORTED_PROFILES.join(", ")}`);
  }
  if (!SUPPORTED_PROFILES.includes(profile)) {
    throw new Error(`unsupported profile '${profile}'; supported profiles: ${SUPPORTED_PROFILES.join(", ")}`);
  }
  return profile;
}

function parseRepeat(argv) {
  const raw = argv.find((arg) => arg.startsWith("--repeat="))?.slice("--repeat=".length);
  if (raw == null) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--repeat must be a positive integer; received ${raw}`);
  }
  return parsed;
}

export async function runBenchProfile({
  repoRoot = defaultRepoRoot,
  argv = process.argv.slice(2),
} = {}) {
  const profile = parseProfile(argv);
  const runId = argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const repeat = parseRepeat(argv);

  if (profile !== "react-web") {
    throw new Error(`unsupported profile '${profile}'; supported profiles: ${SUPPORTED_PROFILES.join(", ")}`);
  }

  const evidence = await buildReactWebProfileRunnerEvidence({
    repoRoot,
    runId,
    ...(repeat ? { repeat } : {}),
  });

  if (outputArg) {
    const outputPath = path.resolve(repoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(repoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebProfileRunnerMarkdown(evidence));
  }

  return evidence;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const evidence = await runBenchProfile();
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
