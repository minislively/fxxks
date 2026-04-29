# Frontend domain contract

Issue #198 locked the frontend-domain contract before detector or profile promotion. This document now records that contract plus the explicitly scoped `F1` React Native primitive/input pre-read payload gate. Outside that named gate, it does not add extractor behavior, detector behavior, setup eligibility, runtime behavior, CLI behavior, public support wording, manifest schema migration, or domain sharding.

## Contract status

- **Current broad supported lane remains React Web** for the measured same-file TSX/JSX scope already covered by existing docs and tests.
- **React Native now has one narrow primitive/input payload gate** (`rn-primitive-input-narrow-payload`) for the measured `F1` fixture family only; this is not broad React Native support.
- **WebView and TUI/Ink remain evidence lanes**, not product/runtime support claims.
- **WebView is fallback-first.** WebView boundary signals must keep normal source reading unless a later gate explicitly approves a narrower detector/profile promotion.
- **Mixed and Unknown classifications are safety states.** They prevent ambiguous syntax evidence from becoming semantic support.

## Domain taxonomy

| Domain | Classification rule | Current contract outcome | Claim boundary |
| --- | --- | --- | --- |
| React Web | DOM-oriented React/TSX evidence such as forms, DOM JSX elements, `className`, and browser event handlers, without stronger RN/WebView/TUI boundary signals. | Eligible for the existing measured React Web extraction path when current extractor and readiness rules allow it. | This remains the broad current frontend support lane. |
| React Native | `react-native` imports, RN primitives such as `View`, `Text`, `TextInput`, `Pressable`, `Touchable*`, `FlatList`, or platform/navigation/style signals. | Evidence lane by default; only the measured primitive/input subset may pass `rn-primitive-input-narrow-payload` when readiness and policy gates allow it. | Narrow primitive/input payload reuse is not a React Native support claim and must not be treated as DOM/form semantics. |
| WebView | `react-native-webview`, `<WebView>`, `source`, injected JavaScript, `onMessage`, or native/web bridge markers. | **Fallback-first** boundary lane. | No WebView support claim, no bridge-safety claim, and no compact-payload reuse claim. |
| TUI-Ink | Ink/React CLI TSX evidence such as Ink-like imports, `Box`, `Text`, `useInput`, terminal layout, or command-palette style components. | Evidence lane only; current fixture evidence may prove TSX parsing/extraction for measured local files. | TUI/Ink evidence is not broad TUI support and not terminal correctness support. |
| Mixed | Multiple domain signals in one file or fixture, especially combinations of React Web with RN/WebView/TUI or RN with WebView bridge markers. | Conservative boundary classification; fallback or defer according to the strongest safety signal. | Mixed evidence cannot be promoted by choosing the most convenient domain. |
| Unknown | TSX/JSX/TS/JS where domain signals are absent, weak, or unclassified. | Defer semantic profile claims; use existing generic behavior only when normal eligibility rules allow it. | Unknown is not implicit React Web, RN, WebView, or TUI support. |

## Outcome meanings

| Outcome | Meaning | What it does not mean |
| --- | --- | --- |
| `extract` | The current extractor may produce a compact/model-facing payload under the existing implementation and readiness rules for a measured fixture or supported lane. | It does not promote a new domain profile, detector, setup claim, runtime claim, or public support promise. |
| `fallback` | The file should use normal source reading/full-source behavior instead of compact payload reuse, usually because a safety boundary or unsupported-domain marker is present. | It is not a failed test and not a request to infer semantics from syntax alone. |
| `deferred` | The lane, fixture, or semantic profile is intentionally postponed until a future plan documents fixtures, pass/fail rules, fallback rules, and wording boundaries. | It does not block the current React Web path and does not authorize implementation by implication. |

## WebView fallback-first rule

WebView files are boundary files before they are extraction candidates. `react-native-webview`, `<WebView>`, `source`, injected JavaScript, `onMessage`, HTML strings, or native/web bridge markers require the fallback-first posture. Any future compact-payload reuse for WebView must first pass a separate security and boundary review and must name the exact measured scope.

## RN and TUI evidence-lane rule

React Native and TUI/Ink fixtures may be useful evidence for syntax traversal, fixture shape, and future domain-signal design. They are **not support claims**. RN primitive/input `F1` may use the measured `rn-primitive-input-narrow-payload` gate, but RN primitives must not be reinterpreted as DOM controls, React Web form semantics, or broad React Native support. TUI/Ink fixtures must not be generalized into arbitrary terminal UI support, terminal behavior correctness, or runtime-token savings.

## Fixture manifest pre-detector/profile gate

The fixture expectation manifest at `test/fixtures/frontend-domain-expectations/manifest.json` is the pre-detector/profile gate for this lane. Before any detector or profile promotion, a candidate change must keep the manifest and docs aligned on:

1. one domain lane per selected fixture;
2. one expected outcome per fixture: `extract`, `fallback`, or `deferred`/unsupported wording;
3. local or synthetic-local fixture sources only for the first pass;
4. explicit fallback reasons for RN/WebView boundary fixtures, plus explicit narrow-payload metadata for any measured RN payload candidate;
5. forbidden support claims for RN, WebView, and TUI/Ink evidence lanes;
6. deferred entries for fixture categories that are visible but not yet safe to promote.

This issue does not migrate the manifest schema. The current schema remains the contract surface for regression tests.

## Next detector/profile promotion gate

The next detector/profile PR may start only after this contract is green in docs and tests. Evidence lanes do not approve detector/profile implementation by themselves. That later PR must be explicitly scoped and must include, before source behavior changes:

- fixture-backed domain classification rules for React Web, React Native, WebView, TUI-Ink, Mixed, and Unknown;
- pass/fail expectations for each promoted fixture;
- fallback rules that keep WebView boundary cases fallback-first unless specifically approved;
- wording boundaries that avoid RN/WebView/TUI support claims beyond measured evidence;
- regression coverage proving the manifest remains a pre-detector/profile gate;
- a stated non-goal for package/lockfile changes, setup/CLI changes, runtime/pre-read broadening, manifest schema migration, and domain sharding unless a separate issue explicitly opens one of those lanes.

### Detector promotion readiness checklist

A promotion candidate must pass every gate below before it changes runtime detector, extractor, or pre-read behavior. A failed gate keeps the current fallback/deferred contract in place.

| Gate | Required proof before promotion | Blocks promotion when |
| --- | --- | --- |
| Domain coverage | Classification evidence and expected outcome are named for React Web, React Native, WebView, TUI-Ink, Mixed, and Unknown. | Any selected domain relies on syntax evidence without an explicit `extract`, `fallback`, or `deferred` expectation. |
| Fixture manifest alignment | `test/fixtures/frontend-domain-expectations/manifest.json`, fixture docs, and contract wording agree on lane, outcome, reason, and support-claim boundary. | The manifest schema must change without a separate migration plan, or docs/tests disagree on the current schema. |
| Fallback safety | WebView and mixed-boundary cases keep fallback-first behavior unless a later approved security/boundary plan narrows the scope. | A change implies WebView bridge safety, compact-payload reuse, or fallback removal without that later approval. |
| Runtime-change approval | The PR names the exact detector/profile behavior that will change and the regression proof for it. | Runtime detector, extractor, or pre-read behavior changes are introduced from evidence-lane docs alone. |
| Claim wording | Public/user-facing wording remains limited to measured evidence and current supported lane. | RN, WebView, or TUI evidence is described as support, terminal correctness, bridge safety, or broad compact extraction. |
| Source-reading reason boundary | `unsupported-react-native-webview-boundary` remains the current source-reading boundary reason until a later semantic model is approved. | The fallback reason is treated as a permanent RN/WebView/TUI semantic model or reused to claim domain support. |

### Domain readiness matrix

| Domain | Promotion-ready evidence required | Current stop condition |
| --- | --- | --- |
| React Web | Existing supported React Web fixtures stay green while any new detector rule proves no regression to current form/DOM extraction behavior. | React Web evidence is used to imply RN, WebView, TUI, Mixed, or Unknown support. |
| React Native | RN primitive/input payload policy, interaction/list fallback, style/platform/navigation fallback, and fallback-reason expectations are fixture-backed and documented as measured evidence only, not a final RN semantic model. | RN primitives are mapped to DOM controls, broad RN support is claimed, or `unsupported-react-native-webview-boundary` is treated as a final RN semantic model instead of the current boundary reason. |
| WebView | WebView source/HTML/bridge fixtures stay fallback-first with explicit bridge-boundary wording. | The change claims WebView bridge safety, enables compact-payload reuse, or weakens fallback-first behavior. |
| TUI-Ink | Ink syntax fixtures prove only local TSX traversal and measured fixture outcomes. | The change claims broad TUI support, terminal behavior correctness, runtime-token savings, or default TUI compact extraction. |
| Mixed | Mixed signals select the strongest safety boundary and document why fallback/deferred wins. | The change promotes Mixed by choosing the most convenient single domain. |
| Unknown | Weak or absent signals remain deferred or generic only under existing eligibility rules. | Unknown is treated as implicit React Web, RN, WebView, or TUI support. |


### Parallel domain ownership matrix

This matrix enables future multi-branch domain work, but it is not itself runtime behavior change, domain promotion, support claim expansion, or a shared-file free-for-all. Domain lanes may proceed in parallel only when they stay inside their primary owned surfaces. Changes to serialized shared surfaces require one named owner and a merge-order note for that PR wave.

#### Serialized shared surfaces

The files below are shared policy surfaces. A PR wave that changes any of them must name one shared-policy owner, include a merge-order note, and keep other domain branches from editing the same file until the owner branch lands or is abandoned.

- `src/core/domain-detector.ts`
- `src/adapters/pre-read.ts`
- `src/core/payload/readiness.ts`
- `src/adapters/*-runtime-hook.ts`
- `src/adapters/*-hook-preset.ts`
- `src/core/schema.ts`
- `test/fooks.test.mjs`
- `test/domain-detector.test.mjs`
- `test/claim-boundary-doc-audit.test.mjs`
- `test/fixtures/frontend-domain-expectations/manifest.json`
- `docs/frontend-domain-contract.md`
- `docs/frontend-domain-fixture-expectations.md`
- `docs/frontend-fixture-boundary-regression-map.md`

#### Domain-owned parallel surfaces

The paths below may be edited in parallel when the branch stays inside its domain and does not change serialized shared surfaces:

- React Web fixture-only work under `test/fixtures/frontend-domain-expectations/react-web/`
- React Native fixture-only work under `test/fixtures/frontend-domain-expectations/rn-*.tsx`
- WebView fixture-only work under `test/fixtures/frontend-domain-expectations/webview*/`
- TUI/Ink fixture-only work under `test/fixtures/frontend-domain-expectations/tui-*`
- Domain-specific docs that do not change shared support, detector, pre-read, or manifest policy

Parallel branches that need a serialized shared surface are no longer independent domain branches for that PR wave; they must serialize behind the named shared-policy owner.

#### Domain parallel safety layer

The parallel safety layer is an execution contract for future multi-agent or multi-worktree domain work. It is docs/tests-only by default and does not authorize runtime source changes. A safety-layer PR must include a changed-file guard: the final diff may contain only the selected frontend-domain contract doc(s), focused contract regression test(s), and OMX planning/state artifacts needed for workflow bookkeeping. If `src/core/domain-detector.ts`, `src/adapters/pre-read.ts`, `src/core/payload/readiness.ts`, runtime hooks, hook presets, schema files, or manifest policy must change, the work stops and reruns planning/review as a serialized shared-policy owner branch.

Readiness-layer non-goals are explicit: no runtime source change, no fixture corpus expansion, no domain implementation, no public support wording, no provider/runtime-token, cache, billing, or performance claim, and no team or worktree launch without a separate approved launch plan.

Safe lane types are limited to:

- read-only investigation;
- fixture-only lane;
- disjoint domain test lane;
- docs/claim-boundary lane, only when it avoids shared support-policy expansion or names the shared-policy owner;
- single runtime writer lane, explicitly serialized and never parallel with other shared-seam/runtime writers;
- verifier lane.

Unsafe lane types are not parallel-safe and must serialize:

- multiple branches editing detector, pre-read, readiness, runtime hooks, hook presets, schema, shared tests, or manifest policy in the same PR wave;
- domain branches changing shared support wording without a named shared-policy owner;
- WebView payload or bridge reuse while WebView is fallback-first;
- RN or TUI support wording based only on syntax traversal evidence;
- Mixed or Unknown promotion by choosing the most convenient domain;
- full domain writer parallelism against shared runtime/shared-seam files.

Execution handoff checklist for any future domain-parallel PR wave:

Every PR wave must carry a small **PR wave contract** before worktree, team, or multi-agent launch. The contract is operational bookkeeping only: it is docs/tests-only unless a separate serialized runtime plan names a single shared-seam owner. Required fields are:

1. **Base branch or base commit prerequisite** — records the exact `main` tip, merged prerequisite PR, or branch that every lane must start from.
2. **Lane name** — names the domain lane, for example `react-web`, `react-native`, `webview-boundary`, `tui-ink`, `mixed-unknown`, or `shared-policy`.
3. **Lane type** — chooses exactly one safe lane type from the list above; runtime writer lanes are single-writer and serialized, not a parallel default.
4. **Lane owner** — names the branch or agent responsible for the lane's owned files.
5. **Allowed files** — lists the lane-owned docs, fixtures, or tests that may change.
6. **Disallowed files** — repeats the serialized shared surfaces that this lane must not edit without stopping for shared-policy planning.
7. **Shared-seam lock status** — states either `none` or the exact serialized shared seam under lock.
8. **Named shared-policy owner** — required for any PR wave touching serialized shared surfaces.
9. **Merge-order note** — records which shared-policy branch must land first and which domain branches wait.
10. **Disjoint-file proof** — lists each lane's owned files and proves they do not overlap shared seams.
11. **Required verification command** — names the targeted command proving fallback/deferred/support boundaries did not weaken.
12. **Claim-boundary audit** — records the forbidden broad-support/domain-parallel wording check for the lane.
13. **Worktree/team launch status** — states whether this is only a planning contract or names the separate approved launch plan; absence of that plan means no domain implementation worktree is authorized.
14. **Contradiction check** — states that full domain writer parallelism against shared runtime/shared-seam files remains forbidden, docs/claim-boundary lanes cannot freely change shared support policy, and single runtime writer lanes serialize instead of running parallel.

Shared fallback reasons and denial markers are boundary evidence, not support claims. In particular, `unsupported-react-native-webview-boundary`, `unsupported-frontend-domain-profile`, `webview-boundary-fallback`, and domain-specific payload policy strings must not be reused as React Native, WebView, TUI/Ink, Mixed, or Unknown support wording.

Domain promotion must follow this ordered ladder and stop at the first failed gate:

1. evidence-only;
2. readiness gate;
3. denial/current marker;
4. narrow runtime gate;
5. narrow payload gate.

| Lane | Primary owned surfaces | Serialized shared surfaces | Merge-order rule | Verification minimum | Claim boundary |
| --- | --- | --- | --- | --- | --- |
| React Web | React Web fixtures, React Web readiness/payload tests, and React Web docs under the current supported lane. | `src/core/domain-detector.ts`, `src/adapters/pre-read.ts`, `test/fooks.test.mjs`, `test/fixtures/frontend-domain-expectations/manifest.json`. | Merge before non-web lanes only when it changes shared profile policy; otherwise keep independent React Web-only changes separate. | React Web pre-read/readiness targeted tests plus full frontend-domain contract tests. | Current supported lane only; do not imply RN, WebView, TUI, Mixed, or Unknown support. |
| React Native | RN fixture evidence, RN signal expectations, the F1 primitive/input narrow payload policy, and RN fallback-boundary docs. | `src/core/domain-detector.ts`, `src/adapters/pre-read.ts`, `test/fooks.test.mjs`, `test/fixtures/frontend-domain-expectations/manifest.json`. | Merge after any shared detector/profile policy owner; do not race WebView changes that reuse the same fallback reason. | RN detector/pre-read boundary tests plus manifest/docs parity tests. | Measured F1 narrow payload only; no broad RN extraction, DOM-control mapping, or support claim. |
| WebView | WebView boundary fixtures, paired bridge evidence, source/onMessage/injected-JS wording, and fallback-first docs. | `src/core/domain-detector.ts`, `src/adapters/pre-read.ts`, `test/fooks.test.mjs`, `test/fixtures/frontend-domain-expectations/manifest.json`. | Merge WebView boundary/security changes before any branch that would weaken fallback-first behavior. | WebView fallback-first tests, bridge-pair fixture tests, and forbidden support-claim checks. | Fallback-first boundary only; no bridge-safety, compact-payload reuse, or WebView support claim. |
| TUI/Ink | TUI/Ink fixture evidence, terminal-syntax wording, and evidence-only profile tests. | `src/core/domain-detector.ts`, `src/adapters/pre-read.ts`, `test/fooks.test.mjs`, `test/fixtures/frontend-domain-expectations/manifest.json`. | Merge after shared frontend profile gate changes so evidence-only fallback behavior remains explicit. | TUI evidence-only detector/pre-read tests plus no terminal-correctness wording checks. | Evidence-only; no broad TUI support, terminal correctness, runtime-token savings, or default compact extraction claim. |
| Mixed/Unknown/shared policy | Shared safety policy docs, mixed/unknown fallback/deferred tests, and ownership matrix maintenance. | `src/core/domain-detector.ts`, `src/adapters/pre-read.ts`, `test/fooks.test.mjs`, `test/fixtures/frontend-domain-expectations/manifest.json`. | This lane owns shared-file coordination; other lanes must serialize behind it when touching shared policy. | Mixed/Unknown classification tests, manifest alignment tests, and full `npm test` before merge. | Safety states only; no convenient-domain promotion from ambiguous or weak signals. |

Promotion stops at the first failed gate. Until that later gate passes, this contract is documentation and regression protection only.
