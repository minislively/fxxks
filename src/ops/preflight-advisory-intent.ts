export type PreflightAdvisoryCategory =
  | "implementation"
  | "debugging"
  | "test"
  | "review-pr"
  | "continuation"
  | "question"
  | "research"
  | "unknown";

export type PreflightAdvisoryConfidence = "low" | "medium" | "high";

export type PreflightAdvisoryRuntimeSignals = {
  hasActiveWorkflow?: boolean;
  hasActiveSession?: boolean;
  hasCurrentAuthority?: boolean;
  hasRepoAnchor?: boolean;
  hasFilePath?: boolean;
  hasIssueOrPrReference?: boolean;
  hasTestCommand?: boolean;
  hasStackTraceOrError?: boolean;
};

export type PreflightAdvisoryDecision = {
  shouldAttach: boolean;
  confidence: PreflightAdvisoryConfidence;
  category: PreflightAdvisoryCategory;
  score: number;
  reasons: string[];
  skipReasons: string[];
};

export type PreflightAdvisoryIntentInput = {
  prompt: string;
  runtime?: PreflightAdvisoryRuntimeSignals;
};

const ATTACH_THRESHOLD = 3;

const EXPLICIT_OPT_OUT_PATTERN = /(?:#fooks-no-preflight|\bno\s+preflight\b|\bplain\s+answer\b|\bjust\s+answer\b|그냥\s*답|답변만|설명만|리서치만)/iu;
const EXPLICIT_OPT_IN_PATTERN = /(?:#fooks-preflight|\bfooks\s+preflight\b|context\s*trust|contextTrust|source\s*of\s*truth|sourceOfTruth|source-of-truth)/iu;
const FILE_PATH_PATTERN = /(?:^|\s)(?:[\w.-]+\/)+[\w.@-]+\.(?:[cm]?[jt]sx?|mjs|json|md|yml|yaml|css|scss)(?:\b|$)/iu;
const ISSUE_OR_PR_PATTERN = /(?:#\d+\b|\b(?:issue|issues|pr|pull\s+request)\s*#?\d+\b)/iu;
const TEST_COMMAND_PATTERN = /(?:\bnpm\s+(?:run\s+)?test\b|\bnode\s+--test\b|\bpytest\b|\bvitest\b|\bjest\b|테스트)/iu;
const STACK_OR_ERROR_PATTERN = /(?:\b(?:typeerror|referenceerror|syntaxerror|stack\s+trace|traceback|failed|failure|exception|error)\b|에러|오류|실패|스택|이상한데)/iu;
const REVIEW_PR_PATTERN = /(?:\b(?:pr|pull\s+request|merge|push|release|review)\b|리뷰|머지|릴리즈|배포)/iu;
const DEBUG_PATTERN = /(?:\b(?:debug|debugging|fix|failure|failed|error|exception|traceback)\b|디버깅|고쳐|오류|에러|실패|이상한데)/iu;
const TEST_PATTERN = /(?:\b(?:test|tests|failing\s+test|coverage)\b|테스트)/iu;
const IMPLEMENT_PATTERN = /(?:\b(?:implement|update|change|add|remove|refactor|patch|modify|rename|replace|adjust|simplify|rewrite|build)\b|구현|수정|변경|추가|삭제|리팩토링|작업|진행)/iu;
const CONTINUATION_PATTERN = /^(?:\s*(?:ㄱㄱ|고고|continue|계속|마저|아까\s*거\s*마저|저거\s*마저|이어|진행|진행해줘|그렇게\s*진행|오케\s*진행|ㅇㅋ\s*진행)\s*)$/iu;
const RESEARCH_PATTERN = /(?:\b(?:research|compare|comparison|case\s+study|best\s+practice)\b|리서치|조사|비교|사례|자료\s*조사)/iu;
const QUESTION_PATTERN = /(?:\?|\b(?:what|why|how|explain|tell\s+me|strategy)\b|뭐야|왜|어떻게|알려줘|설명|정리해줘|전략)/iu;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hasRuntimeAnchor(runtime: PreflightAdvisoryRuntimeSignals | undefined): boolean {
  return Boolean(runtime?.hasActiveWorkflow || runtime?.hasActiveSession || runtime?.hasCurrentAuthority);
}

function hasPromptRepoAnchor(prompt: string): boolean {
  return FILE_PATH_PATTERN.test(prompt) || ISSUE_OR_PR_PATTERN.test(prompt) || TEST_COMMAND_PATTERN.test(prompt) || STACK_OR_ERROR_PATTERN.test(prompt);
}

function hasRuntimeRepoAnchor(runtime: PreflightAdvisoryRuntimeSignals | undefined): boolean {
  return Boolean(
    runtime?.hasRepoAnchor ||
      runtime?.hasFilePath ||
      runtime?.hasIssueOrPrReference ||
      runtime?.hasTestCommand ||
      runtime?.hasStackTraceOrError,
  );
}

function categoryFor(prompt: string): PreflightAdvisoryCategory {
  if (CONTINUATION_PATTERN.test(prompt)) return "continuation";
  if (REVIEW_PR_PATTERN.test(prompt)) return "review-pr";
  if (TEST_PATTERN.test(prompt) || TEST_COMMAND_PATTERN.test(prompt)) return "test";
  if (DEBUG_PATTERN.test(prompt) || STACK_OR_ERROR_PATTERN.test(prompt)) return "debugging";
  if (QUESTION_PATTERN.test(prompt) && !FILE_PATH_PATTERN.test(prompt) && !ISSUE_OR_PR_PATTERN.test(prompt)) return "question";
  if (IMPLEMENT_PATTERN.test(prompt)) return "implementation";
  if (RESEARCH_PATTERN.test(prompt)) return "research";
  if (QUESTION_PATTERN.test(prompt)) return "question";
  return "unknown";
}

function confidenceFor(shouldAttach: boolean, score: number, hardDecision: boolean): PreflightAdvisoryConfidence {
  if (hardDecision) return "high";
  if (shouldAttach && score >= 4) return "high";
  if (shouldAttach) return "medium";
  if (score <= 0) return "high";
  return "medium";
}

function attachDecision(category: PreflightAdvisoryCategory, score: number, reasons: string[], hardDecision = false): PreflightAdvisoryDecision {
  return {
    shouldAttach: true,
    confidence: confidenceFor(true, score, hardDecision),
    category,
    score,
    reasons: unique(reasons),
    skipReasons: [],
  };
}

function skipDecision(
  category: PreflightAdvisoryCategory,
  score: number,
  reasons: string[],
  skipReasons: string[],
  hardDecision = false,
): PreflightAdvisoryDecision {
  return {
    shouldAttach: false,
    confidence: confidenceFor(false, score, hardDecision),
    category,
    score,
    reasons: unique(reasons),
    skipReasons: unique(skipReasons),
  };
}

export function decidePreflightAdvisoryIntent(input: PreflightAdvisoryIntentInput): PreflightAdvisoryDecision {
  const prompt = input.prompt.trim();
  const runtime = input.runtime;
  if (!prompt) return skipDecision("unknown", 0, [], ["empty-prompt"], true);

  const category = categoryFor(prompt);
  if (EXPLICIT_OPT_OUT_PATTERN.test(prompt)) {
    return skipDecision(category, 0, [], ["explicit-opt-out"], true);
  }

  if (EXPLICIT_OPT_IN_PATTERN.test(prompt)) {
    return attachDecision(category === "unknown" ? "implementation" : category, ATTACH_THRESHOLD + 1, ["explicit-opt-in"], true);
  }

  const reasons: string[] = [];
  const skipReasons: string[] = [];
  let score = 0;

  const promptRepoAnchor = hasPromptRepoAnchor(prompt);
  const runtimeRepoAnchor = hasRuntimeRepoAnchor(runtime);
  const runtimeAnchor = hasRuntimeAnchor(runtime);
  const repoAnchor = promptRepoAnchor || runtimeRepoAnchor;

  if (promptRepoAnchor) {
    score += 2;
    reasons.push("repo-anchor");
  }
  if (runtimeRepoAnchor) {
    score += 1;
    reasons.push("runtime-repo-anchor");
  }
  if (runtimeAnchor) {
    score += 1;
    reasons.push("active-runtime-anchor");
  }

  if (category === "continuation") {
    if (!runtimeAnchor) return skipDecision(category, score, reasons, ["continuation-without-active-anchor"]);
    score = Math.max(score + 2, ATTACH_THRESHOLD);
    reasons.push("continuation-with-active-anchor");
    return attachDecision(category, score, reasons);
  }

  const isWorkCategory = category === "implementation" || category === "debugging" || category === "test" || category === "review-pr";
  if (isWorkCategory) {
    score += 2;
    reasons.push(`work-intent:${category}`);
  }

  if ((category === "question" || category === "research") && !repoAnchor && !runtimeAnchor) {
    skipReasons.push(category === "research" ? "research-without-work-anchor" : "pure-question");
  }

  if (isWorkCategory && !repoAnchor && !runtimeAnchor) {
    skipReasons.push("work-intent-without-anchor");
  }

  const shouldAttach = score >= ATTACH_THRESHOLD && skipReasons.length === 0;
  if (!shouldAttach && skipReasons.length === 0) skipReasons.push("score-below-threshold");

  return shouldAttach
    ? attachDecision(category, score, reasons)
    : skipDecision(category, score, reasons, skipReasons);
}
