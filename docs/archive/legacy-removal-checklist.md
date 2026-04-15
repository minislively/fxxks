# Naming Canonicalization Record

The repo now supports only canonical `fooks` naming for CLI, project state,
runtime manifests, and environment variables.

## Completed cleanup

- public CLI/package/runtime naming converged on `fooks`
- project state naming converged on `.fooks/`
- environment variable naming converged on `FOOKS_*`
- tests and docs were updated to canonical names only

## Rule going forward

Keep future changes aligned to canonical names only:

- CLI / package / hook command: `fooks`
- project state dir: `.fooks/`
- env names: `FOOKS_*`
