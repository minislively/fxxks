# Codex 실사용 피드백 체크리스트

목표: fooks가 실제 Codex 세션에서 자연스럽게 도움이 되는지만 빠르게 확인합니다.

## 1. 설치 확인

repo 루트에서:

```bash
fooks setup
fooks status codex
fooks status cache
```

확인할 것:

- `.fooks/`가 생겼는가
- `fooks status codex`가 connected/ready 계열인가
- `~/.codex/hooks.json`에 `fooks codex-runtime-hook --native-hook`가 있는가

## 2. 같은 프론트 파일을 반복해서 다루기

Codex에서 같은 `.tsx` / `.jsx` 파일을 3턴 정도 연속으로 다룹니다.

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

필요하면 자연어로 원문 기준 재검토를 요청합니다.

```text
components/QuestionAnswerForm.tsx 원문 기준으로 다시 봐줘.
```

## 3. 봐야 할 신호

반복 작업에서 아래 같은 짧은 상태가 보이면 정상입니다.

- `fooks: reused pre-read (<mode>)`
- `fooks: fallback (<reason>)`
- `fooks: full read requested`

매 턴 보일 필요는 없습니다. 의미 있는 재사용/폴백이 있을 때만 짧게 보이면 됩니다.

## 4. 피드백에 남길 것

- repo 이름
- 파일 경로
- 한 줄 작업 설명
- repeated-read 체감: 좋음 / 애매함 / 별차이없음
- 원문 재검토 욕구: 거의 없음 / 좀 있음 / 자주 있음
- fallback 빈도: 드묾 / 보통 / 잦음
- build/test/lint 결과
- 이상한 점 한 줄

## 5. 버그로 볼 것

- 같은 파일 반복 작업인데도 pre-read 재사용이 거의 안 보임
- 원문 기준 재검토 요청이 제대로 반영되지 않음
- 상태 문구가 너무 길거나 지저분함
- compressed/hybrid payload가 반복적으로 수정 품질을 깨뜨림
- fallback이 늦어서 잘못된 수정이 먼저 나옴
