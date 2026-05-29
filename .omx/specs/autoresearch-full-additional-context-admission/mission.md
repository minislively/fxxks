# Autoresearch mission: full additionalContext admission gate

Research and validate the next React Web context-management priority: move beyond graph-only source-relative skipping into a whole additionalContext candidate admission/discard gate.

Questions:
- How do comparable AI coding context systems avoid wasting context budget?
- What local gate should decide whether a generated additionalContext candidate is worth injecting?
- How should fooks record failures so only accepted compact candidates count as success?

Expected implementation output:
- Runtime gate rejects short-source or non-compressive additionalContext candidates.
- Diagnostics/evidence classify admitted vs discarded candidates.
- Existing graph/freshness diagnostics remain observable even when candidate injection is discarded.
