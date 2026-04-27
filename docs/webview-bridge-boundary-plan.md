# WebView bridge boundary plan

This plan keeps fixture slot `F4` (`webview-bridge-pair`) as **selected fallback-boundary evidence** after the readiness gate from PR #215. It does **not** add WebView support, compact-payload reuse, bridge safety guarantees, runtime behavior, pre-read behavior, setup eligibility, or public support wording.

## Selected fallback-evidence boundary

`F4` now names a measured synthetic-local native/web fixture pair. The pair is selected only to prove that WebView bridge-shaped code stays fallback-first; it is not an extraction profile, support claim, safety claim, or compact-payload reuse approval.

The synthetic bridge pair remains a separate lane from detector/runtime work. Its expected outcome is `fallback` unless a separate security review approves a narrower extraction profile.

## Why extraction still stays deferred

WebView bridge code is not just frontend TSX. A bridge pair can combine native React Native code, embedded HTML or web React code, injected JavaScript strings, `postMessage` / `onMessage` boundaries, and serialization or validation logic. Compressing or reusing compact payloads across that boundary can hide the exact message contract that a maintainer needs to inspect.

`F4` therefore provides fallback evidence only. It names a narrow fixture pair and proves that fallback-first behavior is still preserved.

## Fixture pair

The current `F4` pair uses only local or synthetic-local fixtures:

1. **Native side fixture** — `test/fixtures/frontend-domain-expectations/webview/checkout-bridge-native.tsx` renders `WebView`, defines a synthetic local `source`, and handles `onMessage` for a narrow checkout bridge callback.
2. **Web side fixture** — `test/fixtures/frontend-domain-expectations/webview/checkout-bridge-web.html` calls `window.ReactNativeWebView.postMessage` with a narrow checkout message.
3. **Boundary contract note** — the message contract is `checkout.submit` with a small payload (`cartId`, `totalCents`) and an optional `checkout.ack` acknowledgement path. The trust boundary is the native/web message boundary; fallback remains expected because fooks does not model WebView bridge safety or compact-payload reuse across that boundary.

## Promotion gates for any future extraction work

Promotion from fallback evidence to extraction may happen only after all gates are true:

1. The manifest still has exactly one expected outcome for the bridge pair.
2. The expected outcome is `fallback` unless a later security review explicitly approves a narrower extraction profile.
3. `unsupported-react-native-webview-boundary` remains the fallback reason for native WebView bridge files until such a review exists.
4. The docs avoid WebView support, bridge safety, and compact-payload reuse claims.
5. Tests prove the native side and web side stay paired and local.
6. The PR states that WebView bridge evidence is not general React Native, React Web, or WebView support.

## Explicit non-goals

- No WebView compact-payload reuse.
- No bridge safety claim.
- No automatic extraction across native/web message boundaries.
- No detector, extractor, runtime, pre-read, setup, or CLI behavior change in the paired-fixture evidence PR.
- No public repository vendoring or live fetch.
- No manifest schema migration.
