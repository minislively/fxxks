import { extractFile } from "./extract";
import {
  type FactEdge,
  type FactGraphConfidence,
  type FactGraphFreshness,
  type FactGraphSourceRef,
  type FactNode,
  buildFactGraphReport,
} from "./fact-graph";
import { REACT_WEB_CONTEXT_METADATA_SCHEMA_VERSION, type ModelFacingPayload, type SourceFingerprint, type SourceRange } from "./schema";
import { toModelFacingPayload } from "./payload/model-facing";

export const REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION = "react-web-fact-graph-inspection.v1" as const;
export const REACT_WEB_FACT_GRAPH_COMMAND = "inspect react-web-fact-graph" as const;
export const REACT_WEB_FACT_GRAPH_EXTRACTOR_ID = "react-web.fact-graph" as const;
export const REACT_WEB_FACT_GRAPH_EXTRACTOR_VERSION = REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION;
export const REACT_WEB_FACT_GRAPH_ADVISORY_BOUNDARY =
  "React Web fact graph inspection is advisory and report-only; it does not authorize runtime, pre-read, cache, setup-readiness, or model-facing reuse." as const;

export type ReactWebFactGraphInspection = {
  schemaVersion: typeof REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION;
  command: typeof REACT_WEB_FACT_GRAPH_COMMAND;
  profile: "react-web";
  inScope: boolean;
  skippedReason?: string;
  advisoryOnly: true;
  graph: ReturnType<typeof buildFactGraphReport>;
};

type MutableGraph = {
  nodes: FactNode[];
  edges: FactEdge[];
};

function stableId(...parts: Array<string | number | undefined>): string {
  return parts
    .filter((part) => part !== undefined && String(part).trim().length > 0)
    .map((part) =>
      String(part)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "fact",
    )
    .join(":");
}

function sourceRef(filePath: string, loc: SourceRange | undefined, fingerprint: SourceFingerprint | undefined): FactGraphSourceRef | undefined {
  if (!loc && !fingerprint) return undefined;
  return {
    filePath,
    ...(loc ? { loc } : {}),
    ...(fingerprint ? { fingerprint } : {}),
    extractor: {
      id: REACT_WEB_FACT_GRAPH_EXTRACTOR_ID,
      version: REACT_WEB_FACT_GRAPH_EXTRACTOR_VERSION,
    },
  };
}

function refs(filePath: string, loc: SourceRange | undefined, fingerprint: SourceFingerprint | undefined): FactGraphSourceRef[] {
  const ref = sourceRef(filePath, loc, fingerprint);
  return ref ? [ref] : [];
}

function addNode(graph: MutableGraph, node: FactNode): void {
  if (graph.nodes.some((current) => current.id === node.id)) return;
  graph.nodes.push(node);
}

function addEdge(graph: MutableGraph, edge: FactEdge): void {
  if (edge.from === edge.to || graph.edges.some((current) => current.id === edge.id)) return;
  graph.edges.push(edge);
}

function payloadFingerprint(payload: ModelFacingPayload): SourceFingerprint | undefined {
  return payload.sourceFingerprint ?? payload.reactWebContext?.freshness;
}

function freshnessFor(payload: ModelFacingPayload, warnings: string[]): FactGraphFreshness {
  const fingerprint = payloadFingerprint(payload);
  if (!fingerprint) warnings.push("No source fingerprint was available; rerun extraction or inspect source before relying on ranges.");

  return {
    status: fingerprint ? "fresh" : "unknown",
    staleWhen: [
      "source fingerprint changes",
      "React Web context schema version changes",
      "React Web fact graph producer version changes",
    ],
    sourceFingerprints: fingerprint ? [fingerprint] : [],
    extractorVersions: {
      [REACT_WEB_FACT_GRAPH_EXTRACTOR_ID]: REACT_WEB_FACT_GRAPH_EXTRACTOR_VERSION,
      reactWebContext: REACT_WEB_CONTEXT_METADATA_SCHEMA_VERSION,
    },
  };
}

function buildEmptyInspection(payload: ModelFacingPayload, inScope: boolean, skippedReason: string | undefined, warnings: string[]): ReactWebFactGraphInspection {
  return {
    schemaVersion: REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION,
    command: REACT_WEB_FACT_GRAPH_COMMAND,
    profile: "react-web",
    inScope,
    ...(skippedReason ? { skippedReason } : {}),
    advisoryOnly: true,
    graph: buildFactGraphReport({
      scope: { files: [payload.filePath], domain: "react-web" },
      freshness: freshnessFor(payload, warnings),
      warnings,
    }),
  };
}

function addComponentNodes(graph: MutableGraph, payload: ModelFacingPayload): string | undefined {
  const fingerprint = payloadFingerprint(payload);
  const fileNodeId = stableId("file", payload.filePath);
  addNode(graph, {
    id: fileNodeId,
    domain: "react-web",
    kind: "file",
    label: payload.filePath,
    confidence: fingerprint ? "known" : "candidate",
    sourceRefs: refs(payload.filePath, undefined, fingerprint),
    evidence: ["modelFacingPayload.filePath"],
  });

  if (!payload.componentName && !payload.componentLoc) return fileNodeId;

  const componentNodeId = stableId("component", payload.componentName ?? payload.filePath, payload.componentLoc?.startLine);
  addNode(graph, {
    id: componentNodeId,
    domain: "react-web",
    kind: "component",
    label: payload.componentName ?? "component",
    confidence: payload.componentLoc ? "known" : "candidate",
    sourceRefs: refs(payload.filePath, payload.componentLoc, fingerprint),
    evidence: [payload.componentLoc ? "componentLoc" : "componentName"],
  });
  addEdge(graph, {
    id: stableId("edge", fileNodeId, "contains", componentNodeId),
    domain: "react-web",
    kind: "contains",
    from: fileNodeId,
    to: componentNodeId,
    confidence: payload.componentLoc ? "known" : "candidate",
    sourceRefs: refs(payload.filePath, payload.componentLoc, fingerprint),
    evidence: ["file contains component declaration"],
  });
  return componentNodeId;
}

function addPatchTargetNodes(graph: MutableGraph, payload: ModelFacingPayload, parentId: string): void {
  const fingerprint = payloadFingerprint(payload);
  for (const target of payload.editGuidance?.patchTargets ?? []) {
    const nodeId = stableId("patch-target", target.kind, target.label, target.loc.startLine);
    addNode(graph, {
      id: nodeId,
      domain: "react-web",
      kind: `patch-target:${target.kind}`,
      label: target.label,
      confidence: "known",
      sourceRefs: refs(payload.filePath, target.loc, fingerprint),
      evidence: ["editGuidance.patchTargets", target.reason],
      properties: { targetKind: target.kind },
    });
    addEdge(graph, {
      id: stableId("edge", parentId, "targets", nodeId),
      domain: "react-web",
      kind: "targets",
      from: parentId,
      to: nodeId,
      confidence: "known",
      sourceRefs: refs(payload.filePath, target.loc, fingerprint),
      evidence: ["patch target belongs to current React Web inspection scope"],
    });
  }
}

function addContextArray<T extends { kind?: string; label?: string; evidence?: string[]; loc?: SourceRange }>(
  graph: MutableGraph,
  payload: ModelFacingPayload,
  parentId: string,
  field: keyof NonNullable<ModelFacingPayload["reactWebContext"]>,
  kindPrefix: string,
  edgeKind: string,
  confidence: FactGraphConfidence = "candidate",
): void {
  const values = payload.reactWebContext?.[field] as T[] | undefined;
  if (!Array.isArray(values)) return;
  const fingerprint = payloadFingerprint(payload);
  values.forEach((value: T, index) => {
    const label = value.label ?? value.kind ?? `${String(field)} ${index + 1}`;
    const nodeId = stableId(kindPrefix, value.kind, label, value.loc?.startLine, index);
    addNode(graph, {
      id: nodeId,
      domain: "react-web",
      kind: value.kind ? `${kindPrefix}:${value.kind}` : kindPrefix,
      label,
      confidence: value.loc ? confidence : "candidate",
      sourceRefs: refs(payload.filePath, value.loc, fingerprint),
      evidence: [`reactWebContext.${String(field)}`, ...(value.evidence ?? [])],
    });
    addEdge(graph, {
      id: stableId("edge", parentId, edgeKind, nodeId),
      domain: "react-web",
      kind: edgeKind,
      from: parentId,
      to: nodeId,
      confidence: value.loc ? confidence : "candidate",
      sourceRefs: refs(payload.filePath, value.loc, fingerprint),
      evidence: [`reactWebContext.${String(field)} is source-backed advisory context`],
    });
  });
}

function addFormStateRoleNodes(graph: MutableGraph, payload: ModelFacingPayload, parentId: string): void {
  for (const role of payload.reactWebContext?.formStateRoles ?? []) {
    const nodeId = stableId("form-state-role", role.role, role.labels.join("-"));
    addNode(graph, {
      id: nodeId,
      domain: "react-web",
      kind: `form-state-role:${role.role}`,
      label: role.labels.join(", ") || role.role,
      confidence: "candidate",
      sourceRefs: refs(payload.filePath, undefined, payloadFingerprint(payload)),
      evidence: [`reactWebContext.formStateRoles.${role.role}`, ...role.evidence],
      properties: { role: role.role, source: role.source, labels: role.labels },
    });
    addEdge(graph, {
      id: stableId("edge", parentId, "uses-form-role", nodeId),
      domain: "react-web",
      kind: "uses-form-role",
      from: parentId,
      to: nodeId,
      confidence: "candidate",
      sourceRefs: refs(payload.filePath, undefined, payloadFingerprint(payload)),
      evidence: ["form-state role is advisory source-backed context, not runtime authorization"],
    });
  }
}

function addConcernProfileNodes(graph: MutableGraph, payload: ModelFacingPayload, parentId: string): void {
  for (const concern of payload.concernProfiles ?? []) {
    const nodeId = stableId("concern-profile", concern.id);
    addNode(graph, {
      id: nodeId,
      domain: "react-web",
      kind: "concern-profile",
      label: concern.id,
      confidence: "candidate",
      sourceRefs: refs(payload.filePath, undefined, payloadFingerprint(payload)),
      evidence: [concern.claim, concern.nonAuthorizationBoundary, ...concern.signals.map((signal) => `concern:${signal}`)],
      properties: { advisoryOnly: true, concernId: concern.id },
    });
    addEdge(graph, {
      id: stableId("edge", parentId, "supports-concern", nodeId),
      domain: "react-web",
      kind: "supports-concern",
      from: parentId,
      to: nodeId,
      confidence: "candidate",
      sourceRefs: refs(payload.filePath, undefined, payloadFingerprint(payload)),
      evidence: ["concern profile is advisory-only and never compact payload authorization"],
    });
  }
}

function hasGraphableFacts(payload: ModelFacingPayload): boolean {
  return Boolean(
    payload.componentName ||
      payload.componentLoc ||
      payload.editGuidance?.patchTargets?.length ||
      payload.concernProfiles?.length ||
      payload.reactWebContext?.editTargetRouting?.length ||
      payload.reactWebContext?.formStateFlow?.length ||
      payload.reactWebContext?.a11yAnchors?.length ||
      payload.reactWebContext?.componentApiHints?.length ||
      payload.reactWebContext?.layoutRegionHints?.length ||
      payload.reactWebContext?.importRoleHints?.length ||
      payload.reactWebContext?.localDependencies?.length ||
      payload.reactWebContext?.formStateRoles?.length,
  );
}

function buildGraph(payload: ModelFacingPayload, warnings: string[]): ReturnType<typeof buildFactGraphReport> {
  if (!hasGraphableFacts(payload)) {
    warnings.push("React Web source is in scope, but no graphable source-backed facts were detected for P0.");
    return buildFactGraphReport({
      scope: { files: [payload.filePath], domain: "react-web" },
      freshness: freshnessFor(payload, warnings),
      warnings,
    });
  }

  const graph: MutableGraph = { nodes: [], edges: [] };
  const parentId = addComponentNodes(graph, payload) ?? stableId("file", payload.filePath);
  addPatchTargetNodes(graph, payload, parentId);
  addContextArray(graph, payload, parentId, "editTargetRouting", "edit-target-route", "targets", "known");
  addContextArray(graph, payload, parentId, "formStateFlow", "form-state-flow", "flows-to", "candidate");
  addContextArray(graph, payload, parentId, "a11yAnchors", "a11y-anchor", "associated-with", "candidate");
  addContextArray(graph, payload, parentId, "componentApiHints", "component-api", "contains", "candidate");
  addContextArray(graph, payload, parentId, "layoutRegionHints", "layout-region", "contains", "candidate");
  addContextArray(graph, payload, parentId, "importRoleHints", "import-role", "depends-on", "candidate");
  addContextArray(graph, payload, parentId, "localDependencies", "local-dependency", "depends-on", "candidate");
  addFormStateRoleNodes(graph, payload, parentId);
  addConcernProfileNodes(graph, payload, parentId);

  if (payload.domainPayload?.domain === "react-web") {
    warnings.push("React Web domain payload was used only as advisory evidence; payload planning metadata is not a graph authorization signal.");
  }

  return buildFactGraphReport({
    scope: { files: [payload.filePath], domain: "react-web" },
    freshness: freshnessFor(payload, warnings),
    nodes: graph.nodes,
    edges: graph.edges,
    warnings,
  });
}

export function buildReactWebFactGraphInspection(filePath: string, cwd = process.cwd()): ReactWebFactGraphInspection {
  const result = extractFile(filePath);
  const payload = toModelFacingPayload(result, cwd, {
    includeEditGuidance: true,
    includeReactWebContextMetadata: true,
    includeDomainPayload: true,
  });
  const warnings: string[] = [REACT_WEB_FACT_GRAPH_ADVISORY_BOUNDARY];
  const classification = result.domainDetection?.classification ?? "unknown";

  if (classification !== "react-web") {
    const skippedReason = classification === "mixed"
      ? "mixed-domain-fail-closed"
      : `unsupported-domain:${classification}`;
    warnings.push(`React Web fact graph inspection skipped: ${skippedReason}.`);
    return buildEmptyInspection(payload, false, skippedReason, warnings);
  }

  return {
    schemaVersion: REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION,
    command: REACT_WEB_FACT_GRAPH_COMMAND,
    profile: "react-web",
    inScope: true,
    advisoryOnly: true,
    graph: buildGraph(payload, warnings),
  };
}

export function renderReactWebFactGraphInspectionText(inspection: ReactWebFactGraphInspection): string {
  const graph = inspection.graph;
  const lines = [
    `React Web fact graph inspection (${inspection.schemaVersion})`,
    `Command: ${inspection.command}`,
    `In scope: ${inspection.inScope}${inspection.skippedReason ? ` (${inspection.skippedReason})` : ""}`,
    `Advisory only: ${inspection.advisoryOnly}`,
    `Graph: ${graph.metrics.nodeCount} node(s), ${graph.metrics.edgeCount} edge(s), freshness=${graph.freshness.status}`,
    `Policy: reportOnly=${graph.policy.reportOnly}, runtimeAuthorized=${graph.policy.runtimeAuthorized}, candidatesAuthorizeRuntime=${graph.policy.candidatesAuthorizeRuntime}`,
  ];
  if (graph.warnings.length > 0) {
    lines.push("Warnings:", ...graph.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}
