# Stale context audit

`fooks stale-context` is a narrow, local-only prompt/handoff audit for issue #962.
It does not query GitHub, CI, tmux, git remotes, provider runtimes, or hook state.
Instead, it deterministically scans supplied text for stale-context patterns called out in
`docs/research/context-trust-and-stale-evidence-research.md`.

## Usage

```sh
fooks stale-context handoff.md
fooks stale-context handoff.md --json
cat prompt.md | fooks stale-context --stdin --json
```

## Output contract

JSON output includes:

- `summary.hardConflictCount`: text that appears to present stale/historical material as current authority.
- `summary.advisorySuspectCount`: branch, worktree, or prior-session context that needs fresh evidence.
- `warnings[].severity`: `hard-conflict` or `advisory-suspect`.
- `warnings[].authority`: whether the evidence is advisory-only or must not be used as current work.
- `warnings[].reason` and `warnings[].evidence`: agent-consumable explanation and source line.
- `warnings[].recommendation`: the next re-check an agent/operator should perform.

## Current limitations

The audit is intentionally lexical and local. It can warn that a prompt says
"merged PR #123 is the current target," but it cannot prove the live PR state.
Use it as a preflight warning surface, then re-check current source, branch/worktree
state, and open issue/PR evidence before editing.
