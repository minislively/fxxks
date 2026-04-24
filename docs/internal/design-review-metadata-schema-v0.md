# Design review metadata schema v0 and fixture plan

## Status

- Primary lane: `design/UI`
- Artifact type: internal schema/fixture plan
- Source memo: `docs/internal/design-review-metadata-compression-feasibility.md`
- Scope: planning/spec only
- Runtime/product behavior: unchanged
- Public support claims: unchanged

This document turns the feasibility memo into a concrete v0 metadata seam. It
is intentionally not an implementation plan for Figma, screenshots,
accessibility audits, or code generation. The goal is to define the smallest
source-derived design-review metadata shape that can later be tested against
fixtures before any runtime payload changes are considered.

## Contract closeout

### In

- Define a v0 schema candidate for design-review metadata.
- Define freshness and confidence rules for that schema.
- Map each field to existing fooks evidence or an explicit future extractor
  requirement.
- Define fixture categories and acceptance checks that would prove the schema is
  useful without widening public claims.

### Support

- Reference existing payload fields in `src/core/schema.ts`.
- Reference existing extractor behavior in `src/core/extract.ts`.
- Reference existing fixture/test patterns in `fixtures/` and
  `test/fooks.test.mjs`.

### Defer

- Runtime payload implementation.
- Public documentation updates.
- Figma API, Figma file/frame ingestion, or Figma-to-code flows.
- Screenshot, visual regression, browser rendering, Storybook runtime, or
  accessibility-audit proof.
- Vue/SFC, multi-file refactors, read interception, provider parity, LSP
  rename/reference semantics, and provider-tokenizer/billing claims.

### Blocked until later

- Any model-facing runtime inclusion of design-review metadata is blocked until
  schema fixtures exist and can be tested without weakening freshness and
  non-inference boundaries.

## Existing payload anchors

Design-review metadata v0 should be an additive sidecar candidate, not a
replacement for current payload sections.

| Existing anchor | Current source | v0 reuse |
| --- | --- | --- |
| `sourceFingerprint` | `ModelFacingPayload.sourceFingerprint` | Required freshness gate for all design metadata. |
| `componentName` / `componentLoc` | `ExtractionResult.componentName`, `componentLoc` | Primary component identity and same-component scope. |
| `contract.propsSummary` / `propsLoc` | `ExtractionResult.contract` | Variant and prop-axis evidence. |
| `behavior.stateSummary` | `ExtractionResult.behavior` | State-axis evidence. |
| `behavior.eventHandlerSignals` | `ExtractionResult.behavior` | Interaction-sensitive review anchors. |
| `behavior.formSurface` | `ExtractionResult.behavior` | Form-control visual/review anchors. |
| `structure.sections` | `ExtractionResult.structure` | Region candidates from JSX tags/components. |
| `structure.conditionalRenders` | `ExtractionResult.structure` | Loading/error/empty/state branch evidence. |
| `structure.repeatedBlocks` | `ExtractionResult.structure` | Repeated visual group evidence. |
| `style.system` / `style.summary` | `ExtractionResult.style` | Style-system and token/reference evidence. |
| `snippets.loc` | `ExtractionResult.snippets` | Optional bounded evidence snippets, not source replacement. |
| `editGuidance` | optional model-facing payload | Precedent for freshness-gated, AST-derived aids. |

## Schema v0 candidate

This shape is a planning contract. Field names are intentionally concrete enough
to test, but not yet exported from `src/core/schema.ts`.

```ts
type DesignReviewMetadataV0 = {
  schemaVersion: "design-review-metadata.v0";
  freshness: SourceFingerprint;
  scope: {
    kind: "same-file" | "same-component";
    filePath: string;
    componentName?: string;
    componentLoc?: SourceRange;
  };
  confidence: "high" | "medium" | "low";
  confidenceReasons: string[];
  visualRegions: VisualRegionV0[];
  variantAxes: VariantAxisV0[];
  stateAxes: StateAxisV0[];
  interactionAnchors: InteractionAnchorV0[];
  styleReferences: StyleReferenceV0[];
  compressionContract: DesignCompressionContractV0;
};

type EvidenceRefV0 = {
  source: "contract" | "behavior" | "structure" | "style" | "snippet";
  field: string;
  value?: string;
  loc?: SourceRange;
};

type VisualRegionV0 = {
  label: string;
  kind: "layout" | "form" | "list" | "content" | "control" | "unknown";
  loc?: SourceRange;
  evidence: EvidenceRefV0[];
};

type VariantAxisV0 = {
  name: string;
  values?: string[];
  loc?: SourceRange;
  evidence: EvidenceRefV0[];
};

type StateAxisV0 = {
  name: string;
  kind: "boolean" | "async" | "empty" | "error" | "selection" | "unknown";
  loc?: SourceRange;
  evidence: EvidenceRefV0[];
};

type InteractionAnchorV0 = {
  label: string;
  kind: "event-handler" | "form-control" | "submit-handler" | "validation-anchor";
  loc?: SourceRange;
  evidence: EvidenceRefV0[];
};

type StyleReferenceV0 = {
  kind: "tailwind-group" | "css-module" | "styled-component" | "inline-style" | "css-variable" | "theme-key" | "unknown";
  label: string;
  loc?: SourceRange;
  evidence: EvidenceRefV0[];
};

type DesignCompressionContractV0 = {
  sourceDerivedOnly: true;
  notVisualProof: true;
  notFigmaBacked: true;
  notAccessibilityAudit: true;
  notLspBacked: true;
  notProviderTokenized: true;
  maxItems: {
    visualRegions: number;
    variantAxes: number;
    stateAxes: number;
    interactionAnchors: number;
    styleReferences: number;
  };
  staleWhen: ["sourceFingerprint.fileHash changes", "sourceFingerprint.lineCount changes"];
  requiredUserActionOnStale: "rerun extraction or read current source before editing";
};
```

## Field rules

### `schemaVersion`

- Must be exactly `design-review-metadata.v0` for the first fixture lane.
- Any incompatible field rename should become `v1`, not silent drift.

### `freshness`

- Must equal the current model-facing `sourceFingerprint`.
- If `sourceFingerprint` is unavailable, the design metadata is unavailable.
- Stale metadata must be treated as a compact hint that cannot be used for
  editing without rereading or re-extracting the source.

### `scope`

- `same-file` is the default.
- `same-component` is allowed only when `componentName` and `componentLoc` are
  available.
- Cross-file component systems are out of scope for v0.

### `confidence`

`high` requires all of:

- component identity is present;
- freshness is present;
- at least two distinct evidence sources exist among `contract`, `behavior`,
  `structure`, and `style`;
- every emitted item has at least one evidence reference.

`medium` is allowed when freshness is present but the evidence is mostly
structural/style-only.

`low` is required when the extractor can only identify generic regions or an
unknown style system. Low-confidence metadata can be useful for review language
but must not drive precise edit claims.

### `visualRegions`

- Derived from `structure.sections`, JSX source ranges, form controls, repeated
  blocks, and bounded snippets.
- Labels should be stable and conservative: `section`, `form`, `list`, `card`,
  `button`, `input`, `header`, `footer`, or component tag names already present
  in source.
- Do not invent visual hierarchy from screenshots or Figma frames.

### `variantAxes`

- Derived from props names, literal union values when visible, and conditional
  branch names.
- Good names: `variant`, `tone`, `size`, `disabled`, `selected`, `loading`.
- Do not infer a design-system token scale unless the source exposes it.

### `stateAxes`

- Derived from state names, conditionals, effects, and branch snippets.
- Good kinds: `async`, `empty`, `error`, `selection`, `boolean`.
- Do not claim runtime state coverage; this is static source metadata.

### `interactionAnchors`

- Derived from event handlers, form controls, submit handlers, and validation
  anchors already represented in `behavior`.
- These anchors help review interaction-sensitive visuals such as disabled,
  focused, invalid, submitting, or selected states.
- They are not browser-event proof.

### `styleReferences`

- Derived from `style.system`, `style.summary`, class/style attributes, imports,
  styled-component declarations, CSS module imports, CSS variables, and theme-key
  references if visible in source.
- Tailwind groups should be grouped semantically only when the source text makes
  the grouping obvious, for example spacing/layout/color utilities.
- Do not normalize or reorder classes in v0.

### `compressionContract`

- Must be emitted with the metadata in later implementation lanes.
- Must keep all `not*` boundaries true for v0.
- Must bound item counts so the metadata itself does not become a new source
  dump.

Recommended v0 caps:

| Field | Cap |
| --- | ---: |
| `visualRegions` | 12 |
| `variantAxes` | 8 |
| `stateAxes` | 8 |
| `interactionAnchors` | 12 |
| `styleReferences` | 16 |

## Fixture plan

The first implementation lane should add fixtures before enabling runtime
payload behavior. Existing fixtures can seed expected values, but v0 needs
design-specific cases.

### Fixture A: Tailwind variant card

Suggested path:

- `fixtures/design-review/TailwindVariantCard.tsx`

Purpose:

- Proves `visualRegions`, `variantAxes`, and `styleReferences` can be extracted
  from a same-file React component with utility classes.

Fixture shape:

- props: `variant`, `size`, `selected`, `disabled`
- sections: header/body/footer or card/list regions
- className strings with spacing, rounded, text, background, layout utilities
- one conditional className branch

Expected metadata:

- `confidence: high`
- `variantAxes` includes `variant`, `size`, `selected`, `disabled`
- `styleReferences` includes Tailwind layout/spacing/color groups
- `compressionContract.notVisualProof === true`

### Fixture B: Form state review surface

Suggested path:

- `fixtures/design-review/FormStateReview.tsx`

Purpose:

- Proves interaction and validation anchors can feed design-review metadata
  without claiming browser behavior.

Fixture shape:

- `form`, `input`, `select`, `textarea`, and submit button
- invalid/error branch
- loading/submitting state
- event handlers and validation anchors already compatible with current behavior
  extraction patterns

Expected metadata:

- `interactionAnchors` includes form controls and submit handler
- `stateAxes` includes `error` and `async`/`loading`
- `visualRegions` includes form/control regions
- no accessibility-audit claim

### Fixture C: Styled-components layout panel

Suggested path:

- `fixtures/design-review/StyledPanel.tsx`

Purpose:

- Proves v0 is not Tailwind-only while staying inside React `.tsx` same-file
  source analysis.

Fixture shape:

- `styled.section`, `styled.header`, or `styled.div` declarations
- prop-driven style branch such as `$compact` or `$tone`
- simple content/controls region

Expected metadata:

- `styleReferences` includes `styled-component`
- `variantAxes` includes prop-driven style axis
- `visualRegions` includes panel/header/body or equivalent source-derived labels

### Fixture D: Low-confidence generic component

Suggested path:

- `fixtures/design-review/GenericLayout.tsx`

Purpose:

- Proves conservative fallback behavior when source has weak semantic signals.

Fixture shape:

- generic JSX with minimal props and unknown style system
- no clear variants, states, or event anchors

Expected metadata:

- `confidence: low` or `medium`, depending on structural evidence
- empty or short `variantAxes` / `stateAxes`
- all emitted fields still have evidence refs

## Test plan for later implementation

When implementation begins, tests should be added before runtime activation.

### Unit-level schema tests

- Add a pure helper that builds design metadata from an existing
  `ExtractionResult`.
- Assert schema version and compression contract constants.
- Assert freshness equals `sourceFingerprint`.
- Assert item caps are enforced.
- Assert every emitted item has at least one evidence ref.

### Fixture expectation tests

- Run extraction on each `fixtures/design-review/*.tsx` fixture.
- Convert to design-review metadata with runtime inclusion disabled.
- Assert fixture-specific expected regions, axes, anchors, and style refs.
- Assert non-goal booleans remain true.

### Regression tests

- Verify default `fooks extract --model-payload` output remains unchanged until
  a separate runtime gate is explicitly implemented.
- Verify `.ts` / `.js` module beta does not start emitting design-review metadata
  by accident.
- Verify raw fallback payloads do not emit design-review metadata.
- Verify stale `sourceFingerprint` handling mirrors edit-guidance freshness
  language.

## Acceptance criteria for this schema lane

This document is complete when it:

- Defines an explicit v0 shape with freshness, confidence, evidence, and
  compression-contract fields.
- Maps every major field to current fooks anchors or an explicit future
  extractor requirement.
- Defines at least four fixture categories with expected metadata outcomes.
- Keeps all public support and runtime claims unchanged.
- Leaves implementation blocked behind schema fixture tests.

## Recommended next implementation slice

If this plan is accepted, the next code PR should be small and local:

1. Add `fixtures/design-review/*.tsx` for the four fixture categories.
2. Add a non-exported or internal helper that derives
   `DesignReviewMetadataV0` from `ExtractionResult`.
3. Add tests proving the helper output and proving default model-facing payloads
   remain unchanged.
4. Do not add runtime hook inclusion, public docs, Figma ingestion, browser
   rendering, or provider-token claims in that PR.
