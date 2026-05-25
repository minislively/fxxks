# fooks

Runtime context layer for AI coding workflows.

This is still frontend change intelligence: `fooks` attaches to supported AI coding runtimes so frontend work can start from current, source-grounded evidence instead of repeated rediscovery. In the strongest current Codex path, fooks records the first eligible React Web `.tsx` / `.jsx` target, then on repeated same-file work may inject a compact, policy-gated context packet when the source fingerprint, domain evidence, and readiness checks still match.

Product hierarchy:

1. **Runtime path first:** Codex hook integration is the primary experience for eligible repeated React Web work; it can provide compact context, edit guidance, and receipts without asking the user to run a report each turn.
2. **CLI as control plane:** `fooks setup`, `doctor`, `inspect`, `compare`, and `status` install, diagnose, reproduce, and prove the same source-intelligence pipeline.
3. **Reports as projections:** `fooks inspect react-web-issues` produces an actionable manual report for supported React Web files, but reports are not always produced by the runtime path and are not patch authority.

First-minute path:

Scenario: a user asks Codex, “implement the `Form.tsx` feature.” fooks should guide the runtime only when the supported file, prompt, freshness, and policy gates allow it:

```text
user request
  -> AI runtime receives the task
  -> fooks hook detects and records the supported React Web file
  -> repeated eligible same-file work triggers source inspection and policy checks
  -> compact context / guidance / evidence may be attached to the runtime
  -> AI reopens or reruns against current source if freshness no longer matches
  -> AI keeps the user's feature scope, then edits and verifies normally
```

Treat any fooks handoff as advisory context: it tells the agent where to inspect first, what not to assume, and when a human decision is still needed. It is not auto-fix, not auto-apply, not codemod authority, and not permission to turn a feature request into a broad accessibility audit. Unsupported or ambiguous frontend lanes should fall back to normal source reading rather than a compact fooks payload.

Use the CLI control plane to activate and reproduce the runtime pipeline on a supported React Web file:

```bash
npm install -g fxxk-frontend-hooks
cd your-supported-project
fooks setup
fooks doctor
fooks inspect react-web-issues src/components/Form.tsx
```

The manual issue-card report is read-only and actionable, but not patch authority: high-confidence findings can include safe preview shape hints, while ambiguous cases stay as manual-review cards with stop reasons. For card examples, including `react-web.missing-htmlFor-target`, `react-web.duplicate-literal-id`, and `react-web.conflicting-label-association`, and the detailed `--summary-json` / `--dry-run-json` handoff contract, see [`docs/demo/react-web-issues.md`](docs/demo/react-web-issues.md) and [`docs/react-web-first-minute-work-orders.md`](docs/react-web-first-minute-work-orders.md).

Context reduction and caching are supporting mechanisms. `fooks compare` shows local source-vs-payload evidence for one supported file, and `fooks inspect react-web-issues` reproduces the report projection when you need to debug or hand off the same source facts explicitly.

Then open Codex in that repo and work normally with the current source open. Supporting local proof commands are:

```bash
fooks inspect react-web-issues src/components/Form.tsx --summary-json
fooks inspect react-web-issues src/components/Form.tsx --dry-run-json
fooks compare src/components/Button.tsx
```

Best fit: React Web `.tsx` / `.jsx` work where source-derived form and accessibility facts can reduce frontend change risk before feature work, migrations, refactors, or tests. Experimental Codex-first `.ts` / `.js` same-file reuse remains narrow and signal-gated. React Native/WebView, TUI / React CLI promotion, Vue/SFC, broad TS/JS coverage, multi-file refactors, read interception, LSP semantics, and Claude/opencode parity remain roadmap or boundary lanes, not current support.

- Public npm package: `fxxk-frontend-hooks`
- CLI command: `fooks`

## 30-second version

Use fooks when you want supported AI coding runtime work to start with compact, source-grounded frontend context instead of rediscovering React Web facts from scratch.

1. **Attach at runtime:** after `fooks setup`, the Codex hook path can record eligible targets and inject compact context for repeated same-file work when policy gates pass.
2. **Keep CLI as control plane:** `fooks inspect react-web-issues <file>` manually reproduces narrow native JSX label/control findings and tells the agent where to look before editing.
3. **Handoff safely:** `--summary-json` gives agents `firstMinuteSummary.items[0]`, `decision`, `humanDecisionNeeded`, and `doNotDo` boundaries as advisory input rather than edit authority.
4. **Preview only when safe:** `--dry-run-json` lists migration candidates and preview availability, but remains dry-run-only with `autoApply: false` and human review for final label/name choices.
5. **Prove narrowly:** `fooks compare` and local status surfaces provide estimate-scoped evidence, not provider invoice, billing-token, stable runtime-token, or Claude/opencode automatic-savings proof.

See the example source, command output, summary handoff, and dry-run boundary in [`docs/demo/react-web-issues.md`](docs/demo/react-web-issues.md).

## Quick start and local proof

The shortest activation/proof loop is: install the CLI, activate the current repo with `fooks setup`, check readiness with `fooks doctor`, then use Codex normally on supported repeated React Web work. Use `fooks inspect react-web-issues <supported-file>` when you need a reproducible manual report projection, `--summary-json` for advisory inspect-first input rather than edit authority, `--dry-run-json` for read-only migration candidates, and `fooks compare <supported-file>` for supporting one-file source-vs-payload evidence.

`fooks doctor` is the read-only health check for setup/hook readiness. From a source checkout or freshly cloned project, an `unhealthy` result before `fooks setup` usually means the project-local adapter/runtime manifests have not been activated yet; run `fooks setup`, then rerun `fooks doctor`.

### First-run checklist

1. Install the package: `npm install -g fxxk-frontend-hooks`.
2. Confirm the command resolves to the package you expect: `which fooks` and `fooks --help`.
3. Activate only the repo you are inside: `fooks setup`. The default output should be a short `ready`, `partial`, or `blocked` summary, not a debug JSON wall.
4. Diagnose and reproduce locally: `fooks doctor` for readiness, `fooks inspect react-web-issues <file>` for the first reproducible React Web form/accessibility report, `fooks status` for local estimated session telemetry, `fooks status artifacts` for a read-only fooks tmux/worktree/branch audit, and `fooks compare <file>` for supporting one-file payload proof; add `--json` only when you need exact local byte counts, exclusions, and claim boundary text.
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
| `fooks status activity` | current project + local git/tmux inspection | Compact read-only operator snapshot for dogfood nudges, including bounded current-run and stale closed-artifact worktree evidence; default clean-main/no-session output surfaces `operatorStatusCues.remoteCountsRequiredNextAction` so operators know to run `fooks status activity --include-remote-counts --json` or `fooks check --json`, then create/link a concrete child issue/PR/branch/session/worktree-process/blocker if only #960 remains. Remote issue/PR counts still require explicit `--include-remote-counts` on `status activity`; `fooks check` does not accept that flag and uses `--json` for the operator/check source-of-truth projection. Including remote counts on `status activity` also surfaces the read-only next-child evidence cue derived from `fooks check` when the clean epic-only #960 queue needs a concrete child issue/PR/branch/session/worktree-process/blocker anchor. |
| `fooks status activity --receipt-json` | current project + local git/tmux inspection | Projects only the bounded current-run receipt from `fooks status activity`; read-only/advisory and never creates active work by itself. |

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
- Corrected Codex OAuth provider-cost benchmark lanes include estimate-scoped reductions for a small fixture lane plus larger Next.js and Tailwind public-code profiles, under explicit pricing assumptions and accepted-pair gates.
- These provider-cost benchmark lanes are **estimated API cost under explicit pricing assumptions**. They do not prove provider invoice/dashboard savings, actual charged-cost savings, provider usage/billing-token outcomes, stable runtime-token savings, or stable wall-clock/latency savings.
- Direct runtime-token/time evidence remains unstable or negative in some diagnostics, so fooks does not claim stable runtime-token, wall-clock, or latency wins.

Detailed benchmark tables, task medians, OMX command-surface diagnostics, and current claim boundaries are maintained in [`docs/benchmark-evidence.md`](docs/benchmark-evidence.md). The benchmark evidence is not provider invoice/dashboard proof, not actual charged-cost proof, not provider usage/billing-token proof, and not a Claude or opencode automatic savings claim.

## Common questions

Most scope answers are covered by the support tables above. The high-risk boundaries are:

- Provider benchmarks are estimate-scoped evidence, not provider invoice, dashboard, actual charged-cost, billing-grade, or stable runtime-token proof.
- Claude support is not Codex parity: it uses project-local context hooks and handoff artifacts, not `Read` interception.
- opencode support is manual/semi-automatic through `fooks_extract` and `/fooks-extract`, not automatic `read` interception.
- The strongest file path remains repeated same-file React `.tsx` / `.jsx` work in Codex; React Native, embedded WebView, Vue/SFC, unsupported TS/JS, and unsafe cases fall back to normal source reading.

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
fooks status activity --receipt-json  # current-run receipt projection only; read-only/advisory
fooks inspect react-web-issues src/components/Form.tsx  # actionable read-only React Web issue report
fooks compare src/components/Button.tsx --json  # local original-vs-fooks payload estimate
```

For manual inspection:

```bash
fooks extract src/components/Button.tsx --model-payload
fooks scan
```

`fooks status`, `fooks check`, `fooks status activity`, and `fooks status artifacts` are read-only local/operator projections. They report setup, local estimate, activity, branch/worktree/tmux, and artifact evidence without deleting worktrees, pruning branches, proving provider billing, or replacing `ccusage`. Default `fooks status activity --json` includes `operatorStatusCues.remoteCountsRequiredNextAction`, an advisory/non-authorizing next-action cue for clean-main/no-session snapshots where remote issue/PR counts are disabled: run `fooks status activity --include-remote-counts --json` or `fooks check --json`, then create/link a concrete child issue, PR, non-main branch, mapped fooks session, active worktree/process evidence, or blocker if only #960 remains. `--include-remote-counts` belongs to `fooks status activity`; do not add it to `fooks check`. Use `fooks check --json` for the operator/check source-of-truth projection. `fooks status activity --include-remote-counts --json` includes `operatorStatusCues.nextChildEvidence`, a read-only cue derived from `fooks check`'s `activeWorkReceipts.nextChildEvidenceBoundary`; the operator-check JSON boundary remains the source of truth and the cue adds no authority. `fooks status activity --receipt-json` narrows `status activity` to the current-run receipt projection only; it is advisory, read-only, and does not create active work by itself. Source-checkout dogfood operators should prefer the repo npm aliases (`npm run -s check -- --json`, `npm run -s status:activity -- --json`, `npm run -s status:activity -- --receipt-json`) when they need built-from-source receipts. Those aliases build first and then run the read-only operator command, so source-checkout handoffs should cite the aliases instead of sending maintainers to `docs/setup.md` or a direct `dist/cli/index.js` path.

## opencode support

opencode support is **manual/semi-automatic** today. `fooks setup` can prepare the project-local `fooks_extract` tool and `/fooks-extract` slash command for supported `.tsx` / `.jsx` files, or you can repair that bridge with `fooks install opencode-tool`. Use `/fooks-extract path/to/File.tsx` or ask opencode to call `fooks_extract` when you want a fooks model-facing payload; this steers explicit tool use and does **not** intercept opencode `read` calls or claim automatic runtime-token savings. See [`docs/opencode-read-interception.md`](docs/opencode-read-interception.md) for the boundary.

## Support boundaries

The canonical support matrix is the runtime table above. In short: Codex has the strongest automatic repeated-file path; Claude uses project-local context hooks and handoff artifacts without `Read` interception; opencode uses explicit project-local tools without built-in `read` interception. `fooks` is not a universal file-read interceptor, and unsupported or unsafe frontend lanes fall back to normal source reading.

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
