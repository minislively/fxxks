# Fooks Auto Mode Implementation Plan

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

## Implementation Phases

### Phase 1: First-Success CLI Path
**Goal**: `npm install -g fooks && fooks init && fooks run "task"` works

**Tasks**:
1. Implement `fooks run` command
   - Accepts natural language task prompt
   - Auto-triggers scan if cache stale
   - Selects files via discover.ts
   - Executes via attached runtime
   - Shows 1-line result summary

2. Add cache staleness detection
   - File mtime vs cache timestamp
   - Auto-scan trigger before run

3. Basic error handling with fallback guidance
   - If extraction fails → suggest `--mode=raw`
   - Clear error messages, not stack traces

**Acceptance Criteria**:
- [ ] User can complete first task in 3 steps without reading docs
- [ ] Default output shows: ✓ Done: Xs, Y% smaller, N files changed
- [ ] Error case shows actionable fix suggestion

**Risk**: Medium - requires integration testing across different repo types

---

### Phase 2: Auto Mode Decision + Fallback Chain
**Goal**: Robust auto mode with graceful degradation

**Tasks**:
1. Refine decide.ts for 3-tier classification
   - Tiny (<500B) → raw (already implemented)
   - Medium (500B-10KB) → hybrid (heuristic: style/form → compressed)
   - Large (>10KB) → compressed (heuristic: simple pure → hybrid)

2. Implement fallback chain in extract.ts
   - Try compressed → on failure, try hybrid
   - Try hybrid → on failure, try raw
   - Raw fails → error with manual guidance (no native fallback)

3. Add mode selection logging
   - Verbose mode shows per-file mode decisions
   - Fallback events logged with reasons

**Acceptance Criteria**:
- [ ] Formbricks-style repo auto-selects compressed for large components
- [ ] Small utils auto-select raw
- [ ] Fallback chain activates transparently on parse errors
- [ ] User never sees stack traces in normal flow

**Risk**: Low - decision logic exists, needs polish and testing

---

### Phase 3: Runner Integration Path
**Goal**: Unified UX across codex/omx, hidden vanilla compare

**Tasks**:
1. Codex integration polish
   - codex-runtime-hook event handling
   - Trust status verification
   - Context template generation

2. OMX integration path
   - Detect omx availability
   - Route through omx exec with same UX
   - Maintain parity with codex path

3. Hidden vanilla compare (internal/benchmark only)
   - Not exposed in CLI help
   - Used for: fooks vs vanilla comparison studies
   - Flag name: internal, not documented

**Acceptance Criteria**:
- [ ] Same task produces same file modifications via codex or omx
- [ ] Token efficiency comparable or better than vanilla
- [ ] Vanilla compare path exists for benchmark validation

**Risk**: Medium - requires coordination with omx version compatibility

---

### Phase 4: NPM Install / OSS Release Readiness
**Goal**: Public installable package

**Tasks**:
1. Package.json polish
   - Correct bin entry
   - Dependencies audit
   - Post-install message

2. Typecheck/build verification hooks
   - Optional typecheck after modification
   - Build pass verification (if applicable)
   - Not blocking, but warning if fails

3. Documentation
   - README quick start
   - Troubleshooting guide
   - Benchmark result summary

4. CI/CD setup
   - Automated tests
   - Build verification
   - Publish workflow

**Acceptance Criteria**:
- [ ] `npm install -g fooks` works
- [ ] First-run success without additional setup
- [ ] Typecheck/build hooks available (optional)
- [ ] OSS-ready documentation

**Risk**: Low - mostly packaging and docs

---

## Immediate Tasks (Next 3-5)

### Task 1: Implement `fooks run` Command
**Purpose**: One-shot task execution for first-success path

**Touched Files**:
- `src/cli/index.ts` - Add "run" case
- `src/cli/run.ts` (new) - Task execution orchestration

**Acceptance Criteria**:
- Accepts string prompt argument
- Auto-scans if cache stale
- Discovers relevant files
- Executes via attached runtime
- Shows 1-line success summary

**Risk**: Medium

---

### Task 2: Auto Fallback Chain
**Purpose**: Robust mode selection with graceful degradation

**Touched Files**:
- `src/core/extract.ts` - Add try/catch fallback logic
- `src/core/decide.ts` - Refine 3-tier thresholds

**Acceptance Criteria**:
- compressed→hybrid→raw chain works
- Each fallback logs reason
- Final failure shows actionable error

**Risk**: Low

---

### Task 3: Basic `fooks doctor`
**Purpose**: Setup validation for first-time users

**Touched Files**:
- `src/cli/index.ts` - Add "doctor" case
- `src/cli/doctor.ts` (new) - Setup validation

**Acceptance Criteria**:
- Checks auth.json existence
- Checks runner availability
- Checks project type detection
- Clear pass/fail output

**Risk**: Low

---

### Task 4: Output UX Polish
**Purpose**: 1-line default, helpful errors

**Touched Files**:
- `src/cli/run.ts` - Output formatting
- `src/cli/index.ts` - Error handling

**Acceptance Criteria**:
- Default: "✓ Done: 4.2s, 62% smaller, 1 file changed"
- Error: "✗ Failed: [reason]. Fix: [action]"
- Verbose flag exists (hidden from help)

**Risk**: Low

---

### Task 5: Package + README Polish
**Purpose**: NPM install ready

**Touched Files**:
- `package.json` - Metadata, bin entry
- `README.md` - Quick start, troubleshooting

**Acceptance Criteria**:
- `npm install -g fooks` works
- README has 3-step quick start
- Troubleshooting section covers common issues

**Risk**: Low

---

## Dependencies
- Task 1 depends on: None (can start immediately)
- Task 2 depends on: None (can start immediately)
- Task 3 depends on: None (can start immediately)
- Task 4 depends on: Task 1
- Task 5 depends on: Task 1, 2, 3, 4

---

## Timeline Estimate
- **Task 1-3**: 1-2 days each (parallel possible)
- **Task 4**: 0.5-1 day
- **Task 5**: 0.5-1 day
- **Total**: 3-5 days to NPM-ready state
