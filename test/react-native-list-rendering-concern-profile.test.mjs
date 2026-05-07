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
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-rn-list-rendering-concern-"));
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

test("concern-only RN list/rendering evidence stays non-authorizing", () => {
  const source = `
    import { SectionList, ScrollView, Text, View } from "react-native";

    export function ConcernOnlyNativeListRendering() {
      const sections = [{ title: "A", data: ["alpha"] }];
      return (
        <ScrollView>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item}
            renderItem={({ item }) => <Text>{item}</Text>}
          />
        </ScrollView>
      );
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyNativeListRendering.tsx");

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, false);
  assert.equal(payload.domainPayload, undefined);
  assert.deepEqual(profileById(payload, "rn-list-rendering"), {
    kind: "concern",
    id: "rn-list-rendering",
    claim: "This source contains RN list/rendering pattern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-keyExtractor", "rn-renderItem", "rn-scrollview", "rn-sectionlist"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("RN list/rendering concern fixtures stay source-only and outside RN narrow authorization", () => {
  const filePath = fixturePath("rn-interaction-gesture.tsx");
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
  assert.deepEqual(profileById(payload, "rn-list-rendering"), {
    kind: "concern",
    id: "rn-list-rendering",
    claim: "This source contains RN list/rendering pattern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-flatlist", "rn-keyExtractor", "rn-renderItem"],
  });
  assert.ok(Array.isArray(payload.behavior?.rnListRenderingConcerns));
  assert.deepEqual(
    payload.behavior.rnListRenderingConcerns.map((item) => {
      if (item.kind === "list-primitive") {
        return {
          kind: item.kind,
          primitive: item.primitive,
          evidence: item.evidence,
        };
      }
      return {
        kind: item.kind,
        primitive: item.primitive,
        expr: item.expr,
        exprKind: item.exprKind,
        exprSource: item.exprSource,
        evidence: item.evidence,
      };
    }),
    [
      {
        kind: "list-primitive",
        primitive: "FlatList",
        evidence: ["jsx.FlatList"],
      },
      {
        kind: "renderItem",
        primitive: "FlatList",
        expr: "({ item }) => <Text>{item}</Text>",
        exprKind: "inline-callback",
        exprSource: "same-file-inline",
        evidence: ["jsx.FlatList.renderItem"],
      },
      {
        kind: "keyExtractor",
        primitive: "FlatList",
        expr: "(item) => item",
        exprKind: "inline-callback",
        exprSource: "same-file-inline",
        evidence: ["jsx.FlatList.keyExtractor"],
      },
    ],
  );
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});
