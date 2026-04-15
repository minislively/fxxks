# Benchmark History Index

Master index of all benchmark runs on 2026-04-14. Files are organized by significance and type.

## Directory Structure

```
history/
├── HISTORY_INDEX.md (this file)
├── archive/
│   ├── benchmark/     (10 intermediate runs)
│   ├── scan-cache/    (17 supporting runs)
│   ├── extract/       (8 supporting runs)
│   └── gate/          (8 supporting runs)
├── 2026-04-14T19-13-...-benchmark.json (Final Rerun - Key Milestone)
├── 2026-04-14T06-50-...-benchmark.json (First Run - Baseline)
├── 2026-04-14T22-02-...-scan-cache.json (Latest)
├── 2026-04-14T22-02-...-process-model-probe.json (Process Model Analysis)
├── 2026-04-14T22-02-...-scan-cache.json (Latest duplicate - archived)
├── 2026-04-14T22-02-...-extract.json (Latest)
└── 2026-04-14T22-02-...-gate.json (Latest)
```

## Key Milestone Runs (Root Level)

| Time | File | Type | Significance |
|------|------|------|--------------|
| 06:50 | `2026-04-14T06-50-31-778Z-benchmark.json` | benchmark | First run of the day - baseline establishment |
| 19:13 | `2026-04-14T19-13-43-739Z-benchmark.json` | benchmark | Final Rerun - Post-fixes validation |
| 22:02 | `2026-04-14T22-02-37-326Z-scan-cache.json` | scan-cache | Latest scan-cache (process-model-probe run) |
| 22:02 | `2026-04-14T22-02-39-926Z-process-model-probe.json` | process-model | Process model analysis with helper timing |
| 22:02 | `2026-04-14T22-02-41-092Z-scan-cache.json` | scan-cache | Latest scan-cache (duplicate) |
| 22:02 | `2026-04-14T22-02-43-732Z-extract.json` | extract | Latest extract results |
| 22:02 | `2026-04-14T22-02-43-966Z-gate.json` | gate | Latest gate validation |

## Intermediate Runs (Archive)

### Benchmark Runs
- 2026-04-14T07-53-57-161Z-benchmark.json
- 2026-04-14T08-07-18-131Z-benchmark.json  
- 2026-04-14T08-43-07-541Z-benchmark.json
- 2026-04-14T12-35-38-327Z-benchmark.json
- 2026-04-14T14-58-55-274Z-benchmark.json
- 2026-04-14T14-59-05-129Z-benchmark.json
- 2026-04-14T14-59-16-341Z-benchmark.json
- 2026-04-14T15-00-13-127Z-benchmark.json
- 2026-04-14T15-02-23-745Z-benchmark.json
- 2026-04-14T15-02-46-148Z-benchmark.json

### Supporting Files
- `archive/scan-cache/` - 17 scan-cache runs (06:50 - 15:00)
- `archive/extract/` - 8 extract runs (06:50 - 15:00)
- `archive/gate/` - 8 gate runs (06:50 - 15:00)

## Benchmark Evolution Summary

| Phase | Time | Key Metric | Notes |
|-------|------|------------|-------|
| Baseline | 06:50 | Cold: 312ms, Warm: 49.5ms | First fixture run |
| Intermediate | 07:53-15:02 | Various iterations | Development/debug runs |
| Final Rerun | 19:13 | Component: 7x-15x compression | Post-all-fixes validation |
| Process Model | 22:02 | Helper: 15.99ms direct | Process model analysis |

## Notes

- All runs from 2026-04-14 (single day of intensive benchmarking)
- Archive preserves full traceability
- Root level shows only representative/key runs
- Latest supporting files (scan-cache/extract/gate) kept at root for quick access

Last indexed: 2026-04-15
