# Release readiness snapshot

Date: 2026-04-25 UTC
Branch: `chore/release-readiness-20260425-0000`
Package: `fxxk-frontned-hooks`
Installed CLI: `fooks`

This snapshot records the current pre-public release posture after the #172 LSP boundary cleanup and the separate #174 rejection/cleanup pass. It is intentionally evidence-scoped: it records local checks and remaining authority gates, not a publication decision.

## Inputs inspected

- `README.md` — public package/CLI naming, installation path, supported surface, and claim boundaries.
- `package.json` — package metadata, `bin` mapping, `files` allowlist, and npm scripts.
- `docs/release-note-v0.1.0.md` — release-note wording and conservative evidence boundary.
- `docs/release.md` — public release checklist, residual risks, pre-publish blockers, and verification commands.

## Current package and CLI boundary

- The npm package is `fxxk-frontned-hooks`.
- The installed command is `fooks`, via `package.json` `bin.fooks = "dist/cli/index.js"`.
- Public install examples should continue to use `npm install -g fxxk-frontned-hooks`, not `npm install -g fooks`.
- `fooks setup` remains explicit; installing the package alone must not be described as automatically activating project hooks.

## Local verification on 2026-04-25 UTC

Dependencies were not present in this worktree at first, so `npm install` was run before release verification.

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `npm run release:smoke` | Passed | Local build, pack/install, isolated setup, hook smoke, doctor, status, and compare smoke evidence only. |
| `npm pack --dry-run` | Passed | Dry-run package contents for `fxxk-frontned-hooks@0.1.3`; no publish performed. |

Observed `release:smoke` summary:

- Package under test: `fxxk-frontned-hooks@0.1.3`.
- Temporary installed binary: `fooks`.
- Setup summary: `codex:automatic-ready:ready`, `claude:context-hook-ready:ready`, `opencode:tool-ready:ready`.
- Doctor summary: 11 pass, 0 warn, 0 fail.
- Compare smoke remained local estimated context-size telemetry; it is not provider billing tokens, provider costs, or a `ccusage` replacement.

Observed `npm pack --dry-run` summary:

- Tarball name: `fxxk-frontned-hooks-0.1.3.tgz`.
- Total files: 147.
- Package size: 147.1 kB.
- Unpacked size: 714.1 kB.
- The current `package.json` `files` allowlist was left unchanged; this snapshot is a repository readiness note and is not being added to the package payload by this change.

## Still not done / authority-gated

The following remain unresolved until a human-approved publish step:

- `npm publish` was not run.
- `npm view fxxk-frontned-hooks` was not run as a release authority check in this docs-only PR.
- `npm whoami` was not run; publisher identity was not asserted.
- Package version and Git tag strategy still need an explicit release decision.
- Any real publication remains blocked until the release checklist in `docs/release.md` is reviewed and approved.

## Claim boundaries to preserve

- Do not claim stable runtime-token, latency, provider billing-token, invoice, or actual charged-cost savings from the local smoke results above.
- Keep Codex wording scoped to supported repeated-file hook behavior through `fooks setup`.
- Keep Claude wording scoped to project-local `SessionStart` / `UserPromptSubmit` context hooks; do not claim Claude `Read` interception.
- Keep opencode wording scoped to the prepared tool/slash-command bridge; do not claim automatic `read` interception or automatic runtime-token savings.
