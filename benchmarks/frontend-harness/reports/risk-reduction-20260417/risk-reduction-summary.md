# Risk reduction follow-up: exact-file bypass and acceptance scoring

Date: 2026-04-17
Runner: direct `codex exec --full-auto` for both variants
Repo: external Formbricks checkout

## What changed

- Exact-file first-turn tasks now record `expectedFooksPrepare: bypass` in dry-run/report metadata.
- The fooks benchmark variant skips `fooks init/scan/attach` when the first-turn exact-file policy would inject `no-op` context.
- Patch/diffstat artifact capture now excludes `.codex`, `.fooks`, `.omx`, and counts untracked source files so scope regressions are visible.
- Caps Lock benchmark artifacts now receive an acceptance score covering target file, Caps Lock state/events, Tailwind warning, accessibility announcement, and locale/file scope.
- Risk assessment now includes `artifact_quality_scope` so wins are blocked when fooks fails acceptance or broadens edit scope.

## Exact-file bypass smoke result

| Metric | Vanilla | Fooks | Read |
| --- | ---: | ---: | --- |
| Duration | 137.9s | 178.5s | fooks still slower in this single run; model variance remains. |
| Prepare/scan overhead | n/a | 0ms | bypass worked: no `init/scan/attach` cost. |
| Runtime tokens | 57,751 | 62,232 | -7.76% token reduction; negative means fooks used more. |
| Changed files | 2 | 2 | scope parity held. |
| Acceptance score | 9/9 | 8/9 | fooks failed accessibility announcement in this artifact. |

Report: `exact-bypass/benchmark-full-1776432160.json`

## Decision impact

- The exact-file overhead risk is partially resolved: benchmark overhead from fooks preparation can now be zero when no context will be injected.
- Exact-file acceleration is **still not a claim**: this smoke run was slower and used more runtime tokens despite bypassing prepare.
- The quality gate is now doing useful work: it caught fooks missing `role`/`aria-live`, so future positive timing/token runs cannot pass silently with weaker output.

## Remaining highest-value next step

Run ambiguous N=5 with artifacts enabled and the new scorer/scope guard. Public product evidence should require all three:

1. fooks median total time and runtime tokens improve,
2. fooks acceptance passes,
3. fooks does not edit broader file scope than vanilla unless the prompt explicitly asks for it.

Exact-file should remain a non-goal for acceleration unless repeated bypassed runs show neutral-or-better time and quality parity.
