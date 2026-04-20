# Fooks Auto Mode Implementation Plan

> Historical planning note. This document records an earlier proposed UX and is
> not the current claim surface. Current `fooks run` behavior is a shared/manual
> handoff path; size percentages should be treated as estimated extraction
> opportunity, not delivered runtime-token savings for Claude.

## Current State

### Already Implemented
- `fooks init` - Project initialization with auto mode default
- `fooks scan` - Repository scanning and caching
- `fooks extract` - File extraction with mode decision
- `fooks decide` - Auto mode selection (raw/hybrid/compressed)
- `fooks attach` - Runtime integration (codex/claude)
- `fooks status` - Cache and project status
- Core extraction engine (decide.ts) with 3-tier classification

### Spec-Only / Not Implemented
- `fooks run <task>` - One-shot task execution (missing)
- `fooks doctor` - Setup diagnostics (missing)
- Auto fallback chain (compressed→hybrid→raw) - Partially in decide.ts
- Unified runner UX polish (codex/omx parity)
- Typecheck/build verification hooks

---

## Immediate Tasks (Orchestration-Centered)

### Task 1: Implement `fooks run` Orchestration
**Purpose**: One-shot task execution with full pipeline

**Flow**: scan → decide → extract → fallback → execute → summary

**Touched Files**:
- `src/cli/run.ts` (new) - Main orchestration
- `src/cli/index.ts` - Add "run" command entry

**Acceptance Criteria**:
- [ ] Accepts natural language task prompt
- [ ] Auto-triggers scan if cache stale (mtime vs timestamp)
- [ ] Discovers relevant files via discover.ts
- [ ] Executes via attached runtime
- [ ] Shows 1-line result: ✓ Done: Xs, processed N files, estimated extraction opportunity Y%
- [ ] Error shows actionable fix: ✗ Failed: [reason]. Fix: [action]

**Risk**: Medium

---

### Task 2: Wire Auto Mode Decision + Fallback Chain
**Purpose**: Robust mode selection with graceful degradation

**Classification**:
- Tiny (<500B) → raw
- Medium (500B-10KB) → hybrid (heuristic: style/form-heavy → compressed)
- Large (>10KB) → compressed (heuristic: simple pure → hybrid)

**Fallback Chain**:
```
compressed → hybrid → raw → error (no native degrade)
```

**Touched Files**:
- `src/core/extract.ts` - Add try/catch fallback logic
- `src/core/decide.ts` - Refine 3-tier thresholds

**Acceptance Criteria**:
- [ ] Formbricks-style repo auto-selects compressed for large components
- [ ] Small utils auto-select raw
- [ ] Fallback activates transparently on parse errors
- [ ] Final failure shows: "Fix: fooks run --mode=raw" or manual check

**Risk**: Low

---

### Task 3: Add Runner Adapter Seam
**Purpose**: Unified UX across codex/omx, hidden vanilla compare

**Structure**:
- `src/adapters/runner.ts` (new) - Adapter interface
- Codex adapter: primary implementation
- OMX adapter: compatible structure (placeholder for omx integration)
- Vanilla adapter: hidden, benchmark-only

**Touched Files**:
- `src/adapters/runner.ts` (new)
- `src/adapters/codex.ts` (refactor from existing)
- `src/cli/run.ts` - Use adapter seam

**Acceptance Criteria**:
- [ ] Same UX regardless of runner (codex/omx)
- [ ] Vanilla compare exists for benchmark validation (hidden from CLI help)
- [ ] Runner selection: auto-detect or explicit flag

**Risk**: Medium

---

### Task 4: Add Minimal Init/Doctor Path
**Purpose**: First-success entry + environment diagnostics

**Priority**: Doctor is secondary to first-success path
- Primary: `install → init → run` just works
- Secondary: `fooks doctor` for troubleshooting

**Touched Files**:
- `src/cli/init.ts` - Polish existing
- `src/cli/doctor.ts` (new) - Environment check

**Acceptance Criteria**:
- [ ] `fooks init` detects project type, sets mode:auto, detects runner
- [ ] `fooks doctor` checks: auth.json, runner availability, project type, cache integrity
- [ ] Doctor output: clear pass/fail with fix suggestions

**Risk**: Low

---

### Task 5: Package/README Quick-Start Polish
**Purpose**: NPM install ready

**Touched Files**:
- `package.json` - Metadata, bin entry, dependencies
- `README.md` - 3-step quick start, troubleshooting

**Acceptance Criteria**:
- [ ] `npm install -g fooks` works
- [ ] README has 3-step quick start without external docs
- [ ] Troubleshooting covers common issues

**Risk**: Low

---

## Dependencies
- Task 1 (run orchestration) → Task 2 (fallback needs execution path)
- Task 1 → Task 3 (runner seam needs execution path)
- Task 4 (init/doctor) parallel with 1-3
- Task 5 (package) after 1-4 complete

---

## Summary

**Goal**: `npm install -g fooks && fooks init && fooks run "task"` first-success path

**Key Decisions**:
- Orchestration-centered: scan → decide → extract → fallback → execute
- Runner adapter seam: codex first, omx-compatible structure
- No timeline estimates until implementation starts
