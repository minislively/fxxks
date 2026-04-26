// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { detectDomain, detectDomainFromSource } = require(path.join(repoRoot, "dist", "core", "domain-detector.js"));

const fixtureRoot = path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations");
const forbiddenSupportClaims = /React Native support is available|React Native is supported today|WebView support is available|WebView is supported today|TUI support is available|TUI is supported today|TUI\/Ink is supported today|default WebView compact extraction is enabled/i;

function assertSignals(result, expectedSignals) {
  for (const signal of expectedSignals) {
    assert.ok(result.signals.includes(signal), `missing signal ${signal}`);
  }
}

test("detects React Native evidence signals without support wording", () => {
  const primitive = detectDomain(path.join(fixtureRoot, "rn-primitive-basic.tsx"));
  assert.equal(primitive.classification, "react-native");
  assert.equal(primitive.domain, "react-native");
  assertSignals(primitive, [
    "react-native:import:react-native",
    "react-native:primitive:View",
    "react-native:primitive:Text",
    "react-native:primitive:Pressable",
  ]);

  const styled = detectDomain(path.join(fixtureRoot, "rn-style-platform-navigation.tsx"));
  assert.equal(styled.classification, "react-native");
  assertSignals(styled, [
    "react-native:primitive:ScrollView",
    "react-native:style-factory:StyleSheet.create",
    "react-native:platform-select:Platform.select",
  ]);

  const image = detectDomain(path.join(fixtureRoot, "rn-image-scrollview.tsx"));
  assert.equal(image.classification, "react-native");
  assertSignals(image, ["react-native:primitive:Image", "react-native:primitive:ScrollView"]);

  const touchable = detectDomain(path.join(fixtureRoot, "rn-interaction-gesture.tsx"));
  assert.equal(touchable.classification, "react-native");
  assertSignals(touchable, ["react-native:primitive:TouchableOpacity"]);

  assert.doesNotMatch(JSON.stringify([primitive, styled, image, touchable]), forbiddenSupportClaims);
});

test("detects WebView evidence signals without support wording", () => {
  const result = detectDomain(path.join(fixtureRoot, "webview-boundary-basic.tsx"));
  assert.equal(result.classification, "webview");
  assertSignals(result, [
    "webview:import:react-native-webview",
    "webview:component:WebView",
    "webview:prop:source",
    "webview:prop:injectedJavaScript",
    "webview:prop:onMessage",
  ]);
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("detects TUI Ink evidence signals without support wording", () => {
  const result = detectDomain(path.join(fixtureRoot, "tui-ink-basic.tsx"));
  assert.equal(result.classification, "tui-ink");
  assertSignals(result, ["tui-ink:import:ink", "tui-ink:primitive:Box", "tui-ink:primitive:Text", "tui-ink:hook:useInput"]);
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("classifies mixed and unknown fallback cases", () => {
  const mixed = detectDomain(path.join(fixtureRoot, "negative-rn-webview-boundary.tsx"));
  assert.equal(mixed.classification, "mixed");
  assert.ok(mixed.signals.some((signal) => signal.startsWith("react-native:")));
  assert.ok(mixed.signals.some((signal) => signal.startsWith("webview:")));

  const unknown = detectDomainFromSource("export const answer = 42;", "utility.ts");
  assert.equal(unknown.classification, "unknown");
  assert.deepEqual(unknown.evidence, []);

  assert.doesNotMatch(JSON.stringify([mixed, unknown]), forbiddenSupportClaims);
});

test("changed detector source does not introduce forbidden support wording", () => {
  const source = fs.readFileSync(path.join(repoRoot, "src", "core", "domain-detector.ts"), "utf8");
  assert.doesNotMatch(source, forbiddenSupportClaims);
});
