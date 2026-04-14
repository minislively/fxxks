# Fooks Frontend Benchmark Harness

Frontend-specific benchmark comparing vanilla Codex vs fooks-enabled Codex.
Similar to TerminalBench/SWE-Bench but focused on frontend codebases.

## Latest Results (2025-04-14)

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

### Custom Configuration

Override default paths via environment variables:

```bash
# Custom test repos location
export BENCHMARK_REPOS_DIR=/path/to/your/repos

# Custom OMX binary location
export OMX_BIN=/path/to/omx.js

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

| Repository | TSX Files | Size | Notes |
|------------|-----------|------|-------|
| shadcn-ui/ui | 2,967 | 118MB | UI component library |
| calcom/cal.com | 1,691 | 562MB | Scheduling app |
| documenso/documenso | 621 | 174MB | Doc signing |
| formbricks/formbricks | 882 | 192MB | Survey tool |

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
4. **Files Modified**: Number of files changed during task
5. **Success Rate**: Task completion without timeout/error

## Methodology

1. Create isolated git worktree per test variant
2. Setup isolated `.codex` folder (symlink auth.json, config.toml)
3. Run vanilla Codex vs fooks-enabled Codex
4. Measure time, token compression, files modified
5. Clean up worktrees
6. Aggregate results across tasks/repos

### Key Insights

1. **Token Efficiency**: Fooks compresses codebase context by ~78%, saving ~1.76M tokens per session
2. **Speed**: Average 20.7% faster execution on typical tasks
3. **Scalability**: Works effectively on large repos (cal.com: 1,691 TSX files)
4. **Isolation**: Each benchmark uses isolated `.codex` folders per worktree

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
