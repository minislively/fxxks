# Public release checklist

This checklist prepares `fooks` for public npm distribution without publishing it by accident.

## Package and CLI boundary

- npm package name: `oh-my-fooks`
- installed CLI command: `fooks`
- install command: `npm install -g oh-my-fooks`
- first setup command: `fooks setup`

The npm package name intentionally differs from the CLI command because the unscoped npm package `fooks` is already occupied by another owner. Public docs must not tell users to globally install the occupied `fooks` npm package unless that ownership situation changes and a new release plan is approved.

## Public support and evidence boundary

Before a public release, keep the public claim surface aligned to this matrix:

| Environment | Release-ready wording | Do not claim |
| --- | --- | --- |
| Codex | Automatic repeated-file hook path through `fooks setup`; prepared-context/proxy evidence only | Universal file-read interception or measured runtime-token savings without Codex telemetry |
| Claude | Project-local context hooks for `SessionStart` / `UserPromptSubmit`; the first eligible explicit frontend-file prompt is recorded/prepared and a repeated same-file prompt may receive bounded context; manual/shared handoff fallback prepared by `fooks setup` when possible | `Read` interception, full prompt interception parity, or runtime-token savings |
| opencode | Manual/semi-automatic custom tool and slash command prepared by `fooks setup` when possible | Read interception or automatic runtime-token savings |

The opencode boundary is intentional. The current bridge may steer users toward
`fooks_extract`, but it must not be described as automatic `read` interception.
A future project-local `read` shadow would need to preserve opencode's native
read behavior for directories, offset/limit ranges, binary/image/PDF handling,
permissions, and metadata before it could support an automatic savings claim.
Keep [`docs/opencode-read-interception.md`](opencode-read-interception.md)
aligned with any future change to this boundary.

Benchmark and language evidence for this boundary must be checked against:

- [`benchmarks/frontend-harness/README.md`](https://github.com/minislively/fooks/blob/main/benchmarks/frontend-harness/README.md) — current frontend harness methodology and prepared-context/proxy estimates.
- [`benchmarks/layer2-frontend-task/STATUS.md`](https://github.com/minislively/fooks/blob/main/benchmarks/layer2-frontend-task/STATUS.md) — canonical Layer 2 state.
- [`benchmarks/layer2-frontend-task/API_ACCESS_BLOCKER.md`](https://github.com/minislively/fooks/blob/main/benchmarks/layer2-frontend-task/API_ACCESS_BLOCKER.md) — gateway blocker analysis.
- `docs/language-core-strategy.md` — Python harness benchmark-only and native-core non-goal constraints.

Prepared-context or proxy estimates must not be worded as measured runtime-token
billing savings. The direct-Codex Formbricks N=3 follow-up in
[`benchmarks/frontend-harness/reports/round1-risk-followup-1776327829.md`](https://github.com/minislively/fooks/blob/main/benchmarks/frontend-harness/reports/round1-risk-followup-1776327829.md) is
also not a win claim: fooks used more runtime tokens in 3/6 pairs and median
runtime-token reduction was -5.35%. Public wording may say fooks has
context-compression mechanics and targeted-file behavior, but must not claim
stable direct runtime-token/time wins until a future multi-task benchmark class
proves them.

Bare `fooks status` reports local estimated context-size telemetry from `.fooks/sessions`, including runtime/source breakdowns for Codex automatic hooks and Claude project-local context hooks. Its CLI output omits per-session details, is for maintainer/user inspection only, and must not be treated as provider billing tokens, provider costs, or a `ccusage` replacement.

Codex setup/attach/status readiness is also local state only. It may show that
Codex hooks, manifests, and trust metadata were prepared, but it is not live
Codex runtime telemetry and must not be described as proof of runtime-token
savings.

Layer 2 now has proposal-only R4 paired smokes, an applied-code acceptance gate,
and a pre-launch repeated applied diagnostic. The 2026-04-22 repeated diagnostic
attempted seven matched vanilla/fooks pairs and accepted four; it is classified
`insufficient-accepted-pairs`. Accepted pairs preserved the prepared-prompt
compression signal (median 88.2% smaller prompt) but showed negative CLI
runtime/time signal (median runtime-token reduction -25.5%; median latency
reduction -14.4%). This is not provider billing telemetry, not an applied-code
benchmark win, and not enough for stable runtime-token/time win claims.

A user who already has another global `fooks` binary may see command conflicts. Ask them to inspect their global npm binaries before installing or reinstall into a clean prefix when debugging:

```bash
which fooks
npm prefix -g
npm ls -g --depth=0 | grep -E 'fooks|oh-my-fooks'
```

## Residual risk disposition

| Risk | Current disposition | Release implication |
| --- | --- | --- |
| `npm publish` not run | Keep unresolved until explicit human approval; use `npm run release:smoke` and `npm publish --dry-run` only for proof. | Blocks real publication, not docs/code PR merge. |
| Layer 2 stable applied-code / multi-task evidence absent | Applied repeated diagnostic exists but accepted only 4/7 pairs and regressed on CLI runtime/time medians. Multi-task evidence still does not exist. | Blocks stable Layer 2 runtime-token/time win claims and applied-code benchmark-win wording. |
| Direct-Codex runtime-token regression | Negative/unstable Formbricks evidence is documented and linked. | Blocks stable runtime-token/time win claims. |
| Local `fooks status` estimates | Bare status is documented as local context-size telemetry only. | Blocks billing-token, provider-cost, or `ccusage` replacement wording. |
| Claude/opencode automatic savings | Claude now has bounded project-local context hooks that record/prepare the first eligible frontend-file prompt, then add repeated same-file context, but no measured runtime-token savings and no `Read` interception. opencode remains a manual/semi-automatic tool bridge. | Keep Claude context-hook wording and opencode tool wording only. |

## Pre-publish blockers

Do not run `npm publish` without explicit approval after this checklist is reviewed.

Automated local checks now covered by `npm run release:smoke`:

- [x] package/CLI boundary is documented: `oh-my-fooks` installs `fooks`.
- [x] possible pre-existing global `fooks` binary conflict is documented.
- [x] no install, pack, publish, or version lifecycle script mutates user machines or publishes implicitly.
- [x] packed tarball includes `dist/cli/index.js`, `dist/index.js`, `README.md`, `package.json`, and the npm-package public docs allowlist.
- [x] packed tarball excludes internal notes, benchmark corpora/results, and planning archives.
- [x] package source and built `dist/` are generated from tracked source before pack/smoke verification.
- [x] temp-prefix global install smoke test passes.
- [x] isolated `fooks setup` smoke test passes without mutating the real user Codex config.
- [x] isolated `fooks setup` smoke test covers a fresh public-style repo without requiring `FOOKS_ACTIVE_ACCOUNT`.

Authority-gated checks before any real publish:

- [ ] `npm view oh-my-fooks` still confirms the name/state expected for release.
- [ ] `npm whoami` shows the intended publishing account.
- [ ] package version and Git tag strategy are decided.
- [ ] license decision is explicit and reflected in package metadata if required.

## Verification commands

Use the current `package.json` scripts as the source of truth. For a release-readiness docs PR, run the normal local gates first:

```bash
npm run lint
npm test
npm run bench:gate
```

`bench:gate` is a local benchmark gate; it is not the blocked external Layer 2 live benchmark.

For an actual package publication review, also run the pack/install checks below before discussing publication. Keep the package `files` allowlist conservative until the final human-approved public-release step; do not add broad public-mode packaging changes just to make unpublished internal docs appear in the tarball:

```bash
npm run release:smoke
npm publish --dry-run
```

`release:smoke` performs the equivalent of the manual checks below:

- `npm pack --dry-run --json`
- tarball required-file assertions
- `npm pack --pack-destination <tmp>`
- temporary-prefix global install
- disposable React/TSX project setup
- isolated `FOOKS_CODEX_HOME` / `FOOKS_CLAUDE_HOME`
- empty `FOOKS_ACTIVE_ACCOUNT` / `FOOKS_TARGET_ACCOUNT`

If you need to debug the smoke manually, install the produced tarball into a temporary global prefix and verify the packed CLI path:

```bash
rm -rf /tmp/fooks-pack
mkdir -p /tmp/fooks-pack
npm pack --pack-destination /tmp/fooks-pack
TMP_PREFIX=$(mktemp -d)
TARBALL=$(ls /tmp/fooks-pack/oh-my-fooks-*.tgz | tail -n 1)
npm install -g --prefix "$TMP_PREFIX" "$TARBALL"
"$TMP_PREFIX/bin/fooks" status cache
```

Finally, verify setup command routing from a disposable React/TSX-style project with isolated runtime homes:

```bash
TMP_HOME=$(mktemp -d)
TMP_PROJECT=$(mktemp -d)
mkdir -p "$TMP_HOME/codex" "$TMP_HOME/claude" "$TMP_PROJECT/src"
printf '{"scripts":{}}\n' > "$TMP_PROJECT/package.json"
printf 'export function App(){ return <main>Hello</main>; }\n' > "$TMP_PROJECT/src/App.tsx"
(
  cd "$TMP_PROJECT"
  HOME="$TMP_HOME/home" \
  XDG_CONFIG_HOME="$TMP_HOME/config" \
  FOOKS_CODEX_HOME="$TMP_HOME/codex" \
  FOOKS_CLAUDE_HOME="$TMP_HOME/claude" \
  FOOKS_ACTIVE_ACCOUNT= \
  FOOKS_TARGET_ACCOUNT= \
  "$TMP_PREFIX/bin/fooks" setup
)
```

Expected shape: top-level `ready: true`, `runtimes.codex.state: "automatic-ready"`, `runtimes.claude.state: "context-hook-ready"` when the Claude home exists and project-local hooks install cleanly, and `runtimes.opencode.state: "tool-ready"`. Claude/opencode blockers are non-fatal and must remain bounded to Claude context-hook/handoff and opencode tool readiness wording.

The release-prep PR must state that `npm publish` was not run.
