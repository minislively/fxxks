# React Web issue context packet

`inspect react-web-issues` now attaches a `contextPacket` to each full issue card. The packet is intentionally report-only: it explains why the card exists and what nearby evidence is worth inspecting, without expanding into apply/codemod behavior.

## Fields

- `whyThisFile`: direct source location that produced the issue card.
- `relatedPattern`: the detected native React Web label/accessibility pattern and whether it is `safe-preview` or `manual-review`.
- `nearbyPrecedent`: strongest local inspect-first anchor from same-file, imports, nearby tests, or sibling source context.
- `confidence`: the label-preview confidence carried through to the issue card.
- `excludedInference`: explicit non-claims, including no custom-component semantics, no broad accessibility audit, and no auto-apply.

## Boundaries

Context packets are included in full JSON and text reports only. The compact `--summary-json` projection stays first-minute sized and omits detailed issue-card fields such as `contextPacket`, `relatedContext`, preview diffs, source snippets, and suggested actions.
