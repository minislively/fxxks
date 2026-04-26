# Provider tokenizer proof boundary

## Decision

Provider/model tokenizer accounting is an optional proof-only lane for `fooks`.
The default `fooks compare <file> [--json]` command remains local,
dependency-free, and based on the existing source-bytes versus compact fooks
model-facing payload estimate.

A provider-tokenizer proof may be added later only as an explicit, opt-in path.
It must not change the default compare command, must not install tokenizer or
provider SDK dependencies by default, and must not be described as provider
billing tokens, provider invoice/dashboard/charged-cost proof, runtime hook envelope overhead, or a `ccusage`
replacement.

## What the default compare command proves

`fooks compare` is an L0 local estimate. It compares:

- original source bytes for one supported file; and
- bytes plus approximate tokens for the compact base fooks model-facing payload.

That supports wording about local prompt/context-size reduction potential. It
does not prove provider tokenizer behavior, API runtime usage, invoice tokens,
billed cost, dashboard usage, or the extra prompt envelope added by a runtime
hook or optional edit guidance.

## Optional provider-tokenizer proof lane

A future proof lane may answer a narrower question: “How would a named provider
or model tokenizer count the raw source and the fooks model-facing payload for
this isolated fixture/payload?”

If implemented, it should be visibly separate from default compare behavior:

- explicit command, script, or benchmark lane name;
- explicit provider/model identity in the output;
- explicit fixture or payload identity;
- no mutation of `fooks compare` defaults;
- no dependency added to the normal install path unless separately justified;
- output marked proof-only and estimate-scoped; and
- exclusions repeated in machine-readable output and public wording.

Recommended output boundaries:

```json
{
  "measurement": "optional-provider-tokenizer-proof",
  "proofOnly": true,
  "notDefaultCompare": true,
  "excludes": [
    "provider-billing-tokens",
    "provider-costs",
    "runtime-hook-envelope-overhead",
    "optional-edit-guidance-overhead",
    "invoice-or-dashboard-proof"
  ]
}
```

## Claude count_tokens design option

Claude exposes token counting as a provider API capability for messages. A
Claude proof lane would submit the raw source and fooks model-facing payload to
Claude token counting for a specific model and message shape, then compare those
counts for the same fixture.

Tradeoffs:

- **Pros:** provider-owned tokenizer behavior for the selected Claude model and
  message envelope; no local tokenizer implementation to maintain.
- **Cons:** requires credentials and network access; counts are tied to the
  exact API message shape and model; API behavior can change over time; it is
  still usage-estimate evidence, not billing or invoice proof.

Boundary: Claude token counting can support optional provider-tokenized prompt
accounting for a named model/message shape. It cannot support billed-token,
billed-cost, runtime-envelope, or cross-provider claims by itself.

## OpenAI/tiktoken design option

OpenAI model tokenization is commonly evaluated with `tiktoken` or equivalent
model-specific tokenizer tooling. An OpenAI proof lane could count the raw source
and fooks model-facing payload with the encoding for a named OpenAI model, then
publish the fixture/model/encoding used.

Tradeoffs:

- **Pros:** deterministic local proof lane is possible once the tokenizer package
  and model encoding are pinned; no provider API call is required for the count.
- **Cons:** adding `tiktoken` would add dependency, packaging, and compatibility
  surface; model-to-encoding mappings can change; chat/message envelope counting
  depends on the exact request format; local tokenizer counts are still not
  invoice, cost, or runtime-hook proof.

Boundary: OpenAI/tiktoken accounting can support optional model-tokenizer proof
for a pinned model/encoding and fixture. It must remain separate from default
`fooks compare` unless the dependency and install tradeoff is explicitly
accepted.

## Non-goals

- Replacing dependency-free local `fooks compare` defaults.
- Claiming provider usage/billing tokens, invoices, dashboards, or charged costs.
- Claiming runtime token savings from hook execution.
- Measuring optional edit-guidance or runtime hook envelope overhead.
- Replacing usage-log, invoice, billing export, or dashboard tooling.

## Acceptance rule for future work

Any future provider-tokenizer implementation must keep the current local compare
contract intact and add tests/docs that prove the provider-tokenizer path is
opt-in, proof-only, provider/model-scoped, and excluded from billing/cost/runtime
claims.
