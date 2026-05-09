import fs from "node:fs";
import path from "node:path";
import { hashText } from "./hash";
import type { CodexRuntimeHookDecision, SourceFingerprint } from "./schema";
import {
  buildReactWebEvidenceArtifact,
  type ReactWebEvidenceArtifact,
  readReactWebEvidenceArtifact,
} from "./react-web-evidence-artifact";

export const REACT_WEB_ACTIVATION_MODE_SCHEMA_VERSION = "react-web-activation-mode.v1";
export const REACT_WEB_ACTIVATION_MODE_COMMAND = "inspect activation-mode";
export const REACT_WEB_ACTIVATION_MODE_MODE = "repeated-file-runtime+profile-gate-runtime+glob-match-advisory";
export const REACT_WEB_ACTIVATION_MODE_CLAIM_BOUNDARY =
  "Local React Web activation contract only: reports when bounded repeated-file React Web evidence qualifies for activation, when the bounded profile-gate policy qualifies for runtime promotion, and when the bounded glob-match trigger would activate in advisory mode. This surface does not widen support claims, does not enable always-on or model-driven activation, does not promote triggers beyond the bounded Codex React Web lane, and does not promote RN/TUI/WebView or generic context-manager behavior.";

export const REACT_WEB_ACTIVATION_SUPPORTED_TRIGGER = "repeated-file";
export const REACT_WEB_ACTIVATION_PROFILE_GATE_TRIGGER = "profile-gate";
export const REACT_WEB_ACTIVATION_GLOB_MATCH_TRIGGER = "glob-match";
export const REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS = [
  "always-on",
  "model-decision",
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
  profileGate: {
    name: typeof REACT_WEB_ACTIVATION_PROFILE_GATE_TRIGGER;
    verdict: ReactWebActivationVerdict;
    reasons: string[];
  };
  globMatch: {
    name: typeof REACT_WEB_ACTIVATION_GLOB_MATCH_TRIGGER;
    verdict: ReactWebActivationVerdict;
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
  profileGateVerdict: ReactWebActivationVerdict | "unavailable";
  profileGateReasons: string[];
  globMatchVerdict: ReactWebActivationVerdict | "unavailable";
  globMatchReasons: string[];
  deferredTriggers: ReactWebActivationDeferredTrigger[];
  blockedReasons: string[];
};

function profileGatePromotable(activationMode: {
  profileGate: { verdict: ReactWebActivationVerdict };
}): boolean {
  return activationMode.profileGate.verdict === "would-activate";
}

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
    Boolean(artifact.sourceFingerprint) &&
    sourceFingerprintsEqual(artifact.sourceFingerprint, current)
  );
}

function globMatchableFilePath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === ".tsx" || extension === ".jsx";
}

function profileGateReasons(cwd: string, artifact: ReactWebEvidenceArtifact): string[] {
  const reasons: string[] = [];
  if (artifact.domainPayload?.domain === "react-web") {
    reasons.push("react-web-domain-payload-present");
  } else {
    reasons.push("missing-react-web-domain-payload");
  }
  if (artifact.domainPayload?.claimStatus === "current-supported-lane") {
    reasons.push("current-supported-lane-claim");
  } else {
    reasons.push("non-current-supported-lane-claim");
  }
  if (artifact.domainPayload?.plannerDecision === "compact-safe") {
    reasons.push("planner-decision-compact-safe");
  } else {
    reasons.push("planner-decision-not-compact-safe");
  }
  if (artifact.evidenceStrength === "direct") {
    reasons.push("direct-evidence-strength");
  } else {
    reasons.push(`evidence-strength-${artifact.evidenceStrength}`);
  }
  if (artifact.sourceFingerprint) {
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
  if (artifact.files.some((file) => file.whySelected.some((reason) => reason === "exact-file-prompt-target" || reason === "exact-file-runtime-target"))) {
    reasons.push("direct-file-evidence-present");
  } else {
    reasons.push("missing-direct-file-evidence");
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

function profileGateVerdict(cwd: string, artifact: ReactWebEvidenceArtifact): {
  verdict: ReactWebActivationVerdict;
  reasons: string[];
} {
  const reasons = profileGateReasons(cwd, artifact);
  const blockedReasons = blockedReasonsFor(artifact);
  if (blockedReasons.length > 0 || artifact.decision === "deny") {
    return { verdict: "blocked", reasons };
  }

  const current = artifact.sourceFingerprint ? currentSourceFingerprint(path.resolve(cwd, artifact.filePath)) : null;
  const wouldActivate =
    artifact.decision === "use" &&
    artifact.domainPayload?.domain === "react-web" &&
    artifact.domainPayload?.claimStatus === "current-supported-lane" &&
    artifact.domainPayload?.plannerDecision === "compact-safe" &&
    artifact.evidenceStrength === "direct" &&
    artifact.files.some((file) => file.whySelected.some((reason) => reason === "exact-file-prompt-target" || reason === "exact-file-runtime-target")) &&
    sourceFingerprintsEqual(artifact.sourceFingerprint, current);

  return {
    verdict: wouldActivate ? "would-activate" : "deferred",
    reasons,
  };
}

function globMatchReasons(cwd: string, artifact: ReactWebEvidenceArtifact): string[] {
  const reasons: string[] = [];
  if (artifact.domainPayload?.domain === "react-web") {
    reasons.push("react-web-domain-payload-present");
  } else {
    reasons.push("missing-react-web-domain-payload");
  }
  if (artifact.domainPayload?.claimStatus === "current-supported-lane") {
    reasons.push("current-supported-lane-claim");
  } else {
    reasons.push("non-current-supported-lane-claim");
  }
  if (artifact.domainPayload?.plannerDecision === "compact-safe") {
    reasons.push("planner-decision-compact-safe");
  } else {
    reasons.push("planner-decision-not-compact-safe");
  }
  if (artifact.evidenceStrength === "direct") {
    reasons.push("direct-evidence-strength");
  } else {
    reasons.push(`evidence-strength-${artifact.evidenceStrength}`);
  }
  if (globMatchableFilePath(artifact.filePath)) {
    reasons.push("file-path-glob-react-extension-match");
  } else {
    reasons.push("file-path-glob-no-react-extension-match");
  }
  if (artifact.sourceFingerprint) {
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

function globMatchVerdict(cwd: string, artifact: ReactWebEvidenceArtifact): {
  verdict: ReactWebActivationVerdict;
  reasons: string[];
} {
  const reasons = globMatchReasons(cwd, artifact);
  const blockedReasons = blockedReasonsFor(artifact);
  if (blockedReasons.length > 0 || artifact.decision === "deny") {
    return { verdict: "blocked", reasons };
  }

  const current = artifact.sourceFingerprint ? currentSourceFingerprint(path.resolve(cwd, artifact.filePath)) : null;
  const wouldActivate =
    artifact.decision === "use" &&
    artifact.domainPayload?.domain === "react-web" &&
    artifact.domainPayload?.claimStatus === "current-supported-lane" &&
    artifact.domainPayload?.plannerDecision === "compact-safe" &&
    artifact.evidenceStrength === "direct" &&
    globMatchableFilePath(artifact.filePath) &&
    sourceFingerprintsEqual(artifact.sourceFingerprint, current);

  return {
    verdict: wouldActivate ? "would-activate" : "deferred",
    reasons,
  };
}

export function buildReactWebActivationMode(cwd: string, artifact: ReactWebEvidenceArtifact): ReactWebActivationModeResult {
  const positive = repeatedFilePositive(cwd, artifact);
  const blockedReasons = blockedReasonsFor(artifact);
  const profileGate = profileGateVerdict(cwd, artifact);
  const globMatch = globMatchVerdict(cwd, artifact);
  const verdict: ReactWebActivationVerdict =
    blockedReasons.length > 0 || artifact.decision === "deny"
      ? "blocked"
      : profileGatePromotable({ profileGate })
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
    profileGate: {
      name: REACT_WEB_ACTIVATION_PROFILE_GATE_TRIGGER,
      verdict: profileGate.verdict,
      reasons: profileGate.reasons,
    },
    globMatch: {
      name: REACT_WEB_ACTIVATION_GLOB_MATCH_TRIGGER,
      verdict: globMatch.verdict,
      reasons: globMatch.reasons,
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

export function buildReactWebActivationModeFromRuntimeDecision(
  cwd: string,
  runtimeDecision: CodexRuntimeHookDecision,
): ReactWebActivationModeResult | null {
  const artifact = buildReactWebEvidenceArtifact(runtimeDecision);
  return artifact ? buildReactWebActivationMode(cwd, artifact) : null;
}

export function summarizeReactWebActivationMode(
  activationMode: ReactWebActivationModeResult | null,
): ReactWebActivationModeSummary {
  if (!activationMode) {
    return {
      available: false,
      verdict: "unavailable",
      repeatedFilePositive: false,
      profileGateVerdict: "unavailable",
      profileGateReasons: [],
      globMatchVerdict: "unavailable",
      globMatchReasons: [],
      deferredTriggers: [...REACT_WEB_ACTIVATION_DEFERRED_TRIGGERS],
      blockedReasons: [],
    };
  }

  return {
    available: true,
    verdict: activationMode.verdict,
    repeatedFilePositive: activationMode.supportedTrigger.positive,
    profileGateVerdict: activationMode.profileGate.verdict,
    profileGateReasons: activationMode.profileGate.reasons,
    globMatchVerdict: activationMode.globMatch.verdict,
    globMatchReasons: activationMode.globMatch.reasons,
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
  const profileGateReasons = activationMode.profileGate.reasons.map((reason) => `- ${reason}`).join("\n");
  const globMatchReasons = activationMode.globMatch.reasons.map((reason) => `- ${reason}`).join("\n");

  return `# React Web activation mode\n\n${activationMode.claimBoundary}\n\n## Summary\n\n- artifact id: ${activationMode.artifactId}\n- file: ${activationMode.filePath}\n- mode: ${activationMode.mode}\n- verdict: ${activationMode.verdict}\n- runtime decision: ${activationMode.runtimeDecision}\n- evidence strength: ${activationMode.evidenceStrength}\n- repeated-file positive: ${activationMode.supportedTrigger.positive ? "yes" : "no"}\n- profile-gate verdict: ${activationMode.profileGate.verdict}\n- glob-match advisory: ${activationMode.globMatch.verdict}\n\n## Supported trigger\n\n- ${activationMode.supportedTrigger.name}\n${reasons}\n\n## Profile-gate runtime gate\n\n- ${activationMode.profileGate.name}\n${profileGateReasons}\n\n## Glob-match advisory\n\n- ${activationMode.globMatch.name}\n${globMatchReasons}\n\n## Deferred triggers\n\n${deferred}\n\n## Blocked reasons\n\n${blockedReasons}\n`;
}
