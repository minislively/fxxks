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
const { runDoctor } = require(path.join(repoRoot, "dist", "cli", "doctor.js"));
const { reactWebEvidenceArtifactsDir } = require(path.join(repoRoot, "dist", "core", "react-web-evidence-artifact.js"));

const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function writeFixture(tempDir, fixturePath, fileName) {
  fs.writeFileSync(path.join(tempDir, fileName), fs.readFileSync(path.join(repoRoot, fixturePath), "utf8"));
}

function runRepeatedDecision(tempDir, fileName, secondPrompt) {
  const sessionId = `react-web-doctor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Please inspect ${fileName}` }, tempDir);
  const second = handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: secondPrompt }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "Stop", sessionId }, tempDir);
  return second;
}

test("doctor codex reports blocked React Web activation readiness without latest evidence", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-doctor-empty-"));

  const result = runDoctor({ target: "codex", cwd: tempDir, cliName: "fooks" });
  assert.ok(result.reactWebActivation);
  assert.equal(result.reactWebActivation.state, "blocked");
  assert.equal(result.reactWebActivation.latestEvidenceId, null);
  assert.equal(result.reactWebActivation.repeatedFileRuntime.verdict, "unavailable");
  assert.equal(result.reactWebActivation.globMatchAdvisory.verdict, "unavailable");
  assert.deepEqual(result.reactWebActivation.deferredTriggers, ["always-on", "model-decision"]);
  assert.match(result.reactWebActivation.nextAction, /Create one repeated same-file React Web Codex cycle/);
});

test("doctor codex reports ready React Web activation readiness from a current repeated same-file artifact", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-doctor-ready-"));
  writeFixture(tempDir, "fixtures/compressed/FormSection.tsx", "FormSection.tsx");

  const second = runRepeatedDecision(
    tempDir,
    "FormSection.tsx",
    "Please update FormSection.tsx again and keep the same-file React Web context compact if safe",
  );
  assert.equal(second.action, "inject");

  const result = runDoctor({ target: "codex", cwd: tempDir, cliName: "fooks" });
  assert.ok(result.reactWebActivation);
  assert.equal(result.reactWebActivation.state, "ready");
  assert.equal(result.reactWebActivation.latestDecision, "use");
  assert.equal(result.reactWebActivation.repeatedFileRuntime.verdict, "would-activate");
  assert.equal(result.reactWebActivation.repeatedFileRuntime.positive, true);
  assert.equal(result.reactWebActivation.profileGateAdvisory.verdict, "would-activate");
  assert.equal(result.reactWebActivation.globMatchAdvisory.verdict, "would-activate");

  const cliText = spawnSync(process.execPath, [cliPath, "doctor", "codex"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliText.status, 0, cliText.stderr);
  assert.match(cliText.stdout, /React Web activation/);
  assert.match(cliText.stdout, /repeated-file runtime: would-activate/);
  assert.match(cliText.stdout, /profile-gate runtime gate: would-activate/);
  assert.match(cliText.stdout, /glob-match runtime gate: would-activate/);
});

test("doctor codex reports partial React Web activation readiness when freshness goes stale", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-doctor-partial-"));
  writeFixture(tempDir, "fixtures/compressed/FormSection.tsx", "FormSection.tsx");

  const second = runRepeatedDecision(
    tempDir,
    "FormSection.tsx",
    "Please update FormSection.tsx again and keep the same-file React Web context compact if safe",
  );
  assert.equal(second.action, "inject");
  fs.appendFileSync(path.join(tempDir, "FormSection.tsx"), "\n// stale now\n");

  const result = runDoctor({ target: "codex", cwd: tempDir, cliName: "fooks" });
  assert.ok(result.reactWebActivation);
  assert.equal(result.reactWebActivation.state, "partial");
  assert.equal(result.reactWebActivation.repeatedFileRuntime.verdict, "deferred");
  assert.equal(result.reactWebActivation.profileGateAdvisory.verdict, "deferred");
  assert.equal(result.reactWebActivation.globMatchAdvisory.verdict, "deferred");
  assert.ok(result.reactWebActivation.risks.some((risk) => /stale/.test(risk)));
});

test("doctor codex keeps React Web activation read errors bounded in JSON output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-doctor-corrupt-"));
  const artifactsDir = reactWebEvidenceArtifactsDir(tempDir);
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, "latest.json"), "{not-valid-json\n");

  const cliJson = spawnSync(process.execPath, [cliPath, "doctor", "codex", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliJson.status, 0, cliJson.stderr);
  const parsed = JSON.parse(cliJson.stdout);
  assert.equal(parsed.reactWebActivation.state, "blocked");
  assert.equal(parsed.reactWebActivation.available, false);
  assert.match(parsed.reactWebActivation.readError, /Unexpected token|Expected property name|JSON/);
  assert.ok(parsed.reactWebActivation.risks.some((risk) => /unable to read React Web activation readiness/.test(risk)));
});
