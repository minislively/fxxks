import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  assertReactWebProfileSurfaceContract,
  buildReactWebProfileSurface,
  REACT_WEB_PROFILE_ARTIFACT_KEYS,
  renderReactWebProfileSurfaceMarkdown,
} from "../scripts/react-web-profile-surface.mjs";

const repoRoot = process.cwd();
let evidencePromise;

function getEvidence() {
  evidencePromise ??= buildReactWebProfileSurface({ runId: `test-${Date.now()}-${Math.random()}` });
  return evidencePromise;
}

test("React Web profile surface aggregates exactly the approved six evidence artifacts", async () => {
  const evidence = await getEvidence();

  assert.equal(evidence.schemaVersion, "react-web-profile-surface.v1");
  assert.equal(evidence.profile, "react-web");
  assert.equal(evidence.measurement, "aggregated-react-web-evidence-lane");
  assert.match(evidence.claimBoundary, /Aggregated local React Web evidence lane only/);
  assert.match(evidence.claimBoundary, /does not widen context-reduction, performance, runtime-token, provider-cost, billing, invoice, or charged-cost claims/);

  assert.deepEqual(Object.keys(evidence.artifacts), REACT_WEB_PROFILE_ARTIFACT_KEYS);
  assert.deepEqual(evidence.summary.artifactKeys, REACT_WEB_PROFILE_ARTIFACT_KEYS);
  assert.equal(evidence.summary.artifactCount, 6);
  assert.equal(evidence.summary.reactWebOnly, true);

  assert.equal("rn" in evidence, false);
  assert.equal("reactNative" in evidence, false);
  assert.equal("webview" in evidence, false);
  assert.equal("tui" in evidence, false);

  assert.deepEqual(evidence.claimability, {
    contextReduction: false,
    cachePerformance: false,
    providerBillingSavings: false,
  });
  assert.equal(evidence.summary.contextReductionWidened, false);
  assert.equal(evidence.summary.cachePerformanceWidened, false);
  assert.equal(evidence.summary.providerBillingSavingsWidened, false);

  assert.equal(evidence.summary.childSignals.contextActualInjectedContextReductionClaimable, true);
  assert.equal(evidence.summary.childSignals.reuseCorrectnessClaimable, true);
  assert.equal(evidence.summary.childSignals.overCachingAuditVerdictName, "react-web-small-edit-refresh-no-repro");
  assert.equal(evidence.summary.childSignals.overCachingAuditBugReproduced, false);
  assert.equal(typeof evidence.summary.childSignals.stabilityWarningOnly, "boolean");
  assert.equal(evidence.summary.childSignals.mixedRoutingBoundaryIsolationClaimable, true);
  assert.equal(evidence.summary.childSignals.knowledgeContextBoundaryEvidenceClaimable, true);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.schemaVersion, "react-web-live-hook-dogfood-fixture-manifest.v1");
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.diagnosticOnly, true);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.claimable, false);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.advisoryOnly, true);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.freshnessStatus, "fresh");
  assert.equal(
    evidence.summary.childSignals.liveHookDogfoodCoverage.manifestFingerprintAlgorithm,
    "sha256-json-stable-v1",
  );
  assert.match(evidence.summary.childSignals.liveHookDogfoodCoverage.manifestFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.fixtureSourceFreshnessStatus, "fresh");
  assert.equal(
    evidence.summary.childSignals.liveHookDogfoodCoverage.fixtureSourceFingerprintAlgorithm,
    "sha256-file-set-v1",
  );
  assert.match(evidence.summary.childSignals.liveHookDogfoodCoverage.fixtureSourceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.snapshotDrift.driftStatus, "fresh");
  assert.deepEqual(evidence.summary.childSignals.liveHookDogfoodCoverage.snapshotDrift.reasons, []);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.fixtureCount, 10);
  assert.deepEqual(evidence.summary.childSignals.liveHookDogfoodCoverage.missingLabels, []);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodCoverage.countsByRole.positive, 8);
  assert.match(evidence.summary.childSignals.liveHookDogfoodCoverage.claimBoundary, /not broad React Web support/);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.schemaVersion, "react-web-live-hook-dogfood-metric-summary.v1");
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.status, "not-supplied");
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.advisoryOnly, true);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.diagnosticOnly, true);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.claimable, false);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.replayExecuted, false);
  assert.match(evidence.summary.childSignals.liveHookDogfoodMetrics.reason, /never replayed by the default profile surface/);
  assert.equal(
    evidence.summary.childSignals.liveHookDogfoodMetrics.metricInterpretation.finalInjectionByteReductionIsCandidateCompressionProof,
    false,
  );
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.metricInterpretation.providerTokenSavingsClaimable, false);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.metricInterpretation.numericPrGateThreshold, false);
});

test("React Web profile surface accepts precomputed live hook metrics without replaying", async () => {
  const evidence = await buildReactWebProfileSurface({
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
      metricAliases: {
        candidate_admission_rate: 1,
        candidate_compression_success_rate: 1,
        bad_candidate_block_rate: null,
        fallback_used_rate: 0,
        candidate_byte_reduction: { min: 50, max: 50, avg: 50 },
        final_injection_byte_reduction: { min: 50, max: 50, avg: 50 },
      },
    },
  });

  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.status, "supplied");
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.replayExecuted, false);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.metricAliases.candidate_admission_rate, 1);
  assert.equal(evidence.summary.childSignals.liveHookDogfoodMetrics.metricAliases.fallback_used_rate, 0);
  assert.equal(
    evidence.summary.childSignals.liveHookDogfoodMetrics.metricInterpretation.finalInjectionByteReductionIsCandidateCompressionProof,
    false,
  );
});

test("React Web profile surface rejects malformed precomputed live hook metrics before replay-prone work", async () => {
  await assert.rejects(
    () => buildReactWebProfileSurface({
      runId: `malformed-${Date.now()}-${Math.random()}`,
      liveHookDogfoodMetrics: {},
    }),
    /requires numeric fixtureCount/,
  );
});

test("React Web profile surface markdown keeps the top-level non-claims explicit", async () => {
  const evidence = await getEvidence();
  const markdown = renderReactWebProfileSurfaceMarkdown(evidence);

  assert.match(markdown, /# React Web profile surface/);
  assert.match(markdown, /Profile: react-web/);
  assert.match(markdown, /Artifact count: 6/);
  assert.match(markdown, /Artifact keys: context, reuse, overCachingAudit, stability, mixedRouting, knowledgeContext/);
  assert.match(markdown, /React Web only: yes/);
  assert.match(markdown, /Top-level context reduction claim widened: no/);
  assert.match(markdown, /Top-level cache performance claim widened: no/);
  assert.match(markdown, /Top-level provider billing savings claim widened: no/);
  assert.match(markdown, /Over-caching audit verdict: react-web-small-edit-refresh-no-repro/);
  assert.match(markdown, /Over-caching audit bug reproduced: no/);
  assert.match(markdown, /Live-hook dogfood coverage advisory-only: yes \(10 fixtures, missing labels: none\)/);
  assert.match(markdown, /Live-hook dogfood coverage freshness: fresh \(sha256-json-stable-v1, [a-f0-9]{12}\)/);
  assert.match(markdown, /Live-hook dogfood fixture source freshness: fresh \(sha256-file-set-v1, [a-f0-9]{12}\)/);
  assert.match(markdown, /Live-hook dogfood snapshot drift: fresh \(none\)/);
  assert.match(markdown, /Live-hook dogfood metrics status: not-supplied \(replay executed by profile: no\)/);
  assert.match(markdown, /Live-hook dogfood metrics advisory-only: yes/);
  assert.match(markdown, /Context reduction claimable at top level: no/);
  assert.match(markdown, /Cache performance claimable at top level: no/);
  assert.match(markdown, /Provider billing savings claimable at top level: no/);
  assert.doesNotMatch(markdown, /Context reduction claimable at top level: yes/i);
});

test("React Web profile surface command writes bounded JSON and Markdown reports", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-profile-surface-"));
  const outputPath = path.join(tempDir, "react-web-profile-surface.json");
  const markdownPath = path.join(tempDir, "react-web-profile-surface.md");

  const cli = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "react-web-profile-surface.mjs"),
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
  assert.equal(stdoutEvidence.profile, "react-web");
  assert.deepEqual(Object.keys(stdoutEvidence.artifacts), REACT_WEB_PROFILE_ARTIFACT_KEYS);
  assert.deepEqual(fileEvidence, stdoutEvidence);
  assert.match(markdown, /# React Web profile surface/);
  assert.match(markdown, /Top-level context reduction claim widened: no/);
});


test("React Web profile surface contract fails closed on artifact drift", () => {
  assert.throws(
    () =>
      assertReactWebProfileSurfaceContract({
        schemaVersion: "react-web-profile-surface.v1",
        profile: "react-web",
        artifacts: { context: {} },
        summary: {
          artifactCount: 1,
          artifactKeys: ["context"],
        },
      }),
    /artifact keys changed/,
  );

  assert.throws(
    () =>
      assertReactWebProfileSurfaceContract({
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
        summary: {
          artifactCount: 5,
          artifactKeys: REACT_WEB_PROFILE_ARTIFACT_KEYS,
        },
      }),
    /artifactCount changed/,
  );
});
