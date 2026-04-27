# WebView bridge boundary plan

This plan keeps fixture slot `F4` (`webview-bridge-pair`) deferred until a separate security and boundary review approves a measured fixture pair. It does **not** add WebView support, compact-payload reuse, bridge safety guarantees, runtime behavior, pre-read behavior, setup eligibility, or public support wording.

## Why this stays deferred

WebView bridge code is not just frontend TSX. A bridge pair can combine native React Native code, embedded HTML or web React code, injected JavaScript strings, `postMessage` / `onMessage` boundaries, and serialization or validation logic. Compressing or reusing compact payloads across that boundary can hide the exact message contract that a maintainer needs to inspect.

`F4` therefore remains deferred until a later PR names a narrow fixture pair and proves that fallback-first behavior is still preserved.

## Required fixture pair before promotion

A future `F4` promotion must use only local or synthetic-local fixtures unless a separate public-corpus approval explicitly pins external source provenance. The minimum pair is:

1. **Native side fixture** — a React Native file that renders `WebView`, defines `source` or injected JavaScript, and handles `onMessage` or bridge callbacks.
2. **Web side fixture** — the paired HTML/web React/JavaScript surface that calls `postMessage` or receives native bridge messages.
3. **Boundary contract note** — a short explanation of the message names, payload shape, trust boundary, and why fallback remains the expected outcome.

## Promotion gates

Promotion from deferred to selected may happen only after all gates are true:

1. The manifest still has exactly one expected outcome for the bridge pair.
2. The expected outcome is `fallback` unless a later security review explicitly approves a narrower extraction profile.
3. `unsupported-react-native-webview-boundary` remains the fallback reason for native WebView bridge files.
4. The docs avoid WebView support, bridge safety, and compact-payload reuse claims.
5. Tests prove the native side and web side stay paired and local.
6. The PR states that WebView bridge evidence is not general React Native, React Web, or WebView support.

## Explicit non-goals

- No WebView compact-payload reuse.
- No bridge safety claim.
- No automatic extraction across native/web message boundaries.
- No public repository vendoring or live fetch.
- No manifest schema migration.
- No runtime, CLI, setup, or pre-read behavior change.
