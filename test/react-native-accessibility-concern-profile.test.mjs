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
const { assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions } = require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"));
const { assessFrontendProfilePayloadReuse } = require(path.join(repoRoot, "dist", "core", "payload-policy", "profile-gate.js"));
const { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } = require(path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"));

function buildPayloadForSource(source, fileName, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-rn-accessibility-concern-"));
  try {
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, source);
    const domainDetection = detectDomainFromSource(source, filePath);
    const policy = assessFrontendPayloadPolicy(domainDetection);
    const payload = toModelFacingPayload(extractFile(filePath), tempDir, {
      includeEditGuidance: false,
      includeReactWebContextMetadata: true,
      ...toFrontendPayloadBuildOptions(policy),
      ...options,
    });
    return { domainDetection, policy, payload };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function fixturePath(fileName) {
  return path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", fileName);
}

function profileById(payload, id) {
  return payload.concernProfiles?.find((profile) => profile.id === id);
}

test("concern-only RN accessibility/test anchors stay non-authorizing", () => {
  const source = `
    import { View, Text } from "react-native";

    export function ConcernOnlyNativeAccessibility() {
      return (
        <View accessibilityLabel="Settings screen" testID="settings-screen">
          <Text accessibilityRole="header" accessibilityHint="Settings title">Settings</Text>
        </View>
      );
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyNativeAccessibility.tsx");

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, false);
  assert.equal(payload.domainPayload, undefined);
  assert.deepEqual(profileById(payload, "rn-accessibility-test-anchor"), {
    kind: "concern",
    id: "rn-accessibility-test-anchor",
    claim: "This source contains RN accessibility/test anchor evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-accessibilityHint", "rn-accessibilityLabel", "rn-accessibilityRole", "rn-testID"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("RN accessibility/test anchor concern stays separate from narrow RN authorization", () => {
  const filePath = fixturePath("rn-accessibility-test-anchor.tsx");
  const source = fs.readFileSync(filePath, "utf8");
  const domainDetection = detectDomainFromSource(source, filePath);
  const policy = assessFrontendPayloadPolicy(domainDetection);
  const payload = toModelFacingPayload(extractFile(filePath), repoRoot, {
    includeEditGuidance: false,
    includeReactWebContextMetadata: true,
    ...toFrontendPayloadBuildOptions(policy),
  });
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, true);
  assert.deepEqual(profileById(payload, "rn-accessibility-test-anchor"), {
    kind: "concern",
    id: "rn-accessibility-test-anchor",
    claim: "This source contains RN accessibility/test anchor evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-accessibilityHint", "rn-accessibilityLabel", "rn-accessibilityRole", "rn-testID"],
  });
  assert.ok(Array.isArray(payload.behavior?.rnAccessibilityTestAnchors));
  assert.deepEqual(
    payload.behavior.rnAccessibilityTestAnchors.map((item) => ({
      primitive: item.primitive,
      accessibilityLabel: item.accessibilityLabel,
      accessibilityRole: item.accessibilityRole,
      accessibilityHint: item.accessibilityHint,
      testID: item.testID,
      evidence: item.evidence,
    })),
    [
      {
        primitive: "View",
        accessibilityLabel: "Search form",
        accessibilityRole: undefined,
        accessibilityHint: undefined,
        testID: "search-form",
        evidence: ["jsx.View.accessibilityLabel", "jsx.View.testID"],
      },
      {
        primitive: "Text",
        accessibilityLabel: undefined,
        accessibilityRole: "header",
        accessibilityHint: undefined,
        testID: undefined,
        evidence: ["jsx.Text.accessibilityRole"],
      },
      {
        primitive: "TextInput",
        accessibilityLabel: "Search input",
        accessibilityRole: undefined,
        accessibilityHint: "Type a query to filter results",
        testID: "search-input",
        evidence: ["jsx.TextInput.accessibilityLabel", "jsx.TextInput.accessibilityHint", "jsx.TextInput.testID"],
      },
      {
        primitive: "Pressable",
        accessibilityLabel: "Apply filters",
        accessibilityRole: "button",
        accessibilityHint: "Applies the current filter query",
        testID: "apply-filters",
        evidence: [
          "jsx.Pressable.accessibilityLabel",
          "jsx.Pressable.accessibilityRole",
          "jsx.Pressable.accessibilityHint",
          "jsx.Pressable.testID",
        ],
      },
    ],
  );
  assert.ok(payload.domainPayload, "RN narrow payload remains the independent authorization surface");
  assert.equal("concernProfiles" in payload.domainPayload, false, "concern metadata must not leak into domain payload");
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
  assert.equal(assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy).allowed, false);
});
