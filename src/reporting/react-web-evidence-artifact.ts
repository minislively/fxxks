import fs from "node:fs";
import path from "node:path";
import { hashText } from "../core/hash";
import { canonicalProjectDataDir, sanitizeDataKey } from "../core/paths";
import type { CodexRuntimeHookDecision, ContextMode, ModelFacingPayload, SourceRange, SourceFingerprint } from "../core/schema";

export const REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION = "react-web-evidence-artifact.v1";
export const REACT_WEB_EVIDENCE_ARTIFACT_PRODUCER = "fooks";
export const REACT_WEB_EVIDENCE_ARTIFACT_PROFILE = "react-web";
export const REACT_WEB_EVIDENCE_ARTIFACT_PAYLOAD_KIND = "frontend-source-evidence";
export const REACT_WEB_EVIDENCE_ARTIFACT_COMPRESSION_POLICY = "do-not-summarize";
export const REACT_WEB_EVIDENCE_ARTIFACT_INTEROP = Object.freeze({
  mayBeStored: true,
  mayBeSummarized: false,
  mayOverrideDecision: false,
});
export const REACT_WEB_EVIDENCE_ARTIFACT_CLAIM_BOUNDARY =
  "Local React Web repeated same-file source-context evidence only: captures why fooks used, fell back, or denied a bounded React Web source payload. This artifact is not a generic context-manager memory surface, not RN/TUI/WebView support promotion, and not runtime-token, latency, cache-performance, provider-cost, billing, invoice, or charged-cost proof.";

export type ReactWebEvidenceArtifactDecision = "use" | "fallback" | "deny";
export type ReactWebEvidenceArtifactStrength = "direct" | "adjacent" | "weak" | "denied";

export type ReactWebEvidenceArtifactFile = {
  path: string;
  symbols: string[];
  lineRanges: string[];
  whySelected: string[];
};

export type ReactWebEvidenceArtifactInterop = typeof REACT_WEB_EVIDENCE_ARTIFACT_INTEROP;
export type ReactWebEvidenceArtifactRuntimeGraph = NonNullable<NonNullable<CodexRuntimeHookDecision["debug"]>["reactWebFactGraphPacking"]> & {
  diagnosticOnly: true;
};

const REACT_WEB_RUNTIME_GRAPH_REASONS = new Set([
  "fresh-anchors-packed",
  "no-edit-guidance",
  "out-of-scope",
  "freshness-not-fresh",
  "no-anchors-selected",
  "budget-exceeded",
]);
const REACT_WEB_RUNTIME_GRAPH_FRESHNESS_STATUSES = new Set(["fresh", "stale", "unknown"]);

export type ReactWebEvidenceArtifact = {
  schemaVersion: typeof REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  producer: typeof REACT_WEB_EVIDENCE_ARTIFACT_PRODUCER;
  profile: typeof REACT_WEB_EVIDENCE_ARTIFACT_PROFILE;
  payloadKind: typeof REACT_WEB_EVIDENCE_ARTIFACT_PAYLOAD_KIND;
  runtime: "codex";
  hookEventName: "UserPromptSubmit";
  decision: ReactWebEvidenceArtifactDecision;
  evidenceStrength: ReactWebEvidenceArtifactStrength;
  filePath: string;
  reasons: string[];
  whyDenied: string[];
  claimBoundary: typeof REACT_WEB_EVIDENCE_ARTIFACT_CLAIM_BOUNDARY;
  compressionPolicy: typeof REACT_WEB_EVIDENCE_ARTIFACT_COMPRESSION_POLICY;
  interop: ReactWebEvidenceArtifactInterop;
  contextMode?: ContextMode;
  contextModeReason?: string;
  sourceFingerprint?: SourceFingerprint;
  freshness: {
    sourceFingerprint?: SourceFingerprint;
    staleWhen: string[];
  };
  files: ReactWebEvidenceArtifactFile[];
  runtimeGraph?: ReactWebEvidenceArtifactRuntimeGraph;
  editGuidance?: ModelFacingPayload["editGuidance"];
  concernProfiles?: ModelFacingPayload["concernProfiles"];
  domainPayload?: ModelFacingPayload["domainPayload"];
};

export type ReactWebEvidenceArtifactRef = {
  emitted: true;
  id: string;
  path: string;
};

type ReactWebEvidenceArtifactIndex = {
  schemaVersion: 1;
  latest: {
    id: string;
    path: string;
    generatedAt: string;
    filePath: string;
    decision: ReactWebEvidenceArtifactDecision;
    evidenceStrength: ReactWebEvidenceArtifactStrength;
  };
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function toLineRange(loc: SourceRange | undefined): string | undefined {
  if (!loc) return undefined;
  return `${loc.startLine}-${loc.endLine}`;
}

function addRange(target: string[], loc: SourceRange | undefined): void {
  const range = toLineRange(loc);
  if (range) target.push(range);
}

function hasDeniedBoundary(reason: string | undefined, classification: string | undefined): boolean {
  return reason === "unsupported-react-native-webview-boundary" || (classification !== undefined && classification !== "react-web");
}

function artifactDecision(runtimeDecision: CodexRuntimeHookDecision, classification: string | undefined): ReactWebEvidenceArtifactDecision {
  if (runtimeDecision.action === "inject") {
    return "use";
  }
  return hasDeniedBoundary(runtimeDecision.fallback?.reason, classification) ? "deny" : "fallback";
}

function evidenceStrength(decision: ReactWebEvidenceArtifactDecision, classification: string | undefined): ReactWebEvidenceArtifactStrength {
  if (decision === "use") return "direct";
  if (decision === "deny") return "denied";
  return classification === "react-web" ? "adjacent" : "weak";
}

function buildWhySelected(runtimeDecision: CodexRuntimeHookDecision, payload: ModelFacingPayload | undefined): string[] {
  const reasons = [...runtimeDecision.reasons];
  if (runtimeDecision.debug?.repeatedFile) {
    reasons.push("repeated-same-file-runtime-decision");
  }
  if (runtimeDecision.promptSpecificity === "exact-file") {
    reasons.push("exact-file-prompt-target");
  } else if (runtimeDecision.promptSpecificity === "file-hinted") {
    reasons.push("file-hinted-glob-match-target");
  }
  if (runtimeDecision.contextModeReason) {
    reasons.push(runtimeDecision.contextModeReason);
  }
  if (payload?.domainPayload?.domain === "react-web") {
    reasons.push(`react-web-domain-payload:${payload.domainPayload.policy}`);
  }
  if (payload?.editGuidance?.patchTargets?.length) {
    reasons.push("sourceFingerprint-matched-editGuidance");
  }
  return uniqueSorted(reasons);
}

function buildWhyDenied(runtimeDecision: CodexRuntimeHookDecision, classification: string | undefined): string[] {
  const whyDenied = [
    runtimeDecision.fallback?.reason,
    ...runtimeDecision.reasons,
    classification && classification !== "react-web" ? `unsupported-classification:${classification}` : undefined,
  ];
  return uniqueSorted(whyDenied.filter(Boolean) as string[]);
}

function buildFileEntry(filePath: string, payload: ModelFacingPayload | undefined, whySelected: string[]): ReactWebEvidenceArtifactFile {
  const symbols = uniqueSorted([
    payload?.componentName,
    payload?.contract?.propsName,
    ...(payload?.exports ?? []).map((item) => item.name),
  ].filter(Boolean) as string[]);

  const lineRanges: string[] = [];
  addRange(lineRanges, payload?.componentLoc);
  addRange(lineRanges, payload?.contract?.propsLoc);
  for (const target of payload?.editGuidance?.patchTargets ?? []) {
    addRange(lineRanges, target.loc);
  }

  return {
    path: filePath,
    symbols,
    lineRanges: uniqueSorted(lineRanges),
    whySelected,
  };
}

function staleWhen(payload: ModelFacingPayload | undefined): string[] {
  const warnings = [
    "sourceFingerprint.fileHash changes",
    "sourceFingerprint.lineCount changes",
    ...(payload?.domainPayload?.domain === "react-native" ? payload.domainPayload.reuseContract.staleWhen : []),
  ];
  return uniqueSorted(warnings);
}

function evidenceArtifactId(seed: {
  filePath: string;
  sourceFingerprint?: SourceFingerprint;
  decision: ReactWebEvidenceArtifactDecision;
  reasons: string[];
  fallbackReason?: string;
}): string {
  const hash = hashText(JSON.stringify(seed)).slice(0, 16);
  return sanitizeDataKey(`react-web-evidence-${hash}`);
}

function defaultReactWebEvidenceArtifactInterop(): ReactWebEvidenceArtifactInterop {
  return { ...REACT_WEB_EVIDENCE_ARTIFACT_INTEROP };
}

function runtimeGraphEvidence(
  runtimeDecision: CodexRuntimeHookDecision,
): ReactWebEvidenceArtifactRuntimeGraph | undefined {
  const packing = runtimeDecision.debug?.reactWebFactGraphPacking;
  if (!packing) return undefined;
  return {
    ...packing,
    diagnosticOnly: true,
  };
}

function isCanonicalReactWebInterop(
  interop: Partial<ReactWebEvidenceArtifactInterop> | undefined,
): interop is ReactWebEvidenceArtifactInterop {
  return interop?.mayBeStored === true && interop?.mayBeSummarized === false && interop?.mayOverrideDecision === false;
}

function normalizeReactWebEvidenceArtifact(artifact: ReactWebEvidenceArtifact): ReactWebEvidenceArtifact {
  return {
    ...artifact,
    interop: isCanonicalReactWebInterop(artifact.interop) ? artifact.interop : defaultReactWebEvidenceArtifactInterop(),
  };
}

export function reactWebEvidenceArtifactsDir(cwd = process.cwd()): string {
  return path.join(canonicalProjectDataDir(cwd), "artifacts", "react-web-evidence");
}

export function reactWebEvidenceArtifactPath(cwd: string, id: string): string {
  return path.join(reactWebEvidenceArtifactsDir(cwd), `${sanitizeDataKey(id)}.json`);
}

function reactWebEvidenceLatestPath(cwd: string): string {
  return path.join(reactWebEvidenceArtifactsDir(cwd), "latest.json");
}

function assertValidArtifact(artifact: unknown): asserts artifact is ReactWebEvidenceArtifact {
  if (!artifact || typeof artifact !== "object") {
    throw new Error("React Web evidence artifact is missing or invalid");
  }
  const candidate = artifact as Partial<ReactWebEvidenceArtifact>;
  if (candidate.schemaVersion !== REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION) {
    throw new Error("React Web evidence artifact schemaVersion is missing or unsupported");
  }
  if (candidate.producer !== REACT_WEB_EVIDENCE_ARTIFACT_PRODUCER) {
    throw new Error("React Web evidence artifact producer changed");
  }
  if (candidate.profile !== REACT_WEB_EVIDENCE_ARTIFACT_PROFILE) {
    throw new Error("React Web evidence artifact profile changed");
  }
  if (candidate.payloadKind !== REACT_WEB_EVIDENCE_ARTIFACT_PAYLOAD_KIND) {
    throw new Error("React Web evidence artifact payloadKind changed");
  }
  if (candidate.compressionPolicy !== REACT_WEB_EVIDENCE_ARTIFACT_COMPRESSION_POLICY) {
    throw new Error("React Web evidence artifact compressionPolicy changed");
  }
  if (candidate.interop !== undefined && !isCanonicalReactWebInterop(candidate.interop)) {
    throw new Error("React Web evidence artifact interop contract changed");
  }
  if (candidate.runtimeGraph !== undefined) {
    const graph = candidate.runtimeGraph as Partial<ReactWebEvidenceArtifactRuntimeGraph>;
    if (
      typeof graph.included !== "boolean" ||
      typeof graph.reason !== "string" ||
      !REACT_WEB_RUNTIME_GRAPH_REASONS.has(graph.reason) ||
      typeof graph.selectedAnchorCount !== "number" ||
      !Number.isFinite(graph.selectedAnchorCount) ||
      graph.selectedAnchorCount < 0 ||
      typeof graph.deferredAnchorCount !== "number" ||
      !Number.isFinite(graph.deferredAnchorCount) ||
      graph.deferredAnchorCount < 0 ||
      typeof graph.freshnessStatus !== "string" ||
      !REACT_WEB_RUNTIME_GRAPH_FRESHNESS_STATUSES.has(graph.freshnessStatus) ||
      graph.diagnosticOnly !== true
    ) {
      throw new Error("React Web evidence artifact runtimeGraph contract changed");
    }
  }
}

export function buildReactWebEvidenceArtifact(runtimeDecision: CodexRuntimeHookDecision): ReactWebEvidenceArtifact | null {
  if (runtimeDecision.runtime !== "codex") return null;
  if (runtimeDecision.hookEventName !== "UserPromptSubmit") return null;
  if (runtimeDecision.action !== "inject" && runtimeDecision.action !== "fallback") return null;
  if (!runtimeDecision.debug?.repeatedFile) return null;
  if (runtimeDecision.promptSpecificity !== "exact-file" && runtimeDecision.promptSpecificity !== "file-hinted") return null;

  const payload = runtimeDecision.debug.decision?.payload;
  const classification = runtimeDecision.debug.decision?.debug?.domainDetection?.classification ?? payload?.domainPayload?.domain;
  const filePath = runtimeDecision.filePath ?? payload?.filePath;
  if (!filePath) return null;

  const decision = artifactDecision(runtimeDecision, classification);
  const whySelected = buildWhySelected(runtimeDecision, payload);
  const graphEvidence = runtimeGraphEvidence(runtimeDecision);
  const generatedAt = new Date().toISOString();
  const id = evidenceArtifactId({
    filePath,
    sourceFingerprint: payload?.sourceFingerprint,
    decision,
    reasons: runtimeDecision.reasons,
    fallbackReason: runtimeDecision.fallback?.reason,
  });

  return {
    schemaVersion: REACT_WEB_EVIDENCE_ARTIFACT_SCHEMA_VERSION,
    id,
    generatedAt,
    producer: REACT_WEB_EVIDENCE_ARTIFACT_PRODUCER,
    profile: REACT_WEB_EVIDENCE_ARTIFACT_PROFILE,
    payloadKind: REACT_WEB_EVIDENCE_ARTIFACT_PAYLOAD_KIND,
    runtime: "codex",
    hookEventName: "UserPromptSubmit",
    decision,
    evidenceStrength: evidenceStrength(decision, classification),
    filePath,
    reasons: [...runtimeDecision.reasons],
    whyDenied: decision === "use" ? [] : buildWhyDenied(runtimeDecision, classification),
    claimBoundary: REACT_WEB_EVIDENCE_ARTIFACT_CLAIM_BOUNDARY,
    compressionPolicy: REACT_WEB_EVIDENCE_ARTIFACT_COMPRESSION_POLICY,
    interop: defaultReactWebEvidenceArtifactInterop(),
    ...(runtimeDecision.contextMode ? { contextMode: runtimeDecision.contextMode } : {}),
    ...(runtimeDecision.contextModeReason ? { contextModeReason: runtimeDecision.contextModeReason } : {}),
    ...(payload?.sourceFingerprint ? { sourceFingerprint: payload.sourceFingerprint } : {}),
    freshness: {
      ...(payload?.sourceFingerprint ? { sourceFingerprint: payload.sourceFingerprint } : {}),
      staleWhen: staleWhen(payload),
    },
    files: [buildFileEntry(filePath, payload, whySelected)],
    ...(graphEvidence ? { runtimeGraph: graphEvidence } : {}),
    ...(payload?.editGuidance ? { editGuidance: payload.editGuidance } : {}),
    ...(payload?.concernProfiles ? { concernProfiles: payload.concernProfiles } : {}),
    ...(payload?.domainPayload ? { domainPayload: payload.domainPayload } : {}),
  };
}

export function writeReactWebEvidenceArtifact(cwd: string, artifact: ReactWebEvidenceArtifact): ReactWebEvidenceArtifactRef {
  const normalizedArtifact = normalizeReactWebEvidenceArtifact(artifact);
  assertValidArtifact(normalizedArtifact);
  const root = reactWebEvidenceArtifactsDir(cwd);
  fs.mkdirSync(root, { recursive: true });
  const artifactPath = reactWebEvidenceArtifactPath(cwd, normalizedArtifact.id);
  fs.writeFileSync(artifactPath, `${JSON.stringify(normalizedArtifact, null, 2)}\n`);

  const latest: ReactWebEvidenceArtifactIndex = {
    schemaVersion: 1,
    latest: {
      id: normalizedArtifact.id,
      path: artifactPath,
      generatedAt: normalizedArtifact.generatedAt,
      filePath: normalizedArtifact.filePath,
      decision: normalizedArtifact.decision,
      evidenceStrength: normalizedArtifact.evidenceStrength,
    },
  };
  fs.writeFileSync(reactWebEvidenceLatestPath(cwd), `${JSON.stringify(latest, null, 2)}\n`);
  return { emitted: true, id: normalizedArtifact.id, path: artifactPath };
}

export function emitReactWebEvidenceArtifact(cwd: string, runtimeDecision: CodexRuntimeHookDecision): ReactWebEvidenceArtifactRef | null {
  const artifact = buildReactWebEvidenceArtifact(runtimeDecision);
  if (!artifact) return null;
  return writeReactWebEvidenceArtifact(cwd, artifact);
}

function resolveArtifactPath(cwd: string, id: string): string {
  if (id === "latest") {
    const latestPath = reactWebEvidenceLatestPath(cwd);
    if (!fs.existsSync(latestPath)) {
      throw new Error("React Web evidence artifact not found: latest");
    }
    const parsed = JSON.parse(fs.readFileSync(latestPath, "utf8")) as ReactWebEvidenceArtifactIndex;
    return parsed.latest?.path ?? reactWebEvidenceArtifactPath(cwd, id);
  }
  return reactWebEvidenceArtifactPath(cwd, id);
}

export function readReactWebEvidenceArtifact(cwd: string, id: string): ReactWebEvidenceArtifact {
  const artifactPath = resolveArtifactPath(cwd, id);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`React Web evidence artifact not found: ${id}`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as ReactWebEvidenceArtifact;
  assertValidArtifact(artifact);
  return normalizeReactWebEvidenceArtifact(artifact);
}

export function renderReactWebEvidenceArtifactMarkdown(artifact: ReactWebEvidenceArtifact): string {
  assertValidArtifact(artifact);
  const fileLines = artifact.files
    .map((file) => [
      `### ${file.path}`,
      `- Symbols: ${file.symbols.length > 0 ? file.symbols.join(", ") : "none"}`,
      `- Line ranges: ${file.lineRanges.length > 0 ? file.lineRanges.join(", ") : "none"}`,
      `- Why selected: ${file.whySelected.length > 0 ? file.whySelected.join(", ") : "none"}`,
    ].join("\n"))
    .join("\n\n");

  const patchTargets = artifact.editGuidance?.patchTargets?.length
    ? artifact.editGuidance.patchTargets.map((target) => `- ${target.kind}: ${target.label} (${target.loc.startLine}-${target.loc.endLine}) — ${target.reason}`).join("\n")
    : "- none";
  const concernProfiles = artifact.concernProfiles?.length
    ? artifact.concernProfiles.map((profile) => `- ${profile.id}`).join("\n")
    : "- none";
  const whyDenied = artifact.whyDenied.length > 0 ? artifact.whyDenied.map((reason) => `- ${reason}`).join("\n") : "- none";
  const runtimeGraph = artifact.runtimeGraph
    ? [
        `- included: ${artifact.runtimeGraph.included ? "yes" : "no"}`,
        `- reason: ${artifact.runtimeGraph.reason}`,
        `- selected anchors: ${artifact.runtimeGraph.selectedAnchorCount}`,
        `- deferred anchors: ${artifact.runtimeGraph.deferredAnchorCount}`,
        `- freshness: ${artifact.runtimeGraph.freshnessStatus}`,
        `- diagnostic only: ${artifact.runtimeGraph.diagnosticOnly ? "yes" : "no"}`,
      ].join("\n")
    : "- none";

  return `# React Web evidence artifact\n\n${artifact.claimBoundary}\n\n## Summary\n\n- id: ${artifact.id}\n- producer: ${artifact.producer}\n- profile: ${artifact.profile}\n- payload kind: ${artifact.payloadKind}\n- decision: ${artifact.decision}\n- evidence strength: ${artifact.evidenceStrength}\n- file: ${artifact.filePath}\n- context mode: ${artifact.contextMode ?? "none"}\n- context mode reason: ${artifact.contextModeReason ?? "none"}\n- compression policy: ${artifact.compressionPolicy}\n- interop: stored=${artifact.interop.mayBeStored ? "yes" : "no"}, summarized=${artifact.interop.mayBeSummarized ? "yes" : "no"}, override=${artifact.interop.mayOverrideDecision ? "yes" : "no"}\n\n## Freshness\n\n- source fingerprint: ${artifact.sourceFingerprint ? `${artifact.sourceFingerprint.fileHash} / ${artifact.sourceFingerprint.lineCount} lines` : "none"}\n- stale when: ${artifact.freshness.staleWhen.join(", ")}\n\n## Runtime graph diagnostics\n\n${runtimeGraph}\n\n## Reasons\n\n${artifact.reasons.length > 0 ? artifact.reasons.map((reason) => `- ${reason}`).join("\n") : "- none"}\n\n## Why denied\n\n${whyDenied}\n\n## Selected files\n\n${fileLines}\n\n## Concern profiles\n\n${concernProfiles}\n\n## Patch targets\n\n${patchTargets}\n`;
}
