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

Package install alone does not edit Codex hooks, Claude files, or opencode project files. Activation only happens when you run `fooks setup`.

## 3. Check status

```bash
fooks status
fooks status codex
fooks status cache
```

Good signs:

- Bare `fooks status` returns `metricTier: "estimated"` and no error. A fresh repo may show zero sessions/events.
- Codex status is connected/ready-style.
- Cache status is `empty` for a fresh repo or `healthy` after scan/use.

Bare `fooks status` is local telemetry only. It reads `.fooks/sessions` summaries written by the Codex hook path, omits per-session details from CLI status output, and estimates context size with a simple bytes-to-token approximation. It must not be described as provider billing tokens, provider costs, or a `ccusage` replacement. To remove local fooks state for a repo, delete that repo's `.fooks/` directory.

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

Run setup from the project root and confirm the repo has `.tsx` or `.jsx` component files.

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

opencode support is manual/semi-automatic. `fooks setup` prepares this bridge when it can prove a supported component exists, and `fooks install opencode-tool` remains the direct repair/debug command. It is not automatic read interception and does not claim opencode runtime-token savings.

```bash
fooks install opencode-tool
```

This creates:

```text
.opencode/tools/fooks_extract.ts
.opencode/commands/fooks-extract.md
```

The generated tool:

- calls `fooks extract <file> --model-payload`;
- accepts `.tsx` and `.jsx` files;
- validates that the file stays inside the current project/worktree;
- installs a slash command for explicit `/fooks-extract path/to/File.tsx` steering;
- does not edit Codex hooks;
- does not edit global opencode config.

Claude and opencode can use fooks payloads through manual/shared handoff paths, but this repo does not claim automatic runtime-token savings for Claude and opencode.

## Release smoke check

Maintainers can run the full local package smoke without publishing:

```bash
npm run release:smoke
```

This builds the package, verifies required tarball contents, installs the packed tarball into a temporary global prefix, and runs `fooks setup` inside a disposable public-style React project with isolated Codex/Claude homes and no `FOOKS_ACTIVE_ACCOUNT`.

## Advanced commands

Mostly for debugging:

```bash
fooks attach codex
fooks install codex-hooks
fooks codex-runtime-hook --native-hook
fooks scan
fooks extract <file> --model-payload
```
