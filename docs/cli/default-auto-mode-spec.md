# Fooks Default Auto Mode CLI UX Specification

## Overview
Fooks CLI provides **zero-configuration automatic optimization** for frontend AI coding tasks. Users install and run—no manual mode selection, no compression theory study required.

---

## Commands

### `fooks init`
**Purpose**: One-time setup per repository  
**Defaults**:
- Creates `.fooks/config.json` with `mode: "auto"`
- Detects project type (React/TSX/Next.js/Vite/etc.)
- Sets `runner: "auto"` (detects Codex/OMX availability)

**Output**:
```
✓ Initialized fooks for Next.js project
✓ Auto mode enabled (raw/hybrid/compressed decision automatic)
✓ Runner: codex (detected)
```

### `fooks run <task>`
**Purpose**: Execute AI task with automatic context optimization  
**Flow**:
1. Scan repository (if stale)
2. Select mode automatically per-file
3. Execute via detected runner
4. Show minimal result summary

**Default flags**:
- `--mode=auto` (overridable: `--mode=raw|hybrid|compressed`)
- `--runner=auto` (overridable: `--runner=codex|omx`)
- `--fallback=on` (fail-open: compressed→hybrid→raw)

**Output**:
```
✓ Task complete: Form validation added
  Mode: hybrid (3 files) + raw (2 small files)
  Token reduction: 62% (~840K → ~319K)
  Files modified: 1 (DeleteAccountModal/index.tsx)
  Time: 4.2s
```

### `fooks scan`
**Purpose**: Update context cache without running task  
**Output**:
```
✓ Scanned 147 files in 2.1s
  Components: 89
  Utilities: 34
  Types: 24
  Cache: .fooks/cache/
```

### `fooks doctor`
**Purpose**: Diagnose setup and suggest fixes  
**Checks**:
- Auth configuration
- Runner availability (codex/omx)
- Project type detection
- Cache integrity

**Output**:
```
✓ Auth: ~/.codex/auth.json found
✓ Runner: codex available
✓ Project: Next.js detected
✓ Cache: 147 files indexed

No issues found. Ready to run.
```

---

## Auto Mode Decision Logic

### File Classification (3-Tier)
| Category | Criteria | Default Mode | Heuristic Adjustments |
|----------|----------|--------------|----------------------|
| **Tiny** | < 500 bytes | raw | — |
| **Medium** | 500B – 10KB | hybrid | Style/form-heavy → compressed |
| **Large** | > 10KB | compressed | Simple pure component → hybrid |

### Decision Factors (priority order)
1. **File size** (primary)
2. **Content complexity** (JSX density, hook count)
3. **Domain hints** (form validation, styled-components)
4. **Historical success rate** (previous extraction failures)

---

## Fallback Behavior

### Fail-Open Chain (3-Stage)
```
compressed → hybrid → raw
```

**Rules**:
- If compressed extraction fails → try hybrid
- If hybrid fails → try raw
- If raw also fails → **error with manual retry guidance**
  - Suggest: `fooks run --mode=raw` or check file manually
  - Never auto-degrade to vanilla/native (preserves product boundary)

**Logging**:
```
⚠ LargeComponent.tsx: compressed failed (parse error), fallback to hybrid
✓ LargeComponent.tsx: hybrid success
```

**Error Case**:
```
✗ LoginForm.tsx: all modes failed
  Try: fooks run --mode=raw "your task"
  Or check file syntax and retry
```

---

## Runner Integration

### Auto-Detection Priority
1. `codex` (if `~/.codex/auth.json` exists)
2. `omx` (if `oh-my-codex` installed)
3. Error with setup instructions

### Unified UX
Same command structure across runners:
```bash
# Both work identically from user perspective
fooks run "Add button to header"
fooks run --runner=codex "Add button to header"
fooks run --runner=omx "Add button to header"
```

### Debug/Benchmark Path (Hidden)
Internal tooling exists for fooks vs vanilla comparison studies. Not exposed in CLI help/docs—used only for benchmark validation and debugging.

# Shows side-by-side: tokens, time, files
```

---

## Quick Start Flow

### First-Time User (3 steps)
```bash
# 1. Install
npm install -g fooks

# 2. Initialize (in project root)
fooks init

# 3. Run first task
fooks run "Add loading spinner to login button"
```

### npx Path (no install)
```bash
npx fooks init
npx fooks run "Fix form validation"
```

---

## Output UX

### Default Output (1-line)
```
✓ Done: 4.2s, 62% smaller, 1 file changed
```

### Error Output
```
✗ Failed: LoginForm.tsx parse error
  Fix: check syntax or run with --mode=raw
```

### Verbose Mode (`--verbose`, hidden from help)
```
✓ Task complete: Add form validation
  Duration: 4.2s (scan: 0.8s, execution: 3.4s)
  Mode: hybrid (auto-selected)
  Token summary: ~840K → ~319K (62% reduction)
  Files modified: 1 (LoginForm.tsx)
```

---

## Non-Goals

### Explicitly Excluded from Default UX
- **Manual mode study**: Users shouldn't need to learn raw/hybrid/compressed differences
- **Browser/E2E verification**: Not part of default Layer 2 scope—deferred to optional higher-trust Layer 3
- **Universal speed guarantees**: Claims are directional, context-dependent
- **Production correctness proof**: Task-level parity, not full regression testing

### Success Criteria Additions
- **Required verification**: typecheck (syntactic/semantic correctness)
- **Strongly recommended**: build pass (when applicable for the repo)

### Power-User Escapes (available, not promoted)
- `--mode=raw|hybrid|compressed` (manual override)
- `--no-fallback` (strict mode)
- Hidden debug tooling (benchmark/internal use only)

---

## Success Criteria

### First-Success Definition
User completes `fooks run "<simple task>"` within 3 steps of installation without:
- Reading mode documentation
- Configuring compression settings
- Debugging runner setup

### Consistency Across Runners
Same task executed via `codex`, `omx`, or `vanilla` comparison shows:
- Identical modified files (outcome parity)
- Comparable or better token efficiency
- Acceptable time variance (< 30%)

---

## Future Considerations (Not Current Scope)
- IDE extensions (VS Code, Cursor)
- CI/CD integration hooks
- Team-wide config sharing
- Analytics/telemetry opt-in
