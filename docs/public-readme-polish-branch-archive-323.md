# Public README polish branch archive (#323)

Branch inspected: `origin/chore/v0.1.0-public-readme-polish`

## Bounded evidence

- `git log --oneline origin/main..origin/chore/v0.1.0-public-readme-polish`
  - `5f1774d test: update README subtitle regex to match polished wording`
  - `2516265 polish: tighten README opening for v0.1.0 public release`
- `git diff --stat origin/main...origin/chore/v0.1.0-public-readme-polish`
  - `README.md           | 4 ++--`
  - `test/fooks.test.mjs | 2 +-`
  - `2 files changed, 3 insertions(+), 3 deletions(-)`
- Current-tree impact from `git diff --name-status origin/main..origin/chore/v0.1.0-public-readme-polish`: `A:7 M:70 D:68`; current-tree delete count is `68` and the current-tree shortstat is `145 files changed, 2785 insertions(+), 11772 deletions(-)`.
- Unique patch files changed by the bounded three-dot diff: `README.md`, `test/fooks.test.mjs`.

## Decision

Archive this branch instead of replaying it. Although the bounded unique patch is only README/test wording, the current branch tree is destructive against `origin/main` (68 current-file deletes). The still-relevant public-release boundary wording is already present on `origin/main`: README now says that `fooks` reduces model-facing input for supported repeated frontend file work and that Claude and opencode remain narrower helper paths, not Codex-equivalent automatic optimization.

The branch's remaining subtitle/test-regex polish is stale against the current README, which now leads with the narrower same-file Codex claim and documents the experimental TS/JS beta. Replacing that opening with the branch wording would broaden the public claim and lose current support boundaries.

Do not transplant unrelated stale-tree changes from this branch. Future README wording changes should start from the current `origin/main` README and preserve the same-file/Codex-first and Claude/opencode boundary language.
