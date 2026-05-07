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
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-rn-navigation-concern-"));
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

test("concern-only RN navigation evidence stays non-authorizing", () => {
  const source = `
    import { Text, View } from "react-native";
    import { useNavigation, useRoute } from "@react-navigation/native";

    export function ConcernOnlyNativeNavigation() {
      const navigation = useNavigation();
      const route = useRoute();
      const id = route.params?.userId;
      return <View><Text onPress={() => navigation.navigate("Profile")}>User {id}</Text></View>;
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyNativeNavigation.tsx");

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, false);
  assert.equal(payload.domainPayload, undefined);
  assert.deepEqual(profileById(payload, "rn-navigation"), {
    kind: "concern",
    id: "rn-navigation",
    claim: "This source contains RN navigation concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-navigation-import", "rn-navigation-navigate", "rn-route-params", "rn-useNavigation", "rn-useRoute"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("RN navigation concern fixture stays source-only and outside RN narrow authorization", () => {
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
  assert.deepEqual(profileById(payload, "rn-navigation"), {
    kind: "concern",
    id: "rn-navigation",
    claim: "This source contains RN navigation concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["rn-navigation-import", "rn-navigation-navigate", "rn-route-params", "rn-useNavigation", "rn-useRoute"],
  });
  assert.ok(Array.isArray(payload.behavior?.rnNavigationConcerns));
  assert.deepEqual(
    payload.behavior.rnNavigationConcerns.map((item) => {
      if (item.kind === "navigation-import") {
        return {
          kind: item.kind,
          moduleSpecifier: item.moduleSpecifier,
          importedSymbols: item.importedSymbols,
          evidence: item.evidence,
        };
      }
      if (item.kind === "navigation-hook") {
        return {
          kind: item.kind,
          hook: item.hook,
          evidence: item.evidence,
        };
      }
      if (item.kind === "navigation-navigate") {
        return {
          kind: item.kind,
          calleeExpr: item.calleeExpr,
          routeNameExpr: item.routeNameExpr,
          evidence: item.evidence,
        };
      }
      return {
        kind: item.kind,
        accessExpr: item.accessExpr,
        evidence: item.evidence,
      };
    }),
    [
      {
        kind: "navigation-import",
        moduleSpecifier: "@react-navigation/native",
        importedSymbols: ["useNavigation", "useRoute"],
        evidence: ["import.@react-navigation/native"],
      },
      {
        kind: "navigation-hook",
        hook: "useNavigation",
        evidence: ["hook.useNavigation"],
      },
      {
        kind: "navigation-hook",
        hook: "useRoute",
        evidence: ["hook.useRoute"],
      },
      {
        kind: "route-params",
        accessExpr: "route.params",
        evidence: ["member.route.params"],
      },
      {
        kind: "navigation-navigate",
        calleeExpr: "navigation.navigate",
        routeNameExpr: "\"Settings\"",
        evidence: ["call.navigation.navigate"],
      },
    ],
  );
});
