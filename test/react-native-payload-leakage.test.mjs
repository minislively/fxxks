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
const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));
const { assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions } = require(
  path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"),
);
const { assessFrontendProfilePayloadReuse } = require(
  path.join(repoRoot, "dist", "core", "payload-policy", "profile-gate.js"),
);
const { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } = require(
  path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"),
);
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

function fixturePath(fileName) {
  return path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", fileName);
}

function fixtureSource(fileName) {
  return fs.readFileSync(fixturePath(fileName), "utf8");
}

function buildPayloadForSource(source, fileName) {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-rn-payload-leakage-"));
  try {
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, source);
    const domainDetection = detectDomainFromSource(source, filePath);
    const policy = assessFrontendPayloadPolicy(domainDetection);
    const extraction = extractFile(filePath);
    const payload = toModelFacingPayload(extraction, tempDir, {
      includeEditGuidance: false,
      includeReactWebContextMetadata: true,
      ...toFrontendPayloadBuildOptions(policy),
    });
    const reuse = assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy);
    const preReadDecision = preRead.decidePreRead(filePath, tempDir, "codex", { includeEditGuidance: true });
    return { domainDetection, policy, payload, reuse, preReadDecision };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildPayloadForFixture(fileName) {
  const filePath = fixturePath(fileName);
  const source = fixtureSource(fileName);
  const domainDetection = detectDomainFromSource(source, filePath);
  const policy = assessFrontendPayloadPolicy(domainDetection);
  const extraction = extractFile(filePath);
  const payload = toModelFacingPayload(extraction, repoRoot, {
    includeEditGuidance: false,
    includeReactWebContextMetadata: true,
    ...toFrontendPayloadBuildOptions(policy),
  });
  const reuse = assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy);
  const preReadDecision = preRead.decidePreRead(filePath, repoRoot, "codex", { includeEditGuidance: true });
  return { filePath, domainDetection, policy, payload, reuse, preReadDecision };
}

test("RN leakage guard keeps F1/F13 as the only payload-capable fixture lanes", () => {
  for (const fileName of ["rn-primitive-basic.tsx", "rn-primitive-inline-action.tsx"]) {
    const result = buildPayloadForFixture(fileName);

    assert.equal(result.domainDetection.classification, "react-native", fileName);
    assert.equal(result.policy?.allowed, true, fileName);
    assert.equal(result.payload.domainPayload?.domain, "react-native", fileName);
    assert.equal(result.payload.domainPayload?.claimBoundary, "rn-primitive-input-narrow-payload-only", fileName);
    assert.equal(result.reuse.allowed, true, fileName);
    assert.equal(result.preReadDecision.decision, "payload", fileName);
  }
});

test("RN leakage guard keeps F2/F9/F10 fixtures outside payload authorization", () => {
  const deniedFixtures = [
    ["F2", "rn-style-platform-navigation.tsx"],
    ["F9", "rn-interaction-gesture.tsx"],
    ["F10", "rn-image-scrollview.tsx"],
  ];

  for (const [slot, fileName] of deniedFixtures) {
    const result = buildPayloadForFixture(fileName);

    assert.equal(result.domainDetection.classification, "react-native", `${slot}:${fileName}`);
    assert.equal(result.policy?.allowed, false, `${slot}:${fileName}`);
    assert.equal(result.payload.domainPayload, undefined, `${slot}:${fileName}`);
    assert.deepEqual(result.reuse, { allowed: false, reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON }, `${slot}:${fileName}`);
    assert.equal(result.preReadDecision.decision, "fallback", `${slot}:${fileName}`);
    assert.equal("payload" in result.preReadDecision, false, `${slot}:${fileName}`);
  }
});

test("RN leakage guard fails closed when RN primitives mix with WebView markers", () => {
  const source = `
    import { View, Text, TextInput, Pressable } from "react-native";
    import { WebView } from "react-native-webview";

    export function MixedNativeWebView() {
      return (
        <View>
          <TextInput value="" onChangeText={() => null} />
          <Pressable onPress={() => null}><Text>Open</Text></Pressable>
          <WebView source={{ uri: "https://example.com" }} />
        </View>
      );
    }
  `;
  const result = buildPayloadForSource(source, "MixedNativeWebView.tsx");

  assert.equal(result.domainDetection.classification, "mixed");
  assert.equal(result.policy?.allowed, false);
  assert.equal(result.payload.domainPayload, undefined);
  assert.deepEqual(result.reuse, { allowed: false, reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON });
  assert.equal(result.preReadDecision.decision, "fallback");
  assert.equal("payload" in result.preReadDecision, false);
});

test("RN leakage guard fails closed when RN primitives mix with TUI/Ink markers", () => {
  const source = `
    import { View, Text, TextInput, Pressable } from "react-native";
    import { Box } from "ink";

    export function MixedNativeInk() {
      return (
        <View>
          <TextInput value="" onChangeText={() => null} />
          <Pressable onPress={() => null}><Text>Open</Text></Pressable>
          <Box><Text>CLI</Text></Box>
        </View>
      );
    }
  `;
  const result = buildPayloadForSource(source, "MixedNativeInk.tsx");

  assert.equal(result.domainDetection.classification, "mixed");
  assert.equal(result.policy?.allowed, false);
  assert.equal(result.payload.domainPayload, undefined);
  assert.deepEqual(result.reuse, { allowed: false, reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON });
  assert.equal(result.preReadDecision.decision, "fallback");
  assert.equal("payload" in result.preReadDecision, false);
});
