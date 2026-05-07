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
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-rn-style-platform-concern-"));
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

test("concern-only RN style/platform evidence stays non-authorizing", () => {
  const source = `
    import { Platform, StyleSheet, Text, View } from "react-native";

    const styles = StyleSheet.create({
      base: { padding: 12 },
      ios: { color: "#007AFF" },
      android: { color: "#2196F3" },
      default: { color: "#000" },
    });

    export function ConcernOnlyNativeStylePlatform() {
      return (
        <View style={styles.base}>
          <Text
            style={Platform.select({
              ios: styles.ios,
              android: styles.android,
              default: styles.default,
            })}
          >
            Profile
          </Text>
        </View>
      );
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyNativeStylePlatform.tsx");

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, false);
  assert.equal(payload.domainPayload, undefined);
  assert.deepEqual(profileById(payload, "rn-style-platform"), {
    kind: "concern",
    id: "rn-style-platform",
    claim: "This source contains RN style/platform concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-platform-select", "rn-style-sheet-create"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("RN style/platform concern fixture stays source-only and outside RN narrow authorization", () => {
  const filePath = fixturePath("rn-style-platform-navigation.tsx");
  const source = fs.readFileSync(filePath, "utf8");
  const domainDetection = detectDomainFromSource(source, filePath);
  const policy = assessFrontendPayloadPolicy(domainDetection);
  const payload = toModelFacingPayload(extractFile(filePath), repoRoot, {
    includeEditGuidance: false,
    includeReactWebContextMetadata: true,
    ...toFrontendPayloadBuildOptions(policy),
  });

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, false);
  assert.equal(payload.domainPayload, undefined);
  assert.deepEqual(profileById(payload, "rn-style-platform"), {
    kind: "concern",
    id: "rn-style-platform",
    claim: "This source contains RN style/platform concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-platform-select", "rn-style-sheet-create"],
  });
  assert.ok(Array.isArray(payload.behavior?.rnStylePlatformConcerns));
  assert.deepEqual(
    payload.behavior.rnStylePlatformConcerns.map((item) => {
      if (item.kind === "style-sheet-create") {
        return { kind: item.kind, calleeExpr: item.calleeExpr, evidence: item.evidence };
      }
      return { kind: item.kind, calleeExpr: item.calleeExpr, optionKeys: item.optionKeys, evidence: item.evidence };
    }),
    [
      { kind: "platform-select", calleeExpr: "Platform.select", optionKeys: ["ios", "android", "default"], evidence: ["call.Platform.select"] },
      { kind: "style-sheet-create", calleeExpr: "StyleSheet.create", evidence: ["call.StyleSheet.create"] },
    ],
  );
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});
