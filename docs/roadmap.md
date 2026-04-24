# Roadmap and future evidence lanes

This page frames common "does fooks support X?" questions as future support or evidence lanes. These items are **not required** for the current strongest workflow: Codex repeated same-file React `.tsx` / `.jsx` context reduction, with a narrower experimental Codex-first `.ts` / `.js` same-file beta.

If the answer you want sounds like “Vue?”, “broader TS/JS?”, “multi-file?”, “read interception?”, “LSP rename/reference?”, or “provider parity?”, read that as a roadmap question unless another public doc explicitly says it already shipped.

## Current strongest workflow

- Runtime: Codex hooks prepared by `fooks setup`.
- Files: React `.tsx` / `.jsx` components (strongest path), plus experimental Codex-first `.ts` / `.js` same-file beta after supported setup.
- Pattern: repeated same-file work in one Codex session.
- Evidence: local model-facing prompt/context estimates, plus estimate-scoped API-cost evidence where the benchmark docs say the assumptions hold.

## Current narrow beta path

- Runtime: still Codex-first; this beta is not a provider-parity expansion.
- Files: same-file `.ts` / `.js` modules only when module signals are strong enough.
- Setup: strong TS/JS repos can qualify a Codex-only setup path, while Claude/opencode helper setup remains React-only in this release slice.
- Boundary: the beta does **not** imply Vue/SFC support, broader framework understanding, multi-file refactors, read interception, or LSP semantic safety.

## Deferred support lanes

| Lane | Why it matters | Current boundary |
| --- | --- | --- |
| Vue / Svelte / broader frontend frameworks | Would expand the component extraction model beyond React. | Not part of the current automatic path. |
| Broader `.ts` / `.js` coverage beyond the beta | Would make fooks useful outside React component loops more consistently. | Experimental Codex-first same-file `.ts` / `.js` beta exists, but it is module-signal gated, same-file only, and not provider-parity, multi-file, or semantic-safety support. |
| Claude/opencode parity | Would make non-Codex runtimes feel closer to the current strongest automatic path. | Claude/opencode remain narrower helper/manual paths and should not be described as Codex-equivalent automatic support. |
| Multi-file refactor context compression | Would support broader agentic refactors where several files must stay in view. | Current strongest path is repeated same-file work. |
| Read interception / provider-native read hooks | Would make runtime behavior broader than Codex repeated-file hooks. | Not claimed; unsupported cases should fall back to normal source reading. |
| LSP-backed semantic locations | Would strengthen rename/reference/edit safety beyond line-aware hints. | Decided in [`docs/lsp-extraction-boundary.md`](lsp-extraction-boundary.md): product extraction stays AST-only by default; LSP remains optional evaluation/proof work, not current support. |

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
