import type { DomainDetectionResult } from "../domain-detector";
import {
  assessReactNativePrimitiveInputSignalGate,
  RN_PRIMITIVE_INPUT_DENIED_BY_SIGNALS,
  RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
  RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS,
  RN_PRIMITIVE_INPUT_SUPPORT_BOUNDARY,
} from "../payload-policy/react-native";
import type { ExtractionResult, FormControlSignal, ReactNativePrimitiveInteractionSignal, StyleSystem } from "../schema";

export const DOMAIN_PAYLOAD_SCHEMA_VERSION = "domain-payload.v1";
export const REACT_WEB_DOMAIN_PAYLOAD_POLICY = "react-web-current-supported-lane";
export const RN_SOURCE_ANCHOR_BETA_CONTRACT_VERSION = "rn-source-anchor-beta.v0";

const RN_SOURCE_ANCHOR_BETA_ALLOWED_PROOF_SURFACES = ["extract", "compare", "inspect-domain"] as const;
const RN_SOURCE_ANCHOR_BETA_ANCHOR_KINDS = [
  "component-name",
  "props-interface",
  "hooks-effects",
  "event-handlers",
  "rn-primitive-outline",
  "source-fingerprint-ranges",
] as const;
const RN_SOURCE_ANCHOR_BETA_FALLBACK_FIRST_BOUNDARIES = [
  "webview",
  "native-bridge",
  "platform-specific",
  "navigation",
  "gesture-list-image-scrollview",
  "mixed-react-web-dom",
  "tui-ink",
] as const;

export type ReactWebDomainPayload = {
  schemaVersion: typeof DOMAIN_PAYLOAD_SCHEMA_VERSION;
  domain: "react-web";
  policy: typeof REACT_WEB_DOMAIN_PAYLOAD_POLICY;
  plannerDecision: "compact-safe";
  claimStatus: "current-supported-lane";
  claimBoundary: "react-web-measured-extraction";
  evidence: string[];
  facts: {
    domTags?: string[];
    jsxAttributes?: string[];
    jsxComponentCount?: number;
    jsxComponents?: string[];
    componentName?: string;
    exports?: Pick<ExtractionResult["exports"][number], "name" | "kind" | "type">[];
    hooks?: string[];
    jsxDepth?: number;
    hasSideEffects?: boolean;
    hasStyleBranching?: boolean;
    formControls?: Pick<FormControlSignal, "tag" | "name" | "type" | "handlers">[];
    eventHandlers?: string[];
    styleSystem?: Exclude<StyleSystem, "unknown">;
  };
  warnings: string[];
};

export type ReactNativeSourceAnchorBetaContract = {
  contractVersion: typeof RN_SOURCE_ANCHOR_BETA_CONTRACT_VERSION;
  scope: "local-proof-only";
  allowedProofSurfaces: readonly (typeof RN_SOURCE_ANCHOR_BETA_ALLOWED_PROOF_SURFACES)[number][];
  runtimeReusePromotion: "not-promoted";
  sourceDerivedOnly: true;
  anchorKinds: readonly (typeof RN_SOURCE_ANCHOR_BETA_ANCHOR_KINDS)[number][];
  fallbackFirstBoundaries: readonly (typeof RN_SOURCE_ANCHOR_BETA_FALLBACK_FIRST_BOUNDARIES)[number][];
  nextImplementationStep: "emit located RN sourceAnchorBeta anchors from existing component/props/hook/handler/primitive evidence before widening detector gates";
};

export type ReactNativeSourceAnchorBetaPayload = {
  contract: ReactNativeSourceAnchorBetaContract;
  anchors: {
    componentName?: string;
    propsName?: string;
    hooks?: string[];
    eventHandlers?: string[];
    primitives: string[];
    jsxProps: string[];
    sourceFingerprintRequired: true;
  };
};

export type ReactNativePrimitiveInputReuseContract = {
  sourceDerivedOnly: true;
  policy: typeof RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY;
  plannerDecision: "narrow-primitive-input-payload";
  freshnessSource: "sourceFingerprint";
  staleWhen: [
    "sourceFingerprint.fileHash changes",
    "sourceFingerprint.lineCount changes",
    "frontendPayloadPolicy no longer allows RN narrow policy",
  ];
  requiredSignals: string[];
  deniedBySignals: string[];
  supportBoundary: "measured-evidence-only; no broad RN/WebView/TUI support";
};

export type ReactNativePrimitiveInputDomainPayload = {
  schemaVersion: typeof DOMAIN_PAYLOAD_SCHEMA_VERSION;
  domain: "react-native";
  policy: typeof RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY;
  plannerDecision: "narrow-primitive-input-payload";
  claimStatus: "measured-evidence-only";
  claimBoundary: "rn-primitive-input-narrow-payload-only";
  evidence: string[];
  sourceAnchorBeta: ReactNativeSourceAnchorBetaPayload;
  reuseContract: ReactNativePrimitiveInputReuseContract;
  facts: {
    primitives: string[];
    jsxProps: string[];
    componentName?: string;
    exports?: Pick<ExtractionResult["exports"][number], "name" | "kind" | "type">[];
    hooks?: string[];
    eventHandlers?: string[];
    primitiveInteractions?: ReactNativePrimitiveInteractionSignal;
    jsxDepth?: number;
  };
  warnings: string[];
};

export type DomainPayload = ReactWebDomainPayload | ReactNativePrimitiveInputDomainPayload;

type ReactWebPayloadEvidenceFacts = {
  evidence: string[];
  domTags: string[];
  jsxAttributes: string[];
};

type ReactWebPayloadPlan = {
  result: ExtractionResult;
  evidenceFacts: ReactWebPayloadEvidenceFacts;
};

type ReactNativePayloadEvidenceFacts = {
  evidence: string[];
  primitives: string[];
  jsxProps: string[];
};

type ReactNativePayloadPlan = {
  result: ExtractionResult;
  evidenceFacts: ReactNativePayloadEvidenceFacts;
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function collectJsxComponents(sections: string[] | undefined): string[] {
  return uniqueSorted((sections ?? []).filter((section) => /^[A-Z][A-Za-z0-9_$]*$/.test(section)));
}

function compactExports(exportItems: ExtractionResult["exports"]): ReactWebDomainPayload["facts"]["exports"] {
  if (exportItems.length === 0) return undefined;

  return exportItems.map((item) => ({
    name: item.name,
    kind: item.kind,
    ...(item.type ? { type: item.type } : {}),
  }));
}

function compactFormControls(controls: FormControlSignal[] | undefined): ReactWebDomainPayload["facts"]["formControls"] {
  if (!controls || controls.length === 0) return undefined;

  return controls.map((control) => ({
    tag: control.tag,
    ...(control.name ? { name: control.name } : {}),
    ...(control.type ? { type: control.type } : {}),
    ...(control.handlers && control.handlers.length > 0 ? { handlers: control.handlers } : {}),
  }));
}

function collectReactWebPayloadEvidence(domainDetection: DomainDetectionResult): ReactWebPayloadEvidenceFacts | undefined {
  const reactWebEvidence = domainDetection.evidence.filter((item) => item.domain === "react-web");
  if (reactWebEvidence.length === 0) return undefined;

  return {
    evidence: uniqueSorted(reactWebEvidence.map((item) => `${item.domain}:${item.signal}:${item.detail}`)),
    domTags: uniqueSorted(reactWebEvidence.filter((item) => item.signal === "dom-tag").map((item) => item.detail)),
    jsxAttributes: uniqueSorted(reactWebEvidence.filter((item) => item.signal === "jsx-attribute").map((item) => item.detail)),
  };
}

function collectReactNativePayloadEvidence(domainDetection: DomainDetectionResult): ReactNativePayloadEvidenceFacts | undefined {
  const reactNativeEvidence = domainDetection.evidence.filter((item) => item.domain === "react-native");
  if (reactNativeEvidence.length === 0) return undefined;

  return {
    evidence: uniqueSorted(reactNativeEvidence.map((item) => `${item.domain}:${item.signal}:${item.detail}`)),
    primitives: uniqueSorted(reactNativeEvidence.filter((item) => item.signal === "primitive").map((item) => item.detail)),
    jsxProps: uniqueSorted(reactNativeEvidence.filter((item) => item.signal === "jsx-prop").map((item) => item.detail)),
  };
}

function planReactWebPayload(
  result: ExtractionResult,
  domainDetection: DomainDetectionResult | undefined,
  policy: string,
): ReactWebPayloadPlan | undefined {
  if (policy !== REACT_WEB_DOMAIN_PAYLOAD_POLICY) return undefined;
  if (!domainDetection) return undefined;
  if (domainDetection.classification !== "react-web") return undefined;
  if (domainDetection.profile.claimStatus !== "current-supported-lane") return undefined;
  if (domainDetection.profile.claimBoundary !== "react-web-measured-extraction") return undefined;

  const evidenceFacts = collectReactWebPayloadEvidence(domainDetection);
  if (!evidenceFacts) return undefined;

  return { result, evidenceFacts };
}

function planReactNativePrimitiveInputPayload(
  result: ExtractionResult,
  domainDetection: DomainDetectionResult | undefined,
  policy: string,
): ReactNativePayloadPlan | undefined {
  if (policy !== RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY) return undefined;
  if (!domainDetection) return undefined;
  if (domainDetection.classification !== "react-native") return undefined;
  if (!assessReactNativePrimitiveInputSignalGate(domainDetection).allowed) return undefined;

  const evidenceFacts = collectReactNativePayloadEvidence(domainDetection);
  if (!evidenceFacts) return undefined;

  return { result, evidenceFacts };
}

function buildReactWebPayloadFacts(
  result: ExtractionResult,
  evidenceFacts: ReactWebPayloadEvidenceFacts,
): ReactWebDomainPayload["facts"] {
  const eventHandlers = uniqueSorted(result.behavior?.eventHandlers ?? []);
  const formControls = compactFormControls(result.behavior?.formSurface?.controls);
  const styleSystem = result.style?.system && result.style.system !== "unknown" ? result.style.system : undefined;
  const exportFacts = compactExports(result.exports);
  const hooks = uniqueSorted(result.behavior?.hooks ?? []);
  const jsxComponents = collectJsxComponents(result.structure?.sections);

  return {
    ...(result.componentName ? { componentName: result.componentName } : {}),
    ...(exportFacts && exportFacts.length > 0 ? { exports: exportFacts } : {}),
    ...(hooks.length > 0 ? { hooks } : {}),
    ...(typeof result.structure?.jsxDepth === "number" ? { jsxDepth: result.structure.jsxDepth } : {}),
    ...(typeof result.behavior?.hasSideEffects === "boolean" ? { hasSideEffects: result.behavior.hasSideEffects } : {}),
    ...(typeof result.style?.hasStyleBranching === "boolean" ? { hasStyleBranching: result.style.hasStyleBranching } : {}),
    ...(evidenceFacts.domTags.length > 0 ? { domTags: evidenceFacts.domTags } : {}),
    ...(evidenceFacts.jsxAttributes.length > 0 ? { jsxAttributes: evidenceFacts.jsxAttributes } : {}),
    ...(jsxComponents.length > 0 ? { jsxComponentCount: jsxComponents.length } : {}),
    ...(jsxComponents.length > 0 ? { jsxComponents } : {}),
    ...(formControls && formControls.length > 0 ? { formControls } : {}),
    ...(eventHandlers.length > 0 ? { eventHandlers } : {}),
    ...(styleSystem ? { styleSystem } : {}),
  };
}

function buildReactNativeSourceAnchorBetaContract(): ReactNativeSourceAnchorBetaContract {
  return {
    contractVersion: RN_SOURCE_ANCHOR_BETA_CONTRACT_VERSION,
    scope: "local-proof-only",
    allowedProofSurfaces: [...RN_SOURCE_ANCHOR_BETA_ALLOWED_PROOF_SURFACES],
    runtimeReusePromotion: "not-promoted",
    sourceDerivedOnly: true,
    anchorKinds: [...RN_SOURCE_ANCHOR_BETA_ANCHOR_KINDS],
    fallbackFirstBoundaries: [...RN_SOURCE_ANCHOR_BETA_FALLBACK_FIRST_BOUNDARIES],
    nextImplementationStep:
      "emit located RN sourceAnchorBeta anchors from existing component/props/hook/handler/primitive evidence before widening detector gates",
  };
}

function buildReactNativeSourceAnchorBetaPayload(
  result: ExtractionResult,
  evidenceFacts: ReactNativePayloadEvidenceFacts,
): ReactNativeSourceAnchorBetaPayload {
  const eventHandlers = uniqueSorted(result.behavior?.eventHandlers ?? []);
  const hooks = uniqueSorted(result.behavior?.hooks ?? []);

  return {
    contract: buildReactNativeSourceAnchorBetaContract(),
    anchors: {
      ...(result.componentName ? { componentName: result.componentName } : {}),
      ...(result.contract?.propsName ? { propsName: result.contract.propsName } : {}),
      ...(hooks.length > 0 ? { hooks } : {}),
      ...(eventHandlers.length > 0 ? { eventHandlers } : {}),
      primitives: evidenceFacts.primitives,
      jsxProps: evidenceFacts.jsxProps,
      sourceFingerprintRequired: true,
    },
  };
}

function buildReactNativePrimitiveInputReuseContract(): ReactNativePrimitiveInputReuseContract {
  return {
    sourceDerivedOnly: true,
    policy: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
    plannerDecision: "narrow-primitive-input-payload",
    freshnessSource: "sourceFingerprint",
    staleWhen: [
      "sourceFingerprint.fileHash changes",
      "sourceFingerprint.lineCount changes",
      "frontendPayloadPolicy no longer allows RN narrow policy",
    ],
    requiredSignals: [...RN_PRIMITIVE_INPUT_REQUIRED_SIGNALS],
    deniedBySignals: [...RN_PRIMITIVE_INPUT_DENIED_BY_SIGNALS],
    supportBoundary: RN_PRIMITIVE_INPUT_SUPPORT_BOUNDARY,
  };
}

function compactReactNativePrimitiveInteractions(
  interactions: ReactNativePrimitiveInteractionSignal | undefined,
): ReactNativePrimitiveInputDomainPayload["facts"]["primitiveInteractions"] {
  if (!interactions) return undefined;
  const inputBindings = interactions.inputBindings?.slice(0, 8);
  const actionBindings = interactions.actionBindings?.slice(0, 8);

  if (!inputBindings?.length && !actionBindings?.length) return undefined;
  return {
    ...(inputBindings?.length ? { inputBindings } : {}),
    ...(actionBindings?.length ? { actionBindings } : {}),
  };
}

function buildReactNativePayloadFacts(
  result: ExtractionResult,
  evidenceFacts: ReactNativePayloadEvidenceFacts,
): ReactNativePrimitiveInputDomainPayload["facts"] {
  const eventHandlers = uniqueSorted(result.behavior?.eventHandlers ?? []);
  const hooks = uniqueSorted(result.behavior?.hooks ?? []);
  const exportFacts = compactExports(result.exports);
  const primitiveInteractions = compactReactNativePrimitiveInteractions(result.behavior?.rnPrimitiveInteractions);

  return {
    primitives: evidenceFacts.primitives,
    jsxProps: evidenceFacts.jsxProps,
    ...(result.componentName ? { componentName: result.componentName } : {}),
    ...(exportFacts && exportFacts.length > 0 ? { exports: exportFacts } : {}),
    ...(hooks.length > 0 ? { hooks } : {}),
    ...(eventHandlers.length > 0 ? { eventHandlers } : {}),
    ...(primitiveInteractions ? { primitiveInteractions } : {}),
    ...(typeof result.structure?.jsxDepth === "number" ? { jsxDepth: result.structure.jsxDepth } : {}),
  };
}

export function buildReactWebDomainPayload(
  result: ExtractionResult,
  domainDetection: DomainDetectionResult | undefined = result.domainDetection,
  policy = REACT_WEB_DOMAIN_PAYLOAD_POLICY,
): ReactWebDomainPayload | undefined {
  const plan = planReactWebPayload(result, domainDetection, policy);
  if (!plan) return undefined;

  return {
    schemaVersion: DOMAIN_PAYLOAD_SCHEMA_VERSION,
    domain: "react-web",
    policy: REACT_WEB_DOMAIN_PAYLOAD_POLICY,
    plannerDecision: "compact-safe",
    claimStatus: "current-supported-lane",
    claimBoundary: "react-web-measured-extraction",
    evidence: plan.evidenceFacts.evidence,
    facts: buildReactWebPayloadFacts(plan.result, plan.evidenceFacts),
    warnings: [
      "React Web current supported lane only; this payload does not imply React Native, WebView, TUI, Mixed, or Unknown support.",
      "Planner decision depends on current extractor readiness and domain profile evidence; rerun extraction if the source changes.",
    ],
  };
}

export function buildReactNativePrimitiveInputDomainPayload(
  result: ExtractionResult,
  domainDetection: DomainDetectionResult | undefined = result.domainDetection,
  policy: string = RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
): ReactNativePrimitiveInputDomainPayload | undefined {
  const plan = planReactNativePrimitiveInputPayload(result, domainDetection, policy);
  if (!plan) return undefined;

  return {
    schemaVersion: DOMAIN_PAYLOAD_SCHEMA_VERSION,
    domain: "react-native",
    policy: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
    plannerDecision: "narrow-primitive-input-payload",
    claimStatus: "measured-evidence-only",
    claimBoundary: "rn-primitive-input-narrow-payload-only",
    evidence: plan.evidenceFacts.evidence,
    sourceAnchorBeta: buildReactNativeSourceAnchorBetaPayload(plan.result, plan.evidenceFacts),
    reuseContract: buildReactNativePrimitiveInputReuseContract(),
    facts: buildReactNativePayloadFacts(plan.result, plan.evidenceFacts),
    warnings: [
      "React Native source anchors are a local-proof beta contract only, not a runtime reuse promotion.",
      "React Native primitive/input payload reuse is limited to the measured F1-style gate.",
      "Do not reinterpret React Native primitives as DOM controls, web form semantics, navigation behavior, native platform behavior, or WebView bridge behavior.",
      "Planner decision depends on current extractor readiness and domain profile evidence; rerun extraction if the source changes.",
    ],
  };
}

export function buildFrontendDomainPayload(
  result: ExtractionResult,
  domainDetection: DomainDetectionResult | undefined = result.domainDetection,
  policy = REACT_WEB_DOMAIN_PAYLOAD_POLICY,
): DomainPayload | undefined {
  return (
    buildReactWebDomainPayload(result, domainDetection, policy) ??
    buildReactNativePrimitiveInputDomainPayload(result, domainDetection, policy)
  );
}
