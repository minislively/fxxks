# Benchmark Architecture: Two-Layer System

> Historical benchmark planning note. For current public claim boundaries, use [`docs/benchmark-evidence.md`](../docs/benchmark-evidence.md) and [`benchmarks/layer2-frontend-task/STATUS.md`](layer2-frontend-task/STATUS.md). This file explains the benchmark direction, but older `TBD` / phase language below should not be read as the current release claim surface.

---

## 현재 문제 인식

**형수님 지적:**
> "지금 기준은 캐싱/추출 중심이라 불완전하고, 앞으로는 리팩토링/마이그레이션/복잡 수정 같은 실제 프론트 작업 기준 벤치로 확장해야 합니다."

**정확한 판단입니다.**

지금까지의 benchmark (nextjs/tailwindcss 9개 파일):
- ✅ Extraction quality (압축/품질)
- ✅ Coverage (파일별 측정)
- ❌ **실제 작업 성공성** (refactor/migration/task)

---

## Two-Layer Benchmark System

### Layer 1: Extraction Benchmark (현재 완료)

**목적:** 엔진 건강 체크

**측정:**
- token savings (압축률)
- extraction quality (C/B/S signal)
- coverage (파일 대표성)
- extractor fidelity (real/fallback)

**대상:**
- nextjs 4 files
- tailwindcss 5 files

**한계:**
> "수치는 좋은데 그래서 실제로 뭐가 좋아지는데?"

**현재 상태:** ✅ Phase 1 완료 (2026-04-15)

---

### Layer 2: Frontend Task Benchmark (미구현 - Phase 2)

**목적:** 실제 프론트 작업 성공성

**측정:**
- **Task Success Rate** (작업 완료율)
- **Edit Precision** (정확도)
- **Retry Count** (시도 횟수)
- **Completion Latency** (완료 시간)

**대상 작업 (예시):**

| Task Type | Description | Target Repo |
|-----------|-------------|-------------|
| **Router Migration** | Next.js pages → app router migration | nextjs |
| **Config Migration** | tailwindcss v3 → v4 config update | tailwindcss |
| **Validation Refactor** | Form validation logic extraction & refactor | cal.com |
| **Component Split** | Large-mixed component → smaller components | shadcn-ui |
| **Hook Extraction** | Inline logic → custom hook | formbricks |

**진입 조건:**
- Extraction benchmark 통과 (Layer 1)
- Real fooks path 사용 가능
- Quality signal 0.85+

**현재 상태:** ❌ 미구현 (Phase 2 예정)

---

### Layer 3: Final Comparison Metrics (미구현 - Phase 3)

**목적:** 통합 성능 평가

**통합 지표:**

| Metric | Layer 1 | Layer 2 | 통합 |
|--------|---------|---------|------|
| **Token Savings** | ✅ 85.3% | - | baseline |
| **Task Success** | - | ⏳ TBD | 핵심 |
| **Edit Precision** | - | ⏳ TBD | 핵심 |
| **Retry Count** | - | ⏳ TBD | 효율성 |
| **Completion Latency** | - | ⏳ TBD | 속도 |

**최종 질문:**
> "이 서비스가 실제 프론트 복잡 작업에 유리한가?"

**답변 가능 시점:** Phase 3 완료 후

---

## Phase Roadmap

### Phase 1: Extraction Benchmark ✅ (완료)
- [x] Real fooks path 확보
- [x] 6개 리포 파일 선정
- [x] Quality signal 측정
- [x] History/latest 기록 체계

**결과:** nextjs/tailwindcss 9개 파일, 85.3% savings, 0.88 quality

### Phase 2: Frontend Task Benchmark ⏳ (다음)
- [ ] Task definition (router migration, validation refactor, etc.)
- [ ] Success criteria 정의
- [ ] Test harness 구현
- [ ] 3-5개 실제 작업 실행

**목표:** "이 extraction으로 실제 작업이 잘 되는가?" 증명

### Phase 3: Final Metrics ⏳ (미래)
- [ ] Layer 1 + Layer 2 통합
- [ ] Comparative analysis
- [ ] ROI calculation
- [ ] Production readiness gate

**목표:** "실제 프론트 작업에 유리한가?" 답변

---

## 지금까지의 benchmark 재분류

| 기존 명칭 | 정확한 명칭 | Layer | 상태 |
|-----------|-------------|-------|------|
| "nextjs/tailwindcss benchmark" | **Extraction Benchmark** | Layer 1 | ✅ 완료 |
| (미구현) | **Frontend Task Benchmark** | Layer 2 | ⏳ 예정 |
| (미구현) | **Integrated Performance Benchmark** | Layer 3 | ⏳ 예정 |

---

## 다음 작업 우선순위

**즉시 (이번 주):**
1. Task benchmark 설계 (3-5개 작업 선정)
2. Success criteria 정의 (뭐가 "성공"인가?)
3. Test harness 스캐폴드

**단기 (다음 달):**
4. Router migration task PoC (nextjs)
5. Validation refactor task PoC (cal.com)
6. Component split task PoC (shadcn-ui)

**중기 (분기):**
7. 10+ task 실행
8. 통합 metrics 계산
9. Production gate 정의

---

## 핵심 질문 체크리스트

**현재 (Phase 1만):**
- ❌ "이 extraction으로 실제 작업이 잘 되는가?" → 답변 불가
- ❌ "리팩토링 성공률은?" → 답변 불가
- ❌ "마이그레이션 정확도는?" → 답변 불가

**Phase 2 이후:**
- ✅ "Task success rate: X%"
- ✅ "Edit precision: Y%"
- ✅ "Avg retries: Z회"

**Phase 3 이후:**
- ✅ "이 서비스가 실제 프론트 복잡 작업에 유리한가? YES/NO"

---

*정리: 에르가재*  
*형수님 지적 반영: 2026-04-15*  
*상태: Layer 1 완료, Layer 2/3 정의*
