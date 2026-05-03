# Domain payload architecture

This document is the canonical architecture note for how fooks should evolve from a single TSX extractor mental model into a domain-aware context-packet pipeline. It is an architecture direction, not a runtime behavior change, support promise, benchmark claim, or default compact-extraction expansion.

[`frontend-domain-contract.md`](frontend-domain-contract.md) remains the normative source for domain taxonomy, outcome vocabulary, claim boundaries, fixture promotion gates, and current support wording. This document explains the intended pipeline shape and layer responsibilities so future implementation plans have one architecture reference.

## Status and boundaries

Current broad frontend support remains the measured React Web same-file TSX/JSX lane described in the README and roadmap. React Native, WebView, TUI/Ink, Mixed, and Unknown domains require separate policy decisions before their signals can affect compact payload behavior.

Architecture shorthand:

> One parser. Many domain profiles. One resolver. Many payload policies. Many runtime adapters. One proof/claim boundary.

The shorthand is a future-facing separation rule, not a statement that all of those seams already exist in source code. Domain evidence must pass through an explicit policy decision before it can become compact model context.

This document does not add:

- runtime behavior;
- setup eligibility;
- detector behavior, pre-read behavior, or payload schema changes;
- React Native broad support;
- WebView support, bridge safety, or compact-payload reuse;
- broad TUI semantic support or terminal correctness;
- token, cost, billing, latency, or provider-tokenizer claims.

## Pipeline

The intended long-term pipeline is:

```text
input file
→ shared syntax layer
→ domain profile registry
→ domain resolver
→ payload policy
→ runtime adapter
→ proof / claim boundary
```

That high-level shape can still be implemented through narrower internal seams:

```text
input file
→ shared syntax layer
→ domain detector / profile registry
→ domain scanner
→ domain payload planner
→ domain payload builder
→ cache / repeated-read policy
→ model-facing context packet
```

The key split is that scanner, planner, and builder must not collapse into one policy-heavy extractor. The shared syntax layer can parse TS/JS/TSX/JSX, but syntax parsing alone is not framework support.

## Shared seam responsibility contract

Future domain payload work must preserve a three-part contract:

- **Scanner contract:** observes source-derived signals only. A scanner must not choose compact, narrow, boundary-aware, fallback, or deferred mode; must not emit model-facing payloads; and must not claim domain support.
- **Planner contract:** consumes the domain profile plus scanner facts and chooses the safety/policy decision. A planner must not invent source facts, format final payload output, weaken WebView fallback-first behavior, broaden the measured RN `F1` narrow gate, or promote TUI, Mixed, or Unknown evidence lanes.
- **Builder contract:** formats the model-facing packet according to the planner decision. A builder must not override planner safety decisions, decide support or promotion, or compact across a boundary the planner rejected.

Shared seam changes are serialized by default. Any PR that changes detector, pre-read, model-facing payload, domain payload, schema, shared fixture manifest, or normative support-policy docs must name one shared-policy owner and a merge-order note. Domain-specific lanes may run in parallel only when they stay in disjoint fixture/docs/test surfaces and do not edit those serialized shared seams.

## Shared syntax layer

The shared syntax layer owns reusable source facts:

- TS/JS/TSX/JSX parsing;
- import/export scan;
- JSX tag and attribute scan;
- symbol and light AST scan;
- source ranges and source fingerprints where current extraction already provides them.

This layer answers “what syntax is present?” It does not answer “is this safe to compact?” or “does fooks understand this framework runtime?” Those questions belong to later domain layers.

## Domain detector and domain profile

The detector classifies the frontend family from imports, JSX tags, filename/platform markers, and known package signals. The profile carries the current evidence and boundaries for the detected family.

A future-facing profile shape can be described as:

```ts
type DomainProfile = {
  domain:
    | "react-web"
    | "react-native"
    | "webview-boundary"
    | "tui-ink"
    | "mixed"
    | "unknown";
  confidence: "high" | "medium" | "low";
  signals: DomainSignal[];
  risks: DomainRisk[];
  boundaries: BoundarySignal[];
};
```

This shape is illustrative architecture language, not a declaration that these exact types exist today.

## Domain profiles vs concern profiles

Domain profiles and concern profiles answer different questions. A domain profile answers "where does this code run or which UI/runtime family does it resemble?" A concern profile answers "what task-context signal should an editor preserve while changing this file?"

Examples of concern signals include:

- form state such as `react-hook-form` `useForm`, `register`, `Controller`, and `handleSubmit`;
- validation/schema libraries such as Zod, Yup, or Valibot;
- client state such as Zustand, Jotai, Redux, or reducer/store modules;
- server state and data fetching such as TanStack Query or SWR;
- routing/navigation concerns such as route params, links, redirects, and navigation side effects;
- styling concerns such as `className`, `cva`, `clsx`, variants, and style-object boundaries.

Concern evidence is editor-context guidance. It can help a future packet explain what not to break, but it does not promote a domain and does not authorize compact payload reuse by itself. Payload permission still belongs to the payload planner/policy layer after domain evidence, boundary evidence, source ranges, and current maturity gates have been evaluated.

Concrete examples:

- `react-hook-form` plus DOM-like `<form>` and `<input>` signals can be React Web domain evidence plus a form-state concern.
- `react-hook-form` plus React Native `TextInput` and `onChangeText` signals can be React Native domain evidence plus a form-state concern, but it still remains bounded by the measured RN `F1` policy gate.
- A Zustand store file can be a client-state concern without being a UI-domain payload candidate at all.

This is future-facing architecture language, not a declaration that concern-profile extraction exists today. Concern profiles should become another evidence input to policy; they should not bypass the domain resolver, fallback rules, or proof/claim boundary.

## Domain scanner

A domain scanner observes facts for one profile family. It should avoid deciding whether a compact payload is allowed.

Examples:

- React Web scanner facts: forms, inputs, selects, textareas, buttons, `onChange`, `onSubmit`, `className`, style objects, ARIA attributes, DOM-ish JSX structure.
- React Native scanner facts: `View`, `Text`, `TextInput`, `Pressable`, `Touchable*`, `FlatList`, `StyleSheet.create`, `Platform.select`, same-file handlers, navigation markers.
- WebView boundary scanner facts: `react-native-webview`, `<WebView>`, `source={{ html }}`, `source={{ uri }}`, `injectedJavaScript`, `onMessage`, `postMessage`, `window.ReactNativeWebView`.
- TUI/Ink scanner facts: Ink imports, `Box`, `Text`, `useInput`, `Static`, `Newline`, terminal layout props, key-input handlers.
- Mixed/Unknown scanner facts: weak, absent, or conflicting signals that require fallback or deferral.

Scanner output is evidence. It is not support wording and not payload eligibility.

## Domain payload planner

The planner owns the safety and policy decision. It consumes the domain profile plus scanner facts and decides whether the next layer may emit a compact, narrow, boundary-aware, fallback, or deferred context packet.

A future-facing decision shape can be described as:

```ts
type PayloadDecision = {
  mode:
    | "compact-safe"
    | "narrow-structural"
    | "boundary-aware"
    | "fallback-full-read"
    | "defer-with-guidance";
  reason: string;
  includedRanges: SourceRange[];
  omittedRanges: SourceRange[];
  warnings: string[];
};
```

The planner is where domain-specific risk belongs:

- React Web can be compact-safe when existing extractor/readiness rules prove it.
- React Native is evidence/fallback by default, except the existing measured `F1` primitive/input narrow gate named in the frontend-domain contract.
- WebView is boundary-aware or fallback-full-read by default.
- TUI/Ink remains bounded by measured TSX syntax/payload behavior and does not imply terminal correctness.
- Mixed and Unknown should choose fallback or defer when signals are weak or conflicting.

## Domain payload builder

The builder emits the model-facing context packet according to the planner decision. It should not decide support, bridge safety, terminal correctness, or provider-token savings.

Builder responsibilities include:

- formatting the selected context packet;
- preserving required source ranges, snippets, warnings, and fallback guidance;
- omitting ranges only when the planner decision authorizes omission;
- keeping warning language tied to the measured domain policy rather than broad support claims.

For fallback decisions, the builder can emit guidance that normal source reading is required. It should not build a compact payload across a boundary the planner rejected.

## Domain starting policies

| Domain | Starting policy | First useful direction | Claim boundary |
| --- | --- | --- | --- |
| React Web | `compact-safe` when current extractor/readiness rules allow it. | Wrap the existing React Web payload path first, then split internals gradually. | Current measured same-file React Web lane only. |
| React Native | Evidence/fallback by default, with the existing measured `F1` primitive/input narrow gate as the only current exception. | Later `narrow-structural` work for primitives/input/press handlers without DOM/form translation. | No broad React Native support and no native runtime correctness claim. |
| WebView boundary | `boundary-aware` or `fallback-full-read` by default. | Later fallback builder can explain bridge/source/message boundaries without compact payload reuse. | No WebView support, bridge safety, or compact-payload reuse claim. |
| TUI/Ink | Measured TSX syntax/payload behavior only. | Later narrow/evidence lane for Ink component structure and key-input facts. | No broad TUI semantic support, terminal correctness, or terminal UX safety claim. |
| Mixed | Fallback or defer according to the strongest safety boundary. | Preserve evidence without choosing the most convenient single domain. | Mixed evidence cannot promote a file by ignoring conflicting signals. |
| Unknown | `defer-with-guidance` or existing generic behavior only when ordinary eligibility rules allow it. | Improve classification only with a separate plan. | Unknown is not implicit React Web, RN, WebView, or TUI support. |

## First implementation sequence

The recommended implementation sequence after this docs pass is:

1. **Domain profile registry shell** — introduce profile/registry seams without support expansion, output-shape changes, setup eligibility changes, or runtime behavior changes. This is the first behavior-neutral seam to land before domain-specific expansion.
2. **React Web split first** — wrap and then move the existing compact-safe React Web behavior into profile/policy seams while preserving current payload shape and regression behavior.
3. **RN/WebView/TUI detection move** — move React Native, WebView, and TUI/Ink signal detection into profile-owned files without expanding compact-payload behavior, support wording, or setup eligibility.
4. **Payload-policy split** — separate profile evidence from the policy decision that may allow compact, narrow, boundary-aware, fallback, or deferred model context.
5. **Per-domain evidence expansion** — only after the seams are stable, expand fixtures, tests, and measured evidence for individual domain lanes.

Each step needs its own plan and verification. This document does not authorize all of them at once.

The older scanner/planner/builder sequence remains the internal responsibility model for payload work: scanner output is evidence, the planner owns permission, and the builder formats only what the planner authorizes. The new registry-first order describes how to make those seams parallel-worktree friendly before broadening any domain lane.

## Cache and repeated-read policy

Cache and repeated-read policy should sit after the planner/builder decision. Cache reuse is a delivery mechanism for a context packet that has already been judged safe enough for its domain policy. It is not proof that a domain is compact-safe.

A repeated prompt may reuse a compact or narrow packet only when the planner decision, source fingerprint, and current runtime eligibility still match. If the domain profile, boundary facts, or source fingerprint changes, the system should re-read or fall back according to the current policy.

## Parallel work guidance

Domain work can run in parallel when lanes are read-only, fixture-only, or stay inside disjoint domain-owned surfaces. Shared policy and runtime seams need a single owner per PR wave.

Parallel-safe examples:

- read-only audits of React Web, RN, WebView, and TUI evidence;
- domain-specific fixture or docs investigation that does not edit shared policy files;
- verifier lanes that inspect claim boundaries without writing.

Serialized examples:

- `src/core/domain-detector.ts`;
- `src/adapters/pre-read.ts`;
- payload readiness or model-facing payload code;
- shared fixture manifest and shared claim-boundary tests;
- docs that define normative support policy, especially `docs/frontend-domain-contract.md`.

Use the frontend-domain contract's ownership matrix for the normative shared-surface list.

Before opening a true domain-parallel wave, use the frontend-domain contract's launch contract gate. The gate must name:

- each participating lane;
- branch/worktree names;
- allowed write sets and forbidden shared seams;
- PR order;
- verification matrix;
- build/typecheck preflight evidence;
- ownership/scope evidence;
- stop rules.

Planning-only launch-contract work remains docs/regression-only and does not authorize runtime/source changes, fixture expansion, domain implementation, support claims, or team/worktree execution by itself.

## Claim boundaries

Architecture wording may describe future seams and planned responsibilities. It must not imply that those seams already exist in runtime code, that every TSX family is supported, or that compact payload behavior is safe for RN/WebView/TUI.

When in doubt:

- describe React Web as the current measured broad frontend lane;
- describe RN as evidence/fallback except the measured `F1` primitive/input narrow gate;
- describe WebView as fallback-first and boundary-aware;
- describe TUI/Ink as measured syntax/payload evidence, not terminal behavior support;
- describe Mixed/Unknown as safety states;
- keep provider-token, billing, runtime-token, cost, performance, bridge-safety, and terminal-correctness claims out of this architecture layer.
