# Today Execution Plan: public-ready 정리 단계

## ⚠️ npm public publish 보류
오늘은 공개 전 **내부 정리/구현**만 진행. public 올리면 나중에 귀찮아질 요소 먼저 정리.

## Current State Summary

### Already Implemented
- `fooks init` - Project initialization
- `fooks scan` - Repository scanning
- `fooks extract` - File extraction with mode decision
- `fooks decide` - Auto mode selection
- `fooks attach` - Runtime integration
- Core extraction engine (decide.ts)

### Not Implemented (Blockers)
- `fooks run` - One-shot task execution ❌
- Typecheck/build verification hooks ❌
- Runner adapter seam (codex/omx unified) - Partial

### Package.json Issues
- `license: null` ❌
- `files: ["dist"]` - Needs verification
- `description` - Repo-level, not product-level

---

## Today Execution Tasks (5개)

### Task 1: Implement `fooks run` Orchestration
**Purpose**: 실사용 경로 구현 (scan → decide → extract → fallback → execute → summary)

**Touched Files**:
- `src/cli/run.ts` (new) - Main orchestration
- `src/cli/index.ts` - Add "run" command case

**Implementation**:
```typescript
// Pseudo-flow
1. scanProject() if cache stale
2. discoverFiles(taskPrompt) - find relevant files
3. For each file:
   - decideMode() → raw/hybrid/compressed
   - extractFile() with fallback chain
4. Execute via attached runtime
5. Show 1-line summary
```

**Acceptance Criteria**:
- [ ] `fooks run "Add button to header"` works end-to-end
- [ ] 1-line output: "✓ Done: 4.2s, 62% smaller, 1 file changed"
- [ ] Error shows actionable fix

**Risk**: Medium

---

### Task 2: Add Minimal Typecheck/Build Verification
**Purpose**: 결과 검증 훅 (blocking 아닌 warning)

**Touched Files**:
- `src/cli/run.ts` - Add verification step
- `src/core/verify.ts` (new) - Light verification

**Implementation**:
- After file modification, run `tsc --noEmit` if tsconfig.json exists
- Run `npm run build` if package.json has build script
- Non-blocking: warning only, don't fail task

**Acceptance Criteria**:
- [ ] Type errors shown as warnings, not blockers
- [ ] Build pass logged in verbose mode

**Risk**: Low

---

### Task 3: Fix Package.json for NPM Publish
**Purpose**: publish-ready 메타데이터 정리

**Touched Files**:
- `package.json`

**Changes**:
```json
{
  "license": "MIT",
  "description": "Frontend context compression for AI coding tasks - reduces token usage while preserving outcome quality",
  "files": ["dist", "README.md", "LICENSE"],
  "keywords": ["ai", "codex", "tsx", "react", "compression", "tokens"],
  "author": "minislively",
  "repository": {
    "type": "git",
    "url": "https://github.com/minislively/fooks.git"
  }
}
```

**Acceptance Criteria**:
- [ ] `npm pack` shows correct files
- [ ] No missing license warning

**Risk**: Low

---

### Task 4: Create README Quick-Start
**Purpose**: 3-step 진입 문서

**Touched Files**:
- `README.md` (rewrite or heavy edit)

**Structure**:
```markdown
# fooks

Frontend context compression for AI coding. Reduces token usage ~60% while keeping outcome parity.

## Quick Start (3 steps)

```bash
npm install -g fooks
fooks init
fooks run "Add loading spinner to login button"
```

## What It Does
- Compresses React/TSX components for AI coding agents
- Automatic mode selection (raw/hybrid/compressed)
- Works with Codex CLI, OMX compatible

## Benchmark
Formbricks T5 task: 39% fewer tokens, faster execution, outcome parity.

## Documentation
- [Implementation Plan](docs/cli/auto-mode-implementation-plan.md)
```

**Acceptance Criteria**:
- [ ] 3-step install→init→run works without external docs
- [ ] Benchmark result mentioned

**Risk**: Low

---

### Task 5: Doc/File Cleanup for Public
**Purpose**: 공개용/내부용 경계 정리

**Action**:
Move to `docs/internal/` or archive:
- `docs/BENCHMARK_ENVIRONMENT_AUDIT.md` (internal checklist)
- `docs/codex-live-feedback-checklist.md` (experimental)
- `docs/performance-vs-operational-complexity.md` (internal analysis)
- `docs/real-environment-process-model-validation.md` (internal)
- `docs/real-repo-validation.md` (internal)
- `docs/RISK_AND_MONITORING.md` (internal)
- `docs/runtime-bridge-contract.md` (future/technical)

**Keep public**:
- `docs/cli/` (implementation plan, spec)
- `docs/CODE_OF_CONDUCT.md`
- `docs/archive/` (already archived)

**Acceptance Criteria**:
- [ ] Public docs folder shows only user-facing docs
- [ ] Internal analysis docs moved to `docs/internal/`

**Risk**: Low

---

## Publish Blockers (Why Not Public Yet)

| Blocker | 현재 상태 | 공개 전 해결 필요 | 우선순위 |
|---------|----------|------------------|---------|
| `fooks run` 미구현 | ❌ 미구현 | ✅ 필수 | P0 |
| `license: null` | ❌ 누락 | ✅ 필수 | P0 |
| README 미완성 | ❌ repo-level 설명만 | ✅ 3-step quick start | P0 |
| 내부 문서 노출 | ❌ public/docs 섞임 | ✅ 정리 후 공개 | P1 |
| typecheck/build verification | ❌ 없음 | ✅ 신뢰도 필수 | P1 |
| Runner adapter seam | ⚠️ 부분적 | ⚠️ codex 먼저, omx 나중 | P1 |

### 판단 기준
- **P0 (필수)**: public 올리기 전 반드시 해결
- **P1 (권장)**: 정리하면 좋음, 없어도 public 가능
- **P2 (선택)**: 나중에 추가 가능

현재 P0 해결 시 public 고려 가능. P0+P1 해결 시 권장.

---

## Doc Cleanup Candidates (8개)

1. `docs/BENCHMARK_ENVIRONMENT_AUDIT.md` → `docs/internal/`
2. `docs/codex-live-feedback-checklist.md` → `docs/internal/`
3. `docs/performance-vs-operational-complexity.md` → `docs/internal/`
4. `docs/real-environment-process-model-validation.md` → `docs/internal/`
5. `docs/real-repo-validation.md` → `docs/internal/`
6. `docs/RISK_AND_MONITORING.md` → `docs/internal/`
7. `docs/runtime-bridge-contract.md` → `docs/internal/`
8. `docs/archive/*` - Verify already archived

---

## Dependency Order

```
Task 3 (package.json) → Task 1 (run needs correct bin)
Task 1 → Task 2 (verification runs after execution)
Task 1 → Task 4 (README describes run command)
Task 5 parallel with all
```

---

## Success Criteria (Today)

- [ ] `fooks run` works end-to-end (필수 P0)
- [ ] `npm pack` shows correct files + license (필수 P0)
- [ ] README has 3-step quick start (필수 P0)
- [ ] Internal docs separated (권장 P1)
- [ ] **public blockers list 정리 완료** (오늘 핵심 산출물)
