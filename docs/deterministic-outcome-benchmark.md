# Deterministic Outcome Benchmark Plan

This is a **design/scaffold-only** lane for a future deterministic outcome benchmark. It is intentionally separated from the release-safe runtime opt-in work so that it can run in a parallel worktree without changing runtime defaults, provider billing claims, or live model outcome claims.

## Scope

The first pass may add only:

- deterministic benchmark plan/spec artifacts;
- local scaffold code that emits or validates the benchmark contract;
- tests proving the scaffold stays claim-bounded.

The first pass must not modify runtime adapter behavior, public win claims, provider-cost logic, or LSP dependencies.

## Non-goals

- No default runtime behavior change.
- No automatic `editGuidance.patchTargets` behavior change; patch targets remain opt-in.
- No provider tokenizer, provider billing-token, provider invoice, or provider cost claim.
- No live Codex/Claude model outcome claim.
- No LSP implementation and no new dependency.
- No edits to existing public claim surfaces until the runtime opt-in guardrail work lands.

## Why this exists

The existing R4 repeated benchmark lane can classify narrow local telemetry candidates, but a future deterministic outcome benchmark needs a separate contract before any live smoke or provider-cost work starts. The contract should make outcome comparability deterministic enough for internal evidence without accidentally becoming a public runtime-token, billing, cost, or live-model claim.

## Deterministic controls

A future implementation should require all accepted comparisons to share:

1. fixed task identity;
2. fixed fixture/source revision;
3. fixed model/setup identity when a model is involved;
4. isolated workdirs per attempt;
5. deterministic validator command and acceptance rubric;
6. explicit seed/order metadata;
7. stored source fingerprints for every target input;
8. claim-boundary metadata on every emitted artifact.

## Phase gates

| Phase | Allowed output | Still forbidden |
| --- | --- | --- |
| Scaffold | Contract JSON/Markdown and local validator tests | Live model claims, provider billing/cost claims, runtime default changes |
| Fixture replay | Deterministic local fixture acceptance deltas | Public outcome wins, provider billing/cost claims |
| Live smoke | Internal Codex/Claude smoke artifacts | Public win claims unless later repeated evidence gates pass |
| Provider proof | Imported/provider-backed evidence under explicit billing lanes | Any unqualified runtime-token or cost claim |

## Merge-fence guidance

Safe parallel files for this lane:

- `docs/deterministic-outcome-benchmark.md`
- `benchmarks/layer2-frontend-task/deterministic-outcome-scaffold.js`
- `test/deterministic-outcome-scaffold.test.mjs`

Avoid while release-safe runtime opt-in work is active:

- `README.md`
- `docs/release.md`
- `docs/benchmark-evidence.md`
- `docs/edit-guidance-evidence.md`
- `src/core/payload/model-facing.ts`
- `src/adapters/codex-runtime-hook.ts`
- `src/adapters/claude-runtime-hook.ts`
- `test/fooks.test.mjs`
- `test/frontend-v2-runner.test.mjs`
- `test/provider-cost-evidence.test.mjs`
- existing provider-cost and billing-import scripts

## Claim boundary

This lane can only say that a deterministic outcome benchmark contract/scaffold exists. It cannot say that fooks improves live Codex/Claude outcomes, reduces provider billing tokens, reduces provider costs, or provides stable runtime-token/time savings.
