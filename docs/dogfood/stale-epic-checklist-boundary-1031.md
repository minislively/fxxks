# Issue #1031 stale epic checklist boundary

This is a narrow read-only dogfood docs/test/helper guard for issue #1031. It
bounds stale unchecked checklist text in the open #960 epic so it cannot be used
as active next-work authority by itself after PR #1030.

## Pain captured

After PR #1030, only epic `#960` is open, but the epic body can still contain
unchecked or possible slices that were already represented by closed child issues
such as long-run budget warning `#988`. A dogfood nudge that treats that old
unchecked prose as current work has to manually re-search siblings and can start
a duplicate session for work that is already closed.

## Guard rule

Unchecked epic checklist text is **advisory** unless the candidate slice is
backed by at least one current evidence source:

1. an open child issue for the slice;
2. a non-stale active branch or worktree for the slice;
3. a live mapped session for the slice;
4. an open PR for the slice; or
5. an exact duplicate search showing whether the same slice already exists or
   closed under the same wording.

Closed child issues are receipts, not active next-work anchors. For example,
closed issue `#988` may explain why a long-run budget warning checklist item is
already covered, but it does not make unchecked #960 body text current work.

When none of the five current evidence sources exists, report the checklist row
as `epic-checklist-advisory-only`, perform sibling/duplicate inspection before
choosing next work, and do not spawn a new duplicate branch/session from the epic
body text alone.

## Expected read-only report shape

```json
{
  "issue": "#1031",
  "readOnly": true,
  "question": "bound stale unchecked #960 checklist text before selecting active next work",
  "sourceEpic": "#960",
  "postPr1030OpenIssueInventory": ["#960"],
  "staleChecklistExample": {
    "text": "long-run budget warning slice",
    "closedChildIssue": "#988",
    "closedChildIssueIsActiveNextWork": false
  },
  "operatorDecision": {
    "classification": "epic-checklist-advisory-only",
    "uncheckedEpicChecklistTextIsAdvisory": true,
    "activeNextWorkRequiresOneOf": [
      "open-child-issue",
      "active-branch-or-worktree",
      "live-mapped-session",
      "open-pull-request",
      "exact-duplicate-search"
    ],
    "duplicateSessionRisk": "elevated-until-sibling-search",
    "rule": "Unchecked epic checklist text is advisory unless backed by an open child issue, active branch/session, open PR, or exact duplicate search."
  }
}
```

## Non-goals

This guard changes only read-only dogfood operator classification docs, a test,
and a helper. It does not mutate GitHub issues automatically, change merge
policy, provider/runtime hooks, telemetry, billing/token proof, detector scope,
frontend behavior, product claims, issue closure policy, or release criteria.

## Focused verification

```sh
node --test test/stale-epic-checklist-boundary.test.mjs
```
