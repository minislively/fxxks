# TUI operational readiness

This guide is the handoff contract for TUI / Ink work. It explains how to choose the next TUI task without changing the current lane maturity. It does not change extractor behavior, runtime behavior, fixture manifest slots, or compact-context permission.

## Current state

The TUI lane is currently a source-evidence lane:

- domain classification may return `tui-ink` when Ink imports, primitives, or hooks are present;
- profile claim status remains `evidence-only`;
- payload policy returns `tui-ink-evidence-only-payload` with `allowed: false`;
- pre-read must keep full-source fallback and emit no model-facing compact payload;
- non-Ink terminal-looking React renderers remain outside the TUI/Ink lane unless a later plan proves a narrower rule.

This separation is intentional. Domain evidence can tell reviewers what kind of file they are looking at, but it is not permission to replace source reading with compact context.

## TUI-safe metadata projection contract

This contract names the source-derived metadata that may inform a later TUI payload-design plan. It is **not** a payload schema, **not** compact extraction permission, and **not** model-facing output. Current TUI behavior remains evidence-only, denied by policy, and fallback/no-payload.

| Category | May record | Current boundary |
| --- | --- | --- |
| Safe shared metadata | Imports, component/export names, JSX tags, prop names, hook names, handler identifiers, state variable names, source ranges, domain classification, policy decision, and fallback reason. | These facts may help reviewers describe the source shape, but they do not authorize source replacement or compact payload emission. |
| TUI-specific source evidence | Ink import, `Box`, `Text`, `useInput`, source-observed key branch names, and prompt/list/status concern tags. | These facts identify Ink evidence and fixture concerns only; they do not prove terminal behavior. |
| Caution metadata | Layout/style props, color/dim/border props, mapped rows, and command/status labels. | Useful as source facts, but terminal layout, styling, wrapping, command progress, and display correctness remain unproven. |
| Fallback-required metadata | Command execution behavior, TTY/stdin behavior, terminal width/wrapping, key handling correctness, progress/runtime state, and shell side effects. | Keep full-source reading or a later measured plan; do not compress these into trusted TUI context from AST facts alone. |
| Forbidden projection | DOM roles, ARIA relationships, `htmlFor`/id form relations, browser form semantics, CSS/className meaning, React Web layout region semantics, and browser accessibility assumptions. | React Web-only semantics must not be projected into TUI/Ink context or used to promote TUI payload permission. |

The safe and caution categories are review vocabulary for future planning. A later PR that serializes any of this into model-facing payload must write a separate PRD/test-spec pair, name the schema, preserve fallback regressions, and re-check the public claim boundary before implementation.

## Fixture roles

These fixture roles are also the current TUI concern taxonomy. Concern labels help reviewers reason about source evidence, but concern evidence is not payload permission.

| Fixture | Concern category | Role | Required current result |
| --- | --- | --- | --- |
| `test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx` | Compact Ink syntax baseline; keyboard input | Compact Ink syntax signal with `Box`, `Text`, and `useInput`. | `tui-ink`, `evidence-only`, denied TUI policy, fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-ink-interactive-list.tsx` | Keyboard input | Behavior-heavy keyboard/list prompt evidence. | `tui-ink`, `evidence-only`, denied TUI policy, `raw-mode` fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-ink-form-prompt.tsx` | Keyboard input; prompt/form flow | Positive form/prompt evidence with input state, validation/error text, submit/apply, and cancel branches. | `tui-ink`, `evidence-only`, denied TUI policy, fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-ink-layout-style.tsx` | Layout/style | Positive layout/style evidence with nested boxes, borders, spacing, color, dim text, and mapped rows. | `tui-ink`, `evidence-only`, denied TUI policy, fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-ink-status-panel.tsx` | Status/progress | Non-interactive status/progress UI syntax evidence. | `tui-ink`, `evidence-only`, denied TUI policy, `raw-mode` fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-non-ink-cli-renderer.tsx` | Non-Ink negative evidence | Negative terminal-looking React renderer without Ink signals. | `unknown`, `deferred`, no TUI policy authorization, fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-ink-web-dom-mixed.tsx` | Mixed-boundary | Mixed-negative Ink plus React Web DOM evidence. | `mixed`, `fallback-boundary`, no TUI or React Web payload authorization, fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-ink-rn-narrow-mixed.tsx` | Mixed-boundary | Mixed-negative Ink plus RN primitive/input evidence. | `mixed`, `fallback-boundary`, no TUI or RN narrow payload authorization, fallback/no-payload. |

## Allowed next work

Choose the smallest lane that matches the intended change:

1. **Operational docs/tests** — clarify current boundaries, next-step criteria, or claim wording. This may update this guide and add narrow doc assertions.
2. **Fixture breadth** — add one focused TUI or negative fixture plus a matrix row and policy/pre-read fallback regression. Keep behavior fallback/no-payload.
3. **Payload-design planning** — write a serialized shared-policy plan before changing compact-context permission. This is planning work, not implementation.
4. **Shared-policy implementation** — only after a separate plan names owners, changed files, migration order, acceptance criteria, and fallback regressions.

If a change does not fit one of these lanes, stop and write a new plan before editing.

## Evidence reinforcement review checklist

When the current lane is docs/tests-only evidence reinforcement, reviewers should verify:

- the change only clarifies source evidence, denied policy, fallback reason, or stop rules;
- positive Ink evidence remains paired with non-Ink or mixed fallback visibility so over-match risk stays visible;
- README, roadmap, release, package, and runtime-facing wording stay candidate/evidence-only and are not widened from fixture-lane language;
- any `allowed: true`, payload emission, manifest, detector, policy, pre-read, or runtime request stops the lane and returns to a serialized shared-policy plan.

## Promotion criteria before payload-design planning

Before a TUI payload-design plan is useful, the repo should already have:

- at least one positive Ink fixture for each evidence category that the design wants to rely on;
- at least one negative or mixed-domain fixture for every rule that could otherwise over-match;
- stable policy language describing what source facts are safe to summarize and what facts require full source;
- a TUI-safe metadata projection contract that separates shared syntax facts, TUI source evidence, caution facts, fallback-required facts, and forbidden React Web-only projections;
- an explicit list of terminal/runtime facts that remain outside AST-derived evidence;
- a verification matrix that proves fallback/no-payload still wins for weak, mixed, non-Ink, and behavior-heavy cases;
- a claim-boundary audit that rejects compact-context, terminal behavior, token, billing, and performance wording until measured evidence exists.

Meeting these criteria does not enable a payload. It only means the next plan can discuss whether a narrow payload gate is worth designing.

## Payload design readiness gate

This readiness gate is the review contract for a future TUI payload-design PRD. Passing the gate means the repo has enough bounded evidence to plan a design; it does not mean TUI is supported, compact extraction is allowed, or runtime injection may begin.

A future payload-design PRD may start only when all of these checks are true:

1. positive Ink evidence categories are named and mapped to representative fixtures;
2. non-Ink, weak, and mixed-domain cases still deny TUI payload authorization;
3. every current TUI fixture keeps `allowed: false` under the TUI payload policy;
4. pre-read decisions emit no model-facing TUI payload;
5. claim-boundary checks reject support, terminal correctness, token, billing, provider-cost, and performance wording;
6. any future shared-seam edit names the exact files, owners, merge order, and fallback regressions before implementation;
7. terminal semantics that cannot be proven from AST facts are listed as full-source requirements rather than compact-context facts.

The disqualifier list is intentionally strict. Stop the current lane and write a separate serialized plan if a change needs `allowed: true`, a TUI payload builder, runtime/pre-read injection, detector or registry edits, manifest changes, fixture classification changes, cross-lane RN/React Web/WebView edits, or any measured-value claim.

## Minimal payload candidate schema contract

This contract names the first metadata vocabulary a future **source-only dry-run** may prototype. It is a schema target, not permission to emit a payload. Every field below must stay source-derived, fixture-backed, and denied by the current TUI payload policy until a later plan explicitly promotes it.

| Candidate metadata field | What current fixtures can prove | Full-source / non-claim boundary |
| --- | --- | --- |
| `terminalLayoutEvidence` | Ink `Box`/`Text` hierarchy, nested rows or columns, spacing props, and repeated display rows. | Does not prove rendered terminal dimensions, wrapping, or layout correctness. |
| `terminalTextStatusEvidence` | Static text, status labels, progress-like rows, elapsed text, and log-summary rendering visible in TSX. | Does not prove command execution, progress accuracy, shell state, or runtime side effects. |
| `terminalInputFlowEvidence` | `useInput`, key branches, prompt state, validation/error text, submit/apply, cancel, and selection movement in source. | Does not prove terminal key handling correctness, stdin/TTY behavior, accessibility, or runtime UX safety. |
| `terminalStyleEvidence` | Ink color, dim text, border, padding, gap, and style-like props visible in JSX. | Does not prove terminal theme support, color rendering, or visual fidelity. |
| `terminalMixedBoundaryEvidence` | Ink evidence combined with React Web DOM or React Native primitive/input evidence. | Must remain fallback/no-payload and cannot authorize any TUI, React Web, or RN compact path. |
| `terminalNegativeBoundaryEvidence` | Terminal-looking React or CLI renderer source without Ink import, primitives, or hooks. | Must remain unknown/deferred fallback and cannot broaden package support. |

The schema vocabulary above is intentionally smaller than terminal behavior. It may guide a future metadata projection, but it must not be described as compact context support, token reduction, runtime correctness, provider-cost improvement, or default TUI extraction.

## Source-only dry-run handoff

The next implementation PR may build only a **source-only dry-run** that reports the candidate metadata fields above in debug or test-owned evidence. That PR must continue to keep:

- `tui-ink-evidence-only-payload` denied with `allowed: false`;
- pre-read fallback/no-payload behavior for every current TUI fixture;
- mixed and non-Ink cases outside TUI payload authorization;
- model-facing payload emission out of scope;
- runtime hooks, detector registries, fixture manifest entries, and cross-lane RN/React Web/WebView files unchanged unless a new serialized plan names owners and fallback regressions first.

If the dry-run needs a payload builder, `allowed: true`, runtime injection, token/performance claims, or shared-seam edits, stop and create a new PRD/test-spec pair before implementation.

## Stop rules

Stop the current PR and switch to serialized shared-policy planning if the change would:

- edit `src/core/domain-detector.ts`, domain profile registry, payload-policy registry, domain payload builders, pre-read, or runtime hooks;
- change `test/fixtures/frontend-domain-expectations/manifest.json`;
- turn any TUI fixture from fallback/no-payload into payload emission;
- add compact-context permission for `tui-ink`;
- describe terminal behavior, command progress, key handling, token reduction, billing reduction, or performance improvement as available from current TUI evidence;
- broaden non-Ink terminal-looking React renderers into the TUI/Ink lane.

When a stop rule triggers, the next artifact should be a PRD/test-spec pair that names the shared files, required merge order, fallback regressions, and public claim boundary before implementation begins.
