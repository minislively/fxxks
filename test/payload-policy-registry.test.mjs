// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { detectDomainFromSource } = require(path.join(repoRoot, "dist", "core", "domain-detector.js"));
const registry = require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"));
const { assessReactWebPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "react-web.js"));
const { assessWebViewPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "webview.js"));
const { assessTuiInkPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "tui-ink.js"));
const { assessReactNativePayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "react-native.js"));
const { assessFallbackPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"));
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

function detect(source, filePath = "Component.tsx") {
  return detectDomainFromSource(source, filePath);
}

const samples = {
  "react-web": detect(`export function Form() { return <form><input name="email" /></form>; }`, "Form.tsx"),
  webview: detect(`import { WebView } from "react-native-webview"; export function Preview() { return <WebView source={{ uri: "https://example.com" }} />; }`, "Preview.tsx"),
  "tui-ink": detect(`import { Box } from "ink"; export function Cli() { return <Box />; }`, "Cli.tsx"),
  "react-native": detect(`import { View, TextInput, Text, Pressable } from "react-native"; export function Native() { return <View><TextInput onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable></View>; }`, "Native.tsx"),
  mixed: detect(`import { Box, Text } from "ink"; export function MixedCliWeb() { return <div><Box><Text>Ready</Text></Box></div>; }`, "MixedCliWeb.tsx"),
  unknown: detect(`export function PlainUnknown() { return null; }`, "PlainUnknown.tsx"),
};

test("frontend payload policy registry preserves explicit policy precedence", () => {
  assert.deepEqual(
    registry.FRONTEND_PAYLOAD_POLICY_REGISTRY.map((entry) => entry.lane),
    ["react-web", "webview", "tui-ink", "react-native", "fallback"],
  );

  assert.deepEqual(
    registry.FRONTEND_PAYLOAD_POLICY_REGISTRY.map((entry) => typeof entry.assess),
    ["function", "function", "function", "function", "function"],
  );
});

test("frontend payload policy registry returns the same decisions as lane-owned seams", () => {
  const expectedByLane = {
    "react-web": assessReactWebPayloadPolicy(samples["react-web"]),
    webview: assessWebViewPayloadPolicy(samples.webview),
    "tui-ink": assessTuiInkPayloadPolicy(samples["tui-ink"]),
    "react-native": assessReactNativePayloadPolicy(samples["react-native"]),
    mixed: assessFallbackPayloadPolicy(samples.mixed),
    unknown: assessFallbackPayloadPolicy(samples.unknown),
  };

  for (const [lane, domainDetection] of Object.entries(samples)) {
    assert.deepEqual(registry.assessFrontendPayloadPolicy(domainDetection), expectedByLane[lane], lane);
  }

  assert.deepEqual(registry.assessFrontendPayloadPolicy(samples["react-web"]), {
    name: "react-web-current-supported-lane",
    allowed: true,
  });
  assert.deepEqual(registry.assessFrontendPayloadPolicy(samples.webview), {
    name: "webview-boundary-fallback",
    allowed: false,
    reason: "unsupported-react-native-webview-boundary",
  });
  assert.deepEqual(registry.assessFrontendPayloadPolicy(samples["tui-ink"]), {
    name: "tui-ink-evidence-only-payload",
    allowed: false,
    reason: "tui-ink-evidence-only",
  });
  assert.deepEqual(registry.assessFrontendPayloadPolicy(samples.mixed), {
    name: "mixed-frontend-boundary-fallback",
    allowed: false,
    reason: "unsupported-react-native-webview-boundary",
  });
  assert.deepEqual(registry.assessFrontendPayloadPolicy(samples.unknown), {
    name: "unknown-frontend-deferred-fallback",
    allowed: false,
    reason: "unsupported-frontend-domain-profile",
  });
});

test("pre-read compatibility entrypoint exports the core policy registry APIs", () => {
  assert.equal(preRead.assessFrontendPayloadPolicy, registry.assessFrontendPayloadPolicy);
  assert.equal(preRead.toFrontendPayloadBuildOptions, registry.toFrontendPayloadBuildOptions);

  for (const [lane, domainDetection] of Object.entries(samples)) {
    assert.deepEqual(preRead.assessFrontendPayloadPolicy(domainDetection), registry.assessFrontendPayloadPolicy(domainDetection), lane);
  }
});

test("frontend payload build options include domain payload for React Web and measured RN narrow policies", () => {
  const reactWebPolicy = registry.assessFrontendPayloadPolicy(samples["react-web"]);
  const reactNativePolicy = registry.assessFrontendPayloadPolicy(samples["react-native"]);

  assert.deepEqual(registry.toFrontendPayloadBuildOptions(reactWebPolicy), {
    includeDomainPayload: true,
    domainPayloadPolicy: reactWebPolicy.name,
  });
  assert.deepEqual(registry.toFrontendPayloadBuildOptions(reactNativePolicy), {
    includeDomainPayload: true,
    domainPayloadPolicy: reactNativePolicy.name,
  });

  for (const lane of ["webview", "tui-ink", "mixed", "unknown"]) {
    const policy = registry.assessFrontendPayloadPolicy(samples[lane]);
    assert.deepEqual(
      registry.toFrontendPayloadBuildOptions(policy),
      { includeDomainPayload: false, domainPayloadPolicy: policy.name },
      lane,
    );
  }

  assert.deepEqual(registry.toFrontendPayloadBuildOptions(undefined), { includeDomainPayload: false });
});

test("registry build options are the only public seam for policy-shaped payload options", () => {
  for (const lane of Object.keys(samples)) {
    const viaRegistry = registry.toFrontendPayloadBuildOptions(registry.assessFrontendPayloadPolicy(samples[lane]));
    const viaPreReadCompatibility = preRead.toFrontendPayloadBuildOptions(preRead.assessFrontendPayloadPolicy(samples[lane]));

    assert.deepEqual(viaPreReadCompatibility, viaRegistry, lane);
  }
});
