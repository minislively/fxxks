# Domain memory contract

This document defines the `domain-memory.v1` product contract for fooks context-memory receipts. The initial shipped surface is explicit report-only CLI output behind `fooks inspect-domain <file> --json --domain-memory-receipt`: it does not change runtime behavior, detector behavior, pre-read behavior, cache storage, payload schema, setup eligibility, README support wording, or provider/token claims.

`domain-memory.v1` is an audit and receipt shape for deciding whether a previously prepared context packet may be trusted again. It is not a support expansion and it is not a new automatic compact-payload path.

## Why this exists

fooks already separates domain profiles, concern profiles, payload policy, and receipts. The missing contract is a stable memory/receipt shape that keeps those decisions together without forcing the project to enumerate every possible frontend case in advance.

The contract keeps the existing rule:

> Domain and concern evidence are observations. They are not permission. Compact or narrow reuse requires an explicit payload-policy decision plus a fresh source/scope match.

## Pipeline position

`domain-memory.v1` sits after source inspection and policy planning:

```text
source or prompt target
→ source fingerprint
→ syntax facts
→ domain evidence
→ concern evidence
→ payload policy decision
→ domain-memory receipt
→ runtime delivery or fallback guidance
→ validation receipt
```

A memory receipt records what was observed and what policy allowed. It must not decide support, infer runtime correctness, or override fallback rules; policy remains the permission owner.

## Proposed shape

The shape below is the contract target for future artifacts. It is intentionally audit-focused and may be introduced first in explicit report/receipt surfaces before any runtime hook consumes it.

```ts
type DomainMemoryPacket = {
  schemaVersion: "domain-memory.v1";
  scope: {
    filePath: string;
    sourceFingerprint?: { fileHash: string; lineCount: number };
    promptSpecificity: "exact-file" | "file-hinted" | "ambiguous";
  };
  domain: {
    lane: "react-web" | "react-native" | "webview" | "tui-ink" | "shared" | "mixed" | "unknown";
    evidence: string[];
    claimBoundary: string;
  };
  concerns: Array<{
    id: string;
    signals: string[];
    nonAuthorizationBoundary: string;
  }>;
  policy: {
    name: string;
    plannerDecision: "compact-safe" | "narrow-structural" | "fallback-full-read" | "defer-with-guidance";
    allowed: boolean;
    allowedMeaning?: string;
    reason?: string;
    staleWhen: string[];
  };
  receipt: {
    generatedAt: string;
    commandOrHook: string;
    claimSupported: string;
    runtimeOrCacheReuse?: false;
    nonClaims: string[];
    safeNextAction: string;
  };
};
```

## Field responsibilities

| Field | Owner | Responsibility | Must not do |
| --- | --- | --- | --- |
| `scope` | source/context policy | Names file, prompt specificity, and freshness anchors. | It must not imply that a stale source can reuse old context. |
| `domain` | domain detector/profile | Records UI/runtime-family evidence and claim boundary. | It must not authorize compact or narrow reuse by itself. |
| `concerns` | concern profiles | Records task-context hints such as forms, routing, state, styling, or RN source-only concerns. | It must never authorize compact-payload reuse and must never promote a domain. |
| `policy` | payload policy planner | Records the permission decision and stale conditions. | It must not invent source facts or weaken fallback-first boundaries. |
| `receipt` | reporting/adapter surface | Records what can be quoted later and what remains a non-claim. | It must not become public support wording beyond measured evidence. |

## Freshness and reuse rules

A domain-memory receipt is reusable only when every relevant freshness condition still holds:

- `sourceFingerprint.fileHash` still matches the current source;
- `sourceFingerprint.lineCount` still matches when line ranges or edit anchors matter;
- the file path and prompt scope still refer to the same work target;
- the domain classification and payload-policy decision still match;
- the policy's `staleWhen` conditions do not apply;
- the receipt's claim boundary still matches the current public/documented support boundary.

If any freshness anchor is missing or stale, the safe next action is to read the current source or rerun the relevant fooks command.

## Fallback and deferred states

Fallback and deferred are valid safe states, not failures. A receipt should record why normal source reading is required when the file is unsupported, mixed, stale, boundary-heavy, or outside a measured lane.

Fallback-first boundaries remain especially important for WebView, Mixed, Unknown, and broad React Native or TUI evidence. A fallback receipt may inform future research, but it must not auto-promote a domain or concern.

## Fallback learning loop

Future fallback learning should be explicit and human-gated:

```text
fallback or deferred receipt
→ repeated-pattern review
→ candidate concern/domain proposal
→ fixture and pass/fail expectations
→ policy gate
→ receipt surface
→ public wording review
```

Promotion must stop when stable source-only signals, fixture coverage, policy wording, or non-claims are missing. The loop is for learning where to inspect next, not for exhaustive case enumeration.

## Non-goals

This contract does not add:

- runtime behavior;
- detector behavior;
- pre-read behavior;
- cache storage changes;
- model-facing payload schema changes;
- React Native broad support;
- WebView support, bridge safety, or compact-payload reuse;
- broad TUI semantic support or terminal correctness;
- concern evidence as compact-payload authorization;
- provider-token, billing, cost, latency, or runtime-token claims;
- README or release support wording expansion.

## First safe implementation lane

The first implementation lane is an explicit report-only CLI receipt:

```bash
fooks inspect-domain <file> --json --domain-memory-receipt
```

That flag may add a top-level `domainMemoryReceipt` to the existing `inspect-domain --json` result. The receipt is intentionally additive and gated:

1. Plain `inspect-domain --json` output remains unchanged when `--domain-memory-receipt` is absent.
2. `--domain-memory-receipt` requires `--json` and must fail clearly without it.
3. `policy.allowed` in this lane is `false`, and `allowedMeaning` says the receipt does not authorize runtime, pre-read, cache, or compact-payload reuse.
4. `receipt.runtimeOrCacheReuse` is `false`, and `nonClaims` preserves the no-support-expansion and no-token/cost/performance-claim boundaries.
5. Runtime or payload-shape changes remain deferred until a separate plan names exact files, fixtures, policy gates, and verification commands.

## Receipt freshness verifier lane

The next implementation lane is an explicit CLI-only verifier:

```bash
fooks domain-memory verify --receipt receipt.json --file src/Foo.tsx --json
```

The verifier checks whether a saved `domain-memory.v1` receipt still matches the current source fingerprint, file scope, domain lane, claim boundary, and report-only policy boundary. Its `fresh` status means **fresh for report-only evidence only**. It does not authorize runtime reuse, pre-read reuse, cache reuse, model-facing payload reuse, setup readiness, support expansion, or provider token/cost/performance claims.

Verifier statuses are fail-closed:

- `fresh` means the receipt matches the current file and may be quoted as report-only evidence.
- `stale` means source freshness changed or is missing; rerun `inspect-domain`.
- `incompatible` means file scope, domain lane, or claim boundary no longer matches; full-read the current source.
- `unsupported` means the receipt is malformed, from an unsupported schema, or attempts to claim runtime/cache reuse.

For this lane, any receipt with `policy.allowed: true` or `receipt.runtimeOrCacheReuse: true` is unsupported. Runtime/cache/pre-read consumers remain deferred until a later plan names the exact consumer, freshness gates, policy boundaries, and verification evidence.

## Runtime advisory consumer lane

The first consumer is deliberately narrow: the Codex runtime hook may consume an explicit prompt-provided receipt path as **advisory-only** context on a repeated-file turn:

```text
Again inspect src/Foo.tsx with domain-memory receipt .fooks/domain-memory/foo.json
```

This lane does not persist receipts and does not let a receipt authorize compact injection. The normal pre-read/runtime payload gate must already allow injection. When the receipt verifies as `fresh`, the hook may append a bounded `FOOKS DOMAIN MEMORY ADVISORY` block that repeats the receipt status, reasons, safe next action, and non-claims.

If the explicit receipt is `stale`, `incompatible`, `unsupported`, missing, or unreadable, the runtime hook fails closed to full-read guidance. The stale receipt is not silently ignored, because an explicit receipt hint means the prompt is asking the runtime to rely on that evidence.

When no explicit receipt hint is present and the normal repeated-file payload gate already allows injection, the Codex runtime hook may also run an **automatic project-local lookup** in `.fooks/domain-memory/`. A `fresh` automatic lookup may append the same bounded `FOOKS DOMAIN MEMORY ADVISORY` block with `authorization: none` and `advisoryOnly: true`. Automatic `not-found`, `stale`, `incompatible`, `unsupported`, or `ambiguous` results are debug-only no-ops: they do not force full-read fallback, do not append advisory context, and do not change the normal runtime/pre-read decision. Runtime lookup errors are represented as `unsupported` debug metadata.

This lane still does not add pre-read reuse, cache reuse, model-facing payload reuse, setup readiness, support expansion, or provider token/cost/performance claims. Pre-read consumers, automatic receipt persistence, and authorized runtime/cache reuse require separate plans.

## Lookup diagnostic lane

The next consumer-adjacent lane is an advisory-only lookup diagnostic:

```bash
fooks domain-memory lookup --file src/Foo.tsx --json
```

The lookup recursively scans only the project-local `.fooks/domain-memory/` directory for JSON receipts, rejects symlinked lookup directories, verifies every candidate with the same freshness verifier, and returns a machine-readable status: `not-found`, `fresh`, `stale`, `incompatible`, `unsupported`, or `ambiguous`.

A `fresh` lookup means exactly one receipt is fresh for report/advisory evidence only. The machine result still carries `authorization: "none"` and `advisoryOnly: true`; any `advisoryReceiptPath` is evidence-only, not permission. Multiple fresh receipts are `ambiguous` and must not be auto-selected. Stale, incompatible, unsupported, mixed fresh/non-fresh, missing, unreadable, or ambiguous lookup results do not authorize runtime reuse, pre-read reuse, cache reuse, model-facing payload reuse, setup readiness, support expansion, or provider token/cost/performance claims.

This lane intentionally does not authorize pre-read decisions, cache storage, or model-facing payload reuse. The runtime hook consumes a `fresh` lookup only as advisory context after normal payload eligibility, while pre-read appendices, automatic receipt persistence, and any payload/cache reuse require separate plans and tests.
