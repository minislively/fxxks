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
const manifestPath = path.join(fixtureRoot, "manifest.json");
const forbiddenSupportClaims = /React Native support is available|React Native is supported today|WebView support is available|WebView is supported today|TUI support is available|TUI is supported today|TUI\/Ink is supported today|default WebView compact extraction is enabled/i;

function assertSignals(result, expectedSignals) {
  for (const signal of expectedSignals) {
    assert.ok(result.signals.includes(signal), `missing signal ${signal}`);
  }
}

function expectedClassificationForLane(lane) {
  if (lane === "react-web") return "react-web";
  if (lane === "tui-ink") return "tui-ink";
  if (lane.startsWith("rn-")) return "react-native";
  if (lane === "webview-boundary") return "webview";
  if (lane === "negative-fallback") return "mixed";
  throw new Error(`No detector classification expectation for lane: ${lane}`);
}

test("detects React Native evidence signals without support wording", () => {
  const primitive = detectDomain(path.join(fixtureRoot, "rn-primitive-basic.tsx"));
  assert.equal(primitive.classification, "react-native");
  assert.equal(primitive.domain, "react-native");
  assert.equal(primitive.outcome, "fallback");
  assert.equal(primitive.reason, "unsupported-react-native-webview-boundary");
  assertSignals(primitive, [
    "react-native:import:react-native",
    "react-native:primitive:View",
    "react-native:primitive:Text",
    "react-native:primitive:TextInput",
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
  assert.equal(result.outcome, "fallback");
  assert.equal(result.reason, "unsupported-react-native-webview-boundary");
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
  assert.equal(result.outcome, "extract");
  assertSignals(result, ["tui-ink:import:ink", "tui-ink:primitive:Box", "tui-ink:primitive:Text", "tui-ink:hook:useInput"]);
  assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims);
});

test("classifies mixed and unknown fallback cases", () => {
  const mixed = detectDomain(path.join(fixtureRoot, "negative-rn-webview-boundary.tsx"));
  assert.equal(mixed.classification, "mixed");
  assert.equal(mixed.outcome, "fallback");
  assert.equal(mixed.reason, "unsupported-react-native-webview-boundary");
  assert.ok(mixed.signals.some((signal) => signal.startsWith("react-native:")));
  assert.ok(mixed.signals.some((signal) => signal.startsWith("webview:")));

  const unknown = detectDomainFromSource("export const answer = 42;", "utility.ts");
  assert.equal(unknown.classification, "unknown");
  assert.equal(unknown.outcome, "deferred");
  assert.deepEqual(unknown.evidence, []);

  assert.doesNotMatch(JSON.stringify([mixed, unknown]), forbiddenSupportClaims);
});

test("treats bare WebView JSX as a fallback-first boundary signal", () => {
  const result = detectDomainFromSource(`export function Preview() { return <WebView source={{ uri: "https://example.test" }} />; }`, "Preview.tsx");
  assert.equal(result.classification, "webview");
  assert.equal(result.outcome, "fallback");
  assert.equal(result.reason, "unsupported-react-native-webview-boundary");
  assert.ok(result.signals.includes("webview:component:WebView"));
});

test("selected fixture manifest stays aligned with detector classifications and outcomes", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  for (const item of manifest.selected) {
    const result = detectDomain(path.join(repoRoot, item.path));
    assert.equal(result.classification, expectedClassificationForLane(item.lane), `${item.id} classification must match manifest lane`);
    assert.equal(result.domain, result.classification, `${item.id} deprecated domain alias must mirror classification`);
    assert.equal(result.outcome, item.expectedOutcome, `${item.id} detector outcome must match manifest`);

    if (item.expectedReason !== undefined) {
      assert.equal(result.reason, item.expectedReason, `${item.id} detector fallback reason must match manifest`);
    } else {
      assert.equal(result.reason, undefined, `${item.id} must not invent a fallback reason`);
    }

    if (result.classification !== "react-web") {
      assert.ok(result.evidence.length > 0, `${item.id} detector should keep evidence for non-web lanes`);
    }
    assert.doesNotMatch(JSON.stringify(result), forbiddenSupportClaims, `${item.id} detector evidence must not include support claims`);
  }
});

test("changed detector source does not introduce forbidden support wording", () => {
  const source = fs.readFileSync(path.join(repoRoot, "src", "core", "domain-detector.ts"), "utf8");
  assert.doesNotMatch(source, forbiddenSupportClaims);
});
