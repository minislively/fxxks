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

function expectedTuiEvidenceOnlyPolicy() {
  return {
    name: TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY,
    allowed: false,
    reason: TUI_INK_EVIDENCE_ONLY_REASON,
  };
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
  assert.match(survey, /unsupported-frontend-domain-profile/);
  assert.doesNotMatch(survey, forbiddenSupportClaims);
});
