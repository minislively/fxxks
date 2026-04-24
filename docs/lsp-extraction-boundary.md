# LSP extraction boundary

Issue #110 asked whether fooks should add an LSP-backed frontend context extraction lane. The decision is:

- **Product extraction remains AST-only by default.** `fooks extract` and `fooks compare` continue to use the current TypeScript AST-derived extraction path.
- **No LSP dependency, background language server, or runtime extraction behavior is added by default.** Users should not need `typescript-language-server`, `tsserver` orchestration, project indexing, or a warm language-server process for normal fooks usage.
- **Current source ranges are line-aware edit aids, not semantic proof.** `SourceRange`, `editGuidance.patchTargets`, and design-review metadata are source-derived anchors that require matching freshness fingerprints before editing. They are not LSP-backed rename/reference resolution, go-to-definition proof, diagnostics proof, or cross-file safety.

## Current AST-only lane

The current lane is intentionally lightweight:

| Property | AST-only default |
| --- | --- |
| Inputs | The target source file and the TypeScript parser already used by fooks. |
| Output | Component contract, behavior, structure, style signals, snippets, bounded line ranges, and source fingerprints. |
| Safety model | Same-file, source-derived context with explicit freshness checks. |
| Setup cost | No project language server or background index. |
| Portability | Works for supported `.tsx` / `.jsx` files and the experimental same-file `.ts` / `.js` beta without requiring a project-specific LSP setup. |
| Product claim | Local model-facing payload reduction and line-aware edit guidance only; no semantic rename/reference safety. |

This lane matches fooks' strongest current use case: repeated same-file frontend work where compact, deterministic context is more important than whole-project semantic understanding.

## Where LSP could add value

An LSP-backed evaluation lane could still be useful in the future, especially for proof or benchmark work that is explicitly opted in. Potential value includes:

- resolved prop/type information across files;
- go-to-definition for local components, hooks, and imported helpers;
- reference/rename intelligence for symbol-safe edits;
- import graph precision and path alias awareness;
- diagnostics-aware confidence or payload pruning.

Those are meaningful capabilities, but they are different from the current product boundary. They would need separate setup, tests, and claim language before becoming user-facing support.

## Why LSP is not the default product lane now

Default LSP extraction would add operational costs that conflict with fooks' current lightweight path:

- dependency and environment variability (`tsserver`, `typescript-language-server`, editor/project configuration);
- startup latency and warm-server lifecycle management;
- `tsconfig.json`, project references, path mapping, and monorepo edge cases;
- memory/indexing overhead for large repositories;
- weaker portability for unsupported JavaScript or non-TypeScript frontend projects;
- higher risk of implying semantic edit safety before benchmark and runtime evidence exists.

For issue #110, the safe decision is to document this boundary rather than add a dependency or runtime mode.

## Status of `scripts/evaluate-lsp-extraction.mjs`

`scripts/evaluate-lsp-extraction.mjs` is an **internal evaluation helper**. It exists to summarize local environment readiness and the tradeoffs above. It is not wired into the CLI, package scripts, runtime hooks, `fooks extract`, or `fooks compare`, and it does not prove LSP-backed payload quality.

If a future PR pursues LSP work, it should treat that script as decision-support scaffolding and add explicit opt-in tests/benchmarks before changing public behavior.

## Public wording rule

Public docs may say fooks has AST-derived line-aware source ranges and patch targets with fingerprint freshness checks. They must not say fooks provides LSP-backed semantic extraction, rename/reference safety, diagnostics-aware payload shaping, or cross-file edit safety unless a future implementation and evidence lane explicitly support those claims.
