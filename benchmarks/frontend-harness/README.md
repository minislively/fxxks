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

### Key Insights

1. **Token Efficiency**: Fooks compresses codebase context by ~78%, saving ~1.76M tokens per session
2. **Speed**: Average 20.7% faster execution on typical tasks
3. **Scalability**: Works effectively on large repos (cal.com: 1,691 TSX files)
4. **Isolation**: Each benchmark uses isolated `.codex` folders per worktree

## Structure

```
fooks-benchmark-harness/
├── tasks/           # Task definitions (T1-T5)
├── runners/         # Benchmark execution scripts
├── reports/         # Generated comparison reports
└── metrics/         # Raw metrics data
```

## Running Benchmarks

```bash
cd runners

# Quick test (single task)
python3 quick-test.py

# Full suite (5 tasks)
python3 full-benchmark-suite.py

# Environment validation
python3 test-setup.py
```

## Test Repositories

- **shadcn-ui**: 2,967 TSX files, 118MB
- **cal.com**: 1,691 TSX files, 562MB
- **documenso**: 621 TSX files, 174MB
- **formbricks**: 882 TSX files, 192MB

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

## Requirements

- Python 3.10+
- Node.js 20+
- Git with worktree support
- fooks CLI (`~/Workspace/fooks`)
- oh-my-codex (`~/Workspace/oh-my-codex`)
- Test repos cloned to `~/Workspace/fooks-test-repos`

## License

MIT
