# Frontend domain contract

Issue #198 locks the frontend-domain contract before any detector or profile promotion. This document is a docs/process and regression-test gate only: it does not add extractor behavior, detector behavior, setup eligibility, runtime behavior, CLI behavior, public support wording, manifest schema migration, or domain sharding.

## Contract status

- **Current supported lane remains React Web only** for the measured same-file TSX/JSX scope already covered by existing docs and tests.
- **React Native, WebView, and TUI/Ink are evidence lanes**, not product/runtime support claims.
- **WebView is fallback-first.** WebView boundary signals must keep normal source reading unless a later gate explicitly approves a narrower detector/profile promotion.
- **Mixed and Unknown classifications are safety states.** They prevent ambiguous syntax evidence from becoming semantic support.

## Domain taxonomy

| Domain | Classification rule | Current contract outcome | Claim boundary |
| --- | --- | --- | --- |
| React Web | DOM-oriented React/TSX evidence such as forms, DOM JSX elements, `className`, and browser event handlers, without stronger RN/WebView/TUI boundary signals. | Eligible for the existing measured React Web extraction path when current extractor and readiness rules allow it. | This is the only current frontend support lane. |
| React Native | `react-native` imports, RN primitives such as `View`, `Text`, `TextInput`, `Pressable`, `Touchable*`, `FlatList`, or platform/navigation/style signals. | Evidence lane; fallback when current pre-read boundary markers apply. | Syntax evidence is not a React Native support claim and must not be treated as DOM/form semantics. |
| WebView | `react-native-webview`, `<WebView>`, `source`, injected JavaScript, `onMessage`, or native/web bridge markers. | **Fallback-first** boundary lane. | No WebView support claim, no bridge-safety claim, and no compact-payload reuse claim. |
| TUI-Ink | Ink/React CLI TSX evidence such as Ink-like imports, `Box`, `Text`, `useInput`, terminal layout, or command-palette style components. | Evidence lane only; current fixture evidence may prove TSX parsing/extraction for measured local files. | TUI/Ink evidence is not broad TUI support and not terminal correctness support. |
| Mixed | Multiple domain signals in one file or fixture, especially combinations of React Web with RN/WebView/TUI or RN with WebView bridge markers. | Conservative boundary classification; fallback or defer according to the strongest safety signal. | Mixed evidence cannot be promoted by choosing the most convenient domain. |
| Unknown | TSX/JSX/TS/JS where domain signals are absent, weak, or unclassified. | Defer semantic profile claims; use existing generic behavior only when normal eligibility rules allow it. | Unknown is not implicit React Web, RN, WebView, or TUI support. |

## Outcome meanings

| Outcome | Meaning | What it does not mean |
| --- | --- | --- |
| `extract` | The current extractor may produce a compact/model-facing payload under the existing implementation and readiness rules for a measured fixture or supported lane. | It does not promote a new domain profile, detector, setup claim, runtime claim, or public support promise. |
| `fallback` | The file should use normal source reading/full-source behavior instead of compact payload reuse, usually because a safety boundary or unsupported-domain marker is present. | It is not a failed test and not a request to infer semantics from syntax alone. |
| `deferred` | The lane, fixture, or semantic profile is intentionally postponed until a future plan documents fixtures, pass/fail rules, fallback rules, and wording boundaries. | It does not block the current React Web path and does not authorize implementation by implication. |

## WebView fallback-first rule

WebView files are boundary files before they are extraction candidates. `react-native-webview`, `<WebView>`, `source`, injected JavaScript, `onMessage`, HTML strings, or native/web bridge markers require the fallback-first posture. Any future compact-payload reuse for WebView must first pass a separate security and boundary review and must name the exact measured scope.

## RN and TUI evidence-lane rule

React Native and TUI/Ink fixtures may be useful evidence for syntax traversal, fixture shape, and future domain-signal design. They are **not support claims**. RN primitives must not be reinterpreted as DOM controls or React Web form semantics. TUI/Ink fixtures must not be generalized into arbitrary terminal UI support, terminal behavior correctness, or runtime-token savings.

## Fixture manifest pre-detector/profile gate

The fixture expectation manifest at `test/fixtures/frontend-domain-expectations/manifest.json` is the pre-detector/profile gate for this lane. Before any detector or profile promotion, a candidate change must keep the manifest and docs aligned on:

1. one domain lane per selected fixture;
2. one expected outcome per fixture: `extract`, `fallback`, or `deferred`/unsupported wording;
3. local or synthetic-local fixture sources only for the first pass;
4. explicit fallback reasons for RN/WebView boundary fixtures;
5. forbidden support claims for RN, WebView, and TUI/Ink evidence lanes;
6. deferred entries for fixture categories that are visible but not yet safe to promote.

This issue does not migrate the manifest schema. The current schema remains the contract surface for regression tests.

## Next detector/profile promotion gate

The next detector/profile PR may start only after this contract is green in docs and tests. That later PR must be explicitly scoped and must include, before source behavior changes:

- fixture-backed domain classification rules for React Web, React Native, WebView, TUI-Ink, Mixed, and Unknown;
- pass/fail expectations for each promoted fixture;
- fallback rules that keep WebView boundary cases fallback-first unless specifically approved;
- wording boundaries that avoid RN/WebView/TUI support claims beyond measured evidence;
- regression coverage proving the manifest remains a pre-detector/profile gate;
- a stated non-goal for package/lockfile changes, setup/CLI changes, runtime/pre-read broadening, manifest schema migration, and domain sharding unless a separate issue explicitly opens one of those lanes.

Promotion stops at the first failed gate. Until that later gate passes, this contract is documentation and regression protection only.
