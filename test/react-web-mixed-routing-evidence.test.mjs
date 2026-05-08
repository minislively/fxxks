import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildReactWebMixedRoutingEvidence,
  renderReactWebMixedRoutingEvidenceMarkdown,
} from "../scripts/react-web-mixed-routing-evidence.mjs";

const repoRoot = process.cwd();

test("React Web mixed-routing evidence proves React Web positivity and fallback-only boundaries", async () => {
  const evidence = await buildReactWebMixedRoutingEvidence({ runId: `test-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.schemaVersion, "react-web-mixed-routing-evidence.v1");
  assert.equal(evidence.measurement, "codex-runtime-hook-local-mixed-routing-boundary-decisions");
  assert.match(evidence.claimBoundary, /Local routing-boundary evidence only/);
  assert.match(evidence.claimBoundary, /not context-reduction measurement/);
  assert.match(evidence.claimBoundary, /not wall-clock performance/);
  assert.match(evidence.claimBoundary, /not cache-hit-rate proof/);
  assert.match(evidence.claimBoundary, /not provider cost, billing, invoice, or charged-cost evidence/);

  assert.equal(evidence.checks.reactWebPositive.claimable, true);
  assert.equal(evidence.checks.reactWebPositive.firstAction, "record");
  assert.equal(evidence.checks.reactWebPositive.secondAction, "inject");
  assert.equal(evidence.checks.reactWebPositive.classification, "react-web");
  assert.equal(evidence.checks.reactWebPositive.claimStatus, "current-supported-lane");
  assert.equal(evidence.checks.reactWebPositive.domainClaimBoundary, "react-web-measured-extraction");
  assert.equal(evidence.checks.reactWebPositive.payloadInjected, true);
  assert.deepEqual(evidence.checks.reactWebPositive.reasons, ["repeated-file"]);

  assert.equal(evidence.checks.reactNativeBoundary.claimable, true);
  assert.equal(evidence.checks.reactNativeBoundary.secondAction, "fallback");
  assert.equal(evidence.checks.reactNativeBoundary.classification, "react-native");
  assert.equal(evidence.checks.reactNativeBoundary.fallbackReason, "unsupported-frontend-domain-profile");
  assert.equal(evidence.checks.reactNativeBoundary.payloadInjected, false);

  assert.equal(evidence.checks.webviewBoundary.claimable, true);
  assert.equal(evidence.checks.webviewBoundary.secondAction, "fallback");
  assert.equal(evidence.checks.webviewBoundary.classification, "webview");
  assert.equal(evidence.checks.webviewBoundary.fallbackReason, "unsupported-react-native-webview-boundary");
  assert.equal(evidence.checks.webviewBoundary.payloadInjected, false);

  assert.equal(evidence.checks.tuiBoundary.claimable, true);
  assert.equal(evidence.checks.tuiBoundary.secondAction, "fallback");
  assert.equal(evidence.checks.tuiBoundary.classification, "tui-ink");
  assert.equal(evidence.checks.tuiBoundary.fallbackReason, "unsupported-frontend-domain-profile");
  assert.equal(evidence.checks.tuiBoundary.payloadInjected, false);

  assert.equal(evidence.checks.mixedBoundary.claimable, true);
  assert.equal(evidence.checks.mixedBoundary.secondAction, "fallback");
  assert.equal(evidence.checks.mixedBoundary.classification, "mixed");
  assert.equal(evidence.checks.mixedBoundary.fallbackReason, "unsupported-react-native-webview-boundary");
  assert.equal(evidence.checks.mixedBoundary.payloadInjected, false);

  assert.equal(evidence.summary.boundaryIsolationClaimable, true);
  assert.deepEqual(evidence.summary.warnings, []);
  assert.equal(evidence.summary.contextReduction.claimable, false);
  assert.match(evidence.summary.contextReduction.blocker, /routing-boundary isolation decisions/);
  assert.equal(evidence.summary.cachePerformance.claimable, false);
  assert.match(evidence.summary.cachePerformance.blocker, /not wall-clock latency or cache hit rate/);
  assert.equal(evidence.summary.providerBillingSavings.claimable, false);
  assert.match(evidence.summary.providerBillingSavings.blocker, /no provider usage, token accounting, billing dashboard, invoice, or charged-cost data/);
});

test("React Web mixed-routing evidence Markdown keeps claim boundaries explicit", async () => {
  const evidence = await buildReactWebMixedRoutingEvidence({ runId: `markdown-${Date.now()}-${Math.random()}` });
  const markdown = renderReactWebMixedRoutingEvidenceMarkdown(evidence);

  assert.match(markdown, /React Web positive lane claimable: yes/);
  assert.match(markdown, /React Native boundary preserved: yes/);
  assert.match(markdown, /WebView boundary preserved: yes/);
  assert.match(markdown, /TUI boundary preserved: yes/);
  assert.match(markdown, /Mixed RN\/WebView boundary preserved: yes/);
  assert.match(markdown, /Overall boundary isolation claimable: yes/);
  assert.match(markdown, /Context reduction claimable: no/);
  assert.match(markdown, /Cache performance claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /This surface is local routing-boundary evidence only/);
  assert.match(markdown, /does not mean RN\/WebView\/TUI support/);
  assert.match(markdown, /does not support context-reduction, wall-clock performance, cache-hit-rate, runtime-token, provider-cost, billing, invoice, or charged-cost claims/);
  assert.match(markdown, /- none/);
  assert.doesNotMatch(markdown, /Cache performance claimable: yes/i);
  assert.doesNotMatch(markdown, /Provider billing savings claimable: yes/i);
});

test("React Web mixed-routing evidence command writes bounded JSON and Markdown reports", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-mixed-routing-evidence-"));
  const outputPath = path.join(tempDir, "react-web-mixed-routing.json");
  const markdownPath = path.join(tempDir, "react-web-mixed-routing.md");

  const cli = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "react-web-mixed-routing-evidence.mjs"),
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

  assert.equal(stdoutEvidence.schemaVersion, "react-web-mixed-routing-evidence.v1");
  assert.equal(stdoutEvidence.runId, "cli-test");
  assert.deepEqual(fileEvidence, stdoutEvidence);
  assert.match(markdown, /# React Web mixed-routing evidence/);
  assert.match(markdown, /Overall boundary isolation claimable: yes/);
});
