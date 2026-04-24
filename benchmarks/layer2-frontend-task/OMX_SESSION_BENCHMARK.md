# OMX session benchmark plan

This lane measures the question that the public README does **not** answer yet:

> How much does fooks help during ordinary Codex work, and how much does it help
> when the same work is routed through an OMX session?

The existing public-code benchmark snapshot is a Codex OAuth no-tool harness that
compares full-source prompt payloads against `fooks extract --model-payload`
payloads. It is not an OMX-session result and not a full interactive installed
hook run. This benchmark lane must stay separate until it has its own evidence.

## Claim boundary

Until this lane completes, do not write any of these claims in README or release
copy:

- "OMX sessions are N% cheaper with fooks."
- "Normal Codex sessions are N% cheaper with fooks."
- "fooks reduces real interactive runtime tokens by N%."
- "fooks reduces provider bills or invoice cost."

Allowed interim wording after a dry run only:

- "An OMX/plain-session benchmark lane exists, but live matched-run evidence is
  pending."

Allowed wording after a live run only if all gates pass:

- "In the dated matched-run `<run-id>` lane, `<variant>` reduced
  provider-reported usage tokens / estimated API cost under explicit pricing
  assumptions."

## Matrix

Run the same task set through four variants:

| Variant | Command surface | fooks state | Purpose |
| --- | --- | --- | --- |
| `plain-vanilla` | `codex exec` | disabled with `FOOKS_DISABLE=1` | Baseline ordinary Codex session cost/quality. |
| `plain-fooks` | `codex exec` | `fooks init`/`scan`, `FOOKS_CODEX_HOME=<workdir>/.fooks` | Ordinary Codex + installed fooks hook behavior. |
| `omx-vanilla` | `omx exec` | disabled with `FOOKS_DISABLE=1` | OMX orchestration overhead without fooks. |
| `omx-fooks` | `omx exec` | `fooks init`/`scan`, `FOOKS_CODEX_HOME=<workdir>/.fooks` | OMX orchestration plus fooks hook behavior. |

Use the same model, repository fixture, prompt text, worktree isolation, and task
order for every variant. Alternate variant order with ABBA/BAAB style ordering so
one variant does not always benefit from model/cache/order effects.

## Task selection for maximum visible effect

Use large, repeated same-file tasks where fooks is expected to help most:

1. Next.js `packages/next/src/client/components/app-router.tsx`
   - summarize responsibilities, state/context contract, navigation boundaries,
     edit risks;
   - then ask a second exact-file follow-up in the same session.
2. Next.js `packages/next/src/client/components/layout-router.tsx`
   - produce a behavior-preserving refactor plan;
   - then ask a second exact-file follow-up in the same session.
3. Tailwind `packages/tailwindcss/src/utilities.ts`
   - summarize utility generation responsibilities and risks;
   - then ask a second exact-file follow-up in the same session.
4. Tailwind `packages/tailwindcss/src/variants.ts`
   - produce a behavior-preserving refactor plan;
   - then ask a second exact-file follow-up in the same session.

The repeated exact-file follow-up matters: fooks is strongest when the first
eligible mention prepares/caches context and later same-file prompts can reuse a
compact payload. One-off broad multi-file tasks dilute the effect.

## Execution rules

- Use fresh isolated workdirs for each pair side.
- Keep the target repository state identical across variants.
- Use exact file paths in prompts.
- Do not let the model run shell commands when the lane is intended to measure
  prompt/context effects; command execution must be counted separately or failed
  by the quality gate.
- Record command surface (`codex exec` vs `omx exec`), fooks state, `CODEX_HOME`,
  `FOOKS_CODEX_HOME`, model, task id, run id, and timestamp.
- Collect provider-reported usage if available from Codex JSON events; otherwise
  classify the run as diagnostic-only.
- Estimate API cost only from explicit usage records plus a dated pricing table.

## Command skeleton

Plain baseline:

```bash
FOOKS_DISABLE=1 \
  codex exec --ephemeral --skip-git-repo-check --sandbox read-only \
  -C "$ISOLATED_WORKDIR" -m "$MODEL" - < "$PROMPT_FILE"
```

Plain fooks:

```bash
node "$FOOKS_CLI" init
node "$FOOKS_CLI" scan
FOOKS_CODEX_HOME="$ISOLATED_WORKDIR/.fooks" \
FOOKS_ACTIVE_ACCOUNT="minislively" \
  codex exec --ephemeral --skip-git-repo-check --sandbox read-only \
  -C "$ISOLATED_WORKDIR" -m "$MODEL" - < "$PROMPT_FILE"
```

OMX baseline:

```bash
FOOKS_DISABLE=1 \
  omx exec --ephemeral --skip-git-repo-check --sandbox read-only \
  -C "$ISOLATED_WORKDIR" -m "$MODEL" - < "$PROMPT_FILE"
```

OMX fooks:

```bash
node "$FOOKS_CLI" init
node "$FOOKS_CLI" scan
FOOKS_CODEX_HOME="$ISOLATED_WORKDIR/.fooks" \
FOOKS_ACTIVE_ACCOUNT="minislively" \
  omx exec --ephemeral --skip-git-repo-check --sandbox read-only \
  -C "$ISOLATED_WORKDIR" -m "$MODEL" - < "$PROMPT_FILE"
```

## Acceptance gates

A run is publishable only if all gates pass:

- at least 5 accepted matched pairs per task and variant comparison;
- same model and same task prompts across variants;
- no unintended command execution in no-tool lanes;
- answer-quality checks pass for both sides;
- usage/cost records exist for all accepted sides;
- regressions are reported, not hidden;
- README wording states the exact measured surface: plain Codex session or OMX
  session, not both.

## Reporting shape

Keep results separate from the existing no-tool payload benchmark:

| Surface | Comparison | Accepted pairs | Usage-token delta | Estimated API-cost delta | Regressions | Claim status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Plain Codex session | `plain-vanilla` vs `plain-fooks` | pending | pending | pending | pending | pending live evidence |
| OMX session | `omx-vanilla` vs `omx-fooks` | pending | pending | pending | pending | pending live evidence |
| OMX overhead | `plain-vanilla` vs `omx-vanilla` | pending | pending | pending | pending | diagnostic only |
| OMX+fooks combined | `plain-vanilla` vs `omx-fooks` | pending | pending | pending | pending | diagnostic unless scoped |

## Approval gate

Live execution spends provider quota/tokens and may create many Codex/OMX session
artifacts. Build manifests and dry-run checks can run without approval, but the
live four-variant campaign needs explicit approval for the spend cap, model, task
count, and target repositories.
