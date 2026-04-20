# Setup fooks for Codex

This guide is the user-facing setup and recovery reference for enabling `fooks` in a Codex project.

## Normal path

Install the public npm package, then activate the installed `fooks` CLI explicitly in the project root:

```bash
npm install -g oh-my-fooks
fooks setup
# then open Codex in this repo and work normally
```

From a local checkout, build first:

```bash
npm run build
fooks setup
```

`npm install -g oh-my-fooks` installs the `fooks` CLI only. It does not silently edit or mutate `~/.codex/hooks.json`; the Codex hook wiring happens only when you explicitly run `fooks setup`. The package name is `oh-my-fooks` because the unscoped npm package name `fooks` is already occupied by another owner.

## Package name vs CLI command

The package and command names intentionally differ:

- install package: `oh-my-fooks`
- run command: `fooks`

If another tool already installed a global `fooks` binary, your shell may resolve that command first. Check `which fooks` and your global npm prefix if setup appears to run an unexpected binary.

## What `fooks setup` changes

`fooks setup` composes the lower-level setup steps so normal users do not need to run them manually:

- creates or reuses project-local `.fooks/` state;
- finds a supported React/TSX/JSX component in the current project;
- attaches the current repo to the Codex runtime;
- explicitly merges the fooks Codex hook preset into `~/.codex/hooks.json`;
- preserves unrelated Codex hooks when merging;
- reports a structured result with `ready`, `state`, `blockers`, and `nextSteps`.

The hook command installed for Codex is:

```bash
fooks codex-runtime-hook --native-hook
```

## Understand setup output

`fooks setup` prints JSON. The most important fields are:

| Field | Meaning |
| --- | --- |
| `ready` | `true` only when attach, hook install, and Codex runtime status all look ready. |
| `state` | One of `ready`, `partial`, or `blocked`. |
| `blockers` | Human-readable reasons setup could not fully complete. |
| `nextSteps` | Recovery guidance for the next command or manual check. |
| `hooks` | Hook install/merge result, or `null` if hook setup failed. |
| `status` | Current Codex runtime trust/status snapshot. |

### `ready`

`ready: true` and `state: "ready"` means setup completed. Open Codex in the repo and work normally.

### `partial`

`ready: false` and `state: "partial"` means some setup work succeeded, but one or more blockers remain. Common examples:

- the project attached, but Codex hook installation could not parse or write `~/.codex/hooks.json`;
- the hook preset was installed, but account/runtime proof is blocked;
- the active account does not match the expected `minislively` context for this repository.

Read `blockers`, follow `nextSteps`, fix the issue, then rerun:

```bash
fooks setup
```

### `blocked`

`ready: false` and `state: "blocked"` means setup could not proceed far enough to activate Codex. The most common case is that no supported React/TSX/JSX component was found.

For React projects, add or restore a supported component and rerun:

```bash
fooks setup
```

For non-React projects, the automatic Codex activation path may not apply. Use lower-level `fooks extract` or `fooks scan` only when you know the files are supported.

## Verify setup

After setup, inspect Codex status:

```bash
fooks status codex
```

Optional cache status check:

```bash
fooks status cache
```

For a successful setup, `fooks status codex` should show a connected/ready-style Codex state. If not, use the latest `fooks setup` output and its `blockers` / `nextSteps` fields as the source of truth.

## Common blockers

### No React/TSX component found

`fooks setup` is designed for frontend React/TSX/JSX projects. If setup reports no component file was found, run it from the project root and confirm the project has a supported component file.

### Account context mismatch

Attach checks account context to avoid claiming a false activation. For this repository, the expected target account is `minislively`.

Useful environment overrides for deterministic checks:

```bash
FOOKS_ACTIVE_ACCOUNT=minislively fooks setup
FOOKS_TARGET_ACCOUNT=minislively fooks setup
```

### Codex runtime home is missing

Codex hook installation uses the Codex home directory, normally `~/.codex`. Tests may override it with `FOOKS_CODEX_HOME`, but normal users usually should not need that.

If the runtime home is missing or unavailable, open/configure Codex first, then rerun:

```bash
fooks setup
```

### `hooks.json` cannot be parsed or written

If `~/.codex/hooks.json` is invalid JSON or cannot be written, setup reports `state: "partial"`, `hooks: null`, and a blocker such as `Codex hook preset install failed`.

Fix or restore the hooks file, then rerun:

```bash
fooks setup
```

## Re-run and rollback safely

`fooks setup` is intended to be safe to rerun:

- existing fooks hook entries are skipped instead of duplicated;
- unrelated Codex hooks are preserved;
- if an existing hook file is modified, setup can report a `backupPath` for the previous file.

Use rerun plus manual rollback for setup recovery; setup does not provide a separate CLI reset path. If you need to roll back hook changes, inspect the `backupPath` from setup output and manually restore or edit `~/.codex/hooks.json`.

Project-local state lives under `.fooks/`. Treat it as local activation/cache state for this project, not as source code.

## Advanced commands

Normal users should start with `fooks setup`. These lower-level commands remain available for maintainers, debugging, and validation:

```bash
fooks attach codex
fooks install codex-hooks
fooks codex-runtime-hook --native-hook
fooks init
fooks scan
fooks extract <file> --model-payload
```

Use them only when you are debugging a setup blocker or validating an adapter path directly.

## Support boundaries

- The primary supported automatic activation path today is Codex hook activation through `fooks setup`.
- Package installation alone does not edit Codex hooks.
- Claude support remains manual/shared handoff oriented unless a separate Claude-native hook installer is introduced in the future.
- This setup guide does not make benchmark or marketing claims; it only explains installation, activation, verification, and recovery.
