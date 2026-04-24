# Design review metadata compression feasibility

## Status

- Primary lane: `design/UI`
- Artifact type: internal feasibility memo
- Scope: research/planning only
- Runtime/product behavior: unchanged
- Public support claims: unchanged

This memo reframes the possible design-oriented fooks expansion as a metadata
compression question, not as a Figma integration or code-generation question.

## Question

Can fooks support repeated design review on code components by reusing compact
metadata instead of replaying full source and repeated review context every time?

The first useful answer is not "yes, Figma-to-code works." It is:

> What metadata would make a design-review loop compressible, and how much of
> that model already exists in the current fooks payload contract?

## Current evidence

### Current product boundary

The strongest current workflow is Codex repeated same-file React `.tsx` / `.jsx`
work. The `.ts` / `.js` path is a narrower experimental Codex-first same-file
module beta. Public docs still defer Vue/SFC, broader TS/JS coverage, multi-file
refactors, read interception, LSP rename/reference semantics, and Claude/opencode
parity.

Evidence:

- `README.md` frames the strongest path, narrow beta path, and deferred asks.
- `docs/roadmap.md` maps future support lanes and evidence lanes.

### Existing compression model

fooks already does more than raw-source caching. For supported files, the
model-facing payload is a structured metadata contract built from extraction
results.

Current payload evidence:

- `src/core/schema.ts` defines structured sections such as:
  - `contract`
  - `behavior`
  - `structure`
  - `style`
  - `sourceFingerprint`
  - optional `editGuidance`
- `src/core/payload/model-facing.ts` prunes those sections into a compact
  model-facing payload and adds edit guidance only when source ranges and
  freshness data support it.
- `src/core/extract.ts` already detects style-system signals including
  Tailwind-like utility classes, styled-components, CSS modules, and inline
  style props.
- `test/fooks.test.mjs` asserts that compressed and hybrid payloads preserve
  contract, behavior, structure, style, source ranges, and edit-guidance anchors.

This means a design-review seam should not start as a separate design-tool
pipeline. It should first ask how design-review metadata fits the existing
payload pattern.

## Existing metadata layers

| Current payload area | What it compresses today | Design-review relevance |
| --- | --- | --- |
| `contract` | props names, props summaries, forwardRef, props ranges | Variant and component API hints often surface through props. |
| `behavior` | hooks, state summaries, effects, callbacks, event handlers, form controls | Interactive states and review-sensitive behavior often live here. |
| `structure` | JSX sections, conditional renders, repeated blocks, JSX depth, module declarations | Layout regions, repeated lists, and conditional UI states need structure anchors. |
| `style` | style system, style summaries, style branching | Existing home for Tailwind/styled-components/CSS module signals. |
| `sourceFingerprint` | file hash and line count freshness | Prevents stale compact context from being treated as current source truth. |
| `editGuidance` | bounded AST-derived patch targets and safety instructions | Proves fooks already separates line-aware hints from LSP-backed semantics. |

## Four-layer metadata model

A design-review compression seam should keep four layers separate.

### 1. AST / structural metadata

Observed precedent:

- component declaration and source ranges
- props type/source ranges
- JSX sections
- conditional render summaries
- repeated render blocks
- JSX depth
- representative snippets

Design-review candidates:

- layout region anchors such as `header`, `card`, `list`, `form`, `footer`
- conditional visual states such as empty/loading/error/success branches
- repeated visual groups such as mapped cards, rows, chips, or menu items
- source ranges for style-bearing JSX nodes or styled-component declarations

Why this matters:

Design feedback usually refers to visual regions, not arbitrary AST nodes. The
AST layer needs to expose stable region anchors without claiming screenshot or
Figma awareness.

### 2. Semantic metadata

Observed precedent:

- component name
- props summaries
- state/effect summaries
- event handler names
- form controls and validation anchors
- style-system summary

Design-review candidates:

- component role, for example `button`, `card`, `form section`, `dialog`, or
  `navigation item`
- variant axes inferred from props or branches, for example `size`, `tone`,
  `variant`, `disabled`, `selected`, or `loading`
- state axes inferred from conditionals or state names, for example empty,
  error, pending, active, expanded, collapsed
- layout intent hints inferred from utility classes or CSS names, for example
  centered, stacked, grid, inline, responsive, dense, spacious
- token-like references already present in code, for example CSS variables,
  named theme keys, or recognizable utility groups

Why this matters:

A model does not need the whole file if the review request is about a known
semantic surface such as "the error state card spacing" or "the selected tab
variant." The semantic layer is the bridge between source structure and review
language.

### 3. Task / history metadata

Observed precedent:

- current runtime reuse is session-scoped and repeated-file aware
- status/metrics are local and bounded by explicit claim boundaries
- edit guidance is opt-in and freshness-gated

Design-review candidates:

- repeated review vocabulary for the same component, for example spacing,
  alignment, hover, contrast, density, hierarchy, icon/text alignment
- previously touched visual zones in the same session
- reviewer intent categories, for example polish, accessibility concern,
  design-token alignment, variant consistency, visual regression concern
- do-not-regress notes recorded as compact constraints, for example "keep the
  disabled state visually distinct" or "preserve the compact card density"

Why this matters:

Design work is often iterative. The repeated unit may not be only a source file;
it may be a source file plus a recurring review vocabulary and a small set of
visual constraints. This layer is also the highest-risk layer because it can
turn stale human feedback into false authority if freshness and scope are not
clear.

### 4. Compression-contract metadata

Observed precedent:

- `sourceFingerprint` gates freshness.
- `editGuidance` explicitly says patch targets are AST-derived edit aids, not
  LSP-backed semantic rename/reference locations.
- Public docs distinguish local model-facing estimates from provider billing or
  runtime-token proof.

Design-review candidates:

- freshness fields for the source file and, later, any review-context artifact
- explicit scope such as `same-file`, `same-component`, or `same-session`
- confidence level for inferred semantic design metadata
- blocked/deferred reason tokens for unsupported cases
- instructions that design-review metadata is a compact aid, not screenshot,
  Figma, accessibility audit, or visual-regression proof

Why this matters:

The compression contract is what keeps compact metadata useful without letting
it overclaim. A design-review seam needs this layer before any implementation
can be safely exposed.

## Candidate design-review metadata fields

These are hypotheses, not implemented fields.

```ts
type DesignReviewMetadataV0 = {
  sourceFingerprint: SourceFingerprint;
  scope: "same-file" | "same-component";
  confidence: "high" | "medium" | "low";
  componentRole?: string;
  visualRegions?: Array<{
    label: string;
    loc?: SourceRange;
    evidence: string[];
  }>;
  variantAxes?: Array<{
    name: string;
    values?: string[];
    evidence: string[];
  }>;
  stateAxes?: Array<{
    name: string;
    evidence: string[];
  }>;
  layoutAnchors?: Array<{
    label: string;
    loc?: SourceRange;
    evidence: string[];
  }>;
  styleReferences?: Array<{
    kind: "tailwind-group" | "css-variable" | "theme-key" | "styled-component" | "css-module";
    value: string;
    loc?: SourceRange;
  }>;
  reviewVocabulary?: string[];
  doNotInfer: string[];
};
```

The useful part is not the exact shape. The useful part is the separation:
source-derived anchors, inferred semantic labels, session/review vocabulary, and
explicit non-inference rules should not collapse into one blob.

## How this maps to existing work types

| Work type | Existing compact context need | Design-review analogue |
| --- | --- | --- |
| Feature | props, state, handlers, conditional branches | variant/state surfaces and interaction-sensitive visual zones |
| Test | protected behavior, acceptance anchors, edge cases | do-not-regress visual constraints and review acceptance notes |
| Refactor | stable contracts, repeated structures, source ranges | preserve visual hierarchy and style semantics while moving code |
| Design/UI | layout/style regions, states, variants, token/style references | repeated design-review metadata and compact review vocabulary |

The pattern is the same: identify the minimal structured context the model needs
for a repeated task, freshness-gate it, and state what the metadata cannot prove.

## Evidence vs inference

### Evidence

- fooks already emits structured model-facing payload sections for supported
  frontend files.
- fooks already detects style-system signals in source.
- fooks already uses source fingerprints and AST-derived ranges as safety aids.
- fooks public docs already reject LSP-backed, multi-file, provider-parity, and
  universal read-interception claims.

### Inference

- Design-review repetition likely benefits from metadata beyond today's `style`
  summary because review language often refers to variants, states, regions,
  alignment, density, and token intent.
- The first implementation-worthy design seam is probably not Figma ingestion.
  It is a same-file/same-component metadata contract that can be fixture-tested
  against code components.
- Task/history metadata may become valuable, but only if it is scoped and
  freshness-gated so stale review notes cannot silently override source truth.

## Non-goals

This memo does not approve or implement:

- Figma API integration
- Figma file/frame/export ingestion
- Figma-to-code generation
- screenshot or visual-regression evaluation
- accessibility audit claims
- runtime implementation of `DesignReviewMetadataV0`
- public README/release/setup claim widening
- Vue/SFC support
- broader TS/JS support beyond the current beta
- multi-file refactor semantics
- read interception
- Claude/opencode parity
- LSP rename/reference semantics
- provider-token, provider-cost, invoice, or billing-grade claims

## Feasibility read

The seam is feasible as a research-to-implementation path if it stays narrow:

1. same-file / same-component only;
2. source-derived anchors first;
3. semantic labels as low-to-medium confidence unless directly evidenced;
4. task/history notes only with explicit session scope;
5. clear non-goals and fallback reasons.

The seam is not ready for public capability claims. It needs a schema and fixture
pass before any runtime behavior changes.

## Recommended next step

Recommended next lane: **metadata schema v0 + fixture plan**.

Why this is the best next step:

- A schema v0 forces the field boundaries to become concrete before extraction
  code changes.
- Fixtures can prove whether real React components contain enough source evidence
  for variants, states, style references, and layout anchors.
- It keeps Figma, screenshots, LSP, and multi-file support deferred while still
  moving the design direction forward.

Proposed next artifact:

```text
docs/internal/design-review-metadata-schema-v0.md
```

That artifact should define:

1. exact candidate field names;
2. which fields are source-derived versus inferred;
3. required freshness/scope fields;
4. fallback reasons when metadata is too weak;
5. 3-5 fixture examples that would exercise the schema;
6. explicit proof that public support claims remain unchanged.

Only after that should a later implementation plan consider extractor changes or
new tests.
