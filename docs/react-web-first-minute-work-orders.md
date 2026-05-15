# React Web first-minute work orders

This note explains how a human maintainer should read the current React Web first-minute summary. It is documentation for the existing `fooks inspect react-web-issues` report surfaces, not a new apply path or a broader product claim.

## Before and after

Before #747, maintainers and agents had to interpret a longer issue report:

```text
source-derived React Web evidence
  -> ranked issue cards with problem / why it matters / where to look / confidence
  -> human or agent decides which card matters first, what to inspect, and what not to change
```

After #766, the same report carries a compact first-minute mini work order through an explicit decision layer:

```text
source-derived React Web evidence
  -> decision (allowedActions + stopConditions; source evidence outranks advisory context/memory; confidence is not apply authority)
  -> ranked issue cards
  -> firstMinuteSummary
       -> why this issue is first
       -> first inspect step
       -> next action
       -> human decision needed
       -> do-not-do boundaries
       -> compact context hints
  -> workflow output (`--summary-json` or `--dry-run-json`) reusing the same decision contract
```

The goal is to make the first minute legible: a maintainer can see which native-control card to inspect first, why it was prioritized, and which decisions still require human review before any edit happens.

## Current CLI surfaces

Use the text report when a person wants the compact work order before the detailed cards:

```bash
fooks inspect react-web-issues src/components/Form.tsx
```

Use full JSON when another tool needs the complete issue cards plus `firstMinuteSummary`:

```bash
fooks inspect react-web-issues src/components/Form.tsx --json
```

Use the compact projection when another tool only needs the first-minute work-order data and top IDs, without detailed issue cards:

```bash
fooks inspect react-web-issues src/components/Form.tsx --summary-json
```

`--summary-json` is intentionally smaller than full `--json`: it keeps the first-minute summary, decision fields, rollup IDs, read-only flags, and claim boundary, while omitting detailed card fields such as source snippets, preview details, context packets, and suggested actions.

Use the dry-run projection when an agent or migration planner needs read-only candidate rows instead of issue cards:

```bash
fooks inspect react-web-issues src/components/Form.tsx --dry-run-json
```

`--dry-run-json` is still not an apply path. It projects existing ranked issue evidence into migration candidates with affected files, first inspect steps, preview availability, decision fields, and risk notes. The projection stays dry-run-only: no patch application, generated accessible-name copy, custom-component semantic inference, or rank/priority/bucket changes.

## Decision layer contract

Every full issue card now includes a `decision` object, and `--summary-json` / `--dry-run-json` project that same contract into compact handoffs. The first-pass states are:

- `ready-for-agent-inspect`: inspect is allowed and a read-only patch-shape preview may be suggested, but `allowedActions.applyPatch` remains `false`.
- `human-decision-required`: inspect is allowed, but label/name shape or copy needs human review before any separate edit.
- `dry-run-candidate-only`: the dry-run row is inventory for planning only; `dryRunOnly` remains `true`.
- `unsupported`: unsupported or out-of-scope inputs stop safely.
- `incomplete`: in-scope inputs with no current issue/candidate evidence stop safely.
- `malformed-stop`: agent handoff validation failed closed.

The important invariants are structural: **current source evidence outranks advisory context, repo convention hints, and historical memory**, and **confidence high is evidence quality, not apply authority**. Consumers should check `decision.allowedActions` and `decision.stopConditions`, not infer authority from `confidence`, `fixability`, `triage.bucket`, preview availability, `contextHints`, repo-owned convention hints, or remembered prior sessions. Current React Web decisions always keep `allowedActions.applyPatch: false`, `allowedActions.generateCopy: false`, `autoApply: false`, and `humanReviewRequired: true`. This pass intentionally does not add authority/freshness schema fields such as `evidenceFreshness`, `decisionBasis`, or `contextAuthority`; the existing decision object remains the authority surface.

## Agent/tool handoff

For a feature request such as “implement the `Form.tsx` feature,” this handoff should shape the agent's first minute, not replace source reading. Run the supported React Web inspect surface, keep the decision and do-not-do fields attached, confirm the current source still matches the reported evidence, then continue the requested feature work without widening it into an automatic fix or broad audit.

### Agent integration decision tree

An agent should choose the smallest inspect surface that answers the handoff question:

| Agent need | Use | First field to read | Keep attached |
| --- | --- | --- | --- |
| Decide the first source action for a supported React Web file | `--summary-json` | `firstMinuteSummary.items[0]` | `decision`, `claimBoundary`, `humanDecisionNeeded`, `doNotDo`, `fixShapeGuidance.autoApply` |
| Build read-only migration candidate rows from ranked issue evidence | `--dry-run-json` | `candidates[]` | `decision`, `dryRunOnly`, `autoApply`, `humanReviewRequired`, `riskNotes` |
| Inspect detailed card evidence, context packets, or related local context | `--json` | `issues[]` plus `firstMinuteSummary` | `claimBoundary`, `contextPacket`, `relatedContext`, preview safety fields |
| A person wants a quick source-reading report | text mode | the first-minute summary before detailed cards | the printed boundaries and manual-review notes |

Do not start with full `--json` when the agent only needs the first action, and do not use `--dry-run-json` as a codemod runner. These projections are task-shaping inputs: they choose where to inspect and what evidence to preserve, not whether an edit is allowed.

Use `--summary-json` when an agent or tool needs a compact first-minute instruction packet instead of the full issue-card report:

```bash
fooks inspect react-web-issues src/components/Form.tsx --summary-json
```

The intended consumer flow is:

1. Read `firstMinuteSummary.items` in `sourceTopIssueIds` order.
2. Start with `items[0].firstInspectStep` and `items[0].nextAction`; inspect that source line first and confirm it still matches the reported evidence before suggesting changes.
3. Keep `decision`, `humanDecisionNeeded`, `doNotDo`, `fixShapeGuidance.autoApply`, and `claimBoundary` in the agent prompt or task card.
4. Treat `contextHints` as orienting evidence only; they may include source pointers or short advisory convention pointers, but they do not change rank, priority, bucket, or edit authority. Current source evidence wins over those hints and over historical memory.
5. If `items` is empty, stop and inspect the top-level `inScope` / `skippedReason` values instead of inventing a React Web task.

The compact handoff is not an apply command. It should help an agent choose the first source location to inspect, not skip human review, invent accessible-name copy, treat custom components as native controls, or widen the report into a broader accessibility audit. If an agent needs candidate rows for a migration plan, use `--dry-run-json` and keep its `dryRunOnly`, `autoApply`, `humanReviewRequired`, and `riskNotes` fields attached to the task card.

A compact first-minute agent task card should therefore retain the fields that prevent overreach:

```text
source: fooks inspect react-web-issues <file> --summary-json
start: firstMinuteSummary.items[0].firstInspectStep
next: firstMinuteSummary.items[0].nextAction
preserve: decision, claimBoundary, humanDecisionNeeded, doNotDo, fixShapeGuidance.autoApply
stop: if firstMinuteSummary.items is empty, inspect inScope/skippedReason instead of inventing a task
```

### Dry-run candidate handoff

Use `--dry-run-json` only when a migration planner needs a list of read-only candidate rows:

```bash
fooks inspect react-web-issues src/components/Form.tsx --dry-run-json
```

The intended dry-run consumer flow is:

1. Read `candidates[]` in the returned order; each candidate is derived from the ranked issue evidence.
2. Start each row from `candidate.firstInspectStep` and `candidate.affectedFile`.
3. Keep `decision`, `dryRunOnly`, `autoApply`, `humanReviewRequired`, and `riskNotes` with every task card.
4. Treat `previewAvailable` as a hint about whether a read-only preview shape exists, not as permission to change source; dry-run rows remain dry-run-only even when preview/context evidence exists.
5. If `candidates` is empty, stop and inspect `inScope` / `skippedReason` instead of creating a migration task.

A dry-run agent task card should keep the dry-run boundary visible:

```text
source: fooks inspect react-web-issues <file> --dry-run-json
row: candidates[n].issueId
inspect: candidates[n].firstInspectStep
file: candidates[n].affectedFile
preserve: decision, dryRunOnly, autoApply, humanReviewRequired, riskNotes
stop: if candidates is empty or inScope is false, do not create a migration candidate
```

## What the mini work order is allowed to say

A first-minute mini work order is an inspect-first handoff. It can point at the top ranked React Web native-control issue and summarize:

- why this issue appears first in the ranked evidence;
- the first inspect step to take in the source file;
- the next action shape, such as reviewing a native label/control association;
- the human decision needed before choosing final copy or a fix;
- do-not-do boundaries that keep the report advisory;
- compact context hints from existing source attributes, nearby evidence, or a matched repo-owned convention pointer.

Repo-owned convention hints may appear here only as short advisory pointers, for example a reminder to inspect same-file native JSX first. The compact work order must not inline full convention packets, policy boundaries, excluded-inference lists, config details, or enforcement language.

## Boundaries that must stay explicit

The React Web first-minute work order is conservative by design:

- **Read-only:** it reports source-derived evidence and does not edit files.
- **No auto-apply:** it does not apply patches, trigger codemods, or authorize automatic changes; high confidence, preview availability, convention hints, context packets, and remembered history never change this.
- **No generated accessible-name copy:** it does not invent final label text, aria-label text, or other accessible-name copy; a human or agent must choose copy from product context.
- **No broad accessibility audit:** it is a narrow native-control form/accessibility issue report, not a complete WCAG or design-system audit.
- **No custom-component semantic inference:** custom components remain manual-review evidence unless native-control facts are explicit enough.
- **No RN/TUI/WebView expansion:** React Native, TUI / React CLI, WebView, Vue/SFC, broad TS/JS, and multi-file refactor lanes remain outside this work-order claim unless future evidence and policy gates promote them.
- **Convention hints stay advisory:** first-minute `contextHints` may include a short repo-owned convention pointer, but that pointer must not change rank, priority, bucket, first inspect action, next action, or edit authority. Source evidence is the authority; convention/context/memory is only a pointer back to source inspection.

Keep future wording tied to the current inspect surfaces and these boundaries. If a future issue adds apply behavior, generated copy, broader accessibility coverage, custom-component semantics, or new runtime lanes, that should be documented as a separate capability with separate tests and evidence.
