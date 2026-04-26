# ccusage-style usage-log boundary

`fooks` is not a `ccusage` replacement. This decision keeps fooks' product surface focused on local model-facing context reduction and benchmark evidence, while keeping post-hoc provider usage/cost reporting separate.

## Decision

Do not integrate ccusage-style usage-log parsing into the default fooks product. The current scope is docs-only: define the boundary, make safe evidence artifacts discoverable, and leave any future usage-log bridge as an explicit, optional, local-only proof or import path.

## What fooks may report today

Safe fooks artifacts are generated from fooks-controlled local state or benchmark harness outputs:

- `fooks compare <file> --json`: local file-level source bytes, approximate tokens, compact model-facing payload size, and estimated reduction.
- `fooks status`: local `.fooks/sessions` summaries and runtime/source breakdowns, with per-session details omitted from normal CLI output.
- Provider-cost evidence under `.fooks/evidence/provider-cost/<run-id>/`: benchmark-harness usage-token artifacts converted into estimated API-cost deltas under explicit pricing assumptions.
- Billing-import reconciliation artifacts under `.fooks/evidence/billing-import/<run-id>/`: offline comparisons against already-redacted billing/export data supplied by the operator.

These artifacts may support local context-size, prompt-size, and estimate-scoped API-cost wording where the benchmark documentation says the assumptions hold. They do not prove provider invoices, billing-grade charges, stable runtime-token wins, or account-wide spend.

## What fooks must not do by default

- No runtime parser for private Codex, Claude, provider, or shell usage logs.
- No automatic reading of private usage logs from user home directories, runtime homes, provider cache folders, or unrelated projects.
- No telemetry upload, remote collection, account scraping, or background sync.
- No claim that `fooks status`, `fooks compare`, or provider-cost benchmark evidence is provider usage/billing-token telemetry.
- No bundled `ccusage` integration or replacement CLI behavior.

## Why fooks is not ccusage

`ccusage`-style tools answer post-hoc usage and cost questions from provider/runtime logs. `fooks` answers a different question: whether fooks can reduce the model-facing context payload for supported repeated same-file work, and how benchmark runs estimate cost under documented assumptions.

Keeping the products separate avoids confusing three evidence classes:

1. local payload estimates from fooks extraction/status;
2. benchmark provider-usage artifacts collected by explicit harness runs;
3. private, account-specific usage logs or billing exports controlled by the operator.

Only the operator can decide whether private usage logs or billing exports should be inspected, redacted, retained, or shared.

## Future optional local-only import, if ever added

A future usage-log bridge may be acceptable only as an explicit local command or proof script with these constraints:

- opt-in invocation with user-provided file paths; never auto-discovery of private logs;
- local-only processing with no network upload or telemetry;
- documented schema and redaction guidance before any generated artifact is shared;
- output limited to derived, reviewable summaries suitable for side-by-side comparison with existing fooks evidence;
- clear labels such as `operator-supplied-usage-log-import`, `estimated`, `redacted`, or `inconclusive` instead of billing-grade wording unless the billing-grade gate in `docs/benchmark-evidence.md` is satisfied;
- safe failure on unsupported providers, missing pricing, ambiguous model names, or unredacted/private fields.

Until such a path exists, users who need ccusage-style reporting should use a dedicated usage-log tool separately and compare conclusions manually against fooks' local estimates and benchmark evidence.
