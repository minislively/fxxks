# Layer 2: Frontend Task Benchmark Design

> 실제 프론트 작업 성공성 측정 설계

---

## Task 유형 정의 (5개 초기)

### T1: Router Migration Task
**대상:** nextjs app-router.tsx
**작업:** Pages Router → App Router 마이그레이션
**성공 기준:**
- 새 파일 구조 생성 (✓)
- import 경로 업데이트 (✓)
- 데이터 fetching 패턴 변환 (✓)
- 에러 없이 빌드 통과 (✓)

**측정:**
- success: boolean
- files_modified: number
- build_pass: boolean
- manual_fixes_needed: number

---

### T2: Validation Refactor Task
**대상:** cal.com form-heavy component
**작업:** Inline validation → Zod schema 추출
**성공 기준:**
- Zod schema 생성 (✓)
- 기존 로직 제거 (✓)
- 타입 안정성 유지 (✓)
- 테스트 통과 (✓)

**측정:**
- schema_extraction_complete: boolean
- type_errors: number
- tests_pass: boolean
- rollback_needed: boolean

---

### T3: Component Split Task
**대상:** shadcn-ui large-mixed component
**작업:** 200+ 라인 컴포넌트 → 3개 작은 컴포넌트
**성공 기준:**
- 3개 파일로 분리 (✓)
- props interface 정의 (✓)
- import/export 정리 (✓)
- 기존 기능 유지 (✓)

**측정:**
- split_success: boolean
- new_components: number
- breaking_changes: number
- storybook_pass: boolean

---

### T4: Hook Extraction Task
**대상:** formbricks hook-heavy component
**작업:** Inline useEffect/useState → custom hook
**성공 기준:**
- useDataForm hook 생성 (✓)
- 원본 컴포넌트 리팩토링 (✓)
- hook 재사용 가능 (✓)
- 테스트 통과 (✓)

**측정:**
- hook_created: boolean
- lines_reduced_in_component: number
- hook_test_coverage: number
- usage_sites: number

---

### T5: Config Migration Task
**대상:** tailwindcss theme.ts
**작업:** v3 → v4 config migration
**성공 기준:**
- 새 config format 적용 (✓)
- 커스텀 theme 마이그레이션 (✓)
- plugin 설정 업데이트 (✓)
- 빌드 결과 동일 (✓)

**측정:**
- config_valid: boolean
- visual_regression: boolean
- bundle_size_delta: number
- migration_guide_accuracy: number

---

## 통합 측정 지표

| Metric | Description | Target |
|--------|-------------|--------|
| **task_success_rate** | 작업 완료율 (5개 중 성공) | ≥80% |
| **edit_precision** | AI 생성 코드 정확도 | ≥85% |
| **retry_count** | human correction 필요 횟수 | ≤2 |
| **completion_latency** | 작업 완료 시간 | ≤30min |
| **rollback_rate** | 되돌리기 필요 비율 | ≤10% |

---

## Layer 1 → Layer 2 연결

**진입 기준 (Layer 1 통과 필요):**
- extraction quality ≥ 0.85
- real fooks path available
- coverage ≥ 80%

**Layer 1 결과 → Layer 2 예측:**
```
extraction_quality 0.90 → task_success 예측 85%
actual 결과 → 예측 정확도 측정
```

---

## 실행 계획

**Week 1:** T1 (Router Migration) PoC
**Week 2:** T2 (Validation Refactor) PoC
**Week 3:** T3 (Component Split) PoC
**Week 4:** 통합 분석 및 Phase 3 설계

---

*설계: 에르가재*  
*형수님 지적 반영: 실제 작업 성공성 측정*
