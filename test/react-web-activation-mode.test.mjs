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
  REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS,
  REACT_WEB_ACTIVATION_MODE_SCHEMA_VERSION,
  buildReactWebActivationMode,
  buildReactWebActivationModeFromRuntimeDecision,
  readReactWebActivationMode,
  renderReactWebActivationModeMarkdown,
} = require(path.join(repoRoot, "dist", "core", "react-web-activation-mode.js"));
const {
  REACT_WEB_EVIDENCE_ARTIFACT_CLAIM_BOUNDARY,
  REACT_WEB_EVIDENCE_ARTIFACT_COMPRESSION_POLICY,
  REACT_WEB_EVIDENCE_ARTIFACT_INTEROP,
  REACT_WEB_EVIDENCE_ARTIFACT_PAYLOAD_KIND,
  REACT_WEB_EVIDENCE_ARTIFACT_PRODUCER,
  REACT_WEB_EVIDENCE_ARTIFACT_PROFILE,
  REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION,
} = require(path.join(repoRoot, "dist", "core", "react-web-evidence-artifact.js"));
const { hashText } = require(path.join(repoRoot, "dist", "core", "hash.js"));

const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function writeFixture(tempDir, fixturePath, fileName) {
  fs.writeFileSync(path.join(tempDir, fileName), fs.readFileSync(path.join(repoRoot, fixturePath), "utf8"));
}

function runRepeatedDecision(tempDir, fileName, secondPrompt) {
  const sessionId = `react-web-activation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Please inspect ${fileName}` }, tempDir);
  const second = handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: secondPrompt }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "Stop", sessionId }, tempDir);
  return second;
}

function makeArtifact(overrides = {}) {
  return {
    schemaVersion: REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION,
    id: "react-web-evidence-activation-synthetic",
    generatedAt: "2026-05-09T00:00:00.000Z",
    producer: REACT_WEB_EVIDENCE_ARTIFACT_PRODUCER,
    profile: REACT_WEB_EVIDENCE_ARTIFACT_PROFILE,
    payloadKind: REACT_WEB_EVIDENCE_ARTIFACT_PAYLOAD_KIND,
    runtime: "codex",
    hookEventName: "UserPromptSubmit",
    decision: "use",
    evidenceStrength: "direct",
    filePath: "src/components/FormSection.tsx",
    reasons: ["repeated-same-file-runtime-decision"],
    whyDenied: [],
    claimBoundary: REACT_WEB_EVIDENCE_ARTIFACT_CLAIM_BOUNDARY,
    compressionPolicy: REACT_WEB_EVIDENCE_ARTIFACT_COMPRESSION_POLICY,
    interop: { ...REACT_WEB_EVIDENCE_ARTIFACT_INTEROP },
    sourceFingerprint: {
      fileHash: "abc123",
      lineCount: 42,
    },
    freshness: {
      sourceFingerprint: {
        fileHash: "abc123",
        lineCount: 42,
      },
      staleWhen: ["sourceFingerprint.fileHash changes"],
    },
    files: [
      {
        path: "src/components/FormSection.tsx",
        symbols: ["FormSection"],
        lineRanges: ["1-40"],
        whySelected: ["exact-file-prompt-target"],
      },
    ],
    editGuidance: {
      patchTargets: [
        { kind: "component", label: "FormSection", reason: "primary component", loc: { startLine: 1, endLine: 40 } },
      ],
    },
    concernProfiles: [],
    domainPayload: {
      domain: "react-web",
      policy: "measured-source-context",
      plannerDecision: "compact-safe",
      claimStatus: "current-supported-lane",
      claimBoundary: "react-web-measured-extraction",
      evidence: ["same-file-evidence"],
      facts: {},
      warnings: [],
    },
    ...overrides,
  };
}

test("inspect activation-mode reads a repeated React Web artifact and stays advisory-only", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-activation-runtime-"));
  writeFixture(tempDir, "fixtures/compressed/FormSection.tsx", "FormSection.tsx");

  const second = runRepeatedDecision(
    tempDir,
    "FormSection.tsx",
    "Please update FormSection.tsx again and keep the same-file React Web context compact if safe",
  );

  assert.equal(second.action, "inject");
  const ref = second.debug?.reactWebEvidenceArtifact;
  assert.equal(ref?.emitted, true);

  const activationMode = readReactWebActivationMode(tempDir, ref.id);
  assert.equal(activationMode.schemaVersion, REACT_WEB_ACTIVATION_MODE_SCHEMA_VERSION);
  assert.equal(activationMode.verdict, "would-activate");
  assert.equal(activationMode.supportedTrigger.name, "repeated-file");
  assert.equal(activationMode.supportedTrigger.positive, true);
  assert.equal(activationMode.profileGate.name, "profile-gate");
  assert.equal(activationMode.profileGate.verdict, "would-activate");
  assert.deepEqual(
    activationMode.deferredTriggers.map((item) => item.name),
    [...REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS],
  );

  const markdown = renderReactWebActivationModeMarkdown(activationMode);
  assert.match(markdown, /React Web activation mode/);
  assert.match(markdown, /repeated-file-runtime/);

  const cliJson = spawnSync(process.execPath, [cliPath, "inspect", "activation-mode", ref.id, "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliJson.status, 0, cliJson.stderr);
  const parsed = JSON.parse(cliJson.stdout);
  assert.equal(parsed.artifactId, ref.id);
  assert.equal(parsed.verdict, "would-activate");
  assert.equal(parsed.profileGate.verdict, "would-activate");
});

test("activation mode keeps non-repeated activation triggers explicitly deferred", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-activation-deferred-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "src", "components", "FormSection.tsx"), "export function FormSection() { return null; }\n");

  const activationMode = buildReactWebActivationMode(tempDir, makeArtifact({
    filePath: "src/components/FormSection.tsx",
    sourceFingerprint: {
      fileHash: "not-current",
      lineCount: 999,
    },
    freshness: {
      sourceFingerprint: {
        fileHash: "not-current",
        lineCount: 999,
      },
      staleWhen: ["sourceFingerprint.fileHash changes"],
    },
  }));

  assert.equal(activationMode.verdict, "deferred");
  assert.equal(activationMode.supportedTrigger.positive, false);
  assert.equal(activationMode.profileGate.verdict, "deferred");
  assert.deepEqual(
    activationMode.deferredTriggers.map((item) => item.name),
    [...REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS],
  );
});

test("runtime activation promotion does not require patchTargets when repeated React Web evidence is fresh", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-activation-runtime-candidate-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  const source = "export function FormSection() { return null; }\n";
  const filePath = path.join(tempDir, "src", "components", "FormSection.tsx");
  fs.writeFileSync(filePath, source);

  const runtimeDecision = {
    runtime: "codex",
    hookEventName: "UserPromptSubmit",
    action: "inject",
    filePath: "src/components/FormSection.tsx",
    reasons: ["repeated-file"],
    contextMode: "light",
    contextModeReason: "repeated-exact-file-react-web-payload",
    promptSpecificity: "exact-file",
    debug: {
      repeatedFile: true,
      eligible: true,
      escapeHatchUsed: false,
      decision: {
        decision: "payload",
        eligible: true,
        reasons: ["react-web-current-supported-payload"],
        payload: makeArtifact({
          filePath: "src/components/FormSection.tsx",
          sourceFingerprint: {
            fileHash: hashText(source),
            lineCount: 2,
          },
          freshness: {
            sourceFingerprint: {
              fileHash: hashText(source),
              lineCount: 2,
            },
            staleWhen: ["sourceFingerprint.fileHash changes"],
          },
          editGuidance: undefined,
        }),
        debug: {
          domainDetection: {
            classification: "react-web",
          },
        },
      },
    },
  };

  const activationMode = buildReactWebActivationModeFromRuntimeDecision(tempDir, runtimeDecision);
  assert.equal(activationMode?.verdict, "would-activate");
  assert.equal(activationMode?.supportedTrigger.positive, true);
  assert.equal(activationMode?.profileGate.verdict, "would-activate");
});

test("activation mode fail-closes deny boundary artifacts instead of widening support", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-activation-blocked-"));
  const activationMode = buildReactWebActivationMode(tempDir, makeArtifact({
    decision: "deny",
    evidenceStrength: "denied",
    whyDenied: ["unsupported-react-native-webview-boundary"],
    domainPayload: {
      domain: "webview",
      policy: "fallback-first",
      plannerDecision: "fallback-only",
      claimStatus: "unsupported-lane",
      claimBoundary: "unsupported-react-native-webview-boundary",
      evidence: ["webview-signal"],
      facts: {},
      warnings: [],
    },
  }));

  assert.equal(activationMode.verdict, "blocked");
  assert.equal(activationMode.supportedTrigger.positive, false);
  assert.equal(activationMode.profileGate.verdict, "blocked");
  assert.ok(activationMode.blockedReasons.includes("unsupported-react-native-webview-boundary"));
});
