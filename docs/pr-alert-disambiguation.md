# PR alert disambiguation guard

Clawhip/relay-style alert text can describe a `fooks#NNN` close/comment as PR work even when GitHub stores that number as an ordinary issue. Before running PR recovery, classify each referenced number through GitHub's issues API shape:

- `pull_request` present: safe to continue PR-specific handling.
- `pull_request` absent: stop PR recovery and treat it as an issue event.
- Alert says `PR fooks#NNN <new> -> merged` and GitHub already reports the PR as merged: treat it as a verification-only echo, not fresh actionable PR recovery.
- Optional `--pr-evidence` rows can mark an open PR as `duplicate-post-merge` only when the linked issue is already closed by another PR, same-title or overlapping-file evidence is supplied, and the current head is dirty/not mergeable. Treat that as operator cut/close guidance, not automatic close authority or merge recovery.

The guard is read-only. It never comments, closes, reopens, deletes branches, or changes worktrees.

## Offline/replay check

```sh
gh api repos/minislively/fooks/issues/226 > /tmp/fooks-226.json
printf 'clawhip/relay surfaced fooks#226 as PR closed/commented\n' > /tmp/alerts.txt
npm run --silent pr:alerts -- --repo minislively/fooks --alerts /tmp/alerts.txt --events /tmp/fooks-226.json --json
```

For issue-only payloads like `fooks#226`, expect `kind: "issue"` and `prHandling: "skip"`.

## Live read-only check

```sh
npm run --silent pr:alerts -- --repo minislively/fooks --alerts /tmp/alerts.txt
```

This invokes `gh api repos/<owner>/<repo>/issues/<number>` for each matching alert reference and prints a small markdown report. Use rows with `prHandling=skip` as a hard stop before any PR recovery workflow. Use `prHandling=echo` rows only to verify the already-merged GitHub state; do not start fresh PR recovery from that alert.

## Post-merge duplicate reopen evidence

When dogfood alerts mention reopened duplicate PRs after the linked issue has already been closed by a merged PR, attach saved PR-ish evidence with `--pr-evidence`. The guard remains read-only: `operator-close-candidate` / `cut-duplicate-pr` means preserve the evidence and use the explicit operator close flow if appropriate. It never comments, closes, reopens, deletes branches, or weakens merge-gate checks.

The markdown report includes an `Operator duplicate PR cut evidence` section for every PR with supplied duplicate evidence. For #768/#769-style duplicates, expect concise lines covering:

- linked issue closed state;
- closing PR number and merged state;
- same-title and/or overlapping-file duplicate signals;
- dirty/not-mergeable current PR head;
- the read-only action boundary.

Example dogfood command shape:

```sh
npm run --silent pr:alerts -- \
  --repo minislively/fooks \
  --alerts /tmp/fooks-duplicate-alerts.txt \
  --events /tmp/fooks-issues-768-769.json \
  --pr-evidence /tmp/fooks-pr-768-769-evidence.json
```

Treat `cut-duplicate-pr` as a conservative operator recommendation, not an automated mutation. Treat `do-not-cut` as insufficient evidence and continue normal PR triage.
