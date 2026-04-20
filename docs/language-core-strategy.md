# Language and core strategy

Keep `fooks` easy to install and easy to debug first. Do not rewrite the project
for language aesthetics alone.

## Stable direction

`fooks` should keep its public shell in TypeScript/Node and only move measured,
contract-stable hot paths to a native core when benchmarks prove the payoff.

| Area | Current language | Direction |
| --- | --- | --- |
| npm package, CLI, setup, status, install flows | TypeScript compiled to JavaScript | Keep in TypeScript |
| Codex, Claude, and opencode adapter glue | TypeScript | Keep in TypeScript |
| extraction, scan, cache, hash, and payload decisions | TypeScript | Candidate native core later, only with evidence |
| benchmark orchestration scripts under `benchmarks/scripts/` | Node/MJS | Keep as the low-friction benchmark path |
| real-repo benchmark runners under `benchmarks/frontend-harness/runners/` | Python | Keep while proven; port active paths to Node/MJS before Rust |

## Why not rewrite everything in Rust or Go now

A full rewrite would change the riskiest parts all at once: package install,
Codex hook activation, generated payload contracts, cache layout, and benchmark
interpretation. That would make `fooks` harder to trust even if some internal
operations became faster.

The better boundary is:

> TypeScript owns the product shell. A future native core may own small,
> measured, pure functions behind stable JSON contracts.

## Native-core reopen gate

Only reopen Rust/Go/native-core work when all of these are true:

1. A benchmark identifies a specific hot path, not a general feeling that TS is slow.
2. The native implementation preserves extraction and model-payload contracts.
3. The product path gets faster, not only a standalone helper microbenchmark.
4. Fallback and rollback are clear if the native path fails.
5. npm install, `fooks setup`, and hook debugging do not become harder for users.

Good first candidates, if evidence appears:

- file hashing and cache-index reads;
- pure `extractSource`-style parsing/extraction functions;
- scan/index helpers, but only if process-model benchmarks prove a persistent helper wins.

Poor first candidates:

- CLI argument parsing;
- hook installation;
- runtime trust/status checks;
- docs, release, or package glue.

## Python benchmark harness direction

The Python benchmark harness is not part of the `fooks` product runtime. It is a
real-repo validation tool. Keep it working while it remains the proven benchmark
path, but do not expand Python into the product architecture.

Recommended sequence:

1. Keep the current Python real-repo harness until equivalent coverage exists elsewhere.
2. Delete or archive unused setup/quick scripts before porting active runners.
3. Port active benchmark orchestration to Node/MJS first because this repo already ships through npm.
4. Keep benchmark result schemas stable so old and new runner outputs remain comparable.
5. Consider Rust only for a measured product hot path, not for benchmark orchestration.

## Decision rule

Default to:

- **TypeScript shell + TypeScript core** for the current product;
- **Node/MJS cleanup** for benchmark harness simplification;
- **Rust/Go/native core later** only after measured bottlenecks and stable contracts.

This keeps `fooks` understandable now while leaving a clean upgrade path for the
small parts that may eventually deserve a lower-level implementation.
