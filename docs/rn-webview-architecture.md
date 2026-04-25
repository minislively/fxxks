# React Native / WebView architecture direction

This note answers the issue #182 design question before any extractor promotion: keep the existing TypeScript AST core, but split platform/domain interpretation into explicit signal profiles. It is a roadmap architecture commitment, not a public support promise, timeline, or default WebView compact-extraction plan.

## Current structure

Today fooks has one shared syntax-reading foundation and a narrow supported interpretation layer:

- **TypeScript AST core:** `src/core/extract.ts` parses TS/TSX/JS/JSX source and derives syntax-level exports, component names, props, structure, behavior, style, snippets, and source ranges. This proves the parser can read a file shape; it does not prove framework/runtime semantics.
- **Web React signal families:** the current strongest extractor interpretation is tuned for web React component work: component contracts, DOM-ish form/control signals, hook/effect intent, event handlers, style systems, conditional rendering, and line-aware edit anchors.
- **Pre-read fallback boundary:** `src/adapters/pre-read.ts` detects obvious React Native / WebView markers such as `react-native`, `react-native-webview`, and `<WebView>` and returns `unsupported-react-native-webview-boundary` so those files use normal full-source reading instead of compact payload reuse.
- **Evidence docs:** `docs/roadmap.md`, `docs/rn-webview-fixture-candidates.md`, and `docs/benchmark-evidence.md` separate fixture/evidence gates from public support claims. Existing benchmark evidence is about current supported/profiled lanes, not RN/WebView support.

## Why not bolt RN/WebView into the web extractor

React Native and embedded WebView share TSX syntax with web React, but the useful and risky signals are different:

- RN primitives (`View`, `Text`, `Image`, `ScrollView`, `Pressable`, `TouchableOpacity`) are not DOM nodes, and web form/style assumptions can mislead model-facing summaries.
- RN style and platform semantics (`StyleSheet.create`, platform-specific files, `Platform.select`, navigation hooks, route params) need profile-specific interpretation rather than web-style heuristics.
- WebView is a boundary object: `source`, injected JavaScript, `onMessage`, bridge code, URL trust, and sandbox/security assumptions are behavioral and security boundaries, not just JSX structure.
- Mixing these into the web profile would make fallback policy, benchmark evidence, and support wording harder to audit. It would also increase the risk of compact payload reuse for files whose safest behavior is still full-source reading.

The architecture direction is therefore: **shared TypeScript AST core, separate domain signal profiles**.

## Proposed lane split

1. **Platform detector / boundary lane**
   - Keep a small detector that classifies web React, React Native, WebView, TUI/CLI, unknown, and mixed files from imports, JSX tags, filename/platform suffixes, and package markers.
   - Boundary classifications may force fallback even when the TSX syntax parses successfully.

2. **Domain signal profiles**
   - **Web React profile (current default):** keep the existing web-oriented component, behavior, structure, form/control, style, and edit-guidance signals.
   - **React Native primitive profile (future):** model native primitives, interaction components, RN style tokens, platform branches, navigation/route surfaces, and native-safe fallback rules.
   - **WebView boundary/fallback profile (start here):** initially classify and preserve WebView files as fallback-only. A later experimental profile may summarize `source`, injected JavaScript, bridge/message handlers, URL/trust assumptions, and security-sensitive boundaries only after fixtures and claim gates pass.
   - **TUI/CLI profile candidate (future):** Ink and other React TUI files can naturally fit the profile split, but this issue only commits the architecture direction. No TUI implementation is scoped here.

3. **Fixture corpus / evidence harness lane**
   - Promote only from pinned public fixtures with stable SHAs or snapshots.
   - Map every fixture to a profile, signal family, expected fallback/extract behavior, and benchmark command.
   - Keep WebView boundary fixtures in the corpus even after future extraction experiments so fallback safety remains regression-tested.

4. **Opt-in extraction policy lane**
   - WebView compact extraction must not become default from syntax detection alone.
   - Any RN/WebView compact payload should begin behind an explicit experimental policy, profile-specific readiness checks, conservative payload budgets, and full-source fallback on weak or mixed signals.

5. **Claim gate lane**
   - Docs and release wording can commit to the architecture direction and staged gates now.
   - Docs must not promise RN/WebView public support, a delivery timeline, provider/runtime savings, native platform correctness, WebView security correctness, or default WebView compact extraction.

## Staged promotion plan

| Stage | Goal | Exit gate | Public wording |
| --- | --- | --- | --- |
| 0 | Current boundary | RN/WebView markers continue to fall back to full-source reading. | Deferred lane; not current support. |
| 1 | Architecture/profile design | This note, roadmap links, and doc regression tests describe the split and claim boundary. | Architecture direction and staged gates only. |
| 2 | Fixture corpus | Pinned RN primitive, platform/navigation, WebView boundary, bridge/message, and negative fallback fixtures are selected. | Evidence candidate, no support claim. |
| 3 | Detector/profile prototype | Platform detector and profile interfaces classify fixtures while WebView remains fallback by default. | Experimental internal profile classification if tests pass. |
| 4 | Opt-in RN extraction experiment | RN primitive profile emits compact payloads only for measured same-file fixtures with safe fallback. | Experimental RN candidate for measured scope only. |
| 5 | WebView opt-in experiment | WebView source/message/security summaries are proven on boundary fixtures and remain opt-in. | Experimental WebView candidate only if claim gate allows it. |
| 6 | Narrow support wording | Repeated fixture and benchmark evidence proves the exact same-file scope. | Narrow support wording for the measured scope only. |

Promotion stops at the first failed gate. WebView can remain a boundary/fallback profile indefinitely if evidence does not justify compact extraction.

## Concrete next actions

1. Preserve the current `unsupported-react-native-webview-boundary` pre-read behavior while design work continues.
2. Add a platform/profile detector design sketch before changing extractor output shapes.
3. Pin the first RN/WebView fixture slice from `docs/rn-webview-fixture-candidates.md` and label each fixture with its expected profile and fallback/extract behavior.
4. Add regression tests that protect the profile split, WebView fallback default, and no-support/no-timeline wording.
5. Only after the fixture/evidence lane is green, prototype RN primitive signals behind an opt-in policy; keep WebView as fallback-only until its bridge/source/message/security model has separate evidence.
