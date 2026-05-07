# Development principles

This project should keep quality guardrails, but they should support product progress rather than replace it. Prefer work that advances user-facing behavior, core payload behavior, or runtime value before adding docs/test-only safety layers.

## Default priority

Start from the user-visible or runtime value of the change:

- Does this improve `fooks setup`, `fooks doctor`, `fooks compare`, `fooks extract`, runtime hooks, or model-facing payload quality?
- Does this make supported repeated-file work easier to trust or use?
- Can the merged change be described as a concrete behavior improvement rather than only a future preparation step?

If the answer is unclear, narrow the task until the product value is explicit.

## Task gate

Before starting a task, ask:

1. Does this change user-visible behavior?
2. Does this improve core payload, extraction, comparison, setup, doctor, or runtime-hook behavior?
3. If not, does it prevent a concrete regression or public-claim accident?
4. Does the test or doc protect a core behavior change, or is it only another safety layer?

Proceed when the answer to 1, 2, or 3 is yes. Deprioritize work where the answer is no and the change only adds another fixture, wording variant, or preparation note.

## Docs/test-first exceptions

Docs/test-first work is appropriate when it is the safest way to establish or protect a high-risk boundary, especially when:

- opening a new risky domain lane;
- changing public support, benchmark, billing, provider-token, runtime-token, or parity wording;
- preventing a concrete regression that was observed or is strongly implied by current code;
- adding focused tests that protect a behavior change;
- defining a first-time domain boundary before runtime behavior can safely depend on it.

## Coverage heuristic

Do not treat tests or docs as a requirement to enumerate every possible scenario. The goal is to lock what must stay true and make unknown cases fail safely.

- **Tests should protect contracts, not simulate the universe.** Prefer a small set of representative happy paths, boundary/failure cases, and concrete regression cases over combinatorial scenario growth.
- **Docs should capture intent, boundary, and non-goals.** Do not mirror implementation detail line-by-line when the code already says it.
- **Unknown cases should default to safe fallback behavior.** In this repo, fallback-first boundaries and claim limits are usually more valuable than speculative scenario expansion.
- **New test/doc work should answer a specific risk.** If it does not protect supported behavior, a public claim boundary, or a previously observed regression, it is probably noise.

## Domain work

Domain strategy should be positive capability design first and negative boundary management second.

- **React Web:** prioritize payload quality, semantic edit anchors, compare output, and context routing for supported same-file work. Keep the seven-axis repeated-read context retention contract in [`docs/react-web-context-retention.md`](./react-web-context-retention.md) source-only and same-file unless a separate plan explicitly widens the boundary.
- **TUI/Ink:** define the smallest safe payload value for Ink component structure, layout, prompt, and input facts before broad terminal claims.
- **React Native:** keep broad support claims out of scope unless explicitly promoted; focus on measured narrow gates and whether they produce useful payload value.
- **WebView:** preserve fallback-first and bridge-boundary safety; prefer boundary-aware guidance over compact reuse unless a later security/boundary plan approves a measured scope.
- **Mixed/Unknown:** treat them as safety states unless a separate plan proves a narrower outcome.

## Avoid

Avoid work that only creates the appearance of progress:

- fixture-only expansion after the relevant boundary is already covered;
- wording-only guardrails with no new claim risk;
- repeated “preparation for future support” changes that never reach core behavior;
- tests that lock implementation trivia instead of protecting user-facing or runtime value;
- broad support wording based only on syntax traversal evidence.

## Role of tests and docs

Tests and docs remain important. Their default role is to protect and explain behavior, not to substitute for it. When a core change lands, add the smallest useful regression coverage and user-facing wording needed to keep the claim boundary honest.
