# Test Spec — TUI payload-design planning gate after PR #626

## Metadata
- Issue: #632
- Base `origin/main`: `f6b1b2038eeb78f2861ca04a0a3b103dfc88fa2f`
- Worktree: `../fooks-tui-payload-design-planning-gate`
- Branch: `chore/tui-payload-design-planning-gate-post-626`
- Launch status: `planning-only`
- Companion PRD: `.omx/plans/prd-tui-payload-design-planning-gate-post-626.md`

## Purpose
Verify that the post-#626 TUI planning gate is explicit enough to block accidental implementation promotion while remaining narrow enough to ship as a two-file planning-only PR.

## Scope for this PR
- The two new planning files only.
- Planning-only wording and execution metadata.
- Relationship to the older readiness pair.
- Future shared-seam / merge-order / fallback-regression / claim-boundary requirements.

## Out of scope for this PR
- Any `src/` behavior change.
- Any test fixture or manifest change.
- Any payload-policy, detector, pre-read, runtime, CLI, or help output change.
- Any support/schema/runtime widening claim.

## Required assertions on the new PRD/test-spec pair
1. Both files mark the lane as `planning-only` / no-launch.
2. Both files state that the older readiness pair is background context and is not silently replaced.
3. The PRD names exact shared files/seams that a later implementation lane must own explicitly.
4. The PRD names merge-order expectations: planning pair first, then one shared-policy owner, then any dependent docs/tests lanes.
5. The PRD names fallback/no-payload regressions that must remain stable before implementation.
6. The PRD names public claim-boundary checkpoints and forbidden claims.
7. This test spec states that the execution PR diff is limited to exactly two new `.omx/plans/` files.
8. Neither file uses language that reads as support approval, schema approval, runtime/pre-read approval, or `allowed: true` authorization.

## Planning-only PR framing checks
The issue/branch/worktree/PR handoff for this lane must prove:
- issue `#632` exists under `minislively`;
- worktree path is `../fooks-tui-payload-design-planning-gate`;
- branch is `chore/tui-payload-design-planning-gate-post-626`;
- base SHA is `f6b1b2038eeb78f2861ca04a0a3b103dfc88fa2f`;
- PR title remains planning-only and does not imply implementation.

## Forbidden-language review list
The two new files must not positively state or imply:
- TUI/Ink is supported today;
- terminal correctness or runtime behavior is proven;
- token, billing, provider-cost, or performance savings are available;
- default TUI compact extraction is enabled;
- `allowed: true` is approved;
- payload fields or schema are approved for implementation now.

## Future implementation verification obligations captured by this planning gate
A later implementation lane must include targeted verification for all of the following areas before merge:

### Shared-seam ownership
- detector / domain-profile ownership if classification changes are proposed
- payload-policy ownership if `allowed` or denied-reason logic changes are proposed
- payload-builder ownership if model-facing payload or compact extraction is proposed
- pre-read/runtime ownership if fallback or runtime delivery changes are proposed
- CLI/debug-surface ownership if `inspect-domain` or related visibility changes are widened

### Fallback/no-payload regressions
- current TUI fixtures remain denied until a later owner intentionally changes that rule
- mixed TUI/Web and TUI/RN fixtures remain denied and fallback-first
- non-Ink CLI renderer remains outside TUI authorization
- additive `tuiSourceMetadata` remains non-promotional unless explicitly revised by an owning lane

### Claim-boundary regressions
- public docs and help surfaces do not claim support/correctness/performance/token value from the planning gate alone
- any later widening re-checks the normative docs and `test/fooks.test.mjs` guards before merge

## Verification commands for this planning PR
```bash
git diff --check
git diff --name-only -- .omx/plans/prd-tui-payload-design-planning-gate-post-626.md .omx/plans/test-spec-tui-payload-design-planning-gate-post-626.md
```

## Manual review checklist for this planning PR
- [ ] PR diff contains only the two new `.omx/plans/` files
- [ ] both files include issue/base/worktree/branch metadata
- [ ] both files say planning-only / no-launch
- [ ] both files cross-reference the older readiness pair as background context
- [ ] PRD includes exact shared seams, merge order, fallback regressions, and public claim-boundary checkpoints
- [ ] neither file contains forbidden support/schema/runtime-promotion wording
