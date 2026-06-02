import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  assertReactWebPrAdvisoryContract,
  buildReactWebPrAdvisorySurface,
  renderReactWebPrAdvisoryMarkdown,
} from "../scripts/react-web-pr-advisory-surface.mjs";

const repoRoot = process.cwd();
let evidencePromise;

function getEvidence() {
  evidencePromise ??= buildReactWebPrAdvisorySurface({ runId: `test-${Date.now()}-${Math.random()}` });
  return evidencePromise;
}

test("React Web PR advisory surface stays advisory-only over the existing full profile surface", async () => {
  const evidence = await getEvidence();

  assert.equal(evidence.schemaVersion, "react-web-pr-advisory-surface.v1");
  assert.equal(evidence.advisory, true);
  assert.equal(evidence.status, "advisory");
  assert.equal(evidence.consumer, "pull-request");
  assert.equal(evidence.profile, "react-web");
  assert.equal(evidence.checkName, "React Web PR advisory");
  assert.match(evidence.claimBoundary, /presentation adapter over the existing bounded React Web profile surface/);
  assert.match(evidence.claimBoundary, /does not create a new evidence lane/);
  assert.match(evidence.claimBoundary, /does not change merge policy/);
  assert.match(evidence.claimBoundary, /does not prove cache performance, runtime-token savings, provider cost, billing/);

  assert.equal(evidence.profileSurface.schemaVersion, "react-web-profile-surface.v1");
  assert.deepEqual(Object.keys(evidence.profileSurface.artifacts), [
    "context",
    "reuse",
    "overCachingAudit",
    "stability",
    "mixedRouting",
    "knowledgeContext",
  ]);
  assert.deepEqual(evidence.profileSurface.claimability, {
    contextReduction: false,
    cachePerformance: false,
    providerBillingSavings: false,
  });

  assert.equal(evidence.summary.advisoryOnly, true);
  assert.equal(evidence.summary.profileArtifactCount, 6);
  assert.equal(evidence.summary.liveHookDogfoodCoverage.schemaVersion, "react-web-live-hook-dogfood-fixture-manifest.v1");
  assert.equal(evidence.summary.liveHookDogfoodCoverage.advisoryOnly, true);
  assert.equal(evidence.summary.liveHookDogfoodCoverage.diagnosticOnly, true);
  assert.equal(evidence.summary.liveHookDogfoodCoverage.claimable, false);
  assert.equal(evidence.summary.liveHookDogfoodCoverage.freshnessStatus, "fresh");
  assert.equal(evidence.summary.liveHookDogfoodCoverage.manifestFingerprintAlgorithm, "sha256-json-stable-v1");
  assert.match(evidence.summary.liveHookDogfoodCoverage.manifestFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.liveHookDogfoodCoverage.fixtureSourceFreshnessStatus, "fresh");
  assert.equal(evidence.summary.liveHookDogfoodCoverage.fixtureSourceFingerprintAlgorithm, "sha256-file-set-v1");
  assert.match(evidence.summary.liveHookDogfoodCoverage.fixtureSourceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.liveHookDogfoodCoverage.snapshotDrift.driftStatus, "fresh");
  assert.deepEqual(evidence.summary.liveHookDogfoodCoverage.snapshotDrift.reasons, []);
  assert.equal(evidence.summary.liveHookDogfoodCoverage.fixtureCount, 10);
  assert.deepEqual(evidence.summary.liveHookDogfoodCoverage.missingLabels, []);
  assert.equal(evidence.summary.liveHookDogfoodCoverage.countsByLabel["form-state"], 4);
  assert.match(evidence.summary.liveHookDogfoodCoverage.claimBoundary, /not runtime, pre-read, cache, or model-facing authorization/);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.schemaVersion, "react-web-live-hook-dogfood-metric-summary.v2");
  assert.equal(evidence.summary.liveHookDogfoodMetrics.status, "not-supplied");
  assert.equal(evidence.summary.liveHookDogfoodMetrics.advisoryOnly, true);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.diagnosticOnly, true);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.claimable, false);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.replayExecuted, false);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.metricInterpretation.finalInjectionByteReductionIsCandidateCompressionProof, false);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.metricInterpretation.providerTokenSavingsClaimable, false);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.metricInterpretation.providerCostSavingsClaimable, false);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.metricInterpretation.providerBillingSavingsClaimable, false);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.metricInterpretation.numericPrGateThreshold, false);
  assert.equal(evidence.summary.nonClaims.profileTopLevelContextReduction, false);
  assert.equal(evidence.summary.nonClaims.cachePerformance, false);
  assert.equal(evidence.summary.nonClaims.runtimeTokenSavings, false);
  assert.equal(evidence.summary.nonClaims.providerBillingSavings, false);
  assert.equal(evidence.summary.nonClaims.broadSupport, false);
  assert.match(evidence.summary.releaseSafeHeadline, /React Web same-file reuse is routed correctly/);
});

test("React Web PR advisory markdown keeps advisory wording and explicit non-claims", async () => {
  const evidence = await getEvidence();
  const markdown = renderReactWebPrAdvisoryMarkdown(evidence);

  assert.match(markdown, /# React Web PR advisory/);
  assert.match(markdown, /Advisory only: yes/);
  assert.match(markdown, /Consumer: pull-request/);
  assert.match(markdown, /This advisory does not block merge or release in pass 1/);
  assert.match(markdown, /Cache performance proof: no/);
  assert.match(markdown, /Runtime-token savings proof: no/);
  assert.match(markdown, /Live-hook dogfood coverage snapshot/);
  assert.match(markdown, /Advisory-only: yes/);
  assert.match(markdown, /Fixture count: 10/);
  assert.match(markdown, /Freshness status: fresh/);
  assert.match(markdown, /Manifest fingerprint: [a-f0-9]{12} \(sha256-json-stable-v1\)/);
  assert.match(markdown, /Fixture source freshness: fresh/);
  assert.match(markdown, /Fixture source fingerprint: [a-f0-9]{12} \(sha256-file-set-v1\)/);
  assert.match(markdown, /Snapshot drift status: fresh/);
  assert.match(markdown, /Snapshot drift reasons: none/);
  assert.match(markdown, /Missing labels: none/);
  assert.match(markdown, /Counts by label: .*form-state/);
  assert.match(markdown, /Claim boundary: .*not broad React Web support/);
  assert.match(markdown, /Live-hook dogfood metric summary/);
  assert.match(markdown, /Status: not-supplied/);
  assert.match(markdown, /Replay executed by profile\/advisory: no/);
  assert.match(markdown, /not proof of candidate compression success/);
  assert.match(markdown, /Candidate compression proof from final_injection_byte_reduction: no/);
  assert.match(markdown, /Provider token savings claimable: no/);
  assert.match(markdown, /Provider cost savings claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /Numeric PR gate threshold: no/);
  assert.match(markdown, /Provider billing\/cost savings proof: no/);
  assert.match(markdown, /Broad React\/RN\/WebView\/TUI support proof: no/);
  assert.doesNotMatch(markdown, /Cache performance proof: yes/i);
});

test("React Web PR advisory renders supplied precomputed live hook metrics without replay", async () => {
  const evidence = await buildReactWebPrAdvisorySurface({
    runId: `precomputed-${Date.now()}-${Math.random()}`,
    liveHookDogfoodMetrics: {
      measurement: "built-cli-native-hook-fixture-matrix-additional-context-bytes",
      fixtureCount: 1,
      graphDiagnosticCount: 1,
      runtimeGraphIncludedArtifactCount: 1,
      graphSkippedForBudgetCount: 0,
      admissionObservedCount: 1,
      admittedAdditionalContextCount: 1,
      discardedAdditionalContextCount: 0,
      candidateVariantDistribution: {
        full: 1,
        "no-graph": 0,
        "no-dependencies": 0,
        "targets-roles-hooks": 0,
        "targets-roles": 0,
        "fallback-or-no-candidate": 0,
      },
      candidateVariantDistributionTotalCount: 1,
      metricAliases: {
        candidate_admission_rate: 1,
        candidate_compression_success_rate: 1,
        bad_candidate_block_rate: null,
        fallback_used_rate: 0,
        candidate_byte_reduction: { min: 42, max: 42, avg: 42 },
        final_injection_byte_reduction: { min: 52, max: 52, avg: 52 },
      },
    },
  });
  const markdown = renderReactWebPrAdvisoryMarkdown(evidence);

  assert.equal(evidence.summary.liveHookDogfoodMetrics.status, "supplied");
  assert.equal(evidence.summary.liveHookDogfoodMetrics.replayExecuted, false);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.metricAliases.candidate_admission_rate, 1);
  assert.match(markdown, /candidate_admission_rate: 1/);
  assert.match(markdown, /fallback_used_rate: 0/);
  assert.equal(evidence.summary.liveHookDogfoodMetrics.candidateVariantDistribution.full, 1);
  assert.match(markdown, /candidate_variant_distribution:/);
  assert.match(markdown, /final_injection_byte_reduction: /);
  assert.match(markdown, /Candidate compression proof from final_injection_byte_reduction: no/);
});

test("React Web PR advisory rejects malformed precomputed live hook metrics", async () => {
  await assert.rejects(
    () => buildReactWebPrAdvisorySurface({
      runId: `malformed-${Date.now()}-${Math.random()}`,
      liveHookDogfoodMetrics: {
        fixtureCount: 1,
        graphDiagnosticCount: 1,
        runtimeGraphIncludedArtifactCount: 1,
        graphSkippedForBudgetCount: 0,
        admissionObservedCount: 1,
        admittedAdditionalContextCount: 1,
        discardedAdditionalContextCount: 0,
        candidateVariantDistribution: {
          full: 1,
          "no-graph": 0,
          "no-dependencies": 0,
          "targets-roles-hooks": 0,
          "targets-roles": 0,
          "fallback-or-no-candidate": 0,
        },
        candidateVariantDistributionTotalCount: 1,
        metricAliases: {
          candidate_admission_rate: 1,
          candidate_compression_success_rate: 1,
          bad_candidate_block_rate: null,
          fallback_used_rate: 0,
          final_injection_byte_reduction: { min: 50, max: 50, avg: 50 },
        },
      },
    }),
    /requires distribution alias candidate_byte_reduction/,
  );
});

test("React Web PR advisory contract fails closed on malformed upstream inputs", () => {
  assert.throws(
    () => assertReactWebPrAdvisoryContract({
      profileSurface: {
        schemaVersion: "react-web-profile-surface.v1",
        profile: "react-web",
        artifacts: { context: {} },
        claimability: {
          contextReduction: false,
          cachePerformance: false,
          providerBillingSavings: false,
        },
      },
      releaseBenchmarkEvidence: {
        schemaVersion: "release-benchmark-evidence.v1",
        releaseClaims: { headline: "headline" },
        nonClaims: {
          cachePerformanceImprovement: { claimable: false },
          runtimeTokenSavings: { claimable: false },
          providerBillingSavings: { claimable: false },
        },
      },
    }),
    /profile surface artifact keys changed/,
  );

  assert.throws(
    () => assertReactWebPrAdvisoryContract({
      profileSurface: {
        schemaVersion: "react-web-profile-surface.v1",
        profile: "react-web",
        artifacts: {
          context: {},
          reuse: {},
          overCachingAudit: {},
          stability: {},
          mixedRouting: {},
          knowledgeContext: {},
        },
        claimability: {
          contextReduction: false,
          cachePerformance: false,
          providerBillingSavings: false,
        },
      },
      releaseBenchmarkEvidence: {
        schemaVersion: "release-benchmark-evidence.v1",
        releaseClaims: { headline: "headline" },
        nonClaims: {
          cachePerformanceImprovement: { claimable: true },
          runtimeTokenSavings: { claimable: false },
          providerBillingSavings: { claimable: false },
        },
      },
    }),
    /release benchmark non-claims widened/,
  );
});

test("React Web PR advisory CLI writes bounded JSON and Markdown reports", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-pr-advisory-"));
  const outputPath = path.join(tempDir, "react-web-pr-advisory.json");
  const markdownPath = path.join(tempDir, "react-web-pr-advisory.md");

  const cli = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "react-web-pr-advisory-surface.mjs"),
      "--run-id=cli-test",
      `--output=${outputPath}`,
      `--markdown-output=${markdownPath}`,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(fs.existsSync(markdownPath), true);

  const stdoutEvidence = JSON.parse(cli.stdout);
  const fileEvidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const markdown = fs.readFileSync(markdownPath, "utf8");

  assert.equal(stdoutEvidence.runId, "cli-test");
  assert.equal(stdoutEvidence.status, "advisory");
  assert.deepEqual(stdoutEvidence.summary.artifactKeys, [
    "context",
    "reuse",
    "overCachingAudit",
    "stability",
    "mixedRouting",
    "knowledgeContext",
  ]);
  assert.deepEqual(fileEvidence, stdoutEvidence);
  assert.match(markdown, /# React Web PR advisory/);
  assert.match(markdown, /This advisory does not block merge or release in pass 1/);
});
