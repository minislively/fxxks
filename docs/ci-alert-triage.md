# CI alert replay triage

`npm run --silent ci:alerts -- --alerts <file> --branch main` is read-only. It
only reads pasted alert text and GitHub Actions run metadata, then prints a
triage report.

For clawhip bursts that replay many historical green CI URLs after a merge,
compact mode keeps the current `main` head run visible and records the stale
historical replay count in `alertSummary.staleReplayCount`. It also reports
`alertSummary.actionableAlertCount` and `alertSummary.staleSuccessReplayCount`
so all-green bursts can show zero evidence needing inspection while still
counting the omitted historical successes. The omitted-count maps (`byEvidence`,
`byConclusion`) provide evidence that the collapsed rows were stale successes
rather than new failures.

When the pasted alert is the current completed `main` CI success (for example a
`git:fooks@main` notice followed by `CI passed · fooks` for the same head run),
the alert evidence remains `current` and gains `verdict: "current-main-echo"`,
`echo: true`, and `disposition: "verification-only"`. Treat that as a merge
verification echo: record it as the current main verdict, but do not re-open a
fresh development investigation unless a newer actionable/watch run appears.
Historical success URLs in the same paste stay bounded by compact mode and are
noise-counted as stale replay rows.

Offline verification example:

```sh
gh run list --limit 100 --json attempt,databaseId,status,conclusion,createdAt,updatedAt,headBranch,event,name,workflowName,url > /tmp/runs.json
pbpaste > /tmp/clawhip-alerts.txt
npm run --silent ci:alerts -- --input /tmp/runs.json --alerts /tmp/clawhip-alerts.txt --branch main --json
```
