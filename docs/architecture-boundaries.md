# Architecture boundaries

Issue #674 records the current fooks responsibility map. This page is a maintainer-facing architecture guide, not a runtime behavior change, support promise, benchmark claim, or release-readiness claim.

The strongest bounded product path remains Codex repeated same-file React Web `.tsx` / `.jsx` work. React Native, WebView, and TUI / React CLI remain deferred, fallback, candidate, or evidence-only lanes unless a later PR adds explicit fixtures, policy gates, and claim-boundary tests.

## Boundary doctrine

1. **Runtime adapters invoke policy; they do not invent product claims.** CLI and adapter code may decide when to call the engine and how to install hooks, but extraction safety and domain maturity stay behind core policy gates.
2. **The engine observes and decides from source facts.** Pure extraction, domain detection, payload policy, and model-facing packet assembly should be reusable without knowing which runtime called them.
3. **Domain support is bounded by evidence gates.** React Web is the current strongest runtime path. RN, WebView, TUI, Mixed, and Unknown lanes can record source evidence, but that evidence is not a broad runtime-support claim.
4. **Evidence/status/release reporting is descriptive.** Reporting surfaces summarize artifacts, freshness, claim boundaries, or release evidence. They do not authorize runtime compaction by themselves.
5. **Ops/dogfood utilities are maintenance tooling.** Branch audits, PR alert guards, CI triage, and merge-cleanup scripts help maintain the repository. They are not product architecture seams and must not be cited as runtime support.

## Current responsibility map

| Boundary | Owns | Representative current paths | Must not own |
| --- | --- | --- | --- |
| CLI / user commands | Human-facing command parsing, setup/install/status/doctor dispatch, and concise output contracts. | `src/cli/index.ts`, `src/cli/doctor.ts`, `src/cli/run.ts`, `package.json` `bin` and user-facing npm scripts. | Source extraction policy, domain promotion, provider billing claims, or ops cleanup decisions. |
| Runtime adapters | Codex, Claude, and opencode integration surfaces: hook presets, runtime hook payloads, session state, trust/readiness checks, and runtime-specific handoff files. | `src/adapters/codex-runtime-hook.ts`, `src/adapters/codex-native-hook.ts`, `src/adapters/codex-hook-preset.ts`, `src/adapters/claude-runtime-hook.ts`, `src/adapters/claude-hook-preset.ts`, `src/adapters/opencode-tool-preset.ts`. | Domain maturity decisions, broad support wording, benchmark conclusions, or PR/branch operations. |
| Pure engine / extraction core | Source scanning, extraction, hashing, mode decisions, context selection, payload formatting, cache mechanics, and schema-level source facts. | `src/core/scan.ts`, `src/core/extract.ts`, `src/core/decide.ts`, `src/core/context-policy.ts`, `src/core/payload/model-facing.ts`, `src/core/payload/readiness.ts`, `src/core/schema.ts`, `src/core/cache.ts`. | Runtime-home writes, hook installation, release notes, issue/PR triage, or provider-invoice claims. |
| Domain support boundaries | Domain classification, domain profiles, concern profiles, and payload-policy gates that decide whether source evidence may affect a model-facing packet. | `src/core/domain-detector.ts`, `src/core/domain-profiles/react-web.ts`, `src/core/domain-profiles/react-native.ts`, `src/core/domain-profiles/tui-ink.ts`, `src/core/domain-profiles/webview.ts`, `src/core/payload-policy/react-web.ts`, `src/core/payload-policy/react-native.ts`, `src/core/payload-policy/tui-ink.ts`, `src/core/payload-policy/webview.ts`, `src/core/concern-profiles/*`. | Claims that syntax evidence proves native, terminal, bridge, visual, accessibility, billing, or runtime correctness. |
| Evidence / status / release reporting | Artifact reading/writing, freshness checks, local status summaries, release evidence reports, and claim-boundary report rendering. | `src/core/react-web-evidence-artifact.ts`, `src/core/react-web-status.ts`, `src/core/react-web-activation-mode.ts`, `src/core/react-web-ranked-bundle.ts`, `src/core/react-web-context-metadata.ts`, `src/core/worktree-evidence.ts`, `src/core/artifact-audit.ts`, `scripts/react-web-context-evidence.mjs`, `scripts/react-web-release-report-surface.mjs`, `scripts/release-benchmark-evidence.mjs`, `scripts/release-claim-guards.mjs`, `docs/benchmark-evidence.md`, `docs/release-readiness.md`. | Runtime permission to compact, domain support promotion, provider billing proof, or hook installation side effects. |
| Ops / dogfood guard utilities | Repository maintenance, dogfood hygiene, CI/PR alert summaries, branch/worktree audit, and merge-cleanup classification. | `scripts/audit-remote-branches.mjs`, `scripts/guard-pr-alerts.mjs`, `scripts/triage-ci-alerts.mjs`, `scripts/classify-pr-merge-cleanup.mjs`, `scripts/validate-pr-merge-gate.mjs`, `docs/ci-alert-triage.md`, `docs/pr-alert-disambiguation.md`, `docs/remote-branch-audit.md`. | Product runtime behavior, support promotion, extraction policy, or user-facing setup semantics. |

## Mixed-location rule

Some files with evidence or status names currently live under `src/core/` because they share schemas, hashing, source fingerprints, and text rendering with the engine. That physical location does not make them runtime authority. Treat these files as reporting surfaces unless they are explicitly called by a payload-policy gate:

- `src/core/react-web-evidence-artifact.ts`
- `src/core/react-web-status.ts`
- `src/core/react-web-activation-mode.ts`
- `src/core/react-web-ranked-bundle.ts`
- `src/core/worktree-evidence.ts`
- `src/core/artifact-audit.ts`
- `src/core/operator-activity.ts`

A future move into folders such as `src/reporting/` or `src/ops/` can be useful only when it has a reviewer-readable reason, stable import/export tests, and no CLI/runtime behavior change. Until then, boundary documentation and tests are the safer seam.

## React Web first, other lanes bounded

React Web is the strongest bounded runtime path because it has the current repeated same-file Codex workflow, source-context policy, React Web status surfaces, and claim-boundary tests. Other frontend-family evidence remains narrower:

- React Native source facts can be evidence for a measured narrow gate, but they are not mobile runtime correctness, device/simulator proof, native platform behavior proof, or broad product support.
- WebView source facts can identify bridge/security boundaries, but they are not WebView support, bridge safety proof, or compact-payload reuse permission.
- TUI / React CLI source facts can be syntax-level evidence, but they are not terminal semantics, terminal UX correctness, or default compact-reuse permission.

## Cleanup rule for future PRs

Before moving or renaming architecture files, a PR should answer:

1. Which boundary does the file belong to: CLI, runtime adapter, engine, domain policy, evidence/status/release reporting, or ops/dogfood utility?
2. Is the change required for behavior, or only for readability?
3. Which public behavior proves unchanged: CLI output, package export, hook payload, setup/doctor/status behavior, or generated report shape?
4. Which claim-boundary test prevents support wording from widening accidentally?

If those answers are not concrete, prefer a doc/test cleanup over a file move.
