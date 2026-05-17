# Docs-backed Work Item audit

## Contract baseline

#921 docs define the implementation order as docs baseline → shared Work Item model → CLI action dashboard → TUI board → explain. This pass is intentionally limited to the shared model plus the first `fooks status` connection.

## status/check/TUI audit

| Surface | Current code path | Divergence from #921 docs | This-pass result |
| --- | --- | --- | --- |
| `status` | `src/cli/index.ts` bare `fooks status` previously returned only local metric summary. | Metrics are receipt evidence only; they do not classify active work, rejected evidence, or required next action. | Connected `workItemDashboard` to bare `fooks status` while preserving existing metric fields. |
| `check` | `src/ops/operator-check.ts` projects `status activity --include-remote-counts` into operator active-artifact boundaries. | It already has conservative active-artifact language, but shape is operator-specific rather than the shared WorkItem/Evidence/NextAction model. | Audited only; no behavior change in this first pass. |
| TUI | No dedicated action-board rewrite in this issue. | A TUI board would duplicate judgment if it invents state separately from CLI/check. | `src/core/work-item-dashboard.ts` exports shared `WorkItem`, `Evidence`, `NextAction`, and `tuiCompatibility.modelOnly=true` for future render-only consumption. |

## Shared model file

`src/core/work-item-dashboard.ts`

- `WorkItem`: issue/branch/session/worktree/PR-centered unit with observed evidence, inferred notes, non-claims, and required next action.
- `Evidence`: exported alias of `WorkItemEvidence`; separates Source/Workflow/Session/Receipt classes.
- `NextAction`: exported alias of `WorkItemNextAction`; labels the next concrete action without claiming completion.

## Connected artifact chain

- Issue: #922
- Branch: `feature/issue-922-docs-backed-work-item-action-dashboard`
- Worktree: `/home/bellman/Workspace/fooks.omx-worktrees/issue-922-docs-backed-work-item-action-dashboard`
- Session: `fooks-issue-922-docs-backed-work-item-action-dashboard`
- PR: not opened yet in this snapshot

## Boundary

No TUI rewrite, no `fooks explain`, no provider/runtime behavior change, and no completion claim from metric receipts alone.
