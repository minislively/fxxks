// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildContextDecision } from "../dist/core/context-decision.js";
import { detectDomainFromSource } from "../dist/core/domain-detector.js";
import { extractFile } from "../dist/core/extract.js";
import { collectFrontendConcernProfiles } from "../dist/core/concern-profiles/index.js";
import { assessFrontendPayloadPolicy } from "../dist/core/payload-policy/registry.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations");

function decisionFor(relativeFixture) {
  const filePath = path.join(fixtureRoot, relativeFixture);
  const sourceText = fs.readFileSync(filePath, "utf8");
  const domainDetection = detectDomainFromSource(sourceText, filePath);
  const extraction = extractFile(filePath);
  return buildContextDecision({
    filePath,
    cwd: repoRoot,
    sourceText,
    domainDetection,
    extraction,
    concerns: collectFrontendConcernProfiles(extraction),
    payloadPolicy: assessFrontendPayloadPolicy(domainDetection),
    surface: "cli-report",
    runtime: "cli",
    capability: "unknown",
  });
}

test("context-decision.v1 reports React Web as diagnostic compact context without authorizing reuse", () => {
  const decision = decisionFor("react-web/custom-form-shell.tsx");

  assert.equal(decision.schemaVersion, "context-decision.v1");
  assert.equal(decision.evidence.domain, "react-web");
  assert.equal(decision.decision.kind, "compact-context");
  assert.equal(decision.decision.diagnosticOnly, true);
  assert.equal(decision.policy.allowed, false);
  assert.match(decision.policy.allowedMeaning, /report-only/);
  assert.ok(decision.decision.retainedAxes.includes("formStateFlow"));
  assert.ok(decision.decision.retainedAxes.includes("a11yAnchors"));
  assert.ok(decision.scope.sourceFingerprint?.fileHash.startsWith("sha256:"));
  assert.ok(decision.scope.sourceFingerprint?.lineCount > 0);
  assert.ok(decision.nonClaims.includes("does not authorize runtime reuse"));
  assert.ok(decision.nonClaims.includes("does not authorize model-facing payload reuse"));
});

test("context-decision.v1 keeps WebView and mixed evidence on full-read fallback", () => {
  const webview = decisionFor("webview-boundary-basic.tsx");
  assert.equal(webview.evidence.domain, "webview");
  assert.equal(webview.decision.kind, "full-read");
  assert.ok(webview.evidence.risk.includes("fallback-first-domain-boundary"));
  assert.ok(webview.evidence.risk.includes("webview-boundary"));
  assert.equal(webview.policy.allowed, false);

  const mixed = decisionFor("tui-ink-web-dom-mixed.tsx");
  assert.equal(mixed.evidence.domain, "mixed");
  assert.equal(mixed.decision.kind, "full-read");
  assert.ok(mixed.evidence.risk.includes("mixed-domain-evidence"));
});

test("context-decision.v1 can expose RN narrow-payload diagnostics without expanding support", () => {
  const decision = decisionFor("rn-primitive-basic.tsx");

  assert.equal(decision.evidence.domain, "react-native");
  assert.equal(decision.decision.kind, "narrow-payload");
  assert.equal(decision.decision.diagnosticOnly, true);
  assert.ok(decision.decision.retainedAxes.includes("sourceAnchorBeta"));
  assert.equal(decision.policy.allowed, false);
  assert.ok(decision.nonClaims.includes("does not expand React Native, WebView, or TUI support"));
});

test("context-decision.v1 defers TUI and unknown evidence", () => {
  const tui = decisionFor("tui-ink-basic.tsx");
  assert.equal(tui.evidence.domain, "tui-ink");
  assert.equal(tui.decision.kind, "defer");
  assert.match(tui.decision.reason, /tui/);

  const unknownFile = path.join(repoRoot, "package.json");
  const sourceText = fs.readFileSync(unknownFile, "utf8");
  const domainDetection = detectDomainFromSource(sourceText, unknownFile);
  const unknown = buildContextDecision({
    filePath: unknownFile,
    cwd: repoRoot,
    sourceText,
    domainDetection,
  });
  assert.equal(unknown.evidence.domain, "unknown");
  assert.equal(unknown.decision.kind, "defer");
  assert.equal(unknown.evidence.freshness, "unknown");
  assert.equal(unknown.policy.allowed, false);
});
