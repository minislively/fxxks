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
| Codex | Automatic repeated-file hook path through `fooks setup` | Universal file-read interception |
| Claude | Manual/shared handoff unless a Claude-native installer exists | Automatic runtime-token savings |
| opencode | Manual/semi-automatic custom tool and slash command | Read interception or automatic runtime-token savings |

Benchmark and language evidence for this boundary must be checked against:

- `benchmarks/frontend-harness/README.md` — current frontend harness methodology and prepared-context/proxy estimates.
- `benchmarks/layer2-frontend-task/STATUS.md` — canonical Layer 2 state.
- `benchmarks/layer2-frontend-task/API_ACCESS_BLOCKER.md` — gateway blocker analysis.
- `docs/language-core-strategy.md` — Python harness benchmark-only and native-core non-goal constraints.

Prepared-context or proxy estimates must not be worded as measured runtime-token billing savings. Layer 2 real-runtime benchmark results do not exist while the external Codex→layofflabs gateway 502 blocker remains active.

A user who already has another global `fooks` binary may see command conflicts. Ask them to inspect their global npm binaries before installing or reinstall into a clean prefix when debugging:

```bash
which fooks
npm prefix -g
npm ls -g --depth=0 | grep -E 'fooks|oh-my-fooks'
```

## Pre-publish blockers

Do not run `npm publish` without explicit approval after this checklist is reviewed.

Before any real publish, confirm:

- [ ] `npm view oh-my-fooks` still confirms the name/state expected for release.
- [ ] `npm whoami` shows the intended publishing account.
- [ ] package version and Git tag strategy are decided.
- [ ] license decision is explicit and reflected in package metadata if required.
- [ ] package/CLI boundary is documented: `oh-my-fooks` installs `fooks`.
- [ ] possible pre-existing global `fooks` binary conflict is documented.
- [ ] no install, pack, publish, or version lifecycle script mutates user machines or publishes implicitly.
- [ ] packed tarball includes `dist/cli/index.js`, `dist/index.js`, `README.md`, `package.json`, and linked docs.
- [ ] temp-prefix global install smoke test passes.
- [ ] isolated `fooks setup` smoke test passes without mutating the real user Codex config.

## Verification commands

Use the current `package.json` scripts as the source of truth. For a release-readiness docs PR, run the normal local gates first:

```bash
npm run lint
npm test
npm run bench:gate
```

`bench:gate` is a local benchmark gate; it is not the blocked external Layer 2 live benchmark.

For an actual package publication review, also run the pack/install checks below before discussing publication:

```bash
npm pack --dry-run --json > /tmp/oh-my-fooks-pack.json
rm -rf /tmp/fooks-pack
mkdir -p /tmp/fooks-pack
npm pack --pack-destination /tmp/fooks-pack
```

Then install the produced tarball into a temporary global prefix and verify the packed CLI path:

```bash
TMP_PREFIX=$(mktemp -d)
TARBALL=$(ls /tmp/fooks-pack/oh-my-fooks-*.tgz | tail -n 1)
npm install -g --prefix "$TMP_PREFIX" "$TARBALL"
"$TMP_PREFIX/bin/fooks" status cache
```

Finally, verify setup command routing from a disposable React/TSX-style project with isolated runtime homes:

```bash
TMP_HOME=$(mktemp -d)
TMP_PROJECT=$(mktemp -d)
mkdir -p "$TMP_HOME/codex" "$TMP_PROJECT/src"
printf '{"scripts":{}}\n' > "$TMP_PROJECT/package.json"
printf 'export function App(){ return <main>Hello</main>; }\n' > "$TMP_PROJECT/src/App.tsx"
(
  cd "$TMP_PROJECT"
  HOME="$TMP_HOME/home" \
  XDG_CONFIG_HOME="$TMP_HOME/config" \
  FOOKS_CODEX_HOME="$TMP_HOME/codex" \
  FOOKS_ACTIVE_ACCOUNT=<your-github-org> \
  FOOKS_TARGET_ACCOUNT=<your-github-org> \
  "$TMP_PREFIX/bin/fooks" setup
)
```

The release-prep PR must state that `npm publish` was not run.
