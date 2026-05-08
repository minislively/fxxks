import fs from "node:fs";
import path from "node:path";
import { hashText } from "./hash";
import type { SourceFingerprint } from "./schema";
import {
  type ReactWebEvidenceArtifact,
  readReactWebEvidenceArtifact,
} from "./react-web-evidence-artifact";

export const REACT_WEB_ACTIVATION_MODE_SCHEMA_VERSION = "react-web-activation-mode.v1";
export const REACT_WEB_ACTIVATION_MODE_COMMAND = "inspect activation-mode";
export const REACT_WEB_ACTIVATION_MODE_MODE = "shadow-advisory";
export const REACT_WEB_ACTIVATION_MODE_CLAIM_BOUNDARY =
  "Local React Web activation-mode advisory only: reports when bounded repeated-file React Web evidence would qualify for activation under the current contract, while leaving runtime selection and injection behavior unchanged. This surface does not widen support claims, does not enable always-on or model-driven activation, and does not promote RN/TUI/WebView or generic context-manager behavior.";

export const REACT_WEB_ACTIVATION_SUPPORTED_TRIGGER = "repeated-file";
export const REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS = [
  "always-on",
  "glob-match",
  "model-decision",
  "profile-gate",
] as const;

export type ReactWebActivationDeferredTrigger = (typeof REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS)[number];
export type ReactWebActivationVerdict = "would-activate" | "deferred" | "blocked";

export type ReactWebActivationModeResult = {
  schemaVersion: typeof REACT_WEB_ACTIVATION_MODE_SCHEMA_VERSION;
  command: typeof REACT_WEB_ACTIVATION_MODE_COMMAND;
  profile: "react-web";
  mode: typeof REACT_WEB_ACTIVATION_MODE_MODE;
  artifactId: string;
  artifactGeneratedAt: string;
  filePath: string;
  claimBoundary: typeof REACT_WEB_ACTIVATION_MODE_CLAIM_BOUNDARY;
  verdict: ReactWebActivationVerdict;
  runtimeDecision: ReactWebEvidenceArtifact["decision"];
  evidenceStrength: ReactWebEvidenceArtifact["evidenceStrength"];
  supportedTrigger: {
    name: typeof REACT_WEB_ACTIVATION_SUPPORTED_TRIGGER;
    positive: boolean;
    reasons: string[];
  };
  deferredTriggers: Array<{
    name: ReactWebActivationDeferredTrigger;
    reason: string;
  }>;
  blockedReasons: string[];
};

export type ReactWebActivationModeSummary = {
  available: boolean;
  verdict: ReactWebActivationVerdict | "unavailable";
  repeatedFilePositive: boolean;
  deferredTriggers: ReactWebActivationDeferredTrigger[];
  blockedReasons: string[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function currentSourceFingerprint(filePath: string): SourceFingerprint | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const source = fs.readFileSync(filePath, "utf8");
  return {
    fileHash: hashText(source),
    lineCount: source.split(/\r?\n/u).length,
  };
}

function sourceFingerprintsEqual(left: SourceFingerprint | undefined, right: SourceFingerprint | null): boolean {
  if (!left || !right) return false;
  return left.fileHash === right.fileHash && left.lineCount === right.lineCount;
}

function blockedReasonsFor(artifact: ReactWebEvidenceArtifact): string[] {
  if (artifact.decision !== "deny") {
    return [];
  }
  return uniqueSorted(
    artifact.whyDenied.filter(
      (reason) => reason === "unsupported-react-native-webview-boundary" || reason.startsWith("unsupported-classification:"),
    ),
  );
}

function repeatedFileReasons(cwd: string, artifact: ReactWebEvidenceArtifact): string[] {
  const reasons: string[] = [];
  if (artifact.domainPayload?.domain === "react-web") {
    reasons.push("react-web-domain-payload-present");
  } else {
    reasons.push("missing-react-web-domain-payload");
  }
  if (artifact.editGuidance?.patchTargets?.length) {
    reasons.push("patch-targets-present");
  } else {
    reasons.push("missing-patch-targets");
  }
  if (artifact.sourceFingerprint) {
    reasons.push("sourceFingerprint-present");
    const current = currentSourceFingerprint(path.resolve(cwd, artifact.filePath));
    if (!current) {
      reasons.push("source-file-missing");
    } else if (sourceFingerprintsEqual(artifact.sourceFingerprint, current)) {
      reasons.push("freshness-current");
    } else {
      reasons.push("freshness-stale");
    }
  } else {
    reasons.push("missing-sourceFingerprint");
  }
  if (artifact.decision === "use") {
    reasons.push("runtime-decision-use");
  } else if (artifact.decision === "fallback") {
    reasons.push("runtime-decision-fallback");
  } else {
    reasons.push("runtime-decision-deny");
  }
  return uniqueSorted(reasons);
}

function repeatedFilePositive(cwd: string, artifact: ReactWebEvidenceArtifact): boolean {
  const current = artifact.sourceFingerprint ? currentSourceFingerprint(path.resolve(cwd, artifact.filePath)) : null;
  return (
    artifact.decision === "use" &&
    artifact.domainPayload?.domain === "react-web" &&
    Boolean(artifact.editGuidance?.patchTargets?.length) &&
    Boolean(artifact.sourceFingerprint) &&
    sourceFingerprintsEqual(artifact.sourceFingerprint, current)
  );
}

export function buildReactWebActivationMode(cwd: string, artifact: ReactWebEvidenceArtifact): ReactWebActivationModeResult {
  const positive = repeatedFilePositive(cwd, artifact);
  const blockedReasons = blockedReasonsFor(artifact);
  const verdict: ReactWebActivationVerdict =
    blockedReasons.length > 0 || artifact.decision === "deny"
      ? "blocked"
      : positive
        ? "would-activate"
        : "deferred";

  return {
    schemaVersion: REACT_WEB_ACTIVATION_MODE_SCHEMA_VERSION,
    command: REACT_WEB_ACTIVATION_MODE_COMMAND,
    profile: "react-web",
    mode: REACT_WEB_ACTIVATION_MODE_MODE,
    artifactId: artifact.id,
    artifactGeneratedAt: artifact.generatedAt,
    filePath: artifact.filePath,
    claimBoundary: REACT_WEB_ACTIVATION_MODE_CLAIM_BOUNDARY,
    verdict,
    runtimeDecision: artifact.decision,
    evidenceStrength: artifact.evidenceStrength,
    supportedTrigger: {
      name: REACT_WEB_ACTIVATION_SUPPORTED_TRIGGER,
      positive,
      reasons: repeatedFileReasons(cwd, artifact),
    },
    deferredTriggers: REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS.map((name) => ({
      name,
      reason: "deferred-in-first-activation-pass",
    })),
    blockedReasons,
  };
}

export function readReactWebActivationMode(cwd: string, id: string): ReactWebActivationModeResult {
  return buildReactWebActivationMode(cwd, readReactWebEvidenceArtifact(cwd, id));
}

export function summarizeReactWebActivationMode(
  activationMode: ReactWebActivationModeResult | null,
): ReactWebActivationModeSummary {
  if (!activationMode) {
    return {
      available: false,
      verdict: "unavailable",
      repeatedFilePositive: false,
      deferredTriggers: [...REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS],
      blockedReasons: [],
    };
  }

  return {
    available: true,
    verdict: activationMode.verdict,
    repeatedFilePositive: activationMode.supportedTrigger.positive,
    deferredTriggers: activationMode.deferredTriggers.map((item) => item.name),
    blockedReasons: activationMode.blockedReasons,
  };
}

export function renderReactWebActivationModeMarkdown(activationMode: ReactWebActivationModeResult): string {
  const deferred = activationMode.deferredTriggers
    .map((item) => `- ${item.name}: ${item.reason}`)
    .join("\n");
  const reasons = activationMode.supportedTrigger.reasons.map((reason) => `- ${reason}`).join("\n");
  const blockedReasons = activationMode.blockedReasons.length > 0
    ? activationMode.blockedReasons.map((reason) => `- ${reason}`).join("\n")
    : "- none";

  return `# React Web activation mode\n\n${activationMode.claimBoundary}\n\n## Summary\n\n- artifact id: ${activationMode.artifactId}\n- file: ${activationMode.filePath}\n- mode: ${activationMode.mode}\n- verdict: ${activationMode.verdict}\n- runtime decision: ${activationMode.runtimeDecision}\n- evidence strength: ${activationMode.evidenceStrength}\n- repeated-file positive: ${activationMode.supportedTrigger.positive ? "yes" : "no"}\n\n## Supported trigger\n\n- ${activationMode.supportedTrigger.name}\n${reasons}\n\n## Deferred triggers\n\n${deferred}\n\n## Blocked reasons\n\n${blockedReasons}\n`;
}
