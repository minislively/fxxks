# Stale closed-artifact worktree cleanup-review evidence (#918)

This is a narrow read-only dogfood artifact for issue #918. It records the two
legacy closed-artifact worktrees still reported after PR #917 / issue #916
landed and `main` was updated to `1162cb1`.

The artifact is cleanup-review evidence only. It is not active work evidence,
not cleanup authority, and not a command sheet.

## Captured current state

- current branch: `main`
- current head: `1162cb1`
- open issue count: `0`
- open pull request count: `0`
- current worktree: clean
- local divergence: ahead `0`, behind `0`
- ancestor tmux maintenance panes: no longer counted as active after #916
- exact-cwd fooks tmux sessions: still active-or-unknown current-session evidence
- stale closed-artifact worktree count: `2`

## Cleanup-review candidates

| Worktree path | Branch | Head | Archive evidence | Active session evidence |
| --- | --- | --- | --- | --- |
| `/Users/veluga/Documents/Workspace_Minseol/fooks-fixture-expectation-lock` | `docs/frontend-domain-fixture-expectation-lock` | `525aa0e1bb65e9ba519957df8aed112362f3227f` | `docs/frontend-domain-fixture-expectation-lock-branch-archive-340.md:5` | no tmux panes mapped to this worktree |
| `/Users/veluga/Documents/Workspace_Minseol/fooks-manifest-shape-guard` | `docs/frontend-domain-manifest-shape-guard` | `8143b7b3b81e53ab0b789efd0005df6113281cf2` | `docs/frontend-domain-manifest-shape-guard-branch-archive-342.md:5` | no tmux panes mapped to this worktree |

Both entries have the same conservative reasons:

- branch has local branch-archive evidence;
- no tmux panes map to this worktree;
- worktree is not the current working directory;
- `manualCleanupCommands: []`.

## Read-only report shape

```json
{
  "issue": "#918",
  "readOnly": true,
  "source": "fooks status artifacts staleClosedArtifactWorktrees after #916",
  "cleanupCommandsIncluded": false,
  "cleanupAuthorityGranted": false,
  "activeWorkEvidence": false,
  "candidates": [
    {
      "path": "/Users/veluga/Documents/Workspace_Minseol/fooks-fixture-expectation-lock",
      "branch": "docs/frontend-domain-fixture-expectation-lock",
      "head": "525aa0e1bb65e9ba519957df8aed112362f3227f",
      "status": "staleClosedArtifact",
      "archiveEvidence": "docs/frontend-domain-fixture-expectation-lock-branch-archive-340.md:5",
      "activeSessionEvidence": "no tmux panes mapped to this worktree",
      "manualCleanupCommands": []
    },
    {
      "path": "/Users/veluga/Documents/Workspace_Minseol/fooks-manifest-shape-guard",
      "branch": "docs/frontend-domain-manifest-shape-guard",
      "head": "8143b7b3b81e53ab0b789efd0005df6113281cf2",
      "status": "staleClosedArtifact",
      "archiveEvidence": "docs/frontend-domain-manifest-shape-guard-branch-archive-342.md:5",
      "activeSessionEvidence": "no tmux panes mapped to this worktree",
      "manualCleanupCommands": []
    }
  ],
  "decision": {
    "treatAsCleanupReviewEvidence": true,
    "treatAsCurrentActiveWork": false,
    "runCleanupAutomatically": false,
    "operatorRule": "Preserve these two worktrees as cleanup-review evidence until a human explicitly decides whether to remove local residue. Do not present them as active development and do not run cleanup commands from this artifact."
  }
}
```

## Operator reading order

1. Read live active anchors first: open issue, open PR, current non-main branch,
   mapped exact-cwd fooks tmux session, mapped process, or concrete blocker.
2. Read these two worktrees as stale closed-artifact cleanup-review candidates.
3. If an operator later chooses to clean local residue, verify the worktree is
   still inactive and decide cleanup outside this artifact.
4. Do not convert this artifact into automatic cleanup behavior.

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, product claims, performance
claims, `fooks status artifacts` output shape, `fooks check` verdict policy,
cleanup authority, branch deletion policy, worktree deletion policy, or tmux
session cleanup policy. It documents and tests the operator cleanup-review
boundary only.
