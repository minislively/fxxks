# Runtime token-cost research and fooks adoption map

Date: 2026-05-19
Scope: Preserve research findings for sequential fooks implementation work so future tasks can reference the same evidence without rediscovery.

## Executive summary

fooks should not position itself as a generic token compressor. Its stronger position is a **frontend-domain-aware runtime context policy layer**: source-grounded React Web context, freshness gates, bounded payloads, fallback rules, and evidence receipts.

Publicly verifiable frontend-specific runtime token-cost reduction cases are still sparse. The broader market is solving adjacent problems:

1. repeated static prompt/context cost;
2. repeated file reads by coding agents;
3. irrelevant codebase context selection;
4. prompt layouts that break provider prompt caching;
5. missing real usage/cost telemetry.

fooks already has a strong foundation for #2, #3 partially, and #4 partially through Codex runtime hooks, same-file React Web payloads, source fingerprints, domain profiles, concern profiles, payload policies, and claim-boundary reporting. The biggest missing layer is measured token/cost evidence.

## External evidence anchors

Use these sources before changing public claims:

- OpenAI prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
  - Key point: automatic prompt caching; exact prefix matches; static content should be placed before dynamic content; docs mention up to 80% latency and up to 90% input-token cost reduction.
- Anthropic prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
  - Key point: explicit cache breakpoints / automatic caching, TTLs, cache read/write semantics, static tool/system/context first.
- Gemini context caching: https://ai.google.dev/gemini-api/docs/caching
  - Key point: implicit caching on Gemini 2.5+ and explicit caching for guaranteed savings with developer work.
- Aider repo map: https://aider.chat/docs/repomap.html
  - Key point: graph-ranked repo map constrained by active token budget; default map budget around 1k tokens.
- Repomix README: https://github.com/yamadashy/repomix/blob/main/README.md
  - Key point: AI-friendly repo packing, token count, ignore rules, secret checks, Tree-sitter compression.
- Continue codebase retrieval docs: https://docs.continue.dev/reference/deprecated-codebase
  - Key point: embeddings + keyword search, retrieve N then rerank to final K; useful for examples/high-level questions, not exact refactor/global find.
- Claude Code cost management: https://code.claude.com/docs/en/costs
  - Key point: context size drives token cost; prompt caching, compaction, model choice, hooks/skills, and code-intelligence plugins reduce cost.
- Agentic coding token-cost study: https://arxiv.org/abs/2604.22750
  - Key point: agentic coding is input-token heavy, highly variable, and more tokens do not reliably mean better accuracy.
- Prompt caching for long-horizon agents: https://arxiv.org/abs/2601.06007
  - Key point: cache-aware block control beats naive full-context caching; dynamic content/tool results can break caching or add latency.

## Current fooks strengths to preserve

- Runtime-first product hierarchy, especially Codex repeated same-file path.
- Source fingerprint and freshness gates before compact context reuse.
- Domain / concern / payload-policy separation.
- React Web wedge: `.tsx` / `.jsx`, same-file, source-grounded context.
- Claim-boundary discipline: local evidence is not provider billing proof.
- Reporting/evidence surfaces under `src/reporting/`.
- Runtime adapters do not invent support claims; they invoke policy.

## Current gaps

1. **Telemetry gap**
   - Need before/after local token estimates, runtime additionalContext tokens, provider usage if available, cached-token fields if available, fallback count, repeated-file read count, latency/TTFT when possible.
2. **Prompt-cache layout gap**
   - Need stable prefix / dynamic suffix packet design. Static instructions, policy schema, and do-not-do boundaries should be stable; current prompt, current debug, volatile findings should be late or artifact-only.
3. **Multi-file frontend graph gap**
   - Same-file is strong; real frontend work often spans page/component/schema/hook/test/story files.
4. **Ambiguous-prompt retrieval gap**
   - Need domain-aware, concern-aware retrieval/rerank rather than generic vector RAG.
5. **Token budget UX gap**
   - Need token tree / budget reports to explain what was retained, omitted, and why.
6. **Security/secret guard gap**
   - Runtime context injection should include ignore rules, generated/large-file policy, and secret-like payload blockers.

## Adoption roadmap

### Priority 1 — Evidence and telemetry layer

Goal: make token/cost claims measurable without overclaiming billing savings.

Candidate features:
- `fooks status tokens`
- `fooks status cost`
- `fooks compare <file> --token-tree`
- `fooks inspect evidence <session>` additions

Artifacts should include:
- raw source estimated tokens;
- fooks payload estimated tokens;
- additionalContext estimated tokens;
- provider usage fields when locally available;
- cached tokens when provider/runtime exposes them;
- fallback count and reason;
- repeated same-file context events;
- claim boundary: local estimates are not authoritative billing.

### Priority 2 — Cache-aware runtime packet format

Goal: improve provider prompt-cache compatibility without changing support scope.

Design rule:

```text
stable prefix:
  fooks policy/version text
  static instructions
  stable do-not-do boundaries
  stable schema labels

semi-stable middle:
  file identity
  source fingerprint
  domain profile
  concern profile summary

dynamic suffix:
  current user prompt
  current findings
  debug values
  volatile runtime metrics
```

Avoid putting noisy debug/tool results in the cacheable prefix.

### Priority 3 — React Web frontend graph

Goal: extend from same-file to bounded related-file context.

Graph candidates:
- imports/exports;
- component ownership;
- props types;
- form controls;
- validation schema anchors;
- route/page owner;
- colocated tests/stories;
- concern edges: form-state, routing, styling, client-state.

Keep default behavior narrow. Graph evidence does not automatically authorize compact reuse.

### Priority 4 — Domain-aware retrieval/rerank

Goal: handle ambiguous prompts safely.

Ranking factors:
- explicit path match;
- filename/route keyword match;
- import graph distance;
- domain match;
- concern match;
- file size/token budget;
- source freshness;
- fallback risk.

Do not use semantic response caching for code edits. Use source-fingerprint-based payload caching only.

### Priority 5 — Token budget tree

Goal: make savings/debugging visible.

Useful report shape:

```text
Raw source: N tokens
Fooks payload: M tokens
Reduction estimate: X%
Retained:
  form controls
  validation anchors
  event handlers
  source ranges
Omitted:
  repeated JSX
  implementation body details
  styling literals
Fallback risk:
  ...
```

### Priority 6 — Security / sensitive-context guard

Goal: prevent leaking sensitive project data through runtime context packets.

Candidate features:
- `.fooksignore`;
- generated/large-file exclusion policy;
- secret-like pattern scan;
- payload blocker / fallback to full local source read;
- evidence receipt that payload passed sensitive-content guard.

## Wording guardrails

Safe wording:
- “reduces repeated rediscovery”;
- “emits compact source-grounded context”;
- “shows local source-vs-payload token evidence”;
- “provider billing savings require provider usage evidence.”

Avoid unless backed by provider usage data:
- “cuts your AI bill by 90%”;
- “guaranteed token savings”;
- “works for all frontend projects”;
- “Claude/opencode token savings parity.”

## Implementation reminder

Before each task, check this file and ask:

1. Which roadmap priority does this touch?
2. Which claim boundary must stay unchanged?
3. Which source/evidence artifact proves the change?
4. Does it alter runtime behavior, setup eligibility, detector behavior, or public support wording?
5. If yes, add tests before widening docs.
