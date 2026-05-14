# fooks

Frontend change intelligence for Codex.

`fooks` gives Codex a frontend-aware first minute before React Web edits: it reads source facts, gates the evidence, turns narrow native-control form/accessibility findings into issue cards, and hands agents a compact inspect-first work order. The strongest path today is not “trust a token-savings claim”; it is **run `fooks inspect react-web-issues`, see where the frontend risk is, then edit with the current source open**.

First-minute path:

Run the first value path on a supported React Web file:

```bash
npm install -g fxxk-frontend-hooks
cd your-supported-project
fooks setup
fooks doctor
fooks inspect react-web-issues src/components/Form.tsx
```

The issue-card output is read-only and actionable: each card explains `problem`, `whyItMatters`, `whereToLook`, `confidence`, and `suggestedAction`. High-confidence native label/control findings can include safe preview shape hints, but fooks does **not** auto-apply patches, invent final accessible-name copy, infer custom-component semantics, or claim a broad accessibility audit. Ambiguous cases stay as manual-review cards with stop reasons.

Want to see the product loop before installing it into a real repo? Start with the packaged golden demo: [`docs/demo/react-web-issues.md`](docs/demo/react-web-issues.md). For the detailed first-minute handoff contract, including `--summary-json` and `--dry-run-json`, see [`docs/react-web-first-minute-work-orders.md`](docs/react-web-first-minute-work-orders.md).

Context reduction and caching are supporting mechanisms. In the strongest current Codex path, repeated work on the same React `.tsx` / `.jsx` file may reuse compact same-file context when the evidence gate says that is safe. `fooks compare` shows local source-vs-payload evidence for one supported file, but the launch-facing habit is simpler: **inspect first, then reuse context only when safe**.

Then open Codex in that repo and work normally with the current source open. After the first issue-card pass, supporting local proof commands are:

```bash
fooks inspect react-web-issues src/components/Form.tsx --summary-json
fooks inspect react-web-issues src/components/Form.tsx --dry-run-json
fooks compare src/components/Button.tsx
```

Best fit: React Web `.tsx` / `.jsx` work where source-derived form and accessibility facts can reduce frontend change risk before feature work, migrations, refactors, or tests. Experimental Codex-first `.ts` / `.js` same-file reuse remains narrow and signal-gated. React Native/WebView, TUI / React CLI promotion, Vue/SFC, broad TS/JS coverage, multi-file refactors, read interception, LSP semantics, and Claude/opencode parity remain roadmap or boundary lanes, not current support.

- Public npm package: `fxxk-frontend-hooks`
- CLI command: `fooks`

## 30-second version

Use fooks when you want Codex to start React Web work with a compact, source-grounded issue card instead of rediscovering frontend facts from scratch.

1. **Inspect first:** `fooks inspect react-web-issues <file>` ranks narrow native JSX label/control risks and tells the agent where to look before editing.
2. **Handoff safely:** `--summary-json` gives agents `firstMinuteSummary.items[0]`, `decision`, `humanDecisionNeeded`, and `doNotDo` boundaries as advisory inspect-first input rather than edit authority.
3. **Preview only when safe:** `--dry-run-json` lists migration candidates and preview availability, but remains dry-run-only with `autoApply: false` and human review for final label/name choices.
4. **Reuse when safe:** repeated same-file Codex work may reuse compact context after evidence gates pass; `fooks compare` is supporting local payload proof, not the headline.
5. **Prove narrowly:** benchmark and cost numbers are estimate-scoped supporting evidence, not provider invoice, billing-token, stable runtime-token, or Claude/opencode automatic-savings proof.

See the example source, command output, summary handoff, and dry-run boundary in [`docs/demo/react-web-issues.md`](docs/demo/react-web-issues.md).

## Quick start and local proof

The first-minute path above is the shortest setup/proof loop: install the CLI, activate the current repo with `fooks setup`, check readiness with `fooks doctor`, then run `fooks inspect react-web-issues <supported-file>` for actionable React Web issue cards. Agents and tools that only need the compact work-order handoff should use `fooks inspect react-web-issues <supported-file> --summary-json`, read `firstMinuteSummary.items[0]` and its `decision`, and treat the result as advisory inspect-first input rather than edit authority. Migration planners that need candidate rows can use `--dry-run-json`; it remains read-only and dry-run-only. `fooks compare <supported-file>` is supporting local source-vs-payload evidence, not the whole product proof.

`fooks doctor` is the read-only health check for setup/hook readiness; its default output starts with status, why, first blocker, and next action so a new user can recover without reading JSON. `fooks inspect react-web-issues` is the first actionable report surface for narrow native-control form/accessibility findings. `fooks compare` defaults to a concise verdict/next-action summary for one supported file; add `--json` for exact local byte counts, exclusions, and claim boundary text.

If you run `fooks doctor` from a source checkout, new git worktree, or freshly cloned project before `fooks setup`, an `unhealthy` result usually means the project-local adapter/runtime manifests have not been activated yet. That is expected for an unprepared checkout; run `fooks setup`, then rerun `fooks doctor` to verify the dogfood state you will actually use.

### First-run checklist

1. Install the package: `npm install -g fxxk-frontend-hooks`.
2. Confirm the command resolves to the package you expect: `which fooks` and `fooks --help`.
3. Activate only the repo you are inside: `fooks setup`. The default output should be a short `ready`, `partial`, or `blocked` summary, not a debug JSON wall.
4. Diagnose locally: `fooks doctor` for readiness, `fooks inspect react-web-issues <file>` for the first actionable React Web form/accessibility report, `fooks status` for local estimated session telemetry, `fooks status artifacts` for a read-only fooks tmux/worktree/branch audit, and `fooks compare <file>` for supporting one-file payload proof; add `--json` only when you need exact local byte counts, exclusions, and claim boundary text.
5. Use `fooks setup --json` only when you need support/debug paths, runtime manifests, or issue-report evidence.

## Strongest path / beta path / not today

| Strongest path today | Narrow beta path | Not today |
| --- | --- | --- |
| React Web `.tsx` / `.jsx` change intelligence for source-derived form/accessibility context, actionable issue reports, and repeated same-file Codex work. | Experimental Codex-first same-file `.ts` / `.js` module work when module signals are strong enough. | Universal file-read interception for every language, framework, runtime, or file type. |
| `fooks inspect react-web-issues <file>` for read-only issue cards and high-confidence patch previews over native JSX controls. | Codex-only TS/JS setup can qualify when a strong beta module exists, but Claude/opencode helper setup is still React-only. | Automatic file edits, broad accessibility audits, or inference over unsupported custom components. |
| Local model-facing payload estimates with `fooks compare` and local session estimates with `fooks status` support the change-intelligence workflow. | TS/JS beta stays same-file only and does not imply semantic/framework understanding. | Provider usage/billing-token telemetry, provider tokenizer behavior, provider invoice/dashboard/charged-cost proof, or a `ccusage` replacement. |

TUI / React CLI TSX remains a candidate / evidence-only lane. Ink-style syntax can appear in local compare evidence, but that does **not** mean TUI support, terminal correctness, or default compact payload reuse is available today.

## Common scope questions

| Question | Current strongest path | Current limit | Next credible path |
| --- | --- | --- | --- |
| “Does this help my general TypeScript project?” | Codex-only same-file `.ts` / `.js` beta when a strong module qualifies. | No broad semantic framework or multi-file refactor claim. | Add measured fixtures and claim gates before widening TS/JS support. |
| “Can it refactor my whole Next.js app?” | Yes for repeated work on real TSX/JSX component files, including Next.js components. | No whole-app or route-wide refactor compression claim. | Prove larger Next profiles with fixtures, benchmarks, and edit-safety checks. |
| “Does Claude get the same automation?” | Project-local `SessionStart` / `UserPromptSubmit` context hooks and manual/shared handoff artifacts. | No Claude `Read` interception or runtime-token savings proof. | Promote only with measured Claude runtime evidence and explicit hook boundaries. |
| “What about opencode?” | Project-local `fooks_extract` custom tool and `/fooks-extract` slash command. | No automatic opencode read interception or automatic runtime-token savings. | A future read-shadow bridge would need separate safety and evidence gates. |

## Project/file support matrix

| Project shape | Setup expectation | Best verification command | Boundary |
| --- | --- | --- | --- |
| React / Next.js with `.tsx` or `.jsx` components | Full Codex setup path; Claude/opencode helpers can also be prepared when their homes/settings are available. | `fooks doctor` then `fooks compare src/components/Button.tsx` | Same-file repeated Codex work is the strongest supported workflow. |
| Ink or other React-based CLI with `.tsx` / `.jsx` components | Not a current support claim. `fooks compare` may still show syntax-level local evidence for a real TSX file, but this lane remains candidate / evidence-only until future fixtures and policy gates promote it. | `fooks compare path/to/App.tsx` for local syntax/payload evidence only | Candidate / evidence-only lane; no terminal correctness, no default compact reuse, and unsupported cases fall back safely. |
| React Native or embedded WebView `.tsx` files | Not a current support claim. TSX parsing only proves syntax can be read; it does not prove React Native component semantics, native platform behavior, bridge behavior, or WebView boundary safety. | Use normal source reading unless a future release adds RN/WebView fixtures, benchmarks, and explicit evidence. | Deferred lane; obvious RN/WebView markers fall back to full-source reading rather than compact fooks payload reuse. |
| Pure TypeScript/JavaScript library | Codex-only setup may qualify if a `.ts` / `.js` file passes the strong beta readiness gate. | `fooks doctor codex` and `fooks compare path/to/module.ts` | No Claude/opencode helper parity and no broad semantic/framework claim. |
| Vue/Svelte/SFC or arbitrary backend repo | Not a current support claim. | Use normal source reading unless a strong `.ts` / `.js` beta module qualifies for Codex. | Roadmap only; no universal read interception. |

## Deferred asks / not supported yet

These are useful future directions, but they are not required for the current Codex repeated React workflow:

- Vue/SFC, Svelte, or broader non-React framework support.
- React Native or embedded WebView support. A `.tsx` parse is not semantic evidence for RN primitives, native platform behavior, bridge behavior, or WebView security/runtime boundaries; see the [`docs/roadmap.md`](docs/roadmap.md#react-native--webview-promotion-ladder) promotion ladder before changing public support wording.
- Broader `.ts` / `.js` coverage beyond the same-file beta.
- Multi-file refactor context compression.
- Universal runtime file-read interception or provider-native read-hook parity.
- LSP-backed semantic rename/reference safety; see [`docs/lsp-extraction-boundary.md`](docs/lsp-extraction-boundary.md) for the issue #110 decision that product extraction stays AST-only by default.
- Claude/opencode parity with the Codex automatic path.
- Provider invoice/dashboard or billing-grade charge proof.

Experimental `.ts` / `.js` support is **not** a claim of backend/framework semantic understanding, multi-file refactor support, React Native/WebView support, Vue/SFC support, Claude/opencode parity, read interception, or LSP rename/reference safety. Unsupported or weak TS/JS files fall back to normal full-source behavior.

See [`docs/roadmap.md`](docs/roadmap.md) for how these future lanes map to stronger support or stronger evidence claims, and [`docs/lsp-extraction-boundary.md`](docs/lsp-extraction-boundary.md) for the LSP extraction decision boundary.

## Runtime support at a glance

| Environment | Current path | Automation level | Do not assume |
| --- | --- | --- | --- |
| Codex | Automatic repeated-file hook path through `fooks setup` | Strongest path: repeated same-file `.tsx` / `.jsx` prompts can reuse compact context when safe; experimental same-file `.ts` / `.js` beta is available after supported Codex setup, including Codex-only TS/JS setup when a strong beta module exists | Universal file-read interception, stable runtime-token wins, provider usage/billing-token, invoice/dashboard, or charged-cost proof, React Native/WebView support, Vue/SFC support, multi-file refactors, or LSP semantic safety |
| Claude | Project-local `SessionStart` / `UserPromptSubmit` context hooks plus manual/shared handoff artifacts | Narrower path: first eligible explicit frontend-file prompt is recorded/prepared; a repeated same-file prompt may receive bounded context | `Read` interception, full prompt-interception parity with Codex, or runtime-token savings proof |
| opencode | Project-local `fooks_extract` tool and `/fooks-extract` slash command | Manual/semi-automatic tool steering | Built-in `read` interception or automatic runtime-token savings |

## Install/setup scope at a glance

| Step | Scope | What can change |
| --- | --- | --- |
| `npm install -g fxxk-frontend-hooks` | global CLI install | Makes the `fooks` command available in the npm global prefix / PATH. It does not activate a project. |
| `fooks setup` | current project + runtime homes | Creates project-local `.fooks/` state, may add project-local `.opencode/` helper files, and may update runtime-home files such as Codex hooks/manifests or Claude handoff manifests. |
| `fooks doctor` | current project + runtime-home inspection | Reads local setup and hook-readiness artifacts without writing files; it is not live provider health, billing-token, cost, or `ccusage` proof. |
| `fooks check` | current project + local git/tmux/GitHub CLI inspection | Read-only operator/check artifact for post-merge main echoes; it requires a concrete open issue, open PR, or mapped fooks session before idle echoes can be treated as active work. |
| `fooks status` | current project inspection | Reads local fooks telemetry/status; it is not a package installer or billing-token report. |
| `fooks status artifacts` | current project + local git/tmux inspection | Read-only audit of fooks-scoped tmux sessions, git worktrees, and branches that may be merged into the selected base; it does not prove inactivity and never deletes artifacts. |
| `fooks status activity` | current project + local git/tmux inspection | Compact read-only operator snapshot for dogfood nudges, including bounded current-run and stale closed-artifact worktree evidence; remote issue/PR counts require explicit `--include-remote-counts`. |

By default, `fooks setup` prints a short readiness summary so the command does not look like a wall of debug JSON. Use `fooks setup --json` when you need the full `scope` object and support/debug paths that show what is project-local versus user-runtime/home scoped.

## What gets optimized

Current automatic optimization is intentionally narrow and supports the broader change-intelligence direction:

- Wedge: React Web source facts for `.tsx` / `.jsx`; experimental Codex-first `.ts` / `.js` same-file beta
- First report surface: `fooks inspect react-web-issues <file>` for actionable, read-only native-control form/accessibility issue cards
- Preview posture: patch previews are review aids for high-confidence findings, not automatic edits
- Runtime: Codex hooks
- Pattern: repeated same-file work in one Codex session
- First mention: record only
- Later same-file mentions: reuse a compact fooks payload when safe

This is best for iterative frontend component work such as:

```text
Review src/components/Form.tsx.
Now update src/components/Form.tsx validation copy.
One more change in src/components/Form.tsx: add disabled state.
```

If fooks cannot safely build a payload, it falls back to normal full-source behavior.

## Compare a file locally

Use `fooks compare` when you want immediate, local proof for a specific supported file:

```bash
fooks compare src/components/Button.tsx --json
```

The command compares the original source bytes with the compact base fooks model-facing payload used for context-reduction estimates. For compressed/hybrid frontend files, that payload is built from fooks' TypeScript AST-derived component contract, behavior, structure, style, bounded source-line ranges, source fingerprint, hook/effect intent, and form/control signals instead of the full source text. The line ranges are AST-derived edit aids and should be treated as valid only for the matching source fingerprint.

`fooks compare` reports estimated source/model-facing tokens, estimated saved bytes/tokens, and a reduction percent. This is a **local model-facing payload estimate**: it excludes optional edit-guidance overhead and is not provider tokenizer behavior, runtime hook envelope overhead, provider usage/billing tokens, invoices, dashboards, charged costs, or a `ccusage` replacement. Small raw files may show zero savings because fooks intentionally preserves the original source when that is safer. Optional provider/model tokenizer accounting, including Claude `count_tokens` or OpenAI/tiktoken proof lanes, is design-scoped separately in [Provider tokenizer proof boundary](docs/provider-tokenizer-boundary.md) and is not default `fooks compare`.

`fooks extract <file> --model-payload` also includes compact `editGuidance` when source ranges are available. Agents should use its `patchTargets` as line-aware hints for likely edit anchors such as component declarations, props, effects, callbacks, event handlers, form controls, submit handlers, validation anchors, and representative snippets. Before applying a patch from those hints, confirm the current source still matches `sourceFingerprint.fileHash` and `sourceFingerprint.lineCount`; if either changed, rerun `fooks extract` or read the file first. These patch targets are AST-derived edit aids, not LSP-backed rename/reference resolution, provider-tokenizer evidence, or billing evidence.

## Benchmark and evidence boundaries

The evidence ladder is intentionally split so public wording does not collapse prompt-size, runtime telemetry, and billing-grade proof into one claim:

| Level | Evidence | Supports | Does not support |
| --- | --- | --- | --- |
| Local estimate | `fooks compare`, `fooks status`, prepared payload accounting | Model-facing context / prompt-size estimate wording | Provider tokenizer, billing, or invoice wording |
| Optional provider-tokenizer proof | Future explicit proof lane scoped to a named provider/model tokenizer; see [Provider tokenizer proof boundary](docs/provider-tokenizer-boundary.md) | Provider/model-tokenizer accounting for an isolated fixture/payload | Default compare behavior, provider usage/billing tokens, invoices, dashboards, or charged costs, runtime hook envelope overhead, invoice/dashboard proof |
| Runtime telemetry | Codex CLI-reported matched-run diagnostics | Narrow internal runtime candidate evidence when quality gates pass | Stable public runtime-token or latency claims |
| Estimated API cost | Provider usage tokens converted under explicit pricing assumptions | Estimate-scoped API-cost wording with caveats | Invoice/dashboard or actual charged-cost proof |
| Billing-grade proof | Provider invoice, dashboard, or billed-usage exports | Future billing-grade wording for the measured scope | Not claimed today |

Current public summary:

- Local commands support **model-facing context / prompt-size estimate** wording.
- The 2026-04-14 Codex-oriented proxy snapshot showed a prepared-context estimate reduction from roughly 2.1M to 450K estimated context tokens in a 5-task sample, with no success-rate regression in that sample.
- The corrected 2026-04-22 Codex OAuth provider-cost campaign reached launch-grade estimated-cost evidence for the small fixture lane: 3 task classes × 5 accepted matched pairs, 0 command-execution events, 15/15 accepted, an overall median estimated API-cost reduction of 4.171%, and aggregate estimated API cost of `$0.588855` baseline vs `$0.5547775` fooks (`$0.0340775`, 5.787% lower) under the recorded pricing assumption. Provider-reported usage tokens in that campaign were `376,104` baseline vs `372,065` fooks; 4/15 individual pairs still regressed.
- Larger corrected public-code profiles made the impact easier to see under the same estimate-scoped boundary: the Next.js profile reported 15/15 accepted pairs, 0 regressions, median estimated API-cost reduction of 26.492%, provider-reported usage tokens `446,275` baseline vs `382,139` fooks, and aggregate estimated API cost `$0.88386` vs `$0.64497`; the Tailwind profile reported 15/15 accepted pairs, 0 regressions, median estimated API-cost reduction of 38.238%, provider-reported usage tokens `718,616` baseline vs `381,583` fooks, and aggregate estimated API cost `$1.598875` vs `$0.64853`.
- These provider-cost benchmark lanes are **estimated API cost under explicit pricing assumptions**. They do not prove invoice/dashboard savings, actual charged-cost savings, provider usage/billing-token outcomes, stable runtime-token savings, or stable wall-clock/latency savings.
- Direct runtime-token/time evidence remains unstable or negative in some diagnostics, so fooks does not claim stable runtime-token, wall-clock, or latency wins.

### Provider-cost benchmark snapshot (primary evidence)

This is the main benchmark section most readers should evaluate first: it answers whether matched full-source vs fooks-payload runs used less provider-reported usage and lower estimated API cost under explicit pricing assumptions. These figures are **not OMX-session benchmarks** and not a full interactive
"install fooks, work normally" session benchmark. They come from a Codex OAuth
no-tool benchmark harness that compares matched baseline prompts containing
real full-source context against matched fooks prompts containing real
`fooks extract --model-payload` context, using isolated Codex workdirs and AB/BA
pair order.

| Profile / project | Scope | Accepted pairs | Regressions | Median estimated API-cost reduction | Aggregate estimated API cost | Provider-reported usage tokens |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Small fixture lane | 3 task classes × 5 pairs | 15/15 | 4/15 pairs | 4.171% | `$0.588855` baseline → `$0.5547775` fooks (`$0.0340775`, 5.787% lower) | `376,104` baseline → `372,065` fooks |
| Next.js large profile | App Router summary, Layout Router refactor plan, Error Boundary test strategy | 15/15 | 0/15 pairs | 26.492% | `$0.88386` baseline → `$0.64497` fooks (`$0.23889`, 27.028% lower) | `446,275` baseline → `382,139` fooks |
| Tailwind large profile | Utilities summary, Variants refactor plan, CSS Parser test strategy | 15/15 | 0/15 pairs | 38.238% | `$1.598875` baseline → `$0.64853` fooks (`$0.950345`, 59.438% lower) | `718,616` baseline → `381,583` fooks |

Task-median reductions for the larger profiles were Next.js App Router summary `30.681%`, Layout Router refactor plan `28.699%`, Error Boundary test strategy `19.447%`; Tailwind Utilities summary `78.992%`, Variants refactor plan `38.238%`, CSS Parser test strategy `33.582%`.

### OMX command-surface diagnostic (secondary evidence)

A 2026-04-24 single-pair diagnostic checked whether the same fooks payload advantage survives the [`omx exec`](https://github.com/Yeachan-Heo/oh-my-codex) command surface from [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex). This is **not** an installed-hook repeated-session benchmark and is **not** stable public runtime evidence yet. It compared one Tailwind large file (`packages/tailwindcss/src/utilities.ts`) as full source (`213,836` bytes) versus real `fooks extract --model-payload` output (`3,517` bytes), with no tool calls, using `gpt-5.4-mini`.

| Surface | Full-source input tokens | Fooks-payload input tokens | Input-token reduction | Total-token reduction |
| --- | ---: | ---: | ---: | ---: |
| Plain `codex exec` | `65,497` | `13,593` | 79.246% | 78.996% |
| `omx exec` | `63,122` | `11,218` | 82.228% | 81.962% |

This is secondary evidence: it explains that the compact payload advantage survives the OMX command surface, but the provider-cost snapshot above is the stronger product-facing evidence. This controlled no-tool Tailwind payload pilot shows fooks' model-facing payload stayed much smaller through both plain Codex and OMX command surfaces. It does **not** prove that ordinary interactive OMX sessions, installed hooks, provider invoices, or stable runtime costs drop by the same amount.

Detailed evidence and current claim boundaries are maintained in the curated benchmark evidence page: https://github.com/minislively/fooks/blob/main/docs/benchmark-evidence.md

The benchmark evidence is not provider invoice/dashboard proof, not actual charged-cost proof, not provider usage/billing-token proof, and not a Claude or opencode automatic savings claim.

## Common questions

### Does this prove my provider bill will be lower?

No. fooks can reduce model-facing prompt/context size in supported cases, and the benchmark docs include estimate-scoped API-cost evidence under explicit pricing assumptions. That is not provider invoice, dashboard, actual charged-cost, or billing-grade proof.

### Is Claude automatic too?

Not at Codex parity. Claude support uses project-local `SessionStart` / `UserPromptSubmit` context hooks plus handoff artifacts. fooks does not intercept Claude `Read` tool calls.

### Does opencode get automatic read interception?

No. opencode support is a project-local `fooks_extract` tool and `/fooks-extract` slash command. It steers explicit tool use; it does not replace opencode's built-in `read` behavior.

### Which files are supported?

The strongest path today is repeated same-file React `.tsx` / `.jsx` work in Codex. Unsupported or unsafe cases fall back to normal full-source behavior.

React Native and embedded WebView files are not supported today. Treat `.tsx` parsing as syntax-level eligibility only; it is not evidence that fooks understands RN primitives, native platform semantics, bridge behavior, or WebView boundaries.

## Everyday commands

```bash
fooks setup          # one-time readiness: Codex hooks + Claude context hooks + opencode helper
fooks doctor         # read-only local setup and hook-readiness diagnostics
fooks doctor codex   # focus on Codex setup/hook readiness
fooks doctor claude  # focus on Claude project-local context-hook readiness
fooks check           # read-only post-merge echo vs active artifact boundary
fooks status          # local estimated context-size telemetry for this repo
fooks status codex   # check Codex attach/hook state
fooks status claude  # check Claude project-local context hook / handoff health
fooks status cache   # check local fooks cache health
fooks status artifacts # read-only fooks tmux/worktree/branch artifact audit
fooks status activity  # compact read-only operator activity snapshot
fooks inspect react-web-issues src/components/Form.tsx  # actionable read-only React Web issue report
fooks compare src/components/Button.tsx --json  # local original-vs-fooks payload estimate
```

For manual inspection:

```bash
fooks extract src/components/Button.tsx --model-payload
fooks scan
```

`fooks status` reads local `.fooks/sessions` summaries produced by the Codex automatic hook path and the Claude project-local context-hook path. The values are approximate context-size estimates only; status includes runtime/source breakdowns, omits per-session details, and is not provider usage/billing tokens, invoices, dashboards, charged costs, or a `ccusage` replacement.

`fooks check` is a narrow read-only operator/check projection over `fooks status activity --include-remote-counts`. It makes the post-merge `main` echo versus active work boundary explicit: when there is no open issue, no open PR, and no mapped fooks tmux session, the JSON returns `verdict: "idleRequiresActiveArtifact"` and `requiredActiveArtifact.required: true` instead of inventing active work from a successful main CI/release echo. Detached fooks PR review worktree leftovers such as `fooks-pr-727-review` and `fooks-pr-728-review` are reported as non-active cleanup-review noise when they have no mapped session or open PR; this receipt remains read-only and does not delete, push, or mutate local-only commits.

`fooks status activity` is a compact read-only dogfood operator snapshot. It preserves the existing bare status, worktree, and artifacts contracts, reports current local worktree branch/divergence and dirty-path delta, lists fooks-like tmux sessions when available, and includes bounded `currentRunEvidence` plus `legacyWorktreeEvidence`. `currentRunEvidence` is the current-run reminder artifact for clean post-merge main echoes: when the branch is `main`, the worktree is clean, local divergence is zero, fooks-like tmux sessions are zero, and opt-in remote issue/PR counts are both zero, it classifies the snapshot as `mainEchoNonActive` instead of active fooks development. `legacyWorktreeEvidence` is projected from `status artifacts` `staleClosedArtifactWorktrees`; it reports counts plus a capped list of old closed-artifact worktrees with local branch-archive evidence and no mapped tmux pane, sets `cleanupCommandsIncluded: false`, and does not include runtime cleanup order or cleanup commands. It does not call GitHub by default; pass `--include-remote-counts` to opt in to non-blocking `gh` open issue/PR counts.

`fooks status artifacts` is a read-only dogfood cleanup audit for local fooks artifacts after PRs merge. It inspects local git worktrees/branches and tmux panes, scopes results to fooks-like names or `.omx-worktrees` paths, and uses conservative labels such as `activeOrUnknown`, `likelyMerged`, `missingPath`, and `candidateCleanup`. The JSON also includes `staleClosedArtifactWorktrees` for existing non-current worktrees whose branch has exact local branch-archive evidence and no mapped tmux pane, so nudges can distinguish old closed-artifact worktrees from active OMX work without deleting anything. The command does not run `git fetch`, `git worktree prune`, `git worktree remove`, `git branch -d`, or `tmux kill-session`; any `manualCleanupCommands` in the JSON are copy/paste suggestions only. Missing worktree paths only suggest `git worktree prune --dry-run` so operators can inspect before deciding whether to run cleanup manually. When tmux panes are still attached to deleted worktree paths, the JSON also includes `staleRuntimeCleanups` with the manual order: verify inactivity, stop the tmux/OMX/Codex session, then run any git worktree prune/remove follow-up. Verify the PR is merged and the session/worktree is inactive before copying any command.

## opencode support

opencode support is **manual/semi-automatic** today. It does not intercept opencode `read` calls and does not claim automatic runtime-token savings.

`fooks setup` installs the project-local opencode bridge when the project has a supported `.tsx` / `.jsx` component. You can also install or repair just that bridge from the project root:

```bash
fooks install opencode-tool
```

This creates two project-local opencode artifacts:

```text
.opencode/tools/fooks_extract.ts
.opencode/commands/fooks-extract.md
```

Use `/fooks-extract path/to/File.tsx` or ask opencode to call `fooks_extract` when you want a fooks model-facing payload for a `.tsx` or `.jsx` file. This bridge steers tool selection; it does **not** intercept opencode `read` calls.

## Support boundaries

| Environment | Current support | Runtime-token claim |
| --- | --- | --- |
| Codex | Automatic repeated-file hook path through `fooks setup` | Model-facing context and estimate-scoped benchmark evidence only; no stable runtime-token or billing-grade claim |
| Claude | Project-local context hooks for `SessionStart` / `UserPromptSubmit`; the first eligible explicit frontend-file prompt is recorded/prepared, and a repeated same-file prompt may receive bounded context; manual/shared handoff fallback prepared by `fooks setup` when possible | No `Read` interception and no automatic runtime-token savings claim |
| opencode | Manual/semi-automatic project-local tool and slash command prepared by `fooks setup` when possible | No read interception and no automatic runtime-token savings claim |

`fooks` is not a universal file-read interceptor. Non-frontend files usually fall back to normal source reading.

## Troubleshooting

If setup does not report ready:

```bash
fooks setup
fooks doctor
fooks doctor codex
fooks status codex
fooks status claude
fooks status cache
fooks inspect react-web-issues src/components/Form.tsx
fooks status artifacts
```

`fooks doctor` is the safest first diagnostic after setup because it is read-only and summarizes local setup artifacts, missing hook events, manifests, adapter files, trust status, cache health, and supported source-file presence. Focused `fooks doctor claude` also reports the optional TypeScript language server as a warning-only host-tooling hint. It does not prove live provider health; it is not a ccusage replacement and not provider usage/billing-token telemetry, invoices, dashboards, or charged costs.

Common causes:

- You are not in a project with supported `.tsx` / `.jsx` files, and you also do not have a strong Codex-only `.ts` / `.js` beta candidate.
- Another global `fooks` binary is earlier in your PATH.
- `~/.codex/hooks.json` is invalid JSON or not writable.
- Your Codex runtime home is missing or not writable; use `FOOKS_CODEX_HOME` for an isolated smoke test.

More setup details: [`docs/setup.md`](docs/setup.md)

## Development

```bash
npm install
npm test
```

Useful public docs:

- Architecture boundaries for source facts, evidence gates, and reporting-vs-authorization separation: [`docs/architecture-boundaries.md`](docs/architecture-boundaries.md)
- React Web first-minute work-order flow for human maintainers and agent/tool `--summary-json` handoffs: [`docs/react-web-first-minute-work-orders.md`](docs/react-web-first-minute-work-orders.md)
- Setup details: [`docs/setup.md`](docs/setup.md)
- opencode support boundary: [`docs/opencode-read-interception.md`](docs/opencode-read-interception.md)
- Release checklist: [`docs/release.md`](docs/release.md)
- Roadmap / future evidence lanes: [`docs/roadmap.md`](docs/roadmap.md)
- Development principles: [`docs/development-principles.md`](docs/development-principles.md)
- Benchmark evidence and claim boundaries: https://github.com/minislively/fooks/blob/main/docs/benchmark-evidence.md

Benchmark harness internals and generated reports live in the source repository, but are intentionally not part of the npm package payload.
