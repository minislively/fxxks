# R4 Feature Module Split - Metric Schema

> 측정 정의, 로깅 포맷, 비교 기준

---

## 1. Run Pair Definition

### Vanilla Run
| 항목 | 정의 |
|------|------|
| **입력** | 원본 `combobox-example.tsx` 전체 내용 (39,209 bytes) |
| **prompt 형태** | 파일 전체를 LLM에 전달 |
| **목적** | fooks 추출 없이 직접 코드 생성 |
| **제약** | 동일 LLM, 동일 temperature, 동일 system prompt |

### Fooks Run
| 항목 | 정의 |
|------|------|
| **입력** | fooks 추출된 payload (2,011 bytes) |
| **prompt 형태** | 추출된 구조 정보 + 요청 |
| **목적** | fooks extraction 기반 코드 생성 |
| **제약** | 동일 LLM, 동일 temperature, 동일 system prompt |

### 동일 조건 보장
| 조건 | 동일성 |
|------|--------|
| LLM model | 동일 (예: gpt-4o/claude-sonnet) |
| Temperature | 0.1 (deterministic) |
| System prompt | 동일한 task instruction |
| max_tokens | 동일 (예: 8192) |
| Context window | 동일 고려 (vanilla는 더 큰 파일) |

---

## 2. Metric Definitions

### success/fail
| 정의 | 설명 |
|------|------|
| **success** | 6개 성공 기준 전부 충족 (validation checklist 기준) |
| **fail** | 1개 이상 기준 실패 |
| **partial** | 부분 충족, 기록은 하되 retry 필요 |

**측정 시점:** 코드 생성 완료 후 validation checklist 수행

### token usage
| 정의 | 설명 |
|------|------|
| **input tokens** | LLM에 전달된 prompt 토큰 수 |
| **output tokens** | LLM 생성한 코드 토큰 수 |
| **total tokens** | input + output |

**측정 방법:** tiktoken-style tokenization (cl100k_base)

### retry count
| 정의 | 설명 |
|------|------|
| **initial attempt** | 첫 코드 생성 시도 |
| **retry** | validation 실패 시 재시도 |
| **max retry** | 2회 (총 3회 시도 가능) |

**측정 방법:** 실행 로그에서 재시도 횟수 카운트

### latency
| 정의 | 설명 |
|------|------|
| **start** | API 요청 전송 시점 |
| **end** | 코드 수신 완료 시점 |
| **completion latency** | end - start (ms) |

**측정 방법:** `Date.now()` delta

---

## 3. Logging Format

### JSON Schema
```json
{
  "runId": "uuid",
  "timestamp": "ISO8601",
  "taskId": "R4",
  "taskName": "Feature Module Split",
  "target": {
    "repo": "shadcn-ui",
    "file": "combobox-example.tsx"
  },
  "approach": "vanilla|fooks",
  "input": {
    "rawBytes": 39209,
    "inputTokens": 11202,
    "extractionUsed": false
  },
  "output": {
    "outputTokens": 8934,
    "filesGenerated": 8,
    "success": true,
    "validation": {
      "functionality": true,
      "fileSize": true,
      "typeErrors": 0,
      "circularImports": 0,
      "barrelExport": true
    }
  },
  "metrics": {
    "retryCount": 0,
    "completionLatencyMs": 25300,
    "totalTokens": 20136
  },
  "comparison": {
    "tokenSavingsRatio": 0.949,
    "latencyImprovementMs": 20200,
    "retryReduction": 2
  }
}
```

### 필수 필드
| 필드명 | 타입 | 필수 |
|--------|------|------|
| runId | string | O |
| timestamp | ISO8601 | O |
| taskId | string | O |
| approach | "vanilla"\|"fooks" | O |
| input.inputTokens | number | O |
| output.success | boolean | O |
| metrics.retryCount | number | O |
| metrics.completionLatencyMs | number | O |

---

## 4. Comparison Rule

### 비교 기준
| 지표 | 계산 방법 |
|------|-----------|
| **token savings** | (vanilla_input - fooks_input) / vanilla_input |
| **latency improvement** | vanilla_latency - fooks_latency |
| **retry reduction** | vanilla_retry - fooks_retry |
| **success rate diff** | fooks_success_rate - vanilla_success_rate |

### 판정 기준
| 결과 | 조건 |
|------|------|
| **improvement** | fooks가 모든 지표에서 vanilla보다 우수 |
| **regression** | fooks가 1개 이상 지표에서 vanilla보다 열등 |
| **inconclusive** | 지표 간 방향이 일관되지 않음 |

### 개선 기준 예시
```
token savings ≥ 80%
latency improvement ≥ 30%
retry reduction ≥ 1
success rate diff ≥ 0
```

---

## 상태

**Layer 2 metric schema hardened**
- run pair 정의: 고정
- metric 정의: 고정
- logging format: 고정
- comparison rule: 고정

**Spec trio complete**
1. ✅ R4-runner-spec.md (입력/출력/성공 기준)
2. ✅ R4-validation-checklist.md (검증 방법)
3. ✅ R4-metric-schema.md (측정/로깅/비교)

**Current benchmark boundary**
- Runner/API path는 current `codex exec` proposal-only smoke로 확인됨
- 2회 matched proposal-only smoke + validation artifact 존재
- provider billing-token telemetry와 applied-code acceptance benchmark는 아직 없음

**Next:** stable claim 전 applied-code validation 또는 multi-task evidence 수집
