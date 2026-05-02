# Frontend domain profile roadmap

This document promotes the RN/WebView/TUI domain-profile plan into tracked project docs. It does **not** add runtime support. The current strongest fooks path remains repeated same-file React web `.tsx` / `.jsx` work in Codex, plus the documented same-file `.ts` / `.js` beta when module signals are strong enough.

For the canonical cross-domain taxonomy, outcome vocabulary, claim boundaries, and shard triggers, see [Frontend domain contract](frontend-domain-contract.md).

## Design rule

TSX/JSX parsing is syntax evidence, not domain semantic evidence. Future frontend-family work should separate:

1. **Layer 0 — boundary and eligibility policy**
   - Decides whether a file may receive compact context at all.
   - Preserves the current full-source fallback for obvious React Native and WebView markers.
   - Keeps `unsupported-react-native-webview-boundary` as the current safety boundary until a later evidence-backed plan changes it.
2. **Layer 1 — shared syntax/core facts**
   - Records file identity, AST traversal facts, imports/exports, declarations, generic JSX tags/attributes/calls, and AST-derived source ranges.
   - Does not decide that a JSX tag is a DOM control, native primitive, WebView bridge, or TUI widget.
3. **Layer 2 — domain signal profiles**
   - React web profile: DOM-ish JSX, `form` / `input` / `select` / `textarea`, `className`, style/Tailwind, hooks, effects, callbacks, and event handlers.
   - React Native candidate profile: `View`, `Text`, `TextInput`, `Pressable`, `Touchable*`, `FlatList`, `StyleSheet.create`, platform and navigation signals.
   - WebView boundary profile: `react-native-webview`, `source`, injected JavaScript, `onMessage`, and native/web bridge boundaries.
   - TUI/Ink candidate profile: Ink/React CLI TSX components and terminal input/layout signals, explicitly separate from broad arbitrary TUI support.
4. **Layer 3 — promotion gates**
   - A profile only moves forward when fixtures, pass/fail rules, fallback rules, and wording boundaries are documented and verified.

Domain profiles produce evidence, not permission. A file classified as React Native, WebView, TUI/Ink, Mixed, or Unknown still needs a separate payload-policy decision before fooks may emit compact or narrow model-facing context.

Architecture shorthand:

> One parser. Many domain profiles. One resolver. Many payload policies. Many runtime adapters. One proof/claim boundary.

## Target module split

The registry shell should make future domain work easier to split across worktrees without changing runtime behavior. The target ownership shape is:

```text
src/core/domain-profiles/
  types.ts
  registry.ts
  react-web.ts
  react-native.ts
  webview.ts
  tui-ink.ts

src/core/payload-policy/
  types.ts
  react-web.ts
  react-native.ts
  webview.ts
  tui-ink.ts
  fallback.ts
```

Those paths are an ownership boundary, not support wording. `react-web` remains the current supported lane; `react-native`, `webview`, and `tui-ink` remain governed by the promotion gates below until a later evidence-backed plan changes their policy.

## Promotion gates and public wording

| Level | Gate | Stop condition | Allowed public wording |
| --- | --- | --- | --- |
| 0 | Deferred/fallback boundary | Boundary detection, fixture categories, or safety review missing | “Deferred lane”; “not current support”; “falls back to normal source reading” |
| 1 | Evidence-lane design | No fixture matrix, pass/fail rules, or benchmark commands | “Evidence candidate”; “design lane”; no runtime support claim |
| 2 | Fixture/benchmark evidence | Fixture corpus or regression evidence incomplete | “Validated evidence lane for measured fixtures only” |
| 3 | Experimental extractor candidate | Narrow tests or fallback rules are incomplete | “Experimental same-file candidate” with exact domain/scope named |
| 4 | Narrow support wording | Repeated evidence or docs/tests do not prove exact scope | “Narrow support for measured same-file scope” only |

Promotion stops at the first failed gate.

## Fixture-first guardrail

Do not introduce extractor behavior for RN, WebView, or TUI from an abstract profile alone. Before source-level profile changes, a candidate PR needs:

- stable fixture references or pinned snapshots;
- one expected behavior per fixture: extract, fallback, or unsupported wording;
- regression coverage for the current React web path;
- explicit WebView bridge/source/injected-JS review before any compact payload reuse;
- public wording that does not exceed the measured fixture scope.

## Initial fixture matrix

| Lane | Required fixture category | Expected first-pass result |
| --- | --- | --- |
| React web | Existing form/style/large mixed fixtures | No regression from current tests and payload shape |
| RN primitive/interaction | Component with `View`, `Text`, `Pressable` or `Touchable*` | Evidence candidate only; no support claim |
| RN styles | `StyleSheet.create`, inline styles, theme/token refs | Expectations documented before extraction |
| RN platform/navigation | `.ios` / `.android` file or `Platform.select`, route/navigation hooks | Boundary documented; no overgeneralized semantics |
| WebView boundary | `react-native-webview` with `source`, injected JS, `onMessage` | Fallback remains default; boundary facts documented |
| WebView bridge | paired RN bridge + web/message code | Explicit bridge boundary; no compact payload reuse |
| TUI/Ink | Ink/React CLI `.tsx` / `.jsx` component | Separate evidence lane from general terminal UI |
| Negative fallback | obvious unsafe RN/WebView/TUI file | Must keep full-source fallback or unsupported wording |

## Non-goals

- No React Native support claim from TSX parsing alone.
- No embedded WebView compact-payload reuse claim.
- No broad TUI support claim.
- No new dependency, LSP, or parser requirement for this design lane.
- No source behavior change until a later plan selects a fixture-backed implementation lane.

## Next executable lanes

1. **Domain registry docs lane** — keep this document, `docs/roadmap.md`, `docs/domain-payload-architecture.md`, and `docs/frontend-domain-contract.md` aligned around evidence-vs-permission separation before implementation work starts.
2. **Registry shell lane** — introduce profile/registry seams without support expansion, runtime behavior changes, setup eligibility changes, or payload shape changes.
3. **React Web split lane** — move the current supported React Web behavior behind the new seams first, with no regression to measured same-file behavior.
4. **RN/WebView/TUI detection move lane** — move detection into profile-owned files while preserving RN narrow-gate limits, WebView fallback-first behavior, and TUI/Ink evidence-only wording.
5. **Payload-policy split lane** — make compact/narrow/fallback/deferred permission a separate policy layer.
6. **Fixture/test-shape lane** — maintain the selected/deferred fixture baseline and expected outcomes in [`Frontend domain fixture expectations`](frontend-domain-fixture-expectations.md) without changing extraction behavior.
7. **Experimental implementation lane** — only after fixture/test-shape evidence is explicit and current web/RN-WebView fallback regressions are protected.
