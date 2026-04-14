# Phase 2 Optimization Candidates — Post-Process-Model Falsification Gate

This note updates the optimization backlog after adding the **Phase 0 process-model probe**. The new probe measures whether a helper-backed path actually beats today's CLI front door, instead of assuming a helper will help just because the direct-helper path is fast.

## Source of truth

- `benchmarks/results/latest/benchmark.json`
- `benchmarks/results/latest/scan-cache.json`
- `benchmarks/results/latest/process-model-probe.json`

## Latest stable snapshot

### Canonical full suite (`benchmark.json`)

- cold avg: `556.96ms`
- warm avg: `182.43ms`
- partial single avg: `426.36ms`
- partial multi avg: `481.52ms`
- rescan after invalidation avg: `582.67ms`
- warm runtime split:
  - CLI wall time: `182.43ms`
  - internal scan total: `17.13ms`
  - outside-scan overhead: `165.3ms`
- warm outside-scan command-path breakdown:
  - command dispatch: `26.29ms`
  - result serialization: `0.2ms`
  - stdout write: `9.56ms`
  - command-path measured total: `36.05ms`
  - command-path unattributed residual: `129.25ms`

### Stable targeted scan harness (`scan-cache.json`)

Use the dedicated scan suite when you want the cleaner process-floor read without the heavier all-suite noise:

- bare Node process: `73.01ms`
- CLI bootstrap without command: `79.66ms`
- CLI bootstrap residual: `6.65ms`

### New process-model falsification gate (`process-model-probe.json`)

- current CLI warm avg: `171.87ms`
- launcher → helper warm avg: `236.54ms`
- direct helper warm avg: `14.67ms`
- helper startup avg: `167.65ms`
- delta (`launcher - current`): `+64.67ms`
- delta (`direct - current`): `-157.2ms`

## What changed in this pass

The benchmark harness now measures three warm-path controls against the same cached project:

1. current one-shot `fooks scan`
2. minimal launcher/stub → helper roundtrip
3. direct helper roundtrip

The helper probe is benchmark-only. It does **not** change the shipped CLI contract.

## What the new numbers actually show

### 1. The direct helper path proves the process model matters

The direct helper path lands at `14.67ms`, far below the current one-shot warm path (`171.87ms`).

**Implication:** a long-lived process can eliminate most of the repeated front-door cost when it already exists and is ready.

### 2. A helper behind the current CLI front door does not clear the gate yet

The launcher → helper path (`236.54ms`) is **worse** than the current CLI warm path (`171.87ms`).

**Implication:** if we keep today's CLI front door and just add a helper behind it, we do not get a meaningful win. The helper complexity would be unjustified in that shape.

### 3. The kill criterion fired for “helper behind current CLI”

Phase 0 asked whether the likely ship path actually beats the baseline. Right now the answer is **no** for the current launcher shape.

**Implication:** do **not** ship a helper behind the existing CLI front door just because the direct helper case looks attractive.

### 4. The next useful question is launcher design, not scan-core trimming

Warm scan-core work remains far smaller than front-door overhead in the latest full suite (`17.13ms` scan-core vs `182.43ms` warm wall). The real architectural question is now:

- can the front door become materially thinner, or
- does the helper need a different invocation/runtime boundary to win?

**Implication:** more TypeScript scan-core micro-optimizations are no longer the highest-leverage lane.

## Re-ranked priority order

### P0 — Decide whether a thinner front door exists

Only reopen helper work if a thinner launcher/shim can materially beat the current `~170ms` warm path while preserving:

- the existing CLI UX
- automatic fallback
- debugging/state visibility

Candidate follow-ups:

- benchmark a thinner launcher that avoids most current CLI/module bootstrap
- measure whether a transport shim can stay cheap enough to preserve the direct-helper advantage
- keep explicit kill criteria so helper complexity is rejected early if the front door remains too expensive

### P1 — Preserve the one-shot baseline while exploring helper options

The current one-shot path is still the correctness/control reference. Any helper exploration should continue to compare against it directly.

### P2 — Only revisit scan-core work if new evidence changes the ranking

Do **not** lead with more scan-core tuning unless new benchmark evidence says the process-model question has been answered and scan-core became dominant again.

## Current recommendation

The backlog recommendation is now:

1. **Do not ship helper-behind-current-CLI**
2. If startup latency still matters, evaluate a **thinner launcher / different front door**
3. Keep the current one-shot CLI as the production baseline until a helper path proves:
   - meaningful warm-path win
   - automatic fallback
   - clear debug/status visibility

## Decision questions for the next PR

A follow-up optimization/design PR should answer all of these with benchmark evidence:

1. Does the proposed launcher/front-door materially beat the current `~170ms` warm path?
2. Does it preserve the existing CLI contract?
3. Can it fail back automatically without invisible state?
4. Is the gain large enough to justify the added lifecycle/observability complexity?
