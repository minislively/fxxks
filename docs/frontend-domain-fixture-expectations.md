# Frontend domain fixture expectations

This document is the fixture expectation baseline for the RN/WebView/TUI domain-profile roadmap. It does **not** add runtime support, extractor behavior, setup eligibility, or public support wording. It only records which small local fixture slots should currently extract, fallback, or remain deferred before any later narrow implementation plan.

## Source policy

Selected first-pass fixtures are limited to `existing-local` or `synthetic-local` sources. Public repository candidates from `docs/rn-webview-fixture-candidates.md` remain reference-only for this pass. The first pass must not copy, vendor, or live-fetch external repository files.

## Selected fixture expectations

The machine-readable fixture expectation manifest at `test/fixtures/frontend-domain-expectations/manifest.json` is the source of truth for selected and deferred slots. This table mirrors that manifest so parallel domain work does not reinterpret selected fixtures differently.

| Slot | ID | Lane | Source kind | Path | Expected outcome | Required proof |
| --- | --- | --- | --- | --- | --- | --- |
| F0 | `react-web-regression-form-controls` | `react-web` | `existing-local` | `fixtures/compressed/FormControls.tsx` | `extract` | Existing React web extraction remains non-empty and current regressions pass. |
| F1 | `rn-primitive-basic` | `rn-primitive` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx` | detector `fallback` with `unsupported-react-native-webview-boundary`; pre-read `payload` only through `rn-primitive-input-narrow-payload` | RN primitives and RN input/press props may use the narrow payload gate, but this is not broad RN support and not DOM/form semantic inference. |
| F2 | `rn-style-platform-navigation` | `rn-style-platform` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-style-platform-navigation.tsx` | detector `fallback` with `unsupported-react-native-webview-boundary`; pre-read `fallback` with `unsupported-frontend-domain-profile` | Selected for the current fallback expectation only; `StyleSheet.create`, `Platform.select`, navigation hooks, `route.params`, and navigation semantics remain non-promoted. |
| F3 | `webview-boundary-basic` | `webview-boundary` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | WebView `source`, injected JS, and `onMessage` remain boundary-first. |
| F4 | `webview-bridge-pair` | `webview-bridge` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/webview/checkout-bridge-native.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | Paired native/web checkout bridge fixtures remain fallback-boundary evidence only; the paired web source is recorded in `relatedSourcePaths`. |
| F5 | `tui-ink-basic` | `tui-ink` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx` | `extract` | This is only TSX/JSX syntax evidence for an Ink-like file; it is not a broad TUI support claim. |
| F6 | `negative-rn-webview-boundary` | `negative-fallback` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/negative-rn-webview-boundary.tsx` | `fallback` with `unsupported-react-native-webview-boundary` | RN/WebView bridge-like markers do not receive compact payload reuse. |
| F9 | `rn-interaction-gesture` | `rn-interaction` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-interaction-gesture.tsx` | detector `fallback` with `unsupported-react-native-webview-boundary`; pre-read `fallback` with `unsupported-frontend-domain-profile` | Touchable, FlatList, PanResponder, and gesture prop markers remain RN evidence only; no gesture runtime safety claim. |
| F10 | `rn-image-scrollview` | `rn-image-scrollview` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/rn-image-scrollview.tsx` | detector `fallback` with `unsupported-react-native-webview-boundary`; pre-read `fallback` with `unsupported-frontend-domain-profile` | Image, ScrollView, Dimensions, paging, and resize markers remain RN evidence only; no image loading safety claim. |
| F11 | `react-web-custom-design-system-card` | `react-web` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/react-web/custom-design-system-card.tsx` | `extract` | Custom-component-only React Web card fixture proves `className` can gate current-lane payload reuse without lowercase DOM tags. |
| F12 | `react-web-custom-form-shell` | `react-web` | `synthetic-local` | `test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx` | `extract` | Custom-component-only React Web form shell proves `className`/`htmlFor` evidence remains React Web only and does not promote non-web lanes. |

The selected baseline does not require a schema migration. `F1` is the only selected RN primitive/input narrow payload candidate; its detector expectation remains fallback-boundary evidence while pre-read may return payload through `rn-primitive-input-narrow-payload`. `F2` is selected because today's expected behavior is a fallback boundary; its richer platform/navigation meaning remains outside the current support and extraction scope. `F4` is selected only as paired fallback-boundary evidence under the [WebView bridge boundary plan](webview-bridge-boundary-plan.md): its native fixture is the primary `path`, and its paired web fixture is recorded in `relatedSourcePaths`. `F11` and `F12` are selected React Web runtime-gate fixtures: they are local synthetic design-system-style components used to prove the current supported lane handles custom JSX components with web-specific attributes before any RN/WebView/TUI lane is promoted.

## WebView boundary hardening gate

The WebView fixture lane is fallback-first even when pre-read edit guidance is requested. `F3`, `F4`, and `F6` must return the `unsupported-react-native-webview-boundary` fallback without constructing a compact payload. Detector evidence may record boundary facts such as WebView `source` object shape, `injectedJavaScript`, `onMessage`, and native/web `postMessage` markers, but those facts remain diagnosis evidence only.

Mixed DOM plus WebView snippets must choose the safety fallback over the React Web current-supported lane. Bare `<WebView>` snippets without an import are also treated as WebView boundary evidence so embedded HTML strings and bridge markers do not accidentally unlock React Web payload reuse.


## RN component semantics readiness gate

The RN fixture lane is a readiness gate, not a support promise. `F1` is the first narrow runtime candidate and is limited to primitive/input payload reuse through `rn-primitive-input-narrow-payload`; it is not broad React Native support. Other selected RN fixtures stay fallback/evidence-only until a later detector/profile promotion plan explicitly changes runtime behavior. The current fallback reason, `unsupported-react-native-webview-boundary`, is still the shared source-reading boundary reason for detector evidence and WebView/mixed boundaries; it must not be treated as a permanent domain model for every RN semantic.

| Semantics group | Selected slots | Evidence examples | Required boundary |
| --- | --- | --- | --- |
| Primitives/input | `F1` | `View`, `Text`, `TextInput`, `Pressable`, `onChangeText`, `onPress` | Only this measured primitive/input fixture family may pass the narrow RN payload policy; it must not be reinterpreted as DOM controls, forms, broad RN support, or React Web extraction evidence. |
| Style/platform/navigation | `F2` | `StyleSheet.create`, `Platform.select`, `useNavigation`, `useRoute`, `route.params` | Style and navigation markers remain RN evidence only; no navigation runtime guarantee. |
| Interaction/list | `F9` | `TouchableOpacity`, `FlatList`, `PanResponder.create`, gesture handlers, `activeOpacity` | Interaction and list markers remain fallback-boundary evidence only; no gesture, list virtualization, or runtime safety claim. |
| Media/layout | `F10` | `Image`, `ScrollView`, `Dimensions.get`, `resizeMode`, `pagingEnabled` | Media and layout markers remain fallback-boundary evidence only; no image loading, layout, or RN support claim. |

Execution for later RN gates should prefer strengthening docs, manifest metadata, and regression tests around existing RN fixture slots before adding new synthetic fixtures. This first gate is intentionally limited to `F1`; `F2`, `F9`, and `F10` remain fallback/readiness-only.

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
