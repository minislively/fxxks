# State contract

This document defines the product-facing state contract for fooks as a frontend-first AI coding context manager. It distinguishes source evidence, context state, receipts, and active work without changing storage or runtime behavior.

## State categories

| State category | Owner | Purpose | Claim boundary |
| --- | --- | --- | --- |
| Source state | Current project files plus source fingerprint/range metadata. | Tie evidence to the source that was inspected. | Stale when the source changes. |
| Context state | Prepared packet, first-minute summary, issue cards, warnings, or fallback guidance. | Help the agent inspect and edit within scope. | Advisory unless current source and policy still match. |
| Policy state | Decision that context is compact, narrow, fallback, or deferred for a measured scope. | Keep permission separate from evidence. | Cannot be inferred from domain or concern evidence alone. |
| Receipt state | Durable command/test/review output. | Record what happened and what claim it can support. | Time- and scope-bound; not eternal proof. |
| Active-work state | Open issue, branch, worktree, session, task note, or unverified result. | Show unfinished work and next action. | Not completion evidence. |
| Internal orchestration state | Tool/runtime coordination files and session metadata. | Help agents and local tools coordinate. | Not product state and not public capability proof. |


Compatibility state term: `architecture_blocked` is reserved for operator reports that need the issue/PR/session contract vocabulary.


Compatibility state term: `idle_clean` is reserved for operator reports that need the issue/PR/session contract vocabulary.


Compatibility state term: `active_session` is reserved for operator reports that need the issue/PR/session contract vocabulary.


Compatibility state term: `active_branch` is reserved for operator reports that need the issue/PR/session contract vocabulary.


Compatibility state term: `pr_ready` is reserved for operator reports that need the issue/PR/session contract vocabulary.


Compatibility state term: `receipt_only` is reserved for operator reports that need the issue/PR/session contract vocabulary.

## Product-facing state rules

1. **Freshness first.** A context packet or work order is valid only for the source/fingerprint/scope it names.
2. **Policy before reuse.** Evidence can be observed before policy, but compact or narrow reuse needs a policy decision.
3. **Fallback is explicit state.** Unsupported, mixed, stale, or boundary-heavy inputs should record why normal source reading is required.
4. **Receipts are scoped.** A receipt supports only the command, file, issue, or test run it names.
5. **Active is not done.** Active-work evidence needs a closeout receipt before it becomes completion evidence.
6. **Internal is not public.** Orchestration files can help local agents, but public product claims must cite product surfaces, tests, or docs.

## Freshness and fingerprints

Source-derived evidence should carry enough freshness context for a later agent to decide whether to trust it. Useful freshness anchors include:

- source path;
- source fingerprint or hash when available;
- generated-at timestamp when available;
- command and arguments;
- policy decision and fallback reason;
- relevant included/omitted ranges;
- non-claims.

If a freshness anchor is absent or stale, the safe next action is to read the current source or rerun the relevant fooks command.

## Receipt shape

A product receipt should be easy to quote without overclaiming:

```text
Receipt: <command/test/review>
Scope: <file, issue, benchmark, or workflow>
Observed: <source-derived or command-derived facts>
Claim supported: <narrow statement>
Non-claims: <what this does not prove>
Next action: <only if active work remains>
```

This shape can appear in JSON, Markdown, CLI text, or release notes. The exact format may vary by surface, but the claim boundary should remain visible.

## Active work closeout

Close active work with one of these receipt types:

- passing targeted test or validation command;
- review decision that explicitly archives or rejects the work;
- merged PR or release note that names the scope;
- documented fallback decision for a lane that should not continue now.

Do not close active work only because a worktree exists, a branch name mentions an issue, a session produced notes, or a previous receipt once existed.

## Out of scope for this pass

This pass does not change cache storage, session storage, provider state, runtime adapter state, merge-gate policy, CI state, detector logic, or implementation behavior. It defines the language future implementation issues should use when they expose or consume state.

Evidence cannot choose a next action without state, and state cannot be assigned without evidence.

## State to next-action mapping

`architecture_blocked`, `idle_clean`, `active_session`, `active_branch`, `pr_ready`, `receipt_only`, and `blocked` are report-facing state terms. State to next-action mapping keeps active work, receipts, and architecture blockers separate.
