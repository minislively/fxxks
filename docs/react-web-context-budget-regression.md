# React Web context budget regression note

`reactWebContext.editTargetRouting` is ordered routing evidence, not required source context, but it is the most direct "where should the model edit?" signal in the React Web context envelope. When a repeated React Web edit payload crosses the metadata budget, the pre-read builder must trim lower-priority metadata groups before trimming edit routing.

This preserves the highest-priority edit route evidence (`priority: 1`, then `2`, etc.) without re-extracting or rereading component context. If lower-priority groups are exhausted and the payload still exceeds budget, the builder may trim `editTargetRouting` as an ordered prefix, and then omit `reactWebContext` as the final budget-safe fallback.

Focused regression: `test/pre-read-payload-builder.test.mjs` covers an oversized `HookEffectPanel.tsx` repeated-edit payload and locks that routing remains in original priority order while lower-priority metadata is trimmed first.
