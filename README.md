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

Then open Codex in that repo and work normally.

`fooks setup` is explicit by design. Installing the npm package alone does **not** edit Codex hooks.

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
| Estimated token use | ~2.1M | ~450K | **78.2% less** |
| Average task time | 98.2s | 77.9s | **20.7% faster** |
| Large component payloads | full source | compressed payload | **7x-15x smaller** |
| Success rate | 5/5 | 5/5 | no regression in sample |

These are Codex-focused benchmark/proxy measurements, not Claude or opencode runtime-token savings claims. Full benchmark details live in [`benchmarks/frontend-harness/README.md`](https://github.com/minislively/fooks/tree/main/benchmarks/frontend-harness#readme).

## Everyday commands

```bash
fooks setup          # one-time Codex activation for this repo
fooks status codex   # check Codex attach/hook state
fooks status cache   # check local fooks cache health
```

For manual inspection:

```bash
fooks extract src/components/Button.tsx --model-payload
fooks scan
```

## opencode support

opencode support is **manual/semi-automatic** today. It does not intercept opencode `read` calls and does not claim automatic runtime-token savings.

Install the project-local opencode bridge from the project root:

```bash
fooks install opencode-tool
```

This creates two project-local opencode artifacts:

- `.opencode/tools/fooks_extract.ts` — the custom tool that runs fooks extraction.
- `.opencode/commands/fooks-extract.md` — a slash command prompt so you can explicitly run `/fooks-extract path/to/File.tsx` instead of relying on model tool-selection heuristics.

In opencode, run `/fooks-extract path/to/File.tsx` or ask the model to call `fooks_extract` for a `.tsx` or `.jsx` file when you want a fooks model-facing payload. The generated tool validates that the requested file stays inside the current opencode project/worktree and calls `fooks extract <file> --model-payload`.

This custom tool and slash command do **not** intercept opencode `read` calls, do **not** install a `tool.execute.before` read replacement hook, and do **not** establish an opencode runtime-token benchmark claim. The slash command only reduces the small usability risk that the model might not choose the tool on its own. Automatic opencode context interception is a separate future project that needs its own quality and token measurements.

## Support boundaries

- Codex: automatic repeated-file hook path is supported.
- Claude and opencode: can consume fooks payloads through manual/shared handoff paths.
- Claude and opencode do **not** currently have automatic runtime-token savings claims in this repo.
- fooks is not a universal file-read interceptor.
- Non-frontend files usually fall back to normal source reading.

## Troubleshooting

If setup does not report ready:

```bash
fooks setup
fooks status codex
fooks status cache
```

Advanced direct install paths:

```bash
fooks install codex-hooks
fooks install opencode-tool
```

The Codex hook installer is idempotent: it only adds the `fooks codex-runtime-hook --native-hook` command to `SessionStart`, `UserPromptSubmit`, and `Stop` when those entries are missing, and preserves other hooks already present in `~/.codex/hooks.json`.

The opencode tool installer is also explicit and idempotent, but project-local: it creates `.opencode/tools/fooks_extract.ts` and `.opencode/commands/fooks-extract.md` for manual/semi-automatic use and does not edit Codex hooks or global opencode config.

Common causes:

- You are not in a React/TSX/JSX project root.
- Another global `fooks` binary is earlier in your PATH.
- `~/.codex/hooks.json` is invalid JSON or not writable.
- The repo/account context is not allowed for attach.

More setup details: [`docs/setup.md`](docs/setup.md)

## Development

```bash
npm install
npm test
```

Repository layout:

- `src/**/*.ts` is the source of truth for product code.
- `dist/` is generated JavaScript, declarations, and source maps from `npm run build`.
- `test/*.mjs` and benchmark `.mjs` files are small Node runners that exercise the built `dist` package.
- Keep this split unless a TypeScript-runner refactor has a clear payoff; avoiding extra test/runtime tooling is intentional.

Useful internal docs:

- Runtime bridge contract: [`docs/runtime-bridge-contract.md`](docs/runtime-bridge-contract.md)
- Live feedback checklist: [`docs/codex-live-feedback-checklist.md`](docs/codex-live-feedback-checklist.md)
- Release checklist: [`docs/release.md`](docs/release.md)
- Benchmark harness: [`benchmarks/frontend-harness/README.md`](https://github.com/minislively/fooks/tree/main/benchmarks/frontend-harness#readme)
