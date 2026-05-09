// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(cwd, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result.stdout;
}

function runCliJson(cwd, args) {
  return JSON.parse(runCli(cwd, args));
}

test("Codex glob-match runtime promotion is inspectable from CLI, status, and doctor surfaces", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-glob-cli-"));
  const componentDir = path.join(tempDir, "src", "components");
  fs.mkdirSync(componentDir, { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"),
    path.join(componentDir, "FormSection.tsx"),
  );

  const sessionId = `glob-runtime-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  runCliJson(tempDir, ["codex-runtime-hook", "--event", "SessionStart", "--session-id", sessionId, "--json"]);
  const first = runCliJson(tempDir, [
    "codex-runtime-hook",
    "--event",
    "UserPromptSubmit",
    "--session-id",
    sessionId,
    "--prompt",
    "Please update FormSection.tsx",
    "--json",
  ]);
  const second = runCliJson(tempDir, [
    "codex-runtime-hook",
    "--event",
    "UserPromptSubmit",
    "--session-id",
    sessionId,
    "--prompt",
    "Again, update FormSection.tsx and keep the React Web context compact if safe",
    "--json",
  ]);

  assert.equal(first.action, "record");
  assert.equal(first.promptSpecificity, "file-hinted");
  assert.equal(second.action, "inject");
  assert.equal(second.promptSpecificity, "file-hinted");
  assert.ok(second.reasons.includes("glob-match-runtime-target"));
  assert.equal(second.debug.reactWebActivationMode.profileGateVerdict, "deferred");
  assert.equal(second.debug.reactWebActivationMode.globMatchVerdict, "would-activate");
  assert.equal(second.debug.reactWebActivationMode.promotedTrigger, "glob-match");

  const activationId = second.debug.reactWebEvidenceArtifact.id;
  const activation = runCliJson(tempDir, ["inspect", "activation-mode", activationId, "--json"]);
  assert.equal(activation.profileGate.verdict, "deferred");
  assert.equal(activation.globMatch.verdict, "would-activate");
  assert.equal(activation.promotedTrigger, "glob-match");

  const statusJson = runCliJson(tempDir, ["status", "react-web", "--json"]);
  assert.equal(statusJson.activationMode.profileGateVerdict, "deferred");
  assert.equal(statusJson.activationMode.globMatchVerdict, "would-activate");
  assert.equal(statusJson.activationMode.promotedTrigger, "glob-match");

  const statusText = runCli(tempDir, ["status", "react-web"]);
  assert.match(statusText, /promoted trigger: glob-match/);
  assert.match(statusText, /profile-gate runtime gate: deferred/);
  assert.match(statusText, /glob-match runtime gate: would-activate/);

  const doctorJson = runCliJson(tempDir, ["doctor", "codex", "--json"]);
  assert.equal(doctorJson.reactWebActivation.profileGateAdvisory.verdict, "deferred");
  assert.equal(doctorJson.reactWebActivation.globMatchAdvisory.verdict, "would-activate");
  assert.equal(doctorJson.reactWebActivation.promotedTrigger, "glob-match");

  const doctorText = runCli(tempDir, ["doctor", "codex"]);
  assert.match(doctorText, /promoted trigger: glob-match/);
  assert.match(doctorText, /profile-gate runtime gate: deferred/);
  assert.match(doctorText, /glob-match runtime gate: would-activate/);
});
