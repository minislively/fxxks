# Issue #336 Formbricks T4 N=3 evidence branch archive rationale

Date: 2026-05-01

Branch inspected: `origin/benchmark/formbricks-t4-n3-evidence`
Base inspected: `origin/main`

## Bounded inspection

The branch was inspected from current `origin/main` without checking out or
replaying its stale tree.

Branch-only commits from
`git log --oneline --reverse origin/main..origin/benchmark/formbricks-t4-n3-evidence`:

- `fba1512` `Record Formbricks T4 N3 benchmark evidence`

The merge base is `9e5be1c4a4a5b3c95ac8a08b4ac51f5d26f62597`.

The merge-base diff is narrow benchmark evidence only:

- `git diff --shortstat origin/main...origin/benchmark/formbricks-t4-n3-evidence`
  reports 3 files changed and 1,199 insertions.
- `git diff --name-status origin/main...origin/benchmark/formbricks-t4-n3-evidence`
  reports three added files:
  - `benchmarks/frontend-harness/reports/benchmark-full-1776613131.json`
  - `benchmarks/frontend-harness/reports/formbricks-t4-component-extraction-n3-20260420T011111Z/benchmark-full-1776613131-artifacts.tar.gz`
  - `benchmarks/frontend-harness/reports/formbricks-t4-component-extraction-n3-20260420T011111Z/formbricks-t4-component-extraction-decision-report.md`

Direct stale-tree replay is destructive and was not used:

- `git diff --shortstat origin/main..origin/benchmark/formbricks-t4-n3-evidence`
  reports 341 files changed, 16,387 insertions, and 33,925 deletions.
- `git diff --name-status origin/main..origin/benchmark/formbricks-t4-n3-evidence`
  reports `A:112`, `D:164`, `M:64`, and `R100:1`.
- `docs/remote-branch-audit.md` already classifies this branch as
  `destructive-stale-tree` and records that the stale branch would delete
  current Layer 2 fixtures, provider-cost import evidence, and other current
  files unrelated to this benchmark evidence.

## Current-main evidence coverage

Current `origin/main` already contains all three evidence paths from the
merge-base diff. Two files are byte-identical to the stale branch by blob hash:

| Path | Evidence status |
| --- | --- |
| `benchmarks/frontend-harness/reports/formbricks-t4-component-extraction-n3-20260420T011111Z/benchmark-full-1776613131-artifacts.tar.gz` | Exact blob match between `origin/main` and `origin/benchmark/formbricks-t4-n3-evidence`. |
| `benchmarks/frontend-harness/reports/formbricks-t4-component-extraction-n3-20260420T011111Z/formbricks-t4-component-extraction-decision-report.md` | Exact blob match between `origin/main` and `origin/benchmark/formbricks-t4-n3-evidence`. |

The JSON report is present on `origin/main`, but it is intentionally not a raw
blob match. The current-main copy redacts local absolute paths from the stale
branch to stable placeholders such as `<fooks-repo>` and `<fooks-test-repos>`.
A direct diff shows 74 changed lines, all in the 37 replacement pairs for those
local path strings.

A normalization check that replaces the stale local path prefixes with the
current placeholders reports semantic equality for the JSON document:

- `json_equal_after_path_scrub=True`
- `qualityGatedDecision=True`
- `aggregate=True`

This means the evidence content is covered on current main while avoiding the
machine-local path leakage from the stale branch JSON.

## Preserved interpretation

The preserved benchmark interpretation is the current decision report, not the
stale branch tree:

- N=3 routing verdict: `proceed-to-n5`.
- Product interpretation: promising for an ambiguous Formbricks UI component
  extraction lane, but not claimable as a public product win until an N=5
  threshold is met.
- Aggregate evidence: 3 quality-gated pairs, positive median total-time
  improvement, positive parsed runtime-token reduction, 100% fooks acceptance
  pass rate, no broader-scope regressions, and no severe token outliers.
- Boundary: do not generalize this result to exact-file tasks; earlier
  Formbricks exact-file evidence stayed mixed or negative.

Current main also cross-references this evidence from related archive rationale
for the Formbricks N=3 and benchmark-context-policy stale branches.

## Decision

Archive `origin/benchmark/formbricks-t4-n3-evidence` instead of transplanting
code, commits, generated reports, or stale-tree deletes.

Rejected alternatives:

- Full stale-branch replay: rejected because the current-tree comparison would
  delete 164 files and churn hundreds of unrelated current files.
- Cherry-picking the branch commit: rejected because the useful evidence is
  already present on `origin/main`, with the JSON improved by local path
  redaction.
- Bulk-copying generated evidence files: rejected because two evidence files are
  already exact matches and the JSON copy on main is the safer normalized
  version.
- Doing nothing: rejected because issue #336 needs an auditable archive rationale
  that distinguishes exact blob equality from normalized JSON equivalence.

No stale branch code, tests, generated reports, raw patch artifacts, diffstats,
or deletes were replayed for issue #336.

## Verification

Run before commit:

- `git diff --check`
- `git diff --name-status origin/main...HEAD`
- `git diff --diff-filter=D --name-only origin/main...HEAD`
- `grep -RIn 'formbricks-t4-n3-evidence\|Issue #336\|1776613131\|path_scrub\|proceed-to-n5' docs benchmarks/frontend-harness/reports --exclude='*.json' --exclude='*.tar.gz'`
- JSON normalization equivalence check comparing
  `origin/benchmark/formbricks-t4-n3-evidence:benchmarks/frontend-harness/reports/benchmark-full-1776613131.json`
  with `origin/main:benchmarks/frontend-harness/reports/benchmark-full-1776613131.json`
- `node scripts/audit-remote-branches.mjs --no-fetch --json`
