# R4 Feature Module Split - Runner Implementation Plan

> 실제 benchmark 실행을 위한 runner 구현 계획

---

## 현재 정확한 상태

| 항목 | 상태 |
|------|------|
| **API key** | ✅ available |
| **Codex environment** | ✅ ready |
| **Primary blocker** | ⚠️ **runner implementation** |
| **Runner subtasks** | validation hook wiring, metric pipeline logging |

**정확한 표현:** "API key/Codex ready, runner implementation pending"

---

## 1. Runner Entrypoint

### 파일
`benchmarks/layer2-frontend-task/runner.js` (Node.js)

### 인터페이스
```bash
node runner.js \
  --mode=vanilla|fooks \
  --target=<file-path> \
  --output=<result-json-path>
```

### 기본 흐름
```javascript
// 1. 입력 파싱
const mode = process.argv[2]; // vanilla or fooks
const targetFile = process.argv[3]; // combobox-example.tsx
const outputPath = process.argv[4]; // results/R4-vanilla-run-1.json

// 2. 컨텍스트 준비
const context = mode === 'fooks' 
  ? fooks.extractFile(targetFile)  // 2,011 bytes
  : fs.readFileSync(targetFile, 'utf-8'); // 39,209 bytes

// 3. Codex 실행
const result = await runCodex(context, taskPrompt);

// 4. 결과 검증
const validation = runValidation(result.outputFiles);

// 5. 메트릭 수집
const metrics = collectMetrics(result);

// 6. 저장
fs.writeFileSync(outputPath, JSON.stringify({result, validation, metrics}, null, 2));
```

---

## 2. Codex 실행 Wrapper

### 목적
Codex CLI를 프로그래밍 방식으로 호출하고, stdout/stderr 캡처

### 구현
```javascript
const { spawn } = require('child_process');

async function runCodex(context, prompt) {
  const startTime = Date.now();
  
  // Codex CLI 호출
  const codex = spawn('codex', [
    '--model', process.env.OPENAI_MODEL || 'gpt-5.4',
    '--temperature', '0.1',
    '--prompt', buildPrompt(context, prompt)
  ]);
  
  // stdout/stderr 캡처
  let output = '';
  let error = '';
  
  codex.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  codex.stderr.on('data', (data) => {
    error += data.toString();
  });
  
  // 완료 대기
  const exitCode = await new Promise((resolve) => {
    codex.on('close', resolve);
  });
  
  const endTime = Date.now();
  
  return {
    exitCode,
    output,
    error,
    latencyMs: endTime - startTime,
    timestamp: new Date().toISOString()
  };
}
```

---

## 3. Metric 수집 Hook

### 수집 대상 6개
| # | Metric | 수집 방법 | 저장 필드 |
|---|--------|-----------|-----------|
| 1 | **success/fail** | validation 결과 | `output.success` |
| 2 | **token usage** | tiktoken 계산 | `metrics.inputTokens`, `metrics.outputTokens` |
| 3 | **retry count** | 재시도 카운트 | `metrics.retryCount` |
| 4 | **latency** | Date.now() delta | `metrics.completionLatencyMs` |
| 5 | **edit precision** | validation 기준 충족률 | `output.validation.score` |
| 6 | **operational overhead** | 수동 메모 | `notes.operationalOverhead` |

### 구현
```javascript
function collectMetrics(codexResult, validationResult) {
  const inputTokens = countTokens(codexResult.input);
  const outputTokens = countTokens(codexResult.output);
  
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    retryCount: codexResult.retryCount || 0,
    completionLatencyMs: codexResult.latencyMs,
    timestamp: codexResult.timestamp
  };
}

function countTokens(text) {
  // tiktoken cl100k_base 사용
  const tiktoken = require('tiktoken');
  const encoder = tiktoken.get_encoding('cl100k_base');
  return encoder.encode(text).length;
}
```

---

## 4. Validation 연결

### 연결 대상
R4-validation-checklist.md의 6개 기준

### 자동화 가능 항목
| 기준 | 자동화 방법 | 예상 소요 |
|------|------------|-----------|
| **타입 에러 0** | `npx tsc --noEmit` | 10초 |
| **순환 의존성 0** | `npx madge --circular` | 5초 |
| **파일 크기** | `wc -l` | 1초 |
| **빌드 통과** | `npm run build` | 30초-2분 |

### 수동/반자동 항목
| 기준 | 방법 | 비고 |
|------|------|------|
| **기능 유지** | 테스트 실행 | shadcn-ui에 테스트 있어야 함 |
| **barrel export** | lint rule | `import/no-cycle` 활용 |

### 연결 로직
```javascript
function runValidation(outputDir) {
  const results = {
    typeErrors: runTSC(outputDir),
    circularImports: runMadge(outputDir),
    fileSizes: checkFileSizes(outputDir),
    buildPass: runBuild(outputDir),
    // 기능 유지는 테스트 필요
    functionality: 'requires-test-suite'
  };
  
  const allPass = Object.values(results).every(r => 
    r === 0 || r === true || r === 'requires-test-suite'
  );
  
  return {
    success: allPass,
    details: results,
    score: calculatePrecision(results)
  };
}
```

---

## 5. 실행 시퀀스

### Phase 1: Vanilla Run
```bash
# 1. 준비
mkdir -p benchmarks/layer2-frontend-task/results

# 2. 실행
node runner.js \
  --mode=vanilla \
  --target=../../fooks-test-repos/ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=results/R4-vanilla-run-1.json

# 3. 예상 소요: 30초 - 5분 (Codex 생성 시간)
```

### Phase 2: Fooks Run
```bash
# 1. 실행
node runner.js \
  --mode=fooks \
  --target=../../fooks-test-repos/ui/apps/v4/registry/bases/radix/examples/combobox-example.tsx \
  --output=results/R4-fooks-run-1.json

# 2. 예상 소요: 20초 - 3분 (컨텍스트 작아서 더 빠름)
```

### Phase 3: Comparison
```bash
# 결과 비교
node compare.js \
  --vanilla=results/R4-vanilla-run-1.json \
  --fooks=results/R4-fooks-run-1.json \
  --output=results/R4-comparison.json
```

---

## 구현 우선순위

| 순서 | 항목 | 예상 시간 | 블로커 여부 |
|------|------|-----------|------------|
| 1 | runner entrypoint (인자 파싱) | 30분 | 아님 |
| 2 | Codex wrapper (stdout 캡처) | 1시간 | 아님 |
| 3 | Metric 수집 (token/latency) | 1시간 | 아님 |
| 4 | Validation 연결 (tsc/madge) | 2시간 | 아님 |
| 5 | 결과 저장 (JSON 포맷) | 30분 | 아님 |
| 6 | Vanilla vs Fooks 비교 스크립트 | 1시간 | 아님 |

**총 예상: 6시간** (1인 개발 기준)

---

## 다음 액션

**에르가재 본인이 직접:**
1. `runner.js` entrypoint 생성
2. Codex wrapper 구현
3. Metric 수집 hook 추가
4. Validation 연결
5. **실제 R4 benchmark 실행**

**clawhip 사용:**
- runner 개발 중 stale 감시
- 완료 시 알림

---

*Implementation Plan: 에르가재*
*Date: 2026-04-15*
*Blocker: runner implementation (API/Codex는 ready)*
*ETA: 6시간 개발 후 첫 real benchmark 가능*
