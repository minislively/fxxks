# Post-merge main CI echo boundary

This is a read-only dogfood operator artifact for post-merge `main` CI and
React Web release-report success echoes. Its purpose is to keep an arriving
success notification from being mistaken for new active dogfood work.

## Operator rule

Treat a post-merge `main` CI or release-report success as verification-only
when the available surfaces all point at the already-merged `main` state and no
current work signal is present. Record the echo as evidence, but do not start a
new recovery, cleanup, or implementation lane from the success echo alone.

## Durable boundary receipt

A post-merge `main` CI or release-report success is an echo receipt only. It is
not active work evidence unless one of these separate active artifacts is present:
an open issue, an open pull request, a non-`main` active branch/worktree signal,
or a mapped fooks tmux session. Keep the echo receipt and the active artifact
receipt separate in reminders so a successful `main` rerun cannot reopen work by
itself.

## Clean-slate nudge boundary

When the operator snapshot is otherwise clean after merge, dogfood nudges must
name the clean-slate boundary before describing any next work. Distinguish these
receipts explicitly:

- **Active work receipt:** active issue, active branch/session, or active PR
  evidence that can anchor what is being developed.
- **Merged CI echo receipt:** clean `main` CI or release-report success for the
  already-merged head.

If only the merged CI echo receipt remains, the nudge should say that no active
issue/branch/session/PR is currently attached. It may preserve the echo as
verification evidence, but it must not imply that the merged CI echo is itself
an active development artifact.

## Development reminder active-artifact rule

A development reminder must not end as a status-only idle report. After it names
the clean-slate boundary, it must either report a real blocker that prevents
starting bounded work or create/adopt one active artifact that can anchor the
next action: an issue, branch, session, or PR. Blocker and no-blocker reports
must both keep the concrete next action explicit: either the action required to
unblock/create the anchor, or the next development action attached to the
adopted anchor. If none of those artifacts exists, the reminder should say that
it cannot treat the checkout as active development until one is created or
linked; it should not present clean `main` status, green CI, or stale local
worktree inventory as the next development action.

Keep this reminder-anchor rule separate from the `fooks check` required-artifact
contract. Branch-only evidence can be an active work receipt or reminder anchor,
but it does not satisfy `fooks check` `requiredActiveArtifact` by itself; that
operator/check field remains limited to an open GitHub issue, an open GitHub
pull request, or a mapped fooks tmux session.

Legacy local `fooks.omx-worktrees` entries that remain after merges are inventory
or cleanup-review receipts, not active work receipts. When they have local
branch-archive evidence and no mapped tmux pane, `fooks check --json` may surface
them under `activeWorkReceipts.legacyLocalResidueCleanupReview` so dogfood nudges
can see the stale local inventory. That review block keeps
`staleLocalResidueIsActiveWorkEvidence: false` and
`satisfiesActiveArtifactRequirement: false`; it does not satisfy the active
artifact requirement and does not add cleanup commands, runtime cleanup order,
or mutation authority.

## Evidence surfaces

- `fooks check --json` exposes the operator/check projection. The idle case is
  `verdict: "idleRequiresActiveArtifact"` with
  `requiredActiveArtifact.required: true`; `requiredActiveArtifact.dogfoodHandoff`
  must expose `status: "requires-live-artifact"`,
  `requiredBeforeNextDevelopmentAction: true`, and the
  `ci-echo-and-stale-residue-are-not-active-work` evidence boundary. The
  acceptable active artifacts are an open GitHub issue, an open GitHub pull
  request, or a mapped fooks tmux session.
- `fooks status activity --include-remote-counts --json` exposes
  `currentRunEvidence`. The non-active echo case is only
  `classification: "mainEchoNonActive"` with `mainEchoEvidence: true` and
  `activeWorkEvidence: false`.
- `fooks check --json` and `fooks status activity --include-remote-counts
  --json` expose `postMergeMainCiEvidence`, a read-only exact-head summary for
  local `origin/main`. It reports the local `origin/main` head SHA and the
  latest `CI` plus `React Web Release Report` workflow conclusions for that
  exact SHA only. The `mainHeadSource` is the local `origin/main` tracking ref
  with no fetch performed, and `remoteFreshness` is not verified by this
  read-only surface.
- `postMergeMainCiEvidence.summary.allExactHeadConclusionsSuccessful` is true
  only when both exact-head workflow runs completed with `success`. A missing
  exact-head run is `status: "unknown"` and an incomplete exact-head run is
  `status: "pending"`; stale pre-merge successes never satisfy the exact-head
  success summary.
- `currentRunEvidence` is intentionally narrow: it requires branch `main`, a
  clean worktree, zero local tracking divergence, zero fooks-like tmux sessions,
  and opt-in GitHub open issue/PR counts of zero. If any proof is missing or a
  work signal exists, it remains `activeOrUnknown`.
- Legacy local `fooks.omx-worktrees` residue can remain visible in inventory
  after merges, but it is separated from active current-run evidence. Its
  cleanup-review rows are advisory receipts only and require a separate open
  issue, open PR, or mapped fooks tmux session before any nudge treats the
  checkout as active work.
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
