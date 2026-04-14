# Real Repo Validation Guide

Use this guide after shipping a payload or extraction change and before
claiming real-world value.

This is the fastest way to answer:

- does `fooks` still classify files reasonably?
- does `--model-payload` stay semantically useful?
- does it materially reduce delivery size on a real frontend repo?

## Recommended target repo

Pick one React/TSX repo that has:

- 30+ frontend files
- at least one small presentational component
- at least one form/list-heavy component
- at least one stateful conditional-render component

Avoid starting with a repo that is mostly backend, scripts, or config.

## 1. Cold-start setup

From the target repo root:

```bash
fooks init
fooks scan
```

Check:

- `.fooks/index.json` exists
- `.fooks/cache/` exists
- `files.length` looks plausible for the repo

## 2. File-class smoke test

Pick three files:

1. small/simple component
2. large boilerplate-heavy TSX file
3. stateful/conditional TSX file

Then run:

```bash
fooks decide src/path/to/Small.tsx
fooks decide src/path/to/Large.tsx
fooks decide src/path/to/Stateful.tsx
```

Expected pattern:

- small/simple → often `raw`
- large/boilerplate-heavy → often `compressed`
- stateful/conditional → often `hybrid`

If all three collapse to the same mode, inspect the extraction output
before changing heuristics.

## 3. Canonical vs model-facing comparison

For each representative file:

```bash
fooks extract src/path/to/File.tsx > /tmp/full.json
fooks extract src/path/to/File.tsx --model-payload > /tmp/model.json
```

Quick size check:

```bash
wc -c /tmp/full.json /tmp/model.json
```

What to confirm in `model.json`:

- relative `filePath`
- no `fileHash`
- no `meta`
- `contract` still present when relevant
- `behavior` still present when relevant
- `structure` still present
- `snippets` still present for `hybrid`

## 4. Warm-cache validation

Run:

```bash
time fooks scan
time fooks scan
```

Expected pattern:

- first run: higher `refreshedEntries`
- second run: high `reusedCacheEntries`

Then edit one file and run again:

```bash
time fooks scan
```

Expected pattern:

- only the changed file, or a very small set, refreshes

## 5. Real AI usefulness check

For one compressed file and one hybrid file:

1. give the canonical extract to your AI runtime
2. give the model-facing payload to the same runtime
3. ask for the same modification request

Compare:

- did the model still understand props/contracts?
- did it still preserve hooks/events/conditionals?
- did hybrid snippets provide enough trust anchors?
- did you feel forced to fall back to raw/full output?

## 6. Suggested pass/fail rule

Treat the real-repo validation as successful if:

- classification feels sane on 3 representative files
- model-facing payload is visibly smaller than canonical output
- semantic layers still feel sufficient for edit tasks
- warm scan reuses cache heavily
- one-file edit does not trigger broad refresh

## 7. Recommended capture format

Record results like this:

```text
Repo:
Files scanned:

Representative files:
- small:
- large:
- stateful:

Mode decisions:
- small:
- large:
- stateful:

Payload comparison:
- file A: full bytes -> model bytes
- file B: full bytes -> model bytes

Cache behavior:
- cold:
- warm:
- partial invalidation:

Quality notes:
- semantic loss:
- fallback needed:
- tiny raw injection acceptable?:
  - yes if repeated raw files under 500 bytes injected `useOriginal: true`
  - no if they still fell back to `raw-mode`
- next tuning target:
```

## 8. What to do if it fails

If the real repo feels weak, do not immediately widen product scope.

Tune in this order:

1. model-facing payload keep/drop rules
2. snippet selection quality
3. decide heuristics
4. style summary compression

Keep rename/migration work deferred unless the failure is clearly caused
by file identity churn.
