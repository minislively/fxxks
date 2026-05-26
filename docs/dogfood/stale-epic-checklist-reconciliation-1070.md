# Issue #1070 stale epic checklist reconciliation

This is a narrow read-only dogfood guard for Epic `#960` after the next-child
status cue landed. It prevents stale unchecked epic checklist text from becoming
active development or drain authority when the current repository state is clean
`main` with only the organizing epic open.

## Boundary

A clean post-merge snapshot with only Epic `#960` open is still idle when no
current child issue, branch, session, PR, worktree/process evidence, or concrete
blocker is named. Old unchecked checklist rows in the epic body are advisory
planning history unless they are reconciled with landed child evidence and a
current active artifact.

The guard is read-only. It does not update or close GitHub issues, does not
create child issues, does not create PRs, does not mutate branches, does not
change CI or merge authority, does not alter runtime or provider behavior, does
not add telemetry, and does not make product/billing claims.

Archived #1070 summary: stale unchecked #960 checklist text remains advisory
until landed child evidence and current child/branch/session/PR/worktree-process/blocker
evidence are named.

## Required evidence before #960 can be treated as drainable

- closed child issue receipt;
- merged child pull request receipt;
- operator closeout receipt naming the completed child;
- current next-child evidence: child issue, PR, non-main branch, mapped fooks
  session, active worktree/process evidence, or concrete blocker.

## Report shape

```json
{
  "issue": "#1070",
  "sourceEpic": "#960",
  "readOnly": true,
  "operatorCheckField": "activeWorkReceipts.epicStaleChecklistReconciliation",
  "classification": "stale-epic-checklist-action-required",
  "staleChecklistTextAuthority": "advisory",
  "canDrainEpic": false,
  "canReportActiveDevelopment": false,
  "safeNextAction": "name-landed-child-evidence-and-open-or-adopt-current-active-artifact",
  "duplicateWorkRisk": "elevated-until-current-child-evidence",
  "requiredBeforeDrain": [
    "closed child issue receipt",
    "merged child pull request receipt",
    "operator closeout receipt naming the completed child",
    "next child issue",
    "open pull request",
    "non-main branch",
    "mapped fooks tmux session",
    "active worktree or process evidence",
    "concrete blocker"
  ],
  "rule": "A clean main snapshot with only epic #960 open and stale unchecked checklist text cannot be reported as active development or drained from the epic body alone."
}
```

## Verification

```bash
git diff --check HEAD
npm run build
npm run typecheck -- --pretty false
node --test test/operator-activity.test.mjs test/stale-epic-checklist-boundary.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs test/status-activity-receipt-docs.test.mjs
```
