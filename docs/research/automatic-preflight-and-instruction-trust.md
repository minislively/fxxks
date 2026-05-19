# Automatic preflight and instruction trust design research

Date: 2026-05-19  
Status: research/design note for issue #966  
Depends on: #961 `contextTrust` / `sourceOfTruth` packet  
Non-goals: no hook implementation, no blocking policy implementation, no #962 stale detector, no #963 handoff generator

## 결론부터

`contextTrust`를 수동 `fooks check --json` 필드로만 남겨두면 제품 가치가 약하다. 사용자가 매번 명령어를 치는 방식이 아니라, agent가 실제 작업을 시작하거나 파일/PR/git side effect를 실행하기 전에 자동으로 현재 작업 근거를 확인해야 한다.

다만 자동화를 **프롬프트 키워드 목록**으로 시작하면 장기적으로 깨진다.

```text
"구현해줘", "수정해줘", "디버깅", "리팩토링", "PR", "테스트", "계속"
```

같은 단어는 보조 신호로는 쓸 수 있지만, 메인 trigger가 되면 false positive/false negative가 많다. 더 안전한 설계는:

```text
사용자 말 기준 ❌
agent lifecycle / tool action 기준 ✅
```

이다.

추천 구조:

```text
SessionStart / UserPromptSubmit
→ silent/advisory context injection

PreToolUse for write/git/gh/apply_patch
→ action-based risk gate

PostToolUse / Stop / compaction
→ state refresh and durable handoff
```

또한 `contextTrust`는 repo/work state trust를 다루는 레이어이지, 사용자의 최신 정정이나 선호를 보존하는 레이어는 아니다. `minseol2`가 아니라 `minislively`로 진행해야 한다는 식의 텍스트 상황 맥락은 별도의 `instructionTrust` 개념이 필요하다.

장기 preflight packet은 다음 3개를 합쳐야 한다.

```text
preflight packet = stateTrust + instructionTrust + actionRisk
```

---

## 1. 문제 정의

### 1.1 수동 check는 효율적이지 않다

#961은 `fooks check --json`에 `contextTrust`를 추가했다. 이로써 operator-check가 이미 계산한 evidence를 다음 buckets로 분리할 수 있다.

- `sourceOfTruth.current`: 현재 작업 근거로 볼 수 있는 top-level active artifact
- `advisoryOnly`: 참고/가이드일 뿐인 정보
- `historicalOnly`: 과거 receipt
- `nonAuthorizing`: 현재 작업 근거로 쓰면 안 되는 caveat

하지만 이 값이 수동 명령어로만 확인된다면 agent가 실제로 실수하는 순간을 막지 못한다.

예:

```text
사용자: 계속 진행해줘
agent: 현재 repo owner/branch/PR 상태를 잘못 가정
agent: 잘못된 remote로 push/PR 생성
```

이 경우 중요한 것은 사용자가 `fooks check --json`을 기억해서 실행하는 것이 아니라, agent가 push/PR/create/edit 같은 행동을 하기 전에 자동으로 현재 authority를 확인하는 것이다.

### 1.2 prompt keyword trigger는 약하다

키워드 trigger는 쉬워 보이지만 다음 문제가 있다.

False negative:

```text
"아까 거 마저"
"저 부분 ㄱㄱ"
"이상한데 봐줘"
"continue"
"ㅇㅋ 진행"
```

False positive:

```text
"리팩토링이 뭔지 설명해줘"
"PR 전략을 알려줘"
"디버깅 방법론을 정리해줘"
```

또한 fooks 사용자는 한국어/영어/오타/축약어를 섞어 쓰기 때문에 키워드 테이블은 계속 커지고, hook 로직은 점점 불투명해진다.

따라서 prompt keyword matching은 **fallback-only**로 두고, 주된 판단은 action-based trigger로 옮겨야 한다.

---

## 2. 외부 reference patterns

### 2.1 Claude Code hooks: lifecycle + tool action 분리

Claude Code hooks는 `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `PreCompact` 등 lifecycle 시점에 명령을 실행할 수 있게 한다. 특히 `UserPromptSubmit`은 모델이 프롬프트를 처리하기 전 additional context를 추가할 수 있고, `PreToolUse`는 tool 실행 전 allow/deny/ask 계열 guard를 만들 수 있다.

Reference: https://code.claude.com/docs/en/hooks

fooks에 주는 의미:

```text
SessionStart/UserPromptSubmit
→ 현재 branch/issue/PR/session/source-of-truth context를 조용히 주입

PreToolUse
→ 실제 write/git/gh/apply_patch 직전 risk 판단

PostToolUse/Stop
→ 실행 결과를 기반으로 다음 preflight evidence 갱신
```

중요한 점은 “사용자가 어떤 단어를 썼는가”보다 “agent가 어떤 tool/action을 실행하려는가”가 더 안정적인 trigger라는 것이다.

### 2.2 Claude hook community patterns: WIP visibility / repeated read guard

Claude Code hook 커뮤니티에는 매 prompt마다 WIP/git 상태를 additional context로 알려주는 hook이나, 같은 파일을 반복해서 읽는 것을 추적하는 hook 사례가 있다.

References:

- WIP visibility hook discussion: https://www.reddit.com/r/ClaudeAI/comments/1roqns3/i_built_a_Claude_Code_hook_that_nudges_about_accumulating_WIP/
- repeated read guard discussion: https://www.reddit.com/r/ClaudeAI/comments/1rnjf5e/i_built_a_Claude_Code_hook_that_stops_it_from_re-reading_files_it_already_has_in_context/

fooks에 주는 의미:

- 반복적으로 사용자가 상태 명령을 입력하게 하지 않는다.
- hook이 현재 WIP/state를 agent-facing context로 자동 제공한다.
- 반복 read나 stale context 문제는 prompt 지시보다 state ledger/hook으로 푸는 방향이 자연스럽다.

### 2.3 Codex hook caveat: supported surface를 좁게 시작해야 한다

Codex도 hook/event 기반 자동화를 제공하지만, 공개 이슈상 Claude와 동일한 coverage를 가정하면 위험하다. 일부 이슈에서는 `PreToolUse` event coverage가 tool별로 다르거나, `PreToolUse.additionalContext`가 Claude와 같은 방식으로 안정화되어 있지 않다는 문제가 제기되어 있다.

References:

- OpenAI Codex issue #20204: https://github.com/openai/codex/issues/20204
- OpenAI Codex issue #19385: https://github.com/openai/codex/issues/19385

fooks에 주는 의미:

- Codex hook MVP는 “지원되는 surface”만 claim해야 한다.
- `PreToolUse`는 context injection보다 guard/warn/block 쪽으로 먼저 쓰는 것이 안전하다.
- context injection은 `SessionStart` / `UserPromptSubmit` / `PostToolUse` 쪽에 더 안전하게 배치한다.
- “모든 Codex action을 완전 감시한다”는 claim은 하면 안 된다.

### 2.4 Cursor rules / project rules: 정적 규칙과 동적 상태를 분리해야 한다

Cursor rules는 project-specific instruction을 저장하고 자동/수동으로 적용할 수 있다. 이 패턴은 durable conventions를 정적 rules로 두는 데 유용하지만, 현재 branch/issue/session/CI/stale residue 같은 volatile state를 rules에 박아두는 방식은 맞지 않다.

Reference: https://docs.cursor.com/context/rules

fooks에 주는 의미:

```text
AGENTS.md / rules / docs
→ 오래 유지되는 정적 규칙

fooks preflight / contextTrust
→ 현재 repo/session/action 상태
```

정적 지침과 동적 evidence가 섞이면 stale context 우선순위 문제가 다시 생긴다.

### 2.5 h5i style claim/evidence sidecar: 판단 근거를 durable하게 남기는 방향

h5i는 AI agent 작업에서 claims, evidence, reasoning trace를 Git-adjacent sidecar처럼 관리하는 방향을 제안한다. 핵심은 agent가 만든 판단과 근거를 이후 session에서 재사용하되, evidence hash/상태 변화에 따라 invalidation할 수 있게 하는 것이다.

Reference: https://h5i.dev/

fooks에 주는 의미:

- `contextTrust`는 current vs historical vs non-authorizing 분류를 제공한다.
- future `instructionTrust`는 최신 사용자 정정/금지/선호를 durable하게 관리할 수 있다.
- 둘 다 “더 많은 텍스트”가 아니라 “근거와 authority를 가진 compact state”로 남아야 한다.

---

## 3. fooks의 핵심 설계 방향

### 3.1 `contextTrust`는 state trust다

`contextTrust`가 답하는 질문:

```text
현재 작업의 source of truth는 무엇인가?
무엇은 advisory인가?
무엇은 historical receipt인가?
무엇은 현재 작업 근거로 쓰면 안 되는가?
```

대상:

- open issue / PR / mapped session count
- main echo boundary
- stale residue
- live non-main worktree handoff candidate
- mapped session vs live handoff caveat
- post-merge CI receipt

즉 `contextTrust`는 repo/work state에 대한 신뢰 분류이다.

### 3.2 `instructionTrust`는 별도 layer가 필요하다

AI가 맥락을 놓치는 문제에는 repo state가 아니라 대화 지시를 놓치는 경우도 있다.

예:

```text
사용자: minseol2가 아니라 minislively로 해달라
agent: fork remote로 PR 생성
```

이건 `contextTrust`만으로 해결할 수 없다. 별도의 instruction trust가 필요하다.

`instructionTrust`가 답해야 하는 질문:

```text
사용자의 최신 정정은 무엇인가?
이번 작업에서 활성 constraints는 무엇인가?
어떤 추정은 위험한가?
어떤 external side effect 전에 반드시 확인해야 하는가?
```

예상 shape:

```json
{
  "schemaVersion": 1,
  "latestUserCorrections": [
    {
      "kind": "repo-owner-correction",
      "instruction": "Use minislively, not minseol2.",
      "appliesTo": ["git push", "gh pr create"]
    }
  ],
  "activeConstraints": [
    "Every PR body must include a closing keyword for the linked issue.",
    "Do not implement #962/#963 in the #961/#966 lanes."
  ],
  "dangerousAssumptions": [
    "Do not infer fork remote when upstream write is required."
  ]
}
```

### 3.3 Preflight should combine state + instruction + action

Recommended conceptual packet:

```json
{
  "schemaVersion": 1,
  "source": "fooks preflight",
  "stateTrust": {
    "contextTrust": "projection from operator-check"
  },
  "instructionTrust": {
    "latestCorrections": [],
    "activeConstraints": [],
    "dangerousAssumptions": []
  },
  "actionRisk": {
    "trigger": "workflow-start | user-prompt | write-intent | git-side-effect | gh-side-effect | explicit-check",
    "mode": "off | silent | advisory | visible | blocking",
    "reasons": [],
    "recommendedAction": "proceed | warn | ask-user | block"
  }
}
```

This design keeps #961's state authority work separate from future user-instruction memory work and from action-specific policy decisions.

---

## 4. Trigger model

### 4.1 Do not lead with prompt keywords

Prompt keywords are allowed only as weak fallback signals.

Bad primary trigger:

```text
if prompt contains "구현" or "수정" or "디버깅":
  run preflight
```

Better primary trigger:

```text
if workflow starts:
  run preflight

if tool action is write/edit/apply_patch/git/gh:
  run preflight

if side effect is durable/external:
  escalate risk mode
```

### 4.2 Proposed trigger taxonomy

```ts
type PreflightTrigger =
  | "session-start"
  | "workflow-start"
  | "user-prompt-silent"
  | "continuation"
  | "write-intent"
  | "git-side-effect"
  | "gh-side-effect"
  | "post-tool-refresh"
  | "explicit-check";
```

### 4.3 Proposed risk modes

```ts
type PreflightMode = "off" | "silent" | "advisory" | "visible" | "blocking";
```

Meaning:

- `off`: no preflight needed
- `silent`: inject only agent-facing context; do not show the user
- `advisory`: provide non-blocking guidance to the agent
- `visible`: show warning because the user may care
- `blocking`: stop the action until a required condition is met

### 4.4 Initial trigger-to-mode mapping

| Trigger | Default mode | Escalate when |
| --- | --- | --- |
| `session-start` | `silent` | never in MVP |
| `workflow-start` | `advisory` | sourceOfTruth empty, main echo only, known wrong owner constraint |
| `user-prompt-silent` | `silent` | never in MVP |
| `continuation` | `silent` | stale residue or no current authority |
| `write-intent` | `advisory` | edit on main, stale residue, no active artifact |
| `git-side-effect` | `visible` | no issue/PR/session, wrong remote/account, dirty unrelated files |
| `gh-side-effect` | `visible` | no linked issue, wrong repo owner, missing closing keyword |
| `post-tool-refresh` | `silent` | never in MVP |
| `explicit-check` | `visible` | user asked to inspect status |

Blocking should be rare in the first implementation. It should start only for durable/external side effects where the policy is already strong, for example PR body missing a linked issue closing keyword or attempting to push/PR to a known wrong owner.

---

## 5. Proposed phased roadmap

### Phase 1 — Design/research artifact only

This document is Phase 1.

Goals:

- record why prompt keyword matching is fallback-only;
- define action-based trigger taxonomy;
- define stateTrust vs instructionTrust separation;
- define preflight risk modes;
- identify Codex/Claude hook caveats;
- keep #961 boundaries intact.

No runtime behavior changes.

### Phase 2 — `fooks preflight --json` CLI MVP

Purpose:

- make the policy testable without hooks;
- reuse `readOperatorCheckSnapshot()` and `contextTrust`;
- produce a compact agent-facing summary.

MVP shape:

```json
{
  "schemaVersion": 1,
  "source": "fooks preflight --json",
  "contextTrustSummary": {
    "currentAuthorityCount": 0,
    "advisoryCount": 0,
    "historicalCount": 0,
    "nonAuthorizingCount": 0
  },
  "agentGuidance": {
    "currentAuthority": [],
    "doNotTreatAsCurrent": [],
    "recommendedAction": "proceed"
  },
  "risk": {
    "mode": "silent",
    "reasons": []
  }
}
```

Non-goals:

- no automatic hook injection yet;
- no instructionTrust persistence yet;
- no blocking behavior yet.

### Phase 3 — Codex hook MVP

Use supported hook surfaces only.

Suggested first surfaces:

- `SessionStart` / `UserPromptSubmit`: silent or advisory context injection where available
- `PreToolUse`: guard/warn for supported write/git/gh commands
- `PostToolUse`: silent refresh after meaningful changes

Claim boundary:

```text
Codex hook preflight is best-effort over supported hook events. It does not claim complete coverage over every Codex tool/action.
```

### Phase 4 — instructionTrust MVP

Add a small local ledger for latest user corrections and active constraints.

Candidate inputs:

- explicit user corrections: “아니”, “그게 아니라”, “X가 아니라 Y”
- repo-owner/remote/account corrections
- PR/issue policy constraints
- active non-goals from PRD/test-spec/ultragoal artifacts

MVP output should be read-only/advisory. Do not let generated instructionTrust override newer user messages or AGENTS.md/developer/system instructions.

### Phase 5 — actionRisk hardening

Only after observing false positives/false negatives:

- stronger visible warnings for write-intent;
- blocking for PR/commit/push when linked issue or repo owner constraints fail;
- explicit ask-user paths for ambiguous destructive/durable actions.

---

## 6. Acceptance tests for future implementation

These are not implemented in this design PR, but future work should cover them.

### 6.1 `fooks preflight --json`

- emits schemaVersion/source;
- embeds or summarizes `contextTrust` without mutating operator-check fields;
- preserves #961 buckets and `contractScope` values;
- has stable risk modes for empty current authority/main echo/stale residue/handoff caveat;
- performs no additional git/gh/tmux/filesystem reads beyond reused operator-check path unless explicitly designed and tested.

### 6.2 Prompt keyword fallback

- “리팩토링이 뭔지 설명해줘” must not trigger visible/blocking preflight;
- “계속” may trigger silent preflight only;
- prompt heuristics cannot block tool execution by themselves.

### 6.3 Tool/action gate

- `apply_patch` or file write gets advisory stateTrust context;
- `git push`/`gh pr create` gets visible risk if repo owner or linked issue constraints conflict;
- known wrong-owner correction in instructionTrust is surfaced before `git push` or `gh pr create`.

### 6.4 Instruction trust

- latest correction wins over older correction;
- instructionTrust remains subordinate to system/developer/AGENTS.md rules;
- instructionTrust does not become source evidence for code correctness;
- instructionTrust can be pruned or scoped per task/session.

---

## 7. Open questions

1. Should `instructionTrust` live under `.omx/state`, `.omx/notepad`, or a fooks-owned state file?
2. Should `fooks preflight --json` embed full `contextTrust` or only a compact summary by default?
3. How should fooks represent “wrong remote/account” without doing extra remote auth checks in every preflight?
4. Which Codex hook events are stable enough to claim in README/docs?
5. Should blocking ever happen for local file edits, or only for durable external side effects?
6. How should preflight cache by cwd/git HEAD/session turn to avoid repeated slow checks?

---

## Final recommendation

Proceed in this order:

```text
1. Keep #961 contextTrust as the state authority substrate.
2. Add fooks preflight --json as a testable policy layer.
3. Use hook lifecycle/action triggers, not prompt keyword lists, as the primary automation mechanism.
4. Add instructionTrust separately for latest user corrections and active constraints.
5. Start with silent/advisory modes; reserve blocking for narrow, durable side effects after evidence.
```

This keeps fooks aligned with its core direction: not “more context”, but **current, scoped, source-grounded, authority-aware context before an agent acts**.
