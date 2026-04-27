# Frontend domain fixture expectations

This document is the fixture expectation baseline for the RN/WebView/TUI domain-profile roadmap. It does **not** add runtime support, extractor behavior, setup eligibility, or public support wording. It only records which small local fixture slots should currently extract, fallback, or remain deferred before any later narrow implementation plan.

## Source policy

Selected first-pass fixtures are limited to `existing-local` or `synthetic-local` sources. Public repository candidates from `docs/rn-webview-fixture-candidates.md` remain reference-only for this pass. The first pass must not copy, vendor, or live-fetch external repository files.

## Selected fixture expectations

The machine-readable fixture expectation manifest at `test/fixtures/frontend-domain-expectations/manifest.json` is the source of truth for selected and deferred slots. This table mirrors that manifest so parallel domain work does not reinterpret selected fixtures differently.

| Slot | ID | Lane | Source kind | Path | Expected outcome | Required proof |
| --- | --- | --- | --- | --- | --- | --- |
| F0 | `react-web-regression-form-controls` | `react-web` | `existing-local` | `fixtures/compressed/FormControls.tsx` | `extract` | Existing React web extraction remains non-empty and current regressions pass. |
| F1 | `rn-primitive-basic` | `rn-primitive` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | RN primitives do not become DOM/form semantics. |
| F2 | `rn-style-platform-navigation` | `rn-style-platform` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-style-platform-navigation.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | Selected for the current fallback expectation only; `StyleSheet.create`, `Platform.select`, and navigation semantics remain non-promoted. |
| F3 | `webview-boundary-basic` | `webview-boundary` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | WebView `source`, injected JS, and `onMessage` remain boundary-first. |
| F4 | `webview-bridge-pair` | `webview-bridge` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/webview/checkout-bridge-native.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | Paired native/web checkout bridge fixtures remain fallback-boundary evidence only; the paired web source is recorded in `relatedSourcePaths`. |
| F5 | `tui-ink-basic` | `tui-ink` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx` | `extract` | This is only TSX/JSX syntax evidence for an Ink-like file; it is not a broad TUI support claim. |
| F6 | `negative-rn-webview-boundary` | `negative-fallback` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/negative-rn-webview-boundary.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | RN/WebView bridge-like markers do not receive compact payload reuse. |
| F9 | `rn-interaction-gesture` | `rn-interaction` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-interaction-gesture.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | Touchable and gesture markers remain RN evidence only; no gesture runtime safety claim. |
| F10 | `rn-image-scrollview` | `rn-image-scrollview` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-image-scrollview.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | Image, ScrollView, and Dimensions markers remain RN evidence only; no image loading safety claim. |

The selected baseline does not require a schema migration. `F2` is selected because today's expected behavior is a fallback boundary; its richer platform/navigation meaning remains outside the current support and extraction scope. `F4` is selected only as paired fallback-boundary evidence under the [WebView bridge boundary plan](webview-bridge-boundary-plan.md): its native fixture is the primary `path`, and its paired web fixture is recorded in `relatedSourcePaths`.

## Manifest shape guard

Selected fixtures must not carry deferred-only fields such as `deferReason` or `doesNotBlockBaseline`. Deferred fixtures must not carry executable fixture paths, expected outcomes, fallback reasons, required signals, or verification instructions. This keeps the manifest from describing the same slot as both selected and deferred while later RN/WebView/TUI/React Web work is split across branches.

## Deferred fixture slots

| Slot | ID | Lane | Reason |
| --- | --- | --- | --- |
| F7 | `tui-non-ink-cli-renderer` | `tui-non-ink` | Broad non-Ink terminal renderer semantics are not modeled by the current TSX fixture evidence lane. |

These deferrals do not block the current evidence baseline. They prevent broad non-Ink terminal UI semantics from being mixed into the fixture expectation lock; WebView bridge extraction, bridge safety, and compact-payload reuse remain out of scope even though `F4` now has paired fallback evidence.

## Forbidden claims

This baseline must not imply any of the following support promotions:

- React Native availability or current support.
- WebView availability or current support.
- TUI availability or current support.
- WebView compact-payload reuse or bridge safety promotion.

## Promotion boundary

A later implementation plan may use this baseline as evidence, but it must still pass a separate approval step before changing runtime behavior, setup eligibility, support wording, or WebView compact-payload policy.
