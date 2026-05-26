# Issue #1077 drain-ready cutoff

This is a narrow read-only dogfood/operator artifact for Epic `#960` after
landed child evidence exists. It prevents a clean `main` checkout with only
Epic `#960` open from being reported as active development or from endlessly
spawning another child from stale unchecked epic checklist text.

## Boundary

When the current snapshot is clean `main`, has zero local divergence, has no
mapped fooks session, and the only open issue is Epic `#960`, stale epic
checklist text is not a next-child source by itself. If the operator cites
landed child evidence, the safe label is **no-new-child/drain-ready** and the
bounded next action is an operator closeout receipt for `#960`. That receipt
must say there is no active development, must name clean `main`, only `#960`
open, no child/PR/branch/session/worktree-process/blocker evidence, and
landed-child or completed-child receipt context. It must not auto-close `#960`,
mutate GitHub state, or create another child from stale checklist text.

Concrete child evidence still wins. If a current child issue, open PR,
non-`main` branch, mapped fooks session, active worktree/process evidence, or
concrete blocker exists, keep using `activeWorkReceipts.nextChildEvidenceBoundary`
rather than the drain-ready cutoff.

The guard is read-only. It does not update or close GitHub issues, create child
issues, create PRs, mutate branches, does not weaken approvals/CI/merge gates, change
provider/runtime/frontend behavior, add telemetry, or make product/billing
claims.

## Report shape

```json
{
  "issue": "#1077",
  "sourceEpic": "#960",
  "readOnly": true,
  "operatorCheckField": "activeWorkReceipts.drainReadyCutoff",
  "classification": "no-new-child-drain-ready-after-landed-child-evidence",
  "noNewChildBoundary": {
    "availableWhenLandedChildEvidenceIsCited": true,
    "createChildFromStaleChecklistText": false,
    "reportActiveDevelopmentFromEpicOnlyQueue": false,
    "drainReadyLabelAllowed": true
  },
  "closeoutReceiptBoundary": {
    "issue": "#1079",
    "activeDevelopmentEvidence": false,
    "autoCloseEpic960": false,
    "mutatesGitHub": false,
    "boundedNextAction": "write-operator-closeout-receipt-for-960-without-closing-epic"
  },
  "preservesNextChildEvidenceBehavior": {
    "concreteChildIssueOrSessionOrPrOrBlockerUsesNextChildEvidencePath": true,
    "operatorCheckJsonPath": "activeWorkReceipts.nextChildEvidenceBoundary"
  },
  "safeNextAction": "cite-landed-child-evidence-then-drain-epic-without-creating-new-child",
  "rule": "After landed child evidence, clean main with only epic #960 open is no-new-child/drain-ready, not active development and not another auto-sliced child from stale checklist text; the next action is a bounded #960 closeout receipt without closing #960 or mutating GitHub."
}
```

## Verification

```bash
git diff --check HEAD
npm run build
npm run typecheck -- --pretty false
node --test test/operator-activity.test.mjs test/drain-ready-cutoff-1077-doc.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```
