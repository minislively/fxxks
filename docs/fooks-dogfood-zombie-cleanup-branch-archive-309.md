# Archive rationale for `fooks-dogfood-zombie-cleanup` (#309)

Date: 2026-04-30

## Bounded inspection

After fetching `origin/fooks-dogfood-zombie-cleanup` and `origin/main`, the stale
remote branch showed one branch-only commit:

- `b4ed5e5` — feat(doctor): add worktree and tmux session health checks

The merge base with current main is `133a72f27ccb05c183d6efb85a8ff3f30d3918bc`.
The branch-only diff from that merge base touched only `src/cli/doctor.ts` and
reported 1 file changed with 112 insertions.

Directly comparing the stale branch tree against current `origin/main` is
therefore not safe to replay: `git diff --shortstat
origin/main..origin/fooks-dogfood-zombie-cleanup` reported 100 files changed, 218
insertions, and 7920 deletions. The current tree comparison also reported 46
deleted files, including current documentation and tests.

## Decision

Archive the branch instead of replaying or merging it. The useful idea from
`b4ed5e5` is already represented on current main in `src/cli/doctor.ts`: operator
worktree and tmux session health checks exist there, are bounded to doctor output,
and are guarded behind `FOOKS_OPERATOR=1` so normal doctor runs stay focused on
project/runtime readiness.

No files were transplanted from the stale branch.
