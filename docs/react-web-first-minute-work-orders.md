# React Web first-minute work orders

This note explains how a human maintainer should read the current React Web first-minute summary. It is documentation for the existing `fooks inspect react-web-issues` report surfaces, not a new apply path or a broader product claim.

## Before and after

Before #747, maintainers and agents had to interpret a longer issue report:

```text
source-derived React Web evidence
  -> ranked issue cards with problem / why it matters / where to look / confidence
  -> human or agent decides which card matters first, what to inspect, and what not to change
```

After #747, the same report also carries a compact first-minute mini work order:

```text
source-derived React Web evidence
  -> ranked issue cards
  -> firstMinuteSummary
       -> why this issue is first
       -> first inspect step
       -> next action
       -> human decision needed
       -> do-not-do boundaries
       -> compact context hints
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

`--summary-json` is intentionally smaller than full `--json`: it keeps the first-minute summary, rollup IDs, read-only flags, and claim boundary, while omitting detailed card fields such as source snippets, preview details, context packets, and suggested actions.

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
- **No auto-apply:** it does not apply patches, trigger codemods, or authorize automatic changes.
- **No generated accessible-name copy:** it does not invent final label text, aria-label text, or other accessible-name copy; a human or agent must choose copy from product context.
- **No broad accessibility audit:** it is a narrow native-control form/accessibility issue report, not a complete WCAG or design-system audit.
- **No custom-component semantic inference:** custom components remain manual-review evidence unless native-control facts are explicit enough.
- **No RN/TUI/WebView expansion:** React Native, TUI / React CLI, WebView, Vue/SFC, broad TS/JS, and multi-file refactor lanes remain outside this work-order claim unless future evidence and policy gates promote them.
- **Convention hints stay advisory:** first-minute `contextHints` may include a short repo-owned convention pointer, but that pointer must not change rank, priority, bucket, first inspect action, next action, or edit authority.

Keep future wording tied to the current inspect surfaces and these boundaries. If a future issue adds apply behavior, generated copy, broader accessibility coverage, custom-component semantics, or new runtime lanes, that should be documented as a separate capability with separate tests and evidence.
