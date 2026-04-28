# PR alert disambiguation guard

Clawhip/relay-style alert text can describe a `fooks#NNN` close/comment as PR work even when GitHub stores that number as an ordinary issue. Before running PR recovery, classify each referenced number through GitHub's issues API shape:

- `pull_request` present: safe to continue PR-specific handling.
- `pull_request` absent: stop PR recovery and treat it as an issue event.

The guard is read-only. It never comments, closes, reopens, deletes branches, or changes worktrees.

## Offline/replay check

```sh
gh api repos/minislively/fooks/issues/226 > /tmp/fooks-226.json
printf 'clawhip/relay surfaced fooks#226 as PR closed/commented\n' > /tmp/alerts.txt
npm run --silent pr:guard -- --repo minislively/fooks --alerts /tmp/alerts.txt --events /tmp/fooks-226.json --json
```

For issue-only payloads like `fooks#226`, expect `kind: "issue"` and `prHandling: "skip"`.

## Live read-only check

```sh
npm run --silent pr:guard -- --repo minislively/fooks --alerts /tmp/alerts.txt
```

This invokes `gh api repos/<owner>/<repo>/issues/<number>` for each matching alert reference and prints a small markdown report. Use rows with `prHandling=skip` as a hard stop before any PR recovery workflow.
