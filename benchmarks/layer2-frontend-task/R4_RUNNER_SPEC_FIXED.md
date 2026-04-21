# R4 Feature Module Split - Runner Spec 확정

> Layer 2 첫 실행 후보 - 실행 가능한 input으로 고정

---

## 현재 상태 정정

**정확한 상태:**
- ✅ **Layer 1 Extraction Benchmark:** nextjs/tailwindcss real benchmark result 있음
- ❌ **Layer 2 Frontend Task Benchmark:** 없음
- ⚠️ **Layer 2 Task Runner Spec:** R4 Feature Module Split 확정

---

## R4 Runner Input (확정)

### 대상 (Fixed)
| 항목 | 값 |
|------|-----|
| **Repo** | shadcn-ui |
| **파일** | `apps/v4/registry/bases/radix/examples/combobox-example.tsx` |
| **현재 크기** | 1,249 lines |
| **타입** | large-mixed |

### 출력 분리 목표 (Fixed)
```
combobox-example.tsx (1,249 lines) → 분리 후:
├── components/combobox/
│   ├── Combobox.tsx              (메인 - 150라인 목표)
│   ├── ComboboxInput.tsx         (input 로직 - 80라인 목표)
│   ├── ComboboxList.tsx          (list 렌더링 - 100라인 목표)
│   └── ComboboxItem.tsx          (item 개별 - 60라인 목표)
├── hooks/
│   └── useCombobox.ts            (state/로직 - 120라인 목표)
├── utils/
│   └── combobox-utils.ts         (helper 함수 - 50라인 목표)
└── types/
    └── combobox-types.ts         (TypeScript 인터페이스 - 40라인 목표)
```

### 성공 기준 (Fixed - Pass/Fail)
| 기준 | 측정 방법 | Pass 기준 |
|------|-----------|-----------|
| **기능 유지** | 원본 테스트 통과 | 100% 통과 |
| **파일 크기** | wc -l | 각 파일 ≤ 200 lines |
| **타입 에러** | tsc --noEmit | 0 errors |
| **순환 의존성** | eslint-plugin-import | 0 circular |
| **barrel export** | index.ts 존재/정합성 | 모든 public API 노출 |

---

## API Access 시 측정 (Fixed)

측정할 6개 항목 (고정):

| 항목 | vanilla | fooks | 측정 방법 |
|------|---------|-------|-----------|
| **실행** | 1회 | 1회 | runner 호출 |
| **성공/실패** | boolean | boolean | 성공 기준 5개 pass/fail |
| **token usage** | input tokens | input tokens | tiktoken 계산 |
| **retry count** | N회 | N회 | 실패 후 재시도 횟수 |
| **completion latency** | Ms | Ms | Date.now() delta |

---

## 현재 가능/불가능

**지금 가능:**
- ✅ 대상 파일 확정
- ✅ 분리 구조 확정
- ✅ 성공 기준 확정
- ✅ 측정 metric 확정

**현재 경계:**
- ✅ current `codex exec` proposal-only AI 실행 2회 완료
- ✅ proposal-smoke validation artifact 수집 완료
- ❌ generated code 적용 기반 acceptance validation은 아직 없음

---

## 명명 (Fixed)

**정확한 표현:**
- ✅ `R4 Feature Module Split task runner spec`
- ✅ `two R4 proposal-only smokes validated`
- ❌ `stable Layer 2 benchmark win` (applied-code/multi-task evidence 전까지 금지)
- ❌ `billing-grade token savings`

---

*Spec 확정: 에르가재*
*상태: proposal-only smoke 2회 검증, applied-code validation 대기*
*stable claim 전 추가 evidence 필요*
