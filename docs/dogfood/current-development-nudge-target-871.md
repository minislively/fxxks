# Current development nudge target boundary (#871)

This is a narrow read-only dogfood docs/test artifact for issue #871. It covers
what a fooks nudge should answer after PR #870 merged and the latest `main`
CI/release receipts are green: the answer must point at the current development
target evidence, not at the just-merged receipt.

## Current-target rule

When a nudge asks what is being developed, the report may describe active
current work only from current target evidence. For this issue, the current
target evidence shape is intentionally small:

1. spawned issue evidence for `#871`;
2. spawned non-`main` branch/worktree evidence for
   `dogfood/issue-871-current-development-nudge-target`;
3. mapped OMX session evidence for the worktree; and
4. the worktree evidence fields `delta`, `ahead`, and `proc` in the same report.

Merged CI/release receipts from PR #870 remain receipt-only. They can explain
why the previous work is closed, but they must not answer the current-development
question by themselves.

## Expected read-only report shape

```json
{
  "issue": "#871",
  "readOnly": true,
  "question": "what is being developed?",
  "currentDevelopmentEvidence": {
    "spawnedIssue": {
      "number": 871,
      "isCurrentTargetEvidence": true
    },
    "spawnedBranch": {
      "name": "dogfood/issue-871-current-development-nudge-target",
      "isMain": false,
      "isCurrentTargetEvidence": true
    },
    "mappedOmxSession": {
      "session": "fooks-dogfood-issue-871-current-development-nudge-target",
      "worktree": "issue-871-current-development-nudge-target",
      "isCurrentTargetEvidence": true
    },
    "delta": {
      "kind": "worktree-delta",
      "required": true,
      "meaning": "current unmerged worktree changes, not prior main receipt state"
    },
    "ahead": {
      "kind": "base-divergence",
      "required": true,
      "meaning": "current branch ahead/behind count against origin/main"
    },
    "proc": {
      "kind": "mapped-process",
      "required": true,
      "meaning": "live process/session evidence for the current worktree"
    }
  },
  "receiptOnlyEvidence": {
    "mergedPullRequest": "#870",
    "mainCiReleaseReceiptsAreCurrentDevelopmentEvidence": false
  },
  "nudgeAnswerRule": "Answer with issue #871 plus the spawned branch/session and delta/ahead/proc fields; keep PR #870 main CI/release receipts receipt-only."
}
```

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, performance claims, product
claims, cleanup authority, or release criteria. It documents and tests report
shape only.

## Focused verification

```sh
node --test test/current-development-nudge-target-doc.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```
