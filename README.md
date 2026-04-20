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

These numbers are Codex-focused benchmark/proxy measurements, not Claude or opencode runtime-token savings claims. Full benchmark details live in [`benchmarks/frontend-harness/README.md`](benchmarks/frontend-harness/README.md).

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

```bash
fooks install opencode-tool
```

This creates a project-local custom-tool:

```text
.opencode/tools/fooks_extract.ts
```

Use it when you want opencode to request a fooks payload for a `.tsx` or `.jsx` file.

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

Useful internal docs:

- Runtime bridge contract: [`docs/runtime-bridge-contract.md`](docs/runtime-bridge-contract.md)
- Live feedback checklist: [`docs/codex-live-feedback-checklist.md`](docs/codex-live-feedback-checklist.md)
- Release checklist: [`docs/release.md`](docs/release.md)
- Benchmark harness: [`benchmarks/frontend-harness/README.md`](benchmarks/frontend-harness/README.md)
