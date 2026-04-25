# Frontend Scope Taxonomy

This document captures the verified frontend scope taxonomy used to keep AI-assisted frontend work narrow, reviewable, and measurable.

Related tracking issue: #131.

## Core doctrine

**Scope-first, reuse-first, abstraction-later.**

Before implementation starts:

1. Pick exactly one primary lane unless a bundle exception is declared.
2. Classify connected frontend concerns as gates, not automatic work.
3. Default evidence, infrastructure, and backend/API lanes to defer unless explicitly selected.
4. Run a reuse scan before adding files, helpers, mocks, types, regexes, adapters, or shared utilities.
5. Require 3+ concrete repetitions or an existing precedent before introducing shared abstractions.

## PR execution contract

Use this contract before implementation or process-only work begins.

1. **User Intent Classification** — classify the primary user intent as one Layer 1 core execution lane (`feature`, `design/UI`, `refactor`, `migration`, `test`) or as one explicitly selected Layer 3 separate lane such as `docs/process`.
2. **Primary Lane Contract** — select exactly one primary lane by default. A core execution lane is a Layer 1 frontend implementation lane; a primary lane is the single owner for the PR and may also be an explicitly selected Layer 3 separate lane.
3. **Required Support Work** — list only subordinate work required to complete the primary lane, such as tests, QA, docs, fixtures, or small cleanup. `support` here does not mean product/runtime support, does not expand public support claims, and is not a second primary lane.
4. **Boundary Gates** — classify connected concerns as `in`, `support`, `defer`, or `blocked`.
5. **Bundle Exception** — if more than one primary lane is truly required, declare why the work cannot be split, what extra risk it adds, and what extra verification will cover that risk.
6. **PR Execution** — execute the selected primary lane plus required support work only. Everything else goes into the defer ledger or is marked blocked.

## Layer 1: core execution lanes

Select at most one Layer 1 lane for a first implementation handoff. For docs/process-only or evidence-only PRs, select the relevant Layer 3 lane as the primary lane instead of forcing the work into a frontend implementation lane.

| Core lane | Allowed first pass | Must not cross into |
| --- | --- | --- |
| Feature | One user-visible behavior or use case using existing architecture and UI patterns. | Broad refactor, BE/API sync, design-system rewrite, performance campaign, unrelated cleanup. |
| Design/UI | One component, screen state, layout adjustment, interaction state, or visual consistency issue. | Feature semantics, BE/API changes, whole design-system rewrite, unrelated architecture refactor. |
| Refactor | One boundary, name, extraction, or local simplification with behavior locked. | New feature behavior, migration, redesign, broad helper framework, unrelated tests. |
| Migration | One adapter/API/version path with rollback or compatibility note. | Full-stack migration, BE sync, visual redesign, opportunistic cleanup. |
| Test | Preserve existing intent while adding or narrowing coverage. | Whole-file rewrite, premature `test-utils`, BE error-code sync, visual design edits. |

## Layer 2: frontend boundary gates

Classify every gate as `in`, `support`, `defer`, or `blocked`.

- `in` means the gate is owned by the selected primary lane.
- `support` means required subordinate work for the selected primary lane; it is not product/runtime support and not a second primary lane.
- `defer` means visible but intentionally left for a later lane.
- `blocked` means the PR cannot safely decide or complete that gate without missing authority, evidence, or upstream work.

A gate is `in` only when it is required for the selected primary lane and does not broaden the task beyond that lane's allowed first pass.

| Boundary gate | Default rule | Incidental scope forbidden unless selected |
| --- | --- | --- |
| Routing/app shell | Defer unless the chosen lane is explicitly about one route, shell, or navigation behavior. | Route/shell/navigation restructure. |
| State/data flow | Keep only the minimal local state/query/cache shape required by the selected change; otherwise defer. | Store/query/fetch/cache/data-shape redesign. |
| Forms/validation | Keep to one form behavior or validation surface. | Broad form framework changes or BE error-code sync. |
| Accessibility | Preserve existing semantics; include only what is required to complete the changed UI state. | Broad semantic/focus/keyboard rewrite. |
| i18n/content/locale | Keep copy/locale scope capped to the selected UI state. | Broad copy/locale sweep. |
| Error/loading/empty states | Add only the selected state. | BE/API contract assumptions or unrelated UI states. |
| Component API/props | Preserve API unless the selected lane explicitly owns the prop/API change. | Downstream prop/API migration. |
| Styling tokens/classes | Reuse existing style-system tokens/classes. | Design-system rewrite or new token system. |

## Layer 3: separate evidence, infrastructure, and defer lanes

These lanes are visible during planning but default to defer unless explicitly selected as the primary lane. When one of these lanes is selected as primary, Layer 1 core execution lanes should normally defer.

| Separate lane | Default disposition |
| --- | --- |
| BE/API sync | Defer out of the repo-side path; record as a separate follow-up. |
| Analytics/telemetry/logging | Separate lane unless instrumentation is explicitly selected. |
| Performance/bundle | Evidence-driven lane; do not attach to feature/design cleanup. |
| Build/tooling/dependencies | Separate lane; no new dependencies without explicit approval. |
| Hooks/enforcement | Separate governance/tooling lane; do not implement just because the taxonomy exists. |
| Benchmark/evidence | Separate measurement lane; token/cost proof is not required for every implementation. |
| Docs/process | Separate lane unless documentation/process is explicitly selected. |

## Platform support boundary note

This taxonomy controls PR scope; it does not expand fooks' runtime or framework support claims. React Native and embedded WebView remain a deferred support lane. For fooks claim work, TSX parsing is only syntax-level evidence and must not be treated as semantic support for RN primitives, native platform behavior, bridge behavior, or WebView boundaries. Until dedicated RN/WebView fixtures and evidence exist, RN/WebView files should use normal source reading.

For RN/WebView claim work, classify the first implementation handoff as a Layer 3 `benchmark/evidence` or `docs/process` lane unless an approved plan explicitly selects extractor behavior. The minimum promotion gates are fixture corpus, signal model, benchmark evidence, and claim-boundary wording; failing any gate keeps the lane deferred.

## Scope classifier template

Use this before implementation:

```md
Primary lane: <feature | design/UI | refactor | migration | test | BE/API sync | analytics/telemetry/logging | performance/bundle | build/tooling/dependencies | hooks/enforcement | benchmark/evidence | docs/process>
Primary lane type: <Layer 1 core execution lane | Layer 3 separate lane>
One-sentence change: <exact behavior/boundary/state/test intent>
Required support work:
- tests: <support | defer | blocked> — <reason>
- QA: <support | defer | blocked> — <reason>
- docs: <support | defer | blocked> — <reason>
- fixtures: <support | defer | blocked> — <reason>
- small cleanup: <support | defer | blocked> — <reason>

Bundle exception: <none | required>
- If required: <why this cannot split into separate PRs, added risk, extra verification>

Layer 2 boundary gates:
- routing/app shell: <in | support | defer | blocked> — <reason>
- state/data flow: <in | support | defer | blocked> — <reason>
- forms/validation: <in | support | defer | blocked> — <reason>
- accessibility: <in | support | defer | blocked> — <reason>
- i18n/content/locale: <in | support | defer | blocked> — <reason>
- error/loading/empty states: <in | support | defer | blocked> — <reason>
- component API/props: <in | support | defer | blocked> — <reason>
- styling tokens/classes: <in | support | defer | blocked> — <reason>

Layer 3 separate/defer lanes:
- BE/API sync: <selected | defer | blocked> — <reason>
- analytics/telemetry/logging: <selected | defer | blocked> — <reason>
- performance/bundle: <selected | defer | blocked> — <reason>
- build/tooling/dependencies: <selected | defer | blocked> — <reason>
- hooks/enforcement: <selected | defer | blocked> — <reason>
- benchmark/evidence: <selected | defer | blocked> — <reason>
- docs/process: <selected | defer | blocked> — <reason>

Reuse scan:
- Existing references checked: <2-5 file refs or "none found after scan">
- New shared abstraction? <no | yes, because 3+ repetitions or existing precedent>

Defer ledger:
- <deferred concern> -> <why deferred> -> <future lane if needed>
```

## Verification checklist

A frontend task is ready to execute only when:

- [ ] Exactly one primary lane is selected, unless a bundle exception is declared.
- [ ] The primary lane type is identified as a Layer 1 core execution lane or Layer 3 separate lane.
- [ ] Required support work is listed and justified.
- [ ] All Layer 2 gates are classified as `in`, `support`, `defer`, or `blocked`.
- [ ] Layer 3 lanes are deferred unless explicitly selected as the primary lane.
- [ ] Any bundle exception explains why the work cannot split, the added risk, and the extra verification.
- [ ] BE/API sync is deferred unless a separate approved BE/API lane exists.
- [ ] Reuse scan evidence is recorded before new files/helpers are added.
- [ ] Shared abstractions have 3+ repetition evidence or an existing precedent.
- [ ] The final report includes selected primary lane, support work performed, gates marked `in` or `support`, defer ledger, tests run, and known gaps.

## Post-Ralph verification status

Ralph completed the `test` lane verification (see `.omx/artifacts/frontend-scope-taxonomy-ralph-check.mjs`). Remaining core lanes are deferred until explicitly selected:

- `feature` — deferred
- `design/UI` — deferred
- `refactor` — deferred
- `migration` — deferred
- `test` — ✅ completed by Ralph

Layer 3 separate lanes remain deferred unless explicitly opened:

- `docs/process` — deferred
- `hooks/enforcement` — deferred
- `benchmark/evidence` — deferred
- `analytics/telemetry/logging` — deferred
- `performance/bundle` — deferred
- `tooling` — deferred
- `BE/API` — out of repo-side path unless separate lane explicitly opened
