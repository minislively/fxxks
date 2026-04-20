# Codex 실사용 피드백 체크리스트

이 문서는 `fooks install codex-hooks` + `fooks attach codex` 이후,
실제 repo에서 반복 편집이 얼마나 자연스럽게 동작하는지 빠르게 검증하기 위한 체크리스트입니다.

## 1. 설치 확인

실제 repo 루트에서:

```bash
fooks init
fooks attach codex
fooks install codex-hooks
```

확인 포인트:
- `.fooks/` 가 생성되는가
- `~/.codex/fooks/attachments/<repo>.json` 이 생성되는가
- `~/.codex/hooks.json` 에 `fooks codex-runtime-hook --native-hook` 가 들어가는가

## 2. 첫 세션 smoke

Codex를 repo 루트에서 시작하고 같은 `.tsx/.jsx` 파일을 3~4턴 연속으로 다룹니다.

추천 패턴:
1. 구조 요약 요청
2. 같은 파일의 작은 로직 수정 요청
3. 같은 파일의 두 번째 후속 수정 요청
4. 필요하면 일반적인 말로 원문 기준 재검토 요청

예시:

```text
components/QuestionAnswerForm.tsx 구조를 요약해줘.
```

```text
같은 파일에서 Save Question 버튼 조건을 설명해줘.
```

```text
같은 파일에서 입력 아래 글자 수 표시를 어디에 넣어야 하는지 설명해줘.
```

```text
components/QuestionAnswerForm.tsx 원문 기준으로 다시 봐줘.
```

## 3. 꼭 봐야 할 상태 신호

반복 턴에서 아래 문구가 자연스럽게 보이는지 확인합니다.

- `fooks: reused pre-read (<mode>)`
- `fooks: fallback (<reason>)`
- `fooks: full read requested`

핵심은 **매 턴 다 보이는지**가 아니라,
**재사용/폴백/우회 같은 의미 있는 변화가 있을 때만 짧게 보이는지**입니다.

## 4. 사용자 체감 질문

세션이 끝나면 아래 네 가지만 기록하면 됩니다.

1. repeated-read 체감
   - 좋음 / 애매함 / 별차이없음
2. full-read 욕구
   - 거의 없음 / 좀 있음 / 자주 있음
3. fallback 빈도
   - 드묾 / 보통 / 잦음
4. 이상한 점
   - 한 줄 메모

## 5. 바로 보고 싶은 로그/증거

피드백을 남길 때 아래 정보가 있으면 가장 좋습니다.

- repo 이름
- 파일 경로
- task 한 줄 설명
- `decide` 결과 (`raw/compressed/hybrid`, confidence)
- 실제로 본 상태 신호
- 원문 기준 재검토 필요 여부
- build/test/lint 결과

## 6. 이슈로 남길 때 템플릿

```md
### Repo
- <repo>

### File
- <path>

### Task
- <one-line edit task>

### Decision
- mode: <raw|compressed|hybrid>
- confidence: <high|medium|low>

### Runtime experience
- repeated-read: <좋음|애매함|별차이없음>
- full-read desire: <거의 없음|좀 있음|자주 있음>
- fallback frequency: <드묾|보통|잦음>

### Signals seen
- <fooks: reused pre-read ...>
- <fooks: fallback ...>
- <fooks: full read requested>

### Verification
- build: <pass|fail|not-tested>
- lint/test: <pass|fail|not-tested>

### Notes
- <anything surprising>
```

## 7. 언제 버그로 본다

아래는 우선적으로 고쳐야 할 버그/회귀로 취급합니다.

- 같은 파일 반복 턴인데도 pre-read 재사용이 거의 안 보임
- 원문 기준 재검토 요청이 기대대로 full-read 우회를 못 함
- 짧은 상태 문구가 너무 지저분해 의미 파악이 어려움
- compressed/hybrid가 edit quality를 반복적으로 깨뜨림
- fallback이 늦어서 잘못된 수정이 먼저 나옴

## 8. 현재 Phase 2A 기준

현재 우선순위는 **압축률보다 신뢰성**입니다.
즉 실사용에서 애매하면:
- 더 많이 압축하는 쪽보다
- 더 빨리 raw로 물러나는 쪽
이 맞습니다.


호환성 참고:
- 이제 신규 사용뿐 아니라 기존 자동화도 `fooks` / `.fooks` / `FOOKS_*` 기준으로만 맞추세요.
