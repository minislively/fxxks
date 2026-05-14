# React Web issue-card golden demo

This packaged demo is the short product-facing version of the detailed first-minute contract in [`../react-web-first-minute-work-orders.md`](../react-web-first-minute-work-orders.md). It uses the current `inspect react-web-issues` semantics: read-only React Web issue cards, compact first-minute handoff, and dry-run inventory rows. It is not a separate source of truth.

Use it to understand the first fooks habit:

```bash
fooks inspect react-web-issues fixtures/compressed/FormControls.tsx
```

## Before source

The demo source below is an excerpt from `fixtures/compressed/FormControls.tsx` around the native controls that trigger the issue cards. The full fixture also includes imports, form setup, a `Controller`, a registered input, and a submit button; the excerpt keeps the first-minute risk visible without pretending to be a separate fixture. The native controls have source facts that fooks can inspect, but the final accessible label/name copy still requires human judgment.

```tsx
export function FormControls() {
  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border p-4">
      <input name="email" type="email" required onChange={() => undefined} />
      <select className="rounded border px-3 py-2" name="role" defaultValue="viewer">
        <option value="viewer">Viewer</option>
        <option value="admin">Admin</option>
      </select>
      <textarea className="rounded border px-3 py-2" name="notes" disabled defaultValue="" />
    </form>
  );
}
```

## Command

```bash
fooks inspect react-web-issues fixtures/compressed/FormControls.tsx
```

Representative text output starts with the product boundary before any fix guidance:

```text
# React Web issue report

Read-only React Web issue report for a narrow native JSX label/accessibility subset only: adapts label-preview findings into actionable issue cards, never edits files, does not auto-apply patches, does not claim broad accessibility coverage, and does not infer custom-component semantics.

File: fixtures/compressed/FormControls.tsx
Read-only: yes
Auto-apply: no
In scope: yes
Issues: 5 (safe preview: 0, manual review: 5, unsafe to auto-apply: 5)
```

## Issue card shape

A card tells the agent what risk exists and where to inspect first. The field names are stable enough for humans and agents to recognize; the exact ranking can change with source evidence.

```text
## Issue 1: Native input lacks recognized accessible-label evidence.
- why: Users of assistive technology may not get a meaningful control name, making the control hard to understand or operate.
- where to look: fixtures/compressed/FormControls.tsx:23-23
- element: input
- confidence: high
- fixability: manual-review
- auto-fix safety: unsafe-to-auto-apply
- suggested action: Add an explicit accessible label with human-reviewed copy for the native control.
```

JSON consumers should preserve the same issue-card meaning:

```json
{
  "problem": "Native input lacks recognized accessible-label evidence.",
  "whyItMatters": "Users of assistive technology may not get a meaningful control name, making the control hard to understand or operate.",
  "whereToLook": "fixtures/compressed/FormControls.tsx:23-23",
  "confidence": "high",
  "suggestedAction": "Add an explicit accessible label with human-reviewed copy for the native control."
}
```

## First-minute handoff (`--summary-json`)

Agents that only need the compact work order should read the first summary item, then inspect the current source before suggesting anything.

```bash
fooks inspect react-web-issues fixtures/compressed/FormControls.tsx --summary-json
```

Representative first item:

```json
{
  "issueId": "react-web-label-1",
  "fixShape": "human-reviewed-native-control-name",
  "firstInspectStep": "Inspect fixtures/compressed/FormControls.tsx:23-23 (input) before editing.",
  "whyThisFirst": "Rank 1 high issue because label-preview confidence is high; high-confidence-manual-review remains human-reviewed.",
  "nextAction": "Start by inspecting fixtures/compressed/FormControls.tsx:23-23 (input) before editing.",
  "humanDecisionNeeded": [
    "Review the final accessible label/name copy.",
    "Choose the label/name shape from local JSX evidence."
  ],
  "doNotDo": [
    "Do not apply patches automatically from this report.",
    "Do not infer custom-component semantics.",
    "Do not generate accessible-name copy automatically."
  ],
  "decision": {
    "state": "human-decision-required",
    "allowedActions": {
      "inspect": true,
      "suggestPatch": false,
      "applyPatch": false,
      "generateCopy": false
    }
  }
}
```

Agent handoff:

1. Inspect `fixtures/compressed/FormControls.tsx:23` first.
2. Confirm the current source still matches the issue evidence.
3. Look for existing visible label, nearby native label/control structure, or source-observed naming hints.
4. Do **not** generate final label copy automatically.
5. If the target is a custom component or the source no longer matches, stop and read the file normally.

## Dry-run and safe-preview split (`--dry-run-json`)

Migration planners can request candidate rows, but the projection is still dry-run-only.

```bash
fooks inspect react-web-issues fixtures/compressed/FormControls.tsx --dry-run-json
```

Representative candidate:

```json
{
  "issueId": "react-web-label-1",
  "migrationCandidate": "human-reviewed-native-control-name",
  "affectedFile": "fixtures/compressed/FormControls.tsx",
  "firstInspectStep": "Inspect fixtures/compressed/FormControls.tsx:23-23 (input) before editing.",
  "previewAvailable": false,
  "humanReviewRequired": true,
  "autoApply": false,
  "dryRunOnly": true,
  "riskNotes": [
    "Correct user-facing accessible-name copy requires human review, so fooks reports the issue and does not auto-apply it.",
    "No deterministic safe preview is available; choose the final label/name shape from local source context.",
    "Do not apply patches automatically or generate accessible-name copy from this dry run.",
    "Do not infer custom-component semantics."
  ]
}
```

If a future or different source file produces `previewAvailable: true`, treat the preview as a read-only review aid, not permission to edit. `autoApply` remains false unless a separate human/tool workflow explicitly decides to make a source change after reading the current file.

## Boundary note

This demo proves the first-minute React Web issue-card loop, not a broader product claim.

- Read-only: `inspect react-web-issues` reports findings and handoff data; it does not edit files.
- No auto-apply: safe previews are review aids, not patch authority.
- No generated accessible-name copy: final label/name text stays human-reviewed.
- No broad accessibility audit: this is a narrow native JSX label/control subset, not a complete WCAG or design-system audit.
- No custom-component semantic inference: ambiguous/custom cases fall back to manual review or normal source reading.
- No RN/WebView/TUI expansion: those lanes remain boundary/roadmap topics, not supported by this React Web demo.
- No billing proof: benchmark/cost evidence elsewhere in the docs is estimate-scoped and does not prove provider invoices, provider billing tokens, or stable runtime-token savings.
