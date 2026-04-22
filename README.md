# fooks

Frontend context compression for Codex.

Public npm package: `oh-my-fooks`
CLI command: `fooks`

`fooks` helps Codex avoid rereading the same React component source over and over. In an attached Codex project, repeated work on the same `.tsx` / `.jsx` file can reuse a smaller model-facing payload instead of pushing the full file context every time.

## Quick start

```bash
npm install -g oh-my-fooks
cd your-react-project
fooks setup
```

Then open Codex in that repo and work normally. The same setup command also prepares bounded Claude handoff artifacts and the project-local opencode helper when those local runtime/tool paths are available.

`fooks setup` is explicit by design. Installing the npm package alone does **not** edit Codex hooks, Claude files, or opencode project files.

### Install/setup scope at a glance

| Step | Scope | What can change |
| --- | --- | --- |
| `npm install -g oh-my-fooks` | global CLI install | Makes the `fooks` command available in the npm global prefix / PATH. It does not activate a project. |
| `fooks setup` | current project + runtime homes | Creates project-local `.fooks/` state, may add project-local `.opencode/` helper files, and may update runtime-home files such as Codex hooks/manifests or Claude handoff manifests. |
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

These are Codex-focused benchmark/proxy measurements from a 5-task sample. The token row is a prepared-context estimate from the benchmark harness, not a measured runtime-token billing claim and not a Claude or opencode savings claim. A later direct-Codex Formbricks N=3 follow-up found that runtime-token/time wins are **not stable yet**: across 6 paired runs, fooks used more runtime tokens in 3/6 pairs and median runtime-token reduction was -5.35%. Treat that as a regression signal, not a marketing win. Benchmark details live in the repository benchmark docs and reports; they are intentionally outside the npm package payload. Layer 2 has proposal-only R4 paired smokes plus an applied-code acceptance gate. A pre-launch repeated R4 applied diagnostic on 2026-04-22 attempted 7 matched pairs after validator/prompt hardening but accepted only 4/7, so it is classified `insufficient-accepted-pairs`; among accepted pairs the prompt was 88.2% smaller, but runtime-token median was -25.5% and latency median was -14.4%. The current evidence is still not provider billing telemetry, an applied-code benchmark win, or a stable runtime-token/time win claim.

## Everyday commands

```bash
fooks setup          # one-time readiness: Codex hooks + Claude handoff + opencode helper
fooks status          # local estimated context-size telemetry for this repo
fooks status codex   # check Codex attach/hook state
fooks status claude  # check Claude manual handoff artifact health
fooks status cache   # check local fooks cache health
```

For manual inspection:

```bash
fooks extract src/components/Button.tsx --model-payload
fooks scan
```

`fooks status` reads local `.fooks/sessions` summaries produced by the Codex hook path. The values are approximate context-size estimates only; the CLI status output omits per-session details and is not provider billing tokens, provider costs, or a `ccusage` replacement.

`fooks status codex` is also only a local attach/trust readiness check. It does not prove Codex runtime-token savings, because this repo does not yet collect Codex runtime telemetry for that claim.

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
| Codex | Automatic repeated-file hook path through `fooks setup` | Prepared-context/proxy evidence only; no runtime-token proof until measured telemetry exists |
| Claude | Manual/shared handoff prepared by `fooks setup` when possible | No automatic runtime-token savings claim |
| opencode | Manual/semi-automatic project-local tool and slash command prepared by `fooks setup` when possible | No read interception and no automatic runtime-token savings claim |

`fooks` is not a universal file-read interceptor. Non-frontend files usually fall back to normal source reading.

## Troubleshooting

If setup does not report ready:

```bash
fooks setup
fooks status codex
fooks status claude
fooks status cache
```

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
