# Layer 2 Real-World Benchmark Design

> 실제 Codex/CLI 환경 기준 benchmark (HTTP client 구현 보류, real-world 우선)

---

## Benchmark Layer 분리

### 1. Lab Benchmark (보조 축, 현재 보류)
- **Method:** Direct HTTP API call
- **Purpose:** 토큰/응답 포맷/latency 정밀 비교
- **Status:** ⏸️ 구현 보류 (real-world 우선)
- **When needed:** 나중에 정밀 측정 필요 시

### 2. Real-World Benchmark (우선순위 1)
- **Method:** 실제 Codex CLI 실행
- **Purpose:** 실제 작업 흐름에서 vanilla vs fooks 비교
- **Status:** 🔄 설계/실행 진행
- **Goal:** 실제 환경에서 이상 여부 검증

---

## Real-World Benchmark 케이스 분류

| # | 분류 | 예시 Task | 성공 판정 기준 |
|---|------|-----------|----------------|
| 1 | **Refactor** | Component splitting (1,249 lines → modular) | 기능 유지, 파일 분리, 타입 에러 0 |
| 2 | **Migration** | API layer refactoring (inline → centralized) | API 동작 유지, 호환성 유지 |
| 3 | **Feature Addition** | Auth integration 추가 | 기능 추가, 기존 기능 무결성 |
| 4 | **Bug Fix** (필요 시) | Known issue 해결 | 버그 재현 불가, 테스트 통과 |

---

## 측정 지표 (Real-World)

| Metric | 설명 | 측정 방법 |
|--------|------|-----------|
| **Success/Fail** | 작업 완료 여부 | exit code + validation |
| **Retry Count** | 재시도 횟수 | Codex CLI 재시도 로그 |
| **Latency** | 전체 소요 시간 | wall-clock time |
| **Changed Files** | 수정/생성된 파일 수 | `git diff --stat` |
| **Validation Result** | 타입/빌드/순환 검증 | `tsc --noEmit`, `madge --circular` |
| **Quality Judgment** | 한 줄 품질 판정 | 수동/자동 평가 |

---

## Runner 구조 (Real-World)

### 기본 원칙
- **실제 Codex CLI 사용** (`codex exec` wrapper path)
- **Tiny/R4 proposal-only smokes와 applied-code benchmark를 분리**: smoke는 runner path proof, stable benchmark는 applied-code validation + multi-task evidence 필요
- **R4 vanilla/fooks paired output을 실제 패치로 적용하고 validation artifact + multi-task evidence가 있어야 stable benchmark 결과로 인정**

### 실행 순서
```bash
# 1. Vanilla run
node benchmarks/layer2-frontend-task/runner.js \
  --mode=vanilla \
  --target=<file> \
  --output=benchmarks/layer2-frontend-task/results/R4-vanilla-run-2.json

# 2. Fooks run
node benchmarks/layer2-frontend-task/runner.js \
  --mode=fooks \
  --target=<file> \
  --output=benchmarks/layer2-frontend-task/results/R4-fooks-run-2.json

# 3. Validation/비교 artifact 저장
node compare.js results/R4-vanilla-run-2.json results/R4-fooks-run-2.json
```

---

## 현재 Blocker 현실 인정

| Blocker | 상태 | 대응 |
|---------|------|------|
| **Legacy configured gateway 502** | ✅ **Retired as sole blocker** | 현재 wrapper는 `codex exec` tiny + two R4 paired proposal-only smokes 통과 |
| **R4 paired smokes** | ✅ **Collected twice** | 2026-04-21 proposal-only pairs: 11365 → 861 approx prompt tokens in both |
| **Applied-code/multi-task evidence 없음** | ⏸️ **Active** | R4 결과마다 validation output 저장 + 반복 실행 필요 |
| **Lab benchmark (HTTP client)** | ⏸️ **보류** | Real-world 우선, 나중에 구현 |

### Status Summary
> **Real-world benchmark 설계는 완료됨.**
> **Tiny `codex exec` smoke와 2회 R4 paired proposal-only smoke는 통과했다.**
> **2회 R4 smoke 모두 promptTokensApprox는 11365 → 861로 92.4% 작아졌다.**
> **Lab benchmark (HTTP client)는 보조 축으로 보류됨.**
> **applied-code validation + multi-task evidence 전에는 runtime-token savings/win claim 금지.**

---

## README 스타일 결과 예시 (목표)

```markdown
## Case: R4 Feature Module Split

| 항목 | Vanilla | Fooks | 결과 |
|------|---------|-------|------|
| **Success** | ✅ | ✅ | 동등 |
| **Input Tokens** | 12,450 | 2,180 | 82% 절감 |
| **Latency** | 45s | 38s | 15% 향상 |
| **Retry Count** | 2 | 0 | 재시도 감소 |
| **Changed Files** | 8 | 8 | 동등 |
| **Validation** | ✅ Pass | ✅ Pass | 동등 |
| **Quality** | Good | Good | 동등 |

**판정:** Fooks가 토큰 절감과 재시도 감소에서 이점, 품질은 동등.
```

---

*Design: 에르가재*
*Date: 2026-04-15*
*Priority: Real-world benchmark 우선*
*Blocker: applied-code validation + multi-task evidence pending*
*Lab benchmark: 보류*
