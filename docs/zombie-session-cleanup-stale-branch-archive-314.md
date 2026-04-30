# Issue #314 zombie-session cleanup stale-branch archive rationale

Date: 2026-04-30

Branch inspected: `origin/dogfood/zombie-session-cleanup-20260427140348`
Base inspected: `origin/main`

## Bounded evidence

`git log --oneline --decorate origin/main..origin/dogfood/zombie-session-cleanup-20260427140348` shows one branch-only commit:

- `0fe6860` `Document stale runtime cleanup in artifact audit`

`git cherry -v origin/main origin/dogfood/zombie-session-cleanup-20260427140348` marks that commit as patch-equivalent to current main:

- `- 0fe68600290cbde91a2d77769844231b73665dde Document stale runtime cleanup in artifact audit`

The equivalent current-main commit is `e8233b9` (`Document stale runtime cleanup in artifact audit (#220)`).

The merge base with current main is `775fb0cf17459abcd9cb58035dafd18cd9b2dcf2`. The branch-only diff from that merge base is narrow: `git diff --stat origin/main...origin/dogfood/zombie-session-cleanup-20260427140348` reports 5 files changed with 62 insertions and 4 deletions:

- `README.md`
- `docs/setup.md`
- `src/core/artifact-audit.ts`
- `src/index.ts`
- `test/artifact-audit.test.mjs`

Directly comparing the stale branch tree against current `origin/main` is destructive and must not be replayed. `git diff --shortstat origin/main..origin/dogfood/zombie-session-cleanup-20260427140348` reports 48 files changed, 237 insertions, and 4619 deletions. The current-tree comparison also reports 22 deleted files, including current docs, scripts, source, fixtures, and tests.

## Decision

Archive the stale branch instead of replaying or merging it. The useful stale-runtime cleanup documentation and audit behavior from `0fe6860` is already represented on current main by `e8233b9` in:

- `README.md`
- `docs/setup.md`
- `src/core/artifact-audit.ts`
- `src/index.ts`
- `test/artifact-audit.test.mjs`

No branch tree, code, or tests were transplanted for issue #314. This artifact preserves the bounded audit decision and records why future PR text should close #314 without reviving the destructive stale tree.

## Verification

Run before commit:

- `git diff --check origin/main..HEAD`
- `git diff --name-only origin/main..HEAD`
- `git diff --stat origin/main..HEAD`
