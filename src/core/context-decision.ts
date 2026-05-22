import path from "node:path";
import type { FrontendConcernProfile } from "./concern-profiles/types";
import type { DomainDetectionResult } from "./domain-detector";
import type { FrontendPayloadPolicyDecision } from "./payload-policy/types";
import type { ExtractionResult, SourceFingerprint } from "./schema";

export const CONTEXT_DECISION_SCHEMA_VERSION = "context-decision.v1" as const;

export type ContextDecisionKind = "full-read" | "report-only" | "compact-context" | "narrow-payload" | "defer";
export type ContextDecisionPromptSpecificity = "exact-file" | "file-hinted" | "ambiguous";
export type ContextDecisionSurface = "cli-report" | "pre-read" | "runtime-repeat" | "status-report";
export type ContextDecisionRuntime = "codex" | "claude" | "opencode" | "cli" | "unknown";
export type ContextDecisionCapability = "react-only" | "codex-ts-js-beta" | "unknown";
export type ContextDecisionFreshness = "fresh" | "stale" | "unknown";

export type ContextDecisionPolicy = {
  allowed: false;
  allowedMeaning: "context-decision.v1 is report-only in this slice and does not authorize runtime, pre-read, cache, setup-readiness, or model-facing reuse";
};

export type ContextDecision = {
  schemaVersion: typeof CONTEXT_DECISION_SCHEMA_VERSION;
  scope: {
    promptSpecificity: ContextDecisionPromptSpecificity;
    files: string[];
    sourceFingerprint?: SourceFingerprint;
  };
  environment: {
    surface: ContextDecisionSurface;
    runtime: ContextDecisionRuntime;
    capability: ContextDecisionCapability;
    contextBudget: {
      maxFiles: number;
      selectedFiles: number;
      totalBytes?: number;
    };
  };
  evidence: {
    domain: DomainDetectionResult["classification"];
    concerns: string[];
    freshness: ContextDecisionFreshness;
    risk: string[];
  };
  decision:
    | { kind: "full-read"; reason: string }
    | { kind: "report-only"; reason: string }
    | { kind: "compact-context"; policy: string; retainedAxes: string[]; diagnosticOnly: true }
    | { kind: "narrow-payload"; policy: string; retainedAxes: string[]; diagnosticOnly: true }
    | { kind: "defer"; reason: string };
  policy: ContextDecisionPolicy;
  nonClaims: string[];
};

export type BuildContextDecisionOptions = {
  filePath: string;
  cwd: string;
  sourceText: string;
  domainDetection: DomainDetectionResult;
  extraction?: ExtractionResult;
  concerns?: FrontendConcernProfile[];
  payloadPolicy?: FrontendPayloadPolicyDecision;
  surface?: ContextDecisionSurface;
  runtime?: ContextDecisionRuntime;
  capability?: ContextDecisionCapability;
  promptSpecificity?: ContextDecisionPromptSpecificity;
  maxFiles?: number;
};

const CONTEXT_DECISION_ALLOWED_MEANING: ContextDecisionPolicy["allowedMeaning"] =
  "context-decision.v1 is report-only in this slice and does not authorize runtime, pre-read, cache, setup-readiness, or model-facing reuse";

const BASE_NON_CLAIMS = [
  "does not authorize runtime reuse",
  "does not authorize pre-read reuse",
  "does not authorize cache reuse",
  "does not authorize setup-readiness reuse",
  "does not authorize model-facing payload reuse",
  "does not expand React Native, WebView, or TUI support",
  "does not claim browser runtime proof",
  "does not claim accessibility audit",
  "does not claim cross-file correctness",
  "does not claim provider-token, billing, cost, latency, or runtime-token savings",
] as const;

const REACT_WEB_RETAINED_AXES = [
  "editTargetRouting",
  "formStateFlow",
  "a11yAnchors",
  "layoutRegionHints",
  "componentApiHints",
  "stylingVariantHints",
  "importRoleHints",
] as const;

const REACT_NATIVE_RETAINED_AXES = ["sourceAnchorBeta", "primitiveInteractions"] as const;

function sourceFingerprintFor(options: BuildContextDecisionOptions): SourceFingerprint | undefined {
  if (!options.extraction) return undefined;
  const extractedHash = options.extraction.fileHash.startsWith("sha256:")
    ? options.extraction.fileHash
    : `sha256:${options.extraction.fileHash}`;
  return {
    fileHash: extractedHash,
    lineCount: options.sourceText.split(/\r\n|\r|\n/u).length,
  };
}

function relativeFilePath(filePath: string, cwd: string): string {
  return path.relative(cwd, filePath) || path.basename(filePath);
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function risksFor(domainDetection: DomainDetectionResult, payloadPolicy?: FrontendPayloadPolicyDecision): string[] {
  return unique([
    "report-only-first-slice",
    domainDetection.profile.fallbackFirst ? "fallback-first-domain-boundary" : undefined,
    domainDetection.classification === "mixed" ? "mixed-domain-evidence" : undefined,
    domainDetection.classification === "webview" ? "webview-boundary" : undefined,
    domainDetection.classification === "unknown" ? "unknown-domain" : undefined,
    payloadPolicy?.allowed === false ? `payload-policy-denied:${payloadPolicy.reason ?? payloadPolicy.name}` : undefined,
    ...(payloadPolicy?.evidenceGates?.map((gate) => `payload-policy-gate:${gate}`) ?? []),
  ]);
}

function reportOnlyReason(domainDetection: DomainDetectionResult, payloadPolicy?: FrontendPayloadPolicyDecision): string {
  return payloadPolicy?.reason ?? domainDetection.reason ?? `${domainDetection.classification}-evidence-only-report-boundary`;
}

function decide(options: BuildContextDecisionOptions): ContextDecision["decision"] {
  const { domainDetection, payloadPolicy } = options;

  if (domainDetection.classification === "webview" || domainDetection.classification === "mixed") {
    return {
      kind: "full-read",
      reason: domainDetection.profile.boundaryReason ?? domainDetection.reason ?? "fallback-first-domain-boundary",
    };
  }

  if (domainDetection.classification === "unknown" || domainDetection.classification === "shared") {
    return { kind: "defer", reason: `${domainDetection.classification}-domain-evidence` };
  }

  if (domainDetection.classification === "tui-ink") {
    return { kind: "defer", reason: "tui-evidence-only-report-boundary" };
  }

  if (domainDetection.classification === "react-native") {
    if (payloadPolicy?.allowed === true) {
      return {
        kind: "narrow-payload",
        policy: payloadPolicy.name,
        retainedAxes: [...REACT_NATIVE_RETAINED_AXES],
        diagnosticOnly: true,
      };
    }
    return { kind: "report-only", reason: reportOnlyReason(domainDetection, payloadPolicy) };
  }

  if (domainDetection.classification === "react-web") {
    if (payloadPolicy?.allowed === true) {
      return {
        kind: "compact-context",
        policy: payloadPolicy.name,
        retainedAxes: [...REACT_WEB_RETAINED_AXES],
        diagnosticOnly: true,
      };
    }
    return { kind: "report-only", reason: reportOnlyReason(domainDetection, payloadPolicy) };
  }

  return { kind: "report-only", reason: reportOnlyReason(domainDetection, payloadPolicy) };
}

export function buildContextDecision(options: BuildContextDecisionOptions): ContextDecision {
  const sourceFingerprint = sourceFingerprintFor(options);
  const concerns = unique(options.concerns?.map((concern) => concern.id) ?? []);
  const selectedFiles = 1;
  return {
    schemaVersion: CONTEXT_DECISION_SCHEMA_VERSION,
    scope: {
      promptSpecificity: options.promptSpecificity ?? "exact-file",
      files: [relativeFilePath(options.filePath, options.cwd)],
      ...(sourceFingerprint ? { sourceFingerprint } : {}),
    },
    environment: {
      surface: options.surface ?? "cli-report",
      runtime: options.runtime ?? "cli",
      capability: options.capability ?? "unknown",
      contextBudget: {
        maxFiles: options.maxFiles ?? 1,
        selectedFiles,
        totalBytes: Buffer.byteLength(options.sourceText, "utf8"),
      },
    },
    evidence: {
      domain: options.domainDetection.classification,
      concerns,
      freshness: sourceFingerprint ? "fresh" : "unknown",
      risk: risksFor(options.domainDetection, options.payloadPolicy),
    },
    decision: decide(options),
    policy: {
      allowed: false,
      allowedMeaning: CONTEXT_DECISION_ALLOWED_MEANING,
    },
    nonClaims: [...BASE_NON_CLAIMS],
  };
}
