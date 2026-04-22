# Setup fooks

Use this when you want one explicit command to prepare fooks for a supported frontend repo. Codex remains the automatic repeated-file hook path. Claude setup is narrower: it installs project-local context hooks for `SessionStart` and `UserPromptSubmit`, where the first eligible explicit frontend-file prompt is recorded/prepared and a repeated same-file prompt may receive bounded context, plus manual/shared handoff artifacts. opencode setup remains a bounded project-local tool readiness summary.

## 1. Install

```bash
npm install -g oh-my-fooks
```

The package is named `oh-my-fooks`; it installs the `fooks` command. This is a **global CLI install** step: it changes which command is available from your npm global prefix/PATH, but it does not activate any repository by itself.

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
2. prepares Codex attachment metadata and runtime-home files;
3. merges the fooks hook command into `~/.codex/hooks.json`;
4. prepares Claude manual/shared handoff artifacts and project-local Claude context hooks when a Claude home is available; Claude records/prepares the first eligible explicit frontend-file prompt and may inject bounded context for repeated same-file prompts;
5. installs the project-local opencode custom tool and slash command when a supported component exists.

The Codex hook command is:

```bash
fooks codex-runtime-hook --native-hook
```

The Claude project-local hook command is:

```bash
fooks claude-runtime-hook --native-hook
```

Package install alone does not edit Codex hooks, Claude files, or opencode project files. Activation only happens when you run `fooks setup`.

### Scope boundaries

`fooks setup` is intentionally a one-command activation flow, but its writes have different scopes:

| Scope | Examples | Notes |
| --- | --- | --- |
| Global CLI install | `npm install -g oh-my-fooks`, `fooks` on PATH | This happens before setup. `fooks setup` does not install or update the npm package. |
| Project-local | `.fooks/config.json`, `.fooks/cache/`, `.opencode/tools/fooks_extract.ts`, `.opencode/commands/fooks-extract.md` | These apply to the current project root where you run `fooks setup`. |
| User runtime/home | `~/.codex/hooks.json`, Codex attachment manifests, Claude handoff manifests | These are runtime integration files. Tests and smoke checks can isolate them with `FOOKS_CODEX_HOME` and `FOOKS_CLAUDE_HOME`. |

The setup JSON includes an additive `scope` object with `packageInstall`, `projectLocal`, `userRuntime`, and `nonGoals` sections so issue reports can show exactly which paths were considered. There is no separate `--scope` option today, and setup does not ask interactive scope questions.

## 3. Check status

```bash
fooks doctor
fooks doctor codex
fooks doctor claude
fooks status
fooks status codex
fooks status claude
fooks status cache
```

Good signs:

- `fooks doctor` returns `healthy: true` when the selected runtime's local setup artifacts are ready. In aggregate mode, Claude-only blockers remain warnings when Codex is ready because Claude support is non-fatal to the Codex automatic hook path.
- Bare `fooks status` returns `metricTier: "estimated"` and no error. A fresh repo may show zero sessions/events.
- Codex status is connected/ready-style.
- Claude status is `context-hook-ready` when the local adapter files, Claude attachment manifest, and project-local Claude hooks are present. It may be `handoff-ready` when adapter/manifest artifacts exist but the project-local hooks have not been installed yet. This is not a Claude `Read` interception or runtime-token savings claim.
- Cache status is `empty` for a fresh repo or `healthy` after scan/use.

`fooks doctor [codex|claude] [--json]` is read-only. It checks local fooks setup artifacts, runtime manifests, hook event installation, Codex trust status, cache health, and supported source-file presence. Focused `fooks doctor claude` also includes an optional TypeScript language server host-tooling check as warning-only. It does not mutate `.fooks/`, Codex hooks, Claude project-local settings, or runtime-home manifests. It also does not prove live provider health; it is not a ccusage replacement and not provider billing telemetry or provider costs.

Bare `fooks status` is local telemetry only. It reads `.fooks/sessions` summaries written by the Codex automatic hook path and the Claude project-local context-hook path, includes runtime/source breakdowns, omits per-session details from CLI status output, and estimates context size with a simple bytes-to-token approximation. It must not be described as provider billing tokens, provider costs, or a `ccusage` replacement. To remove local fooks state for a repo, delete that repo's `.fooks/` directory.

## 4. Compare one frontend file locally

Before opening a runtime, you can inspect the local file-level estimate for a supported frontend file:

```bash
fooks compare src/components/Button.tsx --json
```

`fooks compare` compares the original source bytes with the exact model-facing payload produced by `fooks extract <file> --model-payload`. For compressed/hybrid frontend files, that payload comes from fooks' TypeScript AST-derived component contract, behavior, structure, style, bounded source-line ranges, a source fingerprint for freshness checks, hook/effect intent, and form/control signals rather than the full source text. The line ranges are AST-derived edit aids and should be treated as valid only for the matching source fingerprint. The token values are estimated from local byte counts, so this is a local model-facing payload estimate only. It is not provider tokenizer behavior, not runtime hook envelope overhead, not provider billing tokens, not provider costs, and not a `ccusage` replacement.

## What the setup result means

| State | Meaning |
| --- | --- |
| `ready` | Attach and hook setup completed. Open Codex and work normally. |
| `partial` | Some setup work succeeded, but a blocker remains. Read `blockers` / `nextSteps`, fix, then rerun `fooks setup`. |
| `blocked` | fooks could not activate this repo, usually because no supported React component was found. |

`fooks setup` also returns a `scope` object that summarizes global CLI install boundaries, current-project paths, and user-runtime/home paths. The `scope.packageInstall.mutatedBySetup` flag is `false` because `setup` does not run `npm install`; project-local paths are under the current repo, while runtime-home paths identify files such as Codex hooks/manifests.

`fooks setup` also returns a `runtimes` object:

| Runtime field | Ready state | Meaning |
| --- | --- | --- |
| `runtimes.codex.state` | `automatic-ready` | Codex attach, trust status, and hook preset are ready for the repeated-file optimization path. |
| `runtimes.claude.state` | `context-hook-ready`, `handoff-ready`, or `blocked` | Claude manual/shared handoff artifacts and, when possible, project-local `SessionStart` / `UserPromptSubmit` hooks were prepared, or a non-fatal Claude blocker was reported. This does not mean Claude `Read` interception or runtime-token savings are enabled. |
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

Claude can receive bounded fooks context through project-local `SessionStart` / `UserPromptSubmit` hooks after a first eligible explicit frontend-file prompt is recorded/prepared and a repeated same-file prompt occurs; manual/shared handoff paths remain available. opencode can use fooks payloads through manual/semi-automatic tool paths. This repo does not claim Claude `Read` interception, opencode read interception, or automatic runtime-token savings for Claude and opencode.

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
fooks install claude-hooks
fooks codex-runtime-hook --native-hook
fooks claude-runtime-hook --native-hook
fooks scan
fooks extract <file> --model-payload
fooks compare src/components/Button.tsx --json
```
