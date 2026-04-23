# Frontend Scope Taxonomy

This document captures the verified frontend scope taxonomy used to keep AI-assisted frontend work narrow, reviewable, and measurable.

Related tracking issue: #131.

## Core doctrine

**Scope-first, reuse-first, abstraction-later.**

Before implementation starts:

1. Pick exactly one core execution lane.
2. Classify connected frontend concerns as gates, not automatic work.
3. Default evidence, infrastructure, and backend/API lanes to defer unless explicitly selected.
4. Run a reuse scan before adding files, helpers, mocks, types, regexes, adapters, or shared utilities.
5. Require 3+ concrete repetitions or an existing precedent before introducing shared abstractions.

## Layer 1: core execution lanes

Select at most one lane for a first implementation handoff.

| Core lane | Allowed first pass | Must not cross into |
| --- | --- | --- |
| Feature | One user-visible behavior or use case using existing architecture and UI patterns. | Broad refactor, BE/API sync, design-system rewrite, performance campaign, unrelated cleanup. |
| Design/UI | One component, screen state, layout adjustment, interaction state, or visual consistency issue. | Feature semantics, BE/API changes, whole design-system rewrite, unrelated architecture refactor. |
| Refactor | One boundary, name, extraction, or local simplification with behavior locked. | New feature behavior, migration, redesign, broad helper framework, unrelated tests. |
| Migration | One adapter/API/version path with rollback or compatibility note. | Full-stack migration, BE sync, visual redesign, opportunistic cleanup. |
| Test | Preserve existing intent while adding or narrowing coverage. | Whole-file rewrite, premature `test-utils`, BE error-code sync, visual design edits. |

## Layer 2: frontend boundary gates

Classify every gate as `in`, `defer`, or `blocked`. A gate is `in` only when it is required for the selected core lane and does not broaden the task beyond that lane's allowed first pass.

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

These lanes are visible during planning but default to defer unless explicitly selected as the current lane.

| Separate lane | Default disposition |
| --- | --- |
| BE/API sync | Defer out of the repo-side path; record as a separate follow-up. |
| Analytics/telemetry/logging | Separate lane unless instrumentation is explicitly selected. |
| Performance/bundle | Evidence-driven lane; do not attach to feature/design cleanup. |
| Build/tooling/dependencies | Separate lane; no new dependencies without explicit approval. |
| Hooks/enforcement | Separate governance/tooling lane; do not implement just because the taxonomy exists. |
| Benchmark/evidence | Separate measurement lane; token/cost proof is not required for every implementation. |
| Docs/process | Separate lane unless documentation/process is explicitly selected. |

## Scope classifier template

Use this before implementation:

```md
Selected core lane: <feature | design/UI | refactor | migration | test>
One-sentence change: <exact behavior/boundary/state/test intent>

Layer 2 boundary gates:
- routing/app shell: <in | defer | blocked> — <reason>
- state/data flow: <in | defer | blocked> — <reason>
- forms/validation: <in | defer | blocked> — <reason>
- accessibility: <in | defer | blocked> — <reason>
- i18n/content/locale: <in | defer | blocked> — <reason>
- error/loading/empty states: <in | defer | blocked> — <reason>
- component API/props: <in | defer | blocked> — <reason>
- styling tokens/classes: <in | defer | blocked> — <reason>

Layer 3 separate/defer lanes:
- BE/API sync: defer — out of current repo-side path
- analytics/telemetry/logging: <defer | selected>
- performance/bundle: <defer | selected>
- build/tooling/dependencies: <defer | selected>
- hooks/enforcement: <defer | selected>
- benchmark/evidence: <defer | selected>
- docs/process: <defer | selected>

Reuse scan:
- Existing references checked: <2-5 file refs or "none found after scan">
- New shared abstraction? <no | yes, because 3+ repetitions or existing precedent>

Defer ledger:
- <deferred concern> -> <why deferred> -> <future lane if needed>
```

## Verification checklist

A frontend task is ready to execute only when:

- [ ] Exactly one core lane is selected.
- [ ] All Layer 2 gates are classified as `in`, `defer`, or `blocked`.
- [ ] Layer 3 lanes are deferred unless explicitly selected.
- [ ] BE/API sync is deferred unless a separate approved BE/API lane exists.
- [ ] Reuse scan evidence is recorded before new files/helpers are added.
- [ ] Shared abstractions have 3+ repetition evidence or an existing precedent.
- [ ] The final report includes selected lane, gates marked `in`, defer ledger, tests run, and known gaps.
