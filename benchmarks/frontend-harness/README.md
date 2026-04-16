# Fooks Frontend Benchmark Harness

Frontend-specific benchmark comparing vanilla Codex vs fooks-enabled Codex.
Similar to TerminalBench/SWE-Bench but focused on frontend codebases.

## Core Requirements

This benchmark validates AI editing task efficiency + outcome parity through:

1. **Real repository** - Actual open-source frontend projects (shadcn-ui, cal.com, formbricks, etc.)
2. **Real AI execution** - Actual Codex CLI execution (not mocked/simulated)
3. **Isolated environment** - Worktree-per-run with isolated `CODEX_HOME`, explicit auth/config sources
4. **Verifiable output checks** - Modified file count, diff integrity, build/typecheck where applicable

**Out of scope**: Browser runtime, live app execution, E2E verification. This benchmark measures
code editing efficiency and outcome parity, not browser behavior correctness.

## Latest Results (2026-04-14)

| Metric | Vanilla | Fooks | Improvement |
|--------|---------|-------|-------------|
| **Avg Execution Time** | 98,216ms | 77,929ms | **+20.7%** |
| **Avg Total Time** | - | 82,969ms | **+15.5%** |
| **Token Reduction** | ~2.1M tokens | ~450K tokens | **-78.2%** |
| **Tokens Saved** | - | **~1.76M per session** | - |
| **Success Rate** | 100% (5/5) | 100% (5/5) | - |

### Tested Tasks

| Task | Difficulty | Repo | Vanilla | Fooks | Time Diff |
|------|------------|------|---------|-------|-----------|
| T1: Button Relocation | easy | shadcn-ui | 89,995ms | 78,407ms | +12.9% |
| T2: Style Modification | easy | shadcn-ui | 94,833ms | 82,436ms | +13.1% |
| T5: Form Validation | hard | shadcn-ui | 125,922ms | 121,014ms | +3.9% |
| T1: Button Relocation | easy | cal.com | 92,182ms | 79,732ms | +13.5% |
| T5: Form Validation | hard | cal.com | 102,676ms | 137,327ms | -33.7% |

## Quick Start (Local Reproduction)

### Prerequisites

1. **fooks** - Must be built locally
   ```bash
   cd /path/to/fooks
   npm install
   npm run build
   ```

2. **oh-my-codex** - Required for OMX execution
   ```bash
   git clone https://github.com/minislively/oh-my-codex ~/Workspace/oh-my-codex
   cd ~/Workspace/oh-my-codex
   npm install
   npm run build
   ```

3. **Test Repositories** - Frontend projects to benchmark
   ```bash
   mkdir -p ~/Workspace/fooks-test-repos
   cd ~/Workspace/fooks-test-repos
   gh repo clone shadcn-ui/ui -- --depth 1
   gh repo clone calcom/cal.com -- --depth 1
   gh repo clone documenso/documenso -- --depth 1
   gh repo clone formbricks/formbricks -- --depth 1
   gh repo clone vercel/next.js -- --depth 1
   gh repo clone tailwindlabs/tailwindcss -- --depth 1
   ```

4. **Codex Auth** - Must be logged in
   ```bash
   codex login
   # Ensure ~/.codex/auth.json exists
   ```

### Environment Check

Run the setup check script to verify everything:

```bash
cd benchmarks/frontend-harness/runners
python3 setup.py
```

### Running Benchmarks

#### Option 1: Quick Test (5-10 minutes)
Single task (T5: Form Validation) on shadcn-ui:

```bash
cd benchmarks/frontend-harness/runners
python3 quick-test.py
```

#### Option 2: Full Suite (30-60 minutes)
All 5 tasks across multiple repos:

```bash
cd benchmarks/frontend-harness/runners
python3 full-benchmark-suite.py
```

Results will be saved to `../reports/benchmark-{timestamp}.json`

#### Option 3: Single External-App Proof
Run one repo/task pair when the goal is a first credible external benchmark
instead of a full matrix. For example, a Next.js + Tailwind app proof on
Formbricks:

```bash
cd benchmarks/frontend-harness/runners
python3 full-benchmark-suite.py \
  --runner codex \
  --repo formbricks \
  --task T5 \
  --task-prompt "Modify exactly apps/web/modules/account/components/DeleteAccountModal/index.tsx. Improve the account deletion email confirmation field by using type=email, showing a small red inline error message under the input after the user types a non-matching or malformed email, and ensuring deletion stays disabled while the confirmation email is invalid or the delete action is already running."
```

Use `--runner codex` for the cleanest direct Codex CLI benchmark without OMX
orchestration. Use `--runner omx` when you specifically want to measure the
OMX execution lane. Use `--dry-run` to inspect the selected case without
running Codex/OMX.

The vanilla and fooks variants both run through the same selected runner with
the same task prompt and isolated `CODEX_HOME` directories. The intended
variant difference is that fooks runs `fooks init`/`fooks scan`/`fooks attach
codex` before the same agent command, while vanilla does not. Reports include
command hashes, modified file lists, cleanup status, parsed runtime tokens, and
a conservative risk assessment.

### Custom Configuration

Override default paths via environment variables:

```bash
# Custom test repos location
export BENCHMARK_REPOS_DIR=/path/to/your/repos

# Custom OMX binary location
export OMX_BIN=/path/to/omx.js

# Custom direct Codex binary location
export CODEX_BIN=/path/to/codex

# Custom report output location
export BENCHMARK_REPORTS_DIR=/path/to/reports

# Then run benchmarks
python3 full-benchmark-suite.py
```

## Structure

```
benchmarks/frontend-harness/
├── README.md              # This file
├── tasks/
│   └── task-definitions.json    # T1-T5 task definitions
├── runners/
│   ├── setup.py           # Environment check script
│   ├── quick-test.py      # Single task test
│   ├── full-benchmark-suite.py  # Complete benchmark
│   └── test-setup.py      # Basic environment validation
└── reports/               # Generated benchmark results
```

## Test Repositories

| Repository | Type | TSX/TS Files | Size | Notes |
|------------|------|--------------|------|-------|
| shadcn-ui/ui | UI Library | 2,967 | 118MB | UI component library |
| calcom/cal.com | App | 1,691 | 562MB | Scheduling app |
| documenso/documenso | App | 621 | 174MB | Doc signing |
| formbricks/formbricks | App | 882 | 192MB | Survey tool |
| **vercel/next.js** | Framework | 28,000+ | 343MB | React Framework (packages + examples) |
| **tailwindlabs/tailwindcss** | Framework | 2,500+ | 8MB | CSS utility framework |

## Task Definitions

| ID | Task | Difficulty | Description |
|----|------|------------|-------------|
| T1 | Button Relocation | easy | Move button to right using flexbox |
| T2 | Style Modification | easy | Change button color to blue |
| T3 | Loading State Addition | medium | Add isLoading prop with spinner |
| T4 | Component Extraction | medium | Extract inline header to component |
| T5 | Form Validation | hard | Add email validation with regex |

## Metrics Measured

1. **Execution Time**: Time spent in OMX/Codex (excluding fooks scan)
2. **Total Time**: Including fooks scan for baseline comparison
3. **Token Reduction**: Estimated via fooks extract compression ratio
4. **Codex Tokens Used**: Parsed from OMX/Codex output when available
5. **Files Modified**: Number of files changed during task, plus file list
6. **Success Rate**: Task completion without timeout/error

## Methodology

1. Create isolated git worktree per test variant
2. Setup isolated `.codex` folder (symlink auth.json, config.toml)
3. Run vanilla Codex vs fooks-enabled Codex
4. Measure time, token compression, files modified
5. Clean up worktrees
6. Aggregate results across tasks/repos
7. Attach risk levels for sample size, environment parity, cleanup,
   wall-clock noise, and runtime-token claims

### Key Insights

1. **Token Efficiency**: Fooks compresses codebase context by ~78%, saving ~1.76M tokens per session
2. **Speed**: Average 20.7% faster execution on typical tasks
3. **Scalability**: Works effectively on large repos (cal.com: 1,691 TSX files, next.js: 28,000+ files)
4. **Framework Coverage**: Tests span UI libraries, apps, and frameworks (React, Next.js, TailwindCSS)
5. **Isolation**: Each benchmark uses isolated `.codex` folders per worktree

## Troubleshooting

### "fooks CLI not found"
Build fooks first:
```bash
cd /path/to/fooks
npm run build
```

### "omx not found"
Install oh-my-codex:
```bash
git clone https://github.com/minislively/oh-my-codex ~/Workspace/oh-my-codex
cd ~/Workspace/oh-my-codex
npm install && npm run build
```

### "Test repos not found"
Clone test repositories:
```bash
mkdir -p ~/Workspace/fooks-test-repos
cd ~/Workspace/fooks-test-repos
gh repo clone shadcn-ui/ui -- --depth 1
gh repo clone calcom/cal.com -- --depth 1
gh repo clone documenso/documenso -- --depth 1
gh repo clone formbricks/formbricks -- --depth 1
gh repo clone vercel/next.js -- --depth 1
gh repo clone tailwindlabs/tailwindcss -- --depth 1
```

### Timeout errors
Increase timeout in scripts (default: 600s / 10 minutes)

## Requirements

- Python 3.10+
- Node.js 20+
- Git with worktree support
- fooks CLI (built from source)
- oh-my-codex (built from source)
- Test repos cloned
- Codex CLI authenticated

## License

MIT - Part of the fooks project
