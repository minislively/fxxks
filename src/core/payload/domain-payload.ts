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
    formControls?: Pick<FormControlSignal, "tag" | "name" | "type" | "handlers">[];
    eventHandlers?: string[];
    styleSystem?: Exclude<StyleSystem, "unknown">;
  };
  warnings: string[];
};

export type DomainPayload = ReactWebDomainPayload;

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
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

export function buildReactWebDomainPayload(
  result: ExtractionResult,
  domainDetection: DomainDetectionResult | undefined = result.domainDetection,
  policy = REACT_WEB_DOMAIN_PAYLOAD_POLICY,
): ReactWebDomainPayload | undefined {
  if (policy !== REACT_WEB_DOMAIN_PAYLOAD_POLICY) return undefined;
  if (!domainDetection) return undefined;
  if (domainDetection.classification !== "react-web") return undefined;
  if (domainDetection.profile.claimStatus !== "current-supported-lane") return undefined;
  if (domainDetection.profile.claimBoundary !== "react-web-measured-extraction") return undefined;

  const reactWebEvidence = domainDetection.evidence.filter((item) => item.domain === "react-web");
  if (reactWebEvidence.length === 0) return undefined;

  const domTags = uniqueSorted(reactWebEvidence.filter((item) => item.signal === "dom-tag").map((item) => item.detail));
  const jsxAttributes = uniqueSorted(reactWebEvidence.filter((item) => item.signal === "jsx-attribute").map((item) => item.detail));
  const eventHandlers = uniqueSorted(result.behavior?.eventHandlers ?? []);
  const formControls = compactFormControls(result.behavior?.formSurface?.controls);
  const styleSystem = result.style?.system && result.style.system !== "unknown" ? result.style.system : undefined;

  return {
    schemaVersion: DOMAIN_PAYLOAD_SCHEMA_VERSION,
    domain: "react-web",
    policy: REACT_WEB_DOMAIN_PAYLOAD_POLICY,
    plannerDecision: "compact-safe",
    claimStatus: "current-supported-lane",
    claimBoundary: "react-web-measured-extraction",
    evidence: uniqueSorted(reactWebEvidence.map((item) => `${item.domain}:${item.signal}:${item.detail}`)),
    facts: {
      ...(domTags.length > 0 ? { domTags } : {}),
      ...(jsxAttributes.length > 0 ? { jsxAttributes } : {}),
      ...(formControls && formControls.length > 0 ? { formControls } : {}),
      ...(eventHandlers.length > 0 ? { eventHandlers } : {}),
      ...(styleSystem ? { styleSystem } : {}),
    },
    warnings: [
      "React Web current supported lane only; this payload does not imply React Native, WebView, TUI, Mixed, or Unknown support.",
      "Planner decision depends on current extractor readiness and domain profile evidence; rerun extraction if the source changes.",
    ],
  };
}
