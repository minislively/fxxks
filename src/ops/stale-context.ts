export const STALE_CONTEXT_SCHEMA_VERSION = 1;
export const STALE_CONTEXT_COMMAND = "stale-context";
export const STALE_CONTEXT_RESEARCH_REFERENCE = "docs/research/context-trust-and-stale-evidence-research.md";
export const STALE_CONTEXT_CLAIM_BOUNDARY =
  "Deterministic local prompt/handoff text audit only; does not query GitHub, CI, tmux, git remotes, provider runtimes, or validate whether referenced issues/PRs/branches are truly open or closed. Warnings classify lexical stale-context risk and tell agents what evidence to re-check before treating text as current authority.";

export type StaleContextSeverity = "hard-conflict" | "advisory-suspect";
export type StaleContextAuthority = "must-not-use-as-current" | "advisory-only";
export type StaleContextFreshness = "stale" | "unknown";
export type StaleContextWarningKind =
  | "closed-artifact-as-active"
  | "receipt-as-active-work"
  | "historical-doc-as-current-policy"
  | "branch-or-worktree-without-current-evidence"
  | "context-hint-authority-escalation"
  | "previous-session-without-source-validation";

export type StaleContextEvidence = {
  text: string;
  line: number;
  startColumn: number;
  endColumn: number;
};

export type StaleContextWarning = {
  id: string;
  severity: StaleContextSeverity;
  kind: StaleContextWarningKind;
  authority: StaleContextAuthority;
  freshness: StaleContextFreshness;
  reason: string;
  evidence: StaleContextEvidence;
  recommendation: string;
};

export type StaleContextAuditResult = {
  schemaVersion: typeof STALE_CONTEXT_SCHEMA_VERSION;
  command: typeof STALE_CONTEXT_COMMAND;
  source: string;
  mode: "deterministic-local-text-audit";
  researchReference: typeof STALE_CONTEXT_RESEARCH_REFERENCE;
  claimBoundary: typeof STALE_CONTEXT_CLAIM_BOUNDARY;
  summary: {
    warningCount: number;
    hardConflictCount: number;
    advisorySuspectCount: number;
    requiresCurrentEvidenceRecheck: boolean;
  };
  warnings: StaleContextWarning[];
  limitations: string[];
};

type Rule = {
  kind: StaleContextWarningKind;
  severity: StaleContextSeverity;
  authority: StaleContextAuthority;
  freshness: StaleContextFreshness;
  reason: string;
  recommendation: string;
  test: (line: string) => boolean;
};

const ACTIVE_AUTHORITY_RE = /\b(active|current|continue|resume|target|source of truth|authoritative|use as current|next work|next development|must use|should use)\b/i;
const CLOSED_ARTIFACT_RE = /\b(closed|merged|done|completed|resolved|archived)\b[^\n#]*(?:\b(?:pr|pull request|issue)\b\s*)?#\d+|(?:\b(?:pr|pull request|issue)\b\s*)?#\d+[^\n]*(?:\b(closed|merged|done|completed|resolved|archived)\b)/i;
const RECEIPT_RE = /\b(receipt|green receipt|ci (?:passed|success|green)|release success|post-merge|merged commit|main ci)\b/i;
const ARCHIVE_DOC_RE = /\b(?:docs\/[^\s]*archive[^\s]*|archive doc|archived doc|branch archive|historical doc)\b/i;
const BRANCH_OR_WORKTREE_RE = /\b(?:worktree|worktrees|branch)\b[^\n]*(?:fooks[-_/][\w./-]+|issue[-_/]?\d+|pr[-_/]?\d+|\/[^\s]*worktrees?\/[^\s]+)/i;
const CURRENT_EVIDENCE_RE = /\b(?:current evidence|checked now|live evidence|open issue|open pr|open pull request|git status|current source|source recheck|verified now)\b/i;
const CONTEXT_HINT_RE = /\bcontext hints?\b/i;
const AUTHORITY_ESCALATION_RE = /\b(?:change|override|grant|set|force|promote)\b[^\n]*(?:ranking|priority|authority|apply|copy|edit authority|source evidence)/i;
const PREVIOUS_SESSION_RE = /\b(previous session|session summary|handoff summary|old handoff|prior run|prior context)\b/i;
const SOURCE_VALIDATION_RE = /\b(?:current source|source validation|source recheck|verified against source|git diff|fresh evidence)\b/i;

const RULES: Rule[] = [
  {
    kind: "closed-artifact-as-active",
    severity: "hard-conflict",
    authority: "must-not-use-as-current",
    freshness: "stale",
    reason: "The same line presents a closed/merged issue or PR reference with active/current-work language.",
    recommendation: "Do not treat the referenced closed/merged artifact as an active target; re-check the current open issue/PR, branch, and source before editing.",
    test: (line) => CLOSED_ARTIFACT_RE.test(line) && ACTIVE_AUTHORITY_RE.test(line),
  },
  {
    kind: "receipt-as-active-work",
    severity: "hard-conflict",
    authority: "must-not-use-as-current",
    freshness: "stale",
    reason: "Completion or CI receipt language is being presented as current active-work authority.",
    recommendation: "Treat receipts as historical evidence only; require a fresh active issue, PR, branch, session, or source diff anchor.",
    test: (line) => RECEIPT_RE.test(line) && ACTIVE_AUTHORITY_RE.test(line),
  },
  {
    kind: "historical-doc-as-current-policy",
    severity: "hard-conflict",
    authority: "must-not-use-as-current",
    freshness: "stale",
    reason: "Archive or historical documentation is being presented as current policy/authority.",
    recommendation: "Use the archive only for background; check current docs and source before following it as policy.",
    test: (line) => ARCHIVE_DOC_RE.test(line) && ACTIVE_AUTHORITY_RE.test(line),
  },
  {
    kind: "branch-or-worktree-without-current-evidence",
    severity: "advisory-suspect",
    authority: "advisory-only",
    freshness: "unknown",
    reason: "A branch/worktree reference appears without lexical current-evidence proof on the same line.",
    recommendation: "Re-check git status/worktree state and active issue/PR evidence before using this as current context.",
    test: (line) => BRANCH_OR_WORKTREE_RE.test(line) && !CURRENT_EVIDENCE_RE.test(line),
  },
  {
    kind: "context-hint-authority-escalation",
    severity: "hard-conflict",
    authority: "must-not-use-as-current",
    freshness: "stale",
    reason: "Context hints are advisory and must not alter ranking, priority, source authority, or apply/edit permission.",
    recommendation: "Keep context hints advisory-only; source-derived evidence and explicit current artifacts win on conflicts.",
    test: (line) => CONTEXT_HINT_RE.test(line) && AUTHORITY_ESCALATION_RE.test(line),
  },
  {
    kind: "previous-session-without-source-validation",
    severity: "advisory-suspect",
    authority: "advisory-only",
    freshness: "unknown",
    reason: "Prior-session or handoff summary text appears without current source validation evidence.",
    recommendation: "Use the summary only as a lead; re-read current source/diff before making or planning edits.",
    test: (line) => PREVIOUS_SESSION_RE.test(line) && !SOURCE_VALIDATION_RE.test(line),
  },
];

function compactLine(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

function evidenceFor(line: string, lineNumber: number): StaleContextEvidence {
  const compact = compactLine(line);
  const originalStart = line.search(/\S/);
  return {
    text: compact.length > 240 ? `${compact.slice(0, 237)}...` : compact,
    line: lineNumber,
    startColumn: originalStart >= 0 ? originalStart + 1 : 1,
    endColumn: line.length + 1,
  };
}

export function auditStaleContextText(text: string, options: { source?: string } = {}): StaleContextAuditResult {
  const warnings: StaleContextWarning[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    for (const rule of RULES) {
      if (!rule.test(line)) continue;
      warnings.push({
        id: `stale-context-${String(warnings.length + 1).padStart(3, "0")}`,
        severity: rule.severity,
        kind: rule.kind,
        authority: rule.authority,
        freshness: rule.freshness,
        reason: rule.reason,
        evidence: evidenceFor(line, index + 1),
        recommendation: rule.recommendation,
      });
    }
  }

  const hardConflictCount = warnings.filter((warning) => warning.severity === "hard-conflict").length;
  const advisorySuspectCount = warnings.filter((warning) => warning.severity === "advisory-suspect").length;
  return {
    schemaVersion: STALE_CONTEXT_SCHEMA_VERSION,
    command: STALE_CONTEXT_COMMAND,
    source: options.source ?? "inline-text",
    mode: "deterministic-local-text-audit",
    researchReference: STALE_CONTEXT_RESEARCH_REFERENCE,
    claimBoundary: STALE_CONTEXT_CLAIM_BOUNDARY,
    summary: {
      warningCount: warnings.length,
      hardConflictCount,
      advisorySuspectCount,
      requiresCurrentEvidenceRecheck: warnings.length > 0,
    },
    warnings,
    limitations: [
      "No network checks: issue/PR open/closed state is inferred only from the supplied text.",
      "No git/tmux/filesystem checks: branch, worktree, run, and session freshness must be verified separately.",
      "Line-local heuristic: multi-line context can require human/operator review.",
    ],
  };
}

export function renderStaleContextAuditText(result: StaleContextAuditResult): string {
  const lines = [
    `fooks stale-context: ${result.summary.warningCount === 0 ? "no warnings" : `${result.summary.warningCount} warning(s)`}`,
    `Source: ${result.source}`,
    `Hard conflicts: ${result.summary.hardConflictCount}`,
    `Advisory/suspect: ${result.summary.advisorySuspectCount}`,
  ];

  if (result.warnings.length > 0) {
    lines.push("", "Warnings");
    for (const warning of result.warnings) {
      lines.push(
        `- [${warning.severity}] ${warning.kind} at line ${warning.evidence.line}`,
        `  evidence: ${warning.evidence.text}`,
        `  reason: ${warning.reason}`,
        `  next: ${warning.recommendation}`,
      );
    }
  }

  lines.push("", `Boundary: ${result.claimBoundary}`);
  return `${lines.join("\n")}\n`;
}
