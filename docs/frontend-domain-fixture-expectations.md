# Frontend domain fixture expectations

This document is the first fixture expectation baseline for the RN/WebView/TUI domain-profile roadmap. It does **not** add runtime support, extractor behavior, setup eligibility, or public support wording. It only records which small local fixture slots should currently extract, fallback, or remain deferred before any later narrow implementation plan.

## Source policy

Selected first-pass fixtures are limited to `existing-local` or `synthetic-local` sources. Public repository candidates from `docs/rn-webview-fixture-candidates.md` remain reference-only for this pass. The first pass must not copy, vendor, or live-fetch external repository files.

## Selected fixture expectations

| Slot | ID | Lane | Source kind | Path | Expected outcome | Required proof |
| --- | --- | --- | --- | --- | --- | --- |
| F0 | `react-web-regression-form-controls` | React web regression | `existing-local` | `fixtures/compressed/FormControls.tsx` | `extract` | Existing React web extraction remains non-empty and current regressions pass. |
| F1 | `rn-primitive-basic` | RN primitive/interaction | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | RN primitives do not become DOM/form semantics. |
| F3 | `webview-boundary-basic` | WebView boundary | `synthetic-local` | `test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | WebView `source`, injected JS, and `onMessage` remain boundary-first. |
| F5 | `tui-ink-basic` | TUI/Ink candidate | `synthetic-local` | `test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx` | `extract` | This is only TSX/JSX extraction evidence for an Ink-like file; it is not a broad TUI support claim. |
| F6 | `negative-rn-webview-boundary` | Negative fallback | `synthetic-local` | `test/fixtures/frontend-domain-expectations/negative-rn-webview-boundary.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | RN/WebView bridge-like markers do not receive compact payload reuse. |

The machine-readable fixture expectation manifest is `test/fixtures/frontend-domain-expectations/manifest.json`.

That manifest remains the gate between the [Frontend domain contract](frontend-domain-contract.md) and any later detector/profile implementation plan; this baseline does not require a schema migration.

## Deferred fixture slots

| Slot | ID | Lane | Reason |
| --- | --- | --- | --- |
| F2 | `rn-style-platform-navigation` | RN style/platform/navigation | `StyleSheet.create`, `Platform.select`, `.ios` / `.android`, and navigation semantics expand beyond the first evidence baseline. |
| F4 | `webview-bridge-pair` | WebView bridge | Paired native/web bridge fixtures require separate security and boundary review before compact-payload planning. |

These deferrals do not block the current evidence baseline. They prevent platform/navigation and bridge/security semantics from being mixed into the first fixture expectation pass.

## Forbidden claims

This baseline must not imply any of the following support promotions:

- React Native availability or current support.
- WebView availability or current support.
- TUI availability or current support.
- WebView compact-payload reuse or bridge safety promotion.

## Promotion boundary

A later implementation plan may use this baseline as evidence, but it must still pass a separate approval step before changing runtime behavior, setup eligibility, support wording, or WebView compact-payload policy.
