# Frontend-family behavior-neutral PRD

Issue #796 locks the frontend-family roadmap as a docs-only product requirements baseline; issue #805 narrows that baseline into an explicit promotion-ladder and claim-boundary lock. It exists to prevent roadmap drift from turning syntax evidence, candidate lanes, or fallback boundaries into unsupported runtime/provider claims.

This PRD does not change runtime behavior, provider behavior, setup eligibility, detector behavior, extractor output, payload schema, cache behavior, billing/cost claims, or public support scope. It is a shared wording and sequencing contract for later issues.

## Decision summary

| Lane | Product status for this PRD | Allowed wording | Stop condition |
| --- | --- | --- | --- |
| React Web | Current product lane for measured same-file `.tsx` / `.jsx` work, plus the documented Codex-first `.ts` / `.js` beta when normal gates allow it. | “Current React Web product lane” and “measured same-file React Web evidence.” | Stop if wording implies provider-token, billing-grade, runtime-token, multi-file, or cross-runtime parity proof. |
| React Native | Fallback-boundary by default, with the existing measured same-file primitive/input narrow exception only. The current measured `F1`/`F13`/`F14`/`F15` primitive/input family under `rn-primitive-input-narrow-payload` names source-only evidence, not broad mobile support. | “RN fallback-boundary default” and “existing measured same-file primitive/input narrow exception.” | Stop if wording claims mobile UI correctness, device/simulator execution, native component behavior, accessibility correctness, navigation success, list performance, or DOM/form equivalence. |
| WebView | Boundary and safety fallback-first lane. WebView signals require normal source reading unless a later security/boundary gate explicitly narrows that rule. | “WebView boundary/fallback-first lane.” | Stop if wording claims WebView support, bridge safety, sandbox/security correctness, or default compact payload reuse. |
| TUI / React CLI | Evidence-only lane. Ink/React CLI TSX may be useful syntax/payload evidence for future profiles, but runtime payload remains denied unless a later policy gate says otherwise. | “TUI/Ink evidence-only lane” and “runtime payload denied unless a later policy gate says otherwise.” | Stop if wording claims broad TUI support, terminal correctness, terminal UX safety, or default compact extraction. |
| Mixed | Resolver safety sink for conflicting frontend-family evidence. | “Mixed evidence requires fallback.” | Stop if wording treats conflicting evidence as compact-payload permission or promotion. |
| Unknown | Deferred resolver safety sink for absent or weak evidence. | “Unknown/deferred; read source normally.” | Stop if wording infers support, compact reuse, or product status from missing evidence. |

## Current-state vs target-state

This PRD separates the current implementation from the desired architecture seam:

- **Current state:** domain detection parses source independently in `src/core/domain-detector.ts`, and extraction parses source separately in `src/core/extract.ts`. Runtime pre-read then coordinates detection, policy, extraction, readiness, and fallback behavior through `src/adapters/pre-read.ts` and `src/adapters/pre-read-stack.ts`.
- **Target state:** a later no-behavior refactor may converge this into shared source facts feeding `domain profile resolver -> payload policy planner -> model-facing/domain payload builder -> runtime adapter -> evidence/report/claim boundary`. This target seam is not authorized by this PRD.
- **Boundary:** do not describe the target shared-source-facts seam as already implemented, and do not use it to justify parser rewrites, payload widening, or support wording.

## Exact resolver state matrix

| Classification/lane | Resolver outcome | Claim status / boundary | Payload behavior to preserve |
| --- | --- | --- | --- |
| `react-web` | `extract` | `current-supported-lane` / measured React Web boundary | Current React Web payload policy may allow model-facing payload when normal gates pass. |
| `react-native` | `fallback` at detector/profile level | `fallback-boundary`; existing narrow exception metadata only | Fallback by default; the existing measured same-file primitive/input narrow pre-read payload may be allowed only when its gate passes. |
| `webview` | `fallback` | `fallback-boundary` | Payload denied; normal source reading/fallback required. |
| `tui-ink` | `extract` | `evidence-only` / `domain-evidence-only` | Extraction evidence may exist; runtime payload remains denied unless a later policy gate says otherwise. |
| `mixed` | `fallback` | `fallback-boundary` | Payload denied/fallback; conflicting evidence is a safety sink. |
| `unknown` | `deferred` | `unknown-deferred` | Payload denied/fallback; weak or absent evidence is not inferred support. |

## Existing file map

The current repository already has the pieces needed for a behavior-neutral roadmap. Later implementation slices should cite these files instead of inventing new support language.

| Surface | Current files | PRD reading |
| --- | --- | --- |
| Public product boundary | `README.md`, `docs/release.md`, `docs/roadmap.md`, `docs/benchmark-evidence.md` | React Web is the current product lane; future frontend-family lanes stay roadmap/evidence unless a measured gate says otherwise. |
| Domain taxonomy and promotion contract | `docs/frontend-domain-contract.md`, `docs/frontend-domain-profiles.md`, `docs/frontend-scope-taxonomy.md`, `docs/frontend-domain-fixture-expectations.md` | Domain classification is evidence, not permission. Promotion stops at the first failed fixture, fallback, or wording gate. |
| Payload policy boundary | `docs/domain-payload-architecture.md`, `test/domain-payload-policy-coverage.test.mjs`, `test/payload-policy-*.test.mjs`, `test/payload-policy-registry*.test.mjs` | Payload policy is the permission layer. Scanner/profile facts must not bypass compact/narrow/fallback/deferred policy decisions. |
| Runtime and setup boundary | `docs/architecture-boundaries.md`, `docs/setup.md`, `docs/rn-webview-architecture.md`, `src/adapters/*runtime*`, `src/adapters/pre-read.ts` | Runtime adapters and pre-read fallback behavior are not changed by this PRD. WebView and broad RN/WebView boundaries remain fallback-first unless a later issue changes source behavior explicitly. |
| Evidence and claim proof | `docs/benchmark-evidence.md`, `docs/provider-tokenizer-boundary.md`, `docs/react-native-source-only-guidance-report.md`, `scripts/react-*-evidence.mjs`, `test/claim-boundary-doc-audit.test.mjs` | Evidence wording must name its scope: local source/payload, estimate-scoped cost, measured fixture lane, or source-only RN evidence. |
| Fixture and regression guardrails | `test/fixtures/frontend-domain-expectations/manifest.json`, `docs/frontend-fixture-boundary-regression-map.md`, `docs/rn-webview-fixture-candidates.md`, `docs/tui-fixture-candidates.md` | Fixtures can unlock future issue slices only when expected outcome, fallback reason, and claim boundary are recorded first. |
| Domain detection implementation | `src/core/domain-detector.ts` | Detects source-derived evidence and classification only; it does not authorize compact payloads. |
| Domain profile resolver | `src/core/domain-profiles/registry.ts`, `src/core/domain-profiles/react-web.ts`, `src/core/domain-profiles/react-native.ts`, `src/core/domain-profiles/webview.ts`, `src/core/domain-profiles/tui-ink.ts` | Profiles describe maturity and boundaries; they do not assemble model-facing payloads. |
| Payload policy implementation | `src/core/payload-policy/registry.ts`, `src/core/payload-policy/react-web.ts`, `src/core/payload-policy/react-native.ts`, `src/core/payload-policy/webview.ts`, `src/core/payload-policy/tui-ink.ts`, `src/core/payload-policy/fallback.ts` | Payload policy is the authorization layer for compact/narrow/fallback/deferred model context. |
| Payload assembly implementation | `src/core/payload/domain-payload.ts`, `src/core/payload/model-facing.ts` | Payload assembly consumes extraction and policy decisions; it must not invent lane support. |
| Runtime adapter implementation | `src/adapters/pre-read.ts`, `src/adapters/pre-read-stack.ts`, `src/adapters/codex-runtime-hook.ts` | Runtime surfaces consume policy outcomes; they must not bypass profile or payload gates. |

## Behavior-neutral requirements

1. Keep React Web as the only broad frontend product lane in public wording.
2. Keep the current RN primitive/input narrow policy family (`F1`/`F13`/`F14`/`F15`) measured and source-only; do not widen it by implication.
3. Keep WebView fallback-first and boundary/safety-oriented; do not describe bridge or sandbox correctness as proven.
4. Keep TUI/Ink evidence-only; do not describe terminal rendering or interaction behavior as product support.
5. Keep domain profiles separate from payload permission. A domain profile may observe signals, but a payload-policy decision must still choose compact, narrow, boundary-aware, fallback, or deferred behavior.
6. Keep runtime/provider claims out of this docs slice. No hook behavior, provider savings, billing-grade cost, runtime-token, latency, cache, or setup-parity claim changes are authorized.
7. Keep `mixed` and `unknown` as resolver safety sinks; conflicting, weak, or absent evidence must not become compact-payload permission.
8. Keep current-state and target-state separate; shared-source-facts wording is a future no-behavior seam, not current parser architecture.
9. Keep future work issue-sized. A later PR must name one slice, one owned surface, one verification command set, and one claim boundary.

## Claim wording guard

Use this checklist before editing README, release notes, roadmap, architecture docs, issue text, or PR descriptions:

- Prefer “product lane” for React Web and “candidate,” “evidence,” “source-only,” “fallback-first,” or “boundary” for RN/WebView/TUI.
- Name exact gates when they matter: the existing measured `F1`/`F13`/`F14`/`F15` RN primitive/input narrow pre-read payload family under `rn-primitive-input-narrow-payload`.
- Do not use “support,” “supported,” “available,” “enabled,” “stable,” “ready,” or “safe” near RN, WebView, or TUI unless the same sentence clearly negates or scopes the claim.
- Do not describe WebView compact extraction as default, safe, available, or supported.
- Do not describe TUI/Ink syntax evidence as terminal correctness, broad TUI support, or default compact reuse.
- Do not describe RN primitives, handlers, styles, navigation, accessibility, lists, media, or platform branches as runtime-correct, device-tested, accessible, equivalent to DOM controls, or cross-file understood.
- Do not imply that docs-only architecture work authorizes implementation worktrees, runtime source changes, setup changes, provider behavior changes, parser rewrites, or WebView compact paths.
- Do not treat `mixed` or `unknown` resolver outcomes as promotion candidates; they are safety sinks for fallback/deferred handling.

`test/claim-boundary-doc-audit.test.mjs` is the current automated guard for broad RN/WebView/TUI wording drift. This PRD is a human-facing companion to that test, not a replacement for it.

## Next issue slices

Each slice below must be filed and reviewed independently. None is authorized by this PRD to change runtime behavior by default.

1. **Issue slice: domain-profile registry shell**
   - Representative paths: `src/core/domain-profiles/registry.ts`, `src/core/domain-profiles/*`, `test/domain-profiles.test.mjs`.
   - Scope: introduce or refine profile/registry seams.
   - No-touch boundary: no support expansion, setup eligibility change, payload shape change, or runtime adapter change.
   - Verification: existing React Web behavior tests plus claim-boundary doc audit.
2. **Issue slice: React Web seam wrap**
   - Scope: move current React Web product behavior behind the new seams first.
   - Constraint: preserve current measured same-file behavior and public product wording.
   - Verification: React Web payload/evidence tests and build/typecheck.
3. **Issue slice: RN narrow candidate hardening**
   - Representative paths: `src/core/payload-policy/react-native.ts`, `src/core/domain-profiles/react-native.ts`, `test/payload-policy-react-native.test.mjs`, `test/pre-read-payload-builder.test.mjs`.
   - Scope: keep the current `F1`/`F13`/`F14`/`F15` primitive/input family and any listed RN concern evidence source-only and policy-scoped.
   - No-touch boundary: no broad RN support, no device/simulator/runtime correctness claim, no DOM/form equivalence, and no widening beyond the existing narrow exception without a separate issue.
   - Verification: RN payload/readiness tests and claim-boundary audit.
4. **Issue slice: WebView boundary fixture/fallback review**
   - Representative paths: `src/core/domain-profiles/webview.ts`, `src/core/payload-policy/webview.ts`, `test/payload-policy-webview.test.mjs`, `docs/frontend-domain-fixture-expectations.md`.
   - Scope: document WebView source, injection, and bridge boundary fixtures and fallback reasons.
   - No-touch boundary: fallback-first remains default; no compact payload reuse, bridge safety, or sandbox correctness claim.
   - Verification: WebView payload-policy/fallback tests and wording audit.
5. **Issue slice: TUI/Ink evidence baseline**
   - Representative paths: `src/core/domain-profiles/tui-ink.ts`, `src/core/payload-policy/tui-ink.ts`, `test/payload-policy-tui-ink.test.mjs`, `docs/tui-fixture-candidates.md`.
   - Scope: track Ink/React CLI syntax/payload fixture evidence only.
   - No-touch boundary: no broad TUI product support, terminal correctness, terminal UX safety, or default compact reuse.
   - Verification: TUI fixture docs/tests and claim-boundary audit.
6. **Issue slice: payload-policy split**
   - Representative paths: `src/core/payload-policy/registry.ts`, `src/core/payload-policy/fallback.ts`, `src/core/payload/domain-payload.ts`, `src/core/payload/model-facing.ts`.
   - Scope: make compact/narrow/boundary/fallback/deferred permission explicit after profile evidence.
   - No-touch boundary: no scanner/profile fact may become permission by itself.
   - Verification: payload-policy registry/coverage tests and focused docs audit.
7. **Issue slice: final public wording pass**
   - Scope: align README, release notes, roadmap, and benchmark docs after measured evidence changes.
   - Constraint: wording must not exceed green fixtures, policy gates, or benchmark assumptions.
   - Verification: `node --test test/claim-boundary-doc-audit.test.mjs` plus any lane-specific evidence command.

## Verification matrix

| Check | Command / artifact | Expected proof |
| --- | --- | --- |
| Diff hygiene | `git diff --check` | Docs patch has no whitespace or patch-format errors. |
| Claim wording scan | Run the claim-wording scan command below. | Matches only explicitly negated or forbidden examples; no positive product claim. |
| Claim-boundary docs audit | `node --test test/claim-boundary-doc-audit.test.mjs` | Existing docs audit remains green. |
| Domain profile guard for later code-touching slices | `npm run build && node --test test/domain-profiles.test.mjs` | React Web, RN, WebView, TUI/Ink, mixed, and unknown semantics remain as documented. |
| Payload policy guard for later code-touching slices | `npm run build && node --test test/payload-policy-registry.test.mjs test/payload-policy-react-native.test.mjs test/payload-policy-webview.test.mjs test/payload-policy-tui-ink.test.mjs` | Payload authorization remains separate from detection/profile evidence. |
| Runtime pre-read guard for later code-touching slices | `npm run build && node --test test/pre-read-payload-builder.test.mjs` | Runtime pre-read does not bypass policy/profile gates. |

Claim-wording scan command: run the repository claim-boundary patterns through `test/claim-boundary-doc-audit.test.mjs`; avoid embedding the raw broad-claim regex in audited docs because the audit intentionally flags it.

## PR acceptance criteria for issue #796 / #805

- This PRD maps current domain-profile, payload-policy, runtime, and evidence surfaces.
- This PRD includes current-state vs target-state wording and the exact resolver state matrix.
- React Web, RN, WebView, and TUI statuses are locked using behavior-neutral wording.
- Next issue slices are explicit and do not authorize broad implementation work.
- Claim wording guard is documented and covered by the existing audit test surface.
- The final diff contains no runtime/provider behavior change.
