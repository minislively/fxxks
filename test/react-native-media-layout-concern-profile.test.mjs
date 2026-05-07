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
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-rn-media-layout-concern-"));
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

test("concern-only RN media/layout evidence stays non-authorizing", () => {
  const source = `
    import { Dimensions, Image, ScrollView, Text, View } from "react-native";

    export function ConcernOnlyNativeMediaLayout() {
      const { width } = Dimensions.get("window");
      return (
        <ScrollView pagingEnabled>
          <View style={{ width }}>
            <Image source={{ uri: "https://example.com/photo.jpg" }} style={{ width, height: 200, resizeMode: "cover" }} />
            <Text>Preview</Text>
          </View>
        </ScrollView>
      );
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyNativeMediaLayout.tsx");

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, false);
  assert.equal(payload.domainPayload, undefined);
  assert.deepEqual(profileById(payload, "rn-media-layout"), {
    kind: "concern",
    id: "rn-media-layout",
    claim: "This source contains RN media/layout concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-dimensions-get", "rn-image", "rn-pagingEnabled", "rn-resizeMode"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("RN media/layout concern fixture stays source-only and outside RN narrow authorization", () => {
  const filePath = fixturePath("rn-image-scrollview.tsx");
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
  assert.deepEqual(profileById(payload, "rn-media-layout"), {
    kind: "concern",
    id: "rn-media-layout",
    claim: "This source contains RN media/layout concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-dimensions-get", "rn-image", "rn-pagingEnabled", "rn-resizeMode"],
  });
  assert.ok(Array.isArray(payload.behavior?.rnMediaLayoutConcerns));
  assert.deepEqual(
    payload.behavior.rnMediaLayoutConcerns.map((item) => {
      if (item.kind === "dimensions-get") {
        return { kind: item.kind, calleeExpr: item.calleeExpr, argExpr: item.argExpr, evidence: item.evidence };
      }
      if (item.kind === "pagingEnabled") {
        return { kind: item.kind, primitive: item.primitive, value: item.value, evidence: item.evidence };
      }
      if (item.kind === "media-primitive") {
        return { kind: item.kind, primitive: item.primitive, evidence: item.evidence };
      }
      return { kind: item.kind, primitive: item.primitive, value: item.value, evidence: item.evidence };
    }),
    [
      { kind: "dimensions-get", calleeExpr: "Dimensions.get", argExpr: '"window"', evidence: ["call.Dimensions.get"] },
      { kind: "pagingEnabled", primitive: "ScrollView", value: "true", evidence: ["jsx.ScrollView.pagingEnabled"] },
      { kind: "media-primitive", primitive: "Image", evidence: ["jsx.Image"] },
      { kind: "resizeMode", primitive: "Image", value: '"cover"', evidence: ["jsx.Image.resizeMode"] },
      { kind: "media-primitive", primitive: "Image", evidence: ["jsx.Image"] },
      { kind: "resizeMode", primitive: "Image", value: '"cover"', evidence: ["jsx.Image.resizeMode"] },
    ],
  );
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});
