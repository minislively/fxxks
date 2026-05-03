// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

function assertFallbackOnlyDecision(decision, reason) {
  assert.equal(decision.decision, "fallback");
  assert.deepEqual(decision.reasons, [reason]);
  assert.equal(decision.fallback.reason, reason);
  assert.equal("payload" in decision, false);
  assert.equal("readiness" in decision, false);
  assert.equal("mode" in decision.debug, false);
  assert.equal("complexityScore" in decision.debug, false);
}

test("pre-read fallback builder preserves ineligible extension decisions", () => {
  const decision = preRead.decidePreRead(path.join(repoRoot, "not-a-source.md"), repoRoot, "codex");

  assert.deepEqual(decision, {
    runtime: "codex",
    filePath: "not-a-source.md",
    eligible: false,
    decision: "fallback",
    reasons: ["ineligible-extension"],
    debug: {},
    fallback: {
      action: "full-read",
      reason: "ineligible-extension",
    },
  });
});

test("pre-read source-shape boundary guard skips payload planning", () => {
  const tempDir = fs.mkdtempSync(path.join(repoRoot, ".tmp-pre-read-source-shape-"));
  try {
    const filePath = path.join(tempDir, "CheckoutWebView.tsx");
    const source = `import { WebView } from "react-native-webview";
export function CheckoutWebView() {
  return <WebView source={{ uri: "https://example.test/checkout" }} onMessage={() => {}} />;
}
`;
    fs.writeFileSync(filePath, source);

    const decision = preRead.decidePreRead(filePath, tempDir, "codex", { includeEditGuidance: true });

    assert.equal(preRead.hasReactNativeWebViewBoundaryMarker(source), true);
    assertFallbackOnlyDecision(decision, "unsupported-react-native-webview-boundary");
    assert.equal(decision.debug.domainDetection.classification, "webview");
    assert.equal(decision.debug.domainDetection.profile.claimStatus, "fallback-boundary");
    assert.ok(decision.debug.domainDetection.signals.includes("webview:source-shape:uri"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("pre-read unsupported RN fallback skips payload planning", () => {
  const tempDir = fs.mkdtempSync(path.join(repoRoot, ".tmp-pre-read-rn-unsupported-"));
  try {
    const filePath = path.join(tempDir, "UnsupportedScreen.tsx");
    fs.writeFileSync(
      filePath,
      `import { ScrollView, View } from "react-native";
export function UnsupportedScreen() {
  return <ScrollView><View /></ScrollView>;
}
`,
    );

    const decision = preRead.decidePreRead(filePath, tempDir, "codex", { includeEditGuidance: true });

    assertFallbackOnlyDecision(decision, "unsupported-frontend-domain-profile");
    assert.equal(decision.debug.domainDetection.classification, "react-native");
    assert.equal(decision.debug.frontendPayloadPolicy.allowed, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("pre-read fallback debug remains domain and policy shaped", () => {
  const tempDir = fs.mkdtempSync(path.join(repoRoot, ".tmp-pre-read-debug-"));
  try {
    const filePath = path.join(tempDir, "Cli.tsx");
    fs.writeFileSync(filePath, `import { Box } from "ink"; export function Cli() { return <Box />; }`);
    const decision = preRead.decidePreRead(filePath, tempDir, "codex");

    assert.equal(decision.decision, "fallback");
    assert.equal(decision.debug.domainDetection.classification, "tui-ink");
    assert.equal(decision.debug.frontendPayloadPolicy.allowed, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
