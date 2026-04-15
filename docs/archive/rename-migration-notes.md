# Rename / Migration Notes

## Decision

`fooks` does **not** implement rename-aware or migration-aware behavior in PHASE 1.

This capability remains a **future extension**, not part of the current
core promise:

- `scan`
- `extract`
- `decide`
- `cache`
- `attach`

## Why it is deferred

Rename-aware behavior is valuable, but it expands the product from a
frontend read-cost reduction engine into a broader change-tracking /
migration engine.

That would increase scope in places that are intentionally stable in
PHASE 1:

- cache identity
- file tracking
- import rewrite semantics
- runtime adapter contracts

The current project should optimize **model-facing payloads** before it
optimizes rename workflows.

## Research summary

The idea is legitimate and aligns with existing tools:

- Git supports rename detection and history following across renames
- TypeScript tooling supports semantic rename-file workflows
- Tree-sitter is designed for incremental parsing
- LLM prompt caching benefits from stable prefixes and minimal churn

So the feature is a good future direction, but not a PHASE 1 requirement.

## Recommended future order

### Phase 1.5

- relative-path canonicalization for model-facing output
- cache/index preparation for logical file identity
- prompt-prefix stabilization for better cache reuse

### Phase 2+

- git-aware rename detection
- rename lineage in cache/index metadata
- TypeScript rename-file / import rewrite integration
- migration-aware partial re-indexing

## Current rule

Current rule:

- `.fooks` is the only supported internal project-state path
- `FOOKS_*` is the only supported env prefix
- `fooks` is the only supported CLI/package/runtime name
- future rename work should stay on canonical `fooks` naming only

For the completed removal record, see
[`docs/legacy-removal-checklist.md`](./legacy-removal-checklist.md).
