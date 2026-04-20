# opencode read interception boundary

Issue #59 asks whether fooks can move from explicit `/fooks-extract` usage to automatic opencode token-saving through normal `read` interception.

## Current safe conclusion

Not in this repo's current product-safe scope.

The strongest supported opencode path we ship today remains:

- a project-local `fooks_extract` custom tool
- a project-local `/fooks-extract` slash command
- manual or semi-automatic use inside the current worktree

That is **not** the same as automatic read interception, and it is **not** sufficient for an automatic runtime-token savings claim.

## Why this is a no-go for the narrow issue-59 patch

The relevant official opencode surfaces point in two directions:

1. Plugins can observe tool execution through `tool.execute.before` and `tool.execute.after`.
2. Custom tools can shadow built-in tools by name, including `read`.

Those surfaces are real, but neither gives fooks a narrow, low-risk automatic bridge today.

### Hooks are not enough evidence for a claim

The official hook docs show that opencode plugins can inspect upcoming tool calls and adjust arguments. That is useful for policy and steering, but it is not the same as a documented, product-safe substitution of the built-in `read` result with a fooks payload before model context is formed.

Without that stronger guarantee, a "automatic read interception" claim would overstate what this repo can prove.

### Shadowing `read` is broader than it looks

The official upstream `read` tool contract is broader than the current `fooks_extract` bridge. Native `read` behavior includes:

- file and directory reads
- `offset` / `limit` line slicing
- binary-file rejection
- image and PDF attachment handling
- permission checks
- external-directory validation
- reminder metadata appended to output

Generating a project-local `.opencode/tools/read.ts` file would replace the built-in tool. Doing that safely would require either:

- a documented way to delegate back to the original built-in `read`, or
- a careful reimplementation of the native `read` contract.

We do not have a narrow, low-risk version of either in this repo today.

## Product-safe fallback

Keep opencode explicitly in the manual/semi-automatic lane:

- explicit use: `/fooks-extract path/to/File.tsx`
- tool-selection steering: the slash command nudges opencode toward `fooks_extract`
- no automatic interception claim
- no automatic token-savings claim

If a future opencode-specific project wants automatic interception, it should be treated as a separate compatibility and measurement effort with its own acceptance criteria.

## Evidence required before revisiting

Any future automatic-interception effort should prove all of the following:

- a supported interception path that preserves normal non-TSX/JSX `read` behavior
- correct fallback for unsupported files and directories
- compatibility with `offset` / `limit` semantics or an explicitly documented replacement
- live opencode runtime measurements, not proxy wording alone
- task-quality checks showing the fooks payload does not regress outcomes
