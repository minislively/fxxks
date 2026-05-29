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
  REACT_WEB_EVIDENCE_ARTIFACT_CLAIM_BOUNDARY,
  REACT_WEB_EVIDENCE_ARTIFACT_COMPRESSION_POLICY,
  REACT_WEB_EVIDENCE_ARTIFACT_INTEROP,
  REACT_WEB_EVIDENCE_ARTIFACT_PAYLOAD_KIND,
  REACT_WEB_EVIDENCE_ARTIFACT_PRODUCER,
  REACT_WEB_EVIDENCE_ARTIFACT_PROFILE,
  REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION,
} = require(path.join(repoRoot, "dist", "reporting", "react-web-evidence-artifact.js"));
const {
  REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT,
  REACT_WEB_RANKED_BUNDLE_SCHEMA_VERSION,
  buildReactWebRankedBundle,
  readReactWebRankedBundle,
  renderReactWebRankedBundleMarkdown,
} = require(path.join(repoRoot, "dist", "reporting", "react-web-ranked-bundle.js"));

const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function writeFixture(tempDir, fixturePath, fileName) {
  fs.writeFileSync(path.join(tempDir, fileName), fs.readFileSync(path.join(repoRoot, fixturePath), "utf8"));
}

function writeLargeFixture(tempDir, fixturePath, fileName) {
  const source = fs.readFileSync(path.join(repoRoot, fixturePath), "utf8");
  fs.writeFileSync(path.join(tempDir, fileName), `${source}\n{/* ${"admission budget filler ".repeat(1000)} */}\n`);
}

function runRepeatedDecision(tempDir, fileName, secondPrompt) {
  const sessionId = `react-web-ranked-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Please inspect ${fileName}` }, tempDir);
  const second = handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: secondPrompt }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "Stop", sessionId }, tempDir);
  return second;
}

function makeArtifact(overrides = {}) {
  return {
    schemaVersion: REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION,
    id: "react-web-evidence-synthetic",
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
        { kind: "event-handler", label: "handleSubmit", reason: "submit behavior", loc: { startLine: 18, endLine: 24 } },
      ],
    },
    concernProfiles: [
      {
        kind: "concern",
        id: "routing",
        claim: "This source contains routing concern evidence.",
        signals: ["react-router"],
        nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
      },
      {
        kind: "concern",
        id: "styling",
        claim: "This source contains styling concern evidence.",
        signals: ["clsx"],
        nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
      },
    ],
    domainPayload: {
      domain: "react-web",
      policy: "measured-source-context",
      plannerDecision: "compact-safe",
      claimStatus: "current-supported-lane",
      claimBoundary: "react-web-measured-extraction",
      evidence: ["same-file-evidence", "direct-component-target"],
      facts: {},
      warnings: [],
    },
    ...overrides,
  };
}

test("inspect ranked-bundle reads a repeated React Web artifact and exposes a shadow diagnostic bundle", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-ranked-bundle-runtime-"));
  writeLargeFixture(tempDir, "fixtures/compressed/FormSection.tsx", "FormSection.tsx");

  const second = runRepeatedDecision(
    tempDir,
    "FormSection.tsx",
    "Please update FormSection.tsx again and keep the same-file React Web context compact if safe",
  );

  assert.equal(second.action, "inject");
  const ref = second.debug?.reactWebEvidenceArtifact;
  assert.equal(ref?.emitted, true);

  const bundle = readReactWebRankedBundle(tempDir, ref.id);
  assert.equal(bundle.schemaVersion, REACT_WEB_RANKED_BUNDLE_SCHEMA_VERSION);
  assert.equal(bundle.artifactId, ref.id);
  assert.equal(bundle.verdict, "ranked");
  assert.equal(bundle.failClosed, false);
  assert.equal(bundle.repeatedSameFileEligible, true);
  assert.ok(bundle.selected.length > 0);

  const markdown = renderReactWebRankedBundleMarkdown(bundle);
  assert.match(markdown, /React Web ranked bundle/);
  assert.match(markdown, /shadow-diagnostic/);

  const cliJson = spawnSync(process.execPath, [cliPath, "inspect", "ranked-bundle", ref.id, "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  assert.equal(cliJson.status, 0, cliJson.stderr);
  const parsed = JSON.parse(cliJson.stdout);
  assert.equal(parsed.artifactId, ref.id);
  assert.equal(parsed.verdict, "ranked");
  assert.equal(parsed.mode, "shadow-diagnostic");
});

test("ranked bundle prioritizes direct same-file patch targets ahead of adjacent concern signals", () => {
  const bundle = buildReactWebRankedBundle(makeArtifact());
  assert.equal(bundle.selected[0].source, "patch-target");
  assert.equal(bundle.selected[0].entryClass, "direct");
  assert.match(bundle.selected[0].label, /component:/);
  assert.equal(bundle.selected.at(-1)?.entryClass, "adjacent");
});

test("ranked bundle marks overflow as fallback and defers entries beyond the budget", () => {
  const patchTargets = Array.from({ length: REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT + 2 }, (_, index) => ({
    kind: index === 0 ? "component" : "snippet",
    label: `target-${index}`,
    reason: `reason-${index}`,
    loc: { startLine: index + 1, endLine: index + 1 },
  }));
  const concernProfiles = [
    {
      kind: "concern",
      id: "client-state",
      claim: "This source contains client-state concern evidence.",
      signals: ["zustand"],
      nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    },
  ];

  const bundle = buildReactWebRankedBundle(makeArtifact({
    editGuidance: { patchTargets },
    concernProfiles,
  }));

  assert.equal(bundle.verdict, "fallback");
  assert.equal(bundle.budget.limit, REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT);
  assert.equal(bundle.budget.selected, REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT);
  assert.ok(bundle.budget.deferred > 0);
  assert.equal(bundle.budget.overflow, true);
  assert.ok(bundle.fallbackReasons.includes("bundle-budget-exceeded"));
  assert.equal(bundle.deferred.length, patchTargets.length + concernProfiles.length + 1 - REACT_WEB_RANKED_BUNDLE_BUDGET_LIMIT);
});

test("ranked bundle fail-closes mixed boundary deny artifacts instead of widening support", () => {
  const bundle = buildReactWebRankedBundle(makeArtifact({
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
      warnings: ["boundary"],
    },
  }));

  assert.equal(bundle.verdict, "blocked");
  assert.equal(bundle.failClosed, true);
  assert.equal(bundle.selected.length, 0);
  assert.ok(bundle.fallbackReasons.includes("unsupported-react-native-webview-boundary"));
});
