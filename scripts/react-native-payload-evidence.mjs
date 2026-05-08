import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const DEFAULT_RN_PAYLOAD_EVIDENCE_FIXTURES = [
  "test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx",
  "test/fixtures/frontend-domain-expectations/rn-primitive-inline-action.tsx",
];

export const DEFAULT_RN_BOUNDARY_FIXTURES = [
  "test/fixtures/frontend-domain-expectations/rn-style-platform-navigation.tsx",
  "test/fixtures/frontend-domain-expectations/rn-interaction-gesture.tsx",
  "test/fixtures/frontend-domain-expectations/rn-image-scrollview.tsx",
  "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx",
  "test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx",
];

export const RN_TEXT_INPUT_METADATA_FIELDS = [
  "keyboardType",
  "secureTextEntry",
  "maxLength",
  "autoCapitalize",
  "accessibilityLabel",
  "testID",
];

export const RN_PRESSABLE_METADATA_FIELDS = ["disabled", "accessibilityLabel", "accessibilityRole", "testID"];
export const RN_TEXT_INPUT_CONSTRAINT_FIELDS = ["maxLength", "secureTextEntry", "keyboardType", "autoCapitalize"];

export const RN_STAGED_SLOT_FIXTURES = [
  {
    slot: "F1",
    lane: "RN primitive/input",
    boundary: "measured narrow payload",
    relativeFile: "test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx",
  },
  {
    slot: "F13",
    lane: "RN primitive/input adjacent",
    boundary: "measured narrow payload",
    relativeFile: "test/fixtures/frontend-domain-expectations/rn-primitive-inline-action.tsx",
  },
  {
    slot: "F2",
    lane: "RN style/platform/navigation",
    boundary: "readiness evidence only",
    relativeFile: "test/fixtures/frontend-domain-expectations/rn-style-platform-navigation.tsx",
  },
  {
    slot: "F9",
    lane: "RN interaction/list",
    boundary: "readiness evidence only",
    relativeFile: "test/fixtures/frontend-domain-expectations/rn-interaction-gesture.tsx",
  },
  {
    slot: "F10",
    lane: "RN media/layout",
    boundary: "readiness evidence only",
    relativeFile: "test/fixtures/frontend-domain-expectations/rn-image-scrollview.tsx",
  },
];

const RN_BEHAVIOR_CONCERN_KEYS = [
  "rnAccessibilityTestAnchors",
  "rnStateActionConcerns",
  "rnNavigationConcerns",
  "rnListRenderingConcerns",
  "rnMediaLayoutConcerns",
  "rnStylePlatformConcerns",
];

function loadDist(repoRoot) {
  const require = createRequire(import.meta.url);
  return {
    preRead: require(path.join(repoRoot, "dist", "adapters", "pre-read.js")),
    extract: require(path.join(repoRoot, "dist", "core", "extract.js")),
    modelFacing: require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js")),
    registry: require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js")),
  };
}

function readDomainPayload(decision) {
  return decision?.payload?.domainPayload ?? null;
}

function hasStrictRnContracts(domainPayload) {
  return Boolean(
    domainPayload?.domain === "react-native" &&
      domainPayload?.claimBoundary === "rn-primitive-input-narrow-payload-only" &&
      domainPayload?.sourceAnchorBeta?.contract?.contractVersion === "rn-source-anchor-beta.v0" &&
      domainPayload?.sourceAnchorBeta?.contract?.scope === "local-proof-only" &&
      domainPayload?.sourceAnchorBeta?.contract?.runtimeReusePromotion === "not-promoted" &&
      domainPayload?.reuseContract?.freshnessSource === "sourceFingerprint" &&
      domainPayload?.reuseContract?.supportBoundary === "measured-evidence-only; no broad RN/WebView/TUI support",
  );
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function toConcernProfileIds(payload) {
  return uniqueSorted((payload?.concernProfiles ?? []).map((profile) => profile.id).filter(Boolean));
}

function toVisibleBehaviorConcernKinds(behavior) {
  return RN_BEHAVIOR_CONCERN_KEYS.filter((key) => Array.isArray(behavior?.[key]) && behavior[key].length > 0);
}

function presentFields(bindings, fields) {
  return uniqueSorted(bindings.flatMap((item) => fields.filter((field) => item[field] !== undefined)));
}

function interactionSummary(domainPayload) {
  const interactions = domainPayload?.facts?.primitiveInteractions ?? {};
  const inputBindings = interactions.inputBindings ?? [];
  const actionBindings = interactions.actionBindings ?? [];
  const inputConstraints = interactions.inputConstraints ?? [];
  const stateActionRelations = interactions.stateActionRelations ?? [];
  const constraintActionReadiness = interactions.constraintActionReadiness ?? [];
  const textInputMetadataFields = presentFields(inputBindings, RN_TEXT_INPUT_METADATA_FIELDS);
  const pressableMetadataFields = presentFields(actionBindings, RN_PRESSABLE_METADATA_FIELDS);
  const constraintFields = presentFields(inputConstraints, RN_TEXT_INPUT_CONSTRAINT_FIELDS);
  return {
    inputBindings,
    actionBindings,
    inputConstraints,
    stateActionRelations,
    constraintActionReadiness,
    hasTextInputBinding: Boolean(inputBindings.some((item) => item.primitive === "TextInput" && item.onChangeTextExpr)),
    hasPressableAction: Boolean(actionBindings.some((item) => item.primitive === "Pressable" && item.onPressExpr)),
    hasInputConstraintSemantics: Boolean(
      inputConstraints.some(
        (item) => item.constraintKind === "textInputMetadataConstraints" && item.constraintBasis?.length > 0 && item.valueExpr,
      ),
    ),
    hasDirectStateActionRelation: Boolean(
      stateActionRelations.some(
        (item) => item.relationKind === "actionReadsInputValue" && item.valueExpr && item.onPressExpr && item.relationBasis?.length > 0,
      ),
    ),
    hasConstraintActionReadiness: Boolean(
      constraintActionReadiness.some(
        (item) =>
          item.relationKind === "constraintActionReadiness" &&
          item.valueExpr &&
          item.onPressExpr &&
          item.disabledExpr &&
          item.constraintBasis?.length > 0 &&
          item.readinessBasis?.length > 0 &&
          item.relationBasis?.length > 0,
      ),
    ),
    metadataCoverage: {
      textInputFields: textInputMetadataFields,
      pressableFields: pressableMetadataFields,
      constraintFields,
      allTextInputMetadataPresent: RN_TEXT_INPUT_METADATA_FIELDS.every((field) => textInputMetadataFields.includes(field)),
      allPressableMetadataPresent: RN_PRESSABLE_METADATA_FIELDS.every((field) => pressableMetadataFields.includes(field)),
      allConstraintFieldsPresent: RN_TEXT_INPUT_CONSTRAINT_FIELDS.every((field) => constraintFields.includes(field)),
    },
  };
}

function measureRnFixture({ repoRoot, relativeFile, dist }) {
  const filePath = path.join(repoRoot, relativeFile);
  const preReadDecision = dist.preRead.decidePreRead(filePath, repoRoot, "codex", { includeEditGuidance: false });
  const extracted = dist.extract.extractFile(filePath);
  const policy = dist.registry.assessFrontendPayloadPolicy(extracted.domainDetection);
  const modelPayload = dist.modelFacing.toModelFacingPayload(extracted, repoRoot, {
    includeEditGuidance: false,
    ...dist.registry.toFrontendPayloadBuildOptions(policy),
  });
  const preReadDomainPayload = readDomainPayload(preReadDecision);
  const modelDomainPayload = modelPayload.domainPayload ?? null;
  const preReadInteractions = interactionSummary(preReadDomainPayload);
  const modelInteractions = interactionSummary(modelDomainPayload);

  return {
    file: relativeFile,
    classification: preReadDecision.debug?.domainDetection?.classification ?? null,
    preReadDecision: preReadDecision.decision,
    payloadPolicy: preReadDecision.debug?.frontendPayloadPolicy?.name ?? null,
    sourceFingerprintPresent: Boolean(preReadDecision.payload?.sourceFingerprint),
    preRead: {
      domain: preReadDomainPayload?.domain ?? null,
      claimBoundary: preReadDomainPayload?.claimBoundary ?? null,
      claimStatus: preReadDomainPayload?.claimStatus ?? null,
      sourceAnchorBetaVersion: preReadDomainPayload?.sourceAnchorBeta?.contract?.contractVersion ?? null,
      reuseFreshnessSource: preReadDomainPayload?.reuseContract?.freshnessSource ?? null,
      strictContractsPresent: hasStrictRnContracts(preReadDomainPayload),
      primitiveInteractions: preReadInteractions,
    },
    modelFacing: {
      domain: modelDomainPayload?.domain ?? null,
      claimBoundary: modelDomainPayload?.claimBoundary ?? null,
      strictContractsPresent: hasStrictRnContracts(modelDomainPayload),
      primitiveInteractions: modelInteractions,
      concernProfileIds: toConcernProfileIds(modelPayload),
      visibleBehaviorConcernKinds: toVisibleBehaviorConcernKinds(modelPayload.behavior),
    },
    claimable:
      preReadDecision.decision === "payload" &&
      preReadInteractions.hasTextInputBinding &&
      preReadInteractions.hasPressableAction &&
      modelInteractions.hasTextInputBinding &&
      modelInteractions.hasPressableAction &&
      hasStrictRnContracts(preReadDomainPayload) &&
      hasStrictRnContracts(modelDomainPayload),
  };
}

function measureBoundaryFixture({ repoRoot, relativeFile, dist }) {
  const filePath = path.join(repoRoot, relativeFile);
  const decision = dist.preRead.decidePreRead(filePath, repoRoot, "codex", { includeEditGuidance: false });
  const extracted = dist.extract.extractFile(filePath);
  const modelPayload = dist.modelFacing.toModelFacingPayload(extracted, repoRoot, {
    includeEditGuidance: false,
  });
  const domainPayload = readDomainPayload(decision);
  return {
    file: relativeFile,
    classification: decision.debug?.domainDetection?.classification ?? null,
    frontendPayloadPolicy: decision.debug?.frontendPayloadPolicy ?? null,
    decision: decision.decision,
    fallbackReason: decision.fallback?.reason ?? null,
    payloadExposed: Boolean(domainPayload),
    rnPrimitiveInteractionsExposed: Boolean(domainPayload?.facts?.primitiveInteractions),
    boundaryPreserved: decision.decision === "fallback" && !domainPayload,
    modelFacing: {
      concernProfileIds: toConcernProfileIds(modelPayload),
      visibleBehaviorConcernKinds: toVisibleBehaviorConcernKinds(modelPayload.behavior),
    },
  };
}

export async function buildReactNativePayloadEvidence({
  repoRoot = defaultRepoRoot,
  fixtures = DEFAULT_RN_PAYLOAD_EVIDENCE_FIXTURES,
  boundaryFixtures = DEFAULT_RN_BOUNDARY_FIXTURES,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const dist = loadDist(repoRoot);
  const rnFixtures = fixtures.map((relativeFile) => measureRnFixture({ repoRoot, relativeFile, dist }));
  const boundaries = boundaryFixtures.map((relativeFile) => measureBoundaryFixture({ repoRoot, relativeFile, dist }));
  const rnPayloadFactsVisible = rnFixtures.every((row) => row.claimable);
  const boundaryFallbacksPreserved = boundaries.every((row) => row.boundaryPreserved && !row.rnPrimitiveInteractionsExposed);
  const preReadTextInputFields = uniqueSorted(rnFixtures.flatMap((row) => row.preRead.primitiveInteractions.metadataCoverage.textInputFields));
  const preReadPressableFields = uniqueSorted(rnFixtures.flatMap((row) => row.preRead.primitiveInteractions.metadataCoverage.pressableFields));
  const modelTextInputFields = uniqueSorted(rnFixtures.flatMap((row) => row.modelFacing.primitiveInteractions.metadataCoverage.textInputFields));
  const modelPressableFields = uniqueSorted(rnFixtures.flatMap((row) => row.modelFacing.primitiveInteractions.metadataCoverage.pressableFields));
  const missingTextInputFields = RN_TEXT_INPUT_METADATA_FIELDS.filter(
    (field) => !preReadTextInputFields.includes(field) || !modelTextInputFields.includes(field),
  );
  const missingPressableFields = RN_PRESSABLE_METADATA_FIELDS.filter(
    (field) => !preReadPressableFields.includes(field) || !modelPressableFields.includes(field),
  );
  const metadataAnchorsVisible = missingTextInputFields.length === 0 && missingPressableFields.length === 0;
  const constraintRows = rnFixtures.filter(
    (row) => row.preRead.primitiveInteractions.hasInputConstraintSemantics && row.modelFacing.primitiveInteractions.hasInputConstraintSemantics,
  );
  const relationRows = rnFixtures.filter(
    (row) => row.preRead.primitiveInteractions.hasDirectStateActionRelation && row.modelFacing.primitiveInteractions.hasDirectStateActionRelation,
  );
  const readinessRows = rnFixtures.filter(
    (row) => row.preRead.primitiveInteractions.hasConstraintActionReadiness && row.modelFacing.primitiveInteractions.hasConstraintActionReadiness,
  );
  const measuredByFile = new Map(rnFixtures.map((row) => [row.file, row]));
  const boundaryByFile = new Map(boundaries.map((row) => [row.file, row]));
  const stagedRnSurfaceInventory = RN_STAGED_SLOT_FIXTURES.map(({ slot, lane, boundary, relativeFile }) => {
    const measured = measuredByFile.get(relativeFile);
    if (measured) {
      return {
        slot,
        lane,
        boundary,
        file: relativeFile,
        classification: measured.classification,
        preReadDecision: measured.preReadDecision,
        preReadExpectation: measured.payloadPolicy,
        claimBoundary: measured.preRead.claimBoundary,
        concernProfileIds: measured.modelFacing.concernProfileIds,
        visibleBehaviorConcernKinds: measured.modelFacing.visibleBehaviorConcernKinds,
        sourceOnly: true,
        broadSupportClaimable: false,
      };
    }

    const fallback = boundaryByFile.get(relativeFile);
    return {
      slot,
      lane,
      boundary,
      file: relativeFile,
      classification: fallback?.classification ?? null,
      preReadDecision: fallback?.decision ?? null,
      preReadExpectation: fallback?.fallbackReason ?? null,
      claimBoundary: "unsupported-frontend-domain-profile",
      concernProfileIds: fallback?.modelFacing?.concernProfileIds ?? [],
      visibleBehaviorConcernKinds: fallback?.modelFacing?.visibleBehaviorConcernKinds ?? [],
      sourceOnly: true,
      broadSupportClaimable: false,
    };
  });

  return {
    schemaVersion: "react-native-payload-evidence.v4",
    generatedAt: new Date().toISOString(),
    runId,
    measurement: "local-fixture-pre-read-and-model-facing-domain-payload-evidence",
    claimBoundary:
      "Local fixture payload evidence only: proves RN primitive/input narrow payload facts are visible for measured TextInput/Pressable fixtures and that richer RN/WebView/TUI boundaries remain fallback-only. This is not broad React Native support, not WebView or TUI promotion, not runtime reuse promotion, not edit routing, not provider tokenizer output, not runtime-token savings, and not provider billing or invoice savings.",
    fixtures: rnFixtures,
    boundaryFixtures: boundaries,
    summary: {
      fixtureCount: rnFixtures.length,
      boundaryFixtureCount: boundaries.length,
      rnPayloadFactsVisible: {
        claimable: rnPayloadFactsVisible,
        blocker: rnPayloadFactsVisible ? null : "one or more measured RN fixtures did not expose strict primitiveInteractions in both pre-read and model-facing payloads",
      },
      boundaryFallbacksPreserved: {
        claimable: boundaryFallbacksPreserved,
        blocker: boundaryFallbacksPreserved ? null : "one or more richer RN/WebView/TUI fixtures exposed payload facts or failed to fallback",
      },
      metadataAnchorsVisible: {
        claimable: metadataAnchorsVisible,
        textInputFields: RN_TEXT_INPUT_METADATA_FIELDS.map((field) => ({
          field,
          preRead: preReadTextInputFields.includes(field),
          modelFacing: modelTextInputFields.includes(field),
          claimable: preReadTextInputFields.includes(field) && modelTextInputFields.includes(field),
        })),
        pressableFields: RN_PRESSABLE_METADATA_FIELDS.map((field) => ({
          field,
          preRead: preReadPressableFields.includes(field),
          modelFacing: modelPressableFields.includes(field),
          claimable: preReadPressableFields.includes(field) && modelPressableFields.includes(field),
        })),
        blocker: metadataAnchorsVisible
          ? null
          : `missing metadata fields: TextInput=${missingTextInputFields.join(",") || "none"}; Pressable=${missingPressableFields.join(",") || "none"}`,
      },
      inputConstraintsVisible: {
        claimable: constraintRows.length > 0,
        scope: "rn-primitive-input-narrow-payload-only",
        constraintKind: "textInputMetadataConstraints",
        directConstraintFixtures: constraintRows.map((row) => row.file),
        blocker: constraintRows.length > 0 ? null : "no measured RN fixture exposed TextInput constraint metadata in both pre-read and model-facing payloads",
      },
      stateActionRelationsVisible: {
        claimable: relationRows.length > 0,
        relationKind: "actionReadsInputValue",
        directRelationFixtures: relationRows.map((row) => row.file),
        blocker: relationRows.length > 0 ? null : "no measured RN fixture exposed a direct actionReadsInputValue relation in both pre-read and model-facing payloads",
      },
      constraintActionReadinessVisible: {
        claimable: readinessRows.length > 0,
        scope: "rn-primitive-input-narrow-payload-only",
        relationKind: "constraintActionReadiness",
        directReadinessFixtures: readinessRows.map((row) => row.file),
        blocker: readinessRows.length > 0 ? null : "no measured RN fixture exposed constraintActionReadiness in both pre-read and model-facing payloads",
      },
      stagedRnSurfaceInventory: {
        claimable: true,
        stagedSlots: stagedRnSurfaceInventory,
        blocker: null,
      },
      broadReactNativeSupport: {
        claimable: false,
        blocker: "evidence is limited to the existing rn-primitive-input-narrow-payload measured lane",
      },
      runtimeReusePromotion: {
        claimable: false,
        blocker: "sourceAnchorBeta remains local-proof-only and runtimeReusePromotion is not-promoted",
      },
      editRouting: {
        claimable: false,
        blocker: "no RN edit routing or patch guidance is measured or enabled by this artifact",
      },
      providerBillingSavings: {
        claimable: false,
        blocker: "no provider usage, tokenizer, billing dashboard, invoice, or charged-cost data is measured by this artifact",
      },
    },
  };
}

export function renderReactNativePayloadEvidenceMarkdown(evidence) {
  const fixtureRows = evidence.fixtures
    .map((row) => {
      const input = row.preRead.primitiveInteractions.inputBindings
        .map((item) => `${item.primitive}:value=${item.valueExpr ?? "n/a"},onChangeText=${item.onChangeTextExpr ?? "n/a"}`)
        .join("; ");
      const action = row.preRead.primitiveInteractions.actionBindings
        .map((item) => `${item.primitive}:onPress=${item.onPressExpr}${item.label ? `,label=${item.label}` : ""}`)
        .join("; ");
      const constraints = row.preRead.primitiveInteractions.inputConstraints
        .map((item) => `${item.constraintKind}:${item.constraintBasis.join(",")}`)
        .join("; ") || "omitted";
      const relation = row.preRead.primitiveInteractions.stateActionRelations
        .map((item) => `${item.relationKind}:${item.onPressExpr}->${item.valueExpr}`)
        .join("; ") || "omitted";
      const readiness = row.preRead.primitiveInteractions.constraintActionReadiness
        .map((item) => `${item.relationKind}:${item.onPressExpr}->${item.valueExpr},disabled=${item.disabledExpr}`)
        .join("; ") || "omitted";
      return `| \`${row.file}\` | ${row.preReadDecision} | ${row.sourceFingerprintPresent ? "yes" : "no"} | ${row.preRead.strictContractsPresent ? "yes" : "no"} | ${input} | ${action} | ${constraints} | ${relation} | ${readiness} | ${row.claimable ? "yes" : "no"} |`;
    })
    .join("\n");
  const boundaryRows = evidence.boundaryFixtures
    .map(
      (row) =>
        `| \`${row.file}\` | ${row.classification} | ${row.decision} | ${row.fallbackReason ?? "n/a"} | ${row.payloadExposed ? "yes" : "no"} | ${row.boundaryPreserved ? "yes" : "no"} |`,
    )
    .join("\n");
  const metadataRows = [
    ...evidence.summary.metadataAnchorsVisible.textInputFields.map(
      (row) => `| TextInput | ${row.field} | ${row.preRead ? "yes" : "no"} | ${row.modelFacing ? "yes" : "no"} | ${row.claimable ? "yes" : "no"} |`,
    ),
    ...evidence.summary.metadataAnchorsVisible.pressableFields.map(
      (row) => `| Pressable | ${row.field} | ${row.preRead ? "yes" : "no"} | ${row.modelFacing ? "yes" : "no"} | ${row.claimable ? "yes" : "no"} |`,
    ),
  ].join("\n");
  const stagedInventoryRows = evidence.summary.stagedRnSurfaceInventory.stagedSlots
    .map(
      (row) =>
        `| ${row.slot} | ${row.lane} | ${row.boundary} | \`${row.file}\` | ${row.preReadDecision ?? "n/a"} | ${row.preReadExpectation ?? "n/a"} | ${row.concernProfileIds.join(", ") || "omitted"} | ${row.visibleBehaviorConcernKinds.join(", ") || "omitted"} | ${row.sourceOnly ? "yes" : "no"} | ${row.broadSupportClaimable ? "yes" : "no"} |`,
    )
    .join("\n");

  return `# React Native payload evidence

${evidence.claimBoundary}

## Summary

- RN primitive interaction facts visible: ${evidence.summary.rnPayloadFactsVisible.claimable ? "yes" : "no"}
- Richer RN/WebView/TUI boundaries preserved: ${evidence.summary.boundaryFallbacksPreserved.claimable ? "yes" : "no"}
- RN metadata anchors visible: ${evidence.summary.metadataAnchorsVisible.claimable ? "yes" : "no"}
- Measured RN narrow input constraints visible: ${evidence.summary.inputConstraintsVisible.claimable ? "yes" : "no"}
- RN direct state/action relation visible: ${evidence.summary.stateActionRelationsVisible.claimable ? "yes" : "no"}
- Measured RN narrow constraint/action readiness visible: ${evidence.summary.constraintActionReadinessVisible.claimable ? "yes" : "no"}
- RN staged surface inventory visible: ${evidence.summary.stagedRnSurfaceInventory.claimable ? "yes" : "no"}
- Broad React Native support claimable: no
- Runtime reuse promotion claimable: no
- RN edit routing claimable: no
- Provider billing savings claimable: no

## Measured RN narrow fixtures

| Fixture | pre-read decision | source fingerprint | strict RN contracts | input bindings | action bindings | constraints | action relation | readiness | claimable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${fixtureRows}

## RN staged surface inventory

| Slot | lane | boundary | fixture | pre-read decision | pre-read expectation | concern profiles | visible behavior concern kinds | source-only | broad support claimable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${stagedInventoryRows}

## Metadata anchor coverage

| Primitive | field | pre-read | model-facing | claimable |
| --- | --- | --- | --- | --- |
${metadataRows}

## Boundary fixtures

| Fixture | classification | decision | fallback reason | payload exposed | boundary preserved |
| --- | --- | --- | --- | --- | --- |
${boundaryRows}

## Claim boundary

The constraint/action readiness claim is scoped to \`${evidence.summary.constraintActionReadinessVisible.scope}\` and requires source-observed TextInput constraints, a direct actionReadsInputValue relation, and a source-observed Pressable disabled expression.

The staged RN surface inventory is source-only closeout evidence for \`F1\`, \`F13\`, \`F2\`, \`F9\`, and \`F10\`. It records local concern-profile visibility and fallback posture only; it does not prove broad React Native support, route existence, navigation success, list virtualization correctness, image/layout correctness, runtime reuse promotion, RN edit routing, runtime-token savings, provider-cost, billing, invoice, or charged-cost claims.

This artifact supports bounded local statements only for the existing \`rn-primitive-input-narrow-payload\` lane. It does not support broad React Native support, WebView/TUI promotion, runtime reuse promotion, RN edit routing, runtime-token savings, provider-cost, billing, invoice, or charged-cost claims.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const defaultOutput = path.join(".omx", "reports", `rn-payload-evidence-${runId}.json`);
  const defaultMarkdown = path.join(".omx", "reports", `rn-payload-evidence-${runId}.md`);
  const evidence = await buildReactNativePayloadEvidence({ repoRoot: defaultRepoRoot, runId });

  const outputPath = path.resolve(defaultRepoRoot, outputArg ?? defaultOutput);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

  const markdownPath = path.resolve(defaultRepoRoot, markdownArg ?? defaultMarkdown);
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(markdownPath, renderReactNativePayloadEvidenceMarkdown(evidence));

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
