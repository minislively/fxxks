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
const {
  assessTuiInkPayloadPolicy,
  TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY,
  TUI_INK_EVIDENCE_ONLY_REASON,
} = require(path.join(repoRoot, "dist", "core", "payload-policy", "tui-ink.js"));
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const forbiddenSupportClaims = /TUI support is available|TUI is supported today|TUI\/Ink is supported today|terminal correctness is guaranteed|terminal UX safety is guaranteed|runtime-token savings are available|provider-token savings are available|billing savings are available|TUI performance improvement is available|default TUI compact extraction is enabled/i;

function detect(source, filePath = "Cli.tsx") {
  return detectDomainFromSource(source, filePath);
}

function readFixture(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function tuiInkSource() {
  return `import React from "react";
    import { Box, Text, useInput } from "ink";
    export function Cli() {
      useInput(() => null);
      return <Box><Text>Ready</Text></Box>;
    }`;
}

const tuiEvidenceMatrix = [
  {
    fileName: "tui-ink-basic.tsx",
    classification: "tui-ink",
    claimStatus: "evidence-only",
    expectedPolicy: expectedTuiEvidenceOnlyPolicy,
    fallbackReason: () => preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  },
  {
    fileName: "tui-ink-interactive-list.tsx",
    classification: "tui-ink",
    claimStatus: "evidence-only",
    expectedPolicy: expectedTuiEvidenceOnlyPolicy,
    fallbackReason: () => "raw-mode",
  },
  {
    fileName: "tui-ink-status-panel.tsx",
    classification: "tui-ink",
    claimStatus: "evidence-only",
    expectedPolicy: expectedTuiEvidenceOnlyPolicy,
    fallbackReason: () => "raw-mode",
  },
  {
    fileName: "tui-non-ink-cli-renderer.tsx",
    classification: "unknown",
    claimStatus: "deferred",
    expectedPolicy: () => undefined,
    fallbackReason: () => undefined,
  },
];

function tuiFixturePath(fileName) {
  return path.join("test", "fixtures", "frontend-domain-expectations", fileName);
}

function expectedTuiEvidenceOnlyPolicy() {
  return {
    name: TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY,
    allowed: false,
    reason: TUI_INK_EVIDENCE_ONLY_REASON,
  };
}

function assertFallbackWithoutPayload(decision) {
  assert.equal(decision.eligible, true);
  assert.equal(decision.decision, "fallback");
  assert.ok(decision.reasons.length > 0);
  assert.equal(decision.fallback.action, "full-read");
  assert.equal("payload" in decision, false);
}

function assertTuiFallbackWithoutPayload(decision, reason) {
  assert.equal(decision.eligible, true);
  assert.equal(decision.decision, "fallback");
  assert.deepEqual(decision.reasons, [reason]);
  assert.equal(decision.fallback.reason, reason);
  assert.equal(decision.debug.domainDetection.classification, "tui-ink");
  assert.deepEqual(decision.debug.frontendPayloadPolicy, expectedTuiEvidenceOnlyPolicy());
  assert.equal("payload" in decision, false);
}

test("TUI/Ink payload policy returns evidence-only denied decision for Ink evidence", () => {
  const domainDetection = detect(tuiInkSource(), "Cli.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.profile.claimStatus, "evidence-only");
  assert.ok(domainDetection.signals.some((signal) => signal.startsWith("tui-ink:")));
  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedTuiEvidenceOnlyPolicy());
});

test("TUI/Ink payload policy does not authorize non-TUI domains", () => {
  const samples = [
    detect(`export function Form() { return <form><input name="email" /></form>; }`, "Form.tsx"),
    detect(`import { View, TextInput, Text, Pressable } from "react-native"; export function Native() { return <View><TextInput onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable></View>; }`, "Native.tsx"),
    detect(`import { WebView } from "react-native-webview"; export function Preview() { return <WebView source={{ uri: "https://example.com" }} />; }`, "Preview.tsx"),
    detect(`import { Box } from "ink"; import { View } from "react-native"; export function Mixed() { return <Box><View /></Box>; }`, "Mixed.tsx"),
    detect(`export const answer = 42;`, "utility.ts"),
  ];

  for (const domainDetection of samples) {
    assert.equal(
      assessTuiInkPayloadPolicy(domainDetection),
      undefined,
      `${domainDetection.classification}:${domainDetection.reason ?? "no-reason"} must not get TUI/Ink policy`,
    );
  }
});

test("pre-read compatibility entrypoint delegates TUI/Ink decisions to the policy seam", () => {
  const domainDetection = detect(tuiInkSource(), "Cli.tsx");

  assert.deepEqual(preRead.assessFrontendPayloadPolicy(domainDetection), assessTuiInkPayloadPolicy(domainDetection));
  assert.equal(preRead.TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY, TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY);
});

test("TUI/Ink pre-read stays fallback-only even with an explicit denied policy", () => {
  const fixturePath = path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", "tui-ink-basic.tsx");
  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertTuiFallbackWithoutPayload(decision, preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
});

test("TUI/Ink interactive list fixture remains evidence-only and fallback-safe", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-ink-interactive-list.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const domainDetection = detect(readFixture(relativeFixturePath), "tui-ink-interactive-list.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.profile.claimStatus, "evidence-only");
  assert.ok(domainDetection.signals.includes("tui-ink:import:ink"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Box"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Text"));
  assert.ok(domainDetection.signals.includes("tui-ink:hook:useInput"));
  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedTuiEvidenceOnlyPolicy());

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertTuiFallbackWithoutPayload(decision, "raw-mode");
});

test("TUI/Ink status panel fixture broadens evidence without payload permission", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-ink-status-panel.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const domainDetection = detect(readFixture(relativeFixturePath), "tui-ink-status-panel.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.profile.claimStatus, "evidence-only");
  assert.ok(domainDetection.signals.includes("tui-ink:import:ink"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Box"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Text"));
  assert.equal(domainDetection.signals.includes("tui-ink:hook:useInput"), false);
  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedTuiEvidenceOnlyPolicy());

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertTuiFallbackWithoutPayload(decision, "raw-mode");
});

test("non-Ink CLI renderer fixture stays outside TUI/Ink payload policy", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-non-ink-cli-renderer.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const domainDetection = detect(readFixture(relativeFixturePath), "tui-non-ink-cli-renderer.tsx");

  assert.notEqual(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.classification, "unknown");
  assert.equal(domainDetection.profile.claimStatus, "deferred");
  assert.equal(domainDetection.signals.some((signal) => signal.startsWith("tui-ink:")), false);
  assert.equal(assessTuiInkPayloadPolicy(domainDetection), undefined);

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertFallbackWithoutPayload(decision);
  assert.equal(decision.debug.domainDetection.classification, "unknown");
  assert.equal(decision.debug.frontendPayloadPolicy.allowed, false);
  assert.equal(decision.debug.frontendPayloadPolicy.reason, preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
});

test("TUI evidence matrix rows stay aligned with policy and pre-read boundaries", () => {
  for (const row of tuiEvidenceMatrix) {
    const relativeFixturePath = tuiFixturePath(row.fileName);
    const fixturePath = path.join(repoRoot, relativeFixturePath);
    const domainDetection = detect(readFixture(relativeFixturePath), row.fileName);
    const expectedPolicy = row.expectedPolicy();
    const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

    assert.equal(domainDetection.classification, row.classification, row.fileName);
    assert.equal(domainDetection.profile.claimStatus, row.claimStatus, row.fileName);
    assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedPolicy, row.fileName);
    assert.equal(decision.decision, "fallback", row.fileName);
    assert.equal("payload" in decision, false, row.fileName);

    const fallbackReason = row.fallbackReason();
    if (fallbackReason) {
      assert.deepEqual(decision.reasons, [fallbackReason], row.fileName);
      assert.equal(decision.fallback.reason, fallbackReason, row.fileName);
    }
  }
});

test("TUI/Ink policy seam source avoids broad terminal support claims", () => {
  for (const relativePath of [path.join("src", "core", "payload-policy", "tui-ink.ts")]) {
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"), forbiddenSupportClaims, relativePath);
  }
});

test("TUI/Ink fixture survey documents evidence-only reinforcement without support claims", () => {
  const survey = fs.readFileSync(path.join(repoRoot, "docs", "tui-fixture-candidates.md"), "utf8");

  assert.match(survey, /Current evidence-only reinforcement slice/);
  assert.match(survey, /tui-ink-basic\.tsx/);
  assert.match(survey, /tui-ink-interactive-list\.tsx/);
  assert.match(survey, /tui-ink-status-panel\.tsx/);
  assert.match(survey, /unsupported-frontend-domain-profile/);
  assert.match(survey, /tui-non-ink-cli-renderer\.tsx/);
  assert.match(survey, /Negative\/fallback reinforcement/);
  assert.match(survey, /Current TUI evidence matrix/);
  assert.match(survey, /tui-ink-evidence-only-payload/);
  assert.doesNotMatch(survey, forbiddenSupportClaims);
});

test("TUI operational readiness guide keeps payload planning separate", () => {
  const guide = fs.readFileSync(path.join(repoRoot, "docs", "tui-operational-readiness.md"), "utf8");

  assert.match(guide, /## Current state/);
  assert.match(guide, /## Fixture roles/);
  assert.match(guide, /## Allowed next work/);
  assert.match(guide, /## Promotion criteria before payload-design planning/);
  assert.match(guide, /## Stop rules/);
  assert.match(guide, /tui-ink-evidence-only-payload/);
  assert.match(guide, /fallback\/no-payload/);
  assert.match(guide, /serialized shared-policy plan/);
  assert.doesNotMatch(guide, forbiddenSupportClaims);
});
