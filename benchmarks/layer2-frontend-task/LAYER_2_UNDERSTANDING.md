# Layer 2 정확한 이해

## Layer 구분 확정

### Layer 1 = Extraction Benchmark ✅ 완료
- 압축/추출/coverage/quality signal
- nextjs/tailwindcss real benchmark
- **있음, 실행됨, 결과 있음**

### Layer 2 = Frontend Task Benchmark ❌ 없음
- 실제 프론트 작업 성공성
- 리팩토링/마이그레이션/분리 작업
- **없음, 실행 안 됨, 결과 없음**
- **지금은 spec/scaffold만 있음**

**7-phase pipeline ≠ Layer 2**
- 7-phase는 Layer 1 구현 흐름
- Layer 2는 별도의 "작업 성공성 측정 레이어"

---

## Layer 2 진행 방식 (고정)

### 1. 지금은 benchmark 아님
**허용 표현:**
- ✅ `spec`
- ✅ `candidate`  
- ✅ `scaffold`

**금지 표현:**
- ❌ `benchmark`
- ❌ `result`
- ❌ `완료`

### 2. 첫 후보 R4 고정
| 항목 | 고정 값 |
|------|---------|
| Task | R4 Feature Module Split |
| Repo | shadcn-ui |
| File | combobox-example.tsx (1,249 lines) |
| 목표 | components/ hooks/ utils/ types/ 분리 |
| 성공 기준 | 기능유지/파일≤200/type0/순환import0/barrel |

### 3. API access 전까지
- runner input/spec 정교화 ✅
- 성공 기준 검증 로직 정리
- vanilla/fooks 비교 metric 고정
- **benchmark/result/완료 금지**

### 4. API access 생기면
- vanilla 1회
- fooks 1회
- success/fail
- token usage
- retry count
- latency

---

## 리딩 기준 (고정)

- ✅ Layer 1과 Layer 2 절대 섞지 않음
- ✅ 실행 안 했으면 안 했다고 말함
- ✅ spec은 spec이라고 말함
- ✅ 결과 파일 + 숫자 + 설명 없으면 완료라고 말하지 않음

---

**이해 확인: 에르가재**  
**기준 고정: 2026-04-15**
