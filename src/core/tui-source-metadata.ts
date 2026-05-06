import { detectDomainFromSource } from "./domain-detector";
import type { DomainDetectionResult, FrontendDomainEvidence } from "./domain-profiles/types";

export type TuiSourceMetadataDryRun = {
  schemaVersion: 1;
  mode: "source-only-dry-run";
  classification: DomainDetectionResult["classification"];
  claimStatus: DomainDetectionResult["profile"]["claimStatus"];
  nonEmitting: true;
  integration: {
    cliVisible: false;
    modelFacingPayload: false;
    runtimeOrPreRead: false;
  };
  terminalLayoutEvidence: string[];
  terminalTextStatusEvidence: string[];
  terminalInputFlowEvidence: string[];
  terminalStyleEvidence: string[];
  terminalMixedBoundaryEvidence: string[];
  terminalNegativeBoundaryEvidence: string[];
  omittedRuntimeSemantics: string[];
};

export type TuiSourceMetadataInput = {
  sourceText: string;
  filePath?: string;
  domainDetection?: DomainDetectionResult;
};

const OMITTED_RUNTIME_SEMANTICS = [
  "terminal-rendering-correctness",
  "tty-stdin-behavior",
  "key-handling-correctness",
  "command-execution-semantics",
  "token-or-performance-value",
] as const;

const LAYOUT_PROPS = ["flexDirection", "gap", "padding", "paddingX", "paddingY"] as const;
const STYLE_PROPS = ["color", "dimColor", "bold", "borderStyle", "borderColor"] as const;
const INPUT_MARKERS = ["useInput", "key.escape", "key.return", "key.upArrow", "key.downArrow", "key.backspace", "key.delete"] as const;
const TEXT_STATUS_MARKERS = ["statusGlyph", "phase", "elapsedMs", "messages", "errorMessage", "submitted"] as const;

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function detailsFor(evidence: FrontendDomainEvidence[], signal: string): string[] {
  return evidence.filter((item) => item.signal === signal).map((item) => `${signal}:${item.detail}`);
}

function sourceMarkers(sourceText: string, markers: readonly string[], prefix: string): string[] {
  return markers.filter((marker) => sourceText.includes(marker)).map((marker) => `${prefix}:${marker}`);
}

function hasTuiEvidence(domainDetection: DomainDetectionResult): boolean {
  return domainDetection.evidence.some((item) => item.domain === "tui-ink");
}

function nonTuiDomains(domainDetection: DomainDetectionResult): string[] {
  return unique(domainDetection.evidence.filter((item) => item.domain !== "tui-ink").map((item) => item.domain));
}

export function projectTuiSourceMetadataDryRun(input: TuiSourceMetadataInput): TuiSourceMetadataDryRun {
  const filePath = input.filePath ?? "source.tsx";
  const domainDetection = input.domainDetection ?? detectDomainFromSource(input.sourceText, filePath);
  const tuiEvidence = domainDetection.evidence.filter((item) => item.domain === "tui-ink");
  const hasTui = hasTuiEvidence(domainDetection);
  const nonTuiEvidenceDomains = nonTuiDomains(domainDetection);

  const terminalLayoutEvidence = hasTui
    ? unique([...detailsFor(tuiEvidence, "primitive"), ...sourceMarkers(input.sourceText, LAYOUT_PROPS, "jsx-prop")])
    : [];
  const terminalTextStatusEvidence = hasTui
    ? unique([...detailsFor(tuiEvidence, "primitive").filter((detail) => detail.endsWith(":Text")), ...sourceMarkers(input.sourceText, TEXT_STATUS_MARKERS, "source-marker")])
    : [];
  const terminalInputFlowEvidence = hasTui
    ? unique([...detailsFor(tuiEvidence, "hook"), ...sourceMarkers(input.sourceText, INPUT_MARKERS, "source-marker")])
    : [];
  const terminalStyleEvidence = hasTui ? unique(sourceMarkers(input.sourceText, STYLE_PROPS, "jsx-prop")) : [];
  const terminalMixedBoundaryEvidence =
    hasTui && domainDetection.classification === "mixed"
      ? nonTuiEvidenceDomains.map((domain) => `mixed-with:${domain}`)
      : [];
  const terminalNegativeBoundaryEvidence = hasTui
    ? []
    : [`no-tui-ink-evidence:${domainDetection.classification}:${domainDetection.profile.claimStatus}`];

  return {
    schemaVersion: 1,
    mode: "source-only-dry-run",
    classification: domainDetection.classification,
    claimStatus: domainDetection.profile.claimStatus,
    nonEmitting: true,
    integration: {
      cliVisible: false,
      modelFacingPayload: false,
      runtimeOrPreRead: false,
    },
    terminalLayoutEvidence,
    terminalTextStatusEvidence,
    terminalInputFlowEvidence,
    terminalStyleEvidence,
    terminalMixedBoundaryEvidence,
    terminalNegativeBoundaryEvidence,
    omittedRuntimeSemantics: [...OMITTED_RUNTIME_SEMANTICS],
  };
}
