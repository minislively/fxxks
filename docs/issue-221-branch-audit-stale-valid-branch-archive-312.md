# Issue #312 branch-audit stale-valid archive rationale

Date: 2026-04-30

Branch inspected: `origin/codex/issue-221-branch-audit-stale-valid`
Base inspected: `origin/main`

## Bounded evidence

`git log --oneline --decorate origin/main..origin/codex/issue-221-branch-audit-stale-valid` shows one branch-only commit:

- `ce7377a` `Clarify stale branch audit review risk`

`git cherry -v origin/main origin/codex/issue-221-branch-audit-stale-valid` marks that commit as patch-equivalent to current main:

- `- ce7377a1aa2ff75ad6bca88c861b7f9aad352d6b Clarify stale branch audit review risk`

The merge base with current main is `e8233b945b1e088917e2412e23d0c47850bc2edc`.
The branch-only diff from that merge base is narrow: `git diff --stat origin/main...origin/codex/issue-221-branch-audit-stale-valid` reports 2 files changed with 73 insertions and 3 deletions:

- `scripts/audit-remote-branches.mjs`
- `test/audit-remote-branches.test.mjs`

Directly comparing the stale branch tree against current `origin/main` is not safe to replay. `git diff --stat origin/main..origin/codex/issue-221-branch-audit-stale-valid` reports 47 files changed with 234 insertions and 4508 deletions. The current-tree comparison also reports 21 deleted files, including current docs, scripts, source, fixtures, and tests.

## Decision

Archive the stale branch instead of replaying or merging it. The useful review-risk wording from `ce7377a` is already represented on current main by the branch-audit current-tree impact and destructive-stale-tree evidence in `scripts/audit-remote-branches.mjs`, with coverage in `test/audit-remote-branches.test.mjs`.

No branch tree, code, or tests were transplanted for issue #312. This artifact preserves the bounded audit decision and records why future PR text should close #312 without reviving the destructive stale tree.

## Verification

Run before commit:

- `git diff --check origin/main..HEAD`
- `git diff --name-only origin/main..HEAD`
- `git diff --stat origin/main..HEAD`
