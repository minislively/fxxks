# Naming Canonicalization Record

> Archive note: this document predates the public npm package rename. Current public npm installs use `oh-my-fooks`, while the CLI/runtime/storage name remains `fooks`.


The repo now supports only canonical `fooks` naming for CLI, project state,
runtime manifests, and environment variables.

## Completed cleanup

- public CLI/runtime naming converged on `fooks`; public npm package installs now use `oh-my-fooks`
- project state naming converged on `.fooks/`
- environment variable naming converged on `FOOKS_*`
- tests and docs were updated to canonical names only

## Rule going forward

Keep future changes aligned to canonical names only:

- CLI / hook command: `fooks`; public npm package: `oh-my-fooks`
- project state dir: `.fooks/`
- env names: `FOOKS_*`
