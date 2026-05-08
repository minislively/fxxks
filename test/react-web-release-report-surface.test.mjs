import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  assertReactWebReleaseReportContract,
  buildReactWebReleaseReportSurface,
  renderReactWebReleaseReportMarkdown,
} from "../scripts/react-web-release-report-surface.mjs";

const repoRoot = process.cwd();
let evidencePromise;

function getEvidence() {
  evidencePromise ??= buildReactWebReleaseReportSurface({ runId: `test-${Date.now()}-${Math.random()}` });
  return evidencePromise;
}

test("React Web release report surface stays advisory-only over existing bounded release inputs", async () => {
  const evidence = await getEvidence();

  assert.equal(evidence.schemaVersion, "react-web-release-report-surface.v1");
  assert.equal(evidence.advisory, true);
  assert.equal(evidence.status, "advisory");
  assert.equal(evidence.consumer, "release");
  assert.equal(evidence.profile, "react-web");
  assert.equal(evidence.checkName, "React Web release report");
  assert.match(evidence.claimBoundary, /presentation adapter over the existing bounded React Web profile surface and release-benchmark evidence only/i);
  assert.match(evidence.claimBoundary, /does not create a new evidence lane/i);
  assert.match(evidence.claimBoundary, /does not change merge or release gate policy/i);
  assert.match(evidence.claimBoundary, /does not prove cache performance, runtime-token savings, provider cost, billing/i);

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

  assert.equal(evidence.releaseBenchmarkEvidence.schemaVersion, "release-benchmark-evidence.v1");
  assert.equal(evidence.releaseBenchmarkSummary.npmUpdateClaimable, true);
  assert.match(evidence.summary.releaseSafeHeadline, /React Web same-file reuse is routed correctly/);
  assert.equal(evidence.summary.profileArtifactCount, 6);
  assert.deepEqual(evidence.summary.artifactKeys, [
    "context",
    "reuse",
    "overCachingAudit",
    "stability",
    "mixedRouting",
    "knowledgeContext",
  ]);
  assert.equal(evidence.summary.nonClaims.profileTopLevelContextReduction, false);
  assert.equal(evidence.summary.nonClaims.cachePerformance, false);
  assert.equal(evidence.summary.nonClaims.runtimeTokenSavings, false);
  assert.equal(evidence.summary.nonClaims.providerBillingSavings, false);
  assert.equal(evidence.summary.nonClaims.broadSupport, false);
});

test("React Web release report markdown keeps release-facing wording and explicit non-claims", async () => {
  const evidence = await getEvidence();
  const markdown = renderReactWebReleaseReportMarkdown(evidence);

  assert.match(markdown, /# React Web release report/);
  assert.match(markdown, /Advisory only: yes/);
  assert.match(markdown, /Consumer: release/);
  assert.match(markdown, /Release-safe headline:/);
  assert.match(markdown, /Cache performance proof: no/);
  assert.match(markdown, /Runtime-token savings proof: no/);
  assert.match(markdown, /Provider billing\/cost savings proof: no/);
  assert.match(markdown, /Broad React\/RN\/WebView\/TUI support proof: no/);
  assert.match(markdown, /does not block merge or release/i);
  assert.doesNotMatch(markdown, /Cache performance proof: yes/i);
});

test("React Web release report contract fails closed on malformed upstream inputs", () => {
  assert.throws(
    () =>
      assertReactWebReleaseReportContract({
        schemaVersion: "react-web-release-report-surface.v1",
        advisory: true,
        status: "advisory",
        consumer: "release",
        profile: "react-web",
        checkName: "React Web release report",
        claimBoundary: "boundary",
        profileSurface: {
          schemaVersion: "react-web-profile-surface.v1",
          profile: "react-web",
          artifacts: { context: {} },
          summary: { artifactCount: 1, artifactKeys: ["context"] },
          claimability: {
            contextReduction: false,
            cachePerformance: false,
            providerBillingSavings: false,
          },
        },
        releaseBenchmarkEvidence: {
          schemaVersion: "release-benchmark-evidence.v1",
          nonClaims: {
            cachePerformanceImprovement: { claimable: false },
            runtimeTokenSavings: { claimable: false },
            providerBillingSavings: { claimable: false },
          },
        },
        summary: {
          artifactKeys: ["context"],
          profileArtifactCount: 1,
          releaseSafeHeadline: "headline",
          nonClaims: {
            profileTopLevelContextReduction: false,
            cachePerformance: false,
            runtimeTokenSavings: false,
            providerBillingSavings: false,
            broadSupport: false,
          },
        },
      }),
    /artifact keys changed/,
  );

  assert.throws(
    () =>
      assertReactWebReleaseReportContract({
        schemaVersion: "react-web-release-report-surface.v1",
        advisory: true,
        status: "advisory",
        consumer: "release",
        profile: "react-web",
        checkName: "React Web release report",
        claimBoundary: "boundary",
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
            artifactKeys: ["context", "reuse", "overCachingAudit", "stability", "mixedRouting", "knowledgeContext"],
          },
          claimability: {
            contextReduction: false,
            cachePerformance: false,
            providerBillingSavings: false,
          },
        },
        releaseBenchmarkEvidence: {
          schemaVersion: "release-benchmark-evidence.v1",
          nonClaims: {
            cachePerformanceImprovement: { claimable: true },
            runtimeTokenSavings: { claimable: false },
            providerBillingSavings: { claimable: false },
          },
        },
        summary: {
          artifactKeys: ["context", "reuse", "overCachingAudit", "stability", "mixedRouting", "knowledgeContext"],
          profileArtifactCount: 6,
          releaseSafeHeadline: "headline",
          nonClaims: {
            profileTopLevelContextReduction: false,
            cachePerformance: false,
            runtimeTokenSavings: false,
            providerBillingSavings: false,
            broadSupport: false,
          },
        },
      }),
    /release benchmark cache performance non-claims widened/,
  );
});

test("React Web release report CLI writes bounded JSON and Markdown reports", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-release-report-"));
  const outputPath = path.join(tempDir, "react-web-release-report.json");
  const markdownPath = path.join(tempDir, "react-web-release-report.md");

  const cli = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "react-web-release-report-surface.mjs"),
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
  assert.equal(stdoutEvidence.consumer, "release");
  assert.deepEqual(stdoutEvidence.summary.artifactKeys, [
    "context",
    "reuse",
    "overCachingAudit",
    "stability",
    "mixedRouting",
    "knowledgeContext",
  ]);
  assert.deepEqual(fileEvidence, stdoutEvidence);
  assert.match(markdown, /# React Web release report/);
  assert.match(markdown, /does not block merge or release/i);
});
