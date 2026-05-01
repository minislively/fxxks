# Issue #334 Formbricks N=3 quality branch archive rationale

Date: 2026-05-01

Branch inspected: `origin/benchmark/formbricks-n3-quality`
Base inspected: `origin/main`

## Bounded inspection

The branch was inspected from current `origin/main` without checking out or
replaying its tree.

Branch-only commits from `git log --oneline --reverse origin/main..origin/benchmark/formbricks-n3-quality`:

- `20ef273` `Make benchmark claims reproducible beyond one-off runs`
- `ad4d8e1` `Preserve the repeated Formbricks benchmark evidence`
- `4863bde` `Guard benchmark claims against token regressions`
- `8787fa6` `Preserve the Caps Lock follow-up benchmark evidence`

The merge-base diff is narrow benchmark evidence churn:

- `git diff --shortstat origin/main...origin/benchmark/formbricks-n3-quality`
  reports 30 files changed, 3,058 insertions, and 39 deletions.
- `git diff --name-status origin/main...origin/benchmark/formbricks-n3-quality`
  reports 27 added files and 3 modified files.
- The added files are generated benchmark JSON, patch, and diffstat artifacts
  under `benchmarks/frontend-harness/reports/` for two direct-Codex Formbricks
  N=3 runs.
- The only non-report files touched by the merge-base diff are
  `benchmarks/frontend-harness/README.md`,
  `benchmarks/frontend-harness/runners/full-benchmark-suite.py`, and
  `test/frontend-harness.test.mjs`.

Directly replaying the stale branch tree is destructive and was not used:

- `git diff --shortstat origin/main..origin/benchmark/formbricks-n3-quality`
  reports 298 files changed, 7,798 insertions, and 41,139 deletions.
- `git diff --name-status origin/main..origin/benchmark/formbricks-n3-quality`
  reports `A:53`, `M:59`, `D:185`, and `R100:1`.
- The 185 current-file deletes include current governance files
  (`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`), newer
  Formbricks T4 benchmark evidence, v2 frontend harness files, benchmark
  history/latest files, Layer 2 fixtures, and provider-cost import evidence.

## Useful branch evidence preserved

The useful branch evidence is the conservative interpretation of the April 16
Formbricks direct-Codex N=3 runs, not the raw generated artifacts or stale
runner implementation.

| Branch evidence | Preserved interpretation |
| --- | --- |
| `benchmark-full-1776325941.json` plus artifacts | Delete-account email-confirmation task: 3/3 successful paired runs and 3/3 same-target-file pairs; fooks scored lower in 1/3 acceptance pairs; median total-time improvement was -15.78%; median runtime-token reduction was +3.82%. |
| `benchmark-full-1776327829.json` plus artifacts | Login Caps Lock warning task: 3/3 successful paired runs and 3/3 same-target-file pairs; acceptance parity in 3/3 pairs; median total-time improvement was -19.91%; median runtime-token reduction was -49.75%. |
| `round1-risk-followup-1776327829.md` | Across both N=3 runs: 6/6 successful pairs, 6/6 same-file pairs, fooks lower acceptance in 1/6 pairs, median total-time improvement -17.85%, median runtime-token reduction -5.35%, and fooks used more runtime tokens in 3/6 pairs. |
| README/harness/test edits | Historical only. Current `origin/main` already documents the claim boundary and has newer benchmark policy/evidence; replaying the stale implementation would reintroduce old generated-report churn. |

This evidence supports a no-win claim boundary: the branch showed useful
file-targeting behavior on explicit single-file Formbricks tasks, but it did not
support stable direct-Codex wall-clock or runtime-token savings. The negative
runtime-token signal is important evidence for hook/context trimming and future
benchmark selection.

## Current-main evidence coverage

Current `origin/main` already preserves the actionable claim boundary in focused
docs rather than raw stale artifacts:

- `docs/benchmark-evidence.md` says the April 16 direct-Codex Formbricks
  follow-up found unstable runtime-token and time wins, with fooks using more
  runtime tokens in three of six pairs and a negative median runtime-token
  reduction.
- `docs/release.md` keeps prepared-context or proxy estimates separate from
  measured runtime-token savings and cites the same Formbricks N=3 negative
  median runtime-token result.
- `docs/benchmark-context-policy-branch-archive-331.md` records the later
  Formbricks claim-boundary decision: exact-file and Caps Lock evidence remains
  diagnostic unless quality gates and repeated task-class thresholds are met.
- `benchmarks/frontend-harness/reports/formbricks-t4-component-extraction-n3-20260420T011111Z/formbricks-t4-component-extraction-decision-report.md`
  is newer Formbricks evidence for an ambiguous component-extraction task and
  explicitly warns not to generalize that promising result to exact-file tasks.

## Decision

Archive `origin/benchmark/formbricks-n3-quality` instead of transplanting code,
generated reports, patch artifacts, or stale-tree deletes.

Rejected alternatives:

- Full stale-branch replay: rejected because the current-tree comparison would
  delete 185 tracked files from current main.
- Cherry-picking the branch commits: rejected because useful evidence is already
  represented as current claim-boundary docs, while the commits bundle generated
  report artifacts with stale harness/test edits.
- Bulk-copying generated JSON, patches, and diffstats: rejected because it would
  make old diagnostic artifacts look current without changing claimability.
- Doing nothing: rejected because branch audit needs an exact archive-doc match
  and an auditable rationale for suppressing the stale valid-candidate noise.

No stale branch code, tests, generated reports, raw patch artifacts, diffstats,
or deletes were replayed for issue #334.

## Verification

Run before commit:

- `git diff --check`
- `git diff --name-status origin/main...HEAD`
- `git diff --diff-filter=D --name-only origin/main...HEAD`
- `grep -RIn 'Formbricks N=3\|direct-Codex Formbricks\|runtime-token reduction\|origin/benchmark/formbricks-n3-quality' docs benchmarks/frontend-harness/reports --exclude='*.json' --exclude='*.tar.gz'`
- `node scripts/audit-remote-branches.mjs --no-fetch --json`
