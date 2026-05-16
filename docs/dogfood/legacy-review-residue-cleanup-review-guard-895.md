# Legacy review residue cleanup-review guard (#895)

This is a narrow read-only dogfood docs/test/operator guard for issue #895.
It covers the post-PR #894 clean-merge state where raw local
`fooks.omx-worktrees` inventory still shows eight legacy review/refresh
worktrees, while current active anchors are absent:

- open PR count: `0`
- open issue count: `0`
- mapped fooks tmux session count: `0`
- mapped `/proc` worktree process count: `0`
- `worktree:audit` scoped stale-review candidates: `0`
- `worktree:audit` scoped entries: `1` keep/root entry
- `worktree:audit.linkedIssue`: `#854`
- nested orphan-triage `linkedIssue`: `#711`

The eight legacy review/refresh worktrees are actionable operator residue for
cleanup-review evidence. They are not current active anchors and must not be
rediscovered manually on every nudge as if they were live development.

## Boundary rule

Keep these two lanes separate:

1. **Cleanup-review evidence lane**: raw legacy review/refresh worktree residue,
   cleanup-review row counts, and manual operator review classification. This
   lane is actionable residue evidence only.
2. **Current active anchor lane**: live issue, live PR, non-main active branch,
   mapped fooks tmux session, mapped `/proc` worktree process, or a concrete
   blocker. Only this lane may justify an active development claim.

`worktree:audit` metadata is provenance, not an active anchor. A scoped
`staleReviewCandidates=0` result and a single keep/root entry do not erase the
raw local residue count, and linked issues `#854` / `#711` remain audit IDs.

## Captured read-only report shape

```json
{
  "issue": "#895",
  "readOnly": true,
  "question": "separate legacy review residue cleanup-review evidence from current active anchors after PR #894",
  "observedAfterCleanup": "PR #894 clean merge",
  "cleanupReviewEvidence": {
    "rawLocalFooksWorktreeInventory": {
      "source": "git worktree list --porcelain over fooks.omx-worktrees",
      "legacyReviewRefreshWorktreeCount": 8,
      "classification": "actionable-operator-residue-cleanup-review",
      "isCurrentActiveAnchor": false
    },
    "operatorCheckProjection": {
      "source": "fooks check activeWorkReceipts.legacyReviewResidueCleanupReviewGuard",
      "classification": "operator-cleanup-review-evidence",
      "actionableOperatorResidue": true,
      "cleanupCommandsIncluded": false
    }
  },
  "currentActiveAnchorEvidence": {
    "openPullRequests": 0,
    "openIssues": 0,
    "mappedFooksTmuxSessions": 0,
    "mappedProcWorktreeProcesses": 0,
    "activeAnchorPresent": false,
    "allowedActiveAnchorKinds": ["live-issue", "live-pr", "live-branch", "live-tmux", "live-proc", "concrete-blocker"]
  },
  "auditScopedEvidence": {
    "command": "worktree:audit",
    "staleReviewCandidates": 0,
    "entries": 1,
    "entryScope": "keep/root",
    "linkedIssue": "#854",
    "triageLinkedIssue": "#711",
    "isCurrentActiveAnchor": false,
    "operatorMeaning": "audit provenance and scoped stale-candidate result; does not erase raw local cleanup-review residue"
  },
  "decision": {
    "legacyReviewResidueIsCleanupReviewEvidence": true,
    "legacyReviewResidueSatisfiesActiveAnchorRequirement": false,
    "auditLinkedIssuesAreActiveAnchors": false,
    "nudgeRule": "Report the eight legacy review/refresh worktrees once as cleanup-review residue evidence; with open PR/issue/tmux/proc anchors at zero, do not rediscover or present them as current active work. Name a distinct live issue, branch, session, PR, proc target, or concrete blocker before claiming active development."
  }
}
```

## Operator reading order

1. Read live active anchors first: open issue, open PR, non-main active branch,
   mapped tmux, mapped `/proc`, or concrete blocker.
2. Read the #895 cleanup-review guard for raw legacy review/refresh residue as
   actionable operator residue only.
3. Read `worktree:audit` `#854` and nested `#711` as audit provenance only.
4. If live anchors remain zero, do not answer with the residue bucket as current
   work; report it as cleanup-review evidence and require a distinct live anchor
   before active-development claims.

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, product claims, performance
claims, duplicate-guard detection, `worktree:audit` output shape, nested orphan
triage output shape, `fooks check` verdict policy, cleanup authority, or
branch/worktree deletion policy. It documents and tests the operator reporting
boundary only.

## Focused verification

```sh
npm run build
node --test test/legacy-review-residue-cleanup-review-guard-doc.test.mjs test/operator-activity.test.mjs
```
