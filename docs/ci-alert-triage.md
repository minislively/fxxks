# CI alert replay triage

`npm run --silent ci:alerts -- --alerts <file> --branch main` is read-only. It
only reads pasted alert text and GitHub Actions run metadata, then prints a
triage report.

For clawhip bursts that replay many historical green CI URLs after a merge,
compact mode keeps the current `main` head run visible and records the stale
historical replay count in `alertSummary.staleReplayCount`. The omitted-count
maps (`byEvidence`, `byConclusion`) provide evidence that the collapsed rows
were stale successes rather than new failures.

Offline verification example:

```sh
gh run list --limit 100 --json attempt,databaseId,status,conclusion,createdAt,updatedAt,headBranch,event,name,workflowName,url > /tmp/runs.json
pbpaste > /tmp/clawhip-alerts.txt
npm run --silent ci:alerts -- --input /tmp/runs.json --alerts /tmp/clawhip-alerts.txt --branch main --json
```
