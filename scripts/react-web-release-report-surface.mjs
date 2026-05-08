import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertReactWebProfileSurfaceContract,
  buildReactWebProfileSurface,
  REACT_WEB_PROFILE_ARTIFACT_KEYS,
} from "./react-web-profile-surface.mjs";
import {
  buildReleaseBenchmarkEvidence,
  buildReleaseBenchmarkSmokeSummary,
} from "./release-benchmark-evidence.mjs";
import { assertPublicSurfaceClaimBoundaries } from "./release-claim-guards.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

function assertFalseNonClaim(value, label) {
  if (value !== false) {
    throw new Error(`React Web release report contract broken: ${label} widened`);
  }
}

export function assertReactWebReleaseReportContract(evidence) {
  if (evidence?.schemaVersion !== "react-web-release-report-surface.v1") {
    throw new Error("React Web release report contract broken: schemaVersion is missing or unsupported");
  }
  if (evidence?.advisory !== true) {
    throw new Error("React Web release report contract broken: advisory must stay true");
  }
  if (evidence?.status !== "advisory") {
    throw new Error("React Web release report contract broken: status must stay advisory");
  }
  if (evidence?.consumer !== "release") {
    throw new Error("React Web release report contract broken: consumer must stay on release");
  }
  if (evidence?.profile !== "react-web") {
    throw new Error("React Web release report contract broken: profile must stay on react-web");
  }
  if (evidence?.checkName !== "React Web release report") {
    throw new Error("React Web release report contract broken: checkName changed");
  }
  assertReactWebProfileSurfaceContract(evidence?.profileSurface);
  if (evidence?.releaseBenchmarkEvidence?.schemaVersion !== "release-benchmark-evidence.v1") {
    throw new Error("React Web release report contract broken: release benchmark schema changed");
  }
  if (JSON.stringify(evidence?.summary?.artifactKeys ?? []) !== JSON.stringify(REACT_WEB_PROFILE_ARTIFACT_KEYS)) {
    throw new Error("React Web release report contract broken: profile surface artifact keys changed");
  }
  if (evidence?.summary?.profileArtifactCount !== REACT_WEB_PROFILE_ARTIFACT_KEYS.length) {
    throw new Error("React Web release report contract broken: profile artifact count changed");
  }
  assertFalseNonClaim(evidence?.profileSurface?.claimability?.contextReduction, "profile top-level context reduction");
  assertFalseNonClaim(evidence?.profileSurface?.claimability?.cachePerformance, "profile cache performance");
  assertFalseNonClaim(evidence?.profileSurface?.claimability?.providerBillingSavings, "profile provider billing savings");
  assertFalseNonClaim(
    evidence?.releaseBenchmarkEvidence?.nonClaims?.cachePerformanceImprovement?.claimable,
    "release benchmark cache performance non-claims",
  );
  assertFalseNonClaim(
    evidence?.releaseBenchmarkEvidence?.nonClaims?.runtimeTokenSavings?.claimable,
    "release benchmark runtime-token non-claims",
  );
  assertFalseNonClaim(
    evidence?.releaseBenchmarkEvidence?.nonClaims?.providerBillingSavings?.claimable,
    "release benchmark provider billing non-claims",
  );
  assertFalseNonClaim(evidence?.summary?.nonClaims?.profileTopLevelContextReduction, "summary profile top-level context reduction");
  assertFalseNonClaim(evidence?.summary?.nonClaims?.cachePerformance, "summary cache performance");
  assertFalseNonClaim(evidence?.summary?.nonClaims?.runtimeTokenSavings, "summary runtime-token savings");
  assertFalseNonClaim(evidence?.summary?.nonClaims?.providerBillingSavings, "summary provider billing savings");
  assertFalseNonClaim(evidence?.summary?.nonClaims?.broadSupport, "summary broad support");
  if (typeof evidence?.summary?.releaseSafeHeadline !== "string" || evidence.summary.releaseSafeHeadline.trim().length === 0) {
    throw new Error("React Web release report contract broken: release-safe headline is required");
  }
  assertPublicSurfaceClaimBoundaries({
    "react-web-release-report headline": evidence.summary.releaseSafeHeadline,
    "react-web-release-report claimBoundary": evidence.claimBoundary,
    "react-web-release-report markdown": renderReactWebReleaseReportMarkdown(evidence),
  });
}

export async function buildReactWebReleaseReportSurface({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const profileSurface = await buildReactWebProfileSurface({ repoRoot, runId: `${runId}-profile` });
  const releaseBenchmarkEvidence = await buildReleaseBenchmarkEvidence({ repoRoot, runId: `${runId}-release-benchmark` });
  const releaseBenchmarkSummary = buildReleaseBenchmarkSmokeSummary(releaseBenchmarkEvidence);

  const evidence = {
    schemaVersion: "react-web-release-report-surface.v1",
    generatedAt: new Date().toISOString(),
    runId,
    advisory: true,
    status: "advisory",
    consumer: "release",
    profile: "react-web",
    checkName: "React Web release report",
    measurement: "release-facing-react-web-consumption-surface",
    claimBoundary:
      "Release-facing presentation adapter over the existing bounded React Web profile surface and release-benchmark evidence only. This surface does not create a new evidence lane, does not change merge or release gate policy, and does not prove cache performance, runtime-token savings, provider cost, billing, invoice, charged-cost, or broad frontend support.",
    profileSurface,
    releaseBenchmarkEvidence,
    releaseBenchmarkSummary,
    summary: {
      advisoryOnly: true,
      profileArtifactCount: profileSurface.summary.artifactCount,
      artifactKeys: profileSurface.summary.artifactKeys,
      releaseSafeHeadline: releaseBenchmarkSummary.headline,
      npmUpdateClaimable: releaseBenchmarkSummary.npmUpdateClaimable,
      releaseProvenanceClaimable: releaseBenchmarkSummary.releaseProvenance.claimable,
      reactWebOnly: profileSurface.summary.reactWebOnly,
      profileWarnings: profileSurface.summary.warnings,
      nonClaims: {
        profileTopLevelContextReduction: profileSurface.claimability.contextReduction,
        cachePerformance: releaseBenchmarkEvidence.nonClaims.cachePerformanceImprovement.claimable,
        runtimeTokenSavings: releaseBenchmarkEvidence.nonClaims.runtimeTokenSavings.claimable,
        providerBillingSavings: releaseBenchmarkEvidence.nonClaims.providerBillingSavings.claimable,
        broadSupport: false,
      },
    },
  };

  assertReactWebReleaseReportContract(evidence);
  return evidence;
}

export function renderReactWebReleaseReportMarkdown(evidence) {
  const warnings = evidence.summary.profileWarnings.length > 0 ? evidence.summary.profileWarnings.map((warning) => `- ${warning}`).join("\n") : "- none";
  return `# React Web release report

${evidence.claimBoundary}

## Summary

- Advisory only: ${evidence.advisory ? "yes" : "no"}
- Consumer: ${evidence.consumer}
- Profile: ${evidence.profile}
- Release-safe headline: ${evidence.summary.releaseSafeHeadline}
- npm update wording claimable: ${evidence.summary.npmUpdateClaimable ? "yes" : "no"}
- Release provenance claimable: ${evidence.summary.releaseProvenanceClaimable ? "yes" : "no"}
- React Web artifact count: ${evidence.summary.profileArtifactCount}
- Artifact keys: ${evidence.summary.artifactKeys.join(", ")}
- React Web only: ${evidence.summary.reactWebOnly ? "yes" : "no"}

## Non-claims

- Profile top-level context reduction proof: ${evidence.summary.nonClaims.profileTopLevelContextReduction ? "yes" : "no"}
- Cache performance proof: ${evidence.summary.nonClaims.cachePerformance ? "yes" : "no"}
- Runtime-token savings proof: ${evidence.summary.nonClaims.runtimeTokenSavings ? "yes" : "no"}
- Provider billing/cost savings proof: ${evidence.summary.nonClaims.providerBillingSavings ? "yes" : "no"}
- Broad React/RN/WebView/TUI support proof: ${evidence.summary.nonClaims.broadSupport ? "yes" : "no"}

## Profile warnings

${warnings}

## Release provenance snapshot

- Status: ${evidence.releaseBenchmarkSummary.releaseProvenance.status}
- Package: ${evidence.releaseBenchmarkSummary.releaseProvenance.package.name}@${evidence.releaseBenchmarkSummary.releaseProvenance.package.version}
- Expected tag: ${evidence.releaseBenchmarkSummary.releaseProvenance.package.expectedVersionTag}

This report stays read-only in pass 1. It does not block merge or release, and it does not widen React Web evidence into performance, runtime-token, provider-cost, billing, invoice, charged-cost, or broad-support claims.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebReleaseReportSurface({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebReleaseReportMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
