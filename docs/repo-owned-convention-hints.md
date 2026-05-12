# Repo-owned convention hints prototype

Repo-owned convention hints are a first prototype for future team-owned fooks checks. The current shape is intentionally internal and fixture-backed: it proves how local conventions can improve report context without creating a public config contract.

## What the prototype does

- Defines an internal convention-hints manifest schema.
- Matches hints to React Web issue cards by profile, issue kind, native element, and file extension.
- Projects matching hints into full React Web issue reports as advisory context.
- Keeps compact summary output free of detailed convention-hint data.

## Boundaries

This is not the future tracked config surface yet. The first pass does **not** add tracked `.fooks` policy/check files, a public CLI, CI enforcement, merge enforcement, codemod behavior, or edit authority.

Convention hints should remain inspect-first context. They may say what local evidence to inspect, but they must not imply mandatory edits, generated accessible-name copy, broad accessibility coverage, or custom-component semantic inference.

## Graduation path

A later PR can promote this internal fixture contract into tracked repo-owned config only after separately designing:

1. config file names and loading precedence,
2. schema versioning and migration rules,
3. warning vs failure behavior,
4. CLI/CI exposure,
5. fixture usefulness gates for false positives and unsupported boundaries.
