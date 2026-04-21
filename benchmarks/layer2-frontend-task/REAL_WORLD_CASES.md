# Layer 2 Real-World Benchmark Cases

> 실제 작업 기준 benchmark 케이스 정의

---

## Case 1: Refactor

| 항목 | 값 |
|------|-----|
| **Task Name** | Component Splitting (Monolithic → Modular) |
| **Target Repo** | shadcn-ui |
| **Target File** | `apps/v4/registry/bases/radix/examples/combobox-example.tsx` |
| **Original Size** | 1,249 lines |
| **Task Description** | Split large monolithic combobox component into modular files |
| **Success Criteria** | ① 기능 100% 유지 ② 파일당 ≤200라인 ③ type error 0 ④ 순환 import 0 ⑤ barrel export 완료 |
| **Validation** | `tsc --noEmit`, `madge --circular`, `wc -l < 200` |
| **Vanilla/Fooks Comparison** | input tokens, output tokens, latency, retry count, changed files, validation pass/fail |

---

## Case 2: Migration

| 항목 | 값 |
|------|-----|
| **Task Name** | API Layer Refactoring (Inline → Centralized) |
| **Target Repo** | nextjs |
| **Target File** | `examples/api-routes-rest/pages/index.tsx` |
| **Original Pattern** | Inline fetch with useEffect |
| **Target Pattern** | Centralized API client with error handling |
| **Task Description** | Refactor inline data fetching into centralized API layer |
| **Success Criteria** | ① API 동작 유지 ② 에러 처리 개선 ③ 재사용 가능한 client ④ 기존 테스트 통과 |
| **Validation** | API endpoint 동작 확인, 타입 체크, 테스트 통과 |
| **Vanilla/Fooks Comparison** | input tokens, output tokens, latency, retry count, changed files, API compatibility |

---

## Case 3: Feature Addition

| 항목 | 값 |
|------|-----|
| **Task Name** | Auth Integration Addition |
| **Target Repo** | nextjs |
| **Target File** | `examples/auth/app/page.tsx` |
| **Original State** | Basic auth button (Sign in with GitHub on left) |
| **Target State** | Enhanced auth flow with improved UX |
| **Task Description** | Add auth integration with improved button placement and flow |
| **Success Criteria** | ① auth 기능 추가 ② 기존 기능 무결성 ③ UX 개선 ④ 타입 에러 0 |
| **Validation** | Auth flow 동작, 타입 체크, 기존 기능 테스트 |
| **Vanilla/Fooks Comparison** | input tokens, output tokens, latency, retry count, changed files, auth functionality |

---

## Benchmark Comparison Matrix

| Metric | Description | Measured For |
|--------|-------------|--------------|
| **Success/Fail** | 작업 완료 여부 | Both vanilla & fooks |
| **Input Tokens** | 모델 입력 토큰 수 | Both vanilla & fooks |
| **Output Tokens** | 모델 출력 토큰 수 | Both vanilla & fooks |
| **Latency** | 전체 소요 시간 (ms) | Both vanilla & fooks |
| **Retry Count** | 재시도 횟수 | Both vanilla & fooks |
| **Changed Files** | 수정/생성된 파일 수 | Both vanilla & fooks |
| **Validation Result** | 타입/빌드/순환 검증 | Both vanilla & fooks |
| **Quality Score** | 품질 평가 (1-5) | Both vanilla & fooks |

---

## Execution Status

| Case | Vanilla Status | Fooks Status | Blocker |
|------|---------------|--------------|---------|
| Case 1: Refactor | ✅ Single proposal-only smoke | ✅ Single proposal-only smoke | Validation/repeated evidence pending |
| Case 2: Migration | ⏸️ Not executed | ⏸️ Not executed | Not selected for current R4 round |
| Case 3: Feature | ⏸️ Not executed | ⏸️ Not executed | Not selected for current R4 round |

---

*Cases: 에르가재*
*Date: 2026-04-21*
*Status: Case 1 proposal-only smoke validated; repeated/applied-code evidence out of scope*
