# Issue #1025 worktree cwd focused-test guard

This is a read-only dogfood guard for the #960 reliability/session-handoff lane.
It documents one operator failure mode only: a focused React Web status test in an
issue worktree must be invoked from that same worktree's repository root.

## Guarded failure mode

Do not run a focused test by staying in the root checkout and passing an absolute
path into an issue worktree, for example:

```sh
# Wrong for worktree verification: cwd is the root checkout, test path is another worktree.
node --test /path/to/issue-worktree/test/react-web-status-surface.test.mjs
```

`react-web-status-surface.test.mjs` intentionally treats `process.cwd()` as the
repo root under verification so it reads the `dist/` build output for that cwd.
A root-cwd cross-worktree invocation can therefore test the root checkout's
`dist/` while loading the issue worktree's test file, creating a false local
failure that should not be classified against the issue branch.

## Required operator shape

Run the build and focused test from the worktree cwd being verified:

```sh
cd /path/to/issue-worktree
npm run build
node --test test/react-web-status-surface.test.mjs
```

If the guard trips, rerun from the expected cwd before reporting branch health,
writing a handoff, or deciding whether the #960 reliability/session-handoff
surface regressed.

## Boundary

This changes only test/operator verification guidance. It does not change product
runtime behavior, provider hooks, merge policy, telemetry, billing/token proof,
or frontend detector scope.
