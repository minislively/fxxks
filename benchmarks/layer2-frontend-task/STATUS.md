# Layer 2 Frontend Task Benchmark - Status

> Current canonical state for the Layer 2 R4 task benchmark.

## 1. Current state

| Layer | Definition | Status | Detail |
| --- | --- | --- | --- |
| Layer 1: Extraction Benchmark | Compression / extraction / coverage / quality checks | ✅ Active | Existing proxy/prepared-context benchmark history remains valid as proxy evidence. |
| Layer 2: Task Definition/Spec | Frontend task inventory and R4 spec | ✅ Complete | Task inventory, R4 spec, validation checklist, metric schema are ready. |
| Layer 2: Runner Path | AI runner wrapper execution path | ✅ Unblocked | Current `codex exec` wrapper completed tiny and R4 paired read-only smokes. |
| Layer 2: R4 Paired Smoke | Vanilla-vs-fooks proposal-only R4 execution | ✅ Collected | Single matched pair succeeded on `combobox-example.tsx`; summary stored in `results/R4-current-exec-smoke-2026-04-21.json`. |
| Layer 2: Validated Benchmark | Acceptance/quality-validated R4 benchmark | 🟡 Pending | No validation artifact or repeated-run evidence yet. |

## 2. Canonical wording

> Layer 2 task definition/spec is complete.
> The legacy configured gateway 502 path is no longer a current runner-path blocker.
> A current `codex exec` R4 paired smoke passed on 2026-04-21.
> In that single proposal-only pair, the prompt supplied to Codex dropped from `11365` approx tokens in vanilla mode to `861` approx tokens in fooks mode (`92.4%` smaller).
> This is prompt-size smoke evidence, **not** provider billing telemetry, not an acceptance-validated code benchmark, and not enough for stable runtime-token/time win claims.

## 3. Completed assets

| Asset | Status | Notes |
| --- | --- | --- |
| Task inventory | ✅ Complete | 7 frontend high-token task definitions. |
| R4 runner spec | ✅ Complete | Feature Module Split input/output/success criteria. |
| Validation checklist | ✅ Complete | Function preservation, file sizing, types, import cycles, barrel exports. |
| Metric schema | ✅ Complete | success/fail, token usage, retry count, latency, edit precision, operational overhead. |
| Runner/wrapper | ✅ Smoke passed | `runner.js` and `codex-wrapper.js` now use current `codex exec` path. |
| First candidate | ✅ Fixed | R4 Feature Module Split on `combobox-example.tsx`. |
| R4 paired smoke summary | ✅ Collected | `benchmarks/layer2-frontend-task/results/R4-current-exec-smoke-2026-04-21.json`. |

## 4. 2026-04-21 tiny runner smoke

Command:

```bash
CODEX_TIMEOUT_MS=90000 node benchmarks/layer2-frontend-task/runner.js \
  --mode=vanilla \
  --target=fixtures/raw/SimpleButton.tsx \
  --output=/tmp/fooks-layer2-smoke.json \
  --model=gpt-5.4-mini
```

Observed result:

| Field | Value |
| --- | ---: |
| `success` | `true` |
| `exitCode` | `0` |
| `promptTokensApprox` | `236` |
| `outputChars` | `2610` |
| `latencyMs` | `44388` |

This proves the wrapper can complete a tiny read-only Codex task without the old
502 path.

## 5. 2026-04-21 R4 paired smoke

Target: `apps/v4/registry/bases/radix/examples/combobox-example.tsx` from
`shadcn-ui/ui`, fetched to a temporary file for the run. Runner command shape:

```bash
CODEX_MODEL=gpt-5.4-mini CODEX_TIMEOUT_MS=300000 \
  node benchmarks/layer2-frontend-task/runner.js \
  --mode=<vanilla|fooks> \
  --target=/tmp/combobox-example.tsx \
  --output=/tmp/R4-<mode>-current-exec.json
```

Observed summary:

| Metric | Vanilla | Fooks | Delta |
| --- | ---: | ---: | ---: |
| `success` | `true` | `true` | equal |
| `exitCode` | `0` | `0` | equal |
| `promptTokensApprox` | `11365` | `861` | `92.4%` smaller prompt |
| `latencyMs` | `85822` | `57545` | `32.9%` lower in this smoke |
| `outputChars` | `7976` | `9967` | fooks output longer |

Boundaries:

- The runner is read-only and asks for proposed file trees/code skeletons only.
- `promptTokensApprox` is local prompt-size accounting, not provider billing telemetry.
- This is a single pair, so it does not override the older unstable direct-runtime follow-up.
- Acceptance/quality validation is still missing; do not publish this as a stable Layer 2 win.

## 6. Remaining blockers

| Blocker | Status | What resolves it |
| --- | --- | --- |
| Quality validation artifact absent | 🟡 Pending | Save validation output alongside each R4 result. |
| Repeated R4 / multi-task evidence absent | 🟡 Pending | Collect multiple matched pairs before public runtime-token/time claims. |
| Runtime-token claim instability | ⚠️ Active | Require repeated R4 or multi-task evidence before making any runtime-token/time win claim. |

## 7. Next execution path

```bash
# Repeated vanilla/fooks R4 pair, then validation
node benchmarks/layer2-frontend-task/runner.js \
  --mode=vanilla \
  --target=shadcn-ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=benchmarks/layer2-frontend-task/results/R4-vanilla-run-2.json

node benchmarks/layer2-frontend-task/runner.js \
  --mode=fooks \
  --target=shadcn-ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=benchmarks/layer2-frontend-task/results/R4-fooks-run-2.json
```

Do not call Layer 2 “complete” until paired outputs and validation artifacts are
repeated enough to support the claim being made.

## 8. Naming rules

Allowed:

- ✅ `spec`
- ✅ `scaffold`
- ✅ `runner smoke`
- ✅ `runner path unblocked`
- ✅ `single R4 paired smoke`
- ✅ `prompt supplied to Codex was smaller in the smoke`

Forbidden until validation and repeated evidence exist:

- ❌ `Layer 2 benchmark complete`
- ❌ `stable Layer 2 win`
- ❌ `runtime-token savings proven`
- ❌ `billing-grade savings`

*Status date: 2026-04-21*
*Runner: ✅ tiny + R4 paired smokes passed*
*Benchmark: 🟡 validation and repeated evidence pending*
