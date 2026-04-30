# Issue #298 frontend-domain contract branch archive rationale

Date: 2026-04-30

Branch inspected: `origin/frontend-domain-contract-before-extractor-promotion`
Base inspected: `origin/main`

## Bounded evidence

`git log --oneline --no-merges origin/main..origin/frontend-domain-contract-before-extractor-promotion` shows two branch-only commits:

- `0658854` `merge: resolve conflict with main (PR #199 changes)`
- `f087fbe` `Define frontend domain claims before detector work`

`git rev-list --count origin/frontend-domain-contract-before-extractor-promotion..origin/main` shows the branch is 83 commits behind current `origin/main`.

`git diff --stat origin/main origin/frontend-domain-contract-before-extractor-promotion` reports a stale current-tree replay of 55 files with 154 insertions and 5,694 deletions. The destructive delete count is 27 current files, including these representative paths:

- `docs/domain-payload-architecture.md`
- `docs/frontend-fixture-boundary-regression-map.md`
- `docs/remote-branch-audit.md`
- `scripts/audit-remote-branches.mjs`
- `scripts/guard-pr-alerts.mjs`
- `src/core/domain-detector.ts`
- `src/core/payload/domain-payload.ts`
- `test/domain-detector.test.mjs`
- `test/claim-boundary-doc-audit.test.mjs`
- `test/react-web-domain-payload-expansion.test.mjs`

For salvage scope, `git diff --stat origin/main...origin/frontend-domain-contract-before-extractor-promotion` shows the original branch payload was only five files:

- `docs/frontend-domain-contract.md`
- `docs/frontend-domain-fixture-expectations.md`
- `docs/frontend-domain-profiles.md`
- `docs/roadmap.md`
- `test/fooks.test.mjs`

## Decision

Archive the stale branch instead of opening a direct PR from it. Current `origin/main` already contains `docs/frontend-domain-contract.md` and has superseded the branch's contract with later RN primitive/input narrow-payload, WebView fallback-first, TUI evidence-only, mixed/unknown safety, domain-parallel ownership, and detector-promotion readiness wording.

No branch code, tests, or stale deletes should be transplanted. The still-relevant contract artifact is already preserved on `origin/main`; this document is the minimal issue #298 artifact recording why the remote branch should be treated as archived/no-direct-PR evidence.

## Verification

Run before commit:

- `git diff --check`
- `test -f docs/frontend-domain-contract.md`
