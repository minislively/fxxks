# Issue #331 benchmark-context-policy branch archive rationale

Date: 2026-05-01

Branch inspected: `origin/ralph/benchmark-context-policy`
Base inspected: `origin/main`

## Bounded evidence

Fetched refs before inspection:

- `git fetch origin main ralph/benchmark-context-policy --prune`

`git log --oneline origin/main..origin/ralph/benchmark-context-policy` reports three branch-only commits:

- `d401306` `Measure ambiguous Formbricks claims under quality gates`
- `967daa7` `Gate benchmark wins on artifact quality`
- `3c7d176` `Separate product claims from benchmark quality risk`

The merge-base diff is benchmark-heavy and stale-branch-local:

- `git diff --stat origin/main...origin/ralph/benchmark-context-policy`
  reports 69 files changed, 6,474 insertions, and 15 deletions.
- The added files are generated Formbricks benchmark reports, logs, patches,
  and summaries under:
  - `benchmarks/frontend-harness/reports/post-policy-20260417/`
  - `benchmarks/frontend-harness/reports/risk-reduction-20260417/`
  - `benchmarks/frontend-harness/reports/ambiguous-n5-20260417/`
- The only source/test files touched by the merge-base diff are
  `benchmarks/frontend-harness/runners/full-benchmark-suite.py` and
  `test/frontend-harness.test.mjs`.

Directly replaying the stale branch tree is destructive and was not used:

- `docs/remote-branch-audit.md` classifies `ralph/benchmark-context-policy` as
  `destructive-stale-tree` with 151 current-file deletes.
- A local inspect-only tree comparison showed 171 deletes in
  `git diff --name-status origin/main..origin/ralph/benchmark-context-policy`,
  including current benchmark evidence, v2 runner, Layer 2 fixtures, package,
  and governance files.

## Formbricks evidence classification

The branch-only Formbricks artifacts were inspected with targeted `git show`
commands rather than a branch checkout or patch replay.

| Branch evidence | Classification | Rationale |
| --- | --- | --- |
| `post-policy-20260417/decision-matrix.md` | Already represented on `main` as claim-boundary evidence | It says exact-file first-turn edits were still not an acceleration claim and ambiguous Caps Lock evidence was promising but unstable. Current `docs/benchmark-evidence.md` and `docs/release.md` already document unstable/negative direct-Codex Formbricks runtime-token and time evidence and block stable runtime-token/time claims. |
| `risk-reduction-20260417/risk-reduction-summary.md` | Unique but historical/non-actionable | It documents exact-file bypass mechanics and an acceptance scorer, but the smoke result still regressed on time/tokens and failed accessibility. Current main has newer claim gates and benchmark-report conventions; replaying the stale runner/test implementation would reintroduce old harness shape. |
| `ambiguous-n5-20260417/ambiguous-n5-summary.md` | Still relevant as diagnostic history, but not actionable enough to transplant generated artifacts | The N=5 Caps Lock ambiguous slice is explicitly not public-claimable: fooks artifact acceptance passed 2/5, quality-gated pairs left only N=2, quality-gated runtime-token median regressed, and only 1/5 pairs were fully claimable positive. This supports the same conservative boundary already present on main. |
| Raw JSON/log/patch/diffstat artifacts under the same report directories | Historical only | They are useful for forensic inspection on the stale branch, but copying dozens of generated artifacts would make old evidence look current and add artifact bloat without changing claimability. |
| `full-benchmark-suite.py` and `frontend-harness.test.mjs` edits | Not transplanted | The branch implementation is stale relative to current benchmark harness and report policy. Current main already carries newer report evidence, source-filtering, Layer 2, and claim-boundary docs. |

## Minimal preserved evidence

The only still-relevant Formbricks ambiguous evidence preserved in this branch is
this archive summary:

- The April 17 Caps Lock ambiguous N=5 slice was diagnostic-only.
- Raw medians were directionally positive, but quality gates collapsed the usable
  denominator to two pairs.
- Fooks passed artifact acceptance only 2/5 times, broadened scope once, and had
  accessibility failures.
- Quality-gated median runtime-token reduction was negative, and only one of five
  pairs was fully claimable positive.
- Therefore the evidence reinforces a conservative product boundary: do not claim
  stable runtime-token, wall-clock, provider usage/billing-token, or broad
  benchmark wins from this stale branch.

Current main also contains a later Formbricks T4 component-extraction N=3 report
at
`benchmarks/frontend-harness/reports/formbricks-t4-component-extraction-n3-20260420T011111Z/formbricks-t4-component-extraction-decision-report.md`.
That report is newer and promising, but it is also explicitly not a public
product win until an N=5 threshold is met. It does not make the older Caps Lock
N=5 artifacts actionably missing.

## Decision

Archive `origin/ralph/benchmark-context-policy` instead of transplanting code,
commits, generated reports, or stale-tree deletes.

Rejected alternatives:

- Full stale-branch replay: rejected because the tree comparison is destructive
  and would delete current benchmark, Layer 2, package, and governance files.
- Cherry-picking selected commits: rejected because the commits bundle stale
  harness/test implementation with generated artifacts, while the still-useful
  evidence is diagnostic and already bounded by current docs.
- Bulk-copying generated reports: rejected because it would preserve old raw
  artifacts as if they were current evidence without improving claimability.
- Doing nothing: rejected because issue #331 needs an auditable closure trail for
  why the branch was archived.

No stale branch code, tests, generated benchmark reports, raw logs, patches,
diffstats, or deletes were replayed for issue #331.

## Verification

Run before commit:

- `git diff --check`
- `git diff --name-status origin/main...HEAD`
- `git diff --diff-filter=D --name-only origin/main...HEAD`
- `grep -RIn "benchmark-context-policy\|ambiguous-n5\|Formbricks" docs benchmarks/frontend-harness/reports --exclude='*.json' --exclude='*.tar.gz'`
- `node --test test/frontend-harness.test.mjs`
