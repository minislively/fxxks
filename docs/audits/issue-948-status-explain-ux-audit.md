# Issue #948 status/explain UX audit

## Scope

Audited the user-facing `fooks status` and `fooks explain` surfaces after the domain-aware judgment and cleanup architecture work. The audit focused on whether CLI output makes the work item domain, evidence, rejected evidence/non-claims, state, and next action understandable without changing hooks, watchers, daemon behavior, automatic notifications, the evidence model, or the TUI board.

## Findings

- `fooks status` already preserves the metric status shape and attaches `workItemDashboard`, including `frontendDomainTaxonomy`, `domainJudgment`, evidence, non-claims, state, and required next action.
- `fooks explain status` and `fooks explain current` already render human-readable sections for Work item, Why, Evidence, Rejected evidence / non-claims, Domain judgment, Next action, and Non-claims.
- JSON explain output already exposes machine-readable domain judgment details for React Web, React Native, WebView, TUI, Shared, and Unknown domain cases.
- UX gaps found:
  - `fooks status --json` was rejected even though status is JSON-shaped and other status subcommands support `--json` discovery patterns.
  - The text explain surface showed the raw frontend domain slug, but did not pair it with the human domain label in the Work item and Domain judgment sections.
  - The Domain judgment text listed the domain next-action label but omitted the next-action kind, reason, and close condition, making it harder to distinguish domain-aware guidance from the overall work-item next action.

## Narrow changes made

- Allowed `fooks status --json` as an alias for bare `fooks status`.
- Clarified text explain output with human domain labels alongside slugs.
- Expanded text explain Domain judgment details to include recommended state, confidence, domain next-action kind, reason, and close condition.
- Added focused tests that cover status `--json`, text explain clarity, and all six domain judgments.

## Non-changes

- No evidence-model rewrite.
- No hooks/watch/daemon/automatic notifications.
- No TUI board redesign.
