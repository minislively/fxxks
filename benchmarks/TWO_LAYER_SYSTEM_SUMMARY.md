
# Two-Layer Benchmark System 정의 완료

## Date: 2026-04-15

---

## 형수님 지적 반영 완료

> "지금 기준은 캐싱/추출 중심이라 불완전하고, 앞으로는 리팩토링/마이그레이션/복잡 수정 같은 실제 프론트 작업 기준 벤치로 확장해야 합니다."

**완전히 맞는 지적입니다.**

---

## 기존 benchmark 재분류

| 기존 명칭 | 정확한 명칭 | 상태 | 한계 |
|-----------|-------------|------|------|
| "nextjs/tailwindcss benchmark" | **Extraction Benchmark** (Layer 1) | ✅ 완료 | 실제 작업 성공성 미측정 |
| (미구현) | **Frontend Task Benchmark** (Layer 2) | ⏳ 설계 완료 | 실행 예정 |
| (미구현) | **Integrated Performance Benchmark** (Layer 3) | ⏳ 정의 | 분기 목표 |

---

## 산출물 목록

| 파일 | 내용 |
|------|------|
| `BENCHMARK_ARCHITECTURE.md` | Two-layer system 정의, Phase 1/2/3 로드맵 |
| `layer2-frontend-task/TASK_BENCHMARK_DESIGN.md` | 5개 작업 유형 정의, 성공 기준, 측정 지표 |

---

## Layer 1 (완료) - Extraction Benchmark

**결과:**
- 9 files (nextjs 4 + tailwindcss 5)
- 85.3% savings
- 0.88 quality
- 100% real path

**한계:**
> "수치는 좋은데 그래서 실제로 뭐가 좋아지는데?" → **아직 답변 불가**

---

## Layer 2 (설계 완료) - Frontend Task Benchmark

**5개 작업 유형:**

| ID | 작업 | 대상 | 성공 기준 |
|----|------|------|-----------|
| T1 | Router Migration | nextjs | Pages → App Router |
| T2 | Validation Refactor | cal.com | Inline → Zod schema |
| T3 | Component Split | shadcn-ui | 200+ lines → 3 files |
| T4 | Hook Extraction | formbricks | Inline → custom hook |
| T5 | Config Migration | tailwindcss | v3 → v4 |

**측정 지표:**
- task_success_rate (≥80%)
- edit_precision (≥85%)
- retry_count (≤2)
- completion_latency (≤30min)

**실행 계획:**
- Week 1: T1 PoC
- Week 2: T2 PoC
- Week 3: T3 PoC
- Week 4: 통합 분석

---

## Layer 3 (정의) - Final Metrics

**통합 질문:**
> "이 서비스가 실제 프론트 복잡 작업에 유리한가?"

**답변 가능 시점:** Phase 2 완료 후

**필요 지표:**
- Layer 1 (extraction) + Layer 2 (task success)
- 통합 ROI 계산
- Production readiness gate

---

## 운영 기준 재확인

**지금까지 준수:**
- ✅ copy vs symlink 분리
- ✅ derived vs actual 분리  
- ✅ 설정/실행/결과/기록 분리
- ✅ 완료 = 파일 + 숫자 + 설명

**앞으로 적용:**
- ✅ "benchmark" → "extraction benchmark" / "task benchmark" 명시
- ✅ Layer 1 결과 → Layer 2 진입 기준으로 활용
- ✅ "수치는 좋은데" 질문에 답변 가능하도록 Layer 2 실행

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

---

*정리: 에르가재*
*형수님 핵심 지적 반영: 2026-04-15*
*상태: Layer 1 완료, Layer 2 설계 완료, Layer 3 정의*
