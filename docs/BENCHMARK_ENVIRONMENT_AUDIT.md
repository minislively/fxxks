# Layer 2 Benchmark 환경 검토 체크리스트

> 형수님 직접 검토용 - 각 항목별 판단 기준

## 현재 존재하는 환경 요소

### Tier 1: 핵심 (제거 불가)
| 요소 | 위치 | 역할 | 제거 시 영향 |
|------|------|------|-------------|
| 실제 repo 파일 | `fooks-test-repos/` | 추출 대상 | 측정 불가 |
| Git worktree | `runners/*.py` | 실행 격리 | 환경 오염, 비교 무효 |
| Codex CLI | 시스템 PATH | AI task 실행 | benchmark 자체 불가 |

### Tier 2: 검증 강화 (권장)
| 요소 | 위치 | 역할 | 없을 시 영향 |
|------|------|------|-------------|
| Type check | `validation/` 내 | 정확성 검증 | 회귀 미감지 |
| Build pass | runner 내 | 통합 검증 | 배포 실패 위험 |
| Test pass | 미정의 | 기능 보존 | silent breakage |

### Tier 3: 미정의/불필요 (검토 대상)
| 요소 | 존재 여부 | Skill 기준 | 판단 |
|------|----------|-----------|------|
| 브라우저 런타임 | ❌ 없음 | 미언급 | 불필요 |
| Playwright | ❌ 없음 | 미언급 | 불필요 |
| E2E 테스트 | ❌ 없음 | 미언급 | 불필요 |
| 실제 서버 구동 | ❌ 없음 | 미언급 | 불필요 |

## 직접 판단을 위한 질문

### Layer 2 핵심 질문
```
1. "실제 편집 작업 성공"의 정의는?
   → 파일 수정됨 + 타입 에러 없음 + 빌드 통과
   → 브라우저에서 실행됨? (현재 skill 기준: NO)

2. formbricks deleteAccountModal 수정 후 검증 범위는?
   → 파일 단위: 수정됨, 타입 통과
   → 통합 단위: 빌드 통과
   → 런타임 단위: 브라우저 실행? (미정의)

3. 경량화 시 버릴 것은?
   → 브라우저 환경 (정의되지 않음)
   → E2E 도구 (정의되지 않음)
   → BUT: Build/type check는 유지 권장
```

### 현재 Layer 2 Success Criteria (skill 기준)
```typescript
// R4 Feature Module Split 기준
successCriteria: [
  "functionality_preserved",      // 의미 보존
  "file_size_under_200_lines",   // 구조 품질
  "type_errors_zero",            // 타입 정확성
  "circular_imports_zero",       // 의존성 품질
  "barrel_exports_complete",    // 인터페이스 완성도
  "build_passes"                 // 통합 검증
]
// → 브라우저 런타임 미포함
```

## 검토 결정 트리

```
브라우저 환경 추가 고민 중?
    ↓
Skill 문서에 정의되어 있는가?
    ↓ NO → 불필요 (현재 benchmark와 무관)
    ↓ YES → 검토 필요

현재 Layer 2 측정 목적은?
    ↓
AI 편집 작업 성공률 → 정적 검증으로 충분 (type/build)
    ↓
런타임 동작 검증 → 브라우저 필요 (현재 목적 아님)
```

## 실제 파일 확인 경로

```bash
# 현재 benchmark 환경 전체 구조
ls -la ~/Workspace/fooks/benchmarks/

# Layer 2 runner (Python)
cat ~/Workspace/fooks/benchmarks/frontend-harness/runners/setup.py | head -100

# Task 정의
cat ~/Workspace/fooks/benchmarks/frontend-harness/tasks/task-definitions.json

# v2 schema (TypeScript)
ls ~/Workspace/fooks/benchmarks/v2/src/

# 실제 결과물 (어디까지 측정되는가)
cat ~/Workspace/fooks/benchmarks/latest/current-real-benchmark.json | jq '.metrics'
```

## 권장 판단

**유지 (필수):**
- 실제 repo 파일 (formbricks 등)
- Git worktree isolation
- Codex CLI execution
- Type check / Build pass 검증

**제거/미추가 (불필요):**
- 브라우저 런타임 환경
- Playwright/E2E
- 실제 서버 구동

**이유:**
- Skill 기준 Layer 2 = 정적 추출 + AI 편집 + 빌드 검증
- 브라우저 런타임은 정의되지 않음
- 추가 시 유지보수 비용만 증가, 검증력 저하 없음
