# Setup fooks for Codex

Use this when you want fooks to work automatically inside a Codex project.

## 1. Install

```bash
npm install -g oh-my-fooks
```

The package is named `oh-my-fooks`; it installs the `fooks` command.

If setup seems to run the wrong binary, check:

```bash
which fooks
```

## 2. Activate a repo

Run this from your React project root:

```bash
fooks setup
```

`fooks setup` does three things:

1. creates local `.fooks/` state;
2. attaches the repo to the Codex runtime;
3. merges the fooks hook command into `~/.codex/hooks.json`.

The hook command is:

```bash
fooks codex-runtime-hook --native-hook
```

Package install alone does not edit Codex hooks. Activation only happens when you run `fooks setup`.

## 3. Check status

```bash
fooks status codex
fooks status cache
```

Good signs:

- Codex status is connected/ready-style.
- Cache status is `empty` for a fresh repo or `healthy` after scan/use.

## What the setup result means

| State | Meaning |
| --- | --- |
| `ready` | Attach and hook setup completed. Open Codex and work normally. |
| `partial` | Some setup work succeeded, but a blocker remains. Read `blockers` / `nextSteps`, fix, then rerun `fooks setup`. |
| `blocked` | fooks could not activate this repo, usually because no supported React component was found. |

## Common fixes

### No React component found

Run setup from the project root and confirm the repo has `.tsx` or `.jsx` component files.

### Account mismatch

If the repo account is ambiguous, set the target explicitly:

```bash
FOOKS_TARGET_ACCOUNT=minislively fooks setup
```

### Bad Codex hooks file

If `~/.codex/hooks.json` cannot be parsed or written, fix that file and rerun:

```bash
fooks setup
```

Setup is idempotent: rerunning it should not duplicate fooks hook entries.

## opencode custom-tool

opencode support is manual/semi-automatic. It is not automatic read interception and does not claim opencode runtime-token savings.

```bash
fooks install opencode-tool
```

This creates:

```text
.opencode/tools/fooks_extract.ts
```

The generated tool:

- calls `fooks extract <file> --model-payload`;
- accepts `.tsx` and `.jsx` files;
- validates that the file stays inside the current project/worktree;
- does not edit Codex hooks;
- does not edit global opencode config.

Claude and opencode can use fooks payloads through manual/shared handoff paths, but this repo does not claim automatic runtime-token savings for Claude and opencode.

## Advanced commands

Mostly for debugging:

```bash
fooks attach codex
fooks install codex-hooks
fooks codex-runtime-hook --native-hook
fooks scan
fooks extract <file> --model-payload
```
