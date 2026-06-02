import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildReactWebPrGateSurface,
  evaluateReactWebPrGate,
  renderReactWebPrGateMarkdown,
} from "../scripts/react-web-pr-gate-surface.mjs";

const repoRoot = process.cwd();
let evidencePromise;

function getEvidence() {
  evidencePromise ??= buildReactWebPrGateSurface({ runId: `test-${Date.now()}-${Math.random()}` });
  return evidencePromise;
}

test("React Web PR gate passes on the approved bounded advisory surface", async () => {
  const evidence = await getEvidence();

  assert.equal(evidence.schemaVersion, "react-web-pr-gate-surface.v1");
  assert.equal(evidence.profile, "react-web");
  assert.equal(evidence.consumer, "pull-request");
  assert.equal(evidence.gate.checkName, "React Web PR gate");
  assert.equal(evidence.gate.failClosed, true);
  assert.equal(evidence.gate.status, "pass");
  assert.equal(evidence.summary.passed, true);
  assert.equal(evidence.summary.blockerCount, 0);
  assert.deepEqual(evidence.summary.protectedArtifacts, [
    "context",
    "reuse",
    "overCachingAudit",
    "stability",
    "mixedRouting",
    "knowledgeContext",
  ]);
  assert.equal(evidence.summary.metricsRemainNonBlocking, true);
  assert.deepEqual(evidence.summary.blockerCategories, [
    "required-artifact-presence",
    "routing-boundary-leakage",
    "advisory-status-inconsistency",
  ]);
  assert.equal(evidence.summary.blockerCategories.includes("metric-threshold"), false);
  assert.equal(evidence.summary.blockerCategories.includes("live-hook-dogfood-metric-threshold"), false);
  assert.equal(
    evidence.advisorySurface.summary.liveHookDogfoodCoverage.advisoryOnly,
    true,
  );
  assert.equal(evidence.advisorySurface.summary.liveHookDogfoodMetrics.status, "not-supplied");
  assert.equal(evidence.advisorySurface.summary.liveHookDogfoodMetrics.replayExecuted, false);
  assert.equal(evidence.advisorySurface.summary.liveHookDogfoodMetrics.metricInterpretation.numericPrGateThreshold, false);
  assert.equal(evidence.advisorySurface.summary.liveHookDogfoodCoverage.freshnessStatus, "fresh");
  assert.equal(evidence.advisorySurface.summary.liveHookDogfoodCoverage.fixtureSourceFreshnessStatus, "fresh");
  assert.equal(evidence.advisorySurface.summary.liveHookDogfoodCoverage.snapshotDrift.driftStatus, "fresh");
  assert.deepEqual(evidence.advisorySurface.summary.liveHookDogfoodCoverage.missingLabels, []);
  assert.equal(evidence.summary.reactWebOnly, true);
  assert.equal(evidence.summary.advisoryStatusRemainsUpstreamOnly, true);
});

test("React Web PR gate blocks malformed or missing required artifacts", () => {
  const evaluation = evaluateReactWebPrGate({
    advisory: true,
    status: "advisory",
    consumer: "pull-request",
    summary: {
      advisoryOnly: true,
      releaseSafeHeadline: "",
      nonClaims: {
        cachePerformance: false,
        runtimeTokenSavings: false,
        providerBillingSavings: false,
      },
    },
    profileSurface: {
      schemaVersion: "react-web-profile-surface.v1",
      profile: "react-web",
      artifacts: { context: {} },
      summary: {
        artifactCount: 1,
        artifactKeys: ["context"],
        reactWebOnly: true,
        contextReductionWidened: false,
        cachePerformanceWidened: false,
        providerBillingSavingsWidened: false,
        childSignals: {
          mixedRoutingBoundaryIsolationClaimable: true,
          knowledgeContextBoundaryEvidenceClaimable: true,
        },
      },
      claimability: {
        contextReduction: false,
        cachePerformance: false,
        providerBillingSavings: false,
      },
    },
  });

  assert.equal(evaluation.passed, false);
  assert.match(
    evaluation.blockers.map((blocker) => blocker.code).join("\n"),
    /profile-contract-broken|advisory-contract-broken|missing-release-safe-headline/,
  );
});

test("React Web PR gate blocks routing and claim-boundary leakage", () => {
  const evaluation = evaluateReactWebPrGate({
    advisory: true,
    status: "advisory",
    consumer: "pull-request",
    summary: {
      advisoryOnly: true,
      releaseSafeHeadline: "headline",
      nonClaims: {
        cachePerformance: false,
        runtimeTokenSavings: false,
        providerBillingSavings: false,
      },
    },
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
      summary: {
        artifactCount: 6,
        artifactKeys: [
          "context",
          "reuse",
          "overCachingAudit",
          "stability",
          "mixedRouting",
          "knowledgeContext",
        ],
        reactWebOnly: false,
        contextReductionWidened: true,
        cachePerformanceWidened: false,
        providerBillingSavingsWidened: false,
        childSignals: {
          mixedRoutingBoundaryIsolationClaimable: false,
          knowledgeContextBoundaryEvidenceClaimable: false,
        },
      },
      claimability: {
        contextReduction: false,
        cachePerformance: false,
        providerBillingSavings: false,
      },
    },
  });

  assert.equal(evaluation.passed, false);
  assert.match(evaluation.blockers.map((blocker) => blocker.code).join("\n"), /react-web-only-drift/);
  assert.match(evaluation.blockers.map((blocker) => blocker.code).join("\n"), /contextReductionWidened-drift/);
  assert.match(evaluation.blockers.map((blocker) => blocker.code).join("\n"), /mixed-routing-boundary-leakage/);
  assert.match(evaluation.blockers.map((blocker) => blocker.code).join("\n"), /knowledge-context-boundary-leakage/);
});

test("React Web PR gate blocks advisory-status inconsistency", () => {
  const evaluation = evaluateReactWebPrGate({
    advisory: false,
    status: "pass",
    consumer: "release",
    summary: {
      advisoryOnly: false,
      releaseSafeHeadline: "headline",
      nonClaims: {
        cachePerformance: false,
        runtimeTokenSavings: false,
        providerBillingSavings: false,
      },
    },
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
      summary: {
        artifactCount: 6,
        artifactKeys: [
          "context",
          "reuse",
          "overCachingAudit",
          "stability",
          "mixedRouting",
          "knowledgeContext",
        ],
        reactWebOnly: true,
        contextReductionWidened: false,
        cachePerformanceWidened: false,
        providerBillingSavingsWidened: false,
        childSignals: {
          mixedRoutingBoundaryIsolationClaimable: true,
          knowledgeContextBoundaryEvidenceClaimable: true,
        },
      },
      claimability: {
        contextReduction: false,
        cachePerformance: false,
        providerBillingSavings: false,
      },
    },
  });

  assert.equal(evaluation.passed, false);
  assert.match(evaluation.blockers.map((blocker) => blocker.code).join("\n"), /advisory-drift/);
  assert.match(evaluation.blockers.map((blocker) => blocker.code).join("\n"), /status-drift/);
  assert.match(evaluation.blockers.map((blocker) => blocker.code).join("\n"), /consumer-drift/);
  assert.match(evaluation.blockers.map((blocker) => blocker.code).join("\n"), /advisory-only-drift/);
});

test("React Web PR gate markdown stays fail-closed while keeping metrics non-blocking", async () => {
  const evidence = await getEvidence();
  const markdown = renderReactWebPrGateMarkdown(evidence);

  assert.match(markdown, /# React Web PR gate/);
  assert.match(markdown, /Gate status: pass/);
  assert.match(markdown, /Fail-closed: yes/);
  assert.match(markdown, /Metrics remain non-blocking: yes/);
  assert.match(markdown, /Upstream advisory status remains advisory-only: yes/);
});

test("React Web PR gate CLI writes JSON and Markdown reports", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-pr-gate-"));
  const outputPath = path.join(tempDir, "react-web-pr-gate.json");
  const markdownPath = path.join(tempDir, "react-web-pr-gate.md");

  const cli = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "react-web-pr-gate-surface.mjs"),
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
  assert.equal(stdoutEvidence.gate.status, "pass");
  assert.deepEqual(fileEvidence, stdoutEvidence);
  assert.match(markdown, /# React Web PR gate/);
});
