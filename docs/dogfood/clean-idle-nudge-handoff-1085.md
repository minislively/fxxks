# Issue #1085 clean-idle nudge handoff

This is a narrow read-only dogfood/operator artifact for the clean-idle
`fooks nudge` handoff. It covers the state where `npm run --silent check --
--json` returns `idleRequiresActiveArtifact` after clean post-merge `main` and
there is no open issue, PR, mapped session, live non-`main` branch/worktree, or
concrete blocker to report as current development.

## Boundary

A clean post-merge `main` CI echo is a receipt, not active work. Stale local
worktree residue is cleanup-review context, not active work. When both are the
only visible evidence, the operator must seed or resume an explicit handoff
artifact before claiming development is active: an open GitHub issue, a
non-`main` branch or live worktree, a mapped fooks tmux session, or an open PR.

The CLI remains read-only. It must not auto-create issues, open PRs, create
sessions, mutate worktrees, close or mutate `#960`, change runtime/provider or
frontend behavior, weaken CI/approval/merge-gate policy, or broaden product or
release claims. This artifact preserves the existing top-level
`idleRequiresActiveArtifact` verdict; it only makes the handoff boundary visible
and testable.

## Report shape

```json
{
  "issue": "#1085",
  "readOnly": true,
  "operatorCheckField": "activeWorkReceipts.cleanIdleNudgeHandoffBoundary",
  "classification": "clean-idle-handoff-artifact-required",
  "preservesOperatorCheckVerdict": "idleRequiresActiveArtifact",
  "currentEvidence": {
    "clean": true,
    "branch": "main",
    "openIssueCount": 0,
    "openPullRequestCount": 0,
    "mappedFooksTmuxSessionCount": 0,
    "liveNonMainWorktreePresent": false,
    "postMergeMainCiEchoPresent": true,
    "staleResidueCount": 1,
    "staleResidueIsActiveDevelopmentEvidence": false,
    "ciEchoIsActiveDevelopmentEvidence": false
  },
  "requiresExplicitHandoffArtifactBeforeDevelopmentClaim": true,
  "acceptableHandoffArtifacts": [
    "open GitHub issue",
    "non-main branch or live worktree",
    "mapped fooks tmux session",
    "open GitHub pull request"
  ],
  "mutationBoundary": {
    "createsIssuesFromCli": false,
    "mutatesGitHub": false,
    "mutatesWorktrees": false,
    "changesRuntimeProviderFrontendOrMergeGatePolicy": false
  },
  "rule": "Clean post-merge main with only CI echoes and stale residue remains idleRequiresActiveArtifact; seed or resume an explicit issue, branch/session/worktree, or PR before claiming current development, and must not auto-create an issue from the CLI; do not auto-create an issue from the CLI."
}
```

## Operator wording

Use this wording when a clean-idle nudge has no live artifact:

- Current development: **idle / handoff artifact required**.
- Evidence that is not active work: post-merge CI echoes, release echoes, stale
  local worktree residue, closed PR residue, and cleanup-review receipts.
- Required before an active-development report: name the explicit issue,
  branch/live worktree, mapped session, or PR that the operator seeded or
  resumed.

## Verification

```bash
git diff --check HEAD
npm run build
npm run typecheck -- --pretty false
node --test test/operator-activity.test.mjs test/clean-idle-nudge-handoff-1085-doc.test.mjs
```
