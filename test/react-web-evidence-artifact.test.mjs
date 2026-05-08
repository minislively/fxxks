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
  REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION,
  readReactWebEvidenceArtifact,
  renderReactWebEvidenceArtifactMarkdown,
} = require(path.join(repoRoot, "dist", "core", "react-web-evidence-artifact.js"));

const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function writeFixture(tempDir, fixturePath, fileName) {
  fs.writeFileSync(path.join(tempDir, fileName), fs.readFileSync(path.join(repoRoot, fixturePath), "utf8"));
}

function runRepeatedDecision(tempDir, fileName, secondPrompt) {
  const sessionId = `react-web-evidence-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Please inspect ${fileName}` }, tempDir);
  const second = handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: secondPrompt }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "Stop", sessionId }, tempDir);
  return second;
}

test("repeated React Web inject emits a schema-first evidence artifact and inspect surfaces can read it", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-evidence-artifact-"));
  writeFixture(tempDir, "fixtures/compressed/FormSection.tsx", "FormSection.tsx");

  const second = runRepeatedDecision(
    tempDir,
    "FormSection.tsx",
    "Please update FormSection.tsx again and keep the same-file React Web context compact if safe",
  );

  assert.equal(second.action, "inject");
  const ref = second.debug?.reactWebEvidenceArtifact;
  assert.equal(ref?.emitted, true);
  assert.ok(ref?.id);
  assert.ok(fs.existsSync(ref.path));

  const artifact = readReactWebEvidenceArtifact(tempDir, ref.id);
  assert.equal(artifact.schemaVersion, REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION);
  assert.equal(artifact.id, ref.id);
  assert.equal(artifact.producer, "fooks");
  assert.equal(artifact.profile, "react-web");
  assert.equal(artifact.payloadKind, "frontend-source-evidence");
  assert.equal(artifact.decision, "use");
  assert.equal(artifact.evidenceStrength, "direct");
  assert.equal(artifact.compressionPolicy, "do-not-summarize");
  assert.deepEqual(artifact.interop, {
    mayBeStored: true,
    mayBeSummarized: false,
    mayOverrideDecision: false,
  });
  assert.equal(artifact.domainPayload?.domain, "react-web");
  assert.ok(artifact.sourceFingerprint);
  assert.ok(artifact.editGuidance?.patchTargets?.length > 0);
  assert.ok(artifact.files[0].whySelected.includes("exact-file-prompt-target"));
  assert.equal("confidence" in artifact, false);
  assert.equal("confidenceScore" in artifact, false);

  const latest = readReactWebEvidenceArtifact(tempDir, "latest");
  assert.equal(latest.id, artifact.id);

  const markdown = renderReactWebEvidenceArtifactMarkdown(artifact);
  assert.match(markdown, /React Web evidence artifact/);
  assert.match(markdown, /do-not-summarize/);
  assert.match(markdown, /frontend-source-evidence/);
  assert.match(markdown, /summarized=no/);

  const cliJson = spawnSync(process.execPath, [cliPath, "inspect", "evidence", ref.id, "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliJson.status, 0, cliJson.stderr);
  const parsed = JSON.parse(cliJson.stdout);
  assert.equal(parsed.id, artifact.id);
  assert.equal(parsed.decision, "use");
  assert.deepEqual(parsed.interop, artifact.interop);

  const cliText = spawnSync(process.execPath, [cliPath, "inspect", "evidence", ref.id], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliText.status, 0, cliText.stderr);
  assert.match(cliText.stdout, /React Web evidence artifact/);
  assert.match(cliText.stdout, new RegExp(artifact.id));
});

test("repeated unsupported boundary emits a denied evidence artifact instead of widening support", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-evidence-deny-"));
  writeFixture(tempDir, "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx", "Boundary.tsx");

  const second = runRepeatedDecision(
    tempDir,
    "Boundary.tsx",
    "Please inspect Boundary.tsx again and keep the same-file context compact if safe",
  );

  assert.equal(second.action, "fallback");
  const ref = second.debug?.reactWebEvidenceArtifact;
  assert.equal(ref?.emitted, true);

  const artifact = readReactWebEvidenceArtifact(tempDir, ref.id);
  assert.equal(artifact.decision, "deny");
  assert.equal(artifact.evidenceStrength, "denied");
  assert.deepEqual(artifact.interop, {
    mayBeStored: true,
    mayBeSummarized: false,
    mayOverrideDecision: false,
  });
  assert.match(artifact.whyDenied.join("\n"), /unsupported-react-native-webview-boundary/);
  assert.equal("confidence" in artifact, false);
  assert.equal("confidenceScore" in artifact, false);
});

test("inspect evidence fails clearly for missing ids", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-evidence-missing-"));
  const cli = spawnSync(process.execPath, [cliPath, "inspect", "evidence", "missing-id", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.notEqual(cli.status, 0);
  assert.match(`${cli.stdout}${cli.stderr}`, /React Web evidence artifact not found: missing-id/);
});
