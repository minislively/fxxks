# Terminal CLI Validation - 2026-04-19

This note records the local validation checks run on 2026-04-19 to verify that `fooks` prepares both Codex and Claude Code terminal CLI integration artifacts, plus the follow-up first-success wording pass reopened from clean `main`.

Claim boundary: these checks verify setup artifacts, manifests, and handoff payloads only. They are not Codex runtime-token telemetry and must not be described as proof of Codex runtime-token savings.

## Previous validation context

- PR #35, `docs: agent-neutral CLI workflow for Codex/Claude`, was closed on 2026-04-19 without merge because it mixed a broader docs package into what should have been a narrower validation track.
- PR #37, `docs: record concrete Codex and Claude CLI validation`, merged on 2026-04-19 and established the first small local validation artifact on `main`.
- This rerun keeps the validation track narrow: verify current `main`, make the first-success path more retention-safe, and avoid inventing Claude parity that the repo does not ship.

## Current rerun starting point

- Branch at rerun start: `validation/agent-neutral-first-success-20260419`
- Base branch: `main`
- Commit at rerun start: `9e5be1c4a4a5b3c95ac8a08b4ac51f5d26f62597`
- Prior docs/PR context inspected:
  - closed PR #35, `docs: agent-neutral CLI workflow for Codex/Claude`, closed on 2026-04-19
  - merged PR #37 / commit `9e5be1c`, `docs: validate fooks as agent-neutral terminal CLI`
  - current `main` already contains the supporting CLI and adapter code paths, plus the merged validation note, but previously left `fooks run` with runner-flavored first-success wording
- Hermes note:
  - no Hermes-specific integration surface was found in this repo during this pass

## Local environment check

Both target CLIs are installed in this environment:

```bash
codex --version
# codex-cli 0.121.0

claude --version
# 2.1.114 (Claude Code)
```

## Validation performed

All commands below were run on 2026-04-19 from `<repository-root>` after `npm run build`.

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

This validates that the current repo can write the expected Codex attach manifest and Codex-specific trust/readiness metadata. It does not prove Codex consumed the artifact during a live session or used fewer runtime tokens.

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

This validates that the current repo ships a Claude handoff manifest path when a Claude home is present.

### 3. Shared agent-neutral prep path

Commands:

```bash
node dist/cli/index.js decide fixtures/compressed/FormSection.tsx
node dist/cli/index.js extract fixtures/compressed/FormSection.tsx --model-payload
```

Observed result:

- `decide` returned `mode: "compressed"`
- `extract --model-payload` returned a valid compressed payload for the same file

This validates that the shared prep surface works independently of Codex-only hook wiring.

### 4. Shared first-success handoff path

Command:

```bash
node dist/cli/index.js run "Please update fixtures/compressed/FormSection.tsx"
```

Observed result after the first-success wording pass:

- output heading is `Shared Handoff Context`
- output no longer labels the flow as a detected runner
- next-step text says `Open this context with your preferred runtime (codex or claude).`
- context file still contains the same light exact-file selection for `fixtures/compressed/FormSection.tsx`

This keeps the local value check intact while making the first-success path honest about the product surface: `fooks run` prepares a reusable context handoff and does not claim Claude-native runtime automation.

Follow-up claim-safety note: a Claude attach check plus `extract --model-payload` check should be described as a **Claude manual handoff-compatible reduced artifact check**. It is not evidence of Claude automatic runtime hooks, Claude live runtime-token savings, or Claude benchmark wins. Likewise, Codex attach readiness is not Codex runtime-token telemetry.

## Current support boundary

Validated on current `main` and preserved by the follow-up wording pass:

- Shared terminal CLI prep surfaces are agent-neutral: `init`, `scan`, `decide`, `extract`, and attach artifact generation
- Shared first-success handoff is agent-neutral: `run` prepares a reusable context file and points users back to their preferred runtime
- Codex has the richer in-repo runtime path today: attach metadata, trust status, pre-read bridge, native hook bridge, and hook preset installer
- Claude support is real but narrower: attach/runtime-manifest support plus the shared prep/manual handoff flow

Current gap, still present after validation:

- this repo does not currently ship a Claude-native hook installer or a Claude-specific runtime execution bridge comparable to the Codex hook path
- internal `run` prep still uses the Codex execution-context helper under the hood, even though the user-facing handoff copy is now runtime-neutral
- this repo does not currently ship `status claude` or Claude runtime-token benchmark evidence
- this repo does not currently collect Codex runtime-token telemetry, so Codex setup/attach checks must not be called runtime-token savings proof

## Verification

```bash
npm run build
npm run typecheck
npm test
```
