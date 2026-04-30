import type { DomainDetectionResult } from "../domain-detector";
import type { ExtractionResult, FormControlSignal, StyleSystem } from "../schema";

export const DOMAIN_PAYLOAD_SCHEMA_VERSION = "domain-payload.v1";
export const REACT_WEB_DOMAIN_PAYLOAD_POLICY = "react-web-current-supported-lane";

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

export type DomainPayload = ReactWebDomainPayload;

type ReactWebPayloadEvidenceFacts = {
  evidence: string[];
  domTags: string[];
  jsxAttributes: string[];
};

type ReactWebPayloadPlan = {
  result: ExtractionResult;
  evidenceFacts: ReactWebPayloadEvidenceFacts;
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
    ...(jsxComponents.length > 0 ? { jsxComponents } : {}),
    ...(formControls && formControls.length > 0 ? { formControls } : {}),
    ...(eventHandlers.length > 0 ? { eventHandlers } : {}),
    ...(styleSystem ? { styleSystem } : {}),
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
