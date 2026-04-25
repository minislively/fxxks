# React Native / WebView fixture candidate survey

_Last reviewed: 2026-04-25 via GitHub repository metadata and tree inspection._

This survey is the next step after the [React Native / WebView promotion ladder](roadmap.md#react-native--webview-promotion-ladder). It does **not** make React Native or embedded WebView a supported fooks lane. It only identifies public repositories that could seed a future evidence lane.

## Selection criteria

A repository is a good candidate when it satisfies most of these gates:

1. **Public and inspectable** — open source repository with a clear license or public contribution model.
2. **Recently active** — updated recently enough that fixture shape reflects current React Native practice.
3. **TS/TSX surface** — enough `.tsx` / `.ts` files to exercise fooks' TypeScript parser without inventing synthetic examples.
4. **Signal coverage** — covers at least one RN/WebView signal family:
   - native primitives: `View`, `Text`, `Image`, `ScrollView`;
   - interactions: `Pressable`, `TouchableOpacity`, gesture/event handlers;
   - styles: `StyleSheet.create`, inline styles, theme/token references;
   - platform/navigation: `Platform.select`, platform-specific files, route params, navigation hooks;
   - WebView boundaries: `react-native-webview`, `source`, injected JavaScript, `onMessage`, native/web bridge surfaces.
5. **Claim safety** — useful for fixture evidence without implying support for native platform behavior, bridge behavior, provider runtime tokens, or WebView security boundaries.

## Tier A: preferred seed candidates

| Candidate | Why it belongs in the first evidence pass | Useful fixture surfaces | Boundary / risk |
| --- | --- | --- | --- |
| [`react-native-webview/react-native-webview`](https://github.com/react-native-webview/react-native-webview) | Canonical WebView package; direct coverage for embedded WebView surfaces. Metadata snapshot: MIT, 7k+ stars, active on 2026-04-24. | `src/WebView.tsx`, `src/WebViewShared.tsx`, platform files such as `src/WebView.android.tsx`, `src/WebView.ios.tsx`, plus WebView type surfaces. | Great for WebView boundary detection, but it is a library implementation, not a product app. Do not generalize to all app workflows. |
| [`mattermost/mattermost-mobile`](https://github.com/mattermost/mattermost-mobile) | Large real-world React Native product app. Metadata snapshot: Apache-2.0, 2k+ stars, active on 2026-04-24. | Message composer, navigation header, image viewer, input accessory, and `Pressable`-style UI paths found in tree inspection. | Large corpus; sample narrowly to avoid benchmark noise and proprietary-service assumptions. |
| [`RocketChat/Rocket.Chat.ReactNative`](https://github.com/RocketChat/Rocket.Chat.ReactNative) | Real-world chat app with RN UI density. Metadata snapshot: MIT, 2k+ stars, active on 2026-04-24. | Message composer, autocomplete, image viewer, room/user UI, navigation-adjacent components. | Chat-app semantics overlap with Mattermost; avoid over-sampling one product category. |
| [`Expensify/App`](https://github.com/Expensify/App) | Very large cross-platform app with broad TS/TSX surface and platform-specific component variants. Metadata snapshot: MIT, 4k+ stars, active on 2026-04-25. | Platform-specific files such as `.android.tsx` / `.ios.tsx`, action-sheet and navigation-related surfaces, WebView mocks. | Huge repo; use as stress/reference only after the first small corpus is stable. |
| [`gronxb/webview-bridge`](https://github.com/gronxb/webview-bridge) | Focused TypeScript WebView bridge project with React Native and web examples. Metadata snapshot: MIT, 400+ stars, active on 2026-04-18. | `example/*/react-native/App.tsx`, bridge files under `example/*/react-native/src/bridge.ts`, and `packages/react-native/src/createWebView.tsx`. | Bridge-specific; useful for message-boundary evidence, not general RN component extraction. |

## Tier B: optional follow-up candidates

| Candidate | Why it may be useful later | Defer reason |
| --- | --- | --- |
| [`Jellify-Music/App`](https://github.com/Jellify-Music/App) | Cross-platform RN music app with navigation and media/control surfaces; metadata snapshot: MIT, 1k+ stars, active on 2026-04-24. | Good product diversity, but not needed until chat/WebView seeds are covered. |
| [`inokawa/react-native-react-bridge`](https://github.com/inokawa/react-native-react-bridge) | WebView-style React-to-RN bridge examples; metadata snapshot: MIT, active on 2026-04-09. | Smaller and more specialized than `gronxb/webview-bridge`; use only if bridge coverage is thin. |
| [`expo/expo`](https://github.com/expo/expo) | Large universal native app framework with React Native + web surfaces; metadata snapshot: MIT, very active. | Framework-scale repo can skew corpus selection; better as later stress/reference, not seed evidence. |
| [`react-navigation/react-navigation`](https://github.com/react-navigation/react-navigation) | Canonical navigation library for React Native and Web apps; active and high-signal for navigation semantics. | Library/framework surface, not a representative app component corpus; use for targeted navigation fixtures only. |

## Explicitly deferred / weak candidates

- Curated-list repos such as [`ReactNativeNews/React-Native-Apps`](https://github.com/ReactNativeNews/React-Native-Apps) and [`reactnativecn/react-native-guide`](https://github.com/reactnativecn/react-native-guide): useful discovery indexes, not fixture sources.
- Old or low-activity forks of Rocket.Chat / WebView examples: too stale for support-lane evidence.
- Single-purpose payment/WebView wrappers: useful only after the core WebView and bridge categories are represented.

## Recommended first fixture slice

Start with a small corpus before any extractor behavior change:

1. **WebView boundary fixture** — one file from `react-native-webview/react-native-webview` that includes WebView props, `source`, `onMessage`, or injected JavaScript behavior.
2. **Bridge fixture** — one `gronxb/webview-bridge` React Native example plus its paired bridge file.
3. **RN primitive/interaction fixture** — one Mattermost or Rocket.Chat component with native primitives and event handlers.
4. **Platform/navigation fixture** — one platform-specific or navigation-heavy file from Mattermost, Rocket.Chat, or Expensify.
5. **Negative fallback fixture** — one obvious RN/WebView file that should continue to trigger `unsupported-react-native-webview-boundary` until Level 3 of the promotion ladder is intentionally opened.

## Acceptance bar before moving to extractor prototype

Do not start RN/WebView extractor behavior until a candidate PR can show:

- fixture corpus selected with stable commit SHAs or pinned snapshots;
- each fixture mapped to a signal family and expected fallback/extract behavior;
- tests prove current unsupported/fallback wording remains intact;
- benchmark/evidence commands are documented;
- WebView files are reviewed for URL/source, injected JavaScript, and message-bridge boundaries before compact-payload reuse is allowed.

## Non-goals

- No public RN/WebView support claim from this survey.
- No provider-token, billing, runtime-token, or native platform correctness claim.
- No setup/doctor support promotion without fixture evidence.
- No extractor changes until a separate plan selects the experimental extractor lane.
