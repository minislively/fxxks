import type { CombinedReliabilityWarning } from "./combined-reliability-warning";
import type { RuntimeTokenCostPlanningWarning } from "./runtime-token-cost-planning-warning";
import fs from "node:fs";
import path from "node:path";

export const SEQUENTIAL_PLANNING_HINT_SCHEMA_VERSION = 1;
export const SEQUENTIAL_PLANNING_HINT_ISSUE = "#982";
export const SEQUENTIAL_PLANNING_HINT_FOLLOWUP_ISSUE = "#1006";
export const SEQUENTIAL_PLANNING_HINT_SOURCE = "deterministic sequential planning advisory";
export const SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY =
  "Advisory sequential-planning hint only for issues #982/#1006 under epic #960; does not prove provider billing/runtime token usage, change provider/runtime hooks, block execution, grant autonomous execution or merge authority, alter merge-gate policy, expand runtime/provider support, product claims, or frontend behavior.";

export type SequentialPlanningHintTrigger =
  | "branch-issue-982"
  | "linked-issue-982"
  | "branch-issue-1006"
  | "linked-issue-1006"
  | "prompt-implies-sequential-execution"
  | "run-label-implies-sequential-execution"
  | "combined-reliability-warning-present";

export type SequentialPlanningHintRecommendation =
  | "write-plan-before-execute"
  | "split-long-work-into-bounded-steps"
  | "checkpoint-or-compress-current-source-of-truth"
  | "handoff-before-burning-another-context-window";

export type SequentialPlanningHint = {
  schemaVersion: typeof SEQUENTIAL_PLANNING_HINT_SCHEMA_VERSION;
  issue: typeof SEQUENTIAL_PLANNING_HINT_ISSUE | typeof SEQUENTIAL_PLANNING_HINT_FOLLOWUP_ISSUE;
  status: "advisory";
  source: typeof SEQUENTIAL_PLANNING_HINT_SOURCE;
  trigger: SequentialPlanningHintTrigger;
  message: string;
  reasons: string[];
  recommendations: SequentialPlanningHintRecommendation[];
  requiredRechecks: string[];
  forbiddenClaims: string[];
  claimBoundary: typeof SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY;
  derivedFrom: {
    planningWarningCount: number;
    combinedReliabilityWarningCount: number;
    planningWarningsField: "planningWarnings";
    combinedReliabilityWarningsField: "combinedReliabilityWarnings";
    promptEvidence: "not-provided" | "sequential-intent" | "no-sequential-intent";
    runLabelEvidence: "not-provided" | "sequential-intent" | "no-sequential-intent";
  };
};

const SESSION_TASK_FILE = ".fooks-session-task.txt";
const EXPLICIT_SEQUENTIAL_PATTERN =
  /\b(?:sequential|sequence\s+of\s+steps|multi[-\s]?step|multi[-\s]?phase|phased\s+(?:work|execution|rollout|implementation)|step[-\s]?by[-\s]?step|several\s+steps|multiple\s+(?:steps|phases|passes|iterations))\b/iu;
const PHASE_MARKER_PATTERN =
  /\b(?:first|then|next|after(?:wards)?|finally|before\s+(?:pr|commit|merge|release)|phase\s*\d+|step\s*\d+|plan|implement|test|verify|build|commit|handoff)\b/giu;
const WORK_INTENT_PATTERN =
  /\b(?:implement|add|update|change|fix|debug|refactor|build|verify|test|commit|pr|merge|planning|coding\s+run|execution)\b|구현|수정|변경|추가|검증|테스트/iu;

function inferredIssueNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:^|[-_/])(?:issue|issues|gh)[-_/]?(\d+)(?:\D|$)/iu) ?? value.match(/#(\d+)\b/u);
  if (!match) return undefined;
  const issue = Number(match[1]);
  return Number.isInteger(issue) && issue > 0 ? issue : undefined;
}

function normalizedEvidence(value: string | undefined): "not-provided" | "sequential-intent" | "no-sequential-intent" {
  if (!value?.trim()) return "not-provided";
  return impliesSequentialExecution(value) ? "sequential-intent" : "no-sequential-intent";
}

function impliesSequentialExecution(value: string | undefined): boolean {
  const text = value?.trim();
  if (!text) return false;
  if (!WORK_INTENT_PATTERN.test(text)) return false;
  if (EXPLICIT_SEQUENTIAL_PATTERN.test(text)) return true;
  const markers = [...text.matchAll(PHASE_MARKER_PATTERN)].map((match) => match[0].toLowerCase());
  return new Set(markers).size >= 3;
}

export function readSequentialPlanningPrompt(cwd: string): string | undefined {
  const promptPath = path.join(cwd, SESSION_TASK_FILE);
  try {
    if (!fs.existsSync(promptPath)) return undefined;
    const text = fs.readFileSync(promptPath, "utf8").trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

export function buildSequentialPlanningHints(input: {
  branch?: string;
  linkedIssueNumber?: number;
  prompt?: string;
  runLabel?: string;
  planningWarnings: RuntimeTokenCostPlanningWarning[];
  combinedReliabilityWarnings: CombinedReliabilityWarning[];
}): SequentialPlanningHint[] {
  const branchIssueNumber = inferredIssueNumber(input.branch);
  const runLabel = [input.runLabel, input.branch].filter(Boolean).join(" ");
  const promptEvidence = normalizedEvidence(input.prompt);
  const runLabelEvidence = normalizedEvidence(runLabel);
  const trigger: SequentialPlanningHintTrigger | undefined = input.linkedIssueNumber === 1006
    ? "linked-issue-1006"
    : input.linkedIssueNumber === 982
    ? "linked-issue-982"
    : branchIssueNumber === 1006
      ? "branch-issue-1006"
    : branchIssueNumber === 982
      ? "branch-issue-982"
      : promptEvidence === "sequential-intent"
        ? "prompt-implies-sequential-execution"
      : runLabelEvidence === "sequential-intent"
        ? "run-label-implies-sequential-execution"
      : input.combinedReliabilityWarnings.length > 0
        ? "combined-reliability-warning-present"
        : undefined;

  if (!trigger) return [];

  const issue = trigger === "branch-issue-1006"
    || trigger === "linked-issue-1006"
    || trigger === "prompt-implies-sequential-execution"
    || trigger === "run-label-implies-sequential-execution"
    ? SEQUENTIAL_PLANNING_HINT_FOLLOWUP_ISSUE
    : SEQUENTIAL_PLANNING_HINT_ISSUE;

  const reasons = trigger === "combined-reliability-warning-present"
    ? [
        "combined reliability warning already reports overlapping stale/context risk and runtime-planning risk",
        "long or sequential follow-up work should plan before executing to avoid context drift",
      ]
    : trigger === "prompt-implies-sequential-execution"
      ? [
          "current prompt implies sequential or multi-phase coding execution",
          "this hint is advisory only and must not block the run or change runtime/provider behavior",
        ]
    : trigger === "run-label-implies-sequential-execution"
      ? [
          "current run label or branch implies sequential or multi-phase coding execution",
          "this hint is advisory only and must not block the run or change runtime/provider behavior",
        ]
    : [
        `current branch or linked issue targets issue ${issue} sequential-planning hint work`,
        "next-agent handoff should include a deterministic plan-before-execute reminder for long or sequential runs",
      ];

  return [
    {
      schemaVersion: SEQUENTIAL_PLANNING_HINT_SCHEMA_VERSION,
      issue,
      status: "advisory",
      source: SEQUENTIAL_PLANNING_HINT_SOURCE,
      trigger,
      message:
        "Sequential or multi-phase coding run detected: write a bounded plan, split the work into verifiable steps, checkpoint current source-of-truth evidence, and hand off to a fresh agent when context quality is at risk.",
      reasons,
      recommendations: [
        "write-plan-before-execute",
        "split-long-work-into-bounded-steps",
        "checkpoint-or-compress-current-source-of-truth",
        "handoff-before-burning-another-context-window",
      ],
      requiredRechecks: [
        "Run fooks check --json to inspect current operator/check authority and warning surfaces.",
        "Run fooks preflight --json before deciding whether to continue, split, or stop.",
        "Run fooks handoff --json before compressing context or handing work to a fresh agent.",
        "Keep implementation authority tied to a current issue, PR, branch, session, or explicit blocker.",
      ],
      forbiddenClaims: [
        "provider usage/billing-token proof",
        "invoice/dashboard/charged-cost proof",
        "runtime-token savings proof",
        "autonomous execution authority",
        "merge authority or merge-gate policy change",
        "runtime/provider support expansion",
        "frontend runtime behavior change",
      ],
      claimBoundary: SEQUENTIAL_PLANNING_HINT_CLAIM_BOUNDARY,
      derivedFrom: {
        planningWarningCount: input.planningWarnings.length,
        combinedReliabilityWarningCount: input.combinedReliabilityWarnings.length,
        planningWarningsField: "planningWarnings",
        combinedReliabilityWarningsField: "combinedReliabilityWarnings",
        promptEvidence,
        runLabelEvidence,
      },
    },
  ];
}
