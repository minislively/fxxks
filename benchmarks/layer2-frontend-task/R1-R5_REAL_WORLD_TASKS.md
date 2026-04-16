# R1-R5 Real-World Frontend Task Candidates

> Layer 2 Task Benchmark 새 기준

---

## 기존 T1-T5 → 하위 예시로 하락

기존 T1-T5는 너무 제한적이었음:
- T1 Router Migration: 너무 specific (Next.js만)
- T2 Validation Refactor: scope 작음
- T3 Component Split: 단순 파일 분리
- T4 Hook Extraction: 단순 코드 이동
- T5 Config Migration: 설정 파일 작업

**문제:** 실제 프론트엔드 팀이 매일 하는 **복잡 통합 작업**을 커버하지 못함

---

## R1-R5 Real-World Task 기준

**핵심 차이:** 단순 코드 수정 → **비즈니스 기능 단위 리팩토링/마이그레이션**

---

### R1: Component Migration (디자인 시스템 전환)

**정의:** 레거시 컴포넌트 → 새 디자인 시스템 컴포넌트로의 체계적 마이그레이션

**실제 시나리오:**
- shadcn-ui v3 → v4 컴포넌트 업그레이드
- Radix primitives 기반 컴포넌트 스펙 변환
- Props 인터페이스 breaking change 처리

**측정 가능성:**
- migrated components count
- props interface compatibility score
- visual regression test pass rate
- 타입 에러 0 목표

**성공 기준:**
1. 기존 기능 100% 유지
2. 새 디자인 시스템 스펙 100% 준수
3. 타입 에러 0
4. 스토리북/visual test 통과

---

### R2: Design System Integration (복합 컴포넌트 조립)

**정의:** 여러 atomic 컴포넌트를 조합해서 복합 비즈니스 컴포넌트 생성

**실제 시나리오:**
- shadcn-ui Button + Input + Select → FilterBar 컴포넌트
- DataTable = Table + Pagination + Search + Actions
- FormSection = Label + Input + Error + HelpText

**측정 가능성:**
- composite component complexity score
- 재사용성 metric (props flexibility)
- 접근성 (a11y) score
- 테스트 커버리지

**성공 기준:**
1. atomic 조합 논리 명확
2. compound component 패턴 준수
3. accessibility 100%
4. 테스트 coverage 80%+

---

### R3: API Layer Refactoring (데이터 계층 추상화)

**정의:** inline data fetching → centralized API layer with caching/revalidation

**실제 시나리오:**
- useEffect + fetch → React Query/SWR migration
- REST endpoints → GraphQL query 변환
- Inline API calls → SDK/hooks abstraction

**측정 가능성:**
- API call deduplication rate
- Cache hit ratio
- Loading state consistency
- Error boundary coverage

**성공 기준:**
1. 모든 API 호출 추상화됨
2. Loading/error 상태 일관성
3. Cache strategy 명확
4. Retry/debounce 로직 통일

---

### R4: Feature Module Split (도메인 기준 코드 분리)

**정의:** monolithic feature → bounded context modules로 분리

**실제 시나리오:**
- /app/dashboard/page.tsx (1000+ lines) → widgets/, hooks/, utils/, types/ 분리
- 인증/결제/대시보드 feature 코드 분리
- Shared kernel vs Feature modules 분리

**측정 가능성:**
- module cohesion score
- coupling reduction (import graph analysis)
- circular dependency 제거
- barrel export 정리

**성공 기준:**
1. 파일당 200라인 이하
2. 순환 의존성 0
3. barrel export 통일
4. 테스트 파일 위치 명확

---

### R5: Framework / Config Migration (플랫폼 전환)

**정의:** 전체 앱 레벨 설정/프레임워크 마이그레이션

**실제 시나리오:**
- Next.js 13 → 14 → 15 App Router 마이그레이션
- Tailwind v3 → v4 config 변환
- Webpack → Vite 전환
- ESLint/Prettier 설정 통합

**측정 가능성:**
- build time 변화
- bundle size 변화
- HMR 성능
- 개발자 경고 0

**성공 기준:**
1. 빌드 통과
2. 모든 기능 작동
3. 성능 퇴행 없음
4. 개발 경험 유지/향상

---

## 첫 실행 후보: R4 Feature Module Split

### 선정 이유

**1. Real-World Representative성**
- 실제 프론트엔드 팀이 **매주** 하는 작업
- "이 파일이 너무 커요" → 리팩토링 시작
- 코드 리뷰에서 가장 흔한 피드백 유형

**2. 복잡 작업성 (Complexity)**
- 단순 파일 분리 아님
- 도메인 로직 분석 필요
- 의존성 그래프 분석 필요
- 테스트/타입 함께 이동

**3. 성공/실패 판정 명확성**
- 빌드 통과: binary
- 순환 의존성: detectable
- 파일 크기: measurable
- 기능 유지: testable

**4. Fooks 적합성**
- 큰 파일에서 추출 가치 높음
- 구조 정보 (imports, exports) 중요
- 분리 지점 판단에 extraction 활용 가능

---

### 대상 설정

**Repo:** shadcn-ui (ui)
**Target:** `apps/v4/registry/bases/radix/examples/combobox-example.tsx`
**Lines:** 1,249 (large-mixed)
**Task:** R4 Feature Module Split

**분리 계획:**
```
combobox-example.tsx (1,249 lines)
├── components/
│   ├── combobox/
│   │   ├── Combobox.tsx          (메인 컴포넌트)
│   │   ├── ComboboxInput.tsx     (input 로직)
│   │   ├── ComboboxList.tsx      (list 렌더링)
│   │   └── ComboboxItem.tsx      (item 개별)
├── hooks/
│   └── useCombobox.ts            (state 로직)
├── utils/
│   └── combobox-utils.ts         (helper 함수)
└── types/
    └── combobox-types.ts         (TypeScript 인터페이스)
```

**성공 기준 (측정 가능):**
1. 원본 기능 100% 유지 (unit test 통과)
2. 파일당 최대 200라인 (초과 시 재분리)
3. 순환 import 0개 (eslint-plugin-import)
4. Type error 0개 (tsc --noEmit)
5. Barrel export 통일 (index.ts)

---

### 실행 준비 상태

**현재 가능:**
- ✅ 대상 파일 선정
- ✅ 분리 계획 수립
- ✅ 성공 기준 정의
- ✅ 측정 metric 정의

**현재 불가:**
- ❌ 실제 AI 코드 생성 (API access 없음)
- ❌ 생성 코드 검증 (runner 미구현)
- ❌ 자동 성공/실패 판정 (evaluator 미구현)

**명명:** `Layer 2 task runner spec` (benchmark result 아님)

---

## 요약

| Task ID | 이름 | 대상 | 상태 |
|---------|------|------|------|
| R1 | Component Migration | shadcn-ui components | candidate |
| **R4** | **Feature Module Split** | **combobox-example.tsx** | **첫 실행 후보** |
| R2 | Design System Integration | complex composites | candidate |
| R3 | API Layer Refactoring | data fetching layer | candidate |
| R5 | Framework Migration | Next.js/Tailwind config | candidate |

---

*Task Spec: 에르가재*  
*기준: Real-world frontend team 작업 기반*  
*첫 실행 후보: R4 (복잡성 + 측정 가능성 + fooks 적합성)*
