# Workflow architecture

This document describes the service/workflow architecture language for fooks as a **frontend-first AI coding context manager**. It is a product architecture pass only; it does not implement new workflow behavior.

## Architecture intent

fooks should be described as a set of workflow services around current source evidence:

```text
source + task prompt
→ inspect / classify / summarize
→ policy decision
→ context packet or first-minute work order
→ agent reads/edits/verifies normally
→ receipt/status/report preserves the boundary
```

The workflow starts with source context and ends with a receipt. It should not be described as autonomous patch authority or provider/runtime optimization proof.

## Service responsibilities

| Service layer | Responsibility | Boundary |
| --- | --- | --- |
| Source inspection | Read current source and derive syntax/domain/concern facts. | Does not decide broad product claims. |
| Domain and concern profiling | Keep frontend-family evidence separate from task-context evidence. | Does not authorize compact reuse by itself. |
| Policy planning | Decide compact, narrow, fallback, or deferred handling for a measured scope. | Does not invent source facts. |
| Packet/work-order assembly | Format model-facing context, issue cards, warnings, and do-not-do guidance. | Does not override policy. |
| Runtime adapters | Deliver prepared context through the current runtime surface. | Do not broaden policy or provider claims. |
| Reporting/receipts | Preserve evidence, freshness, status, and claim boundaries. | Do not become runtime authority. |
| Operator/dogfood checks | Help humans see repository/session state. | Do not define product capability by themselves. |

## First-minute workflow

The first-minute workflow is the preferred product shape for frontend feature work:

1. identify the user-requested frontend source or scope, including React Web, React Native, WebView, TUI, Shared, or Unknown targets;
2. inspect the current file or named source surface;
3. produce bounded findings and next-inspection guidance;
4. tell the agent what not to assume;
5. require normal source reading when freshness, boundaries, or mixed signals make compact context unsafe;
6. verify edits with ordinary tests/review and preserve a receipt.

Issue cards, summaries, and dry-run previews are advisory context. They are not automatic edits, not final accessibility copy, not broad audits, and not permission to change task scope.

Evidence model selects the required proof before a workflow state can authorize the next action. TUI next actions should be terminal-specific when relevant: run a TTY smoke check, verify keyboard flow, check stdout/stderr behavior, and confirm the non-interactive fallback.

## Workflow states

| State | Meaning | Allowed next action |
| --- | --- | --- |
| `uninspected` | No current fooks evidence for the requested source. | Inspect current source or read normally. |
| `evidence-ready` | Source-derived evidence exists for the current fingerprint/scope. | Build a bounded work order or policy decision. |
| `fallback-required` | Boundary, freshness, unknown, or mixed evidence prevents compact reuse. | Read the current source normally. |
| `context-issued` | A packet/work order was prepared under policy. | Agent uses it as inspect-first guidance, then edits/verifies normally. |
| `receipt-recorded` | Output/test/review record exists. | Cite it only for the named scope and time. |
| `active-work` | Work remains open or unverified. | Continue verification or close with a fresh receipt. |

These state names are architecture vocabulary, not a declaration that the current CLI exposes these exact enum values.

## Agent handoff contract

A useful fooks handoff should answer:

- What source or scope was inspected?
- What evidence was observed?
- What confidence or boundary applies?
- What should the agent inspect first?
- What must the agent not do?
- When should the agent read full source instead?
- Which receipt proves this handoff existed?

The handoff should keep the user's original task in control. A context manager can guide work, but it should not turn a feature request into unrelated cleanup or dogfood symptom fixing.

## Implementation sequencing language

Future implementation issues should name which service layer they touch. The default sequence is:

1. docs and claim boundary;
2. tests/fixtures for the measured contract;
3. source inspection or policy seam changes;
4. packet/reporting changes;
5. runtime adapter changes only when a prior layer authorizes them;
6. receipts and release wording after verification.

A PR that changes runtime/provider behavior, merge gates, detector logic, CI workflows, or performance claims needs its own issue and evidence. This architecture pass does not authorize those changes.

## Architecture pass boundary

This docs architecture pass fixes language before implementation issues. This architecture boundary keeps user-project frontend domains separate from fooks' own operator UI. Adding TUI as a work domain must not redesign the fooks TUI board or broaden the evidence engine.
