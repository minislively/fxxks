# Worktree audit scope mismatch boundary (#879)

This is a narrow read-only dogfood docs/test artifact for issue #879. It covers
an operator-boundary mismatch seen after the PR #878 cleanup: `fooks check` could
look clean-slate, a duplicate guard could still count legacy local fooks
worktree paths, and `worktree:audit` could report zero stale-review candidates
because its entries were scoped to keep/root evidence. Operators must not merge
those surfaces into one active-work signal.

## Boundary rule

Report these fields separately:

1. **Raw git worktree inventory**: unscoped `git worktree list --porcelain`
   counts and legacy local path counts. This is residue inventory only.
2. **Audit scoped inventory**: `worktree:audit` entries, categories, and
   `staleReviewCandidates`. This is the audit tool's scoped review surface only.
3. **Runtime evidence**: tmux/session and `/proc` cwd/process evidence. This is
   active only when it maps to a live issue/branch/session target.
4. **Repository counts**: open PR and open issue counts. These counts remain
   separate from raw local residue and from audit categories.

Only live issue, branch, session, PR, or process evidence is active work. Raw
legacy worktree paths and scoped audit keep/root entries are not active work by
themselves.

## Captured read-only report shape

```json
{
  "issue": "#879",
  "readOnly": true,
  "question": "separate raw worktree residue from scoped audit and active-work evidence",
  "observedAfterCleanup": "PR #878 cleanup",
  "operatorBoundary": {
    "separateFieldsRequired": [
      "rawGitWorktreeInventory",
      "auditScopedInventory",
      "runtimeEvidence",
      "repositoryCounts"
    ],
    "activeWorkEvidenceKinds": ["live-issue", "live-branch", "live-session", "live-pr", "live-proc"],
    "residueIsActiveWork": false,
    "auditKeepRootEntriesAreActiveWork": false
  },
  "rawGitWorktreeInventory": {
    "source": "git worktree list --porcelain",
    "totalWorktrees": 10,
    "legacyLocalFooksWorktreePaths": 8,
    "isScopedToAuditEntries": false,
    "isActiveWorkEvidence": false,
    "operatorMeaning": "local residue inventory; do not infer current work without live issue/branch/session/PR/proc evidence"
  },
  "auditScopedInventory": {
    "source": "npm run --silent worktree:audit -- --json",
    "staleReviewCandidates": 0,
    "entries": {
      "total": 1,
      "categories": {
        "keep": 1,
        "safe-cleanup": 0,
        "salvage-review": 0,
        "manual-review-noise": 0
      },
      "scope": "keep/root"
    },
    "isActiveWorkEvidence": false,
    "operatorMeaning": "scoped audit result; zero stale-review candidates does not erase raw local residue counts"
  },
  "runtimeEvidence": {
    "tmux": {
      "source": "tmux list-panes -a -F '#{session_name}\\t#{pane_current_path}'",
      "mappedLiveFooksSessions": 0,
      "isActiveWorkEvidence": false
    },
    "proc": {
      "source": "/proc/*/cwd mapped to issue worktree",
      "mappedLiveProcesses": 0,
      "isActiveWorkEvidence": false
    },
    "operatorMeaning": "tmux/proc evidence becomes active only when it maps to a live issue, branch, session, PR, or process target"
  },
  "repositoryCounts": {
    "openPullRequests": {
      "source": "gh pr list --state open --json number --limit 200",
      "count": 0,
      "isActiveWorkEvidence": false
    },
    "openIssues": {
      "source": "gh issue list --state open --json number --limit 200",
      "count": 0,
      "isActiveWorkEvidence": false
    },
    "operatorMeaning": "open PR/issue counts are not interchangeable with raw local worktree residue"
  },
  "activeWorkDecision": {
    "isCleanSlateForActiveWork": true,
    "activeEvidencePresent": false,
    "reason": "no live issue, branch, session, PR, or proc evidence is present; raw worktree residue and audit keep/root entries remain separate non-active fields"
  }
}
```

## Operator reading order

1. Read `repositoryCounts` for open GitHub work.
2. Read `runtimeEvidence` for live mapped sessions/processes.
3. Read `auditScopedInventory` for stale-review candidates within the audit
   scope.
4. Read `rawGitWorktreeInventory` last as local residue inventory.

Do not reinterpret `rawGitWorktreeInventory.legacyLocalFooksWorktreePaths` as
open work. Do not reinterpret `auditScopedInventory.staleReviewCandidates=0` as
proof that no legacy local paths exist. The fields answer different questions.

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, performance claims, product
claims, duplicate-guard detection, `worktree:audit` scope, `fooks check` output,
cleanup authority, or branch/worktree deletion policy. It documents and tests the
operator reporting boundary only.

## Focused verification

```sh
node --test test/worktree-audit-scope-mismatch-doc.test.mjs
```
