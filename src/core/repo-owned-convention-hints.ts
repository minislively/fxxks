export const REPO_OWNED_CONVENTION_HINTS_SCHEMA_VERSION = "repo-owned-convention-hints.prototype.v1" as const;
export const REPO_OWNED_CONVENTION_HINTS_CLAIM_BOUNDARY =
  "Internal fixture-backed convention-hints prototype only: advisory report context, no public config contract, no CI enforcement, no edit authority, and no broad semantic inference." as const;

type RepoOwnedConventionHintProfile = "react-web";
type RepoOwnedConventionHintConfidence = "high" | "medium" | "low";

type RepoOwnedConventionHintAppliesTo = {
  profile: RepoOwnedConventionHintProfile;
  issueKinds: string[];
  elements?: string[];
  filePatterns?: string[];
};

export type RepoOwnedConventionHint = {
  id: string;
  purpose: "convention-hint";
  source: "internal-prototype-fixture";
  advisoryOnly: true;
  enforcement: "none";
  publicConfig: false;
  appliesTo: RepoOwnedConventionHintAppliesTo;
  confidence: RepoOwnedConventionHintConfidence;
  summary: string;
  inspectFirst: string[];
  policyBoundary: string;
  excludedInference: string[];
};

export type RepoOwnedConventionHintsManifest = {
  schemaVersion: typeof REPO_OWNED_CONVENTION_HINTS_SCHEMA_VERSION;
  claimBoundary: typeof REPO_OWNED_CONVENTION_HINTS_CLAIM_BOUNDARY;
  hints: RepoOwnedConventionHint[];
};

export type RepoOwnedConventionHintMatchInput = {
  profile: RepoOwnedConventionHintProfile;
  issueKind: string;
  element: string;
  filePath: string;
};

export type RepoOwnedConventionHintProjection = {
  id: string;
  summary: string;
  inspectFirst: string[];
  confidence: RepoOwnedConventionHintConfidence;
  policyBoundary: string;
  excludedInference: string[];
  advisoryOnly: true;
  enforcement: "none";
  source: "internal-prototype-fixture";
};

const UNSAFE_HINT_WORDING = /\b(?:must-edit|auto-apply|ci gate|merge gate|public config contract)\b/i;

export const REPO_OWNED_CONVENTION_HINTS_PROTOTYPE: RepoOwnedConventionHintsManifest = {
  schemaVersion: REPO_OWNED_CONVENTION_HINTS_SCHEMA_VERSION,
  claimBoundary: REPO_OWNED_CONVENTION_HINTS_CLAIM_BOUNDARY,
  hints: [
    {
      id: "react-web.native-label-context",
      purpose: "convention-hint",
      source: "internal-prototype-fixture",
      advisoryOnly: true,
      enforcement: "none",
      publicConfig: false,
      appliesTo: {
        profile: "react-web",
        issueKinds: [
          "react-web.missing-accessible-label",
          "react-web.ambiguous-accessible-label",
          "react-web.unassociated-nearby-label",
        ],
        elements: ["button", "input", "select", "textarea"],
        filePatterns: ["*.tsx", "*.jsx"],
      },
      confidence: "medium",
      summary:
        "Prefer existing visible label, nearby native label/control structure, or source-observed naming hints before choosing final accessible-name copy.",
      inspectFirst: [
        "Inspect same-file JSX around the native control before using broader conventions.",
        "Use local related-context entries as evidence hints only; final label/name decisions stay human-reviewed.",
      ],
      policyBoundary:
        "Advisory convention hint only; it does not enforce team policy, authorize edits, or infer custom-component semantics.",
      excludedInference: [
        "Does not create a public repo config contract.",
        "Does not enforce CI or merge policy.",
        "Does not authorize edits or generated accessible-name copy.",
      ],
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid convention hint manifest: ${label} must be a non-empty string`);
  }
  if (UNSAFE_HINT_WORDING.test(value)) {
    throw new Error(`Invalid convention hint manifest: ${label} contains enforcement or apply-authority wording`);
  }
  return value;
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid convention hint manifest: ${label} must be a non-empty string array`);
  }
  return value.map((item, index) => assertString(item, `${label}[${index}]`));
}

function assertLiteral<T extends string | boolean>(value: unknown, expected: T, label: string): T {
  if (value !== expected) {
    throw new Error(`Invalid convention hint manifest: ${label} must be ${String(expected)}`);
  }
  return expected;
}

function parseHint(value: unknown, index: number): RepoOwnedConventionHint {
  if (!isRecord(value)) throw new Error(`Invalid convention hint manifest: hints[${index}] must be an object`);
  const appliesTo = value.appliesTo;
  if (!isRecord(appliesTo)) throw new Error(`Invalid convention hint manifest: hints[${index}].appliesTo must be an object`);
  const profile = assertString(appliesTo.profile, `hints[${index}].appliesTo.profile`);
  if (profile !== "react-web") throw new Error(`Invalid convention hint manifest: hints[${index}].appliesTo.profile is unsupported`);
  const confidence = assertString(value.confidence, `hints[${index}].confidence`);
  if (!(["high", "medium", "low"] as string[]).includes(confidence)) {
    throw new Error(`Invalid convention hint manifest: hints[${index}].confidence is unsupported`);
  }
  const hint: RepoOwnedConventionHint = {
    id: assertString(value.id, `hints[${index}].id`),
    purpose: assertLiteral(value.purpose, "convention-hint", `hints[${index}].purpose`),
    source: assertLiteral(value.source, "internal-prototype-fixture", `hints[${index}].source`),
    advisoryOnly: assertLiteral(value.advisoryOnly, true, `hints[${index}].advisoryOnly`),
    enforcement: assertLiteral(value.enforcement, "none", `hints[${index}].enforcement`),
    publicConfig: assertLiteral(value.publicConfig, false, `hints[${index}].publicConfig`),
    appliesTo: {
      profile,
      issueKinds: assertStringArray(appliesTo.issueKinds, `hints[${index}].appliesTo.issueKinds`),
      ...(appliesTo.elements === undefined ? {} : { elements: assertStringArray(appliesTo.elements, `hints[${index}].appliesTo.elements`) }),
      ...(appliesTo.filePatterns === undefined ? {} : { filePatterns: assertStringArray(appliesTo.filePatterns, `hints[${index}].appliesTo.filePatterns`) }),
    },
    confidence: confidence as RepoOwnedConventionHintConfidence,
    summary: assertString(value.summary, `hints[${index}].summary`),
    inspectFirst: assertStringArray(value.inspectFirst, `hints[${index}].inspectFirst`),
    policyBoundary: assertString(value.policyBoundary, `hints[${index}].policyBoundary`),
    excludedInference: assertStringArray(value.excludedInference, `hints[${index}].excludedInference`),
  };
  return hint;
}

export function parseRepoOwnedConventionHintsManifest(value: unknown): RepoOwnedConventionHintsManifest {
  if (!isRecord(value)) throw new Error("Invalid convention hint manifest: root must be an object");
  if (value.schemaVersion !== REPO_OWNED_CONVENTION_HINTS_SCHEMA_VERSION) {
    throw new Error("Invalid convention hint manifest: unsupported schemaVersion");
  }
  if (value.claimBoundary !== REPO_OWNED_CONVENTION_HINTS_CLAIM_BOUNDARY) {
    throw new Error("Invalid convention hint manifest: claimBoundary must match the prototype boundary");
  }
  if (!Array.isArray(value.hints)) throw new Error("Invalid convention hint manifest: hints must be an array");
  return {
    schemaVersion: REPO_OWNED_CONVENTION_HINTS_SCHEMA_VERSION,
    claimBoundary: REPO_OWNED_CONVENTION_HINTS_CLAIM_BOUNDARY,
    hints: value.hints.map(parseHint),
  };
}

function filePatternMatches(filePath: string, pattern: string): boolean {
  if (pattern === "*.tsx") return filePath.endsWith(".tsx");
  if (pattern === "*.jsx") return filePath.endsWith(".jsx");
  return filePath.includes(pattern.replaceAll("*", ""));
}

function hintMatches(hint: RepoOwnedConventionHint, input: RepoOwnedConventionHintMatchInput): boolean {
  if (hint.appliesTo.profile !== input.profile) return false;
  if (!hint.appliesTo.issueKinds.includes(input.issueKind)) return false;
  if (hint.appliesTo.elements && !hint.appliesTo.elements.includes(input.element)) return false;
  if (hint.appliesTo.filePatterns && !hint.appliesTo.filePatterns.some((pattern) => filePatternMatches(input.filePath, pattern))) return false;
  return true;
}

export function findRepoOwnedConventionHintsForIssue(
  input: RepoOwnedConventionHintMatchInput,
  manifest: RepoOwnedConventionHintsManifest = REPO_OWNED_CONVENTION_HINTS_PROTOTYPE,
): RepoOwnedConventionHintProjection[] {
  const parsed = parseRepoOwnedConventionHintsManifest(manifest);
  return parsed.hints
    .filter((hint) => hintMatches(hint, input))
    .map((hint) => ({
      id: hint.id,
      summary: hint.summary,
      inspectFirst: [...hint.inspectFirst],
      confidence: hint.confidence,
      policyBoundary: hint.policyBoundary,
      excludedInference: [...hint.excludedInference],
      advisoryOnly: hint.advisoryOnly,
      enforcement: hint.enforcement,
      source: hint.source,
    }));
}
