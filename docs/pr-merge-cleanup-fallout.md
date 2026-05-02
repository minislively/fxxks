# PR merge cleanup fallout classifier

`gh pr merge --delete-branch` can merge the PR successfully and still fail its local
branch deletion step when that branch is checked out in another worktree. Treat that
pattern as recoverable post-merge cleanup fallout, not as a merge failure.

Read-only check:

```sh
gh pr merge 351 --delete-branch 2>&1 | tee /tmp/pr-351-merge.txt
npm run --silent pr:merge-cleanup -- --input /tmp/pr-351-merge.txt --json
```

A transcript with merge-success evidence plus `failed to delete local branch` /
`checked out at ...` should return `classification:
"recoverable-post-merge-cleanup-fallout"` and `disposition: "do-not-retry-merge"`.
Cleanup should happen separately from the worktree that has the branch checked out
(or after switching that worktree to another branch).
