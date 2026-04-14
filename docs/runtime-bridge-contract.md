# Runtime bridge contract for future OMC/OMX harnesses

This document captures the **shared contract** that the current Codex runtime
bridge already proves, so a future OMC/OMX harness can reuse the same behavior
without redesigning the pre-read semantics from scratch.

## Goal

Keep the current v1 guarantees stable while allowing another harness to consume
the same repeated-read optimization:

- quiet by default
- `.tsx/.jsx` scoped
- session-local repeated read reuse
- payload-first, never payload-only
- explicit fallback and explicit full-read override

## Input contract

Any harness-specific bridge should be able to normalize into this shape:

```ts
type RuntimeBridgeInput = {
  hookEventName: "SessionStart" | "UserPromptSubmit" | "Stop";
  prompt?: string;
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  cwd?: string;
};
```

Notes:

- `SessionStart` initializes session state.
- `UserPromptSubmit` is the only event that may inject pre-read context.
- `Stop` clears session state.

## Decision contract

The bridge emits one of four actions:

```ts
type RuntimeBridgeAction = "noop" | "record" | "inject" | "fallback";
```

Meaning:

- `noop`: do nothing
- `record`: first eligible same-file mention seen; remember it quietly
- `inject`: repeated eligible same-file mention; attach model-facing payload
- `fallback`: skip payload and steer the harness back to full source

## Reuse scope

The current proven strategy is intentionally narrow:

- **extensions:** `.tsx`, `.jsx`
- **reuse scope:** same runtime session only
- **trigger:** repeated same-file mention in one session

This is the exact behavior to preserve before considering:

- linked `.ts`
- long-lived/project-wide reuse
- broader full read interception

## Stable fallback reasons

These reason tokens are already meaningful and should remain stable across
harnesses:

- `ineligible-extension`
- `raw-mode`
- `missing-contract`
- `missing-behavior`
- `missing-structure`
- `missing-hybrid-snippets`
- `escape-hatch-full-read`

Exception: a `raw` file under 500 bytes may still inject a minimal payload with
`useOriginal: true` and `rawText`, instead of using `raw-mode` fallback.

## Stable user-facing status vocabulary

When the bridge chooses to surface status text, keep it short and fixed:

- `fooks: reused pre-read (<mode>)`
- `fooks: fallback (<reason>)`
- `fooks: full read requested`

The current Codex hook renderer may flatten line breaks, so status headers
should stay as one-line summaries.

## Escape hatches

The current override markers are part of the bridge contract:

- `#fooks-full-read`
- `#fooks-disable-pre-read`

Any future OMC/OMX bridge should preserve equivalent semantics.

## Shared regression scenarios

Future harnesses should prove the same three scenarios:

1. **Repeated eligible frontend file → inject**
   - first mention: `record`
   - second mention: `inject`

2. **Repeated tiny raw file → inject original source**
   - first mention: `record`
   - second mention: `inject`
   - payload includes `useOriginal: true`

3. **Escape hatch → full read requested**
   - any prompt with `#fooks-full-read` or `#fooks-disable-pre-read`
   - immediate `fallback`
   - user-facing status uses the fixed override vocabulary

## OMC/OMX phase boundary

Before OMC/OMX-specific work, do **not** expand scope to:

- all-file interception
- linked `.ts` auto-reuse
- project/global durable reuse
- custom UI surfaces

Phase 2 should focus on reusing this proven contract inside a different harness,
not redefining the contract itself.
