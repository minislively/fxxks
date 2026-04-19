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
fooks status cache
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

## Environment detection proof

Attach uses two proof layers:

- **contract proof**: verifies adapter consumption of the core schema
- **environment proof**: writes an adapter manifest into a detected config home

Environment overrides for deterministic verification:

- `FOOKS_CODEX_HOME`
- `FOOKS_CLAUDE_HOME`
- `FOOKS_TARGET_ACCOUNT`
- `FOOKS_ACTIVE_ACCOUNT`

If a config home is missing, attach returns an explicit blocker instead of a false success.

**Note**: This is adapter-layer integration (codex/omx hooks), not browser/E2E runtime interception—those remain out of current Layer 2 scope.

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
- latest benchmark baseline (real-world usage):
  - **cyberthug-screenclone** (14 components): **warm 226ms**
  - **shadcn-ui** (2,967 components): **cold 5.45s**
  - **Token savings rate**: **86.9%** verified (fixture baseline: 53.55ms warm)
  - **Fixture baseline** (81 files): **cold 312ms / warm 49.5ms** (updated 2026-04-14)
  - Definitions:
    - **Cold**: First run (no cache built)
    - **Warm**: Subsequent runs (cache already built)
  - scan observability captures:
    - step timings (`discovery`, `stat`, `fileRead`, `hash`, `cacheRead`, `extract`, `cacheWrite`, `indexWrite`, `total`)
    - skip/hit/miss structure (`metadataReuseCount`, `fileReadCount`, `reparsedFileCount`)
    - top slow files per scenario
    - outside-scan command-path breakdown (`commandDispatchMs`, `resultSerializeMs`, `stdoutWriteMs`, `commandPathUnattributedMs`)
    - scan startup sub-buckets (`pathsModuleImportMs`, `scanModuleImportMs`, `ensureProjectDataDirsMs`, `commandDispatchResidualMs`)
    - benchmark-harness overhead (`stdoutParseMsByScenario`, `bareNodeProcessAvgMs`, `cliBootstrapNoCommandAvgMs`, `cliBootstrapResidualAvgMs`, `artifactWriteMs`)
- current optimization read: unchanged-file rereads are under control, measured `scan` startup work is much smaller than before, and the next remaining startup cost is largely explained by bare Node process launch plus a smaller CLI bootstrap residual
- optimization follow-up ranking: [`docs/benchmark-phase-2-optimization-candidates.md`](docs/benchmark-phase-2-optimization-candidates.md)
- adoption guardrail for future launcher/helper work: [`docs/performance-vs-operational-complexity.md`](docs/performance-vs-operational-complexity.md)
- real-environment validation checklist for launcher/helper decisions: [`docs/real-environment-process-model-validation.md`](docs/real-environment-process-model-validation.md)

## Frontend Benchmark Harness (vs vanilla Codex)

Real-world benchmark comparing **vanilla Codex** vs **fooks-enabled Codex** on frontend tasks.

### Latest Results (2026-04-14 Final Rerun)

| Metric | Vanilla | Fooks | Improvement | Note |
|--------|---------|-------|-------------|------|
| **Token Reduction** | ~2.1M tokens (est.) | ~450K tokens (est.) | **-78.2%** | Real repos (shadcn-ui, cal.com) |
| **Execution Time** | 98,216ms (avg) | 77,929ms (avg) | **+20.7% faster** | T1-T5 tasks average |
| **Tokens Saved** | - | **~1.76M per session** (est.) | - | Estimated from sample runs |
| **Success Rate** | 100% (5/5) | 100% (5/5) | - | All task levels |
| **Component Compression** | - | 7x-15x | - | Large components (17KB-42KB) |
| **Tiny Overhead** | - | ~2x | - | <500B files, acceptable |

**Verified Component-like Files (after all fixes):**
- EventLimitsTab.tsx (41KB) → 3,115 bytes (**13.5x**)
- AvailabilitySettings.tsx (29KB) → 1,988 bytes (**14.9x**)
- shadcn page.tsx (5.7KB) → 421 bytes (**13.8x**)

**Excluded from component benchmark:**
- icons.tsx (18KB, 154 exports) → data-like
- story-helpers.tsx (12KB, no componentName) → helper

**Tested on:**
- shadcn-ui (2,967 TSX files)
- cal.com (1,691 TSX files)
- nextjs (28,614 TSX files) - meta-framework extraction (20 files tested)
- tailwindcss (2,500 TS files) - CSS framework extraction (20 files tested)
- 5 tasks: Button Relocation → Form Validation (easy → hard)

**Framework Extraction Reference (2026-04-16 Expanded):**
| Repo | Total Files | Raw Mode | Extract/Hybrid | Reference Compression Ratio | Notes |
|------|-------------|----------|----------------|----------------------------|-------|
| nextjs | 20 | 11 (55%) | 9 (45%) | **55.7% smaller (extract mode)** | Small files dominant; reference only, not task parity |
| tailwindcss | 20 | 5 (25%) | 15 (75%) | **77.8% smaller (extract mode)** | AST parsing heavy; reference only, not task parity |

- Expanded from 5 files to 20 files per repo (size-distributed sampling)
- Raw mode overhead is expected (JSON metadata wrapper); actual delivery uses `useOriginal: true` for tiny files
- Framework repos are **extraction-test-reference only** — not comparative gating, not task parity benchmark

**Fixes applied since previous run:**
- AST-based styleBranching detection (tiny files now raw correctly)
- componentName requirement for hybrid (helper files excluded)
- exports <= 20 limit (data-like files excluded)

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
- for tiny raw files (`raw` mode and source under 500 bytes), sets `useOriginal: true` and returns only the original source payload
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
  - `raw-mode` (except tiny raw files under 500 bytes, which reuse the original source as a minimal payload)
  - `missing-contract`
  - `missing-behavior`
  - `missing-structure`
  - `missing-hybrid-snippets`
  - `ineligible-extension`

This command proves the decision/debug seam that a future automatic Codex hook can reuse. It is **not** the full runtime-wide interception layer yet.

## Codex adapter hook bridge

`fooks` exposes an adapter hook bridge grounded in Codex CLI hook surfaces:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The v1 bridge is intentionally narrow:

- `.tsx/.jsx` only
- Repeated same-file work in one session
- Quiet by default
- Full-read escape hatch via `#fooks-full-read` or `#fooks-disable-pre-read`
- Only active inside repos that already ran `fooks attach codex`

**Scope**: This is adapter-layer integration (CLI hooks), not browser/E2E runtime interception—those remain out of current Layer 2 scope.

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

For lightweight trust/debug surfaces after attach or before first scan, inspect runtime and cache status:

```bash
fooks status codex
fooks status cache
```

`fooks status cache` reports whether the local cache is `empty`, `healthy`, `recovered`, or `corrupted`, plus entry count and backup availability. Fresh repos now report `empty` until the first scan builds `.fooks/index.json`.

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
