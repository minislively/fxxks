# Phase 2B Risk Validation Checklist

이 문서는 **Phase 2B 자동 attach UX**에서 아직 남아 있는 리스크를
실사용 기준으로 검증하기 위한 체크리스트다.

목표는 새 기능을 더 추가하는 것이 아니라, 아래 세 가지가 실제로 충분한지 확인하는 것이다.

1. **trust status가 실제로 도움이 되는가**
2. **stale refresh 타이밍이 너무 늦거나 너무 과하지 않은가**
3. **current file source-of-truth가 prompt-target 기준으로도 충분한가**

---

## 준비

대상 repo에서:

```bash
fooks init
fooks attach codex
fooks install codex-hooks
```

상태 확인:

```bash
fooks status codex
```

기대:
- `connectionState: connected`
- `lifecycleState: ready`
- `lastScanAt`, `lastRefreshAt` 존재

---

## Risk 1 — Trust status usefulness

질문:
> `fooks status codex`가 실제로 “지금 붙었는지 / 준비됐는지 / 최근에 갱신됐는지”를 이해하는 데 도움이 되는가?

### 시나리오
1. repo attach 직후 `fooks status codex`
2. Codex에서 같은 `.tsx/.jsx` 파일 2~3턴 반복 사용
3. 다시 `fooks status codex`
4. `#fooks-full-read` 1회 사용 후 다시 `fooks status codex`

### 볼 것
- `ready` → `attach-prepared` 전환이 납득되는가
- `activeFile`이 현재 작업 파일과 맞는가
- `lastAttachPreparedAt` 갱신이 보이는가
- 상태를 봤을 때 “지금 자동 attach가 먹고 있구나”를 이해할 수 있는가

### 기록 예시
- trust status 체감: 좋음 / 애매함 / 별차이없음
- active file 일치: 맞음 / 가끔 어긋남 / 자주 어긋남

---

## Risk 2 — Stale refresh timing

질문:
> 파일을 바꾼 뒤 다음 attach에서 refresh가 너무 늦거나 너무 자주 일어나지 않는가?

### 시나리오
1. 같은 `.tsx/.jsx` 파일을 한 번 작업
2. 파일을 직접 수정
3. 같은 파일로 다시 Codex 요청
4. `fooks status codex` 확인

### 볼 것
- 다음 반복 attach 전에 refresh가 반영되는가
- refresh 때문에 흐름이 과하게 무거워지지 않는가
- stale 상태가 남아 있는 느낌이 없는가

### 기록 예시
- refresh 타이밍: 자연스러움 / 조금 늦음 / 늦음 / 너무 잦음
- stale 느낌: 없음 / 가끔 있음 / 자주 있음

---

## Risk 3 — Active file source-of-truth

질문:
> 현재 `prompt-target` 기준 active file 판단이 실제 실사용에서 충분한가?

### 시나리오
1. 한 세션에서 파일 A를 2턴 사용
2. 곧바로 파일 B로 전환
3. 다시 `fooks status codex`
4. 원하면 `#fooks-full-read`로 파일 B 원문 강제

### 볼 것
- `activeFile.filePath`가 실제 방금 다룬 파일로 바뀌는가
- 이전 파일이 남아 있어 혼동을 주지 않는가
- Stop 이후 `activeFile`이 정리되는가

### 기록 예시
- active file 전환: 정확함 / 약간 늦음 / 혼동됨
- source-of-truth 부족감: 거의 없음 / 좀 있음 / 자주 있음

---

## 추천 테스트 파일 유형

좋은 대상:
- 상태가 있는 form component
- 조건부 렌더가 많은 panel
- 같은 폴더 type/util을 조금 쓰는 component
- 2~4턴 연속으로 자주 만지게 되는 실제 작업 파일

별로인 대상:
- 너무 단순한 button
- wrapper만 있는 file
- raw가 당연한 아주 작은 component

---

## 기록 템플릿

아래 6개만 기록하면 충분하다.

- repo:
- file:
- repeated-read 체감: 좋음 / 애매함 / 별차이없음
- trust status 체감: 좋음 / 애매함 / 별차이없음
- full-read 욕구: 거의 없음 / 좀 있음 / 자주 있음
- refresh / active-file 이상점: 한 줄

---

## 현재 해석 원칙

- **기능이 조용한 것**은 문제 아님
- **status를 봐도 여전히 이해가 안 되는 것**은 문제일 수 있음
- **refresh가 너무 늦어 stale처럼 느껴지는 것**은 문제
- **active file이 자주 어긋나는 것**은 source-of-truth 리스크

Phase 2B에서는 새 UI를 늘리기보다,
이 체크리스트로 실제 실사용 근거를 모아 **작게 조정**하는 방식이 우선이다.
