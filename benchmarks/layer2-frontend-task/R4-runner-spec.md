# R4 Feature Module Split - Runner Spec

> Layer 2 실행 직전 상태 고정

---

## 1. 입력

| 항목 | 값 |
|------|-----|
| **Repo** | shadcn-ui |
| **Target File** | `apps/v4/registry/bases/radix/examples/combobox-example.tsx` |
| **현재 파일 크기** | 1,249 lines |
| **분리 목표 디렉토리** | `components/`, `hooks/`, `utils/`, `types/` |

---

## 2. 출력 기대치

### 디렉토리 구조
```
combobox/
├── components/
│   ├── index.ts              # barrel export
│   ├── Combobox.tsx          # 메인 컴포넌트
│   ├── ComboboxInput.tsx     # input 로직
│   ├── ComboboxList.tsx      # list 렌더링
│   └── ComboboxItem.tsx      # item 개별
├── hooks/
│   ├── index.ts              # barrel export
│   └── useCombobox.ts        # state/effect 로직
├── utils/
│   ├── index.ts              # barrel export
│   └── combobox-utils.ts     # helper 함수
└── types/
    ├── index.ts              # barrel export
    └── combobox-types.ts     # TypeScript 인터페이스
```

### Barrel Export 방식
- 각 디렉토리에 `index.ts` 생성
- 외부에서는 `import { Combobox } from './combobox/components'` 형태로 사용
- `index.ts`에서만 내부 파일 re-export

### 파일 크기 목표
| 파일 | 목표 라인수 |
|------|------------|
| Combobox.tsx | ≤ 150 lines |
| ComboboxInput.tsx | ≤ 80 lines |
| ComboboxList.tsx | ≤ 100 lines |
| ComboboxItem.tsx | ≤ 60 lines |
| useCombobox.ts | ≤ 120 lines |
| combobox-utils.ts | ≤ 50 lines |
| combobox-types.ts | ≤ 40 lines |

---

## 3. 성공 판정 체크리스트

| 기준 | 검증 방법 | 통과 기준 |
|------|-----------|-----------|
| **기능 유지** | 원본 테스트 실행 | 100% 통과 |
| **파일 크기** | `wc -l` | 각 파일 ≤ 200 lines |
| **타입 에러** | `tsc --noEmit` | 0 errors |
| **순환 의존성** | `eslint-plugin-import` 또는 `madge` | 0 circular |
| **Barrel Export** | `index.ts` 존재 + 정합성 검증 | 모든 public API 노출 |
| **빌드 통과** | `npm run build` 또는 `tsc` | no emit error |

### PASS/FAIL 판정
- **PASS**: 6개 기준 전부 충족
- **FAIL**: 1개 이상 실패

---

## 4. 측정 Schema

### 실행 방식
| 방식 | 횟수 | 입력 |
|------|------|------|
| **Vanilla** | 1회 | 원본 파일 전체 (39,209 bytes) |
| **Fooks** | 1회 | 추출된 payload (2,011 bytes) |

### 측정 항목
| 항목 | 설명 | 측정 방법 |
|------|------|----------|
| **success/fail** | 작업 완료 여부 | 6개 성공 기준 충족 여부 |
| **token usage** | AI 입력 토큰 수 | tiktoken-style calculation |
| **retry count** | 실패 후 재시도 횟수 | 실행 로그 카운트 |
| **completion latency** | 완료까지 소요 시간 | `Date.now()` delta (ms) |

### 비교 지표
```
Token Reduction: (vanilla_tokens - fooks_tokens) / vanilla_tokens
Retry Reduction: vanilla_retries - fooks_retries
Latency Reduction: vanilla_latency - fooks_latency
Success Rate Diff: fooks_success_rate - vanilla_success_rate
```

---

## 상태

**Layer 2 spec hardened**
- 입력: 고정
- 출력 기대치: 고정
- 성공 판정: 고정
- 측정 schema: 고정

**Current benchmark boundary**
- Runner/API path는 current `codex exec` proposal-only smoke로 확인됨
- 2회 matched proposal-only smoke + validation artifact 존재
- provider usage/billing-token telemetry와 applied-code acceptance benchmark는 아직 없음

**Next:** stable claim 전 applied-code validation 또는 multi-task evidence 수집
