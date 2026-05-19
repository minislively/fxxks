# Context trust and stale evidence research for fooks

Date: 2026-05-19
Status: research note / product direction input

## Summary

Recent fooks dogfood work exposed a recurring AI-coding failure mode: updating `main` refreshed the code tree, but it did not refresh the model's belief state or the surrounding context surfaces. The model could still over-trust stale worktrees, closed PR receipts, old docs, previous session summaries, or advisory hints.

The product direction that falls out of this is:

> fooks should not only give agents more context. fooks should classify which context is current evidence, which is advisory, which is historical, and which must not be used as active work evidence.

A shorter framing:

> fooks gives coding agents verifiable frontend source evidence, not just more context.

## Problem observed in fooks dogfood

### Main sync was not enough

`git pull` / `main` sync only updates the repository tree. It does not update every context surface an AI session may see:

- current source files
- current branch diff
- open issues / open PRs
- closed issues / closed PR receipts
- local worktrees and stale review branches
- previous session summaries
- tmux/proc runtime evidence
- `fooks check`, `status`, audit, and handoff artifacts
- docs, archive docs, claim-boundary docs, and previous design notes
- context hints / prompt context / handoff artifacts

For a human, these surfaces have different authority. For a model, they can look like one big bag of text unless we label them.

Core lesson:

> The problem was not only stale code. The problem was stale context priority.

### Representative fooks cases

These issue/PR clusters show the shape of the problem:

- Context hints must stay advisory: #794 guarded React Web context hints so they cannot change source-evidence-derived ranking, priority, bucket, inspect-first semantics, edit authority, or apply/copy authority.
- Product narrative shifted toward inspect-first source evidence: #819, #860 clarified that fooks is a React Web preflight / issue-card / current-source-recheck flow, not an auto-fix or token-savings headline.
- Golden outputs and issue cards had to be locked narrowly: #826, #833, #838, #848 showed that even useful cards must remain source-qualified, manual-review, and bounded.
- Operator evidence repeatedly confused stale/absent runtime state with active work: #885, #889, #903, #905, #906, #916 added artifact evidence, runtime provenance, CI diagnostics/fallbacks, and ancestor-tmux filtering.
- Work item/explain/status UX became necessary because agents/operators need to see domain, evidence, rejected evidence, state, and next action: #922, #927, #935, #948.
- Runtime-first positioning needed claim-safety: #950 clarified runtime path first, CLI as control plane, reports as projections, while preserving provider-cost/runtime-token/Claude-opencode/RN-WebView/Vue/patch-authority boundaries.

## External reference patterns

### Aider repo map

Aider uses a concise repository map containing important classes/functions, types, and call signatures. It sends relevant portions of the map to the model and uses graph ranking plus a token budget to select the most relevant codebase portions.

What fooks can borrow:

- ranked context selection
- token-budgeted bundles
- symbol/source summaries that help an agent decide what to read next

What fooks should not copy wholesale:

- becoming a generic repo map or repo-wide RAG product
- optimizing only for “more useful code context” without authority/freshness labels

Source: https://aider.chat/docs/repomap.html

### Sourcegraph Cody context

Cody frames context as additional information that lets an LLM answer questions and generate code aligned with a codebase. It retrieves context from keyword search, Sourcegraph search, and code graph relationships.

What fooks can borrow:

- multiple context sources can be combined
- code graph / relationship-aware retrieval matters
- context relevance improves codebase-specific output

What fooks should add beyond this:

- explicit trust/freshness classification
- source evidence vs advisory/historical context separation
- frontend-specific evidence surfaces rather than broad repo search

Source: https://sourcegraph.com/docs/cody/core-concepts/context

### Windsurf memories/rules activation modes

Windsurf separates auto-generated memories from user-defined rules, and provides activation modes such as always-on, glob, model-decision, and manual. It also advises durable project knowledge to live in explicit rules/AGENTS.md rather than relying only on generated memories.

What fooks can borrow:

- activation modes matter; context should not always be injected
- manual / glob / model-decision boundaries reduce context pollution
- durable knowledge should be explicit, scoped, and concise

What fooks should avoid:

- treating generated memories or previous session summaries as source evidence
- always-on injection of broad project history

Source: https://docs.windsurf.com/windsurf/cascade/memories

### Claude Code hooks/session lifecycle

Claude Code hooks fire at lifecycle points such as SessionStart, UserPromptSubmit, PreToolUse/PostToolUse, FileChanged, PreCompact/PostCompact, InstructionsLoaded, ConfigChange, and WorktreeCreate/Remove.

What fooks can borrow:

- context/trust checks can be attached to lifecycle events
- SessionStart / UserPromptSubmit are good points to surface source-of-truth manifests
- FileChanged / ConfigChange can mark evidence stale
- PreCompact/PostCompact can generate durable handoff summaries
- WorktreeCreate/Remove can update active-work evidence

Source: https://code.claude.com/docs/en/hooks

### OpenCode custom commands

OpenCode supports project commands as markdown prompt templates with arguments, shell-output injection, file references, model/agent settings, and optional subtask routing.

What fooks can borrow:

- simple command surfaces can standardize repeated workflows
- shell output/file references can make current repo evidence explicit
- subtask-style commands can prevent primary context pollution

Source: https://opencode.ai/docs/commands/

## What fooks already does well

### 1. Narrow product wedge

fooks is already much narrower than a generic repo-index/RAG tool. The strongest current lane is React Web / frontend issue-card intelligence and same-file/source-grounded evidence.

This is good. It avoids fighting Cursor/Cody/Aider on generic codebase context.

### 2. Source evidence and claim boundaries

Many recent issues and docs preserve explicit boundaries:

- current source remains authoritative
- context hints are advisory
- issue cards are manual-review / inspect-first
- no broad RN/WebView/TUI/Vue/SFC authorization claims
- provider billing/runtime token claims are bounded
- auto-apply/patch authority is not implied

This is a strong foundation for a trust/freshness layer.

### 3. Dogfood exposed real operator failure modes

The dogfood loop already found practical context failures:

- no-tmux state should not block idle classification
- ancestor tmux panes should not count as active work
- closed PR/green receipt evidence should not be treated as current work
- CI unknown needs diagnostics and fallback
- status/explain output needs runtime provenance

These are exactly the kinds of failures a trust layer should prevent.

### 4. Runtime-first direction

The runtime-first positioning is promising: fooks can sit in the workflow as a live context/evidence layer, with CLI/status/report outputs as control plane and projections.

## Gaps / 부족한 부분

### 1. Context authority is implicit, not first-class

fooks has source evidence, hints, reports, status, docs, and dogfood artifacts, but the authority level of each is not always represented as structured data.

Needed distinction:

- current source evidence
- current diff evidence
- current open issue/PR evidence
- advisory hints
- generated summaries
- historical archive
- stale residue
- forbidden-as-current-work evidence

### 2. Freshness is checked in places, but not unified

There are runtime provenance and stale checks in operator paths, but fooks needs a more general freshness/trust concept for AI-consumable context.

Question every context item should answer:

- When was this generated?
- From which source hash / branch / file range?
- Is it still valid against current source?
- Is it current authority or historical context?
- What should an agent do if it conflicts with source?

### 3. Handoff summaries need negative instructions

A normal handoff says what happened. An AI-safe handoff must also say what not to believe.

Needed sections:

- Current source of truth
- Current task / active anchor
- Decisions made
- Historical only
- Do not treat as active work
- Known failed approaches
- Stale or superseded context
- Next safe action

### 4. Session reset is not productized

The team learned: “세션은 버리고, 판단 근거는 남긴다.”

fooks can turn this into a workflow: generate a compact new-session handoff that preserves current truth and discards stale belief state.

### 5. Prompt/context audit is missing

Before handing context to an agent, fooks could inspect whether the prompt/handoff contains stale issue IDs, closed PR receipts, archive docs, or claims that conflict with current docs/source.

## Recommended feature directions

### P0 — Source of Truth Manifest

Command idea:

```sh
fooks context-manifest
fooks truth-map
fooks current-context
```

Output should classify context surfaces:

```json
{
  "currentSourceOfTruth": [
    { "kind": "source", "path": "src/...", "hash": "...", "trust": "high" },
    { "kind": "open-pr", "number": 123, "trust": "medium-high" }
  ],
  "advisoryOnly": [
    { "kind": "context-hint", "reason": "cannot grant edit authority" },
    { "kind": "previous-session-summary", "reason": "not source evidence" }
  ],
  "historicalOnly": [
    { "kind": "archive-doc", "path": "docs/archive/..." },
    { "kind": "closed-pr", "number": 870 }
  ],
  "mustNotUseAsCurrentWork": [
    { "kind": "merged-ci-receipt", "reason": "completion evidence, not active target" },
    { "kind": "stale-worktree", "reason": "residue without live issue/branch/session" }
  ]
}
```

Acceptance direction:

- identifies current source/diff/open issue/open PR anchors
- marks closed/merged/archive/session-summary as lower authority
- emits machine-readable JSON and human-readable markdown
- source evidence always outranks hints/summaries

### P0 — Stale Context Detector

Command idea:

```sh
fooks context-check <handoff-or-prompt.md>
fooks prompt-audit <prompt.md>
fooks stale-context --json
```

Detect:

- closed issue/PR IDs presented as active
- merged CI receipts presented as current work
- archive docs presented as current policy
- stale worktree paths
- previous session summaries without current source validation
- context hints trying to alter authority/ranking/apply permission
- known claim-boundary conflicts

Output should say:

- what is stale
- why it is stale
- what current source should be checked instead
- whether the agent must re-read current source before editing

### P1 — Context freshness / trust score

Every context bundle item should carry:

- `trust`: high / medium / low / historical / forbidden-current
- `freshness`: current / stale / unknown
- `source`: file, issue, PR, session, runtime, generated report
- `generatedAt`
- `sourceHash` / branch / line range where applicable
- `authority`: source / diff / open-work / advisory / historical
- `conflictPolicy`: source-wins / ignore-for-current-work / recheck-required

Example labels:

- current source: high, source authority
- current branch diff: high, source authority
- open issue/PR: medium-high, active-work authority
- previous session summary: low, advisory
- closed PR receipt: historical, not active work
- archive docs: historical only
- context hint: advisory only

### P1 — Session reset handoff generator

Command idea:

```sh
fooks handoff --for-new-session
fooks session-reset-pack
```

Generated markdown sections:

```md
## Current task
## Current source of truth
## Active work anchor
## Decisions made
## Known failed approaches
## Historical only / do not reuse as current authority
## Stale context to ignore
## Next safe action
## Re-read before edit
```

This turns reflection/recording into a concrete AI-coding workflow.

### P1 — Active Work Anchor Check

Command idea:

```sh
fooks active-anchor
```

Check:

- current branch vs main
- linked open issue
- linked open PR
- live tmux/proc session
- worktree delta
- whether evidence is only a closed/merged receipt

Output examples:

- `activeAnchor: true` with issue/branch/session/PR evidence
- `activeAnchor: false` with warning: “do not ask agent to continue; create explicit target first”
- `activeAnchor: ambiguous` with stale residue list

### P2 — Context diff / belief check

Command idea:

```sh
fooks belief-check <handoff.md>
fooks context-diff <prompt.md>
```

Compare AI-facing text with current repo truth:

- prompt says RN broad support; docs say narrow/fallback only
- prompt says cleanup allowed; docs say cleanup authority absent
- prompt treats closed PR as active; GitHub says merged/closed
- prompt cites archive doc as current policy

This is more advanced but very aligned with fooks’ product thesis.

### P2 — Agent integration hooks / commands

Use Claude Code hooks and OpenCode commands as integration points:

- SessionStart: print current context manifest
- UserPromptSubmit: audit prompt/handoff for stale context
- FileChanged: mark evidence stale
- PreCompact/PostCompact: generate session-reset handoff
- WorktreeCreate/Remove: update active anchor state
- OpenCode `/fooks-handoff`, `/fooks-context-check`, `/fooks-active-anchor` commands

## Suggested docs / issue split

1. `Define context trust taxonomy`
   - source / diff / open-work / advisory / historical / forbidden-current
   - trust/freshness/authority/conflict policy fields

2. `Add source-of-truth manifest prototype`
   - JSON + markdown output
   - source/diff/open PR/current docs vs archive/closed/stale surfaces

3. `Add stale context detector for handoff text`
   - closed PR/issue IDs, archive docs, stale worktree paths, context hint authority violations

4. `Add new-session handoff generator`
   - include “do not treat as active work”, failed approaches, historical-only

5. `Add active work anchor check`
   - issue/branch/PR/session/proc/worktree evidence; merged receipts excluded

6. `Add hook/command integration design`
   - Claude Code lifecycle hooks + OpenCode commands; docs-only first

## What to avoid

- Do not make fooks a generic repo RAG/search product.
- Do not inject all history always-on.
- Do not treat memory/session summaries as source evidence.
- Do not let context hints grant edit/apply/copy authority.
- Do not use closed PRs/green receipts as active targets.
- Do not claim broad framework support without evidence.
- Do not frame this as token savings only.

## Product positioning update

Current good positioning:

> fooks is a frontend context compression and evidence layer for repeated agent edits.

Sharper next positioning:

> fooks helps coding agents know which frontend context to trust, which context is stale, and when current source must be re-read.

Even shorter:

> fooks is a trust layer for frontend agent context.

## LinkedIn-friendly insight

The product lesson from this research is not “AI needs more context.” It is:

> AI needs context with authority, freshness, and boundaries.

Or:

> AI coding breaks less when the tool does not just provide context, but explains what the model is allowed to believe.
