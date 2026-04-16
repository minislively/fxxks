# Layer 2 Frontend Task Benchmark - Task Inventory

> 프론트 토큰 고비용 작업 리스트 + 첫 actual benchmark 후보

---

## Comparison Mode

| Mode | 설명 |
|------|------|
| **Vanilla Codex** | 원본 파일/기본 컨텍스트로 Codex 작업 |
| **Fooks-assisted Codex** | fooks 추출/정리한 컨텍스트로 Codex 작업 |

**비교 대상:** 모델이 아닌 **컨텍스트 공급 방식 차이**

---

## Task 목록 (5-8개)

### T1: Component Migration (디자인 시스템 전환)
**Why 토큰 고비용:**
- 레거시 → 새 디자인 시스템 마이그레이션
- Props interface breaking change 처리
- Visual regression 대응

**대표 repo/file:**
- shadcn-ui components (v3 → v4)

**성공 기준:**
- 기존 기능 100% 유지
- 새 디자인 시스템 스펙 준수
- 타입 에러 0
- 스토리북/visual test 통과

---

### T2: Design System Integration (복합 컴포넌트 조립)
**Why 토큰 고비용:**
- 여러 atomic 컴포넌트 조합
- Compound component 패턴 구현
- 재사용성/유연성 균형

**대표 repo/file:**
- shadcn-ui DataTable, FilterBar

**성공 기준:**
- atomic 조합 논리 명확
- compound component 패턴 준수
- accessibility 100%
- 테스트 커버리지 80%+

---

### T3: API Layer Refactoring (데이터 계층 추상화)
**Why 토큰 고비용:**
- useEffect + fetch → React Query/SWR
- Cache/revalidation 로직 설계
- Error boundary 통합

**대표 repo/file:**
- cal.com data fetching layer

**성공 기준:**
- 모든 API 호출 추상화
- Loading/error 상태 일관성
- Cache strategy 명확
- Retry/debounce 통일

---

### **T4: Feature Module Split** ⭐ **첫 actual benchmark 후보**
**Why 토큰 고비용:**
- Monolithic feature → bounded context 분리
- 도메인 로직 분석 필요
- 의존성 그래프 분석 필요

**대표 repo/file:**
- **shadcn-ui: `apps/v4/registry/bases/radix/examples/combobox-example.tsx`**
- **1,249 lines (large-mixed)**

**성공 기준:**
- 기능 100% 유지 (test 통과)
- 파일당 ≤200라인
- type error 0
- circular import 0
- barrel export 통일

**측정 metric:**
- success/fail
- token usage
- retry count
- latency
- edit precision
- operational overhead note

---

### T5: Framework/Config Migration (플랫폼 전환)
**Why 토큰 고비용:**
- 전체 앱 레벨 설정 변경
- Breaking change 대응
- 성능 회귀 방지

**대표 repo/file:**
- nextjs App Router migration
- tailwindcss v3 → v4 config

**성공 기준:**
- 빌드 통과
- 모든 기능 작동
- 성능 퇴행 없음
- 개발 경험 유지/향상

---

### T6: Form Validation Refactor
**Why 토큰 고비용:**
- Inline validation → Zod schema
- 타입 안정성 + 런타임 검증 통합
- Form complexity handling

**대표 repo/file:**
- formbricks form components

**성공 기준:**
- schema extraction complete
- type_errors 0
- tests pass
- rollback 불필요

---

### T7: Hook Extraction & Abstraction
**Why 토큰 고비용:**
- Inline useEffect/useState → custom hook
- 재사용성 + 테스트 용이성
- Logic 분리의 복잡성

**대표 repo/file:**
- formbricks useDataForm, useInfiniteScroll

**성공 기준:**
- hook created
- lines_reduced_in_component ≥30%
- hook test coverage ≥70%
- usage_sites ≥2

---

## 첫 Actual Benchmark 후보 확정

| 항목 | 값 |
|------|-----|
| **Task ID** | T4 (R4 Feature Module Split) |
| **Repo** | shadcn-ui |
| **File** | `combobox-example.tsx` |
| **Lines** | 1,249 (large-mixed) |
| **Split target** | components/ hooks/ utils/ types/ |
| **성공 기준** | 6개 checklist |

**이유:**
- ✅ 실제 프론트에서 흔한 고통 ("이 파일이 너무 커요")
- ✅ 성공/실패 기준 비교적 명확
- ✅ vanilla vs fooks 비교하기 좋음 (토큰 절약 극대화)
- ✅ large-mixed라 실제 복잡도 있음

---

## Real Benchmark에서 볼 것 (6개)

| # | Metric | 설명 |
|---|--------|------|
| 1 | **success/fail** | 작업 완료 여부 |
| 2 | **token usage** | AI 입력 토큰 수 |
| 3 | **retry count** | 재시도 횟수 |
| 4 | **latency** | 완료 소요 시간 |
| 5 | **edit precision** | 생성 코드 정확도 |
| 6 | **operational overhead note** | 운영 복잡도 증가 여부 메모 |

---

## Status

**Task Inventory:** ✅ 7개 task 리스트업 완료
**첫 후보:** ✅ T4 (R4 Feature Module Split) 확정
**Comparison mode:** ✅ Vanilla Codex vs Fooks-assisted Codex 정의

**Not yet:**
- API access 없음 (blocker)
- 실제 benchmark 미실행
- Runner 미구현

**Next:** API access 확보 시 T4 첫 real benchmark 실행

---

*Inventory: 에르가재*
*Date: 2026-04-15*
*First candidate: T4 confirmed, API access pending*
