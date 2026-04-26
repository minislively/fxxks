## fooks v0.1.0

fooks v0.1.0 introduces frontend context compression for iterative React/TSX work in Codex and Claude Code. Current claims are intentionally narrow and conservative.

### What fooks does

`fooks` reduces model-facing input context for supported repeated frontend file work. In the Codex path, the first eligible `.tsx`/`.jsx` mention records compact context; later same-file prompts may reuse it when safe. In the Claude path, project-local context hooks record and prepare the first eligible frontend-file prompt, with bounded repeated same-file context on subsequent prompts.

### Supported surface

| Environment | Release-ready wording |
| --- | --- |
| Codex | Automatic repeated-file hook path through `fooks setup` |
| Claude | Project-local context hooks for `SessionStart` / `UserPromptSubmit`; first eligible frontend-file prompt recorded/prepared, repeated same-file prompt may receive bounded context |
| opencode | Manual/semi-automatic custom tool and slash command prepared by `fooks setup` |

### What's new since stabilization

- Added Claude Runtime Status Module + Preset Status Parity (#133)
- Added deterministic fixture replay for edit-guidance targeting validation (#134)
- Hardened Claude adapter runtime resilience (#137)
- Aligned public README and docs with evidence claim boundaries (#135)
- Added runtime edit-guidance opt-in gating behind intent and freshness (#128)
- Preserved compact runtime defaults while opening edit-guidance opt-in (#126)
- Added frontend scope taxonomy for tracked guidance boundaries (#132)

### Benchmark evidence

- Local `fooks compare <file> --json` gives immediate prompt-size reduction estimates for supported frontend files
- Layer 2 applied diagnostic (pre-launch): 4/7 accepted pairs, median prepared-prompt compression 88.2% smaller; CLI runtime-token and latency signals were negative/unstable
- Outcome parity observed for deterministic fixture replay with edit-guidance targeting
- No stable runtime-token or time win claim is made

### Core principles

- Lower model-facing input/context load for supported repeated frontend work only
- `fooks setup` is explicit by design; installing the npm package does not auto-mutate hooks
- Local estimates only; not provider usage/billing tokens, invoices, dashboards, charged costs, or a `ccusage` replacement

### Explicitly out of scope

- Provider billing-token proof or cost proof
- Universal file-read interception for all environments
- LSP-backed semantic extraction or rename/reference resolution
- Stable runtime-token or latency guarantee across all tasks
- Browser/E2E behavior verification
- Whole-repo or non-frontend compression

### Caveats

- N={small} directional evidence only; not statistical proof
- Frontend-only proxy scope
- Wall-clock and runtime-token variance present across tasks
- Outcome parity observed, not identical file modifications
- Prepared-context estimates are not runtime billing telemetry

### What's changed

- Added `fooks doctor [codex|claude] [--json]` for read-only local diagnostics
- Added `fooks compare <file> --json` for local payload-size estimates
- Added `fooks extract <file> --model-payload` with bounded edit-guidance when safe
- Clarified public positioning: claim boundaries, not-claims, and supported surface
- Corrected runtime token interpretation wording in benchmark reports
- Added Claude context-hook support with trust-status and freshness checks
- Added cache resilience, monitoring, and atomic write safeguards
