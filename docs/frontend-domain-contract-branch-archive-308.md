# Issue #308 frontend-domain contract branch re-triage archive

Date: 2026-04-30

Branch inspected: `origin/frontend-domain-contract-before-extractor-promotion`
Base inspected: `origin/main` at `73b7212`

## Bounded evidence

Issue #308 requested a fresh stale-branch inspection for
`frontend-domain-contract-before-extractor-promotion` without merging stale-tree
deletes.

The branch tip inspected was `0658854`. The branch-only commits relative to
current `origin/main` were:

- `0658854` `merge: resolve conflict with main (PR #199 changes)`
- `f087fbe` `Define frontend domain claims before detector work`

The merge-base diff showed the branch's original narrow payload was 5 files
changed with 115 insertions and 1 deletion, touching only these files:

- `docs/frontend-domain-contract.md`
- `docs/frontend-domain-fixture-expectations.md`
- `docs/frontend-domain-profiles.md`
- `docs/roadmap.md`
- `test/fooks.test.mjs`

That original payload added the first frontend-domain contract and a regression
test for the pre-detector/profile gate. Current `origin/main` already contains
`docs/frontend-domain-contract.md` with later, broader, and more specific
successors for that contract, including the measured React Native `F1` narrow
payload gate, WebView fallback-first boundaries, TUI evidence-only wording,
Mixed/Unknown safety states, detector-promotion readiness gates, and the domain
parallel ownership/launch contract.

A direct tree comparison from current `origin/main` to the stale branch was not
safe to replay: it reported 58 changed files with 154 insertions and 6,070
deletions, including 30 current-file deletes. Representative deletes included:

- `docs/domain-payload-architecture.md`
- `docs/frontend-fixture-boundary-regression-map.md`
- `docs/remote-branch-audit.md`
- `scripts/audit-remote-branches.mjs`
- `scripts/guard-pr-alerts.mjs`
- `scripts/release-claim-guards.mjs`
- `src/core/domain-detector.ts`
- `src/core/payload/domain-payload.ts`
- `test/domain-detector.test.mjs`
- `test/react-web-domain-payload-expansion.test.mjs`

Issue #298 previously archived this same remote branch in
`docs/frontend-domain-contract-branch-archive-298.md`. This note is the narrower
issue #308 re-triage record against the newer `origin/main` state.

## Decision

Archive the branch again for issue #308 instead of salvaging or transplanting
files. The only unique branch intent worth preserving was the frontend-domain
contract gate, and that intent is already represented on current `origin/main` by
newer docs and tests. Replaying the branch tree would delete current audit,
detector, payload, fixture, and guard surfaces that postdate the branch.

No branch code, tests, docs, or stale deletes were merged. The issue #308 delta is
this archive note only.

## Verification

Run before commit:

- `git diff --check`
- `grep -R "frontend-domain-contract-before-extractor-promotion" -n docs/frontend-domain-contract-branch-archive-308.md docs/frontend-domain-contract-branch-archive-298.md`
- `test -f docs/frontend-domain-contract.md`
