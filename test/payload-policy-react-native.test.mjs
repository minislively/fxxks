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
  assessReactNativePrimitiveInputSignalGate,
  assessReactNativePayloadPolicy,
  RN_PRIMITIVE_INPUT_FORBIDDEN_EXACT_SIGNALS,
  RN_PRIMITIVE_INPUT_FORBIDDEN_PREFIXES,
  RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
  RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS,
} = require(path.join(repoRoot, "dist", "core", "payload-policy", "react-native.js"));
const { buildReactNativePrimitiveInputDomainPayload } = require(
  path.join(repoRoot, "dist", "core", "payload", "domain-payload.js"),
);
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const forbiddenSupportClaims = /React Native support is available|React Native is supported today|React Native support will ship|broad React Native support|default React Native compact extraction is enabled/i;

function detect(source, filePath = "Native.tsx") {
  return detectDomainFromSource(source, filePath);
}

function fixturePath(fileName) {
  return path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", fileName);
}

function fixtureSource(fileName) {
  return fs.readFileSync(fixturePath(fileName), "utf8");
}

function rnPrimitiveInputSource(extraJsx = "") {
  return `import { View, Text, TextInput, Pressable } from "react-native";
    export function NativeInput() {
      return <View><Text>Email</Text><TextInput value="" onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable>${extraJsx}</View>;
    }`;
}

function signalToEvidence(signal) {
  const [, signalKind, ...detailParts] = signal.split(":");
  return {
    domain: "react-native",
    signal: signalKind,
    detail: detailParts.join(":"),
  };
}

test("React Native payload policy allows the measured primitive/input signal set only", () => {
  const domainDetection = detect(rnPrimitiveInputSource(), "NativeInput.tsx");

  assert.equal(domainDetection.classification, "react-native");
  assert.deepEqual(assessReactNativePayloadPolicy(domainDetection), {
    name: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
    allowed: true,
  });
});


test("React Native F13 inline action fixture remains inside the narrow payload lane", () => {
  const filePath = fixturePath("rn-primitive-inline-action.tsx");
  const domainDetection = detect(fixtureSource("rn-primitive-inline-action.tsx"), filePath);

  assert.equal(domainDetection.classification, "react-native");
  assert.deepEqual(assessReactNativePayloadPolicy(domainDetection), {
    name: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
    allowed: true,
  });

  const payload = buildReactNativePrimitiveInputDomainPayload(
    {
      componentName: "InlineActionRow",
      exports: [],
      behavior: {},
      structure: {},
      domainDetection,
    },
    domainDetection,
  );

  assert.equal(payload?.domain, "react-native");
  assert.equal(payload?.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(payload?.plannerDecision, "narrow-primitive-input-payload");
  assert.equal(payload?.claimStatus, "measured-evidence-only");
  assert.equal(payload?.claimBoundary, "rn-primitive-input-narrow-payload-only");
  assert.equal(payload?.reuseContract.supportBoundary, "measured-evidence-only; no broad RN/WebView/TUI support");
  assert.deepEqual(payload?.reuseContract.requiredSignals, [...RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS]);

  const preReadDecision = preRead.decidePreRead(filePath, repoRoot, "codex", { includeEditGuidance: true });
  assert.equal(preReadDecision.decision, "payload");
  assert.equal(preReadDecision.payload.domainPayload.domain, "react-native");
  assert.equal(preReadDecision.payload.domainPayload.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(preReadDecision.payload.domainPayload.claimBoundary, "rn-primitive-input-narrow-payload-only");
  assert.equal(preReadDecision.debug.domainDetection.classification, "react-native");
  assert.equal(preReadDecision.debug.frontendPayloadPolicy.allowed, true);
});

test("React Native richer adjacent fixtures stay outside the narrow payload lane", () => {
  const richerFixtures = [
    ["rn-style-platform-navigation.tsx", /^forbidden-signal:react-native:primitive:ScrollView/],
    ["rn-interaction-gesture.tsx", /^forbidden-signal:react-native:primitive:FlatList/],
    ["rn-image-scrollview.tsx", /^forbidden-signal:react-native:primitive:Image/],
  ];

  for (const [fileName, expectedReason] of richerFixtures) {
    const filePath = fixturePath(fileName);
    const domainDetection = detect(fixtureSource(fileName), filePath);
    const policy = assessReactNativePayloadPolicy(domainDetection);

    assert.equal(domainDetection.classification, "react-native", fileName);
    assert.equal(policy?.name, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY, fileName);
    assert.equal(policy?.allowed, false, fileName);
    assert.match(policy?.reason, expectedReason, fileName);
    assert.equal(
      buildReactNativePrimitiveInputDomainPayload(
        {
          componentName: "RicherNativeFixture",
          exports: [],
          behavior: {},
          structure: {},
          domainDetection,
        },
        domainDetection,
      ),
      undefined,
      `${fileName} must not build an RN narrow domain payload`,
    );

    const preReadDecision = preRead.decidePreRead(filePath, repoRoot, "codex", { includeEditGuidance: true });
    assert.equal(preReadDecision.decision, "fallback", fileName);
    assert.equal("payload" in preReadDecision, false, `${fileName} fallback must not expose payload`);
    assert.equal("readiness" in preReadDecision, false, `${fileName} fallback must not expose readiness`);
    assert.equal(preReadDecision.fallback.reason, "unsupported-frontend-domain-profile", fileName);
    assert.equal(preReadDecision.debug.domainDetection.classification, "react-native", fileName);
    assert.equal(preReadDecision.debug.frontendPayloadPolicy.allowed, false, fileName);
  }
});

test("React Native payload policy denies missing required primitive/input signals with stable reasons", () => {
  const domainDetection = detect(
    `import { View, Text, TextInput } from "react-native";
     export function IncompleteNativeInput() {
       return <View><Text>Email</Text><TextInput value="" onChangeText={() => null} /></View>;
     }`,
    "IncompleteNativeInput.tsx",
  );

  assert.equal(domainDetection.classification, "react-native");
  assert.deepEqual(assessReactNativePayloadPolicy(domainDetection), {
    name: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
    allowed: false,
    reason: "missing-signal:react-native:primitive:Pressable",
  });
});

test("React Native payload policy denies richer RN signals before allowing the narrow gate", () => {
  const domainDetection = detect(
    `import { View, Text, TextInput, Pressable, FlatList } from "react-native";
     export function NativeList() {
       return <View><Text>Email</Text><TextInput value="" onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable><FlatList data={[]} renderItem={() => <Text>Item</Text>} /></View>;
     }`,
    "NativeList.tsx",
  );

  assert.equal(domainDetection.classification, "react-native");
  assert.deepEqual(assessReactNativePayloadPolicy(domainDetection), {
    name: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
    allowed: false,
    reason: "forbidden-signal:react-native:primitive:FlatList",
  });
});

test("React Native payload policy does not authorize non-RN domains", () => {
  const samples = [
    detect(`export function Form() { return <form><input name="email" /></form>; }`, "Form.tsx"),
    detect(`import { WebView } from "react-native-webview"; export function Preview() { return <WebView source={{ uri: "https://example.com" }} />; }`, "Preview.tsx"),
    detect(`import { Box } from "ink"; export function Cli() { return <Box />; }`, "Cli.tsx"),
    detect(`import { View } from "react-native"; export function Mixed() { return <div><View /></div>; }`, "Mixed.tsx"),
    detect(`export const answer = 42;`, "utility.ts"),
  ];

  for (const domainDetection of samples) {
    assert.equal(
      assessReactNativePayloadPolicy(domainDetection),
      undefined,
      `${domainDetection.classification}:${domainDetection.reason ?? "no-reason"} must not get RN narrow policy`,
    );
  }
});

test("pre-read compatibility entrypoint delegates RN primitive/input decisions to the policy seam", () => {
  const domainDetection = detect(rnPrimitiveInputSource(), "NativeInput.tsx");

  assert.deepEqual(preRead.assessFrontendPayloadPolicy(domainDetection), assessReactNativePayloadPolicy(domainDetection));
  assert.equal(preRead.RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
});

test("React Native F1 signal gate is the shared source of truth for policy and payload builder", () => {
  const requiredSignals = [
    "react-native:primitive:View",
    "react-native:primitive:Text",
    "react-native:primitive:TextInput",
    "react-native:primitive:Pressable",
    "react-native:jsx-prop:onChangeText",
    "react-native:jsx-prop:onPress",
  ];
  const forbiddenExactSignals = [
    "react-native:primitive:FlatList",
    "react-native:primitive:Image",
    "react-native:primitive:ScrollView",
    "react-native:primitive:TouchableOpacity",
    "react-native:style-factory:StyleSheet.create",
    "react-native:platform-select:Platform.select",
    "react-native:style-prop:resizeMode",
    "react-native:jsx-prop:activeOpacity",
    "react-native:jsx-prop:pagingEnabled",
  ];

  assert.deepEqual(RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS, requiredSignals);
  assert.deepEqual(RN_PRIMITIVE_INPUT_FORBIDDEN_EXACT_SIGNALS, forbiddenExactSignals);
  assert.deepEqual(RN_PRIMITIVE_INPUT_FORBIDDEN_PREFIXES, [
    "webview:",
    "tui-ink:",
    "react-native:navigation-",
    "react-native:api-call:Dimensions.",
    "react-native:api-call:PanResponder.",
  ]);

  const extractionResult = {
    componentName: "NativeInput",
    exports: [],
    behavior: {},
    structure: {},
    domainDetection: undefined,
  };
  const allowedDetection = {
    classification: "react-native",
    signals: requiredSignals,
    evidence: requiredSignals.map(signalToEvidence),
    profile: { lane: "react-native", claimStatus: "evidence-only", claimBoundary: "unsupported-react-native-webview-boundary" },
  };

  assert.deepEqual(assessReactNativePrimitiveInputSignalGate(allowedDetection), { allowed: true });
  assert.deepEqual(assessReactNativePayloadPolicy(allowedDetection), {
    name: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
    allowed: true,
  });
  const payload = buildReactNativePrimitiveInputDomainPayload(extractionResult, allowedDetection);
  assert.equal(payload?.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.deepEqual(payload?.reuseContract, {
    sourceDerivedOnly: true,
    policy: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
    plannerDecision: "narrow-primitive-input-payload",
    freshnessSource: "sourceFingerprint",
    staleWhen: [
      "sourceFingerprint.fileHash changes",
      "sourceFingerprint.lineCount changes",
      "frontendPayloadPolicy no longer allows RN narrow policy",
    ],
    requiredSignals,
    deniedBySignals: [
      ...forbiddenExactSignals,
      "webview:*",
      "tui-ink:*",
      "react-native:navigation-*",
      "react-native:api-call:Dimensions.*",
      "react-native:api-call:PanResponder.*",
    ],
    supportBoundary: "measured-evidence-only; no broad RN/WebView/TUI support",
  });

  for (const missingSignal of requiredSignals) {
    const domainDetection = {
      ...allowedDetection,
      signals: requiredSignals.filter((signal) => signal !== missingSignal),
    };

    assert.deepEqual(assessReactNativePrimitiveInputSignalGate(domainDetection), {
      allowed: false,
      reason: `missing-signal:${missingSignal}`,
    });
    assert.equal(buildReactNativePrimitiveInputDomainPayload(extractionResult, domainDetection), undefined);
  }

  for (const forbiddenSignal of forbiddenExactSignals) {
    const domainDetection = {
      ...allowedDetection,
      signals: [...requiredSignals, forbiddenSignal],
    };

    assert.deepEqual(assessReactNativePrimitiveInputSignalGate(domainDetection), {
      allowed: false,
      reason: `forbidden-signal:${forbiddenSignal}`,
    });
    assert.equal(buildReactNativePrimitiveInputDomainPayload(extractionResult, domainDetection), undefined);
  }
});

test("React Native policy seam source avoids broad React Native support claims", () => {
  for (const relativePath of [path.join("src", "core", "payload-policy", "react-native.ts")]) {
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"), forbiddenSupportClaims, relativePath);
  }
});
