# Preflight advisory intent gate research — 2026-05-21

# Research report: better-than-keyword preflight advisory routing

Date: 2026-05-21
Mission slug: `research-better-than-keyword-methods-for-decidin`

## Research question

How should fooks decide when to attach a `preflight` / `contextTrust` advisory to Codex `UserPromptSubmit` prompts without turning the hook into a brittle keyword list?

Constraints from rubric:

- advisory only; no blocking gate in this phase
- no cleanup execution
- no issue/PR creation
- no stale detector or handoff generator
- no JSON schema change to existing `fooks check --json` / `preflight --json`
- preserve fooks claim boundary

## External evidence

### 1. Hook lifecycle is the right seam, but injection should be selective

Anthropic Claude Code documents `UserPromptSubmit` as running before the prompt is processed and explicitly supports adding `hookSpecificOutput.additionalContext`; `SessionStart` can load development context, and tool hooks such as `PreToolUse` / `PostToolUse` are separate lifecycle points. Source: https://docs.anthropic.com/en/docs/claude-code/hooks and https://code.claude.com/docs/en/hooks

Implication for fooks: `UserPromptSubmit` is appropriate for lightweight advisory context, but durable side-effect checks should eventually move closer to tool/action boundaries when Codex surfaces are stable. For this phase, do not pretend a prompt classifier fully guards writes.

### 2. Guardrail systems separate classification from execution

OpenAI Agents SDK guardrails describe input/output checks and tripwires, where a guardrail function returns structured output and can halt execution when triggered. Source: https://openai.github.io/openai-agents-js/guides/guardrails/ and https://openai.github.io/openai-agents-python/guardrails/

Implication for fooks: use a separate `PreflightAdvisoryDecision` builder rather than embedding ad-hoc conditions inside hook rendering. However, since this phase is advisory-only, the decision should attach/skip context, not block.

### 3. Router patterns classify input, but have cost/latency tradeoffs

LangChain's multi-agent docs define a Router pattern as a routing step that classifies input and directs it to specialized agents. The same docs stress context engineering: selectively surface relevant information instead of dumping everything. They also show routers are stateless and add model calls, while stateful patterns can reuse loaded context for repeated requests. Source: https://docs.langchain.com/oss/python/langchain/multi-agent/index

Implication for fooks: a model-based router for every prompt is likely overkill for an MVP. A deterministic/scoring gate is cheaper and easier to test. LLM routing can be reserved for ambiguous cases later.

### 4. Middleware/context engineering favors explicit runtime state and selective context

LangChain middleware is used to transform prompts, tool selection, add guardrails, trim/modify context, and process state before model calls. Source: https://docs.langchain.com/oss/python/langchain/middleware and https://docs.langchain.com/oss/python/langchain/context-engineering

Implication for fooks: model-facing context should be assembled from runtime state and a small decision layer. The strongest signals are not prompt words alone; they include session/workflow state, repo anchors, file/PR/issue references, and recent tool/action intent.

### 5. Semantic routing helps beyond keywords but requires thresholds/evals

Semantic Router style systems route by comparing a query to route utterances using embeddings and score thresholds; threshold tuning is needed to avoid incorrect routes. Source: https://semantic-router.readthedocs.io/en/stable/ and threshold discussion in project docs/deepwiki surfaces: https://deepwiki.com/aurelio-labs/semantic-router/7.2-threshold-optimization

Implication for fooks: embeddings can reduce multilingual/typo keyword brittleness, but they add a model/embedding dependency, threshold maintenance, and false-positive risk. This is a good phase-2 option only after fooks has a labeled prompt corpus and expected decisions.

### 6. Structured outputs make LLM classifiers safer, not free

OpenAI Structured Outputs guarantee model output conforms to a developer-provided JSON Schema when using strict schema mode on supported models; JSON mode alone does not guarantee a particular schema. Source: https://platform.openai.com/docs/guides/structured-outputs and https://openai.com/index/introducing-structured-outputs-in-the-api/

Implication for fooks: if fooks later adds an LLM classifier, it should use strict structured output plus validation and fail-closed-to-skip. But this should not be MVP because it adds latency/cost/provider dependency to every prompt.

### 7. Context/security guidance argues for minimization and provenance

MCP security best practices emphasize least privilege, precise scoping, avoiding overly broad capabilities, and logging/elevation clarity. OpenAI prompt injection guidance frames injected third-party context as a security risk and stresses distinguishing trusted from untrusted instructions. Sources: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices and https://openai.com/safety/prompt-injections/

Implication for fooks: automatic advisory injection should be compact, provenance-labeled, non-authorizing, and skip when irrelevant. It must not smuggle new instructions that override user intent or treat historical evidence as current authority.

## fooks local context

Relevant current repo surfaces:

- `src/adapters/codex-runtime-hook.ts`
  - `UserPromptSubmit` is the only current event that injects repeated-file pre-read context.
  - `renderAdditionalContext` / `buildAdditionalContext` build model-facing additionalContext.
  - Current edit intent is a simple regex: `EDIT_INTENT_PATTERN`.
  - Current pre-read reuse is narrow: first mention records, repeated same-file injects.
- `src/adapters/codex-native-hook.ts`
  - Converts native hook payload to `CodexRuntimeHookInput` and returns `hookSpecificOutput.additionalContext` only for inject/fallback.
- `src/ops/preflight.ts`
  - Current `preflight` packet/renderer is read-only projection over existing operator-check/contextTrust snapshot.
- `docs/research/automatic-preflight-and-instruction-trust.md`
  - Already reached the same architectural conclusion: prompt keyword triggers are weak and should be fallback-only; action/lifecycle/runtime-state triggers are better.

## Method comparison

| Method | Strength | Weakness | fooks fit |
|---|---|---|---|
| Pure keyword list | Simple, no dependency | Dirty over time; multilingual typos; false positives for explanations like “PR 전략 알려줘”; false negatives for “저거 ㄱㄱ” | Use only as weak fallback, not primary |
| Deterministic rule/scoring gate | Cheap, testable, transparent, no provider dependency | Needs careful signal design; may miss vague prompts | Best MVP |
| Embedding/semantic router | Handles paraphrase/typos/multilingual better than keywords | Dependency, threshold tuning, evaluation corpus required; false positives costly | Phase 2 after telemetry/evals |
| LLM classifier/router | Flexible; can use structured output | Cost/latency; provider dependency; classifier can be prompt-injected or over-eager | Phase 3 only for ambiguous cases, strict schema + validation |
| Runtime-context-aware gate | Uses session/workflow/repo evidence; less dependent on prompt wording | Requires clean state boundaries and no hidden side effects | Should be combined with deterministic scoring in MVP |

## Recommended MVP

Build a pure `PreflightAdvisoryDecision` scorer and a renderer hook, but do not wire blocking behavior.

Suggested type:

```ts
type PreflightAdvisoryCategory =
  | "implementation"
  | "debugging"
  | "test"
  | "review-pr"
  | "continuation"
  | "question"
  | "research"
  | "unknown";

type PreflightAdvisoryDecision = {
  shouldAttach: boolean;
  confidence: "low" | "medium" | "high";
  category: PreflightAdvisoryCategory;
  score: number;
  reasons: string[];
  skipReasons: string[];
};
```

Primary signals should be composable scores, not a single keyword branch:

### Positive signals

- explicit opt-in: `#fooks-preflight`, `fooks preflight`, `contextTrust`, `sourceOfTruth`
- active workflow/session state: ralph/team/ultragoal/ralplan active, or Codex hook state says current work exists
- concrete work anchors: file path, issue number, PR number, branch, diff, commit, test command, stack trace
- action intent shape: imperative verb + repo/work anchor, not verb alone
- continuation shape: “continue”, “ㄱㄱ”, “마저”, “그렇게 진행” only if paired with active workflow/session state
- durable side-effect words: PR, push, merge, release, issue, deploy (advisory-only in this phase)

### Negative/skip signals

- explicit opt-out: `#fooks-no-preflight`, `no preflight`, `just answer`, `plain answer`
- pure explanation/research question without repo/action anchor
- prompt is asking what a term means, planning only, or comparing approaches without execution request
- prompt is too short/ambiguous and there is no active workflow/session state
- preflight packet is unavailable or over budget

### Threshold proposal

- attach when score >= 3 and no hard skip
- attach when explicit opt-in exists, unless explicit opt-out also exists
- continuation prompts require active session/workflow evidence; otherwise skip
- pure questions with no execution anchor skip by default

This prevents “구현/수정/디버깅/PR” from becoming a hardcoded keyword table. Those words can still contribute weak points, but only action shape + runtime anchors should cross the threshold.

## Integration recommendation

For the next implementation PR, keep it semi-automatic and low-risk:

1. Add `src/ops/preflight-advisory-intent.ts` or similar pure builder.
2. Add fixture/unit tests with Korean, English, typo/short continuation, pure question, research, PR/action, and explicit opt-in/out cases.
3. Add a debug CLI or test-only surface first if desired, e.g. `fooks preflight --intent "..." --json` only if it does not change current schemas; otherwise keep it internal.
4. Wire Codex `UserPromptSubmit` later to call existing preflight projection and append compact human-readable advisory only when `shouldAttach=true`.
5. Keep the injected text provenance-labeled: “advisory, non-authorizing, read-only projection; current source/user prompt still wins.”

## Later roadmap

1. Collect a local labeled prompt corpus from dogfood sessions: prompt text + expected attach/skip/category + reason.
2. Add decision telemetry: attach/skip counts, category, score, byte size, no user content exfiltration.
3. Tune thresholds against the corpus.
4. Add semantic-router/embedding experiment only when deterministic score is uncertain, e.g. score 2 with no hard skip.
5. Add optional LLM structured-output classifier behind explicit config, fail-closed-to-skip, never required for local default.
6. Move durable side-effect checks closer to tool/action hooks when Codex support is stable; keep `UserPromptSubmit` advisory-only.

## Professor-critic verdict

PASS.

Why:

- Uses current web references and repo-backed surfaces.
- Compares keyword, scoring, embedding, LLM, and runtime-context gates.
- Identifies security/noise/cost risks.
- Recommends a conservative MVP aligned to fooks constraints.
- Preserves advisory-only and no-schema-change boundaries.
