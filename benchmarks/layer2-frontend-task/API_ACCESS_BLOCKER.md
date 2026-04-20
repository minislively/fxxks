# Layer 2 API Access Blocker Analysis

> R4 Feature Module Split 실제 benchmark 진입 blocker 정리

---

## 1. 어디서 막히는지

| 항목 | 상태 | 상세 |
|------|------|------|
| **API Key** | ✅ 있음 | `OPENAI_API_KEY`, `ANTHROPIC_AUTH_TOKEN` 환경변수 확인됨 |
| **API Base URL** | ✅ 설정됨 | `OPENAI_BASE_URL=https://api.layofflabs.com/v1` |
| **Codex CLI** | ✅ 설치됨 | `/mnt/offloading/.nvm/versions/node/v25.1.0/bin/codex` |
| **Runner 구현** | ✅ 있음 | `runner.js`, `codex-wrapper.js` 구현 완료; 실행은 gateway 502로 blocked |
| **Validation Hook** | ✅ 스캐폴드 있음 | metric/validation schema와 수집 로직 준비; 실제 Codex 결과는 gateway 502 때문에 미수집 |

**실제 Blocker (현재 canonical):**
1. **Codex Gateway Stability (502)** - minimal prompt부터 R4 prompt까지 동일하게 `api.layofflabs.com` 502 발생
2. **Real runtime result 없음** - runner/scaffold는 준비됐지만 외부 gateway blocker 때문에 Layer 2 실행 결과가 없음

---

## 2. 누구 권한/설정이 필요한지

| 항목 | 필요 여부 | 담당 |
|------|-----------|------|
| **API Key access** | ✅ 이미 있음 | 시스템 환경변수로 설정 완료 |
| **Codex CLI 설정** | ⚠️ 확인 필요 | `~/.codex/config.json` 또는 환경변수 |
| **Runner 개발** | ✅ 완료 | `runner.js`, `codex-wrapper.js` 구현됨; gateway 회복 시 실행 가능 |
| **shadcn-ui repo 접근** | ✅ 있음 | `/home/bellman/Workspace/fooks-test-repos/ui` |

**필요한 작업:**
- Codex CLI auth 상태 확인 (`codex auth status`)
- Gateway 502 회복 확인
- 준비된 runner/metric 파이프라인으로 R4 vanilla/fooks 실행

---

## 3. Gateway 회복 시 바로 실행할 절차

### Runner 실행 순서

```bash
# 1. R4 Runner 실행 (Vanilla)
node benchmarks/layer2-frontend-task/runner.js \
  --mode=vanilla \
  --target=shadcn-ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=results/R4-vanilla-run-1.json

# 2. R4 Runner 실행 (Fooks)
node benchmarks/layer2-frontend-task/runner.js \
  --mode=fooks \
  --target=shadcn-ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --fooks-path=dist/index.js \
  --output=results/R4-fooks-run-1.json
```

### 기록할 Metric 6개

| # | Metric | 저장 필드명 |
|---|--------|------------|
| 1 | **success/fail** | `output.success` (boolean) |
| 2 | **token usage** | `metrics.inputTokens`, `metrics.outputTokens` |
| 3 | **retry count** | `metrics.retryCount` |
| 4 | **latency** | `metrics.completionLatencyMs` |
| 5 | **edit precision** | `output.validation.*` (6개 기준 충족률) |
| 6 | **operational overhead** | `notes.operationalOverhead` (문자열 메모) |

### 결과 저장 경로
```
benchmarks/layer2-frontend-task/results/
├── R4-vanilla-run-1.json
├── R4-fooks-run-1.json
└── R4-comparison.json
```

---

## 4. 지금 당장 가능한 사전점검

**Gateway 회복 전에도 가능:**
- ✅ R4 spec trio 검증 (runner-spec, validation-checklist, metric-schema)
- ✅ Target file 존재 확인 (`combobox-example.tsx`)
- ✅ Fooks extraction 동작 확인 (payload 생성)
- ✅ Metric schema JSON 샘플 생성
- ✅ Runner 스크립트 스캐폴드 작성

**지금 확인된 사실 (Canonical 기준):**
- Layer 1: nextjs 4 + tailwindcss 5, Avg Savings 85.3%, real benchmark ✅
- Layer 2: R4 Feature Module Split spec/scaffold ✅
- API: Key 있음, Codex CLI 있음 ✅
- Runner: 구현됨 ✅, 실제 실행은 gateway 502 blocked ⏸️

**즉시 가능한 작업:**
```bash
# Codex CLI auth 확인
codex auth status

# Fooks extraction 테스트
node -e "const fooks = require('./dist/index.js'); console.log(fooks.extractFile('./fooks-test-repos/ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx'))"

# R4 runner/scaffold 확인
ls benchmarks/layer2-frontend-task
```

---

## Blocker 요약 (최종 업데이트)

| # | Blocker | 심각도 | 해결 방법 | 상태 |
|---|---------|--------|-----------|------|
| 1 | **R4 Runner/Wrapper** | ✅ RESOLVED | runner.js, codex-wrapper.js 구현 완료 | gateway 회복 대기 |
| 2 | **Metric 수집 파이프라인** | ✅ RESOLVED | 수집 로직 구현 완료 | 실제 결과는 502로 미수집 |
| 3 | **Codex Gateway Stability (502)** | ⚠️ **CRITICAL** | api.layofflabs.com 502 Bad Gateway | **현재 병목** |

---

## 실제 병목 분석 (신규)

### 테스트 결과

| 테스트 | Prompt 크기 | 결과 | Duration | 결론 |
|--------|-------------|------|----------|------|
| **Minimal** | 34 chars | ❌ 502 | 43초 | **Gateway 문제** |
| **Small** | ~200 chars | ❌ 502 | 43초 | **Gateway 문제** |
| **R4 Vanilla** | 39,209 bytes | ❌ Timeout→502 | 30초+ | **Gateway 문제** |
| **R4 Fooks** | ~3,000 bytes (추정) | ❌ Timeout→502 | 30초+ | **Gateway 문제** |

### 핵심 발견
```
[CONCLUSION] 502/Reconnecting occurs EVEN with minimal prompt
[CONCLUSION] This is a Codex gateway issue, NOT a prompt size issue
```

**모든 테스트에서 동일한 패턴:**
1. SessionStart 성공
2. UserPromptSubmit 성공
3. Reconnecting... 5/5 반복
4. 502 Bad Gateway 최종 실패

---

## 현재 Blocker 정의

**이전 (부정확):** `API access pending`
**이전 (부정확):** `runner implementation pending`

**현재 (정확):** `Codex gateway stability blocker (502)`

### 세부 사항
- **증상:** `api.layofflabs.com/v1/...` 502 Bad Gateway
- **재현:** 모든 prompt 크기에서 동일하게 발생
- **소요:** ~43초 후 실패 (timeout과 무관)
- **원인:** 외부 서비스 (Codex/게이트웨이) 안정성

---

## 해결 경로

### 옵션 A: Direct OpenAI API (보류)
- Codex 환경과 달라져 benchmark 의미 흐려짐
- 형수님 지시: **보류**

### 옵션 B: 게이트웨이 안정성 회복 대기 (현재)
- `api.layofflabs.com` 안정화 또는 대체 경로 확인 필요
- **실제 우선순위**

### 옵션 C: Anthropic Claude 전환 (컷)
- 지금 benchmark 목표는 Codex 환경
- 형수님 지시: **컷**

---

## 다음 단계

**현재 상황:**
- ⏸️ Runner 구현됐으나 실행 blocked
- ⏸️ Wrapper 구현됐으나 실행 blocked
- ⚠️ **Codex Gateway 502로 인해 실제 benchmark 실행 불가**

**즉시 가능:**
- Layer 1 benchmark 유지 및 확장
- R4 spec/scaffold 문서 유지

**대기 필요:**
- Codex gateway 안정성 회복
- 또는 안정적인 대체 경로 확보

**예상 복구 확인 방법:**
```bash
# 주기적 재시도 (30분 간격)
echo 'test' | codex exec -m gpt-4o --full-auto
# 502 사라지면 benchmark 재개
```

---

*Blocker 분석 업데이트: 에르가재*
*Date: 2026-04-15*
*Status: Runner ✅, Gateway ⚠️ (502), Benchmark on hold*

---

*Blocker 분석: 에르가재*
*Date: 2026-04-15*
*Status: API ✅, Runner ❌, Spec ✅*
*Next: Runner 구현 완료 시 즉시 R4 real benchmark 가능*
