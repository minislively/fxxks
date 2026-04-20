# Round-one risk follow-up: direct Codex Formbricks repeats

Date: 2026-04-16
Runner: direct `codex exec --full-auto`
Repo: `formbricks/formbricks`
Framework surface: Next.js app components with Tailwind classes
Variant contract: vanilla and fooks use the same prompt, same runner, isolated `CODEX_HOME`; fooks additionally runs `fooks init` / `fooks scan` / `fooks attach codex`.

## Why this follow-up exists

The first direct-Codex Formbricks N=1 run showed a promising fooks result, but the risk assessment still had three important gaps:

1. Sample size was too small.
2. The task mix only covered one feature type.
3. Runtime-token regressions needed to be separated from proxy compression claims.

This follow-up adds a second N=3 task and preserves patch artifacts so output quality can be checked alongside time and token deltas.

## Included evidence

| Report | Task | Pairs | Same target file | Acceptance result | Median total-time improvement | Median runtime-token reduction |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| `benchmark-full-1776325941.json` | Delete account email confirmation validation | 3 | 3/3 | fooks lower in 1/3 | -15.78% | +3.82% |
| `benchmark-full-1776327829.json` | Login password Caps Lock warning | 3 | 3/3 | parity in 3/3 | -19.91% | -49.75% |

Rollup across both direct-Codex N=3 runs:

- Successful paired runs: 6/6
- Same-file pairs: 6/6
- Fooks lower acceptance score: 1/6
- Median total-time improvement: -17.85%
- Median runtime-token reduction: -5.35%
- Fooks used more runtime tokens in 3/6 pairs

## Interpretation

This evidence does **not** support a stable direct-Codex speed or runtime-token reduction claim yet. The honest current read is:

- fooks reliably kept the agent on the intended file in these targeted Formbricks tasks.
- fooks proxy compression remains positive, but proxy compression is not the same as actual Codex runtime token usage.
- On explicit single-file tasks, fooks preparation can add context without reducing the agent's reasoning path enough to offset it.
- More runtime tokens on the fooks side is a negative result, not a marketing win; it should be treated as a regression signal until a task class shows repeated savings.

## Token regression note

The Caps Lock task is the clearest warning sign. Patch sizes were comparable across variants, but fooks runtime tokens were higher in 2/3 pairs and much higher in iteration 3. That means the extra token use is unlikely to be explained by a larger output patch alone. The likely causes to investigate next are:

1. fooks-injected context is helpful for navigation but too heavy for explicitly targeted single-file prompts.
2. The current attach/runtime-hook path may add context even when the prompt already names the exact file.
3. Codex hidden reasoning/service variability can amplify small prompt/context differences, so N>=5 and multiple task classes are needed before making claims.

## Next recommended benchmark class

Do not repeat only explicit single-file tasks. The next run should target cases where fooks should theoretically help:

- ambiguous file discovery across a feature folder,
- multi-file refactor where imports/types matter,
- migration that requires preserving existing patterns across related components,
- large TSX component extraction without naming the exact file.

Until those pass, public wording should say: fooks has promising context-compression mechanics and file-targeting behavior, but direct runtime token/time wins are not yet stable in the current Formbricks evidence.
