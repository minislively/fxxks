# React Web context budget regression note

`reactWebContext.editTargetRouting` is ordered routing evidence, not required source context. When a repeated React Web edit payload crosses the metadata budget, the pre-read builder must trim that array as a stable prefix before considering full `reactWebContext` fallback.

This preserves the highest-priority edit route evidence (`priority: 1`, then `2`, etc.) without re-extracting or rereading component context. If the payload still exceeds the budget after the routing prefix is exhausted, the builder may omit `editTargetRouting`, and then omit `reactWebContext` as the final budget-safe fallback.

Focused regression: `test/pre-read-payload-builder.test.mjs` covers an oversized `HookEffectPanel.tsx` repeated-edit payload and locks that trimmed routing remains in original priority order while the rest of `reactWebContext` stays available.
