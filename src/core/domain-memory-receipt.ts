import { createHash } from "node:crypto";
import path from "node:path";
import type { DomainDetectionResult, FrontendDomainEvidence } from "./domain-profiles/types";

export type DomainMemoryPlannerDecision =
  | "compact-safe"
  | "narrow-structural"
  | "fallback-full-read"
  | "defer-with-guidance";

export type DomainMemoryReceipt = {
  schemaVersion: "domain-memory.v1";
  scope: {
    filePath: string;
    sourceFingerprint: {
      fileHash: string;
      lineCount: number;
    };
    promptSpecificity: "exact-file";
  };
  domain: {
    lane: string;
    evidence: string[];
    claimBoundary: string;
  };
  concerns: Array<{
    id: string;
    signals: string[];
    nonAuthorizationBoundary: string;
  }>;
  policy: {
    name: "domain-memory-report-only-receipt" | "fallback-first-domain-memory-receipt";
    plannerDecision: DomainMemoryPlannerDecision;
    allowed: false;
    allowedMeaning: "domain-memory receipts are report-only and do not authorize runtime, pre-read, cache, or compact-payload reuse";
    reason?: string;
    staleWhen: string[];
  };
  receipt: {
    generatedAt: string;
    commandOrHook: "inspect-domain --domain-memory-receipt";
    claimSupported: "source evidence receipt only";
    runtimeOrCacheReuse: false;
    nonClaims: string[];
    safeNextAction: string;
  };
};

export type BuildDomainMemoryReceiptOptions = {
  filePath: string;
  cwd: string;
  sourceText: string;
  domainDetection: DomainDetectionResult;
};

function sourceHash(sourceText: string): string {
  return `sha256:${createHash("sha256").update(sourceText).digest("hex")}`;
}

function lineCount(sourceText: string): number {
  if (sourceText.length === 0) return 0;
  return sourceText.split(/\r\n|\r|\n/u).length;
}

function evidenceLabel(evidence: FrontendDomainEvidence): string {
  return `${evidence.domain}:${evidence.signal}:${evidence.detail}`;
}

function plannerDecisionFor(domainDetection: DomainDetectionResult): DomainMemoryPlannerDecision {
  if (domainDetection.profile.fallbackFirst || domainDetection.classification === "webview") {
    return "fallback-full-read";
  }
  if (domainDetection.classification === "react-web" && domainDetection.profile.claimStatus === "current-supported-lane") {
    return "compact-safe";
  }
  if (domainDetection.classification === "react-native") {
    return "narrow-structural";
  }
  return "defer-with-guidance";
}

function policyReason(domainDetection: DomainDetectionResult, plannerDecision: DomainMemoryPlannerDecision): string | undefined {
  if (plannerDecision === "fallback-full-read") {
    return domainDetection.profile.boundaryReason ?? domainDetection.reason ?? "fallback-first-domain-boundary";
  }
  if (plannerDecision === "compact-safe") {
    return "react-web evidence can inform a human/planner receipt, but this CLI flag still grants no runtime/cache/pre-read authorization";
  }
  if (plannerDecision === "narrow-structural") {
    return "react-native evidence is narrow and structural only; no support widening or runtime reuse is granted";
  }
  return domainDetection.reason ?? "evidence-only-domain-inspection";
}

export function buildDomainMemoryReceipt(options: BuildDomainMemoryReceiptOptions): DomainMemoryReceipt {
  const relative = path.relative(options.cwd, options.filePath) || path.basename(options.filePath);
  const evidence = options.domainDetection.evidence.map(evidenceLabel);
  const plannerDecision = plannerDecisionFor(options.domainDetection);
  return {
    schemaVersion: "domain-memory.v1",
    scope: {
      filePath: relative,
      sourceFingerprint: {
        fileHash: sourceHash(options.sourceText),
        lineCount: lineCount(options.sourceText),
      },
      promptSpecificity: "exact-file",
    },
    domain: {
      lane: options.domainDetection.classification,
      evidence,
      claimBoundary: options.domainDetection.profile.claimBoundary,
    },
    concerns: [
      {
        id: "domain-evidence",
        signals: options.domainDetection.signals.length > 0 ? options.domainDetection.signals : evidence,
        nonAuthorizationBoundary: "concern and domain evidence are observations only, not authorization for reuse or support claims",
      },
    ],
    policy: {
      name: plannerDecision === "fallback-full-read" ? "fallback-first-domain-memory-receipt" : "domain-memory-report-only-receipt",
      plannerDecision,
      allowed: false,
      allowedMeaning:
        "domain-memory receipts are report-only and do not authorize runtime, pre-read, cache, or compact-payload reuse",
      reason: policyReason(options.domainDetection, plannerDecision),
      staleWhen: [
        "source file content changes",
        "domain detector profiles or evidence rules change",
        "payload policy or compact-context authorization changes",
        "runtime, pre-read, or cache integration behavior changes",
      ],
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      commandOrHook: "inspect-domain --domain-memory-receipt",
      claimSupported: "source evidence receipt only",
      runtimeOrCacheReuse: false,
      nonClaims: [
        "does not enable runtime or pre-read reuse",
        "does not enable cache reuse",
        "does not expand React Native, WebView, or TUI support",
        "does not authorize compact payload reuse",
        "does not use concern or domain evidence as authorization",
        "does not claim provider-token, billing, cost, latency, or runtime-token savings",
      ],
      safeNextAction: "Read the current source or rerun inspect-domain before reuse.",
    },
  };
}
