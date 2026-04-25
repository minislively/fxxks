# Roadmap and future evidence lanes

This page frames common "does fooks support X?" questions as future support or evidence lanes. These items are **not required** for the current strongest workflow: Codex repeated same-file React `.tsx` / `.jsx` context reduction, with a narrower experimental Codex-first `.ts` / `.js` same-file beta.

If the answer you want sounds like “React Native?”, “WebView?”, “Vue?”, “broader TS/JS?”, “multi-file?”, “read interception?”, “LSP rename/reference?”, or “provider parity?”, read that as a roadmap question unless another public doc explicitly says it already shipped.

## Current strongest workflow

- Runtime: Codex hooks prepared by `fooks setup`.
- Files: React `.tsx` / `.jsx` components (strongest path), plus experimental Codex-first `.ts` / `.js` same-file beta after supported setup.
- Pattern: repeated same-file work in one Codex session.
- Evidence: local model-facing prompt/context estimates, plus estimate-scoped API-cost evidence where the benchmark docs say the assumptions hold.

## Current narrow beta path

- Runtime: still Codex-first; this beta is not a provider-parity expansion.
- Files: same-file `.ts` / `.js` modules only when module signals are strong enough.
- Setup: strong TS/JS repos can qualify a Codex-only setup path, while Claude/opencode helper setup remains React-only in this release slice.
- Boundary: the beta does **not** imply React Native/WebView support, Vue/SFC support, broader framework understanding, multi-file refactors, read interception, or LSP semantic safety.

## Deferred support lanes

| Lane | Why it matters | Current boundary |
| --- | --- | --- |
| React Native / embedded WebView | Would require evidence for native component primitives, platform-specific semantics, bridge behavior, and WebView boundary/security assumptions rather than DOM/form/Tailwind-oriented React web signals. | Deferred. TSX parsing is syntax-level only and must not be read as RN/WebView support. Obvious RN/WebView files should use normal source reading unless future fixtures, benchmarks, and public evidence explicitly add this lane. |
| Vue / Svelte / broader frontend frameworks | Would expand the component extraction model beyond React. | Not part of the current automatic path. |
| Broader `.ts` / `.js` coverage beyond the beta | Would make fooks useful outside React component loops more consistently. | Experimental Codex-first same-file `.ts` / `.js` beta exists, but it is module-signal gated, same-file only, and not provider-parity, multi-file, or semantic-safety support. |
| Claude/opencode parity | Would make non-Codex runtimes feel closer to the current strongest automatic path. | Claude/opencode remain narrower helper/manual paths and should not be described as Codex-equivalent automatic support. |
| Multi-file refactor context compression | Would support broader agentic refactors where several files must stay in view. | Current strongest path is repeated same-file work. |
| Read interception / provider-native read hooks | Would make runtime behavior broader than Codex repeated-file hooks. | Not claimed; unsupported cases should fall back to normal source reading. |
| LSP-backed semantic locations | Would strengthen rename/reference/edit safety beyond line-aware hints. | Decided in [`docs/lsp-extraction-boundary.md`](lsp-extraction-boundary.md): product extraction stays AST-only by default; LSP remains optional evaluation/proof work, not current support. |

### React Native / WebView promotion ladder

React Native and embedded WebView should move through explicit evidence gates instead of jumping from “TSX parses” to “supported.” Treat this as a `frontend-family candidate` ladder:

| Level | Name | What must be true | Public wording allowed |
| --- | --- | --- | --- |
| 0 | Deferred/fallback boundary | Obvious RN/WebView markers fall back to normal source reading and docs say TSX parsing is syntax-only evidence. | “Deferred lane”; “not current support.” |
| 1 | Evidence-lane design | Fixture categories, pass/fail rules, claim boundaries, and benchmark commands are specified before extractor changes. | “Evidence candidate”; no runtime/support claim. |
| 2 | Fixture/benchmark evidence | Public RN/WebView fixtures exercise native primitives, interaction handlers, StyleSheet/style tokens, platform branches, navigation surfaces, and WebView source/injection boundaries without misleading compact payloads. | “Validated evidence lane” for the measured fixture scope only. |
| 3 | Experimental extractor candidate | RN/WebView-specific signals are implemented behind narrow tests and safe fallback rules, with no provider/runtime parity claim. | “Experimental same-file RN/WebView TSX candidate” if evidence remains green. |
| 4 | Narrow support wording | Repeated benchmark evidence and docs/tests prove the exact supported scope. | Narrow support wording for the measured same-file scope only. |

Promotion must stop at the first failed gate. WebView-related files deserve extra caution because URL/source, injected JavaScript, bridge behavior, and sandbox/security assumptions are semantic boundaries, not just JSX structure.

Recommended fixture categories before Level 3:

- React Native primitives: `View`, `Text`, `Image`, `ScrollView`.
- Interaction components: `Pressable`, `TouchableOpacity`, gesture/event handlers.
- Styling: `StyleSheet.create`, inline styles, theme/token references.
- Platform/navigation: `Platform.select`, route params, navigation hooks.
- Embedded WebView: `react-native-webview`, `source`, injected JavaScript, message bridge boundaries.

## Future evidence lanes

| Lane | Stronger claim it could unlock | Current boundary |
| --- | --- | --- |
| Provider tokenizer parity | Optional proof-only provider/model tokenizer accounting for isolated fixtures/payloads; see [Provider tokenizer proof boundary](provider-tokenizer-boundary.md). | `fooks compare` remains a local, dependency-free model-facing estimate; provider-tokenizer proof is not billing/cost/runtime-envelope proof. |
| Billing/dashboard reconciliation | Billing-grade wording for a measured scope. | Current benchmark evidence is not provider invoice/dashboard or actual charged-cost proof. |
| ccusage-style usage-log import boundaries | Better review bridges between local estimates, provider usage logs, and billing exports. | `fooks status` is local context-size telemetry only and is not a `ccusage` replacement. |
| Stable runtime-token/time benchmark class | Public runtime-token or latency wording if repeated quality-gated runs support it. | Existing direct runtime-token/time evidence is unstable or negative in documented diagnostics. |
| Applied-code quality benchmark | Stronger claims about edit outcomes, not just context size. | Current edit-guidance evidence is local/dry-run unless benchmark docs say otherwise. |

## How to read open issues

Open issues in these lanes should be treated as enhancement or stronger-evidence work unless they contradict the current documented Codex repeated React workflow. They should not be used as shorthand for "the core product is unproven" without checking the current claim boundary in [`benchmark-evidence.md`](benchmark-evidence.md) and [`release.md`](release.md).
