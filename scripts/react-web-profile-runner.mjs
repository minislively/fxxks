import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReactWebContextEvidence } from "./react-web-context-evidence.mjs";
import { buildReactWebReuseEvidence } from "./react-web-reuse-evidence.mjs";
import { buildReactWebOverCachingAuditEvidence } from "./react-web-over-caching-audit.mjs";
import { buildReactWebStabilityEvidence } from "./react-web-stability-evidence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");
const DEFAULT_REPEAT = 5;

function parseRepeat(argv) {
  const raw = argv.find((arg) => arg.startsWith("--repeat="))?.slice("--repeat=".length);
  if (raw == null) return DEFAULT_REPEAT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--repeat must be a positive integer; received ${raw}`);
  }
  return parsed;
}

export async function buildReactWebProfileRunnerEvidence({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
  repeat = DEFAULT_REPEAT,
} = {}) {
  const context = await buildReactWebContextEvidence({ repoRoot, runId: `${runId}-context` });
  const reuse = await buildReactWebReuseEvidence({ repoRoot, runId: `${runId}-reuse` });
  const overCachingAudit = await buildReactWebOverCachingAuditEvidence({ repoRoot, runId: `${runId}-audit` });
  const stability = await buildReactWebStabilityEvidence({ repoRoot, runId: `${runId}-stability`, repeat });

  return {
    schemaVersion: "react-web-profile-runner.v1",
    profile: "react-web",
    generatedAt: new Date().toISOString(),
    runId,
    measurement: "react-web-evidence-profile-aggregation",
    claimBoundary:
      "Local React Web evidence aggregation only: this bench:profile surface aggregates bounded React Web evidence artifacts. It is not benchmark/profiler semantics, not cache-hit-rate proof, not wall-clock performance proof, not runtime-token savings proof, and not provider cost, billing, invoice, or charged-cost evidence.",
    claimability: {
      contextReduction: true,
      cachePerformance: false,
      providerBillingSavings: false,
    },
    artifacts: {
      context,
      reuse,
      overCachingAudit,
      stability,
    },
    summary: {
      contextReductionClaimable: context.summary.actualInjectedContextReduction.claimable,
      reuseCorrectnessClaimable: reuse.summary.reuseCorrectnessClaimable,
      overCachingNoRepro: overCachingAudit.summary.verdict === "no-repro",
      stabilityStable: stability.summary.primaryMetric.stable,
      primaryMetric: {
        ...stability.summary.primaryMetric,
      },
      warnings: [...stability.summary.warnings],
    },
  };
}

export function renderReactWebProfileRunnerMarkdown(evidence) {
  const warnings = evidence.summary.warnings.length > 0 ? evidence.summary.warnings.map((warning) => `- ${warning}`).join("\n") : "- none";

  return `# React Web profile runner\n\n${evidence.claimBoundary}\n\n## Summary\n\n- Profile: ${evidence.profile}\n- Context reduction claimable: ${evidence.claimability.contextReduction ? "yes" : "no"}\n- Cache performance claimable: no\n- Provider billing savings claimable: no\n- Reuse correctness claimable: ${evidence.summary.reuseCorrectnessClaimable ? "yes" : "no"}\n- Over-caching no-repro: ${evidence.summary.overCachingNoRepro ? "yes" : "no"}\n- Stability stable: ${evidence.summary.stabilityStable ? "yes" : "no"}\n- Primary metric: ${evidence.summary.primaryMetric.metric}\n- Primary metric observed range: ${evidence.summary.primaryMetric.minObservedPct}% to ${evidence.summary.primaryMetric.maxObservedPct}%\n\n## Nested artifacts\n\n- context: ${evidence.artifacts.context.schemaVersion}\n- reuse: ${evidence.artifacts.reuse.schemaVersion}\n- overCachingAudit: ${evidence.artifacts.overCachingAudit.schemaVersion}\n- stability: ${evidence.artifacts.stability.schemaVersion}\n\n## Warnings\n\n${warnings}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const repeat = parseRepeat(process.argv.slice(2));
  const evidence = await buildReactWebProfileRunnerEvidence({ repoRoot: defaultRepoRoot, runId, repeat });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebProfileRunnerMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
