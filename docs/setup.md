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

opencode support is a manual/semi-automatic custom-tool bridge. It is intentionally separate from the Codex hook setup path and does not make an automatic runtime-token savings claim.

From an opencode project root, run:

```bash
fooks install opencode-tool
```

This creates two project-local files:

- `.opencode/tools/fooks_extract.ts` — the custom tool implementation.
- `.opencode/commands/fooks-extract.md` — a slash command prompt for explicit `/fooks-extract path/to/File.tsx` use.

After restarting or opening opencode for that project, run `/fooks-extract path/to/File.tsx` or ask opencode to call `fooks_extract` for a `.tsx` or `.jsx` file when you want a fooks model-facing payload. The slash command reduces tool-selection ambiguity; it is not automatic read interception.

The generated custom tool:

- calls `fooks extract <file> --model-payload`;
- validates that the requested file stays inside the current opencode project/worktree;
- supports `.tsx` and `.jsx` files in this MVP;
- does not edit `~/.config/opencode`;
- does not edit Codex hooks;
- does not edit global opencode config;
- does not install `tool.execute.before` or any opencode `read` interception hook.

The generated slash command follows opencode's project command convention: markdown files under `.opencode/commands/` become `/command-name` entries, and `$ARGUMENTS` passes the text after the command into the prompt.

Treat this as a usability bridge, not as a benchmark result. This setup guide does not claim opencode runtime-token savings unless a future benchmark explicitly measures them.

## Advanced commands

Mostly for debugging:

```bash
fooks attach codex
fooks install codex-hooks
fooks codex-runtime-hook --native-hook
fooks scan
fooks extract <file> --model-payload
```

Use them only when you are debugging a setup blocker or validating an adapter path directly.

## Support boundaries

- The primary supported automatic activation path today is Codex hook activation through `fooks setup`.
- Package installation alone does not edit Codex hooks.
- Claude support remains manual/shared handoff oriented unless a separate Claude-native hook installer is introduced in the future.
- opencode support is manual/semi-automatic custom-tool and slash-command oriented unless a separate opencode read-interception bridge is introduced and measured in the future.
- This setup guide does not make benchmark or marketing claims; it only explains installation, activation, verification, and recovery.
