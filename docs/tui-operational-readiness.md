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

## Fixture roles

| Fixture | Role | Required current result |
| --- | --- | --- |
| `test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx` | Compact Ink syntax signal with `Box`, `Text`, and `useInput`. | `tui-ink`, `evidence-only`, denied TUI policy, fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-ink-interactive-list.tsx` | Behavior-heavy keyboard/list prompt evidence. | `tui-ink`, `evidence-only`, denied TUI policy, `raw-mode` fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-ink-status-panel.tsx` | Non-interactive status/progress UI syntax evidence. | `tui-ink`, `evidence-only`, denied TUI policy, `raw-mode` fallback/no-payload. |
| `test/fixtures/frontend-domain-expectations/tui-non-ink-cli-renderer.tsx` | Negative terminal-looking React renderer without Ink signals. | `unknown`, `deferred`, no TUI policy authorization, fallback/no-payload. |

## Allowed next work

Choose the smallest lane that matches the intended change:

1. **Operational docs/tests** — clarify current boundaries, next-step criteria, or claim wording. This may update this guide and add narrow doc assertions.
2. **Fixture breadth** — add one focused TUI or negative fixture plus a matrix row and policy/pre-read fallback regression. Keep behavior fallback/no-payload.
3. **Payload-design planning** — write a serialized shared-policy plan before changing compact-context permission. This is planning work, not implementation.
4. **Shared-policy implementation** — only after a separate plan names owners, changed files, migration order, acceptance criteria, and fallback regressions.

If a change does not fit one of these lanes, stop and write a new plan before editing.

## Promotion criteria before payload-design planning

Before a TUI payload-design plan is useful, the repo should already have:

- at least one positive Ink fixture for each evidence category that the design wants to rely on;
- at least one negative or mixed-domain fixture for every rule that could otherwise over-match;
- stable policy language describing what source facts are safe to summarize and what facts require full source;
- an explicit list of terminal/runtime facts that remain outside AST-derived evidence;
- a verification matrix that proves fallback/no-payload still wins for weak, mixed, non-Ink, and behavior-heavy cases;
- a claim-boundary audit that rejects compact-context, terminal behavior, token, billing, and performance wording until measured evidence exists.

Meeting these criteria does not enable a payload. It only means the next plan can discuss whether a narrow payload gate is worth designing.

## Stop rules

Stop the current PR and switch to serialized shared-policy planning if the change would:

- edit `src/core/domain-detector.ts`, domain profile registry, payload-policy registry, domain payload builders, pre-read, or runtime hooks;
- change `test/fixtures/frontend-domain-expectations/manifest.json`;
- turn any TUI fixture from fallback/no-payload into payload emission;
- add compact-context permission for `tui-ink`;
- describe terminal behavior, command progress, key handling, token reduction, billing reduction, or performance improvement as available from current TUI evidence;
- broaden non-Ink terminal-looking React renderers into the TUI/Ink lane.

When a stop rule triggers, the next artifact should be a PRD/test-spec pair that names the shared files, required merge order, fallback regressions, and public claim boundary before implementation begins.
