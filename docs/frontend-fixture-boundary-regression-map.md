# Frontend fixture boundary regression map

This is the compact review map for the RN/WebView/TUI fixture boundary. It does **not** add or broaden platform support. Use it when editing `test/fixtures/frontend-domain-expectations/manifest.json`, fixture files, or fixture-boundary tests so evidence does not drift into support wording.

## Regression map

| Slot | Lane | Boundary label | Detector expectation | Pre-read expectation | Must not claim | Review cue |
| --- | --- | --- | --- | --- | --- | --- |
| `F1` | RN primitive/input | measured narrow payload | `fallback`, `unsupported-react-native-webview-boundary` | `payload` only through `rn-primitive-input-narrow-payload` | React Native support, DOM/form inference, broad RN payload reuse | If this payload gate changes, prove it remains primitive/input-only and does not cover `F2`, `F9`, or `F10`. |
| `F13` | RN primitive/input adjacent | measured narrow payload | `fallback`, `unsupported-react-native-webview-boundary` | `payload` only through `rn-primitive-input-narrow-payload` | React Native support, DOM/form inference, broad RN payload reuse | Same-file local handler/callback evidence must stay F1-adjacent and must not cover `F2`, `F9`, `F10`, WebView, TUI/Ink, or React Web signals. |
| `F2` | RN style/platform/navigation | readiness evidence only | `fallback`, `unsupported-react-native-webview-boundary` | `fallback`, `unsupported-frontend-domain-profile` | React Native support, navigation runtime guarantee, DOM/form inference | `StyleSheet`, `Platform`, and navigation markers are evidence only. |
| `F9` | RN interaction/list | readiness evidence only | `fallback`, `unsupported-react-native-webview-boundary` | `fallback`, `unsupported-frontend-domain-profile` | React Native support, gesture safety, list virtualization support | Touchable/list/gesture markers must not inherit the `F1` payload policy. |
| `F10` | RN media/layout | readiness evidence only | `fallback`, `unsupported-react-native-webview-boundary` | `fallback`, `unsupported-frontend-domain-profile` | React Native support, image loading safety, layout support | Image/ScrollView/Dimensions markers are evidence only. |
| `F3` | WebView boundary | fallback-only boundary | `fallback`, `unsupported-react-native-webview-boundary` | `fallback`, `unsupported-react-native-webview-boundary` | WebView support, bridge safety, compact-payload reuse | Edit-guidance requests must still stop before payload construction. |
| `F4` | WebView bridge pair | fallback-only boundary | `fallback`, `unsupported-react-native-webview-boundary` | `fallback`, `unsupported-react-native-webview-boundary` | WebView support, bridge safety, compact-payload reuse | Native/web paired evidence stays local and diagnostic-only. |
| `F6` | RN + WebView negative boundary | fallback-only boundary | `fallback`, `unsupported-react-native-webview-boundary` | `fallback`, `unsupported-react-native-webview-boundary` | WebView support, bridge safety, compact-payload reuse | Mixed RN/WebView evidence must choose the boundary fallback over any compact payload. |
| `F5` | TUI/Ink | syntax-only evidence | extractable TSX syntax evidence | `fallback`, `unsupported-frontend-domain-profile` | TUI/Ink support, terminal correctness, terminal UX safety, token/cost/performance savings, default compact extraction | Extraction proves parser traversal only; pre-read must not build a default TUI payload. |
| `F7` | TUI non-Ink | deferred | no executable fixture path | no executable fixture path | broad terminal renderer support | Keep deferred until a separate non-Ink terminal semantics plan exists. |

## Review checklist

- Keep every RN/WebView/TUI selected fixture at `supportClaim: "none"`.
- Keep WebView slots `F3`, `F4`, and `F6` at `evidenceScope: "fallback-boundary-evidence-only"`.
- Keep TUI slot `F5` at `evidenceScope: "syntax-evidence-only"`.
- Keep only RN slots `F1` and `F13` on `payloadPolicy: "rn-primitive-input-narrow-payload"`; the other selected RN slots stay readiness-only fallback evidence.
- Keep any future RN F1-adjacent fixture gap limited to one primitive/input axis; do not mix in `F2`, `F9`, `F10`, WebView, TUI, or React Web signals.
- Require a named missing primitive/input acceptance check before adding an F1-adjacent fixture file or changing runtime behavior; otherwise record a no-op audit.
- Do not add support, setup-eligibility, runtime-token, provider-token, billing, performance, terminal-safety, bridge-safety, or default compact-extraction claims from these fixtures.
