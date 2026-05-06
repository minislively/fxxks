// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { detectDomainFromSource } = require(path.join(repoRoot, "dist", "core", "domain-detector.js"));
const { projectTuiSourceMetadataDryRun } = require(path.join(repoRoot, "dist", "core", "tui-source-metadata.js"));
const { assessTuiInkPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "tui-ink.js"));
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const forbiddenSupportClaims = /TUI support is available|TUI is supported today|TUI\/Ink is supported today|terminal correctness is guaranteed|terminal UX safety is guaranteed|runtime-token savings are available|provider-token savings are available|billing savings are available|TUI performance improvement is available|default TUI compact extraction is enabled/i;

function fixturePath(fileName) {
  return path.join("test", "fixtures", "frontend-domain-expectations", fileName);
}

function readFixture(fileName) {
  return fs.readFileSync(path.join(repoRoot, fixturePath(fileName)), "utf8");
}

function projectFixture(fileName) {
  const sourceText = readFixture(fileName);
  const domainDetection = detectDomainFromSource(sourceText, fileName);
  return {
    domainDetection,
    metadata: projectTuiSourceMetadataDryRun({
      sourceText,
      filePath: fileName,
      domainDetection,
    }),
  };
}

function assertNonEmitting(metadata) {
  assert.equal(metadata.mode, "source-only-dry-run");
  assert.equal(metadata.nonEmitting, true);
  assert.deepEqual(metadata.integration, {
    cliVisible: false,
    modelFacingPayload: false,
    runtimeOrPreRead: false,
  });
  assert.ok(metadata.omittedRuntimeSemantics.includes("terminal-rendering-correctness"));
  assert.ok(metadata.omittedRuntimeSemantics.includes("tty-stdin-behavior"));
  assert.ok(metadata.omittedRuntimeSemantics.includes("key-handling-correctness"));
  assert.ok(metadata.omittedRuntimeSemantics.includes("command-execution-semantics"));
  assert.ok(metadata.omittedRuntimeSemantics.includes("token-or-performance-value"));
}

test("TUI source metadata projector derives safe source facts from basic Ink fixture", () => {
  const { domainDetection, metadata } = projectFixture("tui-ink-basic.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(metadata.classification, "tui-ink");
  assert.equal(metadata.claimStatus, "evidence-only");
  assertNonEmitting(metadata);
  assert.ok(metadata.terminalLayoutEvidence.includes("primitive:Box"));
  assert.ok(metadata.terminalLayoutEvidence.includes("primitive:Text"));
  assert.ok(metadata.terminalLayoutEvidence.includes("jsx-prop:flexDirection"));
  assert.ok(metadata.terminalTextStatusEvidence.includes("primitive:Text"));
  assert.ok(metadata.terminalInputFlowEvidence.includes("hook:useInput"));
  assert.ok(metadata.terminalInputFlowEvidence.includes("source-marker:useInput"));
  assert.deepEqual(metadata.terminalMixedBoundaryEvidence, []);
  assert.deepEqual(metadata.terminalNegativeBoundaryEvidence, []);
});

test("TUI source metadata projector maps prompt and style fixtures without behavior claims", () => {
  const prompt = projectFixture("tui-ink-form-prompt.tsx").metadata;
  const styled = projectFixture("tui-ink-layout-style.tsx").metadata;

  assertNonEmitting(prompt);
  assert.ok(prompt.terminalInputFlowEvidence.includes("source-marker:key.escape"));
  assert.ok(prompt.terminalInputFlowEvidence.includes("source-marker:key.return"));
  assert.ok(prompt.terminalTextStatusEvidence.includes("source-marker:errorMessage"));
  assert.ok(prompt.terminalTextStatusEvidence.includes("source-marker:submitted"));
  assert.ok(prompt.terminalStyleEvidence.includes("jsx-prop:color"));
  assert.ok(prompt.omittedRuntimeSemantics.includes("key-handling-correctness"));

  assertNonEmitting(styled);
  assert.ok(styled.terminalLayoutEvidence.includes("jsx-prop:flexDirection"));
  assert.ok(styled.terminalLayoutEvidence.includes("jsx-prop:gap"));
  assert.ok(styled.terminalLayoutEvidence.includes("jsx-prop:padding"));
  assert.ok(styled.terminalLayoutEvidence.includes("jsx-prop:paddingX"));
  assert.ok(styled.terminalStyleEvidence.includes("jsx-prop:color"));
  assert.ok(styled.terminalStyleEvidence.includes("jsx-prop:dimColor"));
  assert.ok(styled.terminalStyleEvidence.includes("jsx-prop:borderStyle"));
  assert.ok(styled.terminalStyleEvidence.includes("jsx-prop:borderColor"));
});

test("TUI source metadata projector records status text evidence without command semantics", () => {
  const { metadata } = projectFixture("tui-ink-status-panel.tsx");

  assertNonEmitting(metadata);
  assert.ok(metadata.terminalTextStatusEvidence.includes("source-marker:statusGlyph"));
  assert.ok(metadata.terminalTextStatusEvidence.includes("source-marker:phase"));
  assert.ok(metadata.terminalTextStatusEvidence.includes("source-marker:elapsedMs"));
  assert.ok(metadata.terminalTextStatusEvidence.includes("source-marker:messages"));
  assert.ok(metadata.omittedRuntimeSemantics.includes("command-execution-semantics"));
});

test("TUI source metadata projector keeps mixed and non-Ink cases as boundary evidence", () => {
  const webMixed = projectFixture("tui-ink-web-dom-mixed.tsx").metadata;
  const rnMixed = projectFixture("tui-ink-rn-narrow-mixed.tsx").metadata;
  const nonInk = projectFixture("tui-non-ink-cli-renderer.tsx").metadata;

  assertNonEmitting(webMixed);
  assert.equal(webMixed.classification, "mixed");
  assert.ok(webMixed.terminalMixedBoundaryEvidence.includes("mixed-with:react-web"));
  assert.deepEqual(webMixed.terminalNegativeBoundaryEvidence, []);

  assertNonEmitting(rnMixed);
  assert.equal(rnMixed.classification, "mixed");
  assert.ok(rnMixed.terminalMixedBoundaryEvidence.includes("mixed-with:react-native"));
  assert.deepEqual(rnMixed.terminalNegativeBoundaryEvidence, []);

  assertNonEmitting(nonInk);
  assert.equal(nonInk.classification, "unknown");
  assert.deepEqual(nonInk.terminalLayoutEvidence, []);
  assert.deepEqual(nonInk.terminalTextStatusEvidence, []);
  assert.deepEqual(nonInk.terminalInputFlowEvidence, []);
  assert.deepEqual(nonInk.terminalStyleEvidence, []);
  assert.deepEqual(nonInk.terminalMixedBoundaryEvidence, []);
  assert.ok(nonInk.terminalNegativeBoundaryEvidence.includes("no-tui-ink-evidence:unknown:deferred"));
});

test("TUI source metadata projector does not change denied policy or pre-read fallback", () => {
  const fileName = "tui-ink-basic.tsx";
  const sourceText = readFixture(fileName);
  const domainDetection = detectDomainFromSource(sourceText, fileName);
  const decision = preRead.decidePreRead(path.join(repoRoot, fixturePath(fileName)), repoRoot, "codex");

  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), {
    name: "tui-ink-evidence-only-payload",
    allowed: false,
    reason: "tui-ink-evidence-only",
  });
  assert.equal(decision.decision, "fallback");
  assert.equal(decision.fallback.action, "full-read");
  assert.equal("payload" in decision, false);
});

test("TUI source metadata projector stays internal and avoids broad terminal claims", () => {
  const source = fs.readFileSync(path.join(repoRoot, "src", "core", "tui-source-metadata.ts"), "utf8");

  assert.doesNotMatch(source, forbiddenSupportClaims);
  assert.match(source, /source-only-dry-run/);
  assert.match(source, /modelFacingPayload: false/);
  assert.match(source, /runtimeOrPreRead: false/);
  assert.match(source, /cliVisible: false/);
});
