# Domain Parallel First-Wave Launch Contract

This launch contract applies after main includes the first disjoint-domain wave template from `docs/frontend-domain-contract.md`. It records the first concrete React Web / RN / WebView / TUI lane split as a reviewable contract before implementation branches begin.

This document is not a runtime/source change, fixture expansion, domain support claim, token/cache/billing/performance claim, or permission to edit serialized shared seams. It is a contract artifact for the next execution cycle.

## Launch base

- Base branch: `main`
- Minimum base commit: `d64154e` (`Name the first disjoint domain wave contract`)
- Required preflight before lane handoff: `git fetch --prune origin && git pull --ff-only origin main && npm run build && npm run typecheck -- --pretty false`

## Launch status

| Field | Value |
| --- | --- |
| Status | `disjoint-domain-writers` |
| Shared-seam owner | `none` |
| Runtime writer lane | `none` |
| Claim posture | React Web remains the current supported lane; RN stays narrow F1 only, WebView stays fallback-first, and TUI/Ink stays evidence-only. |
| This PR | Contract only; no lane implementation worktree is part of this PR. |

## Current capability usage guard

The integration / usage guard lane is the single-owner coordination pass that keeps parallel domain work aligned with the capabilities already present on `main`. It does not implement RN, React Web, WebView, or TUI behavior. Instead, it tells lane owners how to dogfood the current payload-policy seams without treating evidence as a support promotion.

Current capability boundaries for lane PRs:

- React Web remains the current broad measured lane for compact payload reuse when existing readiness rules allow it.
- React Native may dogfood only the measured `F1` primitive/input narrow payload path. RN evidence outside that gate stays fallback/evidence and must not be described as broad support.
- WebView remains fallback-first boundary evidence. WebView bridge/source/message signals do not authorize compact payload reuse or bridge-safety wording.
- TUI/Ink remains evidence-only. Ink syntax or key-input facts do not imply terminal correctness, terminal UX safety, or runtime-token savings.

Before a lane PR asks for review, its owner should add or confirm this usage evidence in the PR body:

```text
Current capability used:
Dogfood target or fixture:
Payload-policy decision observed:
Fallback/evidence boundary preserved:
Shared seams touched: none
Support-claim grep result:
Next lane blocked by this PR: yes/no
```

A lane may cite this guard as merge evidence only when it stays inside its allowed write set and preserves the current capability boundary above. If a lane needs to edit runtime/source shared seams, reinterpret RN primitives beyond `F1`, reuse WebView compact payloads, or promote TUI evidence into terminal behavior, stop the lane and open a shared-policy plan before implementation continues.

## Lane table

| Lane | Branch/worktree prefix | Allowed write set | Forbidden write set | Required lane verification |
| --- | --- | --- | --- | --- |
| `react-web` | `lane/react-web-*` / `fooks-react-web-*` | React Web profile/policy tests, React Web fixtures, React Web docs scoped to the current supported lane. | Shared detector, pre-read, registry, manifest, claim-boundary, fallback-policy, RN/WebView/TUI support wording. | `npm run build && node --test test/payload-policy-react-web.test.mjs test/react-web-domain-payload-expansion.test.mjs test/fooks.test.mjs` |
| `react-native` | `lane/rn-*` / `fooks-rn-*` | RN primitive/input evidence, RN policy tests, RN fixtures, and narrow-gate docs. | Shared fallback reason changes, WebView bridge wording, broad RN support wording, serialized shared seams. | `npm run build && node --test test/payload-policy-react-native.test.mjs test/pre-read-phase-order-regression.test.mjs test/fooks.test.mjs` |
| `webview-boundary` | `lane/webview-*` / `fooks-webview-*` | WebView boundary fixtures, source/onMessage/injected-JS evidence, fallback-first tests/docs. | Compact-payload reuse, bridge-safety wording, RN fallback ownership, serialized shared seams. | `npm run build && node --test test/payload-policy-webview.test.mjs test/pre-read-phase-order-regression.test.mjs test/claim-boundary-doc-audit.test.mjs` |
| `tui-ink` | `lane/tui-ink-*` / `fooks-tui-ink-*` | Ink/TUI syntax evidence, evidence-only tests, terminal-profile docs. | Terminal correctness wording, runtime-token savings wording, default compact extraction, serialized shared seams. | `npm run build && node --test test/payload-policy-tui-ink.test.mjs test/claim-boundary-doc-audit.test.mjs test/fooks.test.mjs` |

## Forbidden shared seams

Every participating lane must avoid these files unless a later contract changes status to `single-shared-owner` and names one owner branch:

- `src/core/domain-detector.ts`
- `src/core/domain-profiles/registry.ts`
- `src/core/payload-policy/registry.ts`
- `src/core/payload/domain-payload.ts`
- `src/core/payload/readiness.ts`
- `src/adapters/pre-read.ts`
- `src/adapters/*-runtime-hook.ts`
- `src/adapters/*-hook-preset.ts`
- `src/core/schema.ts`
- `test/fooks.test.mjs`
- `test/fixtures/frontend-domain-expectations/manifest.json`
- `docs/frontend-domain-contract.md`
- `docs/frontend-domain-fixture-expectations.md`
- `docs/frontend-fixture-boundary-regression-map.md`

## Disjoint-file proof format

Each lane PR body must include this evidence before review:

```text
Lane:
Branch/worktree:
Base commit:
Allowed write set used:
Files changed:
Forbidden shared seams touched: none
Claim-boundary grep result:
Lane verification command:
Leader aggregate verification needed after merge: yes
```

A branch with any forbidden shared seam in `Files changed` stops being a disjoint-domain writer and returns to shared-policy planning.

## PR order

1. Rebase every lane on the launch base.
2. Review the lane PRs in this order when all remain disjoint: `react-web`, `react-native`, `webview-boundary`, `tui-ink`.
3. If any lane discovers a shared-seam requirement, stop that lane and create a separate `lane/shared-policy-*` contract update before merging dependent lane work.
4. After each lane merge, the leader runs aggregate verification before opening the next merge.

## Aggregate verification matrix

The leader runs these commands after each lane merge and before the next lane merge:

```sh
npm run build
npm run typecheck -- --pretty false
node --test test/claim-boundary-doc-audit.test.mjs test/release-claim-guards.test.mjs test/fooks.test.mjs
npm test
```

The support-claim grep remains required over `docs` and `src` for each lane and for the aggregate pass.

## build/typecheck preflight evidence

Before any lane prompt, review inbox, or implementation handoff, the leader records local build/typecheck preflight evidence from the launch base:

```sh
npm run build
npm run typecheck -- --pretty false
```

The lane owner repeats the same preflight in its own worktree before editing files.

## ownership/scope evidence

Before lane work starts, the leader records:

- lane owner or agent id;
- branch/worktree path;
- allowed write set;
- forbidden shared seams;
- review inbox target;
- lane verification command;
- stop-rule acknowledgement.

## Stop rules

Stop the wave and return to planning when any of these occur:

- a lane touches a forbidden shared seam;
- claim-boundary wording drifts for RN, WebView, TUI/Ink, Mixed, or Unknown;
- WebView stops being fallback-first;
- RN expands beyond the measured F1 primitive/input narrow gate;
- TUI/Ink wording implies terminal correctness or runtime-token savings;
- build/typecheck preflight evidence is missing;
- ownership/scope evidence is missing;
- lane verification or aggregate verification fails.
