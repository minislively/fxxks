import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReactWebContextEvidence } from "./react-web-context-evidence.mjs";
import { buildReactWebReuseEvidence } from "./react-web-reuse-evidence.mjs";
import { buildReactWebOverCachingAuditEvidence } from "./react-web-over-caching-audit.mjs";
import { buildReactWebStabilityEvidence } from "./react-web-stability-evidence.mjs";
import { buildReactWebMixedRoutingEvidence } from "./react-web-mixed-routing-evidence.mjs";
import { buildReactWebKnowledgeContextEvidence } from "./react-web-knowledge-context-evidence.mjs";
import { buildReactWebLiveHookDogfoodCoverageSummary } from "./react-web-live-hook-dogfood-evidence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const REACT_WEB_PROFILE_ARTIFACT_KEYS = [
  "context",
  "reuse",
  "overCachingAudit",
  "stability",
  "mixedRouting",
  "knowledgeContext",
];

export function assertReactWebProfileSurfaceContract(evidence) {
  if (evidence?.schemaVersion !== "react-web-profile-surface.v1") {
    throw new Error("React Web profile surface contract broken: schemaVersion is missing or unsupported");
  }
  if (evidence?.profile !== "react-web") {
    throw new Error("React Web profile surface contract broken: profile must stay on react-web");
  }
  if (JSON.stringify(Object.keys(evidence?.artifacts ?? {})) !== JSON.stringify(REACT_WEB_PROFILE_ARTIFACT_KEYS)) {
    throw new Error("React Web profile surface contract broken: artifact keys changed");
  }
  if (evidence?.summary?.artifactCount !== REACT_WEB_PROFILE_ARTIFACT_KEYS.length) {
    throw new Error("React Web profile surface contract broken: artifactCount changed");
  }
  if (JSON.stringify(evidence?.summary?.artifactKeys ?? []) !== JSON.stringify(REACT_WEB_PROFILE_ARTIFACT_KEYS)) {
    throw new Error("React Web profile surface contract broken: summary artifactKeys changed");
  }
}

function prefixedWarnings(prefix, warnings = []) {
  return warnings.map((warning) => `${prefix}: ${warning}`);
}

export async function buildReactWebProfileSurface({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const context = await buildReactWebContextEvidence({ repoRoot, runId: `${runId}-context` });
  const reuse = await buildReactWebReuseEvidence({ repoRoot, runId: `${runId}-reuse` });
  const overCachingAudit = await buildReactWebOverCachingAuditEvidence({ repoRoot, runId: `${runId}-over-caching-audit` });
  const stability = await buildReactWebStabilityEvidence({ repoRoot, runId: `${runId}-stability` });
  const mixedRouting = await buildReactWebMixedRoutingEvidence({ repoRoot, runId: `${runId}-mixed-routing` });
  const knowledgeContext = await buildReactWebKnowledgeContextEvidence({ repoRoot, runId: `${runId}-knowledge-context` });
  const liveHookDogfoodCoverage = buildReactWebLiveHookDogfoodCoverageSummary({ repoRoot });

  const artifacts = {
    context,
    reuse,
    overCachingAudit,
    stability,
    mixedRouting,
    knowledgeContext,
  };

  const evidence = {
    schemaVersion: "react-web-profile-surface.v1",
    generatedAt: new Date().toISOString(),
    runId,
    profile: "react-web",
    measurement: "aggregated-react-web-evidence-lane",
    claimBoundary:
      "Aggregated local React Web evidence lane only: composes six existing bounded React Web evidence artifacts into one execution/reporting surface. This top-level surface does not widen context-reduction, performance, runtime-token, provider-cost, billing, invoice, or charged-cost claims beyond the child artifacts.",
    claimability: {
      contextReduction: false,
      cachePerformance: false,
      providerBillingSavings: false,
    },
    artifacts,
    summary: {
      artifactCount: REACT_WEB_PROFILE_ARTIFACT_KEYS.length,
      artifactKeys: REACT_WEB_PROFILE_ARTIFACT_KEYS,
      reactWebOnly: true,
      contextReductionWidened: false,
      cachePerformanceWidened: false,
      providerBillingSavingsWidened: false,
      childSignals: {
        contextActualInjectedContextReductionClaimable: context.summary.actualInjectedContextReduction.claimable,
        reuseCorrectnessClaimable: reuse.summary.reuseCorrectnessClaimable,
        overCachingAuditVerdictName: overCachingAudit.summary.verdictName,
        overCachingAuditBugReproduced: overCachingAudit.summary.bugReproduced,
        stabilityWarningOnly: stability.summary.primaryMetric.warningOnly,
        mixedRoutingBoundaryIsolationClaimable: mixedRouting.summary.boundaryIsolationClaimable,
        knowledgeContextBoundaryEvidenceClaimable: knowledgeContext.summary.boundaryEvidenceOnlyClaimable,
        liveHookDogfoodCoverage,
      },
      warnings: [
        ...(overCachingAudit.summary.bugReproduced
          ? [`overCachingAudit: ${overCachingAudit.summary.verdictName}`]
          : []),
        ...prefixedWarnings("stability", stability.summary.warnings),
        ...prefixedWarnings("mixedRouting", mixedRouting.summary.warnings),
        ...prefixedWarnings("knowledgeContext", knowledgeContext.summary.warnings),
      ],
    },
  };

  assertReactWebProfileSurfaceContract(evidence);
  return evidence;
}

export function renderReactWebProfileSurfaceMarkdown(evidence) {
  const warnings = evidence.summary.warnings.length > 0 ? evidence.summary.warnings.map((warning) => `- ${warning}`).join("\n") : "- none";
  return `# React Web profile surface

${evidence.claimBoundary}

## Summary

- Profile: ${evidence.profile}
- Artifact count: ${evidence.summary.artifactCount}
- Artifact keys: ${evidence.summary.artifactKeys.join(", ")}
- React Web only: ${evidence.summary.reactWebOnly ? "yes" : "no"}
- Top-level context reduction claim widened: ${evidence.summary.contextReductionWidened ? "yes" : "no"}
- Top-level cache performance claim widened: ${evidence.summary.cachePerformanceWidened ? "yes" : "no"}
- Top-level provider billing savings claim widened: ${evidence.summary.providerBillingSavingsWidened ? "yes" : "no"}

## Child evidence snapshot

- Context actual injected context reduction claimable: ${evidence.summary.childSignals.contextActualInjectedContextReductionClaimable ? "yes" : "no"}
- Reuse correctness claimable: ${evidence.summary.childSignals.reuseCorrectnessClaimable ? "yes" : "no"}
- Over-caching audit verdict: ${evidence.summary.childSignals.overCachingAuditVerdictName}
- Over-caching audit bug reproduced: ${evidence.summary.childSignals.overCachingAuditBugReproduced ? "yes" : "no"}
- Stability warning-only: ${evidence.summary.childSignals.stabilityWarningOnly ? "yes" : "no"}
- Mixed-routing boundary isolation claimable: ${evidence.summary.childSignals.mixedRoutingBoundaryIsolationClaimable ? "yes" : "no"}
- Knowledge-context boundary evidence claimable: ${evidence.summary.childSignals.knowledgeContextBoundaryEvidenceClaimable ? "yes" : "no"}
- Live-hook dogfood coverage advisory-only: ${evidence.summary.childSignals.liveHookDogfoodCoverage.advisoryOnly ? "yes" : "no"} (${evidence.summary.childSignals.liveHookDogfoodCoverage.fixtureCount} fixtures, missing labels: ${evidence.summary.childSignals.liveHookDogfoodCoverage.missingLabels.length > 0 ? evidence.summary.childSignals.liveHookDogfoodCoverage.missingLabels.join(", ") : "none"})
- Live-hook dogfood coverage freshness: ${evidence.summary.childSignals.liveHookDogfoodCoverage.freshnessStatus} (${evidence.summary.childSignals.liveHookDogfoodCoverage.manifestFingerprintAlgorithm}, ${evidence.summary.childSignals.liveHookDogfoodCoverage.manifestFingerprintShort})
- Live-hook dogfood fixture source freshness: ${evidence.summary.childSignals.liveHookDogfoodCoverage.fixtureSourceFreshnessStatus} (${evidence.summary.childSignals.liveHookDogfoodCoverage.fixtureSourceFingerprintAlgorithm}, ${evidence.summary.childSignals.liveHookDogfoodCoverage.fixtureSourceFingerprintShort})
- Live-hook dogfood snapshot drift: ${evidence.summary.childSignals.liveHookDogfoodCoverage.snapshotDrift.driftStatus} (${evidence.summary.childSignals.liveHookDogfoodCoverage.snapshotDrift.reasons.length > 0 ? evidence.summary.childSignals.liveHookDogfoodCoverage.snapshotDrift.reasons.join(", ") : "none"})

## Top-level non-claims

- Context reduction claimable at top level: ${evidence.claimability.contextReduction ? "yes" : "no"}
- Cache performance claimable at top level: ${evidence.claimability.cachePerformance ? "yes" : "no"}
- Provider billing savings claimable at top level: ${evidence.claimability.providerBillingSavings ? "yes" : "no"}

## Warnings

${warnings}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebProfileSurface({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebProfileSurfaceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
