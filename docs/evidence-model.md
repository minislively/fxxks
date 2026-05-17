# Evidence model

This document defines the vocabulary fooks should use for product claims, evidence, receipts, and active work. It is an architecture doc for conservative communication; it does not change implementation behavior.

## Core terms

| Term | Meaning | Example | Must not be treated as |
| --- | --- | --- | --- |
| Claim | A statement fooks makes about capability, outcome, support boundary, or measured result. | "This file produced local source-vs-payload estimate evidence." | A fact without evidence. |
| Non-claim | A statement that fooks explicitly does not make. | "This is not provider billing-token proof." | A hidden roadmap promise. |
| Evidence | Source, command output, fixture result, benchmark result, or review record that can support a narrow claim. | Current source fingerprint plus `fooks inspect` output. | Permission to broaden wording. |
| Receipt | A durable record that a run, review, decision, or verification happened at a point in time. | JSON output, benchmark artifact, test output, issue/PR closeout note. | Proof that the underlying work remains current forever. |
| Active work | Unfinished task state that still needs verification, review, or closeout. | An open issue, active worktree, failing check, or pending implementation plan. | Completed work or shipped product behavior. |

## Evidence classes

These classes are also referred to as Source evidence, Test evidence, Workflow evidence, Session evidence, and Receipt evidence when reports need a compact checklist.

| Evidence class | Can support | Cannot support |
| --- | --- | --- |
| Current source evidence | Source-derived frontend facts, source fingerprints, line-aware edit hints. | Runtime UI correctness, cross-file behavior, provider billing. |
| Local command evidence | What a fooks command emitted for a named input and environment. | Future runs after source or setup changes. |
| Fixture/test evidence | Regression boundaries for representative cases. | Universal framework behavior. |
| Local estimate evidence | Model-facing byte/token estimates under named assumptions. | Provider usage/billing-token, invoice, dashboard, or charged-cost proof. |
| Benchmark evidence | Repeated local measurements for a named harness. | Unmeasured user projects, stable runtime latency, or provider-wide savings. |
| Human/review receipt | A decision or review happened. | Automatic correctness of the underlying code. |

## Claim lifecycle

A claim should move through these states:

```text
proposed wording
→ named evidence source
→ narrow scope statement
→ receipt or test guarding the wording
→ public claim only if the measured scope is stable enough
```

If any state is missing, use non-claim language and point to the gap. For example, prefer "local estimate evidence" over "savings" when provider billing evidence is absent.

## Receipt rules

Receipts are useful because they preserve context across prompts and worktrees. A good receipt names:

- the command, review, or decision that produced it;
- the input path or issue scope;
- the source fingerprint or freshness boundary when applicable;
- the claim it can support;
- the non-claims it cannot support;
- the next action if work remains active.

A stale receipt should still be readable, but it should not silently authorize new claims. If source, setup, runtime, or policy inputs changed, produce a fresh receipt or fall back to current source reading.

## Active work rules

Active work is not evidence of completion. A worktree, issue, branch, session, or note can show that work exists, but completion still needs a closeout receipt such as passing tests, review, merged PR, or an explicit archived decision.

When reporting active work, separate:

- **observed:** what the command or repository shows now;
- **inferred:** what that observation likely means;
- **required next action:** what would close or verify it;
- **not claimed:** what the observation does not prove.

## Wording guardrails

Use these substitutions by default:

| Risky wording | Safer wording |
| --- | --- |
| "proves savings" | "reports local model-facing estimate evidence" |
| "the feature works" | "the named test/command passed for this scope" |
| "supported domain" | "measured lane" or "evidence lane," depending on the gate |
| "completed" | "closed by receipt X" |
| "active branch means active development" | "branch/worktree evidence exists; activity still needs review" |

## Out of scope for this pass

This pass does not add benchmark evidence, change claim guards, change CI policy, or change runtime/provider behavior. It only fixes the evidence vocabulary the next implementation issues should use.
