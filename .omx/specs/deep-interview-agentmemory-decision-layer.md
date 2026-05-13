# Deep interview note — agentmemory lesson for React Web Decision Layer

## Source-evidence authority principle

Issue #782 only imports the useful boundary lesson from the `agentmemory` comparison. `agentmemory` can remember prior agent/session context; `fooks` decides current frontend work from current source evidence.

For the current React Web Decision Layer:

```text
current source evidence > advisory context / repo convention / historical memory
confidence high != apply authority
```

## Decision for this pass

- Preserve the additive `react-web-decision.v1` contract.
- Do not add authority/freshness schema fields such as `evidenceFreshness`, `decisionBasis`, or `contextAuthority`.
- Keep repo-owned convention hints and compact `contextHints` advisory only.
- Keep `allowedActions.applyPatch: false`, `allowedActions.generateCopy: false`, `autoApply: false`, and `humanReviewRequired: true` as hard boundaries.
- Keep dry-run projections as inventory rows only, even when preview/context evidence exists.

## Future-agent warning

Do not promote memory, cached context, repo convention, or a high-confidence label into edit authority. If future work adds apply behavior, generated copy, broader policy gates, or freshness semantics, it needs a separate design, schema, and regression suite.
