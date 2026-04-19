# Terminal CLI Validation - 2026-04-19

This note records the smallest concrete validation pass run from current `main` to verify that `fooks` supports both Codex and Claude Code as a terminal CLI integration surface.

## Starting point

- Branch at validation start: `main`
- Commit at validation start: `bf3c6afa100351c8dd6c1fc30a287f3188566f3a`
- Prior docs/PR context inspected:
  - closed PR #35, `docs: agent-neutral CLI workflow for Codex/Claude`, closed on 2026-04-19
  - current `main` already contains the supporting CLI and adapter code paths, but not a merged validation note for the support boundary
- Hermes note:
  - no Hermes-specific integration surface was found in this repo during this pass

## Local environment proof

Both target CLIs are installed in this environment:

```bash
codex --version
# codex-cli 0.121.0

claude --version
# 2.1.114 (Claude Code)
```

## Validation performed

All commands below were run on 2026-04-19 from `/home/bellman/Workspace/fooks` after `npm run build`.

### 1. Codex attach path

Command:

```bash
FOOKS_CODEX_HOME=$(mktemp -d) node dist/cli/index.js attach codex
```

Observed result:

- `runtime: "codex"`
- `contractProof.passed: true`
- `runtimeProof.status: "passed"`
- temporary runtime manifest written under `.../fooks/attachments/fooks.json`
- returned trust status with `connectionState: "connected"` and `lifecycleState: "ready"`

This proves the current repo ships a working Codex attach path with runtime-manifest output and Codex-specific trust/runtime metadata.

### 2. Claude attach path

Command:

```bash
FOOKS_CLAUDE_HOME=$(mktemp -d) node dist/cli/index.js attach claude
```

Observed result:

- `runtime: "claude"`
- `contractProof.passed: true`
- `runtimeProof.status: "passed"`
- temporary runtime manifest written under `.../fooks/attachments/fooks.json`

This proves the current repo ships a working Claude attach path when a Claude home is present.

### 3. Shared agent-neutral prep path

Commands:

```bash
node dist/cli/index.js decide fixtures/compressed/FormSection.tsx
node dist/cli/index.js extract fixtures/compressed/FormSection.tsx --model-payload
```

Observed result:

- `decide` returned `mode: "compressed"`
- `extract --model-payload` returned a valid compressed payload for the same file

This proves the shared prep surface works independently of Codex-only hook wiring.

## Current support boundary

Validated on current `main`:

- Shared terminal CLI prep surfaces are agent-neutral: `init`, `scan`, `decide`, `extract`, and attach artifact generation
- Codex has the richer in-repo runtime path today: attach metadata, trust status, pre-read bridge, native hook bridge, and hook preset installer
- Claude support is real but narrower: attach/runtime-manifest support plus the shared prep flow

Current gap, still present after validation:

- this repo does not currently ship a Claude-native hook installer or a Claude-specific runtime execution bridge comparable to the Codex hook path
- `fooks run` remains Codex/OMX-oriented in current code ownership and naming

## Verification

```bash
npm run typecheck
npm test
```
