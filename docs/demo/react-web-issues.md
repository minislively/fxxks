# React Web issue-card golden demo

This packaged demo is the short product-facing version of the detailed first-minute contract in [`../react-web-first-minute-work-orders.md`](../react-web-first-minute-work-orders.md). It uses the current `inspect react-web-issues` semantics: read-only React Web issue cards, compact first-minute handoff, and dry-run inventory rows. It is not a separate source of truth.

Use it to understand the first fooks habit:

```bash
fooks inspect react-web-issues <supported-react-web-file>
```

The examples below are intentionally split into short golden slices instead of one kitchen-sink fixture. They show the current emitted card families that are safe to present in README-facing docs: missing native label/name evidence, empty `aria-label` evidence, same-file missing `htmlFor` targets, and high-confidence read-only `htmlFor` association previews. Each full card still carries the stable human/agent fields `problem`, `whyItMatters`, `whereToLook`, `confidence`, and `suggestedAction`; the snippets show only the shortest representative lines.

## Demo 1: missing native label/name evidence

Baseline source excerpt from `fixtures/compressed/FormControls.tsx`:

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

```bash
fooks inspect react-web-issues fixtures/compressed/FormControls.tsx
```

Representative output:

```text
Issues: 5 (safe preview: 0, manual review: 5, unsafe to auto-apply: 5)
Source issues: label-preview 5, htmlFor target-resolution 0

## Issue 1: Native input lacks recognized accessible-label evidence.
- first inspect: Inspect fixtures/compressed/FormControls.tsx:23-23 (input) before editing.
- next action: Inspect fixtures/compressed/FormControls.tsx:23-23 (input) first; confirm current source still matches before suggesting changes.
- human decision needed: Confirm the final accessible label/name copy from current source context.
- do not do: Do not apply patches automatically from this report.; Do not generate final label/name copy automatically.
- where to look: fixtures/compressed/FormControls.tsx:23-23
- confidence: high
- fixability: manual-review
- auto-fix safety: unsafe-to-auto-apply
- suggested action: Add an explicit accessible label with human-reviewed copy for the native control.
```

## Demo 2: empty `aria-label` evidence

Empty accessible-name evidence is a different manual-review card from a missing label. The source already has accessible-name evidence, but the value is blank or whitespace-only.

```tsx
function EmptyAriaLabels() {
  return (
    <form>
      <input aria-label="" name="email" type="email" />
      <button aria-label=" ">Save</button>
      <textarea aria-label="" name="notes" />
    </form>
  );
}
```

```bash
fooks inspect react-web-issues test/fixtures/react-web-label-preview/empty-aria-labels.tsx
```

Representative output:

```text
Issues: 3 (safe preview: 0, manual review: 3, unsafe to auto-apply: 3)
Source issues: label-preview 3, htmlFor target-resolution 0

## Issue 1: Native input has empty accessible-name evidence.
- why: A blank aria-label creates accessible-name evidence that communicates no useful control name.
- where to look: test/fixtures/react-web-label-preview/empty-aria-labels.tsx:4-4
- fix shape: human-reviewed-accessible-name — Choose a human-reviewed accessible-name shape for this native input from local JSX context.
- suggested action: Replace the empty aria-label with human-reviewed accessible-name evidence.
```

## Demo 3: `htmlFor` wiring cards

`htmlFor` support has two distinct current shapes: missing target-resolution cards are manual-review, while high-confidence nearby native label/control associations can include a read-only preview.

### Missing `htmlFor` target

```tsx
function MissingHtmlForTarget() {
  return (
    <form>
      <label htmlFor="missing-email">Email address</label>
      <input id="email" name="email" />
    </form>
  );
}
```

```bash
fooks inspect react-web-issues test/fixtures/react-web-label-preview/missing-htmlfor-target.tsx
```

Representative output:

```text
Issues: 1 (safe preview: 0, manual review: 1, unsafe to auto-apply: 1)
Source issues: label-preview 0, htmlFor target-resolution 1

## Issue 1: Native label references htmlFor="missing-email" but no same-file literal id target was found.
- issue id: react-web-htmlfor-target-1
- where to look: test/fixtures/react-web-label-preview/missing-htmlfor-target.tsx:6-6
- source: htmlFor-target-resolution — Same-file literal target-resolution found a label htmlFor value without exactly one matching literal id.
- fix shape: human-reviewed-htmlFor-target-resolution — Inspect the literal htmlFor target and choose a human-reviewed target-resolution shape; do not create ids automatically.
- suggested action: Inspect label htmlFor="missing-email" and decide whether to correct the target id, add a matching native-control id, or remove stale label wiring.
```

### Safe-preview nearby association

```tsx
function LabelAssociationCandidates() {
  return (
    <form>
      <label>Email</label>
      <input id="email" name="email" />
    </form>
  );
}
```

```bash
fooks inspect react-web-issues test/fixtures/react-web-label-preview/label-association-candidates.tsx
```

Representative output:

```text
Issues: 3 (safe preview: 1, manual review: 2, unsafe to auto-apply: 2)
Source issues: label-preview 3, htmlFor target-resolution 0

## Issue 1: Nearby label text is not explicitly associated with this native input.
- fixability: safe-preview
- auto-fix safety: not-auto-applied
- fix shape: safe-preview-htmlFor-association — Inspect the read-only htmlFor/id association preview for this native input; use only after human review.
- suggested action: Connect the nearby native label/control pair with htmlFor/id when the preview evidence remains valid.
```

## First-minute handoff (`--summary-json`)

Agents that only need the compact work order should read the first summary item, then inspect the current source before suggesting anything.

```bash
fooks inspect react-web-issues test/fixtures/react-web-label-preview/empty-aria-labels.tsx --summary-json
```

Representative first item:

```json
{
  "issueId": "react-web-label-1",
  "fixShape": "human-reviewed-accessible-name",
  "firstInspectStep": "Inspect test/fixtures/react-web-label-preview/empty-aria-labels.tsx:4-4 (input) before editing.",
  "nextAction": "Inspect test/fixtures/react-web-label-preview/empty-aria-labels.tsx:4-4 (input) first; confirm current source still matches before suggesting changes.",
  "humanDecisionNeeded": [
    "Confirm the final accessible label/name copy from current source context.",
    "Choose the label/name shape from local JSX evidence."
  ],
  "doNotDo": [
    "Do not apply patches automatically from this report.",
    "Do not infer custom-component semantics.",
    "Do not generate final label/name copy automatically."
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

1. Inspect `firstInspectStep` first.
2. Confirm the current source still matches the issue evidence.
3. Look for existing visible label, nearby native label/control structure, same-file `htmlFor`/`id` evidence, or source-observed naming hints.
4. Do **not** generate final label copy automatically.
5. If the target is a custom component or the source no longer matches, stop and read the file normally.

## Dry-run and safe-preview split (`--dry-run-json`)

Migration planners can request candidate rows, but the projection is still dry-run-only.

```bash
fooks inspect react-web-issues test/fixtures/react-web-label-preview/label-association-candidates.tsx --dry-run-json
```

Representative candidate:

```json
{
  "issueId": "react-web-label-1",
  "migrationCandidate": "safe-preview-htmlFor-association",
  "affectedFile": "test/fixtures/react-web-label-preview/label-association-candidates.tsx",
  "firstInspectStep": "Inspect test/fixtures/react-web-label-preview/label-association-candidates.tsx:7-7 (input) before editing.",
  "previewAvailable": true,
  "humanReviewRequired": true,
  "autoApply": false,
  "dryRunOnly": true
}
```

If a source file produces `previewAvailable: true`, treat the preview as a read-only review aid, not permission to edit. `autoApply` remains false unless a separate human/tool workflow explicitly decides to make a source change after reading the current file.

## Boundary note

This demo proves the first-minute React Web issue-card loop, not a broader product claim.

- Read-only: `inspect react-web-issues` reports findings and handoff data; it does not edit files.
- No auto-apply: safe previews are review aids, not patch authority.
- No generated accessible-name copy: final label/name text stays human-reviewed.
- No broad accessibility audit: this is a narrow native JSX label/control subset, not a complete WCAG or design-system audit.
- No custom-component semantic inference: ambiguous/custom cases fall back to manual review or normal source reading.
- No duplicate-id/conflicting-label emitted-card claim: current duplicate-id or conflicting-label-looking evidence is treated as unsafe/boundary evidence unless source/tests prove a standalone emitted issue card.
- No RN/WebView/TUI expansion: those lanes remain boundary/roadmap topics, not supported by this React Web demo.
- No billing proof: benchmark/cost evidence elsewhere in the docs is estimate-scoped and does not prove provider invoices, provider billing tokens, or stable runtime-token savings.
