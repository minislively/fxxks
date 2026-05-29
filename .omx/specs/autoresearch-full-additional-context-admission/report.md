# Autoresearch: full additionalContext admission gate

## Verdict

Implement the next priority as a whole-candidate admission/discard gate for React Web edit-guidance runtime `additionalContext`. PR #1118 only removed `reactWebFactGraph` when graph JSON made small sources worse; it did **not** decide whether the final host-facing `additionalContext` candidate was worth injecting. The local evidence shows that gap clearly: after the graph-only gate, the measured edit fixture matrix still had candidates whose source-relative compression was weak or negative before fallback.

## External patterns checked

- Sourcegraph Cody treats context as a selected prompt component, not a blanket dump: Cody combines keyword/search/code-graph sources and relies on relevance selection for codebase-aware answers. It also explicitly notes that more context has latency/efficiency tradeoffs and that context windows are bounded. Sources: https://sourcegraph.com/docs/cody/core-concepts/context and https://sourcegraph.com/blog/how-cody-understands-your-codebase
- Cody's implementation write-up describes ranked snippets and a global ranking, then taking the first N snippets as a function of snippet length. That maps well to a local “candidate must justify its byte cost” gate. Source: https://sourcegraph.com/blog/how-cody-understands-your-codebase
- Aider's repo map is explicitly optimized into an active token budget and includes only important identifiers / portions of the map. Source: https://aider.chat/docs/repomap.html
- Continue's codebase provider historically used retrieve-then-final selection (`nRetrieve`, `nFinal`) and optional reranking; it also documents cases where broad codebase context is not useful. Source: https://docs.continue.dev/reference/deprecated-codebase
- Cursor's indexing docs emphasize indexed-codebase context, incremental synchronization, and ignoring large irrelevant files to improve answer accuracy. Source: https://docs.cursor.com/chat/codebase

## Local diagnosis

The relevant failure mode is not “graph exists” but “final additionalContext is not a compression product.” A generated candidate can become a friendly restatement with labels, metadata, graph JSON, and source anchors. That can be larger than the source or only slightly smaller. In that case, injecting it is worse than telling the AI to read the original file.

The correct gate is source-relative and candidate-level:

1. Build the React Web edit-guidance candidate as before.
2. Measure `candidateBytes` against `sourceBytes`.
3. Reject when:
   - source is too tiny to justify a generated edit-guidance context,
   - `candidateBytes >= sourceBytes`, or
   - `reductionPct < minimumReductionPct`.
4. If rejected, emit a normal fallback/full-read instruction and record diagnostics.
5. Count only admitted candidates as context-compression successes.

## Recommended threshold

Use a conservative default that preserves existing read-only context behavior and gates only edit-guidance candidates:

- `minSourceBytes = 1024`
- `minReductionPct = 25`

Why not 4096? The existing runtime tests include useful short read-only React Web contexts. A 4096 source floor would wrongly suppress non-edit diagnostic anchors. Applying the gate to edit-guidance candidates keeps the guard aligned with the costly graph/edit path while preserving read-only source-anchor behavior.

## Implemented shape

- Runtime debug records `additionalContextAdmission` with:
  - `admitted`
  - `reason`
  - `sourceBytes`
  - `candidateBytes`
  - `reductionPct`
  - threshold metadata
- Reject reasons:
  - `source-too-small`
  - `candidate-not-smaller-than-source`
  - `reduction-below-threshold`
- Rejected edit-guidance candidates return fallback/full-read instead of injecting an inefficient generated context.
- Evidence artifacts include the admission diagnostic so graph freshness can still be inspected even when the generated context is discarded.

## Validation evidence

Local built-CLI/native-hook dogfood matrix after implementation:

- validation: passed
- fixture count: 6
- graph diagnostics preserved: 6/6
- runtime graph included in artifact diagnostics: 2/6
- graph skipped for source-relative budget: 4/6
- admission diagnostics observed: 6/6
- admitted additionalContext rows: 0/6
- discarded additionalContext rows: 6/6
- discard reasons: `candidate-not-smaller-than-source` 5, `reduction-below-threshold` 1

This result is intentionally stricter than PR #1118: the final output no longer treats fallback-size shrinkage as a compression success. Success is only counted when the generated candidate itself passes the admission gate.

Evidence files:

- `.omx/specs/autoresearch-full-additional-context-admission/live-hook-evidence.json`
- `.omx/specs/autoresearch-full-additional-context-admission/live-hook-evidence.md`
