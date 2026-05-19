# Runtime token-cost research and fooks adoption map

Date: 2026-05-19
Scope: Preserve the full research synthesis, external evidence, and implementation handoff context for sequential fooks work. This document is intentionally more detailed than a roadmap summary so future tasks can reference the same reasoning without rediscovery.

## 결론부터

조사 결과, **“프론트엔드 런타임 특화로 토큰 비용을 줄였다”는 공개적·검증된 대형 사례는 아직 많지 않음**. 대신 시장은 크게 5가지 문제를 풀고 있음:

1. **같은 컨텍스트를 매번 다시 보내는 낭비**
2. **에이전트가 같은 파일을 반복해서 읽는 낭비**
3. **큰 코드베이스에서 관련 없는 파일까지 컨텍스트에 들어가는 문제**
4. **프롬프트/툴/룰/메모리 구조가 provider prompt cache를 깨는 문제**
5. **실제 토큰 비용을 측정하지 못해서 “절감했다”는 주장을 증명 못 하는 문제**

우리 fooks는 이 중에서 **2번, 3번 일부, 4번 일부를 React Web same-file runtime path로 꽤 잘 잡고 있음**. 하지만 아직 **비용 절감 제품이라고 강하게 말하려면 실측 토큰/캐시/반복-read/latency 증거 층이 부족함**.

fooks가 이 시장에서 이길 수 있는 포인트는 “범용 token compressor”가 아니라 **프론트엔드 도메인을 이해하는 runtime context policy layer**라는 점이다. 즉, 그냥 코드를 줄이는 게 아니라:

```text
무엇을 줄여도 되는지
무엇은 반드시 full read 해야 하는지
어떤 도메인 claim은 하면 안 되는지
어떤 source fingerprint에서만 유효한지
```

를 아는 쪽으로 가야 함.

---

# 1. 외부에서 확인한 주요 흐름

## A. Provider prompt caching이 2026년 기준 핵심 비용절감 수단

### OpenAI

OpenAI 공식 문서 기준, prompt caching은 자동 적용되고, 반복되는 긴 prefix가 있으면 latency와 input token cost를 줄일 수 있음. 문서상 **최대 latency 80%, input token cost 90% 절감**을 언급하고, static content를 prompt 앞쪽에 두고 dynamic content를 뒤쪽에 두라고 안내함.

- 출처: OpenAI Prompt Caching docs
  https://developers.openai.com/api/docs/guides/prompt-caching

핵심:

```text
static instructions / tool definitions / stable context
→ 앞쪽

user-specific prompt / current diff / volatile tool result
→ 뒤쪽
```

우리에게 의미:

- fooks runtime context는 **stable prefix 친화적으로 재구성**해야 함.
- 지금처럼 source fingerprint, file path, domain payload를 매번 조금씩 다르게 만들면 cache hit 가능성이 떨어질 수 있음.
- `additionalContext` 구조를 cache-aware하게 설계할 필요가 있음.

---

### Anthropic / Claude

Anthropic은 prompt caching에서 cache breakpoint, TTL, cache read/write 가격 구조를 명시함. 공식 문서 기준 cache read token은 base input token의 0.1배 가격이고, agentic tool use / iterative code changes에 prompt caching이 유용하다고 함.

- 출처: Anthropic Prompt Caching docs
  https://platform.claude.com/docs/en/build-with-claude/prompt-caching

중요한 점:

- 캐시는 prefix 기반.
- `tools → system → messages` 순서의 prefix가 중요.
- static content는 앞에, dynamic content는 뒤에 둬야 함.
- cache를 잘못 설계하면 hit가 안 나거나 cache write 비용만 늘 수 있음.

우리에게 의미:

- Claude adapter 쪽에서 **cache-control friendly handoff**를 설계할 수 있음.
- 단, Claude Read interception은 현재 fooks의 claim 밖이므로, “Claude token saving”이라고 바로 주장하면 안 됨.
- Claude 쪽은 “bounded context hook + cache-aware prompt layout” 정도가 안전한 다음 단계.

---

### Gemini

Gemini API는 implicit caching과 explicit caching을 제공함. 공식 문서 기준 Gemini 2.5+ 모델은 implicit caching이 기본 활성화이고, explicit caching은 비용 절감 보장을 위해 개발자가 직접 설정할 수 있음.

- 출처: Google Gemini Context Caching docs
  https://ai.google.dev/gemini-api/docs/caching

우리에게 의미:

- provider별 캐싱 방식이 다르므로, fooks가 장기적으로는 **runtime/provider cache capability matrix**를 가져야 함.
- Codex, Claude, Gemini, opencode마다 “어떤 컨텍스트 배치가 비용에 유리한지”가 다름.

---

## B. Aider: repo map + token budget이 좋은 참고 사례

Aider는 전체 repo를 graph ranking으로 요약하고, active token budget 안에 들어갈 만큼 중요한 repo map만 보냄. 기본 `--map-tokens`는 1k이고, 상황에 따라 동적으로 repo map 크기를 조절함.

- 출처: Aider Repository Map docs
  https://aider.chat/docs/repomap.html

Aider가 푸는 문제:

```text
큰 코드베이스 전체를 다 읽을 수 없음
→ symbol/dependency graph를 만든다
→ 현재 task에 중요한 부분만 token budget 안에 넣는다
```

우리에게 도입하면 좋은 것:

- 현재 fooks는 **explicit file / same-file React Web**에 강함.
- 하지만 ambiguous prompt나 multi-file frontend task에는 약함.
- Aider식으로 **React component graph / import graph / form flow graph / route graph**를 만들면 좋음.

예:

```text
Form.tsx 수정 요청
→ Form.tsx
→ useForm hook
→ validation schema
→ Button component
→ Label/Input primitive
→ route/page owner
```

이런 식으로 “프론트엔드 전용 repo map”을 만들면 fooks 차별화가 커짐.

---

## C. Repomix: token count tree + code compression + secret check

Repomix는 repo를 AI-friendly 파일로 포장하고, token count, include/exclude, gitignore, secret check, Tree-sitter 기반 code compression을 제공함.

- 출처: Repomix README
  https://github.com/yamadashy/repomix/blob/main/README.md

좋은 점:

- 파일별 token count
- 전체 repo token count
- Tree-sitter로 function/class signature 중심 압축
- `.gitignore` / ignore rule 존중
- Secretlint 기반 민감정보 체크

우리에게 도입하면 좋은 것:

1. `fooks status tokens`
2. `fooks compare --token-tree`
3. `fooks inspect budget <file|folder>`
4. context packet에 들어간 항목별 token estimate
5. secret/sensitive file guard

현재 fooks는 payload estimate는 있지만, 사용자가 “뭐 때문에 토큰이 줄었는지/늘었는지”를 직관적으로 보는 token tree UX가 약함.

---

## D. Continue / Cursor / Cody 계열: codebase indexing + retrieval + rerank

Continue 문서상 기존 `@Codebase`는 embeddings + keyword search로 관련 파일을 가져오고, `nRetrieve → rerank → nFinal` 구조를 사용함.

- 출처: Continue docs
  https://docs.continue.dev/reference/deprecated-codebase

Cursor/Cody류도 핵심은 비슷함:

```text
codebase indexing
→ relevant snippets retrieval
→ rerank
→ model context로 전달
```

우리에게 의미:

- fooks는 “React Web source facts”에는 강하지만, **codebase-wide retrieval**은 아직 약함.
- 단순 vector RAG만 붙이면 오히려 context pollution이 생길 수 있음.
- fooks답게 하려면 일반 RAG가 아니라:

```text
domain-aware retrieval
+ concern-aware rerank
+ source fingerprint
+ fallback boundary
```

가 되어야 함.

예:

```text
"Form validation copy 바꿔줘"
→ validation-schema concern 우선
→ form-state concern 우선
→ styling concern은 낮게
→ unrelated Button stories/test는 후순위
```

---

## E. Claude Code 공식 cost guidance: context 관리, model 선택, hook/skill offload

Claude Code 공식 문서는 토큰 비용이 context size에 비례하고, prompt caching / auto-compaction / hooks / skills / model selection / typed language code intelligence plugin 등을 비용관리 수단으로 언급함.

- 출처: Claude Code cost docs
  https://code.claude.com/docs/en/costs

우리에게 의미:

- fooks의 방향은 맞음.
- 특히 “model에게 다 생각시키지 말고 deterministic hook/skill에서 처리”하는 방향이 우리 구조와 잘 맞음.
- 지금 fooks의 AST extraction, policy gate, report surface는 이 방향의 좋은 구현임.

---

## F. Agentic coding token-cost 연구에서 확인한 리스크

2026년 agentic coding token-cost 연구는 agentic coding task가 input-token 중심으로 매우 비싸고, 같은 task라도 token usage 편차가 크며, 더 많은 token 사용이 더 좋은 정확도로 곧장 이어지지 않는다고 보고함.

- 출처: How Do AI Agents Spend Your Money?
  https://arxiv.org/abs/2604.22750

우리에게 의미:

- “더 많은 컨텍스트 = 더 좋은 결과”가 아님.
- fooks는 context 양 자체보다 **정확한 source-grounded selection**을 강조해야 함.
- 비용 증거도 단순 평균 하나보다 task, runtime, fallback, cache hit, retry 편차를 같이 남기는 쪽이 안전함.

---

## G. Long-horizon prompt caching 연구에서 확인한 리스크

Prompt caching for long-horizon agents 연구는 naive full-context caching이 오히려 latency를 늘릴 수 있고, dynamic content를 뒤로 보내고 tool result 같은 변동 블록을 cache prefix에서 제외하는 전략이 더 안정적이라고 설명함.

- 출처: Don’t Break the Cache
  https://arxiv.org/abs/2601.06007

우리에게 의미:

- fooks는 “캐시하면 다 좋다”가 아니라, **cache-aware packet layout**을 가져야 함.
- runtime debug, tool result, current prompt, volatile metrics는 prefix에 두면 안 됨.
- 안정적인 schema/policy/instructions와 변동 source facts를 분리해야 함.

---

# 2. 우리 fooks가 이미 잘하고 있는 부분

## 1) Runtime path first 전략이 좋음

README/코드 기준 fooks는 CLI 리포트보다 **Codex runtime hook path**를 제품 중심으로 둠.

이건 시장 방향과 맞음. 요즘 비용 문제는 “리포트 한 번 만들기”보다:

```text
agent session 중 매 turn 반복되는 read/context 비용
```

이 더 큼.

우리의 `src/adapters/codex-runtime-hook.ts`, `src/adapters/codex-native-hook.ts` 구조는 여기에 잘 맞음.

---

## 2) Source fingerprint / freshness gate가 좋음

fooks는 compact payload를 줄 때 source fingerprint, line count, file hash 등을 확인하는 구조를 갖고 있음.

이건 중요함. 단순 token compression 도구들은 자칫 stale context를 모델에게 줄 수 있음. fooks는 “줄여도 되는가?”를 먼저 판단한다는 점이 강점.

---

## 3) Domain / concern / payload policy 분리가 좋음

현재 구조:

```text
domain-detector
domain-profiles
concern-profiles
payload-policy
model-facing payload
```

이 분리는 매우 좋음.

특히 React Web, RN, WebView, TUI, Mixed, Unknown을 분리하고, concern profile이 payload permission을 직접 갖지 않게 한 점은 잘한 설계임.

시장에 흔한 실수는:

```text
React Native import 봄
→ RN 지원한다고 말함
```

인데, fooks는 이걸 claim boundary로 막고 있음.

---

## 4) React Web wedge가 명확함

현재 가장 강한 path:

```text
React Web .tsx/.jsx
+ repeated same-file
+ Codex runtime hook
+ compact source-grounded payload
```

이건 좁지만 제품화하기 좋음. “범용 AI context optimizer”보다 신뢰성이 높음.

---

## 5) Reporting / evidence / claim boundary가 강함

`src/reporting/*`, `docs/architecture-boundaries.md`, `docs/domain-payload-architecture.md` 쪽을 보면 fooks는 “무엇을 주장할 수 있고 없는지”를 꽤 잘 관리하고 있음.

이건 토큰 절감 시장에서 특히 중요함. 요즘 “75x 절감”, “90% 절감” 같은 주장이 많은데, 대부분 실제 provider billing proof와 다름.

fooks는 이 부분을 조심하는 게 장기적으로 신뢰도에 좋음.

---

# 3. 현재 아쉬운 부분 / 부족한 부분

## 1) 비용 절감 claim을 뒷받침할 실제 telemetry가 약함

현재 fooks는 context reduction estimate, payload size, session metric 일부가 있지만, “실제 비용 절감”을 강하게 말하기엔 부족함.

필요한 증거:

```text
before raw source tokens
after fooks payload tokens
provider reported input tokens
provider cached tokens
cache write/read tokens
output tokens
latency / TTFT
same task retry count
same file reread count
```

특히 provider cache 쪽은:

- OpenAI: `cached_tokens`
- Anthropic: cache creation/read usage fields
- Gemini: `usage_metadata`의 cache hit 관련 값

을 가능한 런타임별로 수집해야 함.

지금은 “local estimate” 중심이라서, README의 cautious wording은 맞지만 제품 메시지로는 약함.

---

## 2) Same-file에는 강하지만 multi-file frontend task에는 약함

현재 fooks의 최강 path는 repeated same-file임.

하지만 실제 프론트엔드 작업은 자주 이렇게 생김:

```text
page.tsx
Form.tsx
Input.tsx
schema.ts
api hook
test file
storybook
```

현재 구조는 이 multi-file graph를 자동으로 잘 구성한다고 보긴 어려움.

도입 후보:

- Aider식 repo map
- frontend component dependency graph
- route/page/component graph
- form/schema/state graph
- test/story colocated graph

---

## 3) Ambiguous prompt 처리에서 retrieval/rerank가 약함

예:

```text
"로그인 폼 에러 메시지 UX 개선해줘"
```

이 경우 명시 파일이 없으면 fooks가 어디를 봐야 할지 약해짐.

Continue/Cursor류는 indexing/retrieval로 풀고, Aider는 repo map으로 풀음. fooks는 여기에 **frontend-domain-aware retrieval**을 붙이면 좋음.

단, 일반 vector RAG를 그대로 붙이면 안 됨. 우리식으로는:

```text
1차: prompt target / filename / route keyword
2차: import graph
3차: domain profile
4차: concern profile
5차: token budget rerank
6차: fallback if uncertain
```

이 좋아 보임.

---

## 4) Prompt cache-aware packet layout이 아직 제품 feature로 명확하지 않음

OpenAI/Anthropic/Gemini 모두 공통적으로 말하는 게:

```text
반복되는 static prefix를 앞에 둬라
변하는 내용은 뒤에 둬라
```

현재 fooks runtime payload는 compact하긴 하지만, provider prompt cache 관점에서 “stable prefix를 최대화한다”는 명시 설계가 약함.

개선 방향:

```text
stable block:
  fooks policy version
  domain schema
  fixed instructions
  static do-not-do
  stable file identity

semi-stable block:
  source fingerprint
  domain profile
  concern profile

dynamic block:
  user prompt
  current line ranges
  latest findings
  runtime debug
```

그리고 runtime adapter별로 cache-friendly ordering을 다르게 할 수 있음.

---

## 5) Token budget UX가 부족함

Repomix처럼 사용자가 바로 볼 수 있는 게 필요함.

예:

```bash
fooks status tokens
fooks compare src/Form.tsx --token-tree
fooks inspect budget src/components
fooks status session --cost
```

출력 예:

```text
Raw source: 18,420 tokens
Fooks payload: 2,140 tokens
Reduction estimate: 88.4%

Top omitted:
- JSX repeated markup: 8,200
- style classes: 2,900
- comments: 1,100

Top retained:
- form controls: 420
- validation anchors: 310
- event handlers: 280
- source ranges: 220
```

이게 있어야 “절감”이 사용자에게 체감됨.

---

## 6) Secret / sensitive context guard가 약해 보임

Repomix는 Secretlint 기반 security check를 전면 기능으로 둠.

fooks도 runtime에 컨텍스트를 주입하는 도구이므로, 다음이 필요함:

- `.env`, key, token, secret pattern exclusion
- large generated file exclusion
- `.fooksignore`
- provider별 external-send boundary
- “이 payload에는 secret-like content 없음” receipt

현재 safe project path guard는 있지만, 비용절감 제품으로 커지려면 context security UX가 더 필요함.

---

## 7) “Read-once / reread dedup”이 아직 명확한 기능은 아님

요즘 Claude Code hook 커뮤니티에서 많이 나오는 문제는:

```text
에이전트가 같은 파일을 계속 다시 읽음
```

fooks는 repeated same-file payload를 주지만, 좀 더 직접적으로:

```text
이 세션에서 이미 읽은 파일
현재 fingerprint
마지막 payload
마지막 full-read 이유
다시 읽어야 하는 조건
```

을 관리하는 **runtime read ledger**가 있으면 좋음.

다만 조심해야 함:

- 파일이 바뀌었으면 반드시 재읽기
- 모델이 세부 구현을 수정해야 하면 raw source 필요
- AST summary만으로 write하면 위험

---

# 4. 우리에게 도입해도 괜찮은 것들

## Priority 1: 비용/토큰 evidence layer

가장 먼저 해야 할 것.

추가할 것:

```text
fooks session cost artifact
- raw source estimated tokens
- payload estimated tokens
- runtime additionalContext bytes/tokens
- provider usage if available
- cached tokens if available
- cache hit ratio if available
- repeated file read count
- fallback count
```

명령:

```bash
fooks status cost
fooks status tokens
fooks inspect evidence <session>
```

제품 메시지:

```text
"provider billing proof"가 아니라
"local source/context reduction evidence + provider usage where available"
```

이렇게 claim boundary 유지.

---

## Priority 2: Cache-aware runtime packet format

OpenAI/Anthropic/Gemini 공통 best practice를 반영해서 runtime payload를 재배치.

목표:

```text
static prefix 최대화
dynamic suffix 최소화
debug/noisy data 분리
tool result는 cache prefix에 넣지 않기
```

특히 `src/adapters/codex-runtime-hook.ts`의 `renderAdditionalContext` / optimized React Web payload 경로를 손보면 좋음.

---

## Priority 3: React Web component graph / repo map

Aider repo map의 fooks 버전.

일반 repo map이 아니라:

```text
React Web component graph
- imports
- exported components
- props types
- form controls
- validation schema anchors
- route/page ownership
- colocated test/story files
```

이렇게 만들면 fooks만의 차별점이 생김.

명령 후보:

```bash
fooks inspect graph src/components/Form.tsx
fooks status react-web graph
```

---

## Priority 4: Domain-aware retrieval/rerank

Continue식 `nRetrieve → rerank → nFinal`을 그대로 가져오되, 기준은 fooks식으로.

랭킹 요소:

```text
explicit path match
import graph distance
domain match
concern match
source freshness
file size/token cost
test/story relevance
fallback risk
```

---

## Priority 5: Token budget tree

Repomix에서 배울 부분.

명령 후보:

```bash
fooks compare <file> --token-tree
fooks inspect folder <dir> --token-budget
```

이건 마케팅에도 좋고, 실제 디버깅에도 좋음.

---

## Priority 6: Security/sensitive file guard

Context 주입 도구라면 필수.

도입 후보:

```text
.fooksignore
secret pattern scan
large/generated file exclusion
payload secret receipt
```

---

# 5. 도입하면 위험하거나 아직 보류해야 할 것

## 1) Semantic response cache

Bifrost/GPTCache류 semantic caching은 일반 Q&A에는 좋을 수 있지만, 코드 수정 런타임에는 위험함.

이유:

```text
비슷한 질문 ≠ 같은 코드 상태
비슷한 Form.tsx ≠ 같은 source fingerprint
비슷한 답변 재사용 → stale/incorrect patch 위험
```

fooks에 쓴다면 response cache가 아니라:

```text
source fingerprint 기반 payload cache
```

까지만 안전함.

---

## 2) 전체 repo packing을 runtime 기본값으로 쓰기

Repomix식 전체 repo packing은 architecture review나 one-shot 분석에는 좋지만, runtime 반복 작업 기본값으로 쓰면 context pollution 위험이 큼.

fooks 기본 방향은 계속:

```text
targeted source facts
+ policy gate
+ fallback
```

이어야 함.

---

## 3) “75x 절감”류 마케팅

요즘 token optimizer 시장에 과장 claim이 많음. fooks는 이미 claim boundary 문화가 있으니, 이걸 버리면 안 됨.

권장 wording:

```text
"reduces repeated rediscovery"
"emits compact source-grounded context"
"shows local source-vs-payload token evidence"
"provider billing savings require provider usage evidence"
```

비권장 wording:

```text
"cuts your AI bill by 90%"
"guaranteed token savings"
"works for all frontend projects"
```

---

# 6. fooks의 포지셔닝 제안

## 지금 포지션

```text
Frontend source-grounded runtime context layer
```

## 더 강한 포지션

```text
React Web runtime context optimizer with evidence-backed token budget control
```

또는 한국어로:

```text
프론트엔드 코딩 에이전트가 같은 React Web 소스를 반복 재탐색하지 않도록,
현재 소스 근거 기반의 compact context와 비용/토큰 증거를 제공하는 로컬 런타임 레이어
```

---

# 7. 추천 로드맵

## 1단계: “절감 주장”보다 “측정” 먼저

- `fooks status tokens`
- provider usage 수집 가능성 조사
- cached token / input token / output token receipt
- before/after payload evidence

## 2단계: cache-aware context packet

- stable prefix / dynamic suffix 분리
- noisy debug는 별도 artifact로 빼기
- provider별 prompt cache compatibility 문서화

## 3단계: React Web graph

- component/import graph
- form/schema/state/routing concern graph
- colocated tests/stories 연결

## 4단계: ambiguous prompt retrieval

- domain-aware retrieval
- concern-aware rerank
- token budget cap
- fallback-required 상태 명확화

## 5단계: 보안/ignore/secret guard

- `.fooksignore`
- generated/large file policy
- secret-like payload blocker

---

# 8. 최종 평가

## 잘한 부분

- Runtime-first 구조
- Codex repeated same-file wedge
- source fingerprint/freshness gate
- domain / concern / policy 분리
- claim boundary 문화
- React Web에 좁고 강한 집중
- report/evidence surface 존재

## 아쉬운 부분

- 실제 토큰/비용 telemetry 부족
- provider cache hit 증거 부족
- multi-file frontend graph 부족
- ambiguous prompt retrieval 부족
- token budget UX 부족
- secret/context security surface 부족
- Claude/opencode 쪽은 아직 “절감”이라고 말하기 어려움

## 들고 가야 하는 핵심

fooks가 이 시장에서 이길 수 있는 포인트는 “범용 token compressor”가 아니라:

```text
프론트엔드 도메인을 이해하는 runtime context policy layer
```

라는 점이야.

즉, 그냥 코드를 줄이는 게 아니라:

```text
무엇을 줄여도 되는지
무엇은 반드시 full read 해야 하는지
어떤 도메인 claim은 하면 안 되는지
어떤 source fingerprint에서만 유효한지
```

를 아는 쪽으로 가야 함.

---

# 9. Implementation handoff checklist

Before each task that touches runtime context, token/cost evidence, prompt caching, retrieval, graph selection, or sensitive-context handling, check:

1. Which roadmap priority does this touch?
2. Which claim boundary must stay unchanged?
3. Which source/evidence artifact proves the change?
4. Does it alter runtime behavior, setup eligibility, detector behavior, or public support wording?
5. If yes, add tests before widening docs.

Keep future implementation work tied to these boundaries:

- local estimates are not authoritative provider billing proof;
- graph/retrieval evidence does not automatically authorize compact reuse;
- concern profiles do not promote domains;
- semantic response caching is unsafe for code-edit decisions unless source fingerprint and policy gates are explicit;
- Claude/opencode parity should not be claimed without runtime-specific evidence.
