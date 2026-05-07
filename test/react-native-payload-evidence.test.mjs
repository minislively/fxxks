import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  RN_PRESSABLE_METADATA_FIELDS,
  RN_TEXT_INPUT_METADATA_FIELDS,
  buildReactNativePayloadEvidence,
  renderReactNativePayloadEvidenceMarkdown,
} from "../scripts/react-native-payload-evidence.mjs";

const repoRoot = process.cwd();

test("React Native payload evidence exposes primitiveInteractions without widening RN scope", async () => {
  const evidence = await buildReactNativePayloadEvidence({ runId: `test-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.schemaVersion, "react-native-payload-evidence.v3");
  assert.equal(evidence.measurement, "local-fixture-pre-read-and-model-facing-domain-payload-evidence");
  assert.match(evidence.claimBoundary, /Local fixture payload evidence only/);
  assert.match(evidence.claimBoundary, /not broad React Native support/);
  assert.match(evidence.claimBoundary, /not runtime reuse promotion/);
  assert.match(evidence.claimBoundary, /not edit routing/);
  assert.match(evidence.claimBoundary, /not provider billing or invoice savings/);

  assert.equal(evidence.summary.fixtureCount, 2);
  assert.equal(evidence.summary.rnPayloadFactsVisible.claimable, true);
  assert.equal(evidence.summary.rnPayloadFactsVisible.blocker, null);
  assert.equal(evidence.summary.boundaryFallbacksPreserved.claimable, true);
  assert.equal(evidence.summary.boundaryFallbacksPreserved.blocker, null);
  assert.equal(evidence.summary.metadataAnchorsVisible.claimable, true);
  assert.equal(evidence.summary.metadataAnchorsVisible.blocker, null);
  assert.equal(evidence.summary.inputConstraintsVisible.claimable, true);
  assert.equal(evidence.summary.inputConstraintsVisible.scope, "rn-primitive-input-narrow-payload-only");
  assert.equal(evidence.summary.stateActionRelationsVisible.claimable, true);
  assert.equal(evidence.summary.stateActionRelationsVisible.relationKind, "actionReadsInputValue");
  assert.equal(evidence.summary.constraintActionReadinessVisible.claimable, true);
  assert.equal(evidence.summary.constraintActionReadinessVisible.relationKind, "constraintActionReadiness");
  assert.deepEqual(
    evidence.summary.metadataAnchorsVisible.textInputFields.map((row) => row.field),
    RN_TEXT_INPUT_METADATA_FIELDS,
  );
  assert.deepEqual(
    evidence.summary.metadataAnchorsVisible.pressableFields.map((row) => row.field),
    RN_PRESSABLE_METADATA_FIELDS,
  );
  for (const row of [
    ...evidence.summary.metadataAnchorsVisible.textInputFields,
    ...evidence.summary.metadataAnchorsVisible.pressableFields,
  ]) {
    assert.equal(row.preRead, true, row.field);
    assert.equal(row.modelFacing, true, row.field);
    assert.equal(row.claimable, true, row.field);
  }
  assert.equal(evidence.summary.broadReactNativeSupport.claimable, false);
  assert.equal(evidence.summary.runtimeReusePromotion.claimable, false);
  assert.equal(evidence.summary.editRouting.claimable, false);
  assert.equal(evidence.summary.providerBillingSavings.claimable, false);

  for (const row of evidence.fixtures) {
    assert.equal(row.classification, "react-native");
    assert.equal(row.preReadDecision, "payload");
    assert.equal(row.payloadPolicy, "rn-primitive-input-narrow-payload");
    assert.equal(row.sourceFingerprintPresent, true);
    assert.equal(row.preRead.domain, "react-native");
    assert.equal(row.preRead.claimBoundary, "rn-primitive-input-narrow-payload-only");
    assert.equal(row.preRead.sourceAnchorBetaVersion, "rn-source-anchor-beta.v0");
    assert.equal(row.preRead.reuseFreshnessSource, "sourceFingerprint");
    assert.equal(row.preRead.strictContractsPresent, true);
    assert.equal(row.preRead.primitiveInteractions.hasTextInputBinding, true);
    assert.equal(row.preRead.primitiveInteractions.hasPressableAction, true);
    assert.ok(row.preRead.primitiveInteractions.metadataCoverage.textInputFields.length > 0, row.file);
    assert.ok(row.preRead.primitiveInteractions.metadataCoverage.pressableFields.length > 0, row.file);
    assert.equal(row.modelFacing.strictContractsPresent, true);
    assert.equal(row.modelFacing.primitiveInteractions.hasTextInputBinding, true);
    assert.equal(row.modelFacing.primitiveInteractions.hasPressableAction, true);
    assert.ok(row.modelFacing.primitiveInteractions.metadataCoverage.textInputFields.length > 0, row.file);
    assert.ok(row.modelFacing.primitiveInteractions.metadataCoverage.pressableFields.length > 0, row.file);
    assert.equal(row.claimable, true);
  }

  const basic = evidence.fixtures.find((row) => row.file.endsWith("rn-primitive-basic.tsx"));
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].valueExpr, "value");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].onChangeTextExpr, "onChangeText");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].onChangeTextSource, "component-prop");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].placeholder, "Filter");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].keyboardType, "default");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].secureTextEntry, "false");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].maxLength, "80");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].autoCapitalize, "none");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].accessibilityLabel, "Search filter");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].testID, "search-input");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].onPressExpr, "onApply");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].onPressSource, "component-prop");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].label, "Apply");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].disabled, "isApplyDisabled");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].accessibilityLabel, "Apply filter");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].accessibilityRole, "button");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].testID, "apply-button");

  const inline = evidence.fixtures.find((row) => row.file.endsWith("rn-primitive-inline-action.tsx"));
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].placeholder, "Type filter");
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].keyboardType, "web-search");
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].autoCapitalize, "sentences");
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].accessibilityLabel, "Inline filter");
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].testID, "inline-filter-input");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].onPressExpr, "submitCurrentValue");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].onPressSource, "same-file-local");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].label, "Submit");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].disabled, "isSubmitDisabled");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].accessibilityLabel, "Submit filter");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].testID, "submit-filter-button");
  assert.deepEqual(inline.preRead.primitiveInteractions.stateActionRelations, inline.modelFacing.primitiveInteractions.stateActionRelations);
  assert.equal(inline.preRead.primitiveInteractions.stateActionRelations[0].relationKind, "actionReadsInputValue");
  assert.equal(inline.preRead.primitiveInteractions.stateActionRelations[0].onPressExpr, "submitCurrentValue");
  assert.deepEqual(inline.preRead.primitiveInteractions.constraintActionReadiness, inline.modelFacing.primitiveInteractions.constraintActionReadiness);
  assert.equal(inline.preRead.primitiveInteractions.constraintActionReadiness[0].relationKind, "constraintActionReadiness");
  assert.equal(inline.preRead.primitiveInteractions.constraintActionReadiness[0].disabledExpr, "isSubmitDisabled");
});

test("React Native payload evidence keeps richer RN WebView and TUI boundaries fallback-only", async () => {
  const evidence = await buildReactNativePayloadEvidence({ runId: `boundary-test-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.summary.boundaryFixtureCount, 5);
  for (const row of evidence.boundaryFixtures) {
    assert.equal(row.decision, "fallback", row.file);
    assert.equal(row.payloadExposed, false, row.file);
    assert.equal(row.rnPrimitiveInteractionsExposed, false, row.file);
    assert.equal(row.boundaryPreserved, true, row.file);
  }

  assert.ok(evidence.boundaryFixtures.some((row) => row.classification === "react-native"));
  assert.ok(evidence.boundaryFixtures.some((row) => row.classification === "webview"));
  assert.ok(evidence.boundaryFixtures.some((row) => row.classification === "tui-ink"));
});

test("React Native payload evidence Markdown keeps claim boundaries explicit", async () => {
  const evidence = await buildReactNativePayloadEvidence({ runId: `markdown-test-${Date.now()}-${Math.random()}` });
  const markdown = renderReactNativePayloadEvidenceMarkdown(evidence);

  assert.match(markdown, /RN primitive interaction facts visible: yes/);
  assert.match(markdown, /Richer RN\/WebView\/TUI boundaries preserved: yes/);
  assert.match(markdown, /RN metadata anchors visible: yes/);
  assert.match(markdown, /Measured RN narrow constraint\/action readiness visible: yes/);
  assert.match(markdown, /actionReadsInputValue:submitCurrentValue->value/);
  assert.match(markdown, /constraintActionReadiness:submitCurrentValue->value,disabled=isSubmitDisabled/);
  assert.match(markdown, /\| TextInput \| keyboardType \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| TextInput \| secureTextEntry \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| TextInput \| maxLength \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| TextInput \| autoCapitalize \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| Pressable \| disabled \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| Pressable \| accessibilityRole \| yes \| yes \| yes \|/);
  assert.match(markdown, /Broad React Native support claimable: no/);
  assert.match(markdown, /Runtime reuse promotion claimable: no/);
  assert.match(markdown, /RN edit routing claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /existing `rn-primitive-input-narrow-payload` lane/);
  assert.doesNotMatch(markdown, /Broad React Native support claimable: yes/i);
  assert.doesNotMatch(markdown, /Runtime reuse promotion claimable: yes/i);
  assert.doesNotMatch(markdown, /RN edit routing claimable: yes/i);
  assert.doesNotMatch(markdown, /reactNativeContext|rnContext|editTargetRouting/i);
});

test("React Native payload evidence command writes bounded JSON and Markdown reports", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-rn-payload-evidence-"));
  const outputPath = path.join(tempDir, "rn-payload-evidence.json");
  const markdownPath = path.join(tempDir, "rn-payload-evidence.md");

  const cli = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "react-native-payload-evidence.mjs"),
      "--run-id=cli-test",
      `--output=${outputPath}`,
      `--markdown-output=${markdownPath}`,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(fs.existsSync(markdownPath), true);

  const stdoutEvidence = JSON.parse(cli.stdout);
  const fileEvidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const markdown = fs.readFileSync(markdownPath, "utf8");

  assert.equal(stdoutEvidence.schemaVersion, "react-native-payload-evidence.v3");
  assert.equal(stdoutEvidence.runId, "cli-test");
  assert.deepEqual(fileEvidence, stdoutEvidence);
  assert.match(markdown, /# React Native payload evidence/);
  assert.match(markdown, /Local fixture payload evidence only/);
  assert.match(markdown, /RN primitive interaction facts visible: yes/);
  assert.match(markdown, /Broad React Native support claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
});
