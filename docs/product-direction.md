# Product direction

This document defines the product direction for fooks before implementation issues change runtime behavior. It is an architecture and wording contract only.

## Direction

fooks is a **frontend-first AI coding context manager**. Its job is to help an AI coding agent start frontend work with source-grounded context, explicit boundaries, and reusable receipts instead of treating every prompt as an unstructured reread.

The product direction is:

1. inspect the current frontend source;
2. extract conservative, source-derived facts;
3. separate facts from permission to compact or reuse context;
4. hand the agent an inspect-first work order or context packet with clear non-goals;
5. preserve receipts that explain what was observed, what was claimed, and what remains active work.

This direction keeps fooks in the context-management layer: fooks is not a generic scanner, benchmark wrapper, or autonomous coding agent. It is not an auto-fix engine, codemod authority, provider billing meter, CI merge gate, runtime behavior guarantee, or replacement for reading the current source when the evidence is stale or unsupported.

## Product promise

The durable product promise is not "fewer tokens in every run." The safer promise is:

- fooks can organize frontend source facts into bounded context for AI coding agents;
- fooks can make the claim boundary visible before an agent edits;
- fooks can preserve receipts so later humans or agents can tell whether a statement was source evidence, local estimate evidence, or still active work.

Any stronger wording needs a named evidence source and a narrow measured scope. A local estimate is a local estimate. A receipt is a record of a run or decision. Active work is unfinished until a fresh verification command or review closes it.

## Current strongest user loop

The current strongest loop remains React Web first-minute change intelligence:

```text
user asks for frontend work
→ agent runs or receives fooks context for the current source
→ fooks reports source-derived frontend facts and boundaries
→ agent reads or reopens the current source when needed
→ agent edits within the user's task
→ tests/review produce a new receipt
```

The first-minute context is advisory. It tells the agent where to inspect first, what not to assume, and when a human decision or normal source reading is still needed. It does not authorize edits by itself.

## Claim / non-claim boundary

| Product statement | Claim status | Required evidence |
| --- | --- | --- |
| fooks is frontend-first. | Directional claim. | Product docs, README wording, and frontend-domain architecture. |
| fooks manages AI coding context. | Directional claim. | Context packet, work-order, status, or receipt surfaces. |
| fooks can report source-derived frontend facts. | Current bounded claim. | Current source plus command output or tests for the named surface. |
| fooks can reduce model-facing payload size for a measured file. | Estimate-scoped claim only. | `fooks compare` or benchmark evidence that names local estimate assumptions. |
| fooks proves provider billing/token savings. | Non-claim. | Out of scope unless a future provider/billing evidence lane explicitly proves it. |
| fooks proves runtime UI correctness. | Non-claim. | Out of scope; UI correctness still needs ordinary app tests/review. |
| fooks can change runtime/provider behavior. | Non-claim for this pass. | No runtime/provider behavior changes are authorized here. |

## Product principles

- **Frontend-first, not frontend-only forever.** The current product language should lead with frontend context value, while future lanes stay behind explicit evidence gates.
- **Evidence before claims.** Source facts, local estimates, receipts, and active work must not collapse into one word like "done" or "supported."
- **Fallback is product behavior.** Unsupported, stale, mixed, or boundary-heavy files should send the agent back to normal source reading instead of inventing compact context.
- **Receipts outlive prompts.** A useful run leaves enough evidence for a later reviewer to understand what happened without trusting memory.
- **Implementation follows architecture.** When product direction/evidence architecture not documented is the blocker, this pass fixes product direction and service language before symptom-fix dogfood or runtime code changes.

## Out of scope for this pass

This document does not change runtime/provider behavior, detector logic, CI workflows, merge-gate policy, performance claims, benchmark claims, or product implementation. It also does not authorize dogfood symptom fixes or cleanup outside the architecture docs/test scope for Issue #920.

## Current blocker boundary

When product direction/evidence architecture not documented is the blocker, do not create another symptom-fix dogfood PR. The allowed next action is docs architecture pass only.
