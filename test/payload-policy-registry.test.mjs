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
const registry = require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"));
const { assessReactWebPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "react-web.js"));
const { assessWebViewPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "webview.js"));
const { assessTuiInkPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "tui-ink.js"));
const { assessReactNativePayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "react-native.js"));
const { assessFallbackPayloadPolicy } = require(path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"));
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const forbiddenSupportClaims = /React Native support is available|React Native is supported today|WebView support is available|WebView is supported today|TUI support is available|TUI is supported today|TUI\/Ink is supported today|mixed frontend support is available|unknown frontend support is available|terminal correctness is guaranteed|bridge safety is guaranteed|default WebView compact extraction is enabled|default TUI compact extraction is enabled/i;

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
});

test("pre-read compatibility entrypoint uses the core policy registry", () => {
  for (const [lane, domainDetection] of Object.entries(samples)) {
    assert.deepEqual(preRead.assessFrontendPayloadPolicy(domainDetection), registry.assessFrontendPayloadPolicy(domainDetection), lane);
  }
});

test("frontend payload build options include domain payload only for React Web policy", () => {
  const reactWebPolicy = registry.assessFrontendPayloadPolicy(samples["react-web"]);

  assert.deepEqual(registry.toFrontendPayloadBuildOptions(reactWebPolicy), {
    includeDomainPayload: true,
    domainPayloadPolicy: reactWebPolicy.name,
  });

  for (const lane of ["webview", "tui-ink", "react-native", "mixed", "unknown"]) {
    const policy = registry.assessFrontendPayloadPolicy(samples[lane]);
    assert.deepEqual(
      registry.toFrontendPayloadBuildOptions(policy),
      { includeDomainPayload: false, domainPayloadPolicy: policy.name },
      lane,
    );
  }

  assert.deepEqual(registry.toFrontendPayloadBuildOptions(undefined), { includeDomainPayload: false });
});

test("pre-read adapter no longer owns hardcoded policy assessment order", () => {
  const source = fs.readFileSync(path.join(repoRoot, "src", "adapters", "pre-read.ts"), "utf8");
  const stackSource = fs.readFileSync(path.join(repoRoot, "src", "adapters", "pre-read-stack.ts"), "utf8");
  const combinedSource = `${source}\n${stackSource}`;

  assert.match(source, /import \{ assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions \} from "\.\.\/core\/payload-policy\/registry"/);
  assert.doesNotMatch(combinedSource, /assessReactWebPayloadPolicy\(domainDetection\)/);
  assert.doesNotMatch(combinedSource, /assessWebViewPayloadPolicy\(domainDetection\)/);
  assert.doesNotMatch(combinedSource, /assessTuiInkPayloadPolicy\(domainDetection\)/);
  assert.doesNotMatch(combinedSource, /assessReactNativePayloadPolicy\(domainDetection\)/);
  assert.doesNotMatch(combinedSource, /assessFallbackPayloadPolicy\(domainDetection\)/);
  assert.doesNotMatch(combinedSource, /includeDomainPayload:\s*frontendPayloadPolicy\?\.name ===/);
  assert.match(stackSource, /toFrontendPayloadBuildOptions\(frontendPayloadPolicy\)/);
});

test("payload policy registry source avoids broad support claims", () => {
  assert.doesNotMatch(
    fs.readFileSync(path.join(repoRoot, "src", "core", "payload-policy", "registry.ts"), "utf8"),
    forbiddenSupportClaims,
  );
});
