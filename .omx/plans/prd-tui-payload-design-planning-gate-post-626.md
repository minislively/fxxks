# PRD — TUI payload-design planning gate after PR #626

## Metadata
- Issue: #632
- Base `origin/main`: `f6b1b2038eeb78f2861ca04a0a3b103dfc88fa2f`
- Worktree: `../fooks-tui-payload-design-planning-gate`
- Branch: `chore/tui-payload-design-planning-gate-post-626`
- Launch status: `planning-only`
- Source artifacts:
  - `.omx/specs/deep-interview-tui-post-626-payload-design-planning-gate.md`
  - `.omx/plans/ralplan-tui-post-626-payload-design-planning-pr.md`
  - `.omx/plans/prd-tui-payload-design-readiness.md`
  - `.omx/plans/test-spec-tui-payload-design-readiness.md`
  - `docs/tui-operational-readiness.md`
  - `docs/tui-fixture-candidates.md`

## Objective
Create a fresh latest-main, planning-only handoff for the next TUI lane after merged PR #626. This PRD does not authorize implementation. It defines the exact planning boundary a later implementation lane must satisfy before any payload/schema/shared-seam work may begin.

## Why now
- The landed `inspect-domain --json` appendix already exposes debug/test-owned `tuiSourceMetadata` for TUI evidence, but it remains non-promotional and denied by policy.
- Current TUI docs now say the next approved artifact is a separate **PRD + test-spec pair**.
- Without a fresh post-#626 planning artifact, a later executor could wrongly infer that the landed appendix authorizes payload emission, schema approval, or runtime/pre-read widening.

## Current landed state to preserve
1. `tui-ink` remains `evidence-only` and denied by `tui-ink-evidence-only-payload` with `allowed: false`.
2. `fooks inspect-domain <file> --json` may show additive `tuiSourceMetadata`, but `domainDetection` and `fallbackFirst` remain the primary inspect contract.
3. Pre-read stays fallback/no-payload for every current TUI fixture.
4. Mixed and non-Ink cases remain outside TUI payload authorization.
5. README/help/release/support wording must not widen from the current candidate/evidence-only posture.

## Relationship to the older readiness pair
This PRD **complements and cross-references** the older readiness pair:
- `.omx/plans/prd-tui-payload-design-readiness.md`
- `.omx/plans/test-spec-tui-payload-design-readiness.md`

It does **not** replace or silently edit their authority. The older pair remains background context for why a payload-design lane needed readiness gates at all. This post-#626 pair exists because the repo now has a landed debug/test-owned appendix and refreshed docs contract, so the next planning artifact must explicitly account for that newer state.

## Decision
The next TUI lane remains **planning-only**. A later implementation lane is blocked until it cites this PRD + matching test spec and names one serialized shared-policy owner for any shared seam it needs to modify.

## In scope
- Planning-only description of future TUI payload-design boundaries.
- Exact shared files/seams a future implementation lane must name if it wants to move beyond the current appendix.
- Merge-order and ownership expectations for future shared-seam work.
- Fallback/no-payload regressions that must stay green before implementation promotion.
- Public claim-boundary checks that must be re-reviewed before any implementation PR opens.

## Out of scope / non-goals
- No `src/` changes in this PR.
- No detector, domain-profile, payload-policy, payload-builder, pre-read, runtime, CLI, or manifest changes.
- No new debug surface.
- No `allowed: true`.
- No schema approval, field approval, payload emission, shared-seam start, or runtime/pre-read linkage.
- No support, terminal-correctness, token, billing, provider-cost, or performance claims.

## Shared files / seams a future implementation lane must name explicitly
If a later PR wants to move beyond the current planning gate, it must call out ownership and merge order for the exact shared files it intends to touch. Current likely shared seams are:

### Detector / domain-profile seam
- `src/core/domain-detector.ts`
- `src/core/domain-profiles/tui-ink.ts`
- `src/core/domain-profiles/registry.ts`

### TUI payload-policy seam
- `src/core/payload-policy/tui-ink.ts`
- `src/core/payload-policy/registry.ts`
- `src/core/payload-policy/profile-gate.ts`

### Payload / source-metadata seam
- `src/core/tui-source-metadata.ts`
- `src/core/payload/domain-payload.ts`
- `src/core/payload/model-facing.ts`
- `src/core/payload/readiness.ts`

### Pre-read / runtime seam
- `src/adapters/pre-read.ts`
- `src/adapters/pre-read-stack.ts`
- `src/adapters/codex-pre-read.ts`
- `src/adapters/codex-runtime-hook.ts`
- `src/adapters/claude-runtime-hook.ts`

### CLI / debug-surface seam
- `src/cli/index.ts`

### Shared tests / manifest / normative docs seam
- `test/payload-policy-tui-ink.test.mjs`
- `test/payload-policy-registry.test.mjs`
- `test/tui-source-metadata.test.mjs`
- `test/fooks.test.mjs`
- `test/fixtures/frontend-domain-expectations/manifest.json`
- `docs/tui-operational-readiness.md`
- `docs/tui-fixture-candidates.md`
- `docs/frontend-domain-contract.md`
- `docs/domain-payload-architecture.md`

A future implementation PR must not treat this list as pre-approval. It is a discovery fence: if any one of these shared surfaces is touched, the PR must name ownership and ordering explicitly.

## Merge-order / ownership expectations for later implementation
1. **This planning pair merges first.** No implementation branch may claim TUI payload widening without citing the merged pair.
2. **One shared-policy owner first.** The first implementation PR that edits detector, payload-policy, payload-builder, pre-read, runtime, manifest, or normative claim-boundary docs must declare itself the single shared-policy owner for that wave.
3. **Lane-owned docs/tests after shared owner.** Any later docs/tests-only or fixture-only follow-up lanes must wait for the shared-policy owner to land or rebase after it.
4. **Debug/CLI widening last, if needed.** Any lane that widens `inspect-domain` or another debug surface beyond the current appendix must land only after the shared-policy owner and its fallback regressions are stable.

## Required fallback regressions before any implementation lane
A later implementation lane must preserve or explicitly replace the following regressions before asking for promotion:
1. Every current TUI fixture still proves `allowed: false` until the implementation PR explicitly changes that rule and justifies it.
2. Pre-read for TUI fixtures remains fallback/no-payload unless the implementation PR owns that seam and replaces the fallback contract intentionally.
3. Mixed fixtures (`tui-ink-web-dom-mixed.tsx`, `tui-ink-rn-narrow-mixed.tsx`) remain denied and fallback-first until a new plan says otherwise.
4. Non-Ink terminal-looking React fixtures remain outside the TUI lane.
5. The current `inspect-domain --json` appendix remains additive and non-promotional unless a later owner explicitly revises that contract.

## Public claim-boundary review checkpoints before implementation
A later implementation PR must re-check all public or semi-public wording surfaces before merge and must not claim:
- TUI support is available today;
- terminal rendering or input correctness is guaranteed;
- token, billing, provider-cost, runtime, or performance savings are proven;
- default TUI compact extraction is enabled.

At minimum, the later lane must re-review:
- `docs/tui-operational-readiness.md`
- `docs/tui-fixture-candidates.md`
- `docs/frontend-domain-contract.md`
- `docs/domain-payload-architecture.md`
- CLI help / release-note surfaces guarded by `test/fooks.test.mjs`

## Acceptance criteria for this planning gate PR
1. The PR adds exactly two tracked files:
   - `.omx/plans/prd-tui-payload-design-planning-gate-post-626.md`
   - `.omx/plans/test-spec-tui-payload-design-planning-gate-post-626.md`
2. Both files say the lane is `planning-only` and does not authorize implementation.
3. Both files cross-reference the older readiness pair as background context, not replacement.
4. This PRD names exact shared files/seams, merge-order expectations, fallback regressions, and public claim-boundary checkpoints for the next implementation lane.
5. The PR framing records issue `#632`, branch/worktree names, and base SHA `f6b1b2038eeb78f2861ca04a0a3b103dfc88fa2f`.
6. No wording in either file implies support promotion, schema approval, or runtime/pre-read widening.

## Verification for this planning PR
- `git diff --check`
- `git diff --name-only --cached` or equivalent diff inspection proving only the two plan files are in scope
- forbidden-language grep/review across the two new files for support, correctness, token, billing, provider-cost, performance, `allowed: true`, and implementation-promotion language

## Follow-up gate
After this PR merges, any new request to implement TUI payload behavior must start a separate execution lane that cites this PRD and its matching test spec before touching shared seams.
