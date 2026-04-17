# Formbricks Direct-Codex N=6 Benchmark Interpretation

Source artifacts preserved from `benchmark/formbricks-n3-quality` onto latest `main` without merging the stale branch:

- `benchmark-full-1776325941.json` — Formbricks delete-account email validation, N=3
- `benchmark-full-1776327829.json` — Formbricks login Caps Lock warning follow-up, N=3
- `artifacts/benchmark-full-1776325941/**` and `artifacts/benchmark-full-1776327829/**` — per-iteration patches and diffstats
- `round1-risk-followup-1776327829.md` — original follow-up risk note

## What can be claimed

These runs are useful for product decisions, not public performance claims:

- Direct Codex runner parity was used for both variants.
- All 6 paired runs succeeded and changed the same target file class.
- Proxy extraction/model-facing token estimates stayed strongly positive.
- Runtime token and wall-clock outcomes were mixed, including clear fooks regressions.

## Aggregate read

| Evidence slice | Pairs | Same-file pairs | Median total-time improvement | Median runtime-token reduction | Quality caveat |
| --- | ---: | ---: | ---: | ---: | --- |
| Delete-account email validation | 3 | 3 | -15.78% | +3.82% | fooks lower-quality in 1/3 |
| Login Caps Lock warning | 3 | 3 | -19.91% | -49.75% | artifact parity 3/3 |
| Combined directional read | 6 | 6 | negative | mixed / often negative | round-1 only |

Negative improvement means fooks was slower or used more runtime tokens than vanilla.

## Product implication

The current evidence says fooks extraction can compress model-facing payloads, but exact-file task prompts may over-inject context relative to vanilla. The next product step is therefore the shared context policy added in this branch:

- first-turn exact-file runtime hook behavior: `no-op` / record only
- repeated exact-file behavior: `light` or `light-minimal`
- ambiguous or multi-file prompts: `auto` / broader discovery

Do not market runtime token savings from these Formbricks artifacts until post-policy reruns show stable actual runtime-token wins.
