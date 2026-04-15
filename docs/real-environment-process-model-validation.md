# Real Environment Process-Model Validation Guide

Use this guide when deciding whether `fooks` should keep the current
one-shot CLI as the production baseline or reopen thinner
launcher/helper work.

This guide assumes the current default is still:

- **production baseline:** one-shot CLI
- **candidate only:** thinner launcher / helper path

Do not use a single local benchmark rerun as the reopening signal.

---

## What this guide is trying to answer

On a real repo and a real working environment:

1. does one-shot CLI still feel fast enough in normal use?
2. does launcher/helper show a **repeatable** warm-path win?
3. does that win survive after accounting for:
   - fallback behavior
   - debug visibility
   - operational complexity

If the answer to 2 is only “sometimes,” the baseline should remain
one-shot CLI.

---

## Minimum reopening rule

Treat thinner launcher/helper as eligible to reopen only when **all**
of these are true:

1. repeated-run performance is **clearly better than one-shot**
2. the improvement is **larger than normal run-to-run noise**
3. helper failure falls back automatically to one-shot
4. helper state / fallback reason / failure mode are inspectable
5. operational complexity does not visibly spread across setup, CI,
   debugging, or platform handling

If one of these is missing, do not promote it.

---

## Recommended validation environments

Run the comparison in at least **three** environments:

1. **your daily local repo**
2. **one larger real frontend repo**
3. **one fresh/clean environment**
   - new shell session
   - cold machine state if practical
   - ideally a different machine or CI-like host

Good candidates:

- medium React/TSX product repo
- larger component-heavy UI repo
- repo with repeated `scan` usage during normal editing

Avoid validating only on tiny fixture projects.

---

## What to record

For each environment, capture:

- machine / OS / shell context
- repo name and approximate TSX/component count
- current one-shot warm average
- launcher/helper warm average
- direct helper warm average
- standard deviation / min / max
- whether helper fallback was exercised
- whether failure reason was visible
- setup friction encountered
- debugging friction encountered

If possible, record at least **10 warm repeats** for each path.

---

## Test flow

### 1. Confirm the baseline first

Run:

```bash
npm run bench:gate
npm run bench:process-model
```

Confirm:

- benchmark gate still passes
- one-shot results look plausible
- current artifact is readable

### 2. Compare the three paths

Capture these three numbers:

- current CLI warm
- launcher → helper warm
- direct helper warm

Interpretation:

- **direct helper fast, launcher not fast**
  - process model is promising
  - front-door still too heavy
- **launcher also clearly fast**
  - candidate may be worth reopening
- **launcher noisy or inconsistent**
  - baseline stays one-shot

### 3. Exercise failure paths

You should intentionally test at least one failure mode:

- helper not ready
- helper timeout
- helper transport/socket failure
- helper process missing

Confirm:

- one-shot fallback happens automatically
- user-visible behavior stays sane
- failure reason is discoverable in logs/status/artifacts

### 4. Assess operational spread

Ask these questions:

- did setup require extra steps or hidden knowledge?
- did platform-specific quirks show up?
- did debugging now require checking more than one process/layer?
- would a new teammate understand the flow quickly?

If the answer trends toward “this now needs a keeper,” that is a red
flag even if benchmarks look better.

---

## Suggested decision rubric

### Keep one-shot baseline when

- launcher/helper win is small
- variance is high
- direct helper is fast but product path is not decisively faster
- fallback/debugging adds meaningful complexity
- setup or platform handling starts to spread

### Reopen thinner launcher/helper when

- launcher/helper shows a **clear, repeated** win
- the win survives across multiple environments
- fallback is automatic and boring
- debug/status visibility is straightforward
- operational complexity stays local and documented

---

## Recommended capture template

```text
Environment:
Repo:
Approx file count:

Process-model results:
- current warm avg:
- launcher warm avg:
- direct helper warm avg:
- current stddev:
- launcher stddev:

Fallback check:
- tested failure mode:
- automatic fallback:
- visible failure reason:

Operational notes:
- setup friction:
- platform quirks:
- debug friction:
- teammate readability:

Verdict:
- keep one-shot baseline / reopen candidate
- why:
```

---

## Current default conclusion

Until this guide produces stronger evidence, keep the following as the
default posture:

> **one-shot CLI stays the production baseline; thinner
> launcher/helper remains a gated candidate, not a default path**

For the broader adoption rule, see:

- [`docs/performance-vs-operational-complexity.md`](docs/performance-vs-operational-complexity.md)
