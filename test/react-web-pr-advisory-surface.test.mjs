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
  assert.match(markdown, /Provider billing\/cost savings proof: no/);
  assert.match(markdown, /Broad React\/RN\/WebView\/TUI support proof: no/);
  assert.doesNotMatch(markdown, /Cache performance proof: yes/i);
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
