# Layer 2 Frontend Task Benchmark - Status

> Current canonical state for the Layer 2 R4 task benchmark.

## 1. Current state

| Layer | Definition | Status | Detail |
| --- | --- | --- | --- |
| Layer 1: Extraction Benchmark | Compression / extraction / coverage / quality checks | ✅ Active | Existing proxy/prepared-context benchmark history remains valid as proxy evidence. |
| Layer 2: Task Definition/Spec | Frontend task inventory and R4 spec | ✅ Complete | Task inventory, R4 spec, validation checklist, metric schema are ready. |
| Layer 2: Runner Path | AI runner wrapper execution path | ✅ Unblocked | Current `codex exec` wrapper completed tiny and R4 paired read-only smokes. |
| Layer 2: R4 Paired Smoke | Vanilla-vs-fooks proposal-only R4 execution | ✅ Collected | Single matched pair succeeded on `combobox-example.tsx`; summary stored in `results/R4-current-exec-smoke-2026-04-21.json`. |
| Layer 2: Validated Smoke | Proposal-only R4 smoke validation | ✅ Collected | Validation artifact stored in `results/R4-current-exec-validation-2026-04-21.json`; repeated/statistical evidence remains out of scope. |

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
| R4 paired smoke validation | ✅ Collected | `benchmarks/layer2-frontend-task/results/R4-current-exec-validation-2026-04-21.json`. |

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

Validation artifact: `results/R4-current-exec-validation-2026-04-21.json`.

Validated smoke checks:

- both vanilla and fooks runs exited successfully;
- fooks prompt was at least 80% smaller than vanilla (`92.4%` observed);
- retained local raw outputs contain the expected module split buckets;
- fooks-mode prompt construction strips the absolute target path;
- docs/artifacts keep billing/stable-runtime claim boundaries explicit.

Boundaries:

- The runner is read-only and asks for proposed file trees/code skeletons only.
- `promptTokensApprox` is local prompt-size accounting, not provider billing telemetry.
- This is a single pair, so it does not override the older unstable direct-runtime follow-up.
- Generated code was not applied and acceptance-tested; do not publish this as a stable Layer 2 win.

## 6. Remaining out-of-scope claims

| Claim/risk | Status | What would be required |
| --- | --- | --- |
| Stable runtime-token/time win | Out of scope for this PR | Repeated matched R4 or multi-task runs with acceptance validation. |
| Provider billing-token savings | Out of scope for this PR | Provider billing-token telemetry, not local prompt-size accounting. |
| Applied-code quality benchmark | Out of scope for this PR | Apply generated patches and run type/build/circular validation on the target project. |

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

Do not call Layer 2 a stable runtime win until validated repeated outputs are
strong enough to support that stronger claim.

## 8. Naming rules

Allowed:

- ✅ `spec`
- ✅ `scaffold`
- ✅ `runner smoke`
- ✅ `runner path unblocked`
- ✅ `single R4 paired smoke`
- ✅ `prompt supplied to Codex was smaller in the smoke`

Forbidden until applied-code validation and repeated evidence exist:

- ❌ `Layer 2 benchmark complete`
- ❌ `stable Layer 2 win`
- ❌ `runtime-token savings proven`
- ❌ `billing-grade savings`

*Status date: 2026-04-21*
*Runner: ✅ tiny + R4 paired smokes passed*
*Benchmark: ✅ proposal-only smoke validated; stable runtime claims out of scope*
