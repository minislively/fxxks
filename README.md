# fooks

Smaller model-facing context for repeated React component work in Codex.

Broad category: Frontend context compression for Codex and Claude Code. Current strongest path: Codex repeated React component work.

- Public npm package: `oh-my-fooks`
- CLI command: `fooks`

`fooks` helps Codex users avoid resending the same full `.tsx` / `.jsx` component context during iterative frontend work. In the Codex repeated-file hook path, the first eligible file mention records context and later same-file prompts may reuse a compact fooks payload when safe.

The core claim is deliberately narrow: **lower model-facing input/context load for supported repeated frontend work**. That is not provider billing/cost proof, not provider billing-token proof, not stable runtime-token or latency proof, and not a `ccusage` replacement.

## Quick start and local proof

```bash
npm install -g oh-my-fooks
cd your-react-project
fooks setup
fooks compare src/components/Button.tsx --json
```

Then open Codex in that repo and work normally. `fooks compare` gives an immediate local estimate for one supported frontend file by comparing original source size with the compact fooks model-facing payload.

`fooks setup` is explicit by design. Installing the npm package alone does **not** edit Codex hooks, Claude files, or opencode project files.

## What fooks is / is not

| fooks is | fooks is not |
| --- | --- |
| A focused context-reduction helper for repeated React `.tsx` / `.jsx` work, strongest today in Codex. | A universal file-read interceptor for every language, framework, runtime, or file type. |
| A way to inspect local model-facing payload estimates with `fooks compare` and local session estimates with `fooks status`. | Provider billing telemetry, provider tokenizer behavior, provider invoice/dashboard proof, or a `ccusage` replacement. |
| A project setup tool that prepares Codex hooks plus narrower Claude/opencode helper paths when available. | A claim that Claude or opencode has Codex-equivalent automatic runtime-token savings. |

## Runtime support at a glance

| Environment | Current path | Automation level | Do not assume |
| --- | --- | --- | --- |
| Codex | Automatic repeated-file hook path through `fooks setup` | Strongest path: repeated same-file `.tsx` / `.jsx` prompts can reuse compact context when safe | Universal file-read interception, stable runtime-token wins, or provider billing/cost proof |
| Claude | Project-local `SessionStart` / `UserPromptSubmit` context hooks plus manual/shared handoff artifacts | Narrower path: first eligible explicit frontend-file prompt is recorded/prepared; a repeated same-file prompt may receive bounded context | `Read` interception, full prompt-interception parity with Codex, or runtime-token savings proof |
| opencode | Project-local `fooks_extract` tool and `/fooks-extract` slash command | Manual/semi-automatic tool steering | Built-in `read` interception or automatic runtime-token savings |

## Install/setup scope at a glance

| Step | Scope | What can change |
| --- | --- | --- |
| `npm install -g oh-my-fooks` | global CLI install | Makes the `fooks` command available in the npm global prefix / PATH. It does not activate a project. |
| `fooks setup` | current project + runtime homes | Creates project-local `.fooks/` state, may add project-local `.opencode/` helper files, and may update runtime-home files such as Codex hooks/manifests or Claude handoff manifests. |
| `fooks doctor` | current project + runtime-home inspection | Reads local setup and hook-readiness artifacts without writing files; it is not live provider health, billing-token, cost, or `ccusage` proof. |
| `fooks status` | current project inspection | Reads local fooks telemetry/status; it is not a package installer or billing-token report. |

The `fooks setup` JSON includes a `scope` object so support/debug logs can show which paths are project-local and which are user-runtime/home scoped.

## What gets optimized

Current automatic optimization is intentionally narrow:

- Runtime: Codex hooks
- Files: `.tsx` and `.jsx`
- Pattern: repeated same-file work in one Codex session
- First mention: record only
- Later same-file mentions: reuse a compact fooks payload when safe

This is best for iterative frontend component work such as:

```text
Review src/components/Form.tsx.
Now update src/components/Form.tsx validation copy.
One more change in src/components/Form.tsx: add disabled state.
```

If fooks cannot safely build a payload, it falls back to normal full-source behavior.

## Compare a file locally

Use `fooks compare` when you want immediate, local proof for a specific frontend file:

```bash
fooks compare src/components/Button.tsx --json
```

The command compares the original source bytes with the compact base fooks model-facing payload used for context-reduction estimates. For compressed/hybrid frontend files, that payload is built from fooks' TypeScript AST-derived component contract, behavior, structure, style, bounded source-line ranges, source fingerprint, hook/effect intent, and form/control signals instead of the full source text. The line ranges are AST-derived edit aids and should be treated as valid only for the matching source fingerprint.

`fooks compare` reports estimated source/model-facing tokens, estimated saved bytes/tokens, and a reduction percent. This is a **local model-facing payload estimate**: it excludes optional edit-guidance overhead and is not provider tokenizer behavior, runtime hook envelope overhead, provider billing tokens, provider costs, or a `ccusage` replacement. Small raw files may show zero savings because fooks intentionally preserves the original source when that is safer.

`fooks extract <file> --model-payload` also includes compact `editGuidance` when source ranges are available. Agents should use its `patchTargets` as line-aware hints for likely edit anchors such as component declarations, props, effects, callbacks, event handlers, form controls, submit handlers, validation anchors, and representative snippets. Before applying a patch from those hints, confirm the current source still matches `sourceFingerprint.fileHash` and `sourceFingerprint.lineCount`; if either changed, rerun `fooks extract` or read the file first. These patch targets are AST-derived edit aids, not LSP-backed rename/reference resolution, provider-tokenizer evidence, or billing evidence.

## Benchmark and evidence boundaries

The shortest evidence summary is:

- Local commands such as `fooks compare` and `fooks status` support **model-facing context / prompt-size estimate** wording.
- The 2026-04-14 Codex-oriented proxy snapshot showed a prepared-context estimate reduction from roughly 2.1M to 450K estimated context tokens in a 5-task sample, with no success-rate regression in that sample.
- Later benchmark lanes include estimate-scoped API-cost evidence, but that wording must stay qualified as **estimated API cost under explicit pricing assumptions**.
- Direct runtime-token/time evidence remains unstable or negative in some diagnostics, so fooks does not claim stable runtime-token, wall-clock, or latency wins.

Detailed evidence and current claim boundaries are maintained in the curated benchmark evidence page: https://github.com/minislively/fooks/blob/main/docs/benchmark-evidence.md

The benchmark evidence is not provider invoice/dashboard proof, not actual charged-cost proof, not provider billing-token proof, and not a Claude or opencode automatic savings claim.

## Everyday commands

```bash
fooks setup          # one-time readiness: Codex hooks + Claude context hooks + opencode helper
fooks doctor         # read-only local setup and hook-readiness diagnostics
fooks doctor codex   # focus on Codex setup/hook readiness
fooks doctor claude  # focus on Claude project-local context-hook readiness
fooks status          # local estimated context-size telemetry for this repo
fooks status codex   # check Codex attach/hook state
fooks status claude  # check Claude project-local context hook / handoff health
fooks status cache   # check local fooks cache health
fooks compare src/components/Button.tsx --json  # local original-vs-fooks payload estimate
```

For manual inspection:

```bash
fooks extract src/components/Button.tsx --model-payload
fooks scan
```

`fooks status` reads local `.fooks/sessions` summaries produced by the Codex automatic hook path and the Claude project-local context-hook path. The values are approximate context-size estimates only; status includes runtime/source breakdowns, omits per-session details, and is not provider billing tokens, provider costs, or a `ccusage` replacement.

## opencode support

opencode support is **manual/semi-automatic** today. It does not intercept opencode `read` calls and does not claim automatic runtime-token savings.

`fooks setup` installs the project-local opencode bridge when the project has a supported `.tsx` / `.jsx` component. You can also install or repair just that bridge from the project root:

```bash
fooks install opencode-tool
```

This creates two project-local opencode artifacts:

```text
.opencode/tools/fooks_extract.ts
.opencode/commands/fooks-extract.md
```

Use `/fooks-extract path/to/File.tsx` or ask opencode to call `fooks_extract` when you want a fooks model-facing payload for a `.tsx` or `.jsx` file. This bridge steers tool selection; it does **not** intercept opencode `read` calls.

## Support boundaries

| Environment | Current support | Runtime-token claim |
| --- | --- | --- |
| Codex | Automatic repeated-file hook path through `fooks setup` | Model-facing context and estimate-scoped benchmark evidence only; no stable runtime-token or billing-grade claim |
| Claude | Project-local context hooks for `SessionStart` / `UserPromptSubmit`; the first eligible explicit frontend-file prompt is recorded/prepared, and a repeated same-file prompt may receive bounded context; manual/shared handoff fallback prepared by `fooks setup` when possible | No `Read` interception and no automatic runtime-token savings claim |
| opencode | Manual/semi-automatic project-local tool and slash command prepared by `fooks setup` when possible | No read interception and no automatic runtime-token savings claim |

`fooks` is not a universal file-read interceptor. Non-frontend files usually fall back to normal source reading.

## Troubleshooting

If setup does not report ready:

```bash
fooks setup
fooks doctor
fooks doctor codex
fooks status codex
fooks status claude
fooks status cache
```

`fooks doctor` is the safest first diagnostic after setup because it is read-only and summarizes local setup artifacts, missing hook events, manifests, adapter files, trust status, cache health, and supported source-file presence. Focused `fooks doctor claude` also reports the optional TypeScript language server as a warning-only host-tooling hint. It does not prove live provider health; it is not a ccusage replacement and not provider billing telemetry or provider costs.

Common causes:

- You are not in a React/TSX/JSX project root.
- Another global `fooks` binary is earlier in your PATH.
- `~/.codex/hooks.json` is invalid JSON or not writable.
- Your Codex runtime home is missing or not writable; use `FOOKS_CODEX_HOME` for an isolated smoke test.

More setup details: [`docs/setup.md`](docs/setup.md)

## Development

```bash
npm install
npm test
```

Useful public docs:

- Setup details: [`docs/setup.md`](docs/setup.md)
- opencode support boundary: [`docs/opencode-read-interception.md`](docs/opencode-read-interception.md)
- Release checklist: [`docs/release.md`](docs/release.md)
- Benchmark evidence and claim boundaries: https://github.com/minislively/fooks/blob/main/docs/benchmark-evidence.md

Benchmark harness internals and generated reports live in the source repository, but are intentionally not part of the npm package payload.
