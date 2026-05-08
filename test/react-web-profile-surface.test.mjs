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
