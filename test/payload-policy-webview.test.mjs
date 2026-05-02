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
  assessWebViewPayloadPolicy,
  REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
  WEBVIEW_BOUNDARY_FALLBACK_POLICY,
} = require(path.join(repoRoot, "dist", "core", "payload-policy", "webview.js"));
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const forbiddenSupportClaims = /WebView support is available|WebView is supported today|default WebView compact extraction is enabled|bridge safety is guaranteed/i;

function detect(source, filePath = "Component.tsx") {
  return detectDomainFromSource(source, filePath);
}

function expectedWebViewFallbackPolicy() {
  return {
    name: WEBVIEW_BOUNDARY_FALLBACK_POLICY,
    allowed: false,
    reason: REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
  };
}

test("WebView payload policy returns fallback-only decision for WebView boundary evidence", () => {
  const domainDetection = detect(
    `import { WebView } from "react-native-webview";
     export function Preview() {
       return <WebView source={{ uri: "https://example.com" }} onMessage={() => null} />;
     }`,
    "Preview.tsx",
  );

  assert.equal(domainDetection.reason, REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.ok(domainDetection.signals.some((signal) => signal.startsWith("webview:")));
  assert.deepEqual(assessWebViewPayloadPolicy(domainDetection), expectedWebViewFallbackPolicy());
});

test("WebView payload policy does not authorize non-WebView domains", () => {
  const samples = [
    detect(`export function Form() { return <form><input name="email" /></form>; }`, "Form.tsx"),
    detect(`import { View } from "react-native"; export function Native() { return <View />; }`, "Native.tsx"),
    detect(`import { Box } from "ink"; export function Cli() { return <Box />; }`, "Cli.tsx"),
    detect(`import { View } from "react-native"; export function Mixed() { return <div><View /></div>; }`, "Mixed.tsx"),
    detect(`export const answer = 42;`, "utility.ts"),
  ];

  for (const domainDetection of samples) {
    assert.equal(
      assessWebViewPayloadPolicy(domainDetection),
      undefined,
      `${domainDetection.classification}:${domainDetection.reason ?? "no-reason"} must not get WebView policy`,
    );
  }
});

test("pre-read compatibility entrypoint delegates WebView decisions to the policy seam", () => {
  const domainDetection = detect(
    `import { WebView } from "react-native-webview";
     export function Preview() {
       return <WebView source={{ html: "<html><body><script>window.ReactNativeWebView.postMessage('ready')</script></body></html>" }} />;
     }`,
    "Preview.tsx",
  );

  assert.deepEqual(preRead.assessFrontendPayloadPolicy(domainDetection), assessWebViewPayloadPolicy(domainDetection));
  assert.equal(preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON, REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.equal(preRead.WEBVIEW_BOUNDARY_FALLBACK_POLICY, WEBVIEW_BOUNDARY_FALLBACK_POLICY);
});

test("WebView policy seam source avoids broad WebView support claims", () => {
  for (const relativePath of [path.join("src", "core", "payload-policy", "webview.ts")]) {
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"), forbiddenSupportClaims, relativePath);
  }
});
