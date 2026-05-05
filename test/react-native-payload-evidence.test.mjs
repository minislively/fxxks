import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReactNativePayloadEvidence,
  renderReactNativePayloadEvidenceMarkdown,
} from "../scripts/react-native-payload-evidence.mjs";

test("React Native payload evidence exposes primitiveInteractions without widening RN scope", async () => {
  const evidence = await buildReactNativePayloadEvidence({ runId: `test-${Date.now()}-${Math.random()}` });

  assert.equal(evidence.schemaVersion, "react-native-payload-evidence.v1");
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
    assert.equal(row.modelFacing.strictContractsPresent, true);
    assert.equal(row.modelFacing.primitiveInteractions.hasTextInputBinding, true);
    assert.equal(row.modelFacing.primitiveInteractions.hasPressableAction, true);
    assert.equal(row.claimable, true);
  }

  const basic = evidence.fixtures.find((row) => row.file.endsWith("rn-primitive-basic.tsx"));
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].valueExpr, "value");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].onChangeTextExpr, "onChangeText");
  assert.equal(basic.preRead.primitiveInteractions.inputBindings[0].placeholder, "Filter");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].onPressExpr, "onApply");
  assert.equal(basic.preRead.primitiveInteractions.actionBindings[0].label, "Apply");

  const inline = evidence.fixtures.find((row) => row.file.endsWith("rn-primitive-inline-action.tsx"));
  assert.equal(inline.preRead.primitiveInteractions.inputBindings[0].placeholder, "Type filter");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].onPressExpr, "submitCurrentValue");
  assert.equal(inline.preRead.primitiveInteractions.actionBindings[0].label, "Submit");
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
  assert.match(markdown, /Broad React Native support claimable: no/);
  assert.match(markdown, /Runtime reuse promotion claimable: no/);
  assert.match(markdown, /RN edit routing claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /existing `rn-primitive-input-narrow-payload` lane/);
  assert.doesNotMatch(markdown, /Broad React Native support claimable: yes/i);
  assert.doesNotMatch(markdown, /Runtime reuse promotion claimable: yes/i);
  assert.doesNotMatch(markdown, /RN edit routing claimable: yes/i);
});
