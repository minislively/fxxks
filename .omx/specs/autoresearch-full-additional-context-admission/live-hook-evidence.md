# React Web live/native hook dogfood evidence

Local built-CLI/native-hook dogfood evidence only: proves bounded React Web graph-assisted context is observable through an isolated attached replay path. It is not provider tokenizer output, not runtime-token savings, not cache performance, not latency, not provider cost, billing, invoice, or charged-cost proof, and not broad React Web/RN/WebView/TUI support.

## Summary

- Measurement: built-cli-native-hook-dogfood-replay
- Isolated attached replay: yes
- Graph-assisted path observed: yes (diagnostic-only)
- Validation passed: yes

## Success replay

- Target: `src/components/FormSection.tsx`
- Prompt shape: repeated same-file edit-intent prompts
- Pre-read graph: freshness=fresh, selected=8, deferred=27, diagnostic-only=yes
- First native hook: emitted=no (record-only empty stdout expected)
- Second native hook: additionalContext=yes, contains reactWebFactGraph=no
- Runtime graph artifact: reason=source-relative-budget-exceeded, freshness=fresh, selected=3, diagnostic-only=yes
- Artifact identity matches replay target: yes

## Fixture matrix

- Fixture count: 6
- Graph diagnostics observed: 6/6
- Graph included in final additionalContext: 0/6
- Runtime graph included in artifact diagnostics: 2/6
- Graph skipped for source-relative budget: 4/6
- First prompts record-only: 6/6
- Artifact identity matches: 6/6
- AdditionalContext smaller than local source: 6/6
- Expanded additionalContext rows: 0/6
- AdditionalContext admission diagnostics: 6/6
- AdditionalContext admitted rows: 0/6
- AdditionalContext discarded rows: 6/6
- AdditionalContext discard reasons: {"candidate-not-smaller-than-source":5,"reduction-below-threshold":1}
- Local additionalContext reduction range: 88.418% to 96.63%
- Claimable as broad token/cost savings: no
- Claim boundary: Live/native hook fixture-matrix evidence only: local source bytes are compared with host-facing additionalContext bytes after built CLI replay. This is not provider tokenizer output, not provider billing/cost proof, and not a broad runtime-token claim.

## Boundary replay

- Target: `src/components/SimpleButton.tsx`
- Graph context leaked: no
- Diagnostic-only: yes

## Non-claims

- Provider token/cost/billing/invoice savings: no
- Cache performance or latency improvement: no
- Broad runtime-token savings: no
- Broad React Web/RN/WebView/TUI support: no
- Stale graph reuse: no
