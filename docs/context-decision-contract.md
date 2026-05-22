# Context decision contract

`context-decision.v1` is an explicit report-only CLI appendix for inspecting how fooks would classify a one-file context planning situation.

Command:

```sh
fooks inspect-domain <file> --json --context-decision
```

The appendix is emitted as top-level `contextDecision` only when `--context-decision` is passed. Plain `inspect-domain --json` output remains unchanged. `--context-decision` requires `--json`.

## What it records

`contextDecision` keeps the architecture axes that were previously at risk of becoming many separate `react-web-*.ts` cases:

- `scope`: exact file prompt specificity, selected files, and `sourceFingerprint.fileHash` / `sourceFingerprint.lineCount` freshness anchors.
- `environment`: report surface, runtime name, capability lane, and a small context-budget summary.
- `evidence`: detected domain, concern ids, freshness state, and risk flags such as fallback-first, mixed-domain, WebView, or policy-denied evidence.
- `decision`: one of `full-read`, `report-only`, `compact-context`, `narrow-payload`, or `defer`.
- `policy`: always `allowed: false` in this first slice.
- `nonClaims`: explicit boundaries for runtime, pre-read, cache, setup-readiness, model-facing reuse, support expansion, browser runtime proof, accessibility audit, multi-file correctness, and provider-token/cost/latency claims.

## Decision meanings

- `full-read`: fallback-first boundary; current source should be read directly.
- `report-only`: evidence exists, but the current slice does not authorize reuse.
- `compact-context`: diagnostic React Web compact-context shape only; `diagnosticOnly: true` and `policy.allowed: false` mean it does not authorize runtime, pre-read, cache, setup-readiness, or model-facing reuse.
- `narrow-payload`: diagnostic React Native narrow-payload shape only; `diagnosticOnly: true` and `policy.allowed: false` mean it does not expand React Native support.
- `defer`: insufficient or evidence-only lane such as unknown/shared/TUI should not be promoted.

## Boundary

`context-decision.v1` is a planning/reporting contract, not an execution policy. It does not change detector behavior, runtime adapters, pre-read behavior, cache storage, setup readiness, model-facing payload schemas, React Native support, WebView support, broad TUI semantics, or provider-token/cost/latency claims.

Policy remains the permission owner. A diagnostic `compact-context` or `narrow-payload` decision is useful metadata for later planning, but it is not permission to reuse context unless a separate payload-policy/runtime path explicitly authorizes it.
