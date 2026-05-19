# Bulk CI replay clean-main echo boundary (#968)

This is a narrow read-only dogfood docs/test/operator artifact for issue #968.
It addresses the dogfood pain point where, after PR #967 merged clean, clawhip
replayed a bulk batch of historical CI success URLs while the current `main`
CI and release-report receipts were already green.

## Strict check/reporting rule

For strict `fooks check` reporting, a bulk batch of historical successful CI URLs
is a replay echo, not active work evidence. Collapse the batch into one
receipt-only echo lane and keep it separate from current active artifact
evidence.

The operator report must therefore:

1. Treat historical successful CI URLs from the clawhip bulk replay as echo
   receipts when current `main` CI/Release are already green.
2. Keep the latest exact-head `main` CI/Release green receipt visible as
   verification-only provenance.
3. Require active artifact evidence before claiming current dogfood work:
   an open issue, open PR, mapped fooks tmux/proc session, or the narrower
   handoff-only live worktree evidence already documented by issue #885.
4. Never let the replay batch satisfy the top-level `requiredActiveArtifact`
   contract by itself.

This artifact is intentionally operator/reporting-only. It does not implement
#962 or #963, does not change merge-gate policy, does not alter CI workflows,
does not change runtime hooks or provider behavior, and makes no broad product,
performance, billing, or runtime-token claims.

## Expected read-only report shape

```json
{
  "issue": "#968",
  "readOnly": true,
  "question": "collapse bulk historical CI success replay after PR #967 clean merge and require active artifact evidence",
  "sourcePullRequest": "#967",
  "event": {
    "afterCleanMerge": true,
    "clawhipBulkReplay": true,
    "historicalCiSuccessUrls": "many",
    "currentMainCiAndReleaseAlreadyGreen": true
  },
  "classification": {
    "bulkReplayLane": "receipt-only-echo",
    "currentMainGreenLane": "verification-only-provenance",
    "activeArtifactLane": "required-before-current-work-claim"
  },
  "strictFooksCheckDecision": {
    "collapseBulkHistoricalSuccessUrls": true,
    "bulkReplaySatisfiesRequiredActiveArtifact": false,
    "currentMainGreenReceiptSatisfiesRequiredActiveArtifact": false,
    "requiresActiveArtifactEvidence": true,
    "acceptableTopLevelActiveArtifacts": [
      "open GitHub issue",
      "open GitHub pull request",
      "mapped fooks tmux session"
    ],
    "handoffOnlyLiveWorktreeEvidence": "allowed only under the issue #885 nested handoff artifact boundary"
  },
  "currentRunEvidence": {
    "adoptedIssue": "#968",
    "adoptedBranch": "dogfood/issue-968-bulk-ci-replay-clean-main",
    "mappedSession": "fooks-dogfood-issue-968-bulk-ci-replay-clean-main",
    "worktree": "/home/bellman/Workspace/fooks.omx-worktrees/issue-968-bulk-ci-replay-clean-main",
    "deltaAheadProcRequired": true
  },
  "prohibitedReportAnchors": [
    "bulk historical CI success URL replay",
    "prior clean merge receipt",
    "current main CI green receipt alone",
    "release-report green receipt alone",
    "generic idle status summary"
  ],
  "operatorRule": "When clawhip replays a bulk batch of historical successful CI URLs after PR #967 merged clean and current main CI/Release are already green, strict fooks check/reporting collapses the batch as receipt-only echo. Report the current green main receipt as verification-only provenance, then name active artifact evidence before claiming current work; the replay batch never satisfies requiredActiveArtifact by itself."
}
```

## Operator reading order

1. Confirm the alert batch is a clawhip replay of historical successful CI URLs.
2. Confirm current exact-head `main` CI and release-report receipts are green.
3. Collapse the historical success URLs into one receipt-only echo lane.
4. Check whether an open issue, open PR, or mapped fooks tmux/proc session is
   present for the current run.
5. If active artifact evidence is absent, strict `fooks check` must report that
   active artifact evidence is required instead of answering with the replayed
   green URLs.

## Non-goals

This artifact does not implement issue #962, issue #963, stale detection,
automatic handoff generation, merge-gate policy, CI workflow behavior, runtime
hook/provider behavior, React Web/RN/TUI/WebView behavior, cleanup authority,
product claims, performance claims, billing proof, or runtime-token evidence. It
documents and tests the strict `fooks check` operator/reporting boundary only.

## Focused verification

```sh
node --test test/bulk-ci-replay-clean-main-doc.test.mjs test/ci-alert-triage.test.mjs test/operator-activity.test.mjs
```
