# CASE-1 T1 Button Relocation - Failure Analysis

> 실제 benchmark 시도 결과: vanilla/fooks 모두 실행했으나 각각 다른 실패 유형

> Historical note: this captures the old configured gateway path failure. Current canonical status is in `STATUS.md`; current runner smoke uses `codex exec` and no longer treats this gateway path as the sole active blocker.

---

## 실행 개요

| 항목 | 값 |
|------|-----|
| **Task** | T1 Button Relocation |
| **Repo** | nextjs |
| **Target** | examples/auth/app/page.tsx |
| **실행 시도** | ✅ vanilla 시도 완료, ✅ fooks 시도 완료 |
| **비교 결과** | ❌ unavailable (둘 다 실패) |

---

## 실패 유형 분리

### Vanilla 실행: 400 Bad Request

| 항목 | 값 |
|------|-----|
| **에러 코드** | 400 Bad Request |
| **발생 시점** | websocket connection |
| **재현 시간** | ~5초 |
| **retry** | 0회 (immediate) |
| **에러 메시지** | `failed to connect to websocket: HTTP error: 400 Bad Request` |

**최소 재현 명령어:**
```bash
cd ~/Workspace/fooks-test-repos/nextjs
echo 'Move the "Sign in with GitHub" button from the left side to the right side of the page. Maintain all existing functionality and styling.' | \
npx codex exec -m gpt-5.4 --full-auto --skip-git-repo-check
```

**스크립트:** `/tmp/vanilla-400-repro.sh`

---

### Fooks 실행: 502 Bad Gateway

| 항목 | 값 |
|------|-----|
| **에러 코드** | 502 Bad Gateway |
| **발생 시점** | UserPromptSubmit 후 |
| **재현 시간** | ~90초 |
| **retry** | 5회 후 최종 실패 |
| **에러 메시지** | `Reconnecting... 5/5` → `502 Bad Gateway` |

**최소 재현 명령어:**
```bash
cd ~/Workspace/fooks
node -e "const f=require('./dist/index.js');const r=f.extractFile('examples/auth/app/page.tsx');console.log('Move button:\n'+r.rawText)" | \
npx codex exec -m gpt-5.4 --full-auto --skip-git-repo-check
```

**스크립트:** `/tmp/fooks-502-repro.sh`

---

## Fooks Extraction 결과 (성공)

```json
{
  "filePath": "examples/auth/app/page.tsx",
  "mode": "raw",
  "rawSizeBytes": 814,
  "complexityScore": 20.3,
  "lineCount": 42,
  "componentName": "Page"
}
```

- ✅ 추출은 성공
- ❌ 실행은 실패

---

## Comparison Status

| Metric | Vanilla | Fooks | Delta |
|--------|---------|-------|-------|
| **Success** | ❌ 400 | ❌ 502 | N/A |
| **Input Tokens** | — | 814 (extracted) | N/A |
| **Output Tokens** | — | — | N/A |
| **Latency** | ~5s | ~90s | N/A |
| **Retry** | 0 | 5 | N/A |
| **Changed Files** | 0 | 0 | N/A |
| **Validation** | N/A | N/A | N/A |

**Status:** ❌ **Comparison unavailable - both failed on external infrastructure**

---

## 분석

### 핵심 발견
1. **Vanilla와 Fooks는 서로 다른 실패 유형**
   - vanilla: 400 (websocket)
   - fooks: 502 (gateway)

2. **Fooks extraction은 정상 작동**
   - 814 bytes 추출 완료
   - raw mode로 판정
   - 실행 단계에서만 실패

3. **External lane 상태**
   - unstable (400/502 혼재)
   - 동일 prompt라도 다른 에러 발생

---

## 다음 액션

| 우선순위 | 작업 |
|----------|------|
| 1 | External lane 상태 모니터링 |
| 2 | 400 vs 502 패턴 분석 (시간/요청 차이) |
| 3 | Alternative execution path 평가 |
| 4 | Retry with backoff 전략 테스트 |

---

## Artifact 목록

| 파일 | 내용 |
|------|------|
| `/tmp/vanilla-400-repro.sh` | vanilla 400 재현 스크립트 |
| `/tmp/fooks-502-repro.sh` | fooks 502 재현 스크립트 |
| `/tmp/t1-vanilla.log` | vanilla 실행 로그 |
| `/tmp/t1-fooks.log` | fooks 실행 로그 |

---

*Analysis: 에르가재*
*Date: 2026-04-15*
*Status: Attempted both, failed differently, comparison unavailable*
