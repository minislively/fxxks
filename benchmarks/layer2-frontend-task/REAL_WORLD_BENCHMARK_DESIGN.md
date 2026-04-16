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
- **실제 Codex CLI 사용** (Layofflabs gateway 의존)
- **Gateway 502 blocker는 현실로 인정** ⏸️
- **Blocker 해결 시 즉시 실행 가능한 구조** 유지

### 실행 순서
```bash
# 1. Vanilla run
npx codex exec --mode=vanilla --target=<file> --output=results/vanilla-run-1.json

# 2. Fooks run
npx codex exec --mode=fooks --fooks-path=dist/index.js --target=<file> --output=results/fooks-run-1.json

# 3. 비교
node compare.js results/vanilla-run-1.json results/fooks-run-1.json
```

---

## 현재 Blocker 현실 인정

| Blocker | 상태 | 대응 |
|---------|------|------|
| **Codex→layofflabs gateway 502** | ⏸️ **Active** | Real-world benchmark 실행 불가 |
| **Gateway 회복 대기** | ⏸️ **Ongoing** | 주기적 재시도 (30분 간격) |
| **Lab benchmark (HTTP client)** | ⏸️ **보류** | Real-world 우선, 나중에 구현 |

### Status Summary
> **Real-world benchmark 설계는 완료됨.**
> **실제 실행은 Codex→layofflabs gateway 502로 인해 현재 불가능.**
> **Lab benchmark (HTTP client)는 보조 축으로 보류됨.**
> **Gateway 회복 시 real-world benchmark 즉시 실행 가능.**

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
*Blocker: Codex→layofflabs gateway 502 (현실 인정)*
*Lab benchmark: 보류*
