// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { handleCodexRuntimeHook } = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
const {
  REACT_WEB_STATUS_COMMAND,
  REACT_WEB_STATUS_CLAIM_BOUNDARY,
  REACT_WEB_RELIABILITY_HANDOFF_CLAIM_BOUNDARY,
  readReactWebStatus,
} = require(path.join(repoRoot, "dist", "reporting", "react-web-status.js"));
const { reactWebEvidenceArtifactsDir } = require(path.join(repoRoot, "dist", "reporting", "react-web-evidence-artifact.js"));

const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function writeFixture(tempDir, fixturePath, fileName) {
  fs.writeFileSync(path.join(tempDir, fileName), fs.readFileSync(path.join(repoRoot, fixturePath), "utf8"));
}

function runRepeatedDecision(tempDir, fileName, secondPrompt) {
  const sessionId = `react-web-status-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Please inspect ${fileName}` }, tempDir);
  const second = handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: secondPrompt }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "Stop", sessionId }, tempDir);
  return second;
}

function highRiskResumePacket() {
  return {
    reliabilityBoundary: {
      planningWarningCount: 1,
      combinedReliabilityWarningCount: 1,
      sequentialPlanningHintCount: 1,
      planBeforeExecuteGuardCount: 1,
      longRunBudgetWarningCount: 1,
      resetCompactHandoffRecommendationCount: 1,
      longRunBudgetRiskLevel: "high",
      staleContextReliabilityOverlap: true,
      stopBeforeMoreExecution: true,
    },
    nextSessionAdvisory: {
      action: "stop-before-more-execution",
      rationale: "plan-before-execute guard is present",
      suggestedCommands: ["fooks check --json", "fooks handoff --json"],
      requiredRechecks: [
        "Run fooks check --json in the new session before treating this packet as current authority.",
        "Run fooks handoff --json again before the next context compression or fresh-agent handoff.",
      ],
    },
    forbiddenClaims: [
      "provider billing/runtime proof",
      "merge-gate policy change",
      "frontend runtime behavior change",
    ],
  };
}

test("status react-web reports blocked without failing when no latest evidence exists", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-status-empty-"));

  const status = readReactWebStatus(tempDir);
  assert.equal(status.command, REACT_WEB_STATUS_COMMAND);
  assert.equal(status.profileStatus, "blocked");
  assert.equal(status.latestEvidenceId, null);
  assert.equal(status.repeatedSameFileReady, false);
  assert.deepEqual(status.activationMode, {
    available: false,
    verdict: "unavailable",
    repeatedFilePositive: false,
    profileGateVerdict: "unavailable",
    profileGateReasons: [],
    globMatchVerdict: "unavailable",
    globMatchReasons: [],
    promotedTrigger: null,
    deferredTriggers: ["always-on", "model-decision"],
    blockedReasons: [],
  });
  assert.deepEqual(status.rankedBundle, {
    available: false,
    verdict: "unavailable",
    budgetLimit: null,
    selectedCount: 0,
    deferredCount: 0,
    overflow: false,
    fallbackReasons: [],
  });
  assert.deepEqual(status.interop, {
    mayBeStored: true,
    mayBeSummarized: false,
    mayOverrideDecision: false,
  });
  assert.equal(status.reliabilityHandoff.available, false);
  assert.equal(status.reliabilityHandoff.status, "unavailable");
  assert.equal(status.reliabilityHandoff.recommendedAction, "run-handoff-resume-json");
  assert.match(status.claimBoundary, /source-context decision status only/);
  assert.ok(status.risks.some((risk) => /no React Web evidence artifact found/.test(risk)));

  const cliJson = spawnSync(process.execPath, [cliPath, "status", "react-web", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliJson.status, 0, cliJson.stderr);
  const parsed = JSON.parse(cliJson.stdout);
  assert.equal(parsed.profileStatus, "blocked");
  assert.deepEqual(parsed.interop, status.interop);
});

test("status react-web reports ready from a current repeated same-file use artifact", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-status-ready-"));
  writeFixture(tempDir, "fixtures/compressed/FormSection.tsx", "FormSection.tsx");

  const second = runRepeatedDecision(
    tempDir,
    "FormSection.tsx",
    "Please update FormSection.tsx again and keep the same-file React Web context compact if safe",
  );
  assert.equal(second.action, "inject");

  const status = readReactWebStatus(tempDir);
  assert.equal(status.profileStatus, "ready");
  assert.equal(status.latestDecision, "use");
  assert.equal(status.repeatedSameFileReady, true);
  assert.equal(status.boundaryStatus.mixedRouting.status, "bounded");
  assert.equal(status.boundaryStatus.projectKnowledge.status, "advisory-only");
  assert.equal(status.activationMode.available, true);
  assert.equal(status.activationMode.verdict, "would-activate");
  assert.equal(status.activationMode.repeatedFilePositive, true);
  assert.equal(status.activationMode.profileGateVerdict, "would-activate");
  assert.equal(status.activationMode.globMatchVerdict, "would-activate");
  assert.equal(status.rankedBundle.available, true);
  assert.equal(status.rankedBundle.verdict, "ranked");
  assert.ok(status.rankedBundle.selectedCount > 0);
  assert.deepEqual(status.interop, {
    mayBeStored: true,
    mayBeSummarized: false,
    mayOverrideDecision: false,
  });
  assert.deepEqual(status.risks, []);
  assert.equal(status.claimBoundary, REACT_WEB_STATUS_CLAIM_BOUNDARY);

  const resumePath = path.join(tempDir, "resume.json");
  fs.writeFileSync(resumePath, JSON.stringify(highRiskResumePacket()));
  const statusWithHandoff = readReactWebStatus(tempDir, { authoritativeResumePacket: highRiskResumePacket() });
  assert.equal(statusWithHandoff.reliabilityHandoff.available, true);
  assert.equal(statusWithHandoff.reliabilityHandoff.status, "stop-before-more-execution");
  assert.equal(statusWithHandoff.reliabilityHandoff.claimBoundary, REACT_WEB_RELIABILITY_HANDOFF_CLAIM_BOUNDARY);
  assert.equal(statusWithHandoff.reliabilityHandoff.summary.staleContextReliabilityOverlap, true);
  assert.equal(statusWithHandoff.reliabilityHandoff.summary.longRunBudgetRiskLevel, "high");
  assert.equal(statusWithHandoff.reliabilityHandoff.summary.resetCompactHandoffRecommendationCount, 1);
  assert.equal(statusWithHandoff.reliabilityHandoff.recommendedAction, "stop-before-more-execution");
  assert.deepEqual(statusWithHandoff.reliabilityHandoff.derivedFrom, [
    "authoritativeResumePacket.reliabilityBoundary",
    "authoritativeResumePacket.nextSessionAdvisory",
    "authoritativeResumePacket.forbiddenClaims",
  ]);
  assert.ok(statusWithHandoff.reliabilityHandoff.requiredRechecks.some((recheck) => /fooks check --json/.test(recheck)));

  const cliText = spawnSync(process.execPath, [cliPath, "status", "react-web"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliText.status, 0, cliText.stderr);
  assert.match(cliText.stdout, /React Web status/);
  assert.match(cliText.stdout, /profile status: ready/);
  assert.match(cliText.stdout, /summarized=no/);
  assert.match(cliText.stdout, /profile-gate runtime gate: would-activate/);
  assert.match(cliText.stdout, /glob-match runtime gate: would-activate/);

  const cliHandoffText = spawnSync(process.execPath, [cliPath, "status", "react-web", "--handoff-resume-json", resumePath], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliHandoffText.status, 0, cliHandoffText.stderr);
  assert.match(cliHandoffText.stdout, /Reliability handoff/);
  assert.match(cliHandoffText.stdout, /reliability handoff: stop-before-more-execution/);
  assert.match(cliHandoffText.stdout, /stale\/context overlap: yes/);
  assert.match(cliHandoffText.stdout, /reset\/compact handoff recommendations: 1/);

  const cliHandoffJson = spawnSync(process.execPath, [cliPath, "status", "react-web", "--json", "--handoff-resume-json", resumePath], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliHandoffJson.status, 0, cliHandoffJson.stderr);
  const parsed = JSON.parse(cliHandoffJson.stdout);
  assert.equal(parsed.reliabilityHandoff.status, "stop-before-more-execution");
  assert.equal(parsed.reliabilityHandoff.summary.longRunBudgetRiskLevel, "high");
});

test("status react-web reports blocked mixed-routing boundary from a deny artifact without failing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-status-deny-"));
  writeFixture(tempDir, "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx", "Boundary.tsx");

  const second = runRepeatedDecision(
    tempDir,
    "Boundary.tsx",
    "Please inspect Boundary.tsx again and keep the same-file context compact if safe",
  );
  assert.equal(second.action, "fallback");

  const status = readReactWebStatus(tempDir);
  assert.equal(status.profileStatus, "blocked");
  assert.equal(status.latestDecision, "deny");
  assert.equal(status.boundaryStatus.mixedRouting.status, "blocked");
  assert.equal(status.activationMode.available, true);
  assert.equal(status.activationMode.verdict, "blocked");
  assert.equal(status.activationMode.repeatedFilePositive, false);
  assert.equal(status.activationMode.profileGateVerdict, "blocked");
  assert.equal(status.activationMode.globMatchVerdict, "blocked");
  assert.equal(status.rankedBundle.available, true);
  assert.equal(status.rankedBundle.verdict, "blocked");
  assert.deepEqual(status.interop, {
    mayBeStored: true,
    mayBeSummarized: false,
    mayOverrideDecision: false,
  });
  assert.match(status.fallbackReasons.join("\n"), /unsupported-react-native-webview-boundary/);
  assert.ok(status.risks.some((risk) => /latest React Web decision is deny/.test(risk)));

  const cliJson = spawnSync(process.execPath, [cliPath, "status", "react-web", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliJson.status, 0, cliJson.stderr);
  const parsed = JSON.parse(cliJson.stdout);
  assert.equal(parsed.profileStatus, "blocked");
  assert.equal(parsed.boundaryStatus.mixedRouting.status, "blocked");
  assert.deepEqual(parsed.interop, status.interop);
});

test("status react-web fails non-zero when the latest artifact index is corrupt", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-status-corrupt-"));
  const artifactsDir = reactWebEvidenceArtifactsDir(tempDir);
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, "latest.json"), "{not-valid-json\n");

  const cli = spawnSync(process.execPath, [cliPath, "status", "react-web", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.notEqual(cli.status, 0);
  assert.match(`${cli.stdout}${cli.stderr}`, /Unexpected token|Expected property name|JSON/);
});
