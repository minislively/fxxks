import type { WorkItem, WorkItemCurrentAuthoritySummary, WorkItemDashboard, WorkItemDomainJudgment, WorkItemEvidence, WorkItemNextAction } from "./work-item-dashboard";
import { WORK_ITEM_DASHBOARD_CLAIM_BOUNDARY, buildWorkItemCurrentAuthoritySummary } from "./work-item-dashboard";

export const WORK_ITEM_EXPLAIN_SCHEMA_VERSION = 2;
export const WORK_ITEM_EXPLAIN_CLAIM_BOUNDARY =
  "CLI-only WorkItem evidence explanation: explains current status/work-item/sample artifacts from the docs-backed WorkItem model without changing provider/runtime behavior, detector scope, merge-gate policy, TUI, React Web, React Native, or WebView behavior.";

export type WorkItemExplainArtifact = "status" | "work-item" | "sample" | "current";

export type WorkItemExplainRejectedEvidence = {
  evidence: string;
  reason: string;
};

export type WorkItemExplainResult = {
  schemaVersion: typeof WORK_ITEM_EXPLAIN_SCHEMA_VERSION;
  command: "explain";
  artifact: WorkItemExplainArtifact;
  generatedAt: string;
  claimBoundary: typeof WORK_ITEM_EXPLAIN_CLAIM_BOUNDARY;
  dashboardClaimBoundary: typeof WORK_ITEM_DASHBOARD_CLAIM_BOUNDARY;
  readOnly: true;
  workItem: {
    id: string;
    title: string;
    state: WorkItem["state"];
    frontendDomain: WorkItem["frontendDomain"];
    domainJudgment: WorkItemDomainJudgment;
  };
  currentAuthoritySummary: WorkItemCurrentAuthoritySummary;
  why: string[];
  evidence: WorkItemEvidence[];
  rejectedEvidence: WorkItemExplainRejectedEvidence[];
  nextAction: WorkItemNextAction;
  nonClaims: string[];
};


function unknownDomainJudgment(nextAction: WorkItemNextAction, rationale: string): WorkItemDomainJudgment {
  return {
    frontendDomain: "unknown",
    confidence: "low",
    recommendedState: "fallback-required",
    evidenceFocus: ["source inspection", "issue scope", "changed paths", "explicit domain evidence"],
    requiredEvidence: ["explicit domain evidence before automatic ingestion", "fallback source inspection", "issue or receipt link before active-work claims"],
    nextAction,
    rationale,
    nonClaims: [
      "Domain judgment is pre-ingestion guidance, not runtime correctness proof.",
      "Unknown work items do not imply React Web, React Native, WebView, TUI, or Shared support.",
    ],
  };
}

function sampleEvidence(): WorkItemEvidence[] {
  return [
    {
      kind: "architectureDoc",
      evidenceClass: "Source evidence",
      observed: "sample artifact demonstrates WorkItem/Evidence/NextAction explanation shape",
      source: "fooks explain sample",
      fresh: true,
      supports: "CLI formatting and machine-readable explanation contract for the WorkItem evidence model, including frontend domain representation",
      doesNotSupport: "provider/runtime behavior changes, detector expansion, merge-gate approval, TUI rewrite, or product/performance claims",
    },
    {
      kind: "worktree",
      evidenceClass: "Workflow evidence",
      observed: "sample has no live worktree mutation or remote lookup",
      source: "static sample fixture",
      fresh: "unknown",
      supports: "safe operator preview of the explain surface",
      doesNotSupport: "current repository status, PR state, test pass, or closeout receipt",
    },
  ];
}

function sampleWorkItem(): WorkItem {
  const nextAction: WorkItemNextAction = {
    kind: "inspect",
    label: "Run fooks explain status in a repository to inspect live WorkItem evidence",
    command: "fooks explain status",
    reason: "sample explains the model shape only; live status evidence is intentionally not inferred from the sample",
    closesWhen: "a live status/work-item explanation is generated from the current repository dashboard",
  };
  const evidence = sampleEvidence();
  const domainJudgment = unknownDomainJudgment(nextAction, "sample artifact has no live branch/path/source domain hints");
  return {
    id: "work-item-sample",
    title: "Sample WorkItem evidence explanation",
    state: "uninspected",
    frontendDomain: "unknown",
    domainJudgment,
    observed: evidence.map((item) => item.observed),
    inferred: [
      "The sample is static and read-only.",
      "Use status, current, or work-item to explain the current repository artifact.",
    ],
    requiredNextAction: nextAction,
    evidence,
    nonClaims: [
      "The sample does not prove current repository readiness.",
      "The sample does not prove provider usage, runtime behavior, detector support, TUI behavior, or performance results.",
    ],
  };
}

function evidenceForArtifact(artifact: WorkItemExplainArtifact, dashboard: WorkItemDashboard): WorkItem {
  if (artifact === "sample") return sampleWorkItem();
  const item = dashboard.workItems[0];
  if (!item) {
    const nextAction: WorkItemNextAction = {
      kind: "inspect",
      label: "Inspect status evidence before acting",
      command: "fooks status",
      reason: "dashboard contains no work item entries",
      closesWhen: "a dashboard work item entry exists or the missing evidence is recorded",
    };
    const domainJudgment = unknownDomainJudgment(nextAction, "dashboard contains no work item entries");
    return {
      id: "work-item-missing",
      title: "Missing WorkItem evidence",
      state: "blocked",
      frontendDomain: "unknown",
      domainJudgment,
      observed: [],
      inferred: ["No work item was available in the dashboard artifact."],
      requiredNextAction: nextAction,
      evidence: [],
      nonClaims: ["No completion or readiness claim can be made without WorkItem evidence."],
    };
  }
  return item;
}

function whyFor(item: WorkItem, dashboard: WorkItemDashboard, artifact: WorkItemExplainArtifact): string[] {
  return [
    `artifact '${artifact}' resolves to WorkItem '${item.id}' in state '${item.state}' for frontend domain '${item.frontendDomain}'`,
    ...item.observed.map((observed) => `observed: ${observed}`),
    ...item.inferred.map((inferred) => `inferred: ${inferred}`),
    `next action: ${item.requiredNextAction.label} because ${item.requiredNextAction.reason}`,
    `source model: ${dashboard.source}`,
  ];
}

function rejectedEvidenceFor(item: WorkItem): WorkItemExplainRejectedEvidence[] {
  const rejected = item.evidence.map((evidence) => ({
    evidence: evidence.observed,
    reason: evidence.doesNotSupport,
  }));
  for (const nonClaim of item.nonClaims) {
    rejected.push({ evidence: nonClaim, reason: "explicit WorkItem non-claim" });
  }
  return rejected;
}

export function buildWorkItemExplain(artifact: WorkItemExplainArtifact, dashboard: WorkItemDashboard): WorkItemExplainResult {
  const item = evidenceForArtifact(artifact, dashboard);
  const currentAuthoritySummary = artifact === "sample"
    ? buildWorkItemCurrentAuthoritySummary(item, { worktree: "static-sample" })
    : dashboard.workItems[0] === item
      ? dashboard.currentAuthoritySummary
      : buildWorkItemCurrentAuthoritySummary(item, dashboard.anchors);
  return {
    schemaVersion: WORK_ITEM_EXPLAIN_SCHEMA_VERSION,
    command: "explain",
    artifact,
    generatedAt: new Date().toISOString(),
    claimBoundary: WORK_ITEM_EXPLAIN_CLAIM_BOUNDARY,
    dashboardClaimBoundary: WORK_ITEM_DASHBOARD_CLAIM_BOUNDARY,
    readOnly: true,
    workItem: {
      id: item.id,
      title: item.title,
      state: item.state,
      frontendDomain: item.frontendDomain,
      domainJudgment: item.domainJudgment,
    },
    currentAuthoritySummary,
    why: whyFor(item, dashboard, artifact),
    evidence: item.evidence,
    rejectedEvidence: rejectedEvidenceFor(item),
    nextAction: item.requiredNextAction,
    nonClaims: item.nonClaims,
  };
}


function displayFrontendDomain(frontendDomain: WorkItem["frontendDomain"]): string {
  switch (frontendDomain) {
    case "react-web":
      return "React Web";
    case "react-native":
      return "React Native";
    case "webview":
      return "WebView";
    case "tui":
      return "TUI";
    case "shared":
      return "Shared";
    case "unknown":
      return "Unknown-domain";
  }
}

function bulletList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

export function renderWorkItemExplainText(explain: WorkItemExplainResult): string {
  const evidence = explain.evidence.length > 0
    ? explain.evidence
        .map((item) => `- [${item.evidenceClass}/${item.kind}] ${item.observed}\n  supports: ${item.supports}\n  source: ${item.source}\n  fresh: ${item.fresh}`)
        .join("\n")
    : "- none";
  const rejected = explain.rejectedEvidence.length > 0
    ? explain.rejectedEvidence.map((item) => `- ${item.evidence}\n  rejected for: ${item.reason}`).join("\n")
    : "- none";
  const commandLine = explain.nextAction.command ? `\n- command: ${explain.nextAction.command}` : "";
  const domainLabel = displayFrontendDomain(explain.workItem.frontendDomain);
  const judgmentAction = explain.workItem.domainJudgment.nextAction;
  const judgmentCommandLine = judgmentAction.command ? `\n- domain command: ${judgmentAction.command}` : "";
  const summary = explain.currentAuthoritySummary;

  return `# fooks explain ${explain.artifact}\n\n${explain.claimBoundary}\n\n## Current authority summary\n\n- status: ${summary.statusLabel}\n- source of truth: ${summary.sourceOfTruth}\n- stale boundary: ${summary.staleBoundary}\n- next action: ${summary.nextAction}\n\n## Work item\n\n- id: ${explain.workItem.id}\n- title: ${explain.workItem.title}\n- state: ${explain.workItem.state}\n- frontend domain: ${domainLabel} (${explain.workItem.frontendDomain})\n- domain judgment: ${explain.workItem.domainJudgment.recommendedState} / ${judgmentAction.kind} (${explain.workItem.domainJudgment.confidence} confidence)\n\n## Why\n\n${bulletList(explain.why)}\n\n## Evidence\n\n${evidence}\n\n## Rejected evidence / non-claims\n\n${rejected}\n\n## Domain judgment\n\n- frontend domain: ${domainLabel} (${explain.workItem.domainJudgment.frontendDomain})\n- recommended state: ${explain.workItem.domainJudgment.recommendedState}\n- confidence: ${explain.workItem.domainJudgment.confidence}\n- rationale: ${explain.workItem.domainJudgment.rationale}\n- evidence focus: ${explain.workItem.domainJudgment.evidenceFocus.join(", ")}\n- required evidence: ${explain.workItem.domainJudgment.requiredEvidence.join(", ")}\n- domain next action kind: ${judgmentAction.kind}\n- domain next action: ${judgmentAction.label}${judgmentCommandLine}\n- domain reason: ${judgmentAction.reason}\n- domain closes when: ${judgmentAction.closesWhen}\n\n## Next action\n\n- kind: ${explain.nextAction.kind}\n- label: ${explain.nextAction.label}${commandLine}\n- reason: ${explain.nextAction.reason}\n- closes when: ${explain.nextAction.closesWhen}\n\n## Non-claims\n\n${bulletList([...summary.nonClaims, ...explain.nonClaims])}\n`;
}
