# React Web context retention

React Web is the current flagship frontend lane for compact repeated-read context. The goal is not just to shorten an input file. The goal is to keep source-observed facts that help a model re-enter the same React Web component file without repeatedly reading the full source when the compact context budget permits.

This document is a durable project guide for the React Web context axes. It is intentionally claim-bounded: the context is derived from source facts in the current file and is not a browser, typechecker, accessibility, dependency, or design-system oracle.

## Retention matrix

The supported React Web context axes are expected to have both pre-read payload retention coverage and runtime repeated-read retention coverage.

| Axis | Field | Purpose | Main tests |
| --- | --- | --- | --- |
| Edit target routing | `editTargetRouting` | Compactly points to likely same-file edit anchors such as primary component, handlers, forms, controls, conditional regions, and style regions. | `test/pre-read-payload-builder.test.mjs`, `test/runtime-bridge-contract.test.mjs` |
| State/dataflow | `formStateFlow` | Keeps source-observed form/control/state relationships that matter during repeated edits. | `test/pre-read-payload-builder.test.mjs`, `test/runtime-bridge-contract.test.mjs` |
| Accessibility/semantics | `a11yAnchors` | Keeps source-observed `htmlFor`, `aria-*`, role, id-reference, invalid-state, and alert-region anchors. | `test/pre-read-payload-builder.test.mjs`, `test/runtime-bridge-contract.test.mjs` |
| Layout regions | `layoutRegionHints` | Keeps source-observed semantic/list/form/repeated/state/container region hints. | `test/pre-read-payload-builder.test.mjs`, `test/runtime-bridge-contract.test.mjs` |
| Component API | `componentApiHints` | Keeps same-file component API and local custom-component usage facts. | `test/pre-read-payload-builder.test.mjs`, `test/runtime-bridge-contract.test.mjs` |
| Styling variants | `stylingVariantHints` | Keeps source-observed props, `data-state`, conditional `className`, inline `style`, and variant-like prop anchors. | `test/pre-read-payload-builder.test.mjs`, `test/runtime-bridge-contract.test.mjs` |
| Import roles | `importRoleHints` | Keeps source-observed import role hints for recognized module patterns such as form, validation, routing, UI kit, icon, and local component imports. | `test/pre-read-payload-builder.test.mjs`, `test/runtime-bridge-contract.test.mjs` |

`test/react-web-context-metadata.test.mjs` remains the broader metadata behavior baseline. The pre-read and runtime bridge tests prove that the facts survive the compact context paths when the budget permits.

## Claim boundaries

These axes are source-backed context hints. They do not claim:

- browser rendering correctness;
- DOM validation;
- accessibility audit results;
- runtime behavior of imported libraries;
- design-system semantics;
- cross-file component usage;
- typechecker-derived meaning;
- billing, provider-token, or live model-cost savings.

When compact context budget pressure omits lower-priority fields, do not claim those omitted fields were retained for that payload. Retention claims must be tied to the payload path and budget evidence under test.

## Development rules for React Web context changes

When adding or changing a React Web context axis, keep the change source-only and same-file unless a separate PR explicitly scopes and proves a broader boundary.

Minimum expected proof for a new axis or a changed retention contract:

1. Metadata behavior coverage in `test/react-web-context-metadata.test.mjs` or an equivalent focused metadata test.
2. Pre-read retention coverage in `test/pre-read-payload-builder.test.mjs`.
3. Runtime repeated-read retention coverage in `test/runtime-bridge-contract.test.mjs`.
4. Claim-boundary wording that says what the axis does not prove.
5. Verification with `git diff --check`, `npm run build`, focused tests, and the appropriate regression suite.

Prefer improving payload quality and repeated-read usefulness over adding broad support wording. If a field is useful only as an internal source fact, keep the public claim narrow and name it as a hint or anchor rather than a semantic guarantee.
