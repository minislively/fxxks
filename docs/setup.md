# Setup fooks

Use this when you want one explicit command to prepare fooks for a supported frontend repo. Codex is the only automatic hook path today; Claude and opencode setup results are bounded handoff/tool readiness summaries.

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

`fooks setup` does five things:

1. creates local `.fooks/` state;
2. attaches the repo to the Codex runtime;
3. merges the fooks hook command into `~/.codex/hooks.json`;
4. prepares Claude manual/shared handoff artifacts when a Claude home is available;
5. installs the project-local opencode custom tool and slash command when a supported component exists.

The hook command is:

```bash
fooks codex-runtime-hook --native-hook
```

Package install alone does not edit Codex hooks, Claude files, or opencode project files. Activation only happens when you run `fooks setup`. Benchmark harness commands are not required for normal use; they are only for maintainers measuring fooks behavior.

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

`fooks setup` also returns a `runtimes` object:

| Runtime field | Ready state | Meaning |
| --- | --- | --- |
| `runtimes.codex.state` | `automatic-ready` | Codex attach, trust status, and hook preset are ready. This is the only automatic runtime hook path in the setup command. |
| `runtimes.claude.state` | `handoff-ready` or `blocked` | Claude manual/shared handoff artifacts were prepared, or a non-fatal Claude blocker was reported. This does not mean Claude prompt interception is enabled. |
| `runtimes.opencode.state` | `tool-ready`, `manual-step-required`, or `blocked` | The project-local opencode helper is installed, needs an explicit/manual step, or hit a non-fatal blocker. This does not mean opencode read interception or automatic runtime-token savings are enabled. |
| `blocksOverall` | `true` only for Codex today | Claude/opencode blockers should not make Codex setup look failed when Codex itself is ready. |

## Common fixes

### No React component found

Run setup from the project root and confirm the repo has `.tsx` or `.jsx` component files. The activation path is intentionally frontend-focused: repos without supported React component candidates should remain `blocked` instead of installing hooks for unrelated file types.

### Account context

Public repos should not need an account override. fooks derives account context from `FOOKS_ACTIVE_ACCOUNT`, `.fooks/config.json`, GitHub remote metadata, or `package.json` repository metadata. The default placeholder created by `fooks setup` is ignored so a fresh user is not blocked by `<your-github-org>`.

If you still need to force a value for local validation, set the target explicitly:

```bash
FOOKS_TARGET_ACCOUNT=<your-github-org> fooks setup
```

### Bad Codex hooks file

If `~/.codex/hooks.json` cannot be parsed or written, fix that file and rerun:

```bash
fooks setup
```

Setup is idempotent: rerunning it should not duplicate fooks hook entries.

## opencode custom-tool

opencode support is a manual/semi-automatic custom-tool bridge. `fooks setup` prepares this bridge when it can prove a supported component exists, and `fooks install opencode-tool` remains the direct repair/debug command. It is intentionally separate from the Codex hook setup path and does not make an automatic runtime-token savings claim.

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

Keep these distinct:

- explicit `/fooks-extract ...` usage;
- tool-selection steering toward `fooks_extract`;
- true automatic `read` interception.

Today, `fooks install opencode-tool` only covers the first two. It does not install a project-local `read` override. That omission is intentional: opencode's native `read` surface is broader than the current bridge and includes directory reads, `offset`/`limit` handling, binary/image/PDF behavior, permission gates, and reminder metadata. Shipping a generated `read` shadow without reproducing that contract would be a broader and riskier change than this MVP supports. See [`docs/opencode-read-interception.md`](opencode-read-interception.md).

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
- Benchmark harnesses, Python runners, and Layer 2 task-execution scaffolds are maintainer measurement tools, not required setup steps.
