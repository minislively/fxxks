# Layer 2 Frontend Task Benchmark - Status

> 현재 상태 고정

---

## 1. 현재 상태 (정확한 용어)

| Layer | 정의 | 상태 | 상세 |
|-------|------|------|------|
| **Layer 1: Extraction Benchmark** | 압축/추출/coverage/quality 측정 | ✅ **Active** | nextjs 4 + tailwindcss 5, Avg savings 85.3%, history/latest 체계 |
| **Layer 2: Task Definition/Spec** | 프론트 작업 아이디어 정의/스펙화 | ✅ **Complete** | 7개 task inventory, R4 spec, validation, metric schema 완성 |
| **Layer 2: Task Execution** | 실제 AI로 작업 실행/비교 | ⏸️ **Blocked** | Codex→layofflabs gateway 502 |
| **Layer 2: Real Benchmark** | 실제 실행 결과 | ❌ **Not yet** | 실행 결과 없음 |

### 핵심 Canonical 문구

> **Layer 2 Task Definition/Spec is complete.**
> **Layer 2 real execution is blocked by Codex→layofflabs gateway 502.**
> **Therefore Layer 2 real benchmark results do not exist yet.**

---

## 2. Layer 2 Extraction 완료물 (Execution과 무관)

| 산출물 | 상태 | 내용 |
|--------|------|------|
| **Task Inventory** | ✅ 완성 | 7개 프론트 토큰 고비용 task 정의 (T1-T7) |
| **R4 Runner Spec** | ✅ 완성 | Feature Module Split 입력/출력/성공기준 |
| **Validation Checklist** | ✅ 완성 | 6개 기준 검증 방법 |
| **Metric Schema** | ✅ 완성 | 6개 metric 측정/로깅/비교 정의 |
| **Runner/Wrapper** | ✅ 구현 | runner.js, codex-wrapper.js 구현, 테스트 대기 |
| **First Candidate** | ✅ 고정 | R4 Feature Module Split (shadcn-ui combobox-example.tsx) |

---

## 2. 고정된 첫 후보

| 항목 | 값 |
|------|-----|
| **Task ID** | R4 |
| **Task Name** | Feature Module Split |
| **Repo** | shadcn-ui |
| **Target File** | `combobox-example.tsx` (1,249 lines) |
| **분리 목표** | components/ hooks/ utils/ types/ |
| **성공 기준** | 기능유지/파일≤200라인/type0/순환import0/barrel |

---

## 3. Blocker (정확한 정의 - 2026-04-15 최종)

| Blocker | 상태 | 세부 사항 |
|---------|------|-----------|
| **Runner 미구현** | ✅ RESOLVED | runner.js, codex-wrapper.js 구현 완료 |
| **Metric 파이프라인** | ✅ RESOLVED | 수집 로직 구현 완료 |
| **Fooks 구현/설계** | ✅ RESOLVED | spec trio 완성, wrapper 동작 확인 |
| **Codex→layofflabs Gateway (502)** | ⚠️ **ACTIVE** | 외부 인프라 문제, fooks无关 |

### 정확한 Blocker 분석 (최종)

**이전 (부정확):** `API access pending` / `runner implementation pending` / `spec 부족`  
**현재 (정확):** **`Codex→layofflabs gateway path stability (502)`**

### 확정된 분리 실험

| 테스트 | 조건 | 결과 | 병목 분리 |
|--------|------|------|-----------|
| **Minimal + wrapper** | 34 chars, with wrapper | ❌ 502 | wrapper无关 |
| **Minimal + wrapper-less** | 34 chars, direct CLI | ❌ 502 | **wrapper无关 확정** |
| **R4 vanilla** | 39,209 bytes | ❌ 502 | context size无关 |
| **R4 fooks** | ~3,000 bytes | ❌ 502 | context size无关 |

**핵심 발견 (최종):**
```
Wrapper-less direct Codex CLI call also fails with identical 502.
Confirmed: bottleneck is Codex→layofflabs gateway path stability, 
NOT fooks wrapper or implementation.
```

**패턴 (모든 테스트 동일, 모든 조건 동일):**
1. SessionStart 성공
2. UserPromptSubmit 성공  
3. Reconnecting... 5/5 반복
4. 502 Bad Gateway 최종 실패

**에러 상세:**
```
ERROR: unexpected status 502 Bad Gateway: 
  error code: 502, 
  url: https://api.layofflabs.com/v1/responses
```

### 결론
- **내부 구현 문제:** ❌ 아님 (runner, wrapper, spec 모두 완성)
- **외부 인프라 문제:** ✅ 맞음 (Codex→layofflabs gateway 502)
- **Layer 2 benchmark:** ⏸️ 외부 의존성 해결 전까지 보류

---

## 4. 실행 가능 시 즉시 측정 (준비됨, 대기 중)

API access 확보 시 바로 측정할 4개 metric (이미 구현됨):

| Metric | Vanilla | Fooks |
|--------|---------|-------|
| **success/fail** | boolean | boolean |
| **token usage** | input tokens | input tokens |
| **retry count** | N회 | N회 |
| **completion latency** | ms | ms |

**측정 구현 상태:** ✅ 준비 완료 (Gateway 회복 대기 중)

---

## 명명 규칙 (고정)

**허용:**
- ✅ `spec`
- ✅ `scaffold`
- ✅ `trio complete`
- ✅ `runner implemented`

**금지:**
- ❌ `benchmark` (실제 실행 없음)
- ❌ `result` (측정 데이터 없음)
- ❌ `완료` (Gateway blocker 존재)

---

## 현재 Blocker Canonical 문구

> **Runner implemented.  
> Real blocker is Codex gateway stability (502) across all prompt sizes.  
> Layer 2 real benchmark blocked by gateway, not by context size.**

---

## 다음 단계

**현재 가능:**
- ✅ Layer 1 benchmark 유지 및 확장
- ✅ R4 spec/scaffold 문서 유지
- ✅ Gateway 회복 모니터링

**대기 필요:**
- ⚠️ Codex gateway 안정성 회복
- ⚠️ 또는 안정적인 대체 경로 확보

**복구 확인 방법:**
```bash
# 주기적 재시도 (30분 간격)
echo 'test' | codex exec -m gpt-4o --full-auto
# 502 사라지면 benchmark 재개
```

**대체 경로 검토 (형수님 판단 대기):**
- 옵션 A: Direct OpenAI API (보류 중 - Codex 환경 의미 흐려짐)
- 옵션 B: Gateway 안정화 대기 (현재)
- 옵션 C: Anthropic Claude (컷 - Codex 축 benchmark 목표)

---

*Status: 에르가재*  
*Date: 2026-04-15*  
*Runner: ✅ Implemented*  
*Gateway: ⚠️ 502 Blocker*  
*Benchmark: ⏸️ On Hold (External Service Issue)*
