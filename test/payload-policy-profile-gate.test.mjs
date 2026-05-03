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
const {
  assessFrontendProfilePayloadReuse,
  MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON,
} = require(path.join(repoRoot, "dist", "core", "payload-policy", "profile-gate.js"));
const { assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions } = require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"));
const { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } = require(path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"));
const { buildPreReadDecisionFromPayloadPlan } = require(path.join(repoRoot, "dist", "adapters", "pre-read-stack.js"));

function payloadForSource(source, fileName, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-profile-gate-"));
  try {
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, source);
    const domainDetection = detectDomainFromSource(source, filePath);
    const policy = assessFrontendPayloadPolicy(domainDetection);
    const payload = toModelFacingPayload(extractFile(filePath), tempDir, {
      includeEditGuidance: false,
      ...toFrontendPayloadBuildOptions(policy),
      ...options,
    });
    return { domainDetection, policy, payload };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("frontend profile gate bypasses non-frontend-profile extensions", () => {
  const source = `export function double(value: number): number { return value * 2; }`;
  const { domainDetection, policy, payload } = payloadForSource(source, "math.ts");

  assert.deepEqual(assessFrontendProfilePayloadReuse(".ts", domainDetection, payload, policy), { allowed: true });
});

test("frontend profile gate requires React Web domain payload for current React Web lane", () => {
  const source = `export function Form() { return <form><input name="email" /></form>; }`;
  const { domainDetection, policy, payload } = payloadForSource(source, "Form.tsx");
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;

  assert.equal(domainDetection.classification, "react-web");
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy), {
    allowed: false,
    reason: MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON,
  });
});

test("frontend profile gate allows narrow allowed non-web frontend policies", () => {
  const source = `import { View, TextInput, Text, Pressable } from "react-native"; export function Native() { return <View><TextInput onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable></View>; }`;
  const { domainDetection, policy, payload } = payloadForSource(source, "Native.tsx");

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, true);
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
});

test("frontend profile gate denies unsupported frontend profile reuse", () => {
  const source = `import { Box } from "ink"; export function Cli() { return <Box />; }`;
  const { domainDetection, policy, payload } = payloadForSource(source, "Cli.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(policy.allowed, false);
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("pre-read payload-plan seam surfaces frontend profile reuse denial", () => {
  const source = `export function Form() { return <form><input name="email" /></form>; }`;
  const { domainDetection, policy, payload } = payloadForSource(source, "Form.tsx");
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;

  const directGateDecision = assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy);
  const preReadDecision = buildPreReadDecisionFromPayloadPlan({
    runtime: "codex",
    filePath: "Form.tsx",
    extension: ".tsx",
    domainDetection,
    frontendPayloadPolicy: policy,
    payload: withoutDomainPayload,
    readiness: { ready: true, reasons: [], signals: {} },
    debug: { domainDetection, frontendPayloadPolicy: policy },
  });

  assert.deepEqual(directGateDecision, {
    allowed: false,
    reason: MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON,
  });
  assert.equal(preReadDecision.decision, "fallback");
  assert.deepEqual(preReadDecision.reasons, [MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON]);
  assert.equal(preReadDecision.fallback.reason, MISSING_REACT_WEB_DOMAIN_PAYLOAD_REASON);
  assert.equal("payload" in preReadDecision, false);
  assert.equal("readiness" in preReadDecision, false);
  assert.equal(preReadDecision.debug.domainDetection.classification, "react-web");
  assert.equal(preReadDecision.debug.frontendPayloadPolicy.allowed, true);
});
