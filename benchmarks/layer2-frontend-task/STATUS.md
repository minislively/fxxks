# Layer 2 Frontend Task Benchmark - Status

> Current canonical state for the Layer 2 R4 task benchmark.

## 1. Current state

| Layer | Definition | Status | Detail |
| --- | --- | --- | --- |
| Layer 1: Extraction Benchmark | Compression / extraction / coverage / quality checks | ✅ Active | Existing proxy/prepared-context benchmark history remains valid as proxy evidence. |
| Layer 2: Task Definition/Spec | Frontend task inventory and R4 spec | ✅ Complete | Task inventory, R4 spec, validation checklist, metric schema are ready. |
| Layer 2: Runner Path | AI runner wrapper execution path | ✅ Unblocked | Current `codex exec` wrapper completed tiny and R4 paired read-only smokes. |
| Layer 2: R4 Paired Smoke | Vanilla-vs-fooks proposal-only R4 execution | ✅ Collected | Two matched pairs succeeded on `combobox-example.tsx`; summaries stored under `results/R4-current-exec-smoke-2026-04-21*.json`. |
| Layer 2: Repeated Applied Diagnostic | Matched vanilla/fooks applied-code repeated run | ⚠️ Diagnostic only | 2026-04-22 diagnostics were insufficient/negative; the 2026-04-25 bounded rerun attempted 7 pairs, accepted 5/7, and still classified `diagnostic-only` with stable claimability false. |
| Layer 2: Applied-Code Acceptance Gate | Validate generated file trees after they are written to disk | ✅ Implemented | `validate-r4-applied.js` checks required files, line limits, barrel exports, source hygiene, local import cycles, and TypeScript acceptance; a fixture self-test artifact exists. |

## 2. Canonical wording

> Layer 2 task definition/spec is complete.
> The legacy configured gateway 502 path is no longer a current runner-path blocker.
> Two current `codex exec` R4 paired smokes passed on 2026-04-21.
> In both proposal-only pairs, the prompt supplied to Codex dropped from `11365` approx tokens in vanilla mode to `861` approx tokens in fooks mode (`92.4%` smaller).
> The applied-code acceptance gate is now implemented and self-tested against a checked-in R4 candidate tree.
> A 2026-04-22 repeated applied diagnostic attempted 7 matched pairs, accepted 4/7, and classified `insufficient-accepted-pairs`.
> Accepted pairs kept prompt-size reduction (median 88.2%) but regressed on CLI runtime tokens (median -25.5%) and latency (median -14.4%).
> A same-day risk-closure rerun after claim-boundary hardening stopped after 3 matched attempts because 0/3 pairs passed acceptance in both modes; it also classified `insufficient-accepted-pairs`.
> A 2026-04-25 bounded rerun attempted 7 matched pairs, accepted 5/7, and showed positive accepted-pair medians (prompt 86.4%, CLI runtime tokens 22.4%, latency 8.3%), but remained `diagnostic-only` because the candidate threshold was not met and one severe runtime-token regression remained.
> This is **not** provider billing telemetry, not an applied-code benchmark win, and not enough for stable runtime-token/time win claims.

## 3. Completed assets

| Asset | Status | Notes |
| --- | --- | --- |
| Task inventory | ✅ Complete | 7 frontend high-token task definitions. |
| R4 runner spec | ✅ Complete | Feature Module Split input/output/success criteria. |
| Validation checklist | ✅ Complete | Function preservation, file sizing, types, import cycles, barrel exports. |
| Metric schema | ✅ Complete | success/fail, token usage, retry count, latency, edit precision, operational overhead. |
| Runner/wrapper | ✅ Smoke passed | `runner.js` and `codex-wrapper.js` now use current `codex exec` path. |
| First candidate | ✅ Fixed | R4 Feature Module Split on `combobox-example.tsx`. |
| R4 paired smoke summaries | ✅ Collected | `benchmarks/layer2-frontend-task/results/R4-current-exec-smoke-2026-04-21.json` and `benchmarks/layer2-frontend-task/results/R4-current-exec-smoke-2026-04-21-run-2.json`. |
| R4 paired smoke validation | ✅ Collected | `benchmarks/layer2-frontend-task/results/R4-current-exec-validation-2026-04-21.json`. |
| R4 applied acceptance validator | ✅ Implemented | `validate-r4-applied.js` validates on-disk candidate trees; `run-r4-applied.js` creates isolated workspace-write Codex attempts and records CLI runtime tokens when available. |
| R4 repeated applied runner | ✅ Implemented | `run-r4-repeated.js` and `r4-repeated-summary.js` require matched accepted pairs before any narrow L1 candidate classification. |
| R4 applied validator self-test | ✅ Passed | `results/R4-applied-acceptance-validator-self-test-2026-04-21.json` proves the gate can pass/fail concrete file trees without provider telemetry claims. |
| R4 2026-04-22 pre-launch diagnostic | ⚠️ Insufficient | Attempted 7 pairs; accepted 4/7; prompt median 88.2% smaller; runtime-token median -25.5%; latency median -14.4%. |
| R4 2026-04-22 risk-closure rerun | ⚠️ Insufficient | Stopped after 3 matched attempts; accepted 0/3 pairs, so no accepted-pair runtime-token or latency medians were available. |
| R4 2026-04-25 bounded rerun | ⚠️ Diagnostic only | Attempted 7 pairs; accepted 5/7; prompt median 86.4% smaller; CLI runtime-token median 22.4% lower; latency median 8.3% lower; one severe runtime-token regression kept stable claimability false. |

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

## 5. 2026-04-21 R4 paired smokes

Target: `apps/v4/registry/bases/radix/examples/combobox-example.tsx` from
`shadcn-ui/ui`, fetched to a temporary file for the run. Runner command shape:

```bash
CODEX_MODEL=gpt-5.4-mini CODEX_TIMEOUT_MS=300000 \
  node benchmarks/layer2-frontend-task/runner.js \
  --mode=<vanilla|fooks> \
  --target=/tmp/combobox-example.tsx \
  --output=/tmp/R4-<mode>-current-exec.json
```

Observed summaries:

| Metric | Vanilla | Fooks | Delta |
| --- | ---: | ---: | ---: |
| `success` | `true` | `true` | equal |
| `exitCode` | `0` | `0` | equal |
| `promptTokensApprox` | `11365` | `861` | `92.4%` smaller prompt |
| `latencyMs` run 1 | `85822` | `57545` | `32.9%` lower in this smoke |
| `latencyMs` run 2 | `55610` | `28355` | `49.0%` lower in this smoke |
| `outputChars` | `7976` | `9967` | fooks output longer |

Validation artifact: `results/R4-current-exec-validation-2026-04-21.json`.

Validated smoke checks:

- both vanilla and fooks runs exited successfully across 2/2 matched pairs;
- fooks prompt was at least 80% smaller than vanilla in every pair (`92.4%` observed in both);
- retained local raw outputs contain the expected module split buckets;
- fooks-mode prompt construction strips the absolute target path;
- docs/artifacts keep billing/stable-runtime claim boundaries explicit.

Boundaries:

- The runner is read-only and asks for proposed file trees/code skeletons only.
- `promptTokensApprox` is local prompt-size accounting, not provider billing telemetry.
- These are two proposal-only pairs, so they still do not override the older unstable direct-runtime follow-up.
- Generated code was not applied and acceptance-tested; do not publish this as a stable Layer 2 win.

## 6. Remaining out-of-scope claims

| Claim/risk | Status | What would be required |
| --- | --- | --- |
| Stable runtime-token/time win | Out of scope for this PR | Multi-task or larger repeated-run evidence with accepted matched pairs, positive medians, no severe runtime-token regressions, and stable setup identity. |
| Provider billing-token savings | Out of scope for this PR | Provider billing-token telemetry, not local prompt-size accounting. |
| Applied-code quality benchmark | Gate implemented; latest live matched evidence diagnostic-only | Existing live matched diagnostics include 4/7 accepted, 0/3 accepted, and the 2026-04-25 bounded 5/7 accepted rerun; next proof requires broader/stable repeated applied evidence without severe regressions, not stronger wording from current artifacts. |

## 7. Next execution path

```bash
# Historical proposal-only smoke path; useful only for runner viability, not applied-code claims
node benchmarks/layer2-frontend-task/runner.js \
  --mode=vanilla \
  --target=shadcn-ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=benchmarks/layer2-frontend-task/results/R4-vanilla-run-2.json

node benchmarks/layer2-frontend-task/runner.js \
  --mode=fooks \
  --target=shadcn-ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=benchmarks/layer2-frontend-task/results/R4-fooks-run-2.json

# Applied-code attempt path: create files in an isolated temp workspace and validate them
npm run build
node benchmarks/layer2-frontend-task/run-r4-applied.js \
  --mode=vanilla \
  --target=<local combobox-example.tsx> \
  --output=benchmarks/layer2-frontend-task/results/R4-vanilla-applied-run.json \
  --keep-workdir

node benchmarks/layer2-frontend-task/run-r4-applied.js \
  --mode=fooks \
  --target=<local combobox-example.tsx> \
  --output=benchmarks/layer2-frontend-task/results/R4-fooks-applied-run.json \
  --keep-workdir

# Current stronger-evidence path: bounded repeated applied-code diagnostic
node benchmarks/layer2-frontend-task/run-r4-repeated.js \
  --target=<local combobox-example.tsx> \
  --required-accepted=5 \
  --max-pairs=8 \
  --provider=codex \
  --model="${CODEX_MODEL:-gpt-5.4-mini}" \
  --timeoutMs=300000 \
  --run-id=runtime-r4-rerun-YYYYMMDD \
  --keep-workdir
```

Do not call Layer 2 a stable runtime win until validated repeated outputs are
strong enough to support that stronger claim.

## 8. Naming rules

Allowed:

- ✅ `spec`
- ✅ `scaffold`
- ✅ `runner smoke`
- ✅ `runner path unblocked`
- ✅ `two R4 paired proposal-only smokes`
- ✅ `prompt supplied to Codex was smaller in the smoke`
- ✅ `applied acceptance validator implemented/self-tested`

Forbidden until applied-code validation and multi-task/statistical evidence exist:

- ❌ `Layer 2 benchmark complete`
- ❌ `stable Layer 2 win`
- ❌ `runtime-token savings proven`
- ❌ `billing-grade savings`
- ❌ `applied-code benchmark passed` (until live generated vanilla/fooks candidate trees pass the acceptance gate)

*Status date: 2026-04-25*
*Runner: ✅ tiny + R4 paired smokes passed*
*Benchmark: ✅ proposal-only smoke validated; 2026-04-25 applied rerun diagnostic-only; stable runtime claims out of scope*
