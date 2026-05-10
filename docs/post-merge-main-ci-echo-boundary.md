# Post-merge main CI echo boundary

This is a read-only dogfood operator artifact for post-merge `main` CI and
React Web release-report success echoes. Its purpose is to keep an arriving
success notification from being mistaken for new active dogfood work.

## Operator rule

Treat a post-merge `main` CI or release-report success as verification-only
when the available surfaces all point at the already-merged `main` state and no
current work signal is present. Record the echo as evidence, but do not start a
new recovery, cleanup, or implementation lane from the success echo alone.

## Evidence surfaces

- `fooks status activity --include-remote-counts --json` exposes
  `currentRunEvidence`. The non-active echo case is only
  `classification: "mainEchoNonActive"` with `mainEchoEvidence: true` and
  `activeWorkEvidence: false`.
- `currentRunEvidence` is intentionally narrow: it requires branch `main`, a
  clean worktree, zero local tracking divergence, zero fooks-like tmux sessions,
  and opt-in GitHub open issue/PR counts of zero. If any proof is missing or a
  work signal exists, it remains `activeOrUnknown`.
- `npm run --silent ci:alerts -- --alerts <file> --branch main --json` marks a
  current completed `main` success as `verdict: "current-main-echo"`,
  `echo: true`, and `disposition: "verification-only"`.
- `npm run evidence:react-web-release-report` produces an advisory release
  report. A successful report is a release-facing evidence summary, not a new
  active dogfood assignment.

## Non-goals and boundaries

This artifact does not change runtime/provider behavior, merge-gate policy,
detector scope, React Web behavior, React Native behavior, TUI behavior, or
WebView behavior. It makes no performance, product, billing, provider-cost, runtime-token, or
broad-support claim.

Use this artifact only as an operator/check/reminder boundary. It is not cleanup authority and it does not prove that unrelated branches,
issues, or worktrees are inactive.
