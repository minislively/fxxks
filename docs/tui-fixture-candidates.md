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

| Fixture | Evidence it should prove | Required current outcome |
| --- | --- | --- |
| `test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx` | Ink import, `Box`, `Text`, and `useInput` signals in a compact React CLI component. | Classify as `tui-ink`, mark the profile `evidence-only`, deny the TUI payload policy, and fall back with `unsupported-frontend-domain-profile`. |
| `test/fixtures/frontend-domain-expectations/tui-ink-interactive-list.tsx` | Ink import, `Box`, `Text`, `useInput`, keyboard navigation, selected-row rendering, and list mapping in a behavior-heavy prompt surface. | Classify as `tui-ink`, keep the profile `evidence-only`, deny the TUI payload policy, emit no payload, and fall back through the readiness/profile gate. The current pre-read reason is `raw-mode` because extraction preserves the original raw source before any TUI payload could be emitted. |
| `test/fixtures/frontend-domain-expectations/tui-ink-status-panel.tsx` | Ink import, `Box`, `Text`, nested status rows, command phase labels, elapsed time, and mapped log lines without `useInput`. | Classify as `tui-ink`, keep the profile `evidence-only`, deny the TUI payload policy, emit no payload, and fall back with `raw-mode`; this proves fixture breadth without treating non-interactive status UI as supported terminal behavior. |

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
| `test/fixtures/frontend-domain-expectations/tui-ink-status-panel.tsx` | `tui-ink`, `evidence-only` | `tui-ink-evidence-only-payload`, denied | fallback with `raw-mode`, no payload | Status/progress UI syntax evidence only; no terminal progress, command execution, token, or compact extraction claim. |
| `test/fixtures/frontend-domain-expectations/tui-non-ink-cli-renderer.tsx` | `unknown`, `deferred` | no TUI/Ink policy authorization | fallback with no payload; unsupported-profile policy remains denied in debug evidence | Negative/fallback evidence only; no F7 manifest promotion or package-support claim. |

If a future PR changes any row from fallback/no-payload to payload emission, it is no longer a TUI evidence matrix update and must go through a serialized shared-policy plan.

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
