# Archive rationale for `codex/applied-code-evidence-closeout-20260425` (#306)

Date: 2026-04-30

## Bounded inspection

After fetching `origin/codex/applied-code-evidence-closeout-20260425` and
`origin/main`, the stale remote branch showed two branch-only commits:

- `8d1c4a7` — Record bounded R4 applied diagnostic without claim upgrade
- `952fb57` — Clarify applied-code evidence before reruns

The merge-base diff touched only these files:

- `benchmarks/layer2-frontend-task/STATUS.md`
- `docs/benchmark-evidence.md`
- `docs/release.md`

`git diff --stat origin/main...origin/codex/applied-code-evidence-closeout-20260425`
reported 3 files changed, 43 insertions, and 7 deletions. However, comparing the
branch tree directly against current `origin/main` showed 42 current-file deletes,
so replaying the branch as a tree would be destructive.

## Decision

Archive the branch instead of transplanting it. The still-relevant 2026-04-25 R4
applied-code diagnostic is already represented on `origin/main` as diagnostic-only
evidence with the same claim boundary: it is not an applied-code benchmark win,
not stable runtime-token/time proof, and not provider billing telemetry. Direct
replay would risk unrelated stale deletes while adding no narrower claim-safe
artifact than the current curated docs already contain.

No files were transplanted from the stale branch.
