# fooks

Product / package / primary CLI name: `fooks`
Local frontend-only context compression engine for React/TSX files.

## What it does

`fooks` reduces AI read cost before a coding runtime opens full frontend source by returning one of:

- `raw`
- `compressed`
- `hybrid`

Phase 1 is intentionally narrow:

- React / TSX / JSX focused
- same-folder linked `.ts` only (`type` imports, props/interface/type aliases, adjacent util/helper files)
- local scan / extract / decide / attach flow
- runtime-agnostic core schema with thin adapters

## Commands

```bash
fooks init
fooks scan
fooks extract <file> --json
fooks extract <file> --model-payload
fooks decide <file>
fooks codex-pre-read <file>
fooks codex-runtime-hook --event <SessionStart|UserPromptSubmit|Stop>
fooks codex-runtime-hook --native-hook
fooks install codex-hooks
fooks status codex
fooks attach codex
fooks attach claude
```

The shipping product name and all supported runtime/storage names are `fooks`.

## Account context

Attach commands resolve account context in this order:

1. `FOOKS_ACTIVE_ACCOUNT`
2. `.fooks/config.json` `targetAccount`
3. `git remote get-url origin`
4. `package.json.repository`

For this project, the expected target account is `minislively`.

## Runtime proof

Attach uses two proof layers:

- **contract proof**: verifies adapter consumption of the core schema
- **runtime proof**: writes a runtime manifest into a detected runtime home

Environment overrides for deterministic verification:

- `FOOKS_CODEX_HOME`
- `FOOKS_CLAUDE_HOME`
- `FOOKS_TARGET_ACCOUNT`
- `FOOKS_ACTIVE_ACCOUNT`

If a runtime home is missing, attach returns an explicit blocker instead of a false success.

## Verification snapshot

Current verification snapshot:

- `npm run typecheck`
- `npm test`
- `npm run bench:cache`
- `npm run bench:extract`
- `npm run bench:stability`
- `npm run bench:gate`
- `npm run bench`
- TypeScript diagnostics: 0 errors
- value-proof:
  - `FormSection.tsx`: 34.59% reduction
  - `DashboardPanel.tsx`: 46.63% reduction
- latest benchmark baseline (`benchmarks/results/latest/benchmark.json`):
  - cold avg: 648.78ms
  - warm avg: 142.33ms
  - partial single avg: 449.9ms
  - partial multi avg: 398.58ms
  - rescan after invalidation avg: 635ms
  - warm runtime split:
    - CLI wall: 142.33ms
    - scan core: 14.67ms
    - outside-scan: 127.66ms
  - warm outside-scan breakdown:
    - command dispatch: 22.51ms
    - result serialization: 0.18ms
    - stdout write: 5.84ms
    - unattributed residual: 99.13ms
  - warm dispatch sub-breakdown:
    - paths import: 7.58ms
    - scan import: 14.52ms
    - ensure dirs: 0.37ms
    - dispatch residual: 0.04ms
  - warm harness/process floor:
    - bare node process: 90.5ms
    - cli bootstrap without command: 108.72ms
    - cli bootstrap residual over bare node: 18.22ms
  - scan observability now captures:
    - step timings (`discovery`, `stat`, `fileRead`, `hash`, `cacheRead`, `extract`, `cacheWrite`, `indexWrite`, `total`)
    - skip/hit/miss structure (`metadataReuseCount`, `fileReadCount`, `reparsedFileCount`)
    - top slow files per scenario
    - outside-scan command-path breakdown (`commandDispatchMs`, `resultSerializeMs`, `stdoutWriteMs`, `commandPathUnattributedMs`)
    - scan startup sub-buckets (`pathsModuleImportMs`, `scanModuleImportMs`, `ensureProjectDataDirsMs`, `commandDispatchResidualMs`)
    - benchmark-harness overhead (`stdoutParseMsByScenario`, `bareNodeProcessAvgMs`, `cliBootstrapNoCommandAvgMs`, `cliBootstrapResidualAvgMs`, `artifactWriteMs`)
- current optimization read: unchanged-file rereads are under control, measured `scan` startup work is much smaller than before, and the next remaining startup cost is largely explained by bare Node process launch plus a smaller CLI bootstrap residual
- optimization follow-up ranking: [`docs/benchmark-phase-2-optimization-candidates.md`](docs/benchmark-phase-2-optimization-candidates.md)

## Frontend Benchmark Harness (vs vanilla Codex)

Real-world benchmark comparing **vanilla Codex** vs **fooks-enabled Codex** on frontend tasks.

### Latest Results (2025-04-14)

| Metric | Vanilla | Fooks | Improvement |
|--------|---------|-------|-------------|
| **Token Reduction** | ~2.1M tokens | ~450K tokens | **-78.2%** |
| **Execution Time** | 98,216ms | 77,929ms | **+20.7% faster** |
| **Tokens Saved** | - | **~1.76M per session** | - |
| **Success Rate** | 100% (5/5) | 100% (5/5) | - |

**Tested on:**
- shadcn-ui (2,967 TSX files)
- cal.com (1,691 TSX files)
- 5 tasks: Button Relocation → Form Validation (easy → hard)

**Location:** `benchmarks/frontend-harness/`

**Quick reproduction:**
```bash
cd benchmarks/frontend-harness/runners
python3 setup.py          # Check environment
python3 quick-test.py     # 5-10 min single test
python3 full-benchmark-suite.py  # 30-60 min full suite
```

See [`benchmarks/frontend-harness/README.md`](benchmarks/frontend-harness/README.md) for detailed setup and reproduction instructions.

## Model-facing payload

`extract` keeps the canonical extraction output by default. For a leaner LLM-delivery view:

```bash
fooks extract fixtures/compressed/FormSection.tsx --model-payload
```

The model-facing payload:

- keeps `mode`, relative `filePath`, `componentName`, `exports`
- keeps `contract`, `behavior`, `structure`, minimal `style`
- keeps `snippets` for hybrid outputs
- drops engine metadata such as `fileHash` and `meta.generatedAt`

## Codex pre-read decision seam

The first Codex-specific pre-read seam is exposed as a debug surface:

```bash
fooks codex-pre-read fixtures/compressed/FormSection.tsx
```

It is intentionally narrow in v1:

- `.tsx/.jsx` only
- payload-first, never payload-only
- falls back to `full-read` for:
  - `raw-mode`
  - `missing-contract`
  - `missing-behavior`
  - `missing-structure`
  - `missing-hybrid-snippets`
  - `ineligible-extension`

This command proves the decision/debug seam that a future automatic Codex hook can reuse. It is **not** the full runtime-wide interception layer yet.

## Codex runtime hook bridge

`fooks` now exposes a first runtime-hook bridge that is grounded in the Codex hook surfaces we can actually verify locally today:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The v1 bridge is intentionally narrow:

- `.tsx/.jsx` only
- repeated same-file work in one session
- quiet by default
- full-read escape hatch via `#fooks-full-read` or `#fooks-disable-pre-read`
- only active inside repos that already ran `fooks attach codex`

Example debug flow:

```bash
fooks codex-runtime-hook --event SessionStart --session-id demo
fooks codex-runtime-hook --event UserPromptSubmit --session-id demo --prompt "Please update fixtures/compressed/FormSection.tsx"
fooks codex-runtime-hook --event UserPromptSubmit --session-id demo --prompt "Again, update fixtures/compressed/FormSection.tsx"
```

Expected behavior:

- first prompt mention records the file quietly
- second prompt mention can reuse `fooks` pre-read payload and emits a one-line header like `fooks: reused pre-read (<mode>) · file: <path>`
- override markers force immediate full-read fallback and emit `fooks: full read requested · file: <path> · Read the full source file for this turn.`
- readiness fallback emits `fooks: fallback (<reason>) · file: <path> · Read the full source file for this turn.`

This is a **prompt/session bridge**, not a claim that Codex already exposes a universal low-level file-read hook.

For Codex native hook wiring, the repo-side bridge can also read the hook payload from stdin:

```bash
fooks codex-runtime-hook --native-hook
```

Preferred install path (writes or merges the Codex hook preset into `~/.codex/hooks.json`):

```bash
fooks install codex-hooks
```

The installer is idempotent: it only adds the `fooks codex-runtime-hook --native-hook` command to `SessionStart`, `UserPromptSubmit`, and `Stop` when those entries are missing, and preserves other hooks already present in `~/.codex/hooks.json`.

For a lightweight trust/debug surface after attach, inspect the Codex runtime status:

```bash
fooks status codex
```

This keeps the product UX quiet by default while still exposing the minimum trust signals we care about in Phase 2B:

- connection state
- lifecycle state (`ready`, `refreshing`, `attach-prepared`, ...)
- last scan / refresh timestamps
- current active file when an attach package was prepared

For a real-world feedback loop after installation, use the checklist in [`docs/codex-live-feedback-checklist.md`](docs/codex-live-feedback-checklist.md).

For the next Phase 2B step — validating remaining trust/refresh/source-of-truth risks in real usage — use [`docs/phase-2b-risk-validation-checklist.md`](docs/phase-2b-risk-validation-checklist.md).

If you prefer to edit the file manually, add this preset:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "fooks codex-runtime-hook --native-hook"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "fooks codex-runtime-hook --native-hook"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "fooks codex-runtime-hook --native-hook"
          }
        ]
      }
    ]
  }
}
```

When the current cwd is not a Codex-attached `fooks` project, the native hook bridge exits quietly without output.

## Benchmark suite

You can now validate the phase-1 benchmark baseline with:

```bash
npm test
npm run bench:cache
npm run bench:extract
npm run bench:stability
npm run bench:gate
npm run bench
```

Phase 1 keeps the suite **local-first**, **JSON-first**, and **dependency-neutral**.

- `bench:cache` keeps the legacy cache benchmark entrypoint, but now resolves to the dedicated scan/cache suite
- `bench:extract` records file-type extraction cost and reduction metrics for the v1 fixture corpus
- `bench:stability` captures repeated-run distributions for scan and extract timings
- `bench:gate` evaluates lightweight preservation + mode-decision guardrails
- `bench` runs the full benchmark suite and writes the canonical envelope used for before/after optimization comparisons

Generated result artifacts are written under:

- `benchmarks/results/latest/`
- `benchmarks/results/history/`

The canonical benchmark envelope includes:

- benchmark version / run id / git SHA / node version / platform
- scan/cache suite output
- scan observability for timing splits, skip/hit/miss counters, slow files, and CLI-vs-scan runtime breakdowns
- extract suite output
- repeated-run stability output
- preservation + mode-decision results
- final gate pass/fail summary

## Real repo testing

After fixture-level verification, validate against an actual React/TSX
repo using:

- cold/warm/partial scan behavior
- representative `decide` checks
- canonical `extract` vs `extract --model-payload`
- one real edit task against compressed/hybrid outputs

See `docs/real-repo-validation.md`.

## Notes

- Core logic stays adapter-agnostic.
- Runtime attach remains environment-dependent by design, but now fails honestly with blocker evidence.


Canonical runtime/storage naming:

- CLI / package name: `fooks`
- project state dir: `.fooks/`
- runtime-home manifest dir: `fooks/attachments`
- supported env names: `FOOKS_*`
- legacy removal record: [`docs/legacy-removal-checklist.md`](docs/legacy-removal-checklist.md)
