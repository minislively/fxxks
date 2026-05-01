# Issue #331 benchmark-context-policy stale-branch archive rationale

Date: 2026-05-01

Branch inspected: `origin/ralph/benchmark-context-policy`
Base inspected: `origin/main`

## Bounded evidence

Fetched refs before inspection:

- `git fetch origin ralph/benchmark-context-policy main`

`git log --oneline origin/main..origin/ralph/benchmark-context-policy` reports three branch-only commits:

- `d401306` `Measure ambiguous Formbricks claims under quality gates`
- `967daa7` `Gate benchmark wins on artifact quality`
- `3c7d176` `Separate product claims from benchmark quality risk`

`git diff --stat origin/main...origin/ralph/benchmark-context-policy` reports 69 files changed with 6,474 insertions and 15 deletions. The merge-base diff is mostly added Formbricks benchmark reports/artifacts plus changes to:

- `benchmarks/frontend-harness/runners/full-benchmark-suite.py`
- `test/frontend-harness.test.mjs`

Merge-base file delete count is zero:

- `git diff --name-status origin/main...origin/ralph/benchmark-context-policy | awk '$1 ~ /^D/ {c++} END {print c+0}'` -> `0`

The current-tree comparison is destructive because the branch is stale relative to current `origin/main`:

- `git diff --name-only --diff-filter=D origin/main..origin/ralph/benchmark-context-policy | wc -l` -> `171`
- `git diff --shortstat origin/main..origin/ralph/benchmark-context-policy` -> `360 files changed, 14949 insertions(+), 36902 deletions(-)`
- Current-tree name-status counts: `A 124`, `D 171`, `M 64`, `R 1`

## Still-relevant evidence preserved

The branch records useful benchmark-context policy evidence, but the useful part is the decision read rather than the stale code/tree state:

- Exact-file first-turn tasks should not be used as acceleration claims yet. The branch evidence says the no-op/bypass policy can reduce avoidable preparation overhead, but exact-file timing/token outcomes remained mixed or negative and still needed repeated quality parity.
- Ambiguous Formbricks login discovery was promising only before quality gates. The N=5 quality-gated report showed raw median total-time improvement of `+12.59%` and raw median runtime-token reduction of `+3.62%`, but fooks artifact acceptance passed only `2/5` runs.
- Quality-gated pairs collapsed to `N=2`; their median total-time improvement was `-0.99%` and median runtime-token reduction was `-20.11%`. Fully claimable positive pairs were `1/5`.
- Scope and accessibility gates are required. The branch evidence caught one fooks run broadening from 2 files to 15 files and recurring missing accessible announcement failures.
- Product claims must use actual Codex runtime tokens, not proxy compression estimates; the branch explicitly warns that proxy context compression and runtime-token savings diverged.

## Decision

Archive `origin/ralph/benchmark-context-policy` rather than transplanting its patch set.

The relevant conclusion is already compatible with current mainline benchmark boundaries: direct-Codex runtime-token/time claims remain gated by quality, scope parity, and actual runtime tokens. The stale branch also contains large generated benchmark reports and code/test edits from April 17, 2026; replaying the branch tree onto current `origin/main` would delete 171 current files. No benchmark harness code, generated reports, or unrelated stale deletes were transplanted for issue #331.

## Verification

Run before commit:

- `git diff --check`
- `git diff --name-only origin/main..HEAD`
- `git diff --stat origin/main..HEAD`
