# Post-policy Formbricks benchmark decision matrix

Date: 2026-04-17
Runner: direct `codex exec --full-auto` for both vanilla and fooks variants
Repo: external OSS `formbricks/formbricks` checkout under `~/Workspace/fooks-test-repos/formbricks`
Surface: Next.js app components with Tailwind classes
Task family: login password Caps Lock warning

## Why this run exists

Earlier Formbricks evidence showed mixed/negative runtime outcomes and fooks sometimes used more runtime tokens. This run retests after the shared context policy change that keeps exact-file first-turn Codex hooks at `no-op` while leaving ambiguous prompts in `auto` discovery mode.

## Prompts

- Exact-file prompt: `In apps/web/modules/auth/login/components/login-form.tsx add an inline Tailwind red Caps Lock warning below the password field when getModifierState('CapsLock') is true. Keep existing login, email sign-in, password reset, and two-factor flows unchanged. Report which file you modified.`
- Ambiguous prompt: `Find the Formbricks login password field and add an inline Tailwind red Caps Lock warning below the password field when getModifierState('CapsLock') is true. Keep existing login, email sign-in, password reset, and two-factor flows unchanged. Report which file you modified.`

## N=3 timing/token read

| Slice | Pairs | Fooks context mode | Same changed-file list | Median total-time improvement | Median runtime-token reduction | Read |
| --- | ---: | --- | --- | ---: | ---: | --- |
| Exact-file single-turn | 3 | `no-op` | 3/3 | -17.05% | +11.45% | Damage-control only: runtime tokens improved, but wall-clock still regressed because scan/attach overhead remains and no extra context is injected. |
| Ambiguous login discovery | 3 | `auto` | 3/3 | +6.28% | +18.68% | Promising but not stable: median time and tokens improved, but variance remains high and artifact verification found a scope-expansion failure. |

### Per-run values

| Slice | Report | Vanilla | Fooks total | Total improvement | Vanilla tokens | Fooks tokens | Runtime-token reduction | Fooks mode |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| exact | `exact/benchmark-full-1776395105.json` | 220.6s | 331.3s | -50.14% | 93,261 | 82,580 | +11.45% | `no-op` |
| exact | `exact/benchmark-full-1776395556.json` | 212.6s | 214.6s | -0.98% | 70,735 | 68,984 | +2.48% | `no-op` |
| exact | `exact/benchmark-full-1776396023.json` | 204.4s | 239.3s | -17.05% | 60,566 | 48,297 | +20.26% | `no-op` |
| ambiguous | `ambiguous/benchmark-full-1776396673.json` | 277.2s | 349.7s | -26.15% | 77,999 | 63,427 | +18.68% | `auto` |
| ambiguous | `ambiguous/benchmark-full-1776397195.json` | 283.4s | 214.6s | +24.28% | 69,689 | 55,593 | +20.23% | `auto` |
| ambiguous | `ambiguous/benchmark-full-1776397646.json` | 221.0s | 207.1s | +6.28% | 65,608 | 58,042 | +11.53% | `auto` |

## Artifact verification read

The first N=3 post-policy run did not persist full patches. The harness now captures patch/diffstat artifacts and excludes `.omx`, `.codex`, and `.fooks` runtime files. A follow-up N=1 per slice was run only to inspect output quality/scope.

| Slice | Report | Total improvement | Runtime-token reduction | File-scope parity | Manual quality read |
| --- | --- | ---: | ---: | --- | --- |
| exact | `artifact-verify/exact/benchmark-full-1776397764.json` | +41.77% | +9.37% | same | Both solve the requested component change; vanilla adds `role="alert"`, fooks adds the warning but lacks an accessibility role in this artifact, so treat as slight fooks quality risk. |
| ambiguous | `artifact-verify/ambiguous/benchmark-full-1776398249.json` | -60.03% | -55.78% | different: vanilla 2 files vs fooks 15 files | Fooks over-expanded into 14 locale files with English strings while vanilla touched `en-US` only; this is a scope/quality regression despite the earlier N=3 median win. |

## Product decision interpretation

- **When fooks currently looks useful:** ambiguous discovery tasks where the agent must find the right large Next.js/Tailwind component and fooks does not broaden the edit scope. In the N=3 ambiguous slice, median total time improved by `+6.28%` and median runtime tokens dropped by `+18.68%`.
- **When fooks currently loses:** exact-file first-turn edits. The new policy reduces token risk (`+11.45%` median runtime-token reduction in N=3), but because the benchmark still pays scan/attach overhead while injecting no context, median total time was `-17.05%`.
- **Most important warning:** any run where fooks uses more runtime tokens or edits many more files is bad product evidence, not a marketing edge case. The artifact-verification ambiguous run is the clearest current regression: fooks was `-60.02%` total time, `-55.78%` runtime-token reduction, and changed 15 files vs vanilla 2.

## Risk resolution plan

| Risk | Current status | Resolution before public claim |
| --- | --- | --- |
| Runtime tokens worse than vanilla | Improved in the N=3 exact and ambiguous medians, but not universally fixed because artifact-verification ambiguous regressed hard. | Keep runtime-token claims gated by per-slice medians plus no severe outliers; add automatic outlier flags for `fooks_tokens > vanilla_tokens`. |
| Exact-file overhead | Context injection is now `no-op` on first-turn exact-file prompts, but scan/attach overhead remains. | Add an exact-file preflight bypass that skips scan/attach entirely for single-turn targeted edits, or report exact-file as a non-goal for fooks acceleration. |
| Output quality and scope | N=3 reports show same changed-file lists, but full patch artifacts were missing; artifact verification found accessibility and over-localization risks. | Add a Caps Lock acceptance scorer: target component changed, CapsLock state/events, Tailwind red warning, accessibility role/aria-live, preserved auth flows, locale scope capped unless requested. |
| Benchmark artifact trust | Fixed going forward: harness now persists patch/diffstat and excludes runtime hidden files. | Do not cite the first N=3 as quality-evidence; cite it for time/token/file-list only and cite artifact verification separately for output quality. |
| Broad benchmark sweep cost/noise | Still high. | Stay with targeted N=3/N=5 slices until exact-file bypass and acceptance scoring are implemented. No broad sweep yet. |

## Recommended next sequence

1. Implement benchmark acceptance scoring for the Caps Lock task and make over-broad locale edits fail or lower score.
2. Implement an exact-file single-turn bypass so fooks can skip scan/attach when it will inject `no-op` context.
3. Rerun two slices with artifacts enabled: exact N=3 and ambiguous N=5. Product claims require: quality parity, same intended target, and no severe runtime-token outliers.
4. Only after that, add a second ambiguous class: multi-file refactor/component extraction where fooks should have a stronger theoretical advantage than this Caps Lock task.

