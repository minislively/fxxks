# R4 Feature Module Split - Validation Checklist

> 검증 방법 및 실패 조건 정의

---

## 1. 기능 유지 검증 방법

### 무엇을 같다고 볼지
- 기존 combobox-example.tsx의 모든 공개 API (props, exports) 유지
- 렌더링 결과 동일 (DOM 구조 동일성)
- 이벤트 핸들러 동작 동일
- 접근성 (a11y) 속성 유지

### 수동 확인 포인트
- [ ] combobox 열기/닫기 동작
- [ ] 아이템 선택 동작
- [ ] 키보드 네비게이션 (ArrowDown, Enter, Escape)
- [ ] 검색/필터 동작 (있을 경우)
- [ ] 포커스 관리 동작

### 테스트/빌드 확인 기준
```bash
# 테스트 실행
npm test -- combobox
# 또는
yarn test combobox

# 빌드 통과
npm run build
# 또는
yarn build
```

**통과 기준:** 테스트 100% 통과, 빌드 0 에러

---

## 2. 정적 검증

### type error 0 확인 방법
```bash
# TypeScript 컴파일 체크
cd /home/bellman/Workspace/fooks-test-repos/ui
npx tsc --noEmit

# 또는
npx tsc --noEmit --project packages/tsconfig.json
```

**통과 기준:** `error TS` 0개

### circular import 0 확인 방법
```bash
# madge 사용
npx madge --circular combobox/

# 또는 ESLint
npx eslint --rule 'import/no-cycle: error' combobox/
```

**통과 기준:** circular dependency 0개

### barrel export 확인 방법
```bash
# 각 디렉토리에 index.ts 존재 확인
ls -la combobox/components/index.ts
ls -la combobox/hooks/index.ts
ls -la combobox/utils/index.ts
ls -la combobox/types/index.ts

# index.ts 내용 검증
# - 모든 public export를 re-export하는지
# - 불필요한 내부 구현 노출 없는지
```

**통과 기준:** 4개 디렉토리 모두 index.ts 존재, 정합성 OK

---

## 3. 파일 구조 검증

### 각 파일 200라인 이하 확인
```bash
wc -l combobox/components/*.tsx
cd /home/bellman/Workspace/fooks-test-repos/ui
wc -l combobox/components/Combobox.tsx
wc -l combobox/components/ComboboxInput.tsx
wc -l combobox/components/ComboboxList.tsx
wc -l combobox/components/ComboboxItem.tsx
wc -l combobox/hooks/useCombobox.ts
wc -l combobox/utils/combobox-utils.ts
wc -l combobox/types/combobox-types.ts
```

**통과 기준:** 모든 파일 ≤ 200 lines

### 디렉토리 구조 실제 생성 확인
```
combobox/
├── components/
│   ├── index.ts              # 반드시 존재
│   ├── Combobox.tsx          # 반드시 존재
│   ├── ComboboxInput.tsx     # 반드시 존재
│   ├── ComboboxList.tsx      # 반드시 존재
│   └── ComboboxItem.tsx      # 반드시 존재
├── hooks/
│   ├── index.ts              # 반드시 존재
│   └── useCombobox.ts        # 반드시 존재
├── utils/
│   ├── index.ts              # 반드시 존재
│   └── combobox-utils.ts     # 반드시 존재
└── types/
    ├── index.ts              # 반드시 존재
    └── combobox-types.ts     # 반드시 존재
```

**통과 기준:** 8개 파일 모두 존재

---

## 4. 실패 조건

### FAIL 판정 조건 (1개 이상 해당시)

| 조건 | 설명 |
|------|------|
| **기능 퇴화** | 기존 동작 중 1개라도 실패 |
| **타입 에러** | `tsc --noEmit` 1개 이상 에러 |
| **순환 의존성** | circular import 1개 이상 |
| **파일 초과** | 1개 파일이라도 200라인 초과 |
| **구조 누락** | 8개 파일 중 1개라도 누락 |
| **barrel 누락** | index.ts 없거나 export 불완전 |
| **빌드 실패** | build command 실패 |

### 부분 성공 기록 방법

FAIL인 경우에도 아래는 기록:
```json
{
  "status": "FAIL",
  "partial": {
    "typeErrors": 3,
    "circularImports": 1,
    "oversizedFiles": ["Combobox.tsx: 240 lines"],
    "missingFiles": [],
    "passed": ["기능 유지", "barrel export", "빌드"]
  }
}
```

### 재시도 기준
- FAIL 시 최대 2회 재시도 가능
- 재시도는 retry count에 누적

---

## 상태

**Layer 2 validation checklist hardened**
- 기능 유지 검증: 정의됨
- 정적 검증: 명령어/기준 정의됨
- 파일 구조 검증: 체크리스트 정의됨
- 실패 조건: PASS/FAIL 기준 명확

**Current execution boundary**
- proposal-only smoke validation은 2회 matched R4 pair에 대해 실행됨
- generated code를 실제 repo에 적용한 acceptance validation은 아직 없음
- stable win claim 전에는 applied-code validation 또는 multi-task evidence가 필요
