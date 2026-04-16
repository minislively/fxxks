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

### File Classification
| Category | Criteria | Default Mode |
|----------|----------|--------------|
| **Tiny** | < 500 bytes, no JSX | raw |
| **Small component** | 500-2000 bytes, simple JSX | hybrid |
| **Medium component** | 2-10KB, moderate complexity | hybrid |
| **Large component** | > 10KB, complex JSX/hooks | compressed |
| **Style-heavy** | > 50% CSS-in-JS/styled | compressed |
| **Form-heavy** | validation logic, complex state | compressed |
| **Data/utility** | pure functions, types, configs | raw or hybrid |

### Decision Factors
1. **File size** (primary)
2. **JSX density** (tags vs. logic ratio)
3. **Hook complexity** (useState/useEffect count)
4. **Import graph depth** (component dependencies)
5. **Historical performance** (previous extraction fidelity)

---

## Fallback Behavior

### Fail-Open Chain
```
compressed → hybrid → raw → native (no fooks)
```

**Rules**:
- If compressed extraction fails → try hybrid
- If hybrid fails → try raw
- If all fail → run native (vanilla Codex)
- Never block user task due to optimization failure

**Logging**:
```
⚠ LargeComponent.tsx: compressed failed (parse error), fallback to hybrid
✓ LargeComponent.tsx: hybrid success
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

### Debug/Compare Path
```bash
# Vanilla comparison (no fooks optimization)
fooks run --vanilla "Add button to header"

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

### Minimal Result (default)
```
✓ Task complete
  Duration: 4.2s
  Mode: hybrid (auto-selected)
  Reduction: 62% (~840K → ~319K tokens)
  Files: 1 modified
```

### Verbose Mode (`--verbose`)
```
✓ Task complete: Add form validation
  Duration: 4.2s (scan: 0.8s, execution: 3.4s)
  
  Files processed:
    - LoginForm.tsx (compressed): 15.2KB → 2.1KB
    - validation.ts (raw): 890B → 1.2KB
    
  Token summary:
    Raw: ~840,053 tokens
    Compressed: ~319,210 tokens
    Saved: ~520,843 tokens (62%)
    
  Files modified: 1
    - components/LoginForm.tsx
```

---

## Non-Goals

### Explicitly Excluded from Default UX
- **Manual mode study**: Users shouldn't need to learn raw/hybrid/compressed differences
- **Browser/E2E verification**: Out of scope (see benchmark layer separation)
- **Universal speed guarantees**: Claims are directional, context-dependent
- **Production correctness proof**: Task-level parity, not full regression testing

### Power-User Escapes (available, not promoted)
- `--mode=raw|hybrid|compressed` (manual override)
- `--no-fallback` (strict mode)
- `--runner=vanilla` (debug comparison)

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
