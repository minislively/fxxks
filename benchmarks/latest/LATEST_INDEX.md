# Latest Benchmark Results

> Current validated benchmark results

---

## 📊 Current Status Summary

| Item | Value |
|------|-------|
| **Date** | 2026-04-15 |
| **Target Repos** | nextjs 4 files + tailwindcss 5 files |
| **Success Count** | 9/9 files (100%) |
| **Avg Savings** | 85.3% |
| **Extractor Path** | real (local/dist) |

**Status:** ✅ Validated real fooks execution  
**Type:** Copy (mirrored from history, not symlinked)  
**Quality Signal Type:** derived-heuristic  

---

## Current Real Benchmark

**File:** `current-real-benchmark.json` (copy from history)  
**History:** `../history/2026-04-15-real-benchmark.json` (source of truth)  
**Status:** ✅ Validated, real fooks path  
**Date:** 2026-04-15

### Quick Stats
| Metric | Value |
|--------|-------|
| Files | 9 (nextjs 4 + tailwindcss 5) |
| Success | 100% |
| Real Path | 100% |
| Avg Savings | 85.3% |
| Quality | 0.88 (derived-heuristic) |

### File Type Note
`current-real-benchmark.json` is a **mirrored copy** of the history file, not a symlink.  
This ensures the latest directory always has a readable copy even if the history structure changes.

### Supporting Documents
- 📋 [Sample Selection Criteria](SAMPLE_SELECTION_CRITERIA.md) - Why these files
- 📊 [Quality Calculation](QUALITY_CALCULATION.md) - How signals are computed (derived-heuristic)
- 📚 [History Index](../history/HISTORY_INDEX.md) - Full benchmark history

### Verification
```bash
# Verify real fooks path
node -e "require('<fooks-repo>/dist/index.js').extractFile('<file>')"

# Check extractorPath in result
cat current-real-benchmark.json | grep -A2 '"extractorPath"'
# Should show: "extractorPath": "real"

# Check file type (copy, not symlink)
ls -la current-real-benchmark.json
# Should show: regular file (not -> symlink)
```

---

*Index maintained by: 에르가재*  
*Last updated: 2026-04-15*  
*File type: Copy (not symlink)*
