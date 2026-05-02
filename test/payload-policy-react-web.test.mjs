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
  assessReactWebPayloadPolicy,
  CUSTOM_WRAPPER_DOM_SIGNAL_GAP,
  REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY,
} = require(path.join(repoRoot, "dist", "core", "payload-policy", "react-web.js"));
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const forbiddenSupportClaims = /React Native support is available|React Native is supported today|WebView support is available|WebView is supported today|TUI support is available|TUI is supported today|TUI\/Ink is supported today|default WebView compact extraction is enabled/i;

function detect(source, filePath = "Component.tsx") {
  return detectDomainFromSource(source, filePath);
}

test("React Web payload policy allows current supported DOM evidence without extra gates", () => {
  const domainDetection = detect(`export function Form() { return <form><input name="email" /></form>; }`);

  assert.equal(domainDetection.classification, "react-web");
  assert.deepEqual(assessReactWebPayloadPolicy(domainDetection), {
    name: REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY,
    allowed: true,
  });
});

test("React Web payload policy keeps custom-wrapper evidence gate", () => {
  const domainDetection = detect(
    `export function CustomOnlyForm() {
       return <Button className="rounded"><FieldLabel htmlFor="email">Email</FieldLabel></Button>;
     }`,
  );

  assert.equal(domainDetection.classification, "react-web");
  assert.deepEqual(assessReactWebPayloadPolicy(domainDetection), {
    name: REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY,
    allowed: true,
    evidenceGates: [CUSTOM_WRAPPER_DOM_SIGNAL_GAP],
  });
});

test("React Web policy seam does not authorize non-React-Web domains", () => {
  const samples = [
    detect(`import { View } from "react-native"; export function Native() { return <View />; }`, "Native.tsx"),
    detect(`import { WebView } from "react-native-webview"; export function Preview() { return <WebView source={{ uri: "https://example.com" }} />; }`, "Preview.tsx"),
    detect(`import { Box } from "ink"; export function Cli() { return <Box />; }`, "Cli.tsx"),
    detect(`import { View } from "react-native"; export function Mixed() { return <div><View /></div>; }`, "Mixed.tsx"),
    detect(`export const answer = 42;`, "utility.ts"),
  ];

  for (const domainDetection of samples) {
    assert.notEqual(domainDetection.classification, "react-web");
    assert.equal(assessReactWebPayloadPolicy(domainDetection), undefined, `${domainDetection.classification} must not get React Web policy`);
  }
});

test("pre-read compatibility entrypoint delegates React Web decisions to the policy seam", () => {
  for (const domainDetection of [
    detect(`export function Form() { return <form><input name="email" /></form>; }`, "Form.tsx"),
    detect(`export function CustomOnlyForm() { return <Button className="rounded" />; }`, "CustomOnlyForm.tsx"),
  ]) {
    assert.deepEqual(preRead.assessFrontendPayloadPolicy(domainDetection), assessReactWebPayloadPolicy(domainDetection));
  }

  assert.equal(preRead.REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY, REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY);
  assert.equal(preRead.CUSTOM_WRAPPER_DOM_SIGNAL_GAP, CUSTOM_WRAPPER_DOM_SIGNAL_GAP);
});

test("React Web policy seam source avoids broad non-web support claims", () => {
  for (const relativePath of [
    path.join("src", "core", "payload-policy", "react-web.ts"),
    path.join("src", "core", "payload-policy", "types.ts"),
  ]) {
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"), forbiddenSupportClaims, relativePath);
  }
});
