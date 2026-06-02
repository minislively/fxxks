import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReactWebProfileSurface,
  REACT_WEB_PROFILE_ARTIFACT_KEYS,
} from "./react-web-profile-surface.mjs";
import {
  buildReleaseBenchmarkEvidence,
  buildReleaseBenchmarkSmokeSummary,
} from "./release-benchmark-evidence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export function assertReactWebPrAdvisoryContract({ profileSurface, releaseBenchmarkEvidence }) {
  if (profileSurface?.schemaVersion !== "react-web-profile-surface.v1") {
    throw new Error("React Web PR advisory contract broken: profile surface schemaVersion is missing or unsupported");
  }
  if (profileSurface?.profile !== "react-web") {
    throw new Error("React Web PR advisory contract broken: profile surface must stay on react-web");
  }
  if (JSON.stringify(Object.keys(profileSurface?.artifacts ?? {})) !== JSON.stringify(REACT_WEB_PROFILE_ARTIFACT_KEYS)) {
    throw new Error("React Web PR advisory contract broken: profile surface artifact keys changed");
  }
  if (profileSurface?.claimability?.contextReduction !== false
    || profileSurface?.claimability?.cachePerformance !== false
    || profileSurface?.claimability?.providerBillingSavings !== false) {
    throw new Error("React Web PR advisory contract broken: profile surface top-level claimability widened");
  }

  if (releaseBenchmarkEvidence?.schemaVersion !== "release-benchmark-evidence.v1") {
    throw new Error("React Web PR advisory contract broken: release benchmark schemaVersion is missing or unsupported");
  }
  if (typeof releaseBenchmarkEvidence?.releaseClaims?.headline !== "string" || releaseBenchmarkEvidence.releaseClaims.headline.length === 0) {
    throw new Error("React Web PR advisory contract broken: release benchmark headline is missing");
  }
  if (releaseBenchmarkEvidence?.nonClaims?.cachePerformanceImprovement?.claimable !== false
    || releaseBenchmarkEvidence?.nonClaims?.runtimeTokenSavings?.claimable !== false
    || releaseBenchmarkEvidence?.nonClaims?.providerBillingSavings?.claimable !== false) {
    throw new Error("React Web PR advisory contract broken: release benchmark non-claims widened");
  }
}

export async function buildReactWebPrAdvisorySurface({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
  liveHookDogfoodMetrics,
  profileSurfaceBuilder = buildReactWebProfileSurface,
  releaseBenchmarkBuilder = buildReleaseBenchmarkEvidence,
} = {}) {
  const profileSurface = await profileSurfaceBuilder({ repoRoot, runId: `${runId}-profile`, liveHookDogfoodMetrics });
  const releaseBenchmarkEvidence = await releaseBenchmarkBuilder({ repoRoot, runId: `${runId}-release-benchmark` });

  assertReactWebPrAdvisoryContract({ profileSurface, releaseBenchmarkEvidence });

  const releaseBenchmarkSummary = buildReleaseBenchmarkSmokeSummary(releaseBenchmarkEvidence);
  const liveHookDogfoodCoverage = profileSurface.summary.childSignals.liveHookDogfoodCoverage;
  const liveHookDogfoodMetricsSummary = profileSurface.summary.childSignals.liveHookDogfoodMetrics;

  return {
    schemaVersion: "react-web-pr-advisory-surface.v1",
    generatedAt: new Date().toISOString(),
    runId,
    advisory: true,
    consumer: "pull-request",
    status: "advisory",
    checkName: "React Web PR advisory",
    profile: "react-web",
    claimBoundary:
      "PR-facing advisory summary only: presentation adapter over the existing bounded React Web profile surface. This check does not create a new evidence lane, does not change merge policy, and does not prove cache performance, runtime-token savings, provider cost, billing, invoice, charged-cost, or broad multi-domain support claims.",
    profileSurface,
    releaseBenchmarkSummary,
    summary: {
      advisoryOnly: true,
      profileArtifactCount: profileSurface.summary.artifactCount,
      artifactKeys: profileSurface.summary.artifactKeys,
      childSignals: profileSurface.summary.childSignals,
      warningCount: profileSurface.summary.warnings.length,
      warnings: profileSurface.summary.warnings,
      releaseSafeHeadline: releaseBenchmarkSummary.headline,
      liveHookDogfoodCoverage,
      liveHookDogfoodMetrics: liveHookDogfoodMetricsSummary,
      nonClaims: {
        profileTopLevelContextReduction: profileSurface.claimability.contextReduction,
        cachePerformance: releaseBenchmarkSummary.nonClaims.cachePerformanceImprovement,
        runtimeTokenSavings: releaseBenchmarkSummary.nonClaims.runtimeTokenSavings,
        providerBillingSavings: releaseBenchmarkSummary.nonClaims.providerBillingSavings,
        broadSupport: false,
      },
    },
  };
}

export function renderReactWebPrAdvisoryMarkdown(evidence) {
  const warnings = evidence.summary.warnings.length > 0
    ? evidence.summary.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- none";

  return `# React Web PR advisory

${evidence.claimBoundary}

## Advisory status

- Advisory only: ${evidence.summary.advisoryOnly ? "yes" : "no"}
- Consumer: ${evidence.consumer}
- Check name: ${evidence.checkName}
- Profile: ${evidence.profile}
- Artifact count: ${evidence.summary.profileArtifactCount}
- Artifact keys: ${evidence.summary.artifactKeys.join(", ")}
- Release-safe headline: ${evidence.summary.releaseSafeHeadline}

## Child evidence snapshot

- Context actual injected context reduction claimable inside child evidence: ${evidence.summary.childSignals.contextActualInjectedContextReductionClaimable ? "yes" : "no"}
- Reuse correctness claimable inside child evidence: ${evidence.summary.childSignals.reuseCorrectnessClaimable ? "yes" : "no"}
- Over-caching audit verdict: ${evidence.summary.childSignals.overCachingAuditVerdictName}
- Stability warning-only: ${evidence.summary.childSignals.stabilityWarningOnly ? "yes" : "no"}
- Mixed-routing boundary isolation claimable: ${evidence.summary.childSignals.mixedRoutingBoundaryIsolationClaimable ? "yes" : "no"}
- Knowledge-context boundary evidence claimable: ${evidence.summary.childSignals.knowledgeContextBoundaryEvidenceClaimable ? "yes" : "no"}

## Live-hook dogfood coverage snapshot

- Advisory-only: ${evidence.summary.liveHookDogfoodCoverage.advisoryOnly ? "yes" : "no"}
- Diagnostic-only: ${evidence.summary.liveHookDogfoodCoverage.diagnosticOnly ? "yes" : "no"}
- Fixture count: ${evidence.summary.liveHookDogfoodCoverage.fixtureCount}
- Freshness status: ${evidence.summary.liveHookDogfoodCoverage.freshnessStatus}
- Manifest fingerprint: ${evidence.summary.liveHookDogfoodCoverage.manifestFingerprintShort} (${evidence.summary.liveHookDogfoodCoverage.manifestFingerprintAlgorithm})
- Fixture source freshness: ${evidence.summary.liveHookDogfoodCoverage.fixtureSourceFreshnessStatus}
- Fixture source fingerprint: ${evidence.summary.liveHookDogfoodCoverage.fixtureSourceFingerprintShort} (${evidence.summary.liveHookDogfoodCoverage.fixtureSourceFingerprintAlgorithm})
- Snapshot drift status: ${evidence.summary.liveHookDogfoodCoverage.snapshotDrift.driftStatus}
- Snapshot drift reasons: ${evidence.summary.liveHookDogfoodCoverage.snapshotDrift.reasons.length > 0 ? evidence.summary.liveHookDogfoodCoverage.snapshotDrift.reasons.join(", ") : "none"}
- Required labels: ${evidence.summary.liveHookDogfoodCoverage.requiredLabels.join(", ")}
- Missing labels: ${evidence.summary.liveHookDogfoodCoverage.missingLabels.length > 0 ? evidence.summary.liveHookDogfoodCoverage.missingLabels.join(", ") : "none"}
- Counts by label: ${JSON.stringify(evidence.summary.liveHookDogfoodCoverage.countsByLabel)}
- Counts by role: ${JSON.stringify(evidence.summary.liveHookDogfoodCoverage.countsByRole)}
- Claim boundary: ${evidence.summary.liveHookDogfoodCoverage.claimBoundary}

## Live-hook dogfood metric summary

- Status: ${evidence.summary.liveHookDogfoodMetrics.status}
- Schema: ${evidence.summary.liveHookDogfoodMetrics.schemaVersion}
- Advisory-only: ${evidence.summary.liveHookDogfoodMetrics.advisoryOnly ? "yes" : "no"}
- Diagnostic-only: ${evidence.summary.liveHookDogfoodMetrics.diagnosticOnly ? "yes" : "no"}
- Claimable: ${evidence.summary.liveHookDogfoodMetrics.claimable ? "yes" : "no"}
- Replay executed by profile/advisory: ${evidence.summary.liveHookDogfoodMetrics.replayExecuted ? "yes" : "no"}
${evidence.summary.liveHookDogfoodMetrics.status === "supplied" ? `- candidate_admission_rate: ${evidence.summary.liveHookDogfoodMetrics.metricAliases.candidate_admission_rate}
- candidate_compression_success_rate: ${evidence.summary.liveHookDogfoodMetrics.metricAliases.candidate_compression_success_rate}
- bad_candidate_block_rate: ${evidence.summary.liveHookDogfoodMetrics.metricAliases.bad_candidate_block_rate}
- fallback_used_rate: ${evidence.summary.liveHookDogfoodMetrics.metricAliases.fallback_used_rate}
- candidate_byte_reduction: ${JSON.stringify(evidence.summary.liveHookDogfoodMetrics.metricAliases.candidate_byte_reduction)}
- final_injection_byte_reduction: ${JSON.stringify(evidence.summary.liveHookDogfoodMetrics.metricAliases.final_injection_byte_reduction)}
- candidate_variant_distribution: ${JSON.stringify(evidence.summary.liveHookDogfoodMetrics.candidateVariantDistribution)}
- candidate_variant_distribution_total: ${evidence.summary.liveHookDogfoodMetrics.candidateVariantDistributionTotalCount}` : `- Reason: ${evidence.summary.liveHookDogfoodMetrics.reason}`}
- Note: final_injection_byte_reduction is final hook-output size after admission/fallback and is not proof of candidate compression success.
- Candidate compression proof from final_injection_byte_reduction: ${evidence.summary.liveHookDogfoodMetrics.metricInterpretation.finalInjectionByteReductionIsCandidateCompressionProof ? "yes" : "no"}
- Provider token savings claimable: ${evidence.summary.liveHookDogfoodMetrics.metricInterpretation.providerTokenSavingsClaimable ? "yes" : "no"}
- Provider cost savings claimable: ${evidence.summary.liveHookDogfoodMetrics.metricInterpretation.providerCostSavingsClaimable ? "yes" : "no"}
- Provider billing savings claimable: ${evidence.summary.liveHookDogfoodMetrics.metricInterpretation.providerBillingSavingsClaimable ? "yes" : "no"}
- Numeric PR gate threshold: ${evidence.summary.liveHookDogfoodMetrics.metricInterpretation.numericPrGateThreshold ? "yes" : "no"}

## Non-claims

- This advisory does not block merge or release in pass 1.
- Profile top-level context reduction claim widened: ${evidence.summary.nonClaims.profileTopLevelContextReduction ? "yes" : "no"}
- Cache performance proof: ${evidence.summary.nonClaims.cachePerformance ? "yes" : "no"}
- Runtime-token savings proof: ${evidence.summary.nonClaims.runtimeTokenSavings ? "yes" : "no"}
- Provider billing/cost savings proof: ${evidence.summary.nonClaims.providerBillingSavings ? "yes" : "no"}
- Broad React/RN/WebView/TUI support proof: ${evidence.summary.nonClaims.broadSupport ? "yes" : "no"}

## Warnings

${warnings}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebPrAdvisorySurface({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebPrAdvisoryMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
