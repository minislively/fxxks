# Case 1: Component Splitting - Execution Spec

> shadcn-ui combobox-example.tsx - 상세 실행 스펙 및 성공 기준

---

## 1. Selected First Case (정확한 선정)

| 항목 | 값 |
|------|-----|
| **Case ID** | CASE-1 |
| **Task Type** | Component Splitting (Refactor) |
| **Target Repo** | shadcn-ui |
| **Target File** | `apps/v4/registry/bases/radix/examples/combobox-example.tsx` |
| **Original Size** | 1,249 lines, 39,209 bytes |
| **Why Selected** | ① Component split에 최적화 ② Validation 명확 ③ Success/fail 판정 쉬움 |

**Note:** nextjs T1 button relocation은 별도 시도했으나 502로 실패. 본 케이스는 shadcn-ui로 고정.

---

## 2. Execution Plan

### Vanilla Run
```bash
# 1. 준비
cd ~/Workspace/fooks-test-repos/ui

# 2. Vanilla 실행 (fooks 미사용)
npx codex exec \
  --model gpt-5.4 \
  --full-auto \
  --skip-git-repo-check \
  --prompt "Split this 1,249 line combobox component into modular files:
- components/combobox.tsx (UI component)
- hooks/use-combobox.ts (state logic)
- utils/combobox-helpers.ts (utilities)
- types/combobox.ts (type definitions)
- index.ts (barrel export)

Requirements:
1. Each file must be under 200 lines
2. No circular dependencies
3. Maintain all existing functionality
4. Include proper TypeScript types
5. Add barrel exports"

# 3. 결과물 디렉토리
mkdir -p ~/Workspace/fooks/benchmarks/layer2-frontend-task/results/case1-vanilla
```

### Fooks Run
```bash
# 1. Fooks extraction 준비
node -e "
const fooks = require('~/Workspace/fooks/dist/index.js');
const result = fooks.extractFile('apps/v4/registry/bases/radix/examples/combobox-example.tsx');
console.log(JSON.stringify(result, null, 2));
" > /tmp/case1-fooks-context.json

# 2. Fooks 실행
npx codex exec \
  --model gpt-5.4 \
  --full-auto \
  --skip-git-repo-check \
  --prompt "$(cat /tmp/case1-fooks-context.json)

Task: Split into modular files as specified in the context structure.
Requirements same as vanilla run."

# 3. 결과물 디렉토리
mkdir -p ~/Workspace/fooks/benchmarks/layer2-frontend-task/results/case1-fooks
```

---

## 3. Success Criteria (6개 기준)

| # | 기준 | 검증 방법 | Pass/Fail |
|---|------|-----------|-----------|
| 1 | **기능 유지** | 원본 vs 결과 동작 비교 | Manual check |
| 2 | **파일당 ≤200라인** | `wc -l <file>` | All files |
| 3 | **Type Error 0** | `npx tsc --noEmit` | 0 errors |
| 4 | **순환 의존성 0** | `npx madge --circular .` | No circular |
| 5 | **Barrel Export** | `index.ts` 존재 + re-export 확인 | Present |
| 6 | **파일 구조** | components/, hooks/, utils/, types/ | All dirs |

---

## 4. Validation Procedure

### Step 1: File Structure Check
```bash
cd results/case1-vanilla  # 또는 case1-fooks
ls -la components/ hooks/ utils/ types/ index.ts
```

### Step 2: Line Count Check
```bash
find . -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 200 {print "FAIL: " $2 " has " $1 " lines"}'
```

### Step 3: Type Check
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

### Step 4: Circular Dependency Check
```bash
npx madge --circular . 2>&1 | grep -c "Circular"
```

### Step 5: Functionality Check
- 수동: 원본 combobox 동작과 결과물 동작 비교
- Storybook/test 있으면 실행

---

## 5. Metrics Collection

| Metric | 수집 방법 | 비교 대상 |
|--------|-----------|-----------|
| **Input Tokens** | `cl100k_base` encoding | vanilla vs fooks |
| **Output Tokens** | 응답 전체 encoding | vanilla vs fooks |
| **Latency** | `Date.now()` delta | vanilla vs fooks |
| **Retry Count** | Codex CLI 로그 | vanilla vs fooks |
| **Changed Files** | `git diff --stat` | N/A (new files) |
| **Validation Score** | 6개 기준 충족 수 | vanilla vs fooks |

---

## 6. Current Status

| 항목 | 상태 |
|------|------|
| **Case Selected** | ✅ shadcn-ui component splitting |
| **Execution Plan** | ✅ Documented |
| **Success Criteria** | ✅ 6개 기준 정의 |
| **Validation Procedure** | ✅ Step-by-step 정의 |
| **Vanilla Run** | ⏸️ Pending (gateway availability) |
| **Fooks Run** | ⏸️ Pending (gateway availability) |
| **Comparison Result** | ❌ Not yet available |

---

## 7. Lane Status Reality

> **Current layoff-backed Codex lane:** 502 Bad Gateway
> **Therefore:** Actual execution pending external gateway recovery
> **But:** Execution spec is ready for immediate deployment when lane recovers

---

*Spec: 에르가재*
*Date: 2026-04-15*
*Selected Case: shadhn-ui component splitting (NOT nextjs T1)*
*Status: Execution spec ready, actual run pending*
