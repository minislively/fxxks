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
