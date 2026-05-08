import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertReactWebPrAdvisoryContract,
  buildReactWebPrAdvisorySurface,
} from "./react-web-pr-advisory-surface.mjs";
import {
  assertReactWebProfileSurfaceContract,
  REACT_WEB_PROFILE_ARTIFACT_KEYS,
} from "./react-web-profile-surface.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

function exactKeyList(value) {
  return JSON.stringify(value) === JSON.stringify(REACT_WEB_PROFILE_ARTIFACT_KEYS);
}

function pushBlocker(blockers, category, code, message, actual, expected) {
  blockers.push({
    category,
    code,
    message,
    actual: actual ?? null,
    expected: expected ?? null,
  });
}

export function evaluateReactWebPrGate(advisorySurface) {
  const blockers = [];

  try {
    assertReactWebPrAdvisoryContract({
      profileSurface: advisorySurface?.profileSurface,
      releaseBenchmarkEvidence: {
        schemaVersion: "release-benchmark-evidence.v1",
        releaseClaims: {
          headline: advisorySurface?.summary?.releaseSafeHeadline,
        },
        nonClaims: {
          cachePerformanceImprovement: { claimable: advisorySurface?.summary?.nonClaims?.cachePerformance },
          runtimeTokenSavings: { claimable: advisorySurface?.summary?.nonClaims?.runtimeTokenSavings },
          providerBillingSavings: { claimable: advisorySurface?.summary?.nonClaims?.providerBillingSavings },
        },
      },
    });
  } catch (error) {
    pushBlocker(
      blockers,
      "required-artifact-presence",
      "advisory-contract-broken",
      error instanceof Error ? error.message : String(error),
      null,
      "bounded React Web advisory contract",
    );
  }

  const profileSurface = advisorySurface?.profileSurface;

  try {
    assertReactWebProfileSurfaceContract(profileSurface);
  } catch (error) {
    pushBlocker(
      blockers,
      "required-artifact-presence",
      "profile-contract-broken",
      error instanceof Error ? error.message : String(error),
      null,
      "exact approved React Web profile artifact contract",
    );
  }

  if (typeof advisorySurface?.summary?.releaseSafeHeadline !== "string" || advisorySurface.summary.releaseSafeHeadline.length === 0) {
    pushBlocker(
      blockers,
      "required-artifact-presence",
      "missing-release-safe-headline",
      "React Web PR gate requires a non-empty releaseSafeHeadline",
      advisorySurface?.summary?.releaseSafeHeadline ?? null,
      "non-empty string",
    );
  }

  if (profileSurface?.summary?.reactWebOnly !== true) {
    pushBlocker(
      blockers,
      "routing-boundary-leakage",
      "react-web-only-drift",
      "React Web PR gate requires the profile surface to remain React Web-only",
      profileSurface?.summary?.reactWebOnly ?? null,
      true,
    );
  }

  for (const [field, label] of [
    ["contextReductionWidened", "context-reduction claim widening"],
    ["cachePerformanceWidened", "cache-performance claim widening"],
    ["providerBillingSavingsWidened", "provider-billing-savings claim widening"],
  ]) {
    if (profileSurface?.summary?.[field] !== false) {
      pushBlocker(
        blockers,
        "routing-boundary-leakage",
        `${field}-drift`,
        `React Web PR gate requires ${label} to stay disabled`,
        profileSurface?.summary?.[field] ?? null,
        false,
      );
    }
  }

  if (profileSurface?.summary?.childSignals?.mixedRoutingBoundaryIsolationClaimable !== true) {
    pushBlocker(
      blockers,
      "routing-boundary-leakage",
      "mixed-routing-boundary-leakage",
      "React Web PR gate requires mixed-routing boundary isolation to remain claimable",
      profileSurface?.summary?.childSignals?.mixedRoutingBoundaryIsolationClaimable ?? null,
      true,
    );
  }

  if (profileSurface?.summary?.childSignals?.knowledgeContextBoundaryEvidenceClaimable !== true) {
    pushBlocker(
      blockers,
      "routing-boundary-leakage",
      "knowledge-context-boundary-leakage",
      "React Web PR gate requires knowledge-context boundary evidence to remain claimable",
      profileSurface?.summary?.childSignals?.knowledgeContextBoundaryEvidenceClaimable ?? null,
      true,
    );
  }

  for (const [field, expected] of [
    ["advisory", true],
    ["status", "advisory"],
    ["consumer", "pull-request"],
  ]) {
    if (advisorySurface?.[field] !== expected) {
      pushBlocker(
        blockers,
        "advisory-status-inconsistency",
        `${field}-drift`,
        `React Web PR gate requires advisory field '${field}' to remain ${JSON.stringify(expected)}`,
        advisorySurface?.[field] ?? null,
        expected,
      );
    }
  }

  if (advisorySurface?.summary?.advisoryOnly !== true) {
    pushBlocker(
      blockers,
      "advisory-status-inconsistency",
      "advisory-only-drift",
      "React Web PR gate requires the upstream advisory summary to remain advisory-only",
      advisorySurface?.summary?.advisoryOnly ?? null,
      true,
    );
  }

  return {
    passed: blockers.length === 0,
    blockerCategories: [
      "required-artifact-presence",
      "routing-boundary-leakage",
      "advisory-status-inconsistency",
    ],
    blockers,
    protectedArtifacts: REACT_WEB_PROFILE_ARTIFACT_KEYS,
    metricsRemainNonBlocking: true,
    reactWebOnly: profileSurface?.summary?.reactWebOnly === true,
    advisoryStatusRemainsUpstreamOnly:
      advisorySurface?.advisory === true &&
      advisorySurface?.status === "advisory" &&
      advisorySurface?.summary?.advisoryOnly === true,
  };
}

export async function buildReactWebPrGateSurface({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
  advisorySurfaceBuilder = buildReactWebPrAdvisorySurface,
} = {}) {
  const advisorySurface = await advisorySurfaceBuilder({ repoRoot, runId: `${runId}-advisory` });
  const evaluation = evaluateReactWebPrGate(advisorySurface);

  return {
    schemaVersion: "react-web-pr-gate-surface.v1",
    generatedAt: new Date().toISOString(),
    runId,
    profile: "react-web",
    consumer: "pull-request",
    gate: {
      failClosed: true,
      checkName: "React Web PR gate",
      status: evaluation.passed ? "pass" : "fail",
    },
    claimBoundary:
      "Fail-closed protective gate over the existing bounded React Web advisory/profile surfaces only. This gate blocks only on required artifact presence, routing-boundary leakage, and advisory-status inconsistency. It does not introduce metric-threshold blocking and does not widen context-reduction, performance, runtime-token, provider-cost, billing, invoice, or charged-cost claims.",
    advisorySurface,
    summary: {
      blockerCount: evaluation.blockers.length,
      blockerCategories: evaluation.blockerCategories,
      blockers: evaluation.blockers,
      protectedArtifacts: evaluation.protectedArtifacts,
      passed: evaluation.passed,
      metricsRemainNonBlocking: evaluation.metricsRemainNonBlocking,
      reactWebOnly: evaluation.reactWebOnly,
      advisoryStatusRemainsUpstreamOnly: evaluation.advisoryStatusRemainsUpstreamOnly,
      exactArtifactKeys: exactKeyList(advisorySurface?.profileSurface?.summary?.artifactKeys ?? []),
      exactArtifactObjects: exactKeyList(Object.keys(advisorySurface?.profileSurface?.artifacts ?? {})),
    },
  };
}

export function renderReactWebPrGateMarkdown(evidence) {
  const blockers = evidence.summary.blockers.length > 0
    ? evidence.summary.blockers.map((blocker) => `- [${blocker.category}] ${blocker.code}: ${blocker.message}`).join("\n")
    : "- none";

  return `# React Web PR gate

${evidence.claimBoundary}

## Gate status

- Gate status: ${evidence.gate.status}
- Fail-closed: ${evidence.gate.failClosed ? "yes" : "no"}
- Consumer: ${evidence.consumer}
- Profile: ${evidence.profile}
- Protected artifacts: ${evidence.summary.protectedArtifacts.join(", ")}
- Metrics remain non-blocking: ${evidence.summary.metricsRemainNonBlocking ? "yes" : "no"}
- React Web only: ${evidence.summary.reactWebOnly ? "yes" : "no"}
- Upstream advisory status remains advisory-only: ${evidence.summary.advisoryStatusRemainsUpstreamOnly ? "yes" : "no"}

## Blockers

${blockers}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactWebPrGateSurface({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebPrGateMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  if (!evidence.summary.passed) {
    process.exitCode = 1;
  }
}
