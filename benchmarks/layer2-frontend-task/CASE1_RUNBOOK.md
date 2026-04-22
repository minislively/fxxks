# CASE-1: Component Splitting - Runbook

> 실제 실행 가능한 입력, 검증, 비교 템플릿

---

## 1. 실행 입력 텍스트

### Vanilla Prompt
```
Split this combobox component into modular files:

TARGET: apps/v4/registry/bases/radix/examples/combobox-example.tsx (1,249 lines)

OUTPUT STRUCTURE:
- components/combobox.tsx (UI component, max 200 lines)
- hooks/use-combobox.ts (state logic, max 200 lines)
- utils/combobox-helpers.ts (utilities, max 200 lines)
- types/combobox.ts (type definitions, max 200 lines)
- index.ts (barrel export)

REQUIREMENTS:
1. Each file must be under 200 lines
2. No circular dependencies between modules
3. Maintain all existing functionality
4. Include proper TypeScript types
5. Export everything through barrel (index.ts)
6. Preserve original component behavior exactly

CONTEXT: [FULL FILE CONTENT HERE]
```

### Fooks Prompt Shape
```
Split this combobox component into modular files:

TARGET: apps/v4/registry/bases/radix/examples/combobox-example.tsx

OUTPUT STRUCTURE:
- components/combobox.tsx (UI component)
- hooks/use-combobox.ts (state logic)
- utils/combobox-helpers.ts (utilities)
- types/combobox.ts (type definitions)
- index.ts (barrel export)

REQUIREMENTS:
1. Each file under 200 lines
2. No circular dependencies
3. Maintain all functionality
4. Proper TypeScript types
5. Barrel exports
6. Preserve behavior

CONTEXT: [FOOKS EXTRACTION RESULT HERE]
```

---

## 2. 실행 명령어

### Vanilla Run
```bash
cd ~/Workspace/fooks-test-repos/ui && \
npx codex exec \
  --model gpt-5.4 \
  --full-auto \
  --skip-git-repo-check \
  --prompt "Split combobox component into modular files (components/, hooks/, utils/, types/, index.ts). Max 200 lines per file. No circular deps. Maintain functionality." \
  2>&1 | tee ~/Workspace/fooks/benchmarks/layer2-frontend-task/results/case1-vanilla/run.log
```

### Fooks Run
```bash
# 1. Extract context
node -e "
const fooks = require('~/Workspace/fooks/dist/index.js');
const result = fooks.extractFile('apps/v4/registry/bases/radix/examples/combobox-example.tsx');
fs.writeFileSync('/tmp/case1-fooks-context.json', JSON.stringify(result, null, 2));
"

# 2. Run with fooks context
cd ~/Workspace/fooks-test-repos/ui && \
npx codex exec \
  --model gpt-5.4 \
  --full-auto \
  --skip-git-repo-check \
  --prompt-file /tmp/case1-fooks-context.json \
  2>&1 | tee ~/Workspace/fooks/benchmarks/layer2-frontend-task/results/case1-fooks/run.log
```

---

## 3. 실행 후 검증 Command Set

### 3.1 File Structure Check
```bash
cd results/case1-vanilla  # 또는 case1-fooks
ls -la components/combobox.tsx hooks/use-combobox.ts utils/combobox-helpers.ts types/combobox.ts index.ts
echo "Expected: 5 files present"
```

### 3.2 Line Count Validation
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "index.ts" -exec wc -l {} \; | awk '$1 > 200 {print "FAIL: " $2 " has " $1 " lines (max 200)"; exit 1} {print "PASS: " $2 " has " $1 " lines"}'
```

### 3.3 Type Check
```bash
npx tsc --noEmit 2>&1 | tee type-check.log
ERRORS=$(grep -c "error TS" type-check.log || echo "0")
echo "Type errors: $ERRORS"
[ "$ERRORS" -eq 0 ] && echo "PASS" || echo "FAIL"
```

### 3.4 Circular Dependency Check
```bash
npx madge --circular . 2>&1 | tee circular.log
CIRCULAR=$(grep -c "Circular" circular.log || echo "0")
echo "Circular dependencies: $CIRCULAR"
[ "$CIRCULAR" -eq 0 ] && echo "PASS" || echo "FAIL"
```

### 3.5 Barrel Export Check
```bash
grep -q "export.*from" index.ts && echo "PASS: Barrel exports found" || echo "FAIL: No barrel exports"
```

### 3.6 Build Check (if applicable)
```bash
npm run build 2>&1 | tee build.log
BUILD_STATUS=$?
[ $BUILD_STATUS -eq 0 ] && echo "PASS: Build successful" || echo "FAIL: Build failed"
```

---

## 4. 비교표 템플릿

| Metric | Vanilla | Fooks | Delta | Better |
|--------|---------|-------|-------|--------|
| **Input Tokens** | ___ | ___ | ___ | ___ |
| **Output Tokens** | ___ | ___ | ___ | ___ |
| **Latency (ms)** | ___ | ___ | ___ | ___ |
| **Retry Count** | ___ | ___ | ___ | ___ |
| **Files Generated** | ___ | ___ | ___ | ___ |
| **Validation Score** | ___/6 | ___/6 | ___ | ___ |
| **Line Count Pass** | ___ | ___ | ___ | ___ |
| **Type Check Pass** | ___ | ___ | ___ | ___ |
| **Circular Check Pass** | ___ | ___ | ___ | ___ |
| **Build Pass** | ___ | ___ | ___ | ___ |
| **Overall Verdict** | ___ | ___ | ___ | ___ |

### 한 줄 판정
**Winner:** ___ (vanilla / fooks / tie / inconclusive)  
**Reason:** ___

---

## 5. 실행 순서

1. **Vanilla 실행** → 결과를 `results/case1-vanilla/`에 저장
2. **검증** (command set 3.1-3.6) → 결과 기록
3. **Fooks 실행** → 결과를 `results/case1-fooks/`에 저장
4. **검증** (command set 3.1-3.6) → 결과 기록
5. **비교표 작성** → 4번 섹션 채우기
6. **한 줄 판정** → winner/reason 기록

---

## 6. 현재 상태

| 항목 | 상태 |
|------|------|
| **실행 입력 텍스트** | ✅ Ready |
| **실행 명령어** | ✅ Ready |
| **검증 command set** | ✅ Ready |
| **비교표 템플릿** | ✅ Ready |
| **실제 실행** | ⏸️ Pending lane availability |
| **비교 결과** | ❌ Not yet |

---

*Runbook: 에르가재*  
*Date: 2026-04-15*  
*Status: Ready for execution*
