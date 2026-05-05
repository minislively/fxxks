import test from "node:test";
import assert from "node:assert/strict";
import {
  RN_PRESSABLE_METADATA_FIELDS,
  RN_TEXT_INPUT_CONSTRAINT_FIELDS,
  RN_TEXT_INPUT_METADATA_FIELDS,
  buildReactNativePayloadEvidence,
  renderReactNativePayloadEvidenceMarkdown,
} from "../scripts/react-native-payload-evidence.mjs";

test("React Native payload evidence exposes primitiveInteractions without widening RN scope", async () => {
  const evidence = await buildReactNativePayloadEvidence({ runId: `test-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.schemaVersion, "react-native-payload-evidence.v4");
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
  assert.equal(evidence.summary.inputConstraintsVisible.blocker, null);
  assert.ok(
    evidence.summary.inputConstraintsVisible.directConstraintFixtures.some((file) => file.endsWith("rn-primitive-basic.tsx")),
  );
  assert.equal(evidence.summary.stateActionRelationsVisible.claimable, true);
  assert.equal(evidence.summary.stateActionRelationsVisible.relationKind, "actionReadsInputValue");
  assert.ok(
    evidence.summary.stateActionRelationsVisible.directRelationFixtures.some((file) => file.endsWith("rn-primitive-inline-action.tsx")),
  );
  assert.ok(
    evidence.summary.stateActionRelationsVisible.omittedRelationFixtures.some((file) => file.endsWith("rn-primitive-basic.tsx")),
  );
  assert.deepEqual(
    evidence.summary.metadataAnchorsVisible.textInputFields.map((row) => row.field),
    RN_TEXT_INPUT_METADATA_FIELDS,
  );
  assert.deepEqual(
    evidence.summary.metadataAnchorsVisible.pressableFields.map((row) => row.field),
    RN_PRESSABLE_METADATA_FIELDS,
  );
  assert.deepEqual(
    evidence.summary.inputConstraintsVisible.fields.map((row) => row.field),
    RN_TEXT_INPUT_CONSTRAINT_FIELDS,
  );
  for (const row of [
    ...evidence.summary.metadataAnchorsVisible.textInputFields,
    ...evidence.summary.metadataAnchorsVisible.pressableFields,
    ...evidence.summary.inputConstraintsVisible.fields,
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
    assert.ok(row.preRead.primitiveInteractions.inputConstraints.length > 0, row.file);
    assert.equal(row.modelFacing.strictContractsPresent, true);
    assert.equal(row.modelFacing.primitiveInteractions.hasTextInputBinding, true);
    assert.equal(row.modelFacing.primitiveInteractions.hasPressableAction, true);
    assert.ok(row.modelFacing.primitiveInteractions.metadataCoverage.textInputFields.length > 0, row.file);
    assert.ok(row.modelFacing.primitiveInteractions.metadataCoverage.pressableFields.length > 0, row.file);
    assert.ok(row.modelFacing.primitiveInteractions.inputConstraints.length > 0, row.file);
    assert.equal(row.claimable, true);
  }

  const basic = evidence.fixtures.find((row) => row.file.endsWith("rn-primitive-basic.tsx"));
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].valueExpr, "value");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].onChangeTextExpr, "onChangeText");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].placeholder, "Filter");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].keyboardType, "default");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].secureTextEntry, "false");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].maxLength, "80");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].autoCapitalize, "none");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].accessibilityLabel, "Search filter");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].testID, "search-input");
  assert.deepEqual(basic.preRead.primitiveInteractions.inputConstraints, [
    {
      primitive: "TextInput",
      loc: { startLine: 14, endLine: 24 },
      valueExpr: "value",
      constraintKind: "textInputMetadataConstraints",
      maxLength: "80",
      secureTextEntry: "false",
      keyboardType: "default",
      autoCapitalize: "none",
      descriptiveHint: "Filter",
      constraintBasis: [
        "jsx.TextInput.maxLength",
        "jsx.TextInput.secureTextEntry",
        "jsx.TextInput.keyboardType",
        "jsx.TextInput.autoCapitalize",
      ],
      evidence: [
        "jsx.TextInput.maxLength",
        "jsx.TextInput.secureTextEntry",
        "jsx.TextInput.keyboardType",
        "jsx.TextInput.autoCapitalize",
        "jsx.TextInput.placeholder",
      ],
    },
  ]);
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].onPressExpr, "onApply");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].label, "Apply");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].disabled, "isApplyDisabled");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].accessibilityLabel, "Apply filter");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].accessibilityRole, "button");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].testID, "apply-button");
  assert.deepEqual(basic.preRead.primitiveInteractions.stateActionRelations, []);
  assert.deepEqual(basic.modelFacing.primitiveInteractions.stateActionRelations, []);

  const inline = evidence.fixtures.find((row) => row.file.endsWith("rn-primitive-inline-action.tsx"));
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].placeholder, "Type filter");
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].keyboardType, "web-search");
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].autoCapitalize, "sentences");
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].accessibilityLabel, "Inline filter");
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].testID, "inline-filter-input");
  assert.deepEqual(inline.preRead.primitiveInteractions.inputConstraints, [
    {
      primitive: "TextInput",
      loc: { startLine: 15, endLine: 23 },
      valueExpr: "value",
      constraintKind: "textInputMetadataConstraints",
      keyboardType: "web-search",
      autoCapitalize: "sentences",
      descriptiveHint: "Type filter",
      constraintBasis: ["jsx.TextInput.keyboardType", "jsx.TextInput.autoCapitalize"],
      evidence: ["jsx.TextInput.keyboardType", "jsx.TextInput.autoCapitalize", "jsx.TextInput.placeholder"],
    },
  ]);
  assert.equal("secureTextEntry" in inline.preRead.primitiveInteractions.inputConstraints[0], false);
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].onPressExpr, "submitCurrentValue");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].label, "Submit");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].accessibilityLabel, "Submit filter");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].testID, "submit-filter-button");
  assert.deepEqual(inline.preRead.primitiveInteractions.stateActionRelations, [
    {
      relationKind: "actionReadsInputValue",
      inputPrimitive: "TextInput",
      actionPrimitive: "Pressable",
      valueExpr: "value",
      onChangeTextExpr: "onChangeText",
      onPressExpr: "submitCurrentValue",
      label: "Submit",
      relationBasis: ["handler.submitCurrentValue.reads.value"],
      loc: { startLine: 15, endLine: 24 },
      evidence: [
        "rn.stateActionRelation.actionReadsInputValue",
        "jsx.TextInput.value",
        "jsx.TextInput.onChangeText",
        "jsx.TextInput.placeholder",
        "jsx.TextInput.keyboardType",
        "jsx.TextInput.autoCapitalize",
        "jsx.TextInput.accessibilityLabel",
        "jsx.TextInput.testID",
        "jsx.Pressable.onPress",
        "jsx.Pressable.Text.label",
        "jsx.Pressable.accessibilityLabel",
        "jsx.Pressable.testID",
        "handler.submitCurrentValue.reads.value",
      ],
    },
  ]);
  assert.deepEqual(inline.modelFacing.primitiveInteractions.stateActionRelations, inline.preRead.primitiveInteractions.stateActionRelations);
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
  assert.match(markdown, /Measured RN narrow input constraints visible: yes/);
  assert.match(markdown, /RN direct state\/action relation visible: yes/);
  assert.match(markdown, /rn-primitive-input-narrow-payload-only/);
  assert.match(markdown, /textInputMetadataConstraints:maxLength=80,secureTextEntry=false,keyboardType=default,autoCapitalize=none/);
  assert.match(markdown, /actionReadsInputValue:submitCurrentValue->value/);
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
