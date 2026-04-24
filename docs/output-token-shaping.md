# Output-token shaping evidence plan

Issue #156 tracks a separate question from fooks' existing input/context-size
work: can a bounded fooks payload also help an agent produce a smaller answer
without making the answer worse?

This page defines the safe first slice. It is intentionally a measurement and
reporting step, not a runtime prompt-steering feature.

## Current claim boundary

Today fooks may discuss:

- smaller model-facing/input context for supported repeated-file frontend work;
- local estimated context-size telemetry;
- provider usage-token artifacts converted into **estimated API cost** under an
  explicit pricing assumption.

Today fooks must not claim:

- output-token savings as a product property;
- provider invoice, dashboard, charge, or billing-grade savings;
- stable runtime-token, wall-clock, or latency wins;
- that agents can safely skip code changes, file reads, tests, or validation.

Output-token deltas are allowed as internal/experimental evidence fields only
when they come from matched artifacts. A positive output-token delta is not a
public savings claim until the matching pair also passes quality acceptance and
the relevant evidence lane explicitly allows that wording.

## Why not add runtime `outputGuidance` first?

The existing runtime edit-guidance path already has safety gates for repeated
same-file frontend edit intents: exact target, fresh context, matching source
fingerprint, and size budget. A new `outputGuidance` field would be different:
it would shape the model's answer rather than only point at likely patch anchors.

That can save output tokens only if the agent still performs the necessary work.
The risky failure mode is subtle: guidance such as "be concise" can pressure an
agent to omit a required patch, test, error explanation, or validation result.
Until matched accepted-pair evidence exists, output guidance belongs in design
notes and benchmarks, not default runtime payloads.

## Safe first slice

The first implementation slice should make output-token evidence visible without
changing agent behavior:

1. Keep provider-cost evidence claimability conservative.
2. Render input-token, output-token, and total-token deltas separately.
3. Render estimated input, output, and total API-cost deltas separately.
4. Keep the claim boundary text explicit: estimated API cost only; not billing
   savings; not stable runtime-token, wall-clock, or latency savings.
5. Add tests that lock the split-delta reporting and prevent savings overclaiming.

This helps future experiments answer whether output tokens moved independently
from input tokens, while preserving the existing public claim boundary.

## Future `outputGuidance` acceptance criteria

A later PR may add a gated `outputGuidance` field only if all of the following
are true:

- It is opt-in or narrowly gated to repeated exact same-file edit intents.
- It is bounded by freshness/fingerprint checks and a context-size budget.
- It explicitly says not to omit necessary code changes, file reads, tests, or
  validation.
- It is covered by unit tests for inclusion, exclusion, freshness mismatch, and
  budget behavior.
- It is evaluated in matched baseline/fooks pairs that pass the task acceptance
  validator on both sides.
- Reports keep output-token savings experimental/internal until accepted-pair
  evidence supports stronger wording.

Example safe wording for a future experiment:

> Prefer a concise final answer that lists the changed files and validation
> evidence, but do not omit required code changes, necessary reads, test output,
> regressions, or blockers.

## Non-goals

- Do not tune prompts to hide work or validation from the transcript.
- Do not use output-token deltas to imply provider billing savings.
- Do not collapse input and output token deltas into a single public win.
- Do not enable runtime answer shaping before the benchmark/reporting lane can
  show accepted-pair quality and token evidence side by side.
