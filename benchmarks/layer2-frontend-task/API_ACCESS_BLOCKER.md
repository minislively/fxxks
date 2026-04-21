# Layer 2 API / Runner Access Blocker Analysis

> R4 Feature Module Split benchmark entry blockers and current disposition.

## 1. Current summary

The original Layer 2 blocker was a configured Codex gateway path returning 502
for both minimal prompts and R4-sized prompts. That diagnosis remains useful as
historical evidence, but it is no longer a current runner-path blocker:
`codex-wrapper.js` now uses the current `codex exec` interface, and both a tiny
smoke and a single R4 vanilla/fooks read-only smoke completed successfully on
2026-04-21.

Current disposition:

1. the legacy configured gateway 502 path is bypassed for the current runner;
2. the R4 proposal-only pair has been collected once;
3. validation artifacts and repeated runs are still missing;
4. therefore stable Layer 2 runtime-token/time claims remain blocked.

## 2. Current blocker table

| Item | Status | Detail |
| --- | --- | --- |
| API key / Codex auth | ✅ Available in current environment | Tiny and R4 `codex exec` smokes completed. |
| Codex CLI | ✅ Installed | Smoke used `codex exec --ephemeral --sandbox read-only`. |
| Runner implementation | ✅ Smoke passed | `runner.js` + `codex-wrapper.js` captured structured output. |
| R4 paired smoke | ✅ Collected once | Vanilla and fooks R4 proposal-only outputs succeeded. |
| Validation hook/schema | ✅ Scaffolded | Needs to be run against R4 outputs. |
| Repeated/validated benchmark | 🟡 Missing | Required before public stable win claims. |

## 3. R4 paired smoke evidence

Command shape:

```bash
CODEX_MODEL=gpt-5.4-mini CODEX_TIMEOUT_MS=300000 \
  node benchmarks/layer2-frontend-task/runner.js \
  --mode=<vanilla|fooks> \
  --target=/tmp/combobox-example.tsx \
  --output=/tmp/R4-<mode>-current-exec.json
```

Observed summary:

```json
{
  "vanilla": {
    "success": true,
    "exitCode": 0,
    "promptTokensApprox": 11365,
    "latencyMs": 85822,
    "outputChars": 7976
  },
  "fooks": {
    "success": true,
    "exitCode": 0,
    "promptTokensApprox": 861,
    "latencyMs": 57545,
    "outputChars": 9967
  },
  "deltas": {
    "promptTokensApproxReductionPct": 92.4,
    "latencyReductionPct": 32.9
  }
}
```

Interpretation: this resolves the previous “can the current runner execute at
all?” risk and shows the fooks prompt was much smaller for this smoke. It does
**not** prove billing-grade savings or stable runtime wins because it is a
single proposal-only pair without acceptance validation.

## 4. Tiny smoke evidence

Command:

```bash
CODEX_TIMEOUT_MS=90000 node benchmarks/layer2-frontend-task/runner.js \
  --mode=vanilla \
  --target=fixtures/raw/SimpleButton.tsx \
  --output=/tmp/fooks-layer2-smoke.json \
  --model=gpt-5.4-mini
```

Observed:

```json
{
  "success": true,
  "exitCode": 0,
  "promptTokensApprox": 236,
  "outputChars": 2610,
  "latencyMs": 44388
}
```

## 5. Historical 502 finding

Earlier tests against the legacy configured gateway path failed with 502 across
minimal, small, vanilla R4, and fooks R4 prompt sizes. The conclusion at that
time was correct: the failure was not caused by fooks context size. The current
wrapper avoids relying on that path.

## 6. Required next run

```bash
# Repeat R4 pairs and attach validation artifacts.
node benchmarks/layer2-frontend-task/runner.js \
  --mode=vanilla \
  --target=shadcn-ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=benchmarks/layer2-frontend-task/results/R4-vanilla-run-2.json

node benchmarks/layer2-frontend-task/runner.js \
  --mode=fooks \
  --target=shadcn-ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=benchmarks/layer2-frontend-task/results/R4-fooks-run-2.json
```

Record at least:

| Metric | Field |
| --- | --- |
| success/fail | `codexResult.success` |
| prompt tokens approx | `metrics.promptTokensApprox` |
| output chars | `metrics.outputChars` |
| retry count | `metrics.retryCount` |
| latency | `metrics.latencyMs` |
| validation | `output.validation.*` once validation is attached |

## 7. Claim boundary

Allowed wording:

- “Layer 2 runner path is unblocked through current `codex exec`.”
- “A single R4 paired smoke succeeded.”
- “The prompt supplied to Codex was 92.4% smaller in that smoke.”
- “Validation and repeated evidence are still pending.”

Forbidden wording until validated repeated outputs exist:

- “Layer 2 benchmark complete.”
- “R4 fooks beats vanilla.”
- “runtime-token savings proven.”
- “billing-grade savings.”

*Status date: 2026-04-21*
*Runner path: ✅ current `codex exec` smokes passed*
*R4 benchmark: 🟡 single proposal-only pair collected; validation/repetition pending*
