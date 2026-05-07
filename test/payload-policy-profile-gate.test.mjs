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
  MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON,
} = require(path.join(repoRoot, "dist", "core", "payload-policy", "profile-gate.js"));
const { assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions } = require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"));
const { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } = require(path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"));
const { buildPreReadDecisionFromPayloadPlan } = require(path.join(repoRoot, "dist", "adapters", "pre-read-stack.js"));

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

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

test("frontend profile gate rejects concern-only react-hook-form fixtures without domain evidence", () => {
  const source = `
    import { useForm } from "react-hook-form";
    export function ConcernOnlyFormStateNote() {
      const { register, control, handleSubmit } = useForm({
        defaultValues: { email: "", password: "" },
      });
      const onSubmit = handleSubmit(() => undefined);
      return { register, control, onSubmit, errors: { email: "Required" } };
    }
  `;
  const { domainDetection, policy, payload } = payloadForSource(source, "ConcernOnlyFormStateNote.tsx");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
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
  assert.equal(payload.domainPayload.domain, "react-native");
  assert.equal(payload.domainPayload.policy, policy.name);
  assert.deepEqual(payload.domainPayload.facts.primitives, ["Pressable", "Text", "TextInput", "View"]);
  assert.deepEqual(payload.domainPayload.facts.jsxProps, ["onChangeText", "onPress"]);
  assert.deepEqual(payload.domainPayload.facts.primitiveInteractions, {
    inputBindings: [
      {
        primitive: "TextInput",
        loc: { startLine: 1, endLine: 1 },
        onChangeTextExpr: "() => null",
        evidence: ["jsx.TextInput.onChangeText"],
      },
    ],
    actionBindings: [
      {
        primitive: "Pressable",
        loc: { startLine: 1, endLine: 1 },
        onPressExpr: "() => null",
        label: "Save",
        evidence: ["jsx.Pressable.onPress", "jsx.Pressable.Text.label"],
      },
    ],
  });
  assert.equal("formControls" in payload.domainPayload.facts, false);
  assert.equal("domTags" in payload.domainPayload.facts, false);
  assert.equal("reactNativeContext" in payload, false);
  assert.equal(payload.domainPayload.sourceAnchorBeta.contract.contractVersion, "rn-source-anchor-beta.v0");
  assert.equal(payload.domainPayload.sourceAnchorBeta.contract.scope, "local-proof-only");
  assert.deepEqual(payload.domainPayload.sourceAnchorBeta.contract.allowedProofSurfaces, ["extract", "compare", "inspect-domain"]);
  assert.equal(payload.domainPayload.sourceAnchorBeta.contract.runtimeReusePromotion, "not-promoted");
  assert.deepEqual(payload.domainPayload.sourceAnchorBeta.anchors.primitives, ["Pressable", "Text", "TextInput", "View"]);
  assert.deepEqual(payload.domainPayload.sourceAnchorBeta.anchors.jsxProps, ["onChangeText", "onPress"]);
  assert.equal(payload.domainPayload.sourceAnchorBeta.anchors.sourceFingerprintRequired, true);
  assert.equal(payload.domainPayload.reuseContract.sourceDerivedOnly, true);
  assert.equal(payload.domainPayload.reuseContract.policy, policy.name);
  assert.equal(payload.domainPayload.reuseContract.freshnessSource, "sourceFingerprint");
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
});

test("frontend profile gate requires RN domain payload for the measured narrow RN policy", () => {
  const source = `import { View, TextInput, Text, Pressable } from "react-native"; export function Native() { return <View><TextInput onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable></View>; }`;
  const { domainDetection, policy, payload } = payloadForSource(source, "Native.tsx");
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, true);
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy), {
    allowed: false,
    reason: MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON,
  });
});

test("frontend profile gate rejects adversarial RN narrow payload contract and freshness mismatches", () => {
  const source = `import { View, TextInput, Text, Pressable } from "react-native"; export function Native() { return <View><TextInput onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable></View>; }`;
  const { domainDetection, policy, payload } = payloadForSource(source, "Native.tsx", { includeEditGuidance: true });

  assert.equal(domainDetection.classification, "react-native");
  assert.equal(policy.allowed, true);
  assert.equal(payload.domainPayload.domain, "react-native");
  assert.ok(payload.sourceFingerprint, "RN reusable payload must carry a source fingerprint");
  assert.ok(payload.editGuidance?.freshness, "edit guidance freshness gives the gate an internal source-fingerprint cross-check");
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });

  const rejectedPayloads = [
    ["missing domain payload", () => {
      const stale = clonePayload(payload);
      delete stale.domainPayload;
      return stale;
    }],
    ["wrong schema", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.schemaVersion = "domain-payload.v0";
      return stale;
    }],
    ["wrong planner decision", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.plannerDecision = "compact-safe";
      return stale;
    }],
    ["wrong claim boundary", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.claimBoundary = "react-web-measured-extraction";
      return stale;
    }],
    ["wrong policy", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.policy = "react-web-current-supported-lane";
      return stale;
    }],
    ["missing source-anchor beta contract", () => {
      const stale = clonePayload(payload);
      delete stale.domainPayload.sourceAnchorBeta;
      return stale;
    }],
    ["wrong source-anchor beta scope", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.sourceAnchorBeta.contract.scope = "runtime";
      return stale;
    }],
    ["wrong source-anchor runtime promotion", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.sourceAnchorBeta.contract.runtimeReusePromotion = "promoted";
      return stale;
    }],
    ["missing source-anchor primitive", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.sourceAnchorBeta.anchors.primitives = stale.domainPayload.sourceAnchorBeta.anchors.primitives.slice(1);
      return stale;
    }],
    ["missing source-anchor fingerprint requirement", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.sourceAnchorBeta.anchors.sourceFingerprintRequired = false;
      return stale;
    }],
    ["missing reuse contract", () => {
      const stale = clonePayload(payload);
      delete stale.domainPayload.reuseContract;
      return stale;
    }],
    ["wrong reuse contract planner decision", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.reuseContract.plannerDecision = "compact-safe";
      return stale;
    }],
    ["missing required signal in reuse contract", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.reuseContract.requiredSignals = stale.domainPayload.reuseContract.requiredSignals.slice(1);
      return stale;
    }],
    ["missing denied signal in reuse contract", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.reuseContract.deniedBySignals = stale.domainPayload.reuseContract.deniedBySignals.slice(1);
      return stale;
    }],
    ["wrong reuse contract freshness source", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.reuseContract.freshnessSource = "mtime";
      return stale;
    }],
    ["wrong reuse contract support boundary", () => {
      const stale = clonePayload(payload);
      stale.domainPayload.reuseContract.supportBoundary = "react-native-supported";
      return stale;
    }],
    ["missing source fingerprint", () => {
      const stale = clonePayload(payload);
      delete stale.sourceFingerprint;
      return stale;
    }],
    ["source fingerprint disagrees with edit guidance freshness", () => {
      const stale = clonePayload(payload);
      stale.sourceFingerprint.fileHash = "stale-hash";
      return stale;
    }],
  ];

  for (const [label, buildPayload] of rejectedPayloads) {
    assert.deepEqual(
      assessFrontendProfilePayloadReuse(".tsx", domainDetection, buildPayload(), policy),
      { allowed: false, reason: MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON },
      label,
    );
  }
});

test("pre-read payload-plan seam rejects RN stale source-fingerprint payloads", () => {
  const source = `import { View, TextInput, Text, Pressable } from "react-native"; export function Native() { return <View><TextInput onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable></View>; }`;
  const { domainDetection, policy, payload } = payloadForSource(source, "Native.tsx", { includeEditGuidance: true });
  const stalePayload = clonePayload(payload);
  stalePayload.sourceFingerprint.lineCount += 1;

  const directGateDecision = assessFrontendProfilePayloadReuse(".tsx", domainDetection, stalePayload, policy);
  const preReadDecision = buildPreReadDecisionFromPayloadPlan({
    runtime: "codex",
    filePath: "Native.tsx",
    extension: ".tsx",
    domainDetection,
    frontendPayloadPolicy: policy,
    payload: stalePayload,
    readiness: { ready: true, reasons: [], signals: {} },
    debug: { domainDetection, frontendPayloadPolicy: policy },
  });

  assert.deepEqual(directGateDecision, {
    allowed: false,
    reason: MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON,
  });
  assert.equal(preReadDecision.decision, "fallback");
  assert.deepEqual(preReadDecision.reasons, [MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON]);
  assert.equal(preReadDecision.fallback.reason, MISSING_REACT_NATIVE_DOMAIN_PAYLOAD_REASON);
  assert.equal("payload" in preReadDecision, false);
  assert.equal("readiness" in preReadDecision, false);
  assert.equal(preReadDecision.debug.domainDetection.classification, "react-native");
  assert.equal(preReadDecision.debug.frontendPayloadPolicy.allowed, true);
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
