# Closed audit ID anchor guard (#881)

This is a narrow read-only dogfood docs/test/operator artifact for issue #881.
It covers the clean-slate nudge case where open PRs, open issues, mapped tmux
sessions, and mapped `/proc` evidence are all zero, but `worktree:audit` output
still contains closed audit metadata such as top-level `linkedIssue: "#854"` and
nested orphan-triage `linkedIssue: "#711"`.

Those linked issue IDs identify the audit tools that produced the report. They
are not current active development anchors when the linked issues are already
closed and no live issue/branch/session/PR/proc evidence exists.

## Boundary rule

For clean-slate dogfood nudge reporting, read audit IDs in this order:

1. **Current live anchors first**: open issue count, open PR count, mapped tmux
   session count, and mapped `/proc` issue-worktree process count.
2. **Audit metadata second**: `worktree:audit.linkedIssue` and nested
   `triage.linkedIssue` identify the read-only audit surfaces that emitted the
   report.
3. **Closed audit IDs never become active anchors**: if the audit IDs are known
   closed and live-anchor counts are zero, report them as closed-audit provenance
   only.

A clean-slate nudge may describe active development only from a live issue,
branch, session, PR, mapped process, or a concrete blocker. It must not answer
"current work is #854" or "current work is #711" merely because those IDs are
present in `worktree:audit` JSON.

## Captured read-only report shape

```json
{
  "issue": "#881",
  "readOnly": true,
  "question": "classify closed worktree:audit linked issue IDs during clean-slate dogfood nudges",
  "cleanSlateInputs": {
    "openPullRequests": 0,
    "openIssues": 0,
    "mappedTmuxSessions": 0,
    "mappedProcWorktreeProcesses": 0,
    "activeEvidencePresent": false
  },
  "auditMetadata": {
    "worktreeAudit": {
      "command": "worktree:audit",
      "linkedIssue": "#854",
      "linkedIssueState": "closed",
      "operatorMeaning": "audit provenance only; stale worktree audit tool anchor, not current active development"
    },
    "nestedOrphanTriage": {
      "command": "status orphan-worktrees",
      "linkedIssue": "#711",
      "linkedIssueState": "closed",
      "operatorMeaning": "nested triage provenance only; orphan local worktree audit anchor, not current active development"
    }
  },
  "closedAuditIdDecision": {
    "closedAuditIdsAreActiveEvidence": false,
    "mayNameAsCurrentDevelopmentAnchor": false,
    "classification": "closed-audit-provenance-non-active",
    "reason": "#854 and #711 are closed audit/report provenance IDs; clean-slate live-anchor counts are zero"
  },
  "nudgeAnswerRule": "When open PR/issues/tmux/proc are zero, report worktree:audit linkedIssue #854 and nested #711 as closed audit provenance only; do not use either closed ID as the current active development anchor. Adopt or name a distinct live issue/branch/session/PR/proc target before describing active dogfood development."
}
```

## Operator reading order

1. Read live anchor counts (`openPullRequests`, `openIssues`,
   `mappedTmuxSessions`, and `mappedProcWorktreeProcesses`).
2. If all live anchor counts are zero, classify audit `linkedIssue` fields as
   report provenance unless separate evidence proves a live current target.
3. If an audit linked issue is closed, keep it non-active even when it appears at
   both the top-level audit result and nested triage result.
4. Start or adopt a distinct live issue/branch/session/PR/proc target before the
   nudge describes active development.

## Non-goals

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web/RN/TUI/WebView behavior, performance claims, product
claims, duplicate-guard detection, `worktree:audit` output shape, nested orphan
triage output shape, `fooks check` output, cleanup authority, or
branch/worktree deletion policy. It documents and tests the operator reporting
boundary only.

## Focused verification

```sh
node --test test/closed-audit-id-anchor-guard-doc.test.mjs test/post-merge-main-ci-echo-boundary-doc.test.mjs
```
