# fooks

Frontend context compression for Codex and Claude Code.

Public npm package: `oh-my-fooks`
CLI command: `fooks`

`fooks` helps Codex and Claude Code reduce frontend code context for React component work. In an attached Codex project or a Claude project-local context-hook flow, repeated work on the same `.tsx` / `.jsx` file can reuse a smaller model-facing payload instead of pushing the full file context every time, lowering estimated input-token load. Provider billing-token savings, billed-cost savings, and stable runtime-token/time wins remain separate validation tracks and are not claimed by default.

## Quick start

```bash
npm install -g oh-my-fooks
cd your-react-project
fooks setup
```

Then open Codex in that repo and work normally. The same setup command also prepares Claude project-local context hooks plus handoff artifacts and the project-local opencode helper when those local runtime/tool paths are available; Claude records/prepares the first explicit frontend-file prompt and may add bounded context on a repeated same-file prompt.

`fooks setup` is explicit by design. Installing the npm package alone does **not** edit Codex hooks, Claude files, or opencode project files.

### Install/setup scope at a glance

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

## Benchmark snapshot

Latest published Codex-oriented benchmark snapshot (2026-04-14):

| Metric | Before | With fooks | Result |
| --- | --- | --- | --- |
| Prepared-context proxy estimate | ~2.1M | ~450K | **78.2% less** |
| Average task time | 98.2s | 77.9s | **20.7% faster** |
| Large component payloads | full source | compressed payload | **7x-15x smaller** |
| Success rate | 5/5 | 5/5 | no regression in sample |

These are Codex-focused benchmark/proxy measurements from a 5-task sample. The token row is a prepared-context estimate from the benchmark harness, not a measured runtime-token billing claim and not a Claude or opencode savings claim. A later direct-Codex Formbricks N=3 follow-up found that runtime-token/time wins are **not stable yet**: across 6 paired runs, fooks used more runtime tokens in 3/6 pairs and median runtime-token reduction was -5.35%. Treat that as a regression signal, not a marketing win. Benchmark details live in the repository benchmark docs and reports; they are intentionally outside the npm package payload. Layer 2 has proposal-only R4 paired smokes plus an applied-code acceptance gate. A pre-launch repeated R4 applied diagnostic on 2026-04-22 attempted 7 matched pairs after validator/prompt hardening but accepted only 4/7, so it is classified `insufficient-accepted-pairs`; among accepted pairs the prompt was 88.2% smaller, but runtime-token median was -25.5% and latency median was -14.4%. A same-day risk-closure rerun after claim-boundary hardening stopped after 0/3 accepted pairs, so it remains additional negative diagnostic evidence. The current evidence is still not provider billing telemetry, an applied-code benchmark win, or a stable runtime-token/time win claim.

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

## Compare a file locally

Use `fooks compare` when you want immediate, local proof for a specific frontend file:

```bash
fooks compare src/components/Button.tsx --json
```

The command compares the original source bytes with the compact base fooks model-facing payload used for context-reduction estimates. For compressed/hybrid frontend files, that payload is built from fooks' TypeScript AST-derived component contract, behavior, structure, style, bounded source-line ranges, a source fingerprint for freshness checks, hook/effect intent, and form/control signals instead of the full source text. The line ranges are AST-derived edit aids and should be treated as valid only for the matching source fingerprint. It reports estimated source/model-facing tokens, estimated saved bytes/tokens, and a reduction percent. This is a **local model-facing payload estimate**: it excludes optional edit-guidance overhead, is not provider tokenizer behavior, not runtime hook envelope overhead, not provider billing tokens, not provider costs, and not a `ccusage` replacement. Small raw files may show zero savings because fooks intentionally preserves the original source when that is safer.

`fooks extract <file> --model-payload` also includes compact `editGuidance` when source ranges are available. Agents should use its `patchTargets` as line-aware hints for likely edit anchors such as component declarations, props, effects, callbacks, event handlers, form controls, submit handlers, validation anchors, and representative snippets. Before applying a patch from those hints, confirm the current source still matches `sourceFingerprint.fileHash` and `sourceFingerprint.lineCount`; if either changed, rerun `fooks extract` or read the file first. These patch targets are still AST-derived edit aids, not LSP-backed rename/reference resolution and not provider-tokenizer or billing evidence.

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
| Codex | Automatic repeated-file hook path through `fooks setup` | Codex-oriented benchmark/proxy evidence only |
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

Benchmark harness docs and internal development notes live in the source repository, but are intentionally not part of the npm package payload.
