// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { detectDomainFromSource } = require(path.join(repoRoot, "dist", "core", "domain-detector.js"));
const {
  assessFallbackPayloadPolicy,
  MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY,
  UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY,
  UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
} = require(path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"));
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const forbiddenSupportClaims = /React Native support is available|React Native is supported today|WebView support is available|WebView is supported today|TUI support is available|TUI is supported today|TUI\/Ink is supported today|mixed frontend support is available|unknown frontend support is available|terminal correctness is guaranteed|bridge safety is guaranteed|default WebView compact extraction is enabled|default TUI compact extraction is enabled/i;

function detect(source, filePath = "Component.tsx") {
  return detectDomainFromSource(source, filePath);
}

function mixedWithoutWebViewSource() {
  return `import { Box, Text } from "ink";
    export function MixedCliWeb() {
      return <div className="shell"><Box><Text>Ready</Text></Box></div>;
    }`;
}

function unknownTsxSource() {
  return `export function PlainUnknown() {
    return null;
  }`;
}

function expectedMixedPolicy(reason = preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON) {
  return {
    name: MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY,
    allowed: false,
    reason,
  };
}

function expectedUnknownPolicy() {
  return {
    name: UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY,
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  };
}

test("fallback payload policy returns denied boundary decision for mixed frontend evidence", () => {
  const domainDetection = detect(mixedWithoutWebViewSource(), "MixedCliWeb.tsx");

  assert.equal(domainDetection.classification, "mixed");
  assert.equal(domainDetection.reason, preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.deepEqual(assessFallbackPayloadPolicy(domainDetection), expectedMixedPolicy(domainDetection.reason));
});

test("fallback payload policy returns denied deferred decision for unknown domains", () => {
  const domainDetection = detect(unknownTsxSource(), "PlainUnknown.tsx");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(domainDetection.profile.claimStatus, "deferred");
  assert.deepEqual(assessFallbackPayloadPolicy(domainDetection), expectedUnknownPolicy());
});

test("fallback payload policy does not override domain-owned policy lanes", () => {
  const samples = [
    detect(`export function Form() { return <form><input name="email" /></form>; }`, "Form.tsx"),
    detect(`import { View, TextInput, Text, Pressable } from "react-native"; export function Native() { return <View><TextInput onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable></View>; }`, "Native.tsx"),
    detect(`import { WebView } from "react-native-webview"; export function Preview() { return <WebView source={{ uri: "https://example.com" }} />; }`, "Preview.tsx"),
    detect(`import { Box } from "ink"; export function Cli() { return <Box />; }`, "Cli.tsx"),
  ];

  for (const domainDetection of samples) {
    assert.equal(
      assessFallbackPayloadPolicy(domainDetection),
      undefined,
      `${domainDetection.classification}:${domainDetection.reason ?? "no-reason"} must not get shared fallback policy`,
    );
  }
});

test("pre-read compatibility entrypoint delegates mixed and unknown decisions to the fallback seam", () => {
  const mixed = detect(mixedWithoutWebViewSource(), "MixedCliWeb.tsx");
  const unknown = detect(unknownTsxSource(), "PlainUnknown.tsx");

  assert.deepEqual(preRead.assessFrontendPayloadPolicy(mixed), assessFallbackPayloadPolicy(mixed));
  assert.deepEqual(preRead.assessFrontendPayloadPolicy(unknown), assessFallbackPayloadPolicy(unknown));
  assert.equal(preRead.MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY, MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY);
  assert.equal(preRead.UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY, UNKNOWN_FRONTEND_DEFERRED_PAYLOAD_POLICY);
  assert.equal(preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON, UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
});

test("mixed TSX pre-read keeps source-reading boundary fallback", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-mixed-fallback-policy-"));
  try {
    const filePath = path.join(tempDir, "MixedCliWeb.tsx");
    fs.writeFileSync(filePath, mixedWithoutWebViewSource());
    const decision = preRead.decidePreRead(filePath, tempDir, "codex");

    assert.equal(decision.eligible, true);
    assert.equal(decision.decision, "fallback");
    assert.deepEqual(decision.reasons, [preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON]);
    assert.equal(decision.fallback.reason, preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
    assert.equal(decision.debug.domainDetection.classification, "mixed");
    assert.deepEqual(decision.debug.frontendPayloadPolicy, expectedMixedPolicy());
    assert.equal("payload" in decision, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("unknown TSX pre-read stays fallback while unknown TS beta modules can still payload", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-unknown-fallback-policy-"));
  try {
    const tsxPath = path.join(tempDir, "PlainUnknown.tsx");
    fs.writeFileSync(tsxPath, unknownTsxSource());
    const tsxDecision = preRead.decidePreRead(tsxPath, tempDir, "codex");

    assert.equal(tsxDecision.eligible, true);
    assert.equal(tsxDecision.decision, "fallback");
    assert.deepEqual(tsxDecision.reasons, [UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON]);
    assert.equal(tsxDecision.fallback.reason, UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
    assert.equal(tsxDecision.debug.domainDetection.classification, "unknown");
    assert.deepEqual(tsxDecision.debug.frontendPayloadPolicy, expectedUnknownPolicy());
    assert.equal("payload" in tsxDecision, false);

    const tsPath = path.join(tempDir, "module-utils.ts");
    fs.writeFileSync(tsPath, `export function double(value: number): number { return value * 2; }\n`);
    const tsDecision = preRead.decidePreRead(tsPath, tempDir, "codex");

    assert.equal(tsDecision.eligible, true);
    assert.equal(tsDecision.decision, "payload");
    assert.equal(tsDecision.debug.domainDetection.classification, "unknown");
    assert.deepEqual(tsDecision.debug.frontendPayloadPolicy, expectedUnknownPolicy());
    assert.ok(tsDecision.payload.structure.moduleDeclarations?.length);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("fallback policy seam source avoids broad mixed or unknown support claims", () => {
  for (const relativePath of [path.join("src", "core", "payload-policy", "fallback.ts")]) {
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"), forbiddenSupportClaims, relativePath);
  }
});
