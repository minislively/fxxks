# Provider cost import validation runbook

This runbook is the non-live path for answering: **how much estimated OpenAI API cost changed for matched baseline vs fooks runs?**

It intentionally does **not** prove provider invoice/dashboard billing savings and does **not** prove stable runtime-token/time savings.

## Evidence standard

Launch-grade estimated API cost evidence requires:

- 3 predeclared task classes;
- 5 accepted matched baseline/fooks pairs per task class;
- same model, endpoint, service tier, reasoning, max output token, and setup identity inside each comparable group;
- provenance `validated-provider-import` or `live-openai-usage`;
- positive median estimated total API cost reduction per task and overall;
- quality gates pass for both baseline and fooks artifacts;
- campaign manifest + attempted-pair ledger preserving the denominator, including failed, missing, neutral, regressed, and omitted pairs;
- explicit pricing assumptions for input, cached-input, output, endpoint/service tier, long-context, and regional/data-residency treatment.

Fixture samples only prove mechanics. They should classify as `fixture-launch-grade-mechanics`, not public positive evidence.

## Offline billing import reconciliation

The billing-import tier is the safe, non-live bridge from existing estimated API
cost evidence to future billing review. It validates a redacted/local billing
artifact and writes a side-by-side reconciliation beside a provider-cost
`evidence.json` or campaign `summary.json`.

Generate only the local import schema/readme:

```bash
npm run bench:layer2:billing-import -- \
  --run-id=billing-import-schema-smoke
```

Reconcile a redacted billing/dashboard/export/manual artifact with an existing
estimated-cost artifact:

```bash
npm run bench:layer2:billing-import -- \
  --import=/path/to/redacted-billing-import.json \
  --estimated-evidence=.fooks/evidence/provider-cost/<run-id>/evidence.json \
  --run-id=billing-reconciliation-review
```

A synthetic redacted example import is available for local mechanics checks:

```bash
npm run bench:layer2:billing-import -- \
  --import=benchmarks/layer2-frontend-task/fixtures/billing-import/redacted-openai-dashboard-export.example.json \
  --estimated-evidence=.fooks/evidence/provider-cost/<run-id>/evidence.json \
  --run-id=billing-reconciliation-example
```

Campaign summaries can be passed with `--summary` or `--provider-cost`:

```bash
npm run bench:layer2:billing-import -- \
  --import=/path/to/redacted-billing-import.json \
  --summary=.fooks/evidence/provider-cost/<run-id>/summary.json \
  --run-id=billing-campaign-reconciliation-review
```

Generated output:

- `.fooks/evidence/billing-import/<run-id>/import.schema.json`
- `.fooks/evidence/billing-import/<run-id>/README.md`
- `.fooks/evidence/billing-import/<run-id>/reconciliation.json` when both
  `--import` and estimated evidence are provided
- `.fooks/evidence/billing-import/<run-id>/reconciliation.md` when both
  `--import` and estimated evidence are provided

The reconciliation status is intentionally narrow:

- `reconciliation-ready`: required billing fields, provider/model matching,
  usage tokens, billed amount, and estimate-scoped provider-cost evidence are
  present for side-by-side review.
- `inconclusive`: non-fatal data is missing, such as model, billed amount,
  usage tokens, redaction metadata, or estimated aggregate cost.
- `mismatch`: provider/model/period contract checks block linking the import
  to the estimated evidence.
- `invalid`: required import or estimated-evidence fields are absent or the
  estimated evidence is not `estimated-api-cost-only`.

Claim boundary: this is still **not** provider invoice/dashboard savings proof,
actual charged-cost savings proof, or provider usage/billing-token savings proof. The
artifact always keeps `providerInvoiceOrBillingSavings=false` and
`providerBillingTokenSavings=false`; it only makes the future billing review
lane auditable without collecting credentials or calling billing APIs.

## Files in the import kit

Fixture mechanics kit:

- `fixtures/provider-cost-import-kit/import-manifest.json`
- `fixtures/provider-cost-import-kit/campaign-manifest.json`
- `fixtures/provider-cost-import-kit/attempted-pair-ledger.json`
- `fixtures/provider-cost-import-kit/pair-evidence/*.json`

The fixture kit is safe to run without credentials and should not make a real provider-cost claim.

Live OpenAI campaign template:

- `provider-cost-live-campaign-tasks.json`

This template predeclares 3 task classes × 5 matched pairs. It is the live path for estimated API cost evidence, but it requires an OpenAI credential and explicit spend caps. The default auth mode is `auto`: `OPENAI_API_KEY`/`OPEN_AI_APIKEY` first, then Codex OAuth from `$FOOKS_CODEX_HOME/auth.json`, `$CODEX_HOME/auth.json`, or `~/.codex/auth.json`. Use `--auth-mode=codex-oauth --transport=codex-exec` when validating the common Codex/ChatGPT sign-in path; that transport shells out to `codex exec --json` and reads the `turn.completed.usage` event instead of requiring a platform API key. Without credentials, the runner records a local blocker artifact and makes no request.

Its task quality gates are imported-artifact gates, not manual-review
instructions. The recorded gate command is:

```bash
npm run bench:layer2:provider-cost:repeated -- \
  --import-manifest=benchmarks/layer2-frontend-task/fixtures/provider-cost-import-kit/import-manifest.json \
  --run-id=provider-cost-import-kit-smoke
```

That command validates the local provider-cost import kit, including evidence
shape, source provenance, denominator accounting, and recorded quality-gate
pass/fail status. It is intentionally mechanics-scoped; semantic product
mechanism proof remains the corrected real-payload campaign lane below.

Corrected real-payload campaign builder:

- `build-provider-cost-corrected-manifest.js`

Use this when the goal is to test the real fooks product mechanism rather than a
synthetic "compact prepared context" label. The builder creates a generated
manifest under `.fooks/evidence/provider-cost/<run-id>/` with full-source
baseline payload files, real `fooks extract --model-payload` JSON payload files,
per-task prompt payload-size stats, AB/BA order, and a no-tool quality gate.

## One-command mechanics check

```bash
npm run bench:layer2:provider-cost:repeated -- \
  --import-manifest=benchmarks/layer2-frontend-task/fixtures/provider-cost-import-kit/import-manifest.json \
  --run-id=provider-cost-import-kit-smoke
```

Expected mechanics status:

```text
fixture-launch-grade-mechanics
```

Generated output:

- `.fooks/evidence/provider-cost/provider-cost-import-kit-smoke/summary.json`
- `.fooks/evidence/provider-cost/provider-cost-import-kit-smoke/summary.md`
- `.fooks/evidence/provider-cost/provider-cost-import-kit-smoke/campaign-ledger.json`

## Real provider usage import

For a real import campaign:

1. Copy the fixture kit to a private/local evidence directory.
2. Replace each pair evidence JSON with real matched baseline/fooks OpenAI usage artifacts.
3. Set pair evidence provenance/source kind to `validated-provider-import`.
4. Keep every attempted pair in `attempted-pair-ledger.json`, including failures, missing usage, neutral outcomes, regressions, and omitted pairs with reasons.
5. Update `campaign-manifest.json` with the actual model, endpoint, service tier, reasoning settings, quality gate, pricing source URL, and checked date.
6. Run the repeated provider-cost import command.

The summary may claim `launch-grade-estimated-cost-evidence` only when the threshold passes. Otherwise it must remain narrow/diagnostic.

## Real live OpenAI campaign

Check the plan without making requests:

```bash
npm run bench:layer2:provider-cost:repeated -- \
  --live-openai \
  --dry-run-live \
  --auth-mode=codex-oauth \
  --transport=codex-exec \
  --task-manifest=benchmarks/layer2-frontend-task/provider-cost-live-campaign-tasks.json \
  --model="${OPENAI_MODEL:-gpt-5.4}" \
  --max-matched-pairs=15 \
  --max-estimated-usd=5 \
  --campaign-max-estimated-usd=15
```

Run the actual capped campaign only in a shell that has a resolved API key or Codex OAuth login:

```bash
npm run bench:layer2:provider-cost:repeated -- \
  --live-openai \
  --auth-mode=codex-oauth \
  --transport=codex-exec \
  --task-manifest=benchmarks/layer2-frontend-task/provider-cost-live-campaign-tasks.json \
  --model="${OPENAI_MODEL:-gpt-5.4}" \
  --max-matched-pairs=15 \
  --max-estimated-usd=5 \
  --campaign-max-estimated-usd=15 \
  --run-id=provider-cost-live-campaign
```

The runner writes `.fooks/evidence/provider-cost/<run-id>/summary.json`, `summary.md`, `campaign-ledger.json`, and pair evidence under `pairs/`. A no-credential run is expected to report `live-openai-credentials-missing` with `requestMade: false`; that is a safe blocker, not evidence of cost reduction. If Codex OAuth is present but the provider rejects the request, the status is `live-openai-request-failed`; keep that artifact and inspect the attempted-pair ledger before rerunning.

## Corrected real-payload live campaign

The first live Codex OAuth campaign proved the OAuth usage pipeline and the
3 × 5 denominator, but it also showed why a one-pair smoke was not enough: the
smoke was positive, while the full campaign had 14/15 estimated-cost
regressions. It should be treated as a diagnostic against cherry-picking, not
as a final product-mechanism test, because the fooks side did not include a real
fooks payload and Codex workspace/tool activity dominated the token count.

Build a corrected manifest after `dist/` is available:

```bash
npm run bench:layer2:provider-cost:corrected-manifest -- \
  --run-id=provider-cost-corrected-real-payload \
  --target-pair-count=5
```

Dry-run the corrected campaign:

```bash
npm run bench:layer2:provider-cost:repeated -- \
  --live-openai \
  --dry-run-live \
  --auth-mode=codex-oauth \
  --transport=codex-exec \
  --codex-workdir=isolated \
  --pair-order=abba \
  --require-no-tool-use=true \
  --task-manifest=.fooks/evidence/provider-cost/provider-cost-corrected-real-payload/corrected-task-manifest.json \
  --model="${OPENAI_MODEL:-gpt-5.4}" \
  --max-matched-pairs=15 \
  --max-estimated-usd=5 \
  --campaign-max-estimated-usd=15
```

Run it only when spend is acceptable:

```bash
npm run bench:layer2:provider-cost:repeated -- \
  --live-openai \
  --auth-mode=codex-oauth \
  --transport=codex-exec \
  --codex-workdir=isolated \
  --pair-order=abba \
  --require-no-tool-use=true \
  --task-manifest=.fooks/evidence/provider-cost/provider-cost-corrected-real-payload/corrected-task-manifest.json \
  --model="${OPENAI_MODEL:-gpt-5.4}" \
  --fetch-pricing \
  --max-matched-pairs=15 \
  --max-estimated-usd=5 \
  --campaign-max-estimated-usd=15 \
  --run-id=provider-cost-corrected-real-payload
```

The corrected manifest builder is intentionally payload-only: it writes
full-source baseline contexts, fooks model-facing payload contexts, and
payload-size stats. It does not write pricing rates or estimated costs. Pricing
is resolved only by `run-provider-cost-repeated.js` when the campaign is
executed (`--fetch-pricing`, `--pricing-catalog`, or explicit pricing args), so
cost estimation cannot change extraction behavior or prompt construction.

Interpretation guardrails:

- `--codex-workdir=isolated` keeps Codex away from repo/evidence workdirs.
- `--pair-order=abba` alternates baseline/fooks ordering to reduce order bias.
- `--require-no-tool-use=true` fails the pair-side quality gate if Codex JSONL
  contains `command_execution` events.
- Positive prompt payload reduction in the generated manifest is not enough by
  itself; the live campaign still needs positive median estimated API cost
  deltas across the required accepted pairs.

Known 2026-04-22 corrected campaign outcome:

- run id: `provider-cost-corrected-real-payload-campaign-20260422`;
- status: `launch-grade-estimated-cost-evidence`;
- 15/15 accepted pairs across 3 task classes;
- no-tool gate passed for every side (`command_execution` count 0);
- median estimated API cost reduction: `4.171%`;
- aggregate estimated API cost reduction: `$0.0340775` (5.787%) under the
  recorded pricing assumption;
- 4/15 individual pairs still regressed, so follow-up campaigns should preserve
  the full denominator and not present only favorable pairs.

This supports only estimate-scoped API-cost language. It still does not support
provider invoice/dashboard savings, actual charged-cost savings,
provider-billing-token savings, stable runtime-token savings, or stable
wall-clock/latency savings.

## Large public-code corrected profiles

Use larger public-code profiles when the question is whether the small fixture
effect was diluted by Codex fixed prompt/runtime overhead:

```bash
npm run bench:layer2:provider-cost:corrected-manifest -- \
  --profile=nextjs-large \
  --nextjs-root=~/Workspace/fooks-test-repos/nextjs \
  --run-id=provider-cost-nextjs-large-real-payload \
  --target-pair-count=5

npm run bench:layer2:provider-cost:corrected-manifest -- \
  --profile=tailwind-large \
  --tailwindcss-root=~/Workspace/fooks-test-repos/tailwindcss \
  --run-id=provider-cost-tailwind-large-real-payload \
  --target-pair-count=5
```

Then run the generated manifest with the same dry-run/full command shape as the
fixture corrected lane, changing only `--task-manifest` and `--run-id`.

Known 2026-04-22 outcomes:

- Next.js large: `provider-cost-nextjs-large-real-payload-campaign-20260422`
  - `launch-grade-estimated-cost-evidence`;
  - 15/15 accepted, 0 regressions, 0 command executions;
  - median estimated API cost reduction `26.492%`;
  - aggregate provider-reported total usage-token reduction `14.371%`;
  - aggregate estimated API cost reduction `$0.23889` (`27.028%`).
- Tailwind large: `provider-cost-tailwind-large-real-payload-campaign-20260422`
  - `launch-grade-estimated-cost-evidence`;
  - 15/15 accepted, 0 regressions, 0 command executions;
  - median estimated API cost reduction `38.238%`;
  - aggregate provider-reported total usage-token reduction `46.9%`;
  - aggregate estimated API cost reduction `$0.950345` (`59.438%`).

These are stronger than the small fixture lane because the source payloads are
large enough for fooks payload compression to dominate Codex's fixed prompt
overhead. The allowed wording is still estimate-scoped; do not claim
invoice/dashboard savings or stable wall-clock/runtime wins from these runs.

## Interpreting statuses

- `launch-grade-estimated-cost-evidence`: estimated API cost positive evidence threshold passed.
- `narrow-estimated-cost-candidate`: positive evidence exists but not enough task coverage or accepted pairs for launch-grade.
- `fixture-launch-grade-mechanics`: fixture-only threshold mechanics passed; not a public positive cost claim.
- `mixed-identity`: model/setup/endpoint/service-tier identity differs inside comparable groups.
- `missing-usage`: provider usage tokens are missing or inconclusive.
- `insufficient-accepted-pairs`: denominator is visible but threshold is not met.
- `diagnostic-only`: evidence is not claimable; inspect diagnostics.

## Claim boundary

Allowed after real launch-grade estimated-cost evidence:

> In this benchmark campaign, fooks reduced estimated OpenAI API cost under explicit pricing assumptions.

Not allowed from this lane:

- provider invoice/dashboard billing savings;
- actual charged-cost savings;
- provider usage/billing-token savings;
- stable runtime-token savings;
- stable wall-clock/time/latency savings;
- Claude/opencode automatic cost savings.
