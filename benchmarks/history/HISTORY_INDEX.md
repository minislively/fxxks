# Benchmark History Index

> Real fooks benchmark execution history

## 2026-04-15 - Real Benchmark Result (VALIDATED)

**Status:** ✅ Real fooks path execution complete  
**Label:** `real-benchmark-result`  
**Timestamp:** 2026-04-15T06:40:57  
**File:** `history/2026-04-15-real-benchmark.json`  
**Type:** Copy (mirrored from source, not symlinked)

### Quick Summary
| Metric | Value |
|--------|-------|
| **Date** | 2026-04-15 |
| **Target** | nextjs 4 + tailwindcss 5 |
| **Success** | 9/9 files (100%) |
| **Avg Savings** | 85.3% |
| **Extractor** | real (local/dist path) |

### Detailed Summary
| Metric | Value |
|--------|-------|
| Total Files | 9 (nextjs 4 + tailwindcss 5) |
| Success Rate | 100% (9/9) |
| Real Path Usage | 100% (9/9) |
| Avg Savings | 85.3% |
| Extractor | real (local/dist) |

### Repos Covered
- **nextjs:** 4/4 files, 78.8% avg savings
- **tailwindcss:** 5/5 files, 91.8% avg savings

### Quality Signals (Derived-Heuristic)
**Signal Type:** `derived-heuristic` (calculated from extraction output fields, not direct measurement)

| Repo | Contract | Behavior | Structure | Overall |
|------|----------|----------|-----------|---------|
| nextjs | 0.86 | 0.88 | 0.90 | **0.88** |
| tailwindcss | 0.88 | 0.88 | 0.90 | **0.89** |
| **Combined** | 0.87 | 0.88 | 0.90 | **0.88** |

**Calculation Basis:**
- Source: Real fooks extraction output fields (`contract`, `behavior`, `structure`)
- Formula: `hasField ? highValue : lowValue`
- Contract: 0.92 (has) / 0.70 (no)
- Behavior: 0.88 (has) / 0.75 (no)
- Structure: 0.90 (has) / 0.70 (no)

**Note:** app-bootstrap.ts (nextjs) and index.ts (tailwindcss) have C=0.70 due to minimal contract info, showing actual variance.

### Sample Selection Criteria
See: `latest/SAMPLE_SELECTION_CRITERIA.md`

### Quality Calculation Rationale
See: `latest/QUALITY_CALCULATION.md`

---

## Previous Runs

### 2026-04-15 - Simulation Baseline
**Status:** ⚠️ Simulation-based (not real fooks)  
**File:** `results/latest/nextjs-tailwindcss-validation.json` (deprecated)  
**Note:** Simulation results archived for comparison only. Use real benchmark for decisions.

---

*Index maintained by: 에르가재*  
*Last updated: 2026-04-15*  
*File type: Copy (not symlink)*
