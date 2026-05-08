# TUI / Ink fixture candidate survey

This survey is an evidence-planning note for a possible future TUI / React CLI domain signal profile. It does **not** add TUI support, change extractor behavior, or promote Ink files beyond the existing TSX/JSX parsing boundary described in the README. It only records fixture shapes that could be useful if a later plan decides to test whether the shared TypeScript AST core should feed a separate TUI/CLI profile.

Any future fixture PR should pin exact source snapshots and document expected fallback/extract behavior before changing code. This page makes no runtime-token, provider billing, provider cost, latency, or package-support claim.

## Selection criteria

A TUI fixture candidate should satisfy most of these gates:

1. **React CLI source shape** — `.tsx` / `.jsx` files that use Ink-style React components or other React-rendered terminal UI patterns.
2. **Signal clarity** — one focused terminal UI concern per fixture, so web DOM/form/style assumptions are easy to avoid.
3. **Claim safety** — useful for evidence without implying terminal runtime correctness, shell integration behavior, provider/runtime savings, or current support expansion.
4. **Stable source snapshot** — pinned commit SHA or vendored snapshot before it becomes a benchmark fixture.
5. **Fallback expectation** — each fixture states whether a future profile would try extraction or keep full-source reading when signals are weak or mixed.

## Candidate fixture categories

| Category | Useful evidence surface | Boundary / risk |
| --- | --- | --- |
| Ink CLI app/component | Root `App.tsx` or reusable CLI components using Ink-style React primitives such as text containers, conditional panels, or command views. | Treat as TSX/JSX syntax only today; terminal rendering semantics are not web DOM semantics. |
| Keyboard/input prompt surface | Components that handle keyboard input, prompt state, validation text, selection lists, or submit/cancel flows. | Do not infer shell, TTY, stdin, or accessibility behavior from AST shape alone. |
| Layout/text styling | Text layout, color/style tokens, wrapping, spacing, borders, and nested terminal rows/columns. | DOM/CSS style signals may be weak or misleading; keep web-style assumptions out of future profile criteria. |
| Command status/progress UI | Status lines, spinners, progress indicators, task lists, logs, or success/error summaries rendered by React CLI components. | Runtime progress behavior and command side effects are outside fixture evidence unless a later benchmark explicitly measures them. |
| Negative/fallback cases | Mixed web/TUI files, thin wrappers around process execution, non-React terminal libraries, generated output renderers, or files with too few React CLI signals. | These should preserve normal source reading or an explicit fallback expectation until a future profile proves safe extraction rules. |

## Recommended first fixture slice

Start with a small source-only corpus before any extractor or runtime change:

1. **Ink CLI app/component fixture** — one compact `.tsx` app or component with React CLI primitives and conditional rendering.
2. **Keyboard/input prompt fixture** — one component where key handlers, prompt state, and validation/cancel branches are visible in source.
3. **Layout/text styling fixture** — one component focused on terminal layout and text styling rather than DOM/CSS assumptions.
4. **Command status/progress fixture** — one component that renders command status or progress UI without requiring command execution to interpret it.
5. **Negative/fallback fixture** — one file that looks like CLI code but should remain full-source because it is non-React, mixed-domain, generated, or too behavior-heavy.

## Current evidence-only reinforcement slice

The current committed TUI / Ink fixtures are useful as domain evidence, not as compact-payload permission:

### TUI concern taxonomy

This taxonomy names the source-level concerns currently represented by TUI fixtures. It is a review vocabulary, not a payload contract: **concern evidence is not payload permission**. A fixture may prove that a concern is visible in source while the TUI lane still denies compact payload emission and keeps normal source fallback.

| Concern | Current meaning | Representative fixtures | Current permission boundary |
| --- | --- | --- | --- |
| Compact Ink syntax baseline | Minimal Ink import plus React CLI primitives that prove the file belongs to the Ink evidence lane. | `tui-ink-basic.tsx` | Evidence-only; no compact extraction permission. |
| Keyboard input | `useInput`, key branching, selection movement, or cancel/submit keys observed in source. | `tui-ink-basic.tsx`, `tui-ink-interactive-list.tsx`, `tui-ink-form-prompt.tsx` | Evidence-only; no terminal key handling correctness claim. |
| Prompt/form flow | Prompt state, validation/error text, apply/submit, or cancel branches in an Ink component. | `tui-ink-form-prompt.tsx` | Evidence-only; no form runtime or terminal UX correctness claim. |
| Layout/style | Nested `Box`/`Text`, row/column layout, borders, spacing, color, dim text, or mapped display rows. | `tui-ink-layout-style.tsx` | Evidence-only; no terminal rendering correctness claim. |
| Status/progress | Non-interactive status rows, command phase labels, progress-like output, elapsed time, or log summaries. | `tui-ink-status-panel.tsx` | Evidence-only; no command execution or progress behavior claim. |
| Mixed-boundary | Ink evidence combined with React Web DOM or React Native primitive/input evidence in one file. | `tui-ink-web-dom-mixed.tsx`, `tui-ink-rn-narrow-mixed.tsx` | Fallback boundary; no TUI, React Web, or RN payload authorization. |
| Non-Ink negative evidence | Terminal-looking React or CLI renderer source without Ink import, `Box`, `Text`, or `useInput` signals. | `tui-non-ink-cli-renderer.tsx` | Unknown/deferred fallback; no package or non-Ink terminal UI expansion. |

| Fixture | Evidence it should prove | Required current outcome |
| --- | --- | --- |
| `test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx` | Ink import, `Box`, `Text`, and `useInput` signals in a compact React CLI component. | Classify as `tui-ink`, mark the profile `evidence-only`, deny the TUI payload policy, and fall back with `unsupported-frontend-domain-profile`. |
| `test/fixtures/frontend-domain-expectations/tui-ink-interactive-list.tsx` | Ink import, `Box`, `Text`, `useInput`, keyboard navigation, selected-row rendering, and list mapping in a behavior-heavy prompt surface. | Classify as `tui-ink`, keep the profile `evidence-only`, deny the TUI payload policy, emit no payload, and fall back through the readiness/profile gate. The current pre-read reason is `raw-mode` because extraction preserves the original raw source before any TUI payload could be emitted. |
| `test/fixtures/frontend-domain-expectations/tui-ink-form-prompt.tsx` | Ink import, `Box`, `Text`, `useInput`, prompt state, validation/error text, submit/apply flow, and cancel branch evidence in a pure Ink prompt surface. | Classify as `tui-ink`, keep the profile `evidence-only`, deny the TUI payload policy, emit no payload, and fall back with `unsupported-frontend-domain-profile`; this broadens positive TUI evidence without adding terminal behavior or compact extraction permission. |
| `test/fixtures/frontend-domain-expectations/tui-ink-layout-style.tsx` | Ink import, nested `Box`, repeated `Text`, `flexDirection`, `gap`, padding, border, color, dim text, and mapped rows in a pure Ink layout/style surface. | Classify as `tui-ink`, keep the profile `evidence-only`, deny the TUI payload policy, emit no payload, and fall back with `unsupported-frontend-domain-profile`; this broadens layout/style evidence without adding terminal rendering correctness or compact extraction permission. |
| `test/fixtures/frontend-domain-expectations/tui-ink-status-panel.tsx` | Ink import, `Box`, `Text`, nested status rows, command phase labels, elapsed time, and mapped log lines without `useInput`. | Classify as `tui-ink`, keep the profile `evidence-only`, deny the TUI payload policy, emit no payload, and fall back with `raw-mode`; this proves fixture breadth without treating non-interactive status UI as supported terminal behavior. |
| `test/fixtures/frontend-domain-expectations/tui-ink-web-dom-mixed.tsx` | Ink import, `Box`, `Text`, and React Web DOM form/input/button evidence in one file. | Classify as `mixed`, deny both TUI and React Web payload paths, emit no payload, and fall back through the mixed frontend boundary. |
| `test/fixtures/frontend-domain-expectations/tui-ink-rn-narrow-mixed.tsx` | Ink import and `Box` evidence plus RN narrow-strength `View`, `Text`, `TextInput`, `Pressable`, `onChangeText`, and `onPress` evidence in one file. | Classify as `mixed`, deny both TUI and RN narrow payload paths, emit no payload, and fall back through the mixed frontend boundary. |

This reinforcement slice is intentionally small so it can run alongside RN, React Web, and WebView worktrees without touching shared detector, runtime, manifest, or payload-policy implementation files. A TUI fixture PR should prove the evidence boundary above before it proposes any source or runtime change.

Reviewers should check that TUI evidence remains separate from payload permission:

1. Classification may say `tui-ink`.
2. Profile claim status must stay `evidence-only`.
3. Payload policy must stay denied with the TUI evidence-only reason.
4. Pre-read must keep normal source fallback through `unsupported-frontend-domain-profile`, `raw-mode`, or another explicit denied-readiness reason that emits no payload.
5. No model-facing payload should be emitted for these fixtures.

Any future step that changes one of those outcomes is no longer a fixture reinforcement PR; it needs a serialized shared-policy plan with its own fixtures, measured acceptance bar, and claim-boundary review.

### Negative/fallback reinforcement

The next safe TUI fixture shape is a non-Ink CLI renderer that looks terminal-oriented to humans but has no `ink` import, `Box`, `Text`, or `useInput` evidence. `test/fixtures/frontend-domain-expectations/tui-non-ink-cli-renderer.tsx` exists to keep that boundary explicit: it should remain outside the `tui-ink` lane, receive no TUI payload policy authorization, and fall back without a model-facing payload.

This fixture does not activate the deferred F7 manifest slot or broaden TUI package support. It is a local negative/fallback regression only; any manifest promotion still needs a serialized shared-policy plan.

## Current TUI evidence matrix

This matrix is the current review contract for TUI-related fixtures. It is intentionally docs/test scoped: it records evidence and fallback expectations, but it does not grant compact payload permission.

| Fixture | Expected domain classification | Payload policy expectation | Pre-read expectation | Claim boundary |
| --- | --- | --- | --- | --- |
| `test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx` | `tui-ink`, `evidence-only` | `tui-ink-evidence-only-payload`, denied | fallback with `unsupported-frontend-domain-profile`, no payload | Syntax evidence only; no TUI support or terminal correctness claim. |
| `test/fixtures/frontend-domain-expectations/tui-ink-interactive-list.tsx` | `tui-ink`, `evidence-only` | `tui-ink-evidence-only-payload`, denied | fallback with `raw-mode`, no payload | Behavior-heavy Ink evidence only; no runtime, token, or compact extraction claim. |
| `test/fixtures/frontend-domain-expectations/tui-ink-form-prompt.tsx` | `tui-ink`, `evidence-only` | `tui-ink-evidence-only-payload`, denied | fallback with `unsupported-frontend-domain-profile`, no payload | Form/prompt Ink evidence only; no terminal input correctness, runtime, token, or compact extraction claim. |
| `test/fixtures/frontend-domain-expectations/tui-ink-layout-style.tsx` | `tui-ink`, `evidence-only` | `tui-ink-evidence-only-payload`, denied | fallback with `unsupported-frontend-domain-profile`, no payload | Layout/style Ink evidence only; no terminal rendering correctness, runtime, token, or compact extraction claim. |
| `test/fixtures/frontend-domain-expectations/tui-ink-status-panel.tsx` | `tui-ink`, `evidence-only` | `tui-ink-evidence-only-payload`, denied | fallback with `raw-mode`, no payload | Status/progress UI syntax evidence only; no terminal progress, command execution, token, or compact extraction claim. |
| `test/fixtures/frontend-domain-expectations/tui-non-ink-cli-renderer.tsx` | `unknown`, `deferred` | no TUI/Ink policy authorization | fallback with no payload; unsupported-profile policy remains denied in debug evidence | Negative/fallback evidence only; no F7 manifest promotion or package-support claim. |
| `test/fixtures/frontend-domain-expectations/tui-ink-web-dom-mixed.tsx` | `mixed`, `fallback-boundary` | no TUI/Ink policy authorization; mixed frontend boundary denied | fallback with mixed boundary reason, no payload | Mixed Ink plus React Web DOM evidence only; no TUI or React Web compact payload claim. |
| `test/fixtures/frontend-domain-expectations/tui-ink-rn-narrow-mixed.tsx` | `mixed`, `fallback-boundary` | no TUI/Ink policy authorization and no RN narrow policy authorization; mixed frontend boundary denied | fallback with mixed boundary reason, no payload | Mixed Ink plus RN primitive/input evidence only; no TUI or RN compact payload claim. |

If a future PR changes any row from fallback/no-payload to payload emission, it is no longer a TUI evidence matrix update and must go through a serialized shared-policy plan.

## Evidence-only review checklist

Before merging a docs/tests-only TUI fixture PR, reviewers should confirm:

1. every positive Ink row still ends in `evidence-only`, denied policy, and fallback/no-payload;
2. at least one non-Ink or mixed fallback row remains visible whenever positive Ink evidence expands, so over-match risk stays explicit;
3. fixture-lane wording stays local to fixture docs/tests and must not be reused as README, roadmap, release-note, or package support wording;
4. any request for `allowed: true`, payload emission, manifest edits, or shared detector/pre-read/runtime seams is redirected into a serialized shared-policy plan.

## Payload design readiness handoff

The evidence matrix above is sufficient to discuss a future payload-design PRD, but it is not itself a payload contract. A payload-design handoff must first prove that the current evidence-only lane stays denied:

- the TUI-safe metadata projection contract in `docs/tui-operational-readiness.md` classifies safe shared metadata, TUI-specific source evidence, caution metadata, fallback-required metadata, and forbidden React Web-only projections before any schema or builder exists;
- positive Ink concern evidence is mapped to fixtures before design assumptions are made;
- negative, weak, and mixed fixtures keep fallback/no-payload behavior;
- the TUI payload policy remains `allowed: false` for current fixtures;
- pre-read emits no model-facing TUI payload;
- terminal runtime facts, command execution, key handling correctness, token reduction, billing reduction, provider-cost reduction, and performance outcomes are treated as non-claims until measured in a separate plan;
- any detector, registry, manifest, payload builder, pre-read, runtime, or cross-lane frontend edit is out of scope for a readiness handoff and requires a separate serialized plan.

### Minimal payload candidate vocabulary

The first safe TUI payload design target is a source-only metadata vocabulary. These names are allowed to appear in docs and future dry-run tests, but they are not model-facing payload fields yet:

| Candidate metadata field | Representative fixture evidence | Required boundary |
| --- | --- | --- |
| `terminalLayoutEvidence` | `tui-ink-basic.tsx`, `tui-ink-layout-style.tsx`, `tui-ink-status-panel.tsx` | Layout hierarchy evidence only; no terminal rendering correctness claim. |
| `terminalTextStatusEvidence` | `tui-ink-basic.tsx`, `tui-ink-status-panel.tsx` | Text/status syntax evidence only; no command progress or runtime side-effect claim. |
| `terminalInputFlowEvidence` | `tui-ink-basic.tsx`, `tui-ink-interactive-list.tsx`, `tui-ink-form-prompt.tsx` | Input-flow source evidence only; no key handling, stdin, TTY, or UX correctness claim. |
| `terminalStyleEvidence` | `tui-ink-layout-style.tsx` | Style prop evidence only; no color/theme/visual fidelity claim. |
| `terminalMixedBoundaryEvidence` | `tui-ink-web-dom-mixed.tsx`, `tui-ink-rn-narrow-mixed.tsx` | Mixed-domain fallback evidence only; no TUI, React Web, or RN payload authorization. |
| `terminalNegativeBoundaryEvidence` | `tui-non-ink-cli-renderer.tsx` | Non-Ink fallback evidence only; no package-surface expansion. |

The vocabulary is deliberately fixture-backed. A later field should not be added until a fixture proves the source shape and a negative or mixed case keeps fallback/no-payload behavior safe.

### Source-only dry-run implementation handoff

A future dry-run PR may implement a non-emitting metadata projection for the vocabulary above, but only if it keeps the current denied lane intact:

1. read source and produce debug/test evidence for candidate metadata fields;
2. keep `assessTuiInkPayloadPolicy` denied with `allowed: false`;
3. keep every current TUI fixture fallback/no-payload;
4. keep mixed and non-Ink cases outside TUI payload authorization;
5. avoid model-facing payload builders, runtime/pre-read injection, manifest changes, detector/registry promotion, and token/performance/support claims.

If any of those constraints is too narrow, the next artifact should be a new PRD/test-spec pair rather than an opportunistic source edit.

## Candidate source notes

If a future PR names public repositories, keep the list conservative and verify license, activity, file paths, and commit SHAs at that time. Good seed sources are likely to be established Ink examples, React-based CLI apps, or prompt/status UI components with inspectable TSX/JSX. Do not use curated lists, stale forks, or runtime-only demos as evidence fixtures unless a pinned source file clearly exercises one category above.

## Acceptance bar before moving to extractor prototype

Do not start TUI/CLI extractor behavior until a candidate PR can show:

- fixture corpus selected with stable commit SHAs or pinned snapshots;
- each fixture mapped to a domain signal profile, signal family, and expected fallback/extract behavior;
- tests prove current README/roadmap wording remains limited to existing TSX/JSX syntax treatment and future-candidate status;
- benchmark/evidence commands are documented before any measured claim;
- fallback cases remain in the corpus so weak, mixed, non-React, or behavior-heavy CLI files do not silently receive compact payloads;
- roadmap wording remains limited to candidate evidence and staged gates, with no public support promise, delivery timeline, runtime-token claim, provider-cost claim, or default TUI compact extraction.

## Non-goals

- No public TUI/Ink support claim from this survey.
- No extractor, pre-read, setup, doctor, or runtime behavior change.
- No provider-token, billing, runtime-token, performance, or terminal correctness claim.
- No default TUI compact extraction or profile promotion.
- No package-surface expansion; this survey is a source-repo evidence artifact unless package policy changes consistently for all fixture surveys.
