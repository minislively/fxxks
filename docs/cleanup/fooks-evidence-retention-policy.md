# `.fooks/evidence/**` retention policy

- Updated: 2026-05-18T03:20:00Z
- Tracking issue: #946
- Source audit: `docs/cleanup/legacy-file-audit.md`
- Scope: cleanup policy for ignored local `.fooks/evidence/**` artifacts before any destructive evidence cleanup

## Policy boundary

`.fooks/evidence/**` is ignored local evidence, but it is not automatically disposable runtime state. Treat it as potential dogfood/operator proof until a cleanup pass proves otherwise. This policy only sets the retention, archive, and deletion boundary; it does not authorize mass deletion and it does not change product runtime behavior.

Do not delete `.fooks/evidence/**` in broad generated-artifact sweeps. Evidence cleanup must be a separate reviewable pass with explicit artifact inventory, reference checks, linkage checks, validation, and a retained pointer when the evidence still supports a current claim.

## Evidence risk classes

| Class | Examples | Default decision | Allowed cleanup action |
| --- | --- | --- | --- |
| Active proof / current dogfood evidence | Evidence for an open issue, active PR, current worktree/session, recent operator receipt, or still-running dogfood workflow. | Keep in place. | None, except moving with an equivalent current pointer when the owning workflow documents the move. |
| Historical proof still referenced by tests/docs/issues | Evidence named by docs, tests, release notes, issue/PR comments, branch-audit notes, or dogfood closeout receipts. | Keep, or archive with a durable pointer. | Compress/archive only if references are updated or a nearby pointer records the archive location and freshness boundary. |
| Bulky generated duplicate evidence | Repeated output where a smaller canonical artifact, manifest, or published doc already preserves the same provenance and claim boundary. | Archive/compress when provenance is retained. | Replace the bulky duplicate with a compressed archive, manifest entry, or doc pointer that preserves producer command, input scope, timestamp/fingerprint if available, and non-claims. |
| Unreferenced generated scratch | Temporary output from abandoned local experiments with no issue/PR/test/doc linkage and no current operator value. | Eligible for deletion only after proof checks. | Delete only in a narrow cleanup PR that records reference checks, linkage checks, explicit no-current-use decision, and validation commands. |

When an artifact fits more than one class, use the more conservative decision. For example, a bulky artifact referenced by a test or dogfood note is historical proof, not scratch.

## Required proof before deletion

Before deleting any `.fooks/evidence/**` artifact, the cleanup PR must record all of the following in a cleanup note or PR description:

1. **Artifact inventory** — exact paths, sizes, tracked/ignored status, and a short description of what produced them when identifiable.
2. **Reference checks** — searches for the full path, basename, filename stem, issue number, run id, command name, and any title/claim strings inside docs, tests, scripts, source, benchmarks, GitHub workflow files, and cleanup notes. At minimum run targeted `rg`/`git grep` checks plus `git ls-files .fooks/evidence` for tracked-file surprises.
3. **Issue/PR/test/doc linkage check** — search local docs/tests for matching issue or PR numbers and inspect any linked closeout, dogfood, branch-audit, release, benchmark, or evidence-model references. If GitHub links are part of the claim boundary, record the checked issue/PR numbers in the PR.
4. **Replacement archive pointer or explicit no-current-use decision** — either preserve an archive/compressed artifact with a pointer naming its location and provenance, or state why the artifact has no current proof value after the checks above.
5. **Validation commands** — run the repository validation relevant to the cleanup scope. For policy-only or cleanup-only PRs, include `git diff --check HEAD`, `npm run typecheck`, `npm run lint`, and `npm run build`; add focused tests when any docs/tests/scripts reference the evidence being removed.

Deletion proof must be reviewed before the destructive change. If proof is incomplete, keep the evidence or archive it with a pointer instead of deleting it.

## Archive/compress requirements

An archive is acceptable only when it keeps enough provenance for future reviewers to understand the original evidence. Archive pointers should include:

- original path(s) under `.fooks/evidence/**`;
- archive path or external durable location;
- producer command, workflow, or issue/PR context when known;
- timestamp, source fingerprint, manifest id, or run id when present;
- the claim the evidence can still support;
- non-claims and freshness limits from `docs/evidence-model.md`.

Compressed archives should prefer deterministic names that include the issue or evidence lane, for example `fooks-evidence-issue-946-YYYYMMDD.tar.zst`, and should not be committed unless a separate review decides the archive belongs in the repository.

## Current decision for issue #946

This policy PR performs no `.fooks/evidence/**` deletion. The current repository worktree has no `.fooks/` directory to inventory, and the cleanup-audit follow-up is resolved by setting this conservative decision boundary before any future destructive evidence cleanup.
