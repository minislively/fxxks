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
  assessTuiInkPayloadPolicy,
  TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY,
  TUI_INK_EVIDENCE_ONLY_REASON,
} = require(path.join(repoRoot, "dist", "core", "payload-policy", "tui-ink.js"));
const { assessReactNativePayloadPolicy } = require(
  path.join(repoRoot, "dist", "core", "payload-policy", "react-native.js"),
);
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));

const forbiddenSupportClaims = /TUI support is available|TUI is supported today|TUI\/Ink is supported today|terminal correctness is guaranteed|terminal UX safety is guaranteed|runtime-token savings are available|provider-token savings are available|billing savings are available|TUI performance improvement is available|default TUI compact extraction is enabled/i;

function detect(source, filePath = "Cli.tsx") {
  return detectDomainFromSource(source, filePath);
}

function readFixture(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function tuiInkSource() {
  return `import React from "react";
    import { Box, Text, useInput } from "ink";
    export function Cli() {
      useInput(() => null);
      return <Box><Text>Ready</Text></Box>;
    }`;
}

const tuiEvidenceMatrix = [
  {
    fileName: "tui-ink-basic.tsx",
    classification: "tui-ink",
    claimStatus: "evidence-only",
    expectedPolicy: expectedTuiEvidenceOnlyPolicy,
    fallbackReason: () => preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  },
  {
    fileName: "tui-ink-interactive-list.tsx",
    classification: "tui-ink",
    claimStatus: "evidence-only",
    expectedPolicy: expectedTuiEvidenceOnlyPolicy,
    fallbackReason: () => "raw-mode",
  },
  {
    fileName: "tui-ink-form-prompt.tsx",
    classification: "tui-ink",
    claimStatus: "evidence-only",
    expectedPolicy: expectedTuiEvidenceOnlyPolicy,
    fallbackReason: () => preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  },
  {
    fileName: "tui-ink-layout-style.tsx",
    classification: "tui-ink",
    claimStatus: "evidence-only",
    expectedPolicy: expectedTuiEvidenceOnlyPolicy,
    fallbackReason: () => preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  },
  {
    fileName: "tui-ink-status-panel.tsx",
    classification: "tui-ink",
    claimStatus: "evidence-only",
    expectedPolicy: expectedTuiEvidenceOnlyPolicy,
    fallbackReason: () => "raw-mode",
  },
  {
    fileName: "tui-non-ink-cli-renderer.tsx",
    classification: "unknown",
    claimStatus: "deferred",
    expectedPolicy: () => undefined,
    fallbackReason: () => undefined,
  },
  {
    fileName: "tui-ink-web-dom-mixed.tsx",
    classification: "mixed",
    claimStatus: "fallback-boundary",
    expectedPolicy: () => undefined,
    fallbackReason: () => preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
  },
  {
    fileName: "tui-ink-rn-narrow-mixed.tsx",
    classification: "mixed",
    claimStatus: "fallback-boundary",
    expectedPolicy: () => undefined,
    fallbackReason: () => preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
  },
];

const tuiConcernTaxonomyTerms = [
  "Compact Ink syntax baseline",
  "Keyboard input",
  "Prompt/form flow",
  "Layout/style",
  "Status/progress",
  "Mixed-boundary",
  "Non-Ink negative evidence",
];

const operationalConcernRows = [
  ["tui-ink-basic.tsx", "Compact Ink syntax baseline; keyboard input"],
  ["tui-ink-interactive-list.tsx", "Keyboard input"],
  ["tui-ink-form-prompt.tsx", "Keyboard input; prompt/form flow"],
  ["tui-ink-layout-style.tsx", "Layout/style"],
  ["tui-ink-status-panel.tsx", "Status/progress"],
  ["tui-non-ink-cli-renderer.tsx", "Non-Ink negative evidence"],
  ["tui-ink-web-dom-mixed.tsx", "Mixed-boundary"],
  ["tui-ink-rn-narrow-mixed.tsx", "Mixed-boundary"],
];

const payloadReadinessGateTerms = [
  "Payload design readiness gate",
  "does not mean TUI is supported",
  "compact extraction is allowed",
  "runtime injection may begin",
  "allowed: false",
  "model-facing TUI payload",
  "separate serialized plan",
];

const metadataProjectionCategories = [
  "TUI-safe metadata projection contract",
  "Safe shared metadata",
  "TUI-specific source evidence",
  "Caution metadata",
  "Fallback-required metadata",
  "Forbidden projection",
];

const metadataProjectionTerms = [
  "Imports",
  "component/export names",
  "JSX tags",
  "prop names",
  "hook names",
  "handler identifiers",
  "state variable names",
  "source ranges",
  "domain classification",
  "policy decision",
  "fallback reason",
  "Ink import",
  "`Box`",
  "`Text`",
  "`useInput`",
  "source-observed key branch names",
  "prompt/list/status concern tags",
  "Layout/style props",
  "color/dim/border props",
  "mapped rows",
  "command/status labels",
  "Command execution behavior",
  "TTY/stdin behavior",
  "terminal width/wrapping",
  "key handling correctness",
  "progress/runtime state",
  "shell side effects",
  "DOM roles",
  "ARIA relationships",
  "`htmlFor`/id form relations",
  "browser form semantics",
  "CSS/className meaning",
  "React Web layout region semantics",
  "browser accessibility assumptions",
];

const tuiMinimalPayloadCandidateFields = [
  "terminalLayoutEvidence",
  "terminalTextStatusEvidence",
  "terminalInputFlowEvidence",
  "terminalStyleEvidence",
  "terminalMixedBoundaryEvidence",
  "terminalNegativeBoundaryEvidence",
];

const tuiMinimalPayloadFixtureMap = [
  ["terminalLayoutEvidence", "tui-ink-layout-style.tsx"],
  ["terminalTextStatusEvidence", "tui-ink-status-panel.tsx"],
  ["terminalInputFlowEvidence", "tui-ink-form-prompt.tsx"],
  ["terminalStyleEvidence", "tui-ink-layout-style.tsx"],
  ["terminalMixedBoundaryEvidence", "tui-ink-rn-narrow-mixed.tsx"],
  ["terminalNegativeBoundaryEvidence", "tui-non-ink-cli-renderer.tsx"],
];

const surveyReviewChecklistTerms = [
  "Evidence-only review checklist",
  "every positive Ink row still ends in `evidence-only`, denied policy, and fallback/no-payload",
  "at least one non-Ink or mixed fallback row remains visible whenever positive Ink evidence expands",
  "must not be reused as README, roadmap, release-note, or package support wording",
  "shared detector/pre-read/runtime seams",
];

const operationalReviewChecklistTerms = [
  "Evidence reinforcement review checklist",
  "docs/tests-only evidence reinforcement",
  "denied policy, fallback reason, or stop rules",
  "positive Ink evidence remains paired with non-Ink or mixed fallback visibility",
  "README, roadmap, release, package, and runtime-facing wording stay candidate/evidence-only",
  "manifest, detector, policy, pre-read, or runtime request stops the lane",
];

function tuiFixturePath(fileName) {
  return path.join("test", "fixtures", "frontend-domain-expectations", fileName);
}

function expectedTuiEvidenceOnlyPolicy() {
  return {
    name: TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY,
    allowed: false,
    reason: TUI_INK_EVIDENCE_ONLY_REASON,
  };
}

function assertFallbackWithoutPayload(decision) {
  assert.equal(decision.eligible, true);
  assert.equal(decision.decision, "fallback");
  assert.ok(decision.reasons.length > 0);
  assert.equal(decision.fallback.action, "full-read");
  assert.equal("payload" in decision, false);
}

function assertTuiFallbackWithoutPayload(decision, reason) {
  assert.equal(decision.eligible, true);
  assert.equal(decision.decision, "fallback");
  assert.deepEqual(decision.reasons, [reason]);
  assert.equal(decision.fallback.reason, reason);
  assert.equal(decision.debug.domainDetection.classification, "tui-ink");
  assert.deepEqual(decision.debug.frontendPayloadPolicy, expectedTuiEvidenceOnlyPolicy());
  assert.equal("payload" in decision, false);
}

test("TUI/Ink payload policy returns evidence-only denied decision for Ink evidence", () => {
  const domainDetection = detect(tuiInkSource(), "Cli.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.profile.claimStatus, "evidence-only");
  assert.ok(domainDetection.signals.some((signal) => signal.startsWith("tui-ink:")));
  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedTuiEvidenceOnlyPolicy());
});

test("TUI/Ink payload policy does not authorize non-TUI domains", () => {
  const samples = [
    detect(`export function Form() { return <form><input name="email" /></form>; }`, "Form.tsx"),
    detect(`import { View, TextInput, Text, Pressable } from "react-native"; export function Native() { return <View><TextInput onChangeText={() => null} /><Pressable onPress={() => null}><Text>Save</Text></Pressable></View>; }`, "Native.tsx"),
    detect(`import { WebView } from "react-native-webview"; export function Preview() { return <WebView source={{ uri: "https://example.com" }} />; }`, "Preview.tsx"),
    detect(`import { Box } from "ink"; import { View } from "react-native"; export function Mixed() { return <Box><View /></Box>; }`, "Mixed.tsx"),
    detect(`export const answer = 42;`, "utility.ts"),
  ];

  for (const domainDetection of samples) {
    assert.equal(
      assessTuiInkPayloadPolicy(domainDetection),
      undefined,
      `${domainDetection.classification}:${domainDetection.reason ?? "no-reason"} must not get TUI/Ink policy`,
    );
  }
});

test("pre-read compatibility entrypoint delegates TUI/Ink decisions to the policy seam", () => {
  const domainDetection = detect(tuiInkSource(), "Cli.tsx");

  assert.deepEqual(preRead.assessFrontendPayloadPolicy(domainDetection), assessTuiInkPayloadPolicy(domainDetection));
  assert.equal(preRead.TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY, TUI_INK_EVIDENCE_ONLY_PAYLOAD_POLICY);
});

test("TUI/Ink pre-read stays fallback-only even with an explicit denied policy", () => {
  const fixturePath = path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", "tui-ink-basic.tsx");
  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertTuiFallbackWithoutPayload(decision, preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
});

test("TUI/Ink interactive list fixture remains evidence-only and fallback-safe", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-ink-interactive-list.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const domainDetection = detect(readFixture(relativeFixturePath), "tui-ink-interactive-list.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.profile.claimStatus, "evidence-only");
  assert.ok(domainDetection.signals.includes("tui-ink:import:ink"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Box"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Text"));
  assert.ok(domainDetection.signals.includes("tui-ink:hook:useInput"));
  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedTuiEvidenceOnlyPolicy());

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertTuiFallbackWithoutPayload(decision, "raw-mode");
});

test("TUI/Ink form prompt fixture broadens positive evidence without payload permission", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-ink-form-prompt.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const fixtureSource = readFixture(relativeFixturePath);
  const domainDetection = detect(fixtureSource, "tui-ink-form-prompt.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.profile.claimStatus, "evidence-only");
  assert.ok(domainDetection.signals.includes("tui-ink:import:ink"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Box"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Text"));
  assert.ok(domainDetection.signals.includes("tui-ink:hook:useInput"));
  assert.match(fixtureSource, /useState/);
  assert.match(fixtureSource, /Target is required/);
  assert.match(fixtureSource, /key\.return/);
  assert.match(fixtureSource, /key\.escape/);
  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedTuiEvidenceOnlyPolicy());

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertTuiFallbackWithoutPayload(decision, preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
});

test("TUI/Ink layout style fixture broadens positive evidence without payload permission", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-ink-layout-style.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const fixtureSource = readFixture(relativeFixturePath);
  const domainDetection = detect(fixtureSource, "tui-ink-layout-style.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.profile.claimStatus, "evidence-only");
  assert.ok(domainDetection.signals.includes("tui-ink:import:ink"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Box"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Text"));
  assert.equal(domainDetection.signals.includes("tui-ink:hook:useInput"), false);
  assert.match(fixtureSource, /flexDirection="column"/);
  assert.match(fixtureSource, /gap=\{1\}/);
  assert.match(fixtureSource, /paddingX=\{1\}/);
  assert.match(fixtureSource, /borderStyle="round"/);
  assert.match(fixtureSource, /borderColor="cyan"/);
  assert.match(fixtureSource, /color="cyan"/);
  assert.match(fixtureSource, /dimColor/);
  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedTuiEvidenceOnlyPolicy());

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertTuiFallbackWithoutPayload(decision, preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
});

test("TUI/Ink status panel fixture broadens evidence without payload permission", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-ink-status-panel.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const domainDetection = detect(readFixture(relativeFixturePath), "tui-ink-status-panel.tsx");

  assert.equal(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.profile.claimStatus, "evidence-only");
  assert.ok(domainDetection.signals.includes("tui-ink:import:ink"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Box"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Text"));
  assert.equal(domainDetection.signals.includes("tui-ink:hook:useInput"), false);
  assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedTuiEvidenceOnlyPolicy());

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertTuiFallbackWithoutPayload(decision, "raw-mode");
});

test("non-Ink CLI renderer fixture stays outside TUI/Ink payload policy", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-non-ink-cli-renderer.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const domainDetection = detect(readFixture(relativeFixturePath), "tui-non-ink-cli-renderer.tsx");

  assert.notEqual(domainDetection.classification, "tui-ink");
  assert.equal(domainDetection.classification, "unknown");
  assert.equal(domainDetection.profile.claimStatus, "deferred");
  assert.equal(domainDetection.signals.some((signal) => signal.startsWith("tui-ink:")), false);
  assert.equal(assessTuiInkPayloadPolicy(domainDetection), undefined);

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertFallbackWithoutPayload(decision);
  assert.equal(decision.debug.domainDetection.classification, "unknown");
  assert.equal(decision.debug.frontendPayloadPolicy.allowed, false);
  assert.equal(decision.debug.frontendPayloadPolicy.reason, preRead.UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
});

test("TUI/Ink mixed web DOM fixture stays outside TUI and React Web payload lanes", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-ink-web-dom-mixed.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const domainDetection = detect(readFixture(relativeFixturePath), "tui-ink-web-dom-mixed.tsx");

  assert.equal(domainDetection.classification, "mixed");
  assert.equal(domainDetection.profile.claimStatus, "fallback-boundary");
  assert.ok(domainDetection.signals.includes("tui-ink:import:ink"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Box"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Text"));
  assert.ok(domainDetection.signals.includes("react-web:dom-tag:form"));
  assert.ok(domainDetection.signals.includes("react-web:dom-tag:input"));
  assert.ok(domainDetection.signals.includes("react-web:dom-tag:button"));
  assert.ok(domainDetection.signals.includes("react-web:jsx-attribute:className"));
  assert.ok(domainDetection.signals.includes("react-web:jsx-attribute:htmlFor"));
  assert.equal(assessTuiInkPayloadPolicy(domainDetection), undefined);

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertFallbackWithoutPayload(decision);
  assert.equal(decision.debug.domainDetection.classification, "mixed");
  assert.equal(decision.debug.frontendPayloadPolicy.name, preRead.MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY);
  assert.equal(decision.debug.frontendPayloadPolicy.allowed, false);
  assert.equal(decision.debug.frontendPayloadPolicy.reason, preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.deepEqual(decision.reasons, [preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON]);
});

test("TUI/Ink mixed RN narrow fixture stays outside TUI and React Native payload lanes", () => {
  const relativeFixturePath = path.join(
    "test",
    "fixtures",
    "frontend-domain-expectations",
    "tui-ink-rn-narrow-mixed.tsx",
  );
  const fixturePath = path.join(repoRoot, relativeFixturePath);
  const domainDetection = detect(readFixture(relativeFixturePath), "tui-ink-rn-narrow-mixed.tsx");

  assert.equal(domainDetection.classification, "mixed");
  assert.equal(domainDetection.profile.claimStatus, "fallback-boundary");
  assert.ok(domainDetection.signals.includes("tui-ink:import:ink"));
  assert.ok(domainDetection.signals.includes("tui-ink:primitive:Box"));
  assert.ok(domainDetection.signals.includes("react-native:primitive:View"));
  assert.ok(domainDetection.signals.includes("react-native:primitive:Text"));
  assert.ok(domainDetection.signals.includes("react-native:primitive:TextInput"));
  assert.ok(domainDetection.signals.includes("react-native:primitive:Pressable"));
  assert.ok(domainDetection.signals.includes("react-native:jsx-prop:onChangeText"));
  assert.ok(domainDetection.signals.includes("react-native:jsx-prop:onPress"));
  assert.equal(assessTuiInkPayloadPolicy(domainDetection), undefined);
  assert.equal(assessReactNativePayloadPolicy(domainDetection), undefined);

  const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

  assertFallbackWithoutPayload(decision);
  assert.equal(decision.debug.domainDetection.classification, "mixed");
  assert.equal(decision.debug.frontendPayloadPolicy.name, preRead.MIXED_FRONTEND_BOUNDARY_PAYLOAD_POLICY);
  assert.equal(decision.debug.frontendPayloadPolicy.allowed, false);
  assert.equal(decision.debug.frontendPayloadPolicy.reason, preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.deepEqual(decision.reasons, [preRead.REACT_NATIVE_WEBVIEW_BOUNDARY_REASON]);
});

test("TUI evidence matrix rows stay aligned with policy and pre-read boundaries", () => {
  for (const row of tuiEvidenceMatrix) {
    const relativeFixturePath = tuiFixturePath(row.fileName);
    const fixturePath = path.join(repoRoot, relativeFixturePath);
    const domainDetection = detect(readFixture(relativeFixturePath), row.fileName);
    const expectedPolicy = row.expectedPolicy();
    const decision = preRead.decidePreRead(fixturePath, repoRoot, "codex");

    assert.equal(domainDetection.classification, row.classification, row.fileName);
    assert.equal(domainDetection.profile.claimStatus, row.claimStatus, row.fileName);
    assert.deepEqual(assessTuiInkPayloadPolicy(domainDetection), expectedPolicy, row.fileName);
    assert.equal(decision.decision, "fallback", row.fileName);
    assert.equal("payload" in decision, false, row.fileName);
    assert.notEqual(expectedPolicy?.allowed, true, row.fileName);

    const fallbackReason = row.fallbackReason();
    if (fallbackReason) {
      assert.deepEqual(decision.reasons, [fallbackReason], row.fileName);
      assert.equal(decision.fallback.reason, fallbackReason, row.fileName);
    }
  }
});

test("TUI/Ink policy seam source avoids broad terminal support claims", () => {
  for (const relativePath of [path.join("src", "core", "payload-policy", "tui-ink.ts")]) {
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"), forbiddenSupportClaims, relativePath);
  }
});

test("TUI/Ink fixture survey documents evidence-only reinforcement without support claims", () => {
  const survey = fs.readFileSync(path.join(repoRoot, "docs", "tui-fixture-candidates.md"), "utf8");

  assert.match(survey, /Current evidence-only reinforcement slice/);
  assert.match(survey, /TUI concern taxonomy/);
  assert.match(survey, /concern evidence is not payload permission/);
  for (const term of tuiConcernTaxonomyTerms) {
    assert.ok(survey.includes(term), term);
  }
  assert.match(survey, /tui-ink-basic\.tsx/);
  assert.match(survey, /tui-ink-interactive-list\.tsx/);
  assert.match(survey, /tui-ink-form-prompt\.tsx/);
  assert.match(survey, /tui-ink-layout-style\.tsx/);
  assert.match(survey, /tui-ink-status-panel\.tsx/);
  assert.match(survey, /unsupported-frontend-domain-profile/);
  assert.match(survey, /tui-non-ink-cli-renderer\.tsx/);
  assert.match(survey, /tui-ink-web-dom-mixed\.tsx/);
  assert.match(survey, /tui-ink-rn-narrow-mixed\.tsx/);
  assert.match(survey, /Negative\/fallback reinforcement/);
  assert.match(survey, /Current TUI evidence matrix/);
  for (const term of surveyReviewChecklistTerms) {
    assert.ok(survey.includes(term), term);
  }
  assert.match(survey, /Payload design readiness handoff/);
  assert.match(survey, /not itself a payload contract/);
  assert.match(survey, /TUI-safe metadata projection contract/);
  assert.match(survey, /forbidden React Web-only projections/);
  assert.match(survey, /Minimal payload candidate vocabulary/);
  assert.match(survey, /Source-only dry-run implementation handoff/);
  assert.match(survey, /pre-read emits no model-facing TUI payload/);
  assert.match(survey, /separate serialized plan/);
  assert.match(survey, /tui-ink-evidence-only-payload/);
  assert.match(survey, /mixed frontend boundary/);
  for (const field of tuiMinimalPayloadCandidateFields) {
    assert.ok(survey.includes(field), field);
  }
  for (const [field, fixture] of tuiMinimalPayloadFixtureMap) {
    assert.ok(survey.includes(field), field);
    assert.ok(survey.includes(fixture), fixture);
  }
  assert.match(survey, /not model-facing payload fields yet/);
  assert.match(survey, /non-emitting metadata projection/);
  assert.match(survey, /keep `assessTuiInkPayloadPolicy` denied with `allowed: false`/);
  assert.doesNotMatch(survey, forbiddenSupportClaims);
});

test("TUI operational readiness guide keeps payload planning separate", () => {
  const guide = fs.readFileSync(path.join(repoRoot, "docs", "tui-operational-readiness.md"), "utf8");

  assert.match(guide, /## Current state/);
  assert.match(guide, /## Fixture roles/);
  assert.match(guide, /current TUI concern taxonomy/);
  assert.match(guide, /Concern category/);
  assert.match(guide, /concern evidence is not payload permission/);
  assert.match(guide, /## Allowed next work/);
  for (const term of operationalReviewChecklistTerms) {
    assert.ok(guide.includes(term), term);
  }
  assert.match(guide, /## Promotion criteria before payload-design planning/);
  assert.match(guide, /## Payload design readiness gate/);
  assert.match(guide, /## Minimal payload candidate schema contract/);
  assert.match(guide, /## Source-only dry-run handoff/);
  assert.match(guide, /## Stop rules/);
  assert.match(guide, /tui-ink-evidence-only-payload/);
  assert.match(guide, /fallback\/no-payload/);
  assert.match(guide, /\*\*not\*\* a payload schema/);
  assert.match(guide, /\*\*not\*\* compact extraction permission/);
  assert.match(guide, /\*\*not\*\* model-facing output/);
  assert.match(guide, /serialized shared-policy plan/);
  for (const category of metadataProjectionCategories) {
    assert.ok(guide.includes(category), category);
  }
  for (const term of metadataProjectionTerms) {
    assert.ok(guide.includes(term), term);
  }
  for (const term of payloadReadinessGateTerms) {
    assert.ok(guide.includes(term), term);
  }
  for (const [fixture, concern] of operationalConcernRows) {
    assert.ok(guide.includes(`${fixture}\` | ${concern}`), fixture);
  }
  assert.match(guide, /no TUI or React Web payload authorization/);
  assert.match(guide, /no TUI or RN narrow payload authorization/);
  for (const field of tuiMinimalPayloadCandidateFields) {
    assert.ok(guide.includes(field), field);
  }
  assert.match(guide, /source-derived, fixture-backed, and denied/);
  assert.match(guide, /It may guide a future metadata projection/);
  assert.match(guide, /model-facing payload emission out of scope/);
  assert.doesNotMatch(guide, forbiddenSupportClaims);
});
