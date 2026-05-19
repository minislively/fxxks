# Cleanup deletion policy

This policy is the reusable rule for cleanup PRs that propose deleting tracked
files from this repository. It is intentionally narrow: README wording cleanup,
section trimming, summary-and-link consolidation, or report copy edits do not
need this deletion gate unless they remove tracked files.

## Default stance

Do not delete tracked source, test, script, fixture, benchmark, report, archive,
or legacy documentation files unless the PR includes reviewer-readable evidence
that the file is unused, superseded, safe to remove, and easy to restore if the
assessment is wrong.

Prefer the runtime-first documentation pattern from the current product docs:
keep the source of truth, shorten the entry-point copy, and link to detailed
evidence instead of deleting historical or benchmark material just because the
README no longer expands it inline.

Every deletion proposal must name the risk class, attach the required evidence,
and state the rollback path before the file is removed.

## What this policy does not require

These cleanup changes do not need a file-deletion evidence packet:

- trimming duplicated README prose while preserving links to retained docs;
- moving detailed claims from entry-point copy into an existing source-of-truth
  document;
- replacing expanded report examples with a compact summary plus link;
- editing stale wording in a retained document without removing the document;
- removing ignored local runtime output, caches, or generated scratch files that
  are already outside git.

If a PR deletes a tracked file, this policy applies even when the file looks
obviously stale.

## Risk classes

| Class | Applies to | Deletion rule |
| --- | --- | --- |
| Low-risk generated/runtime | Ignored build output, temporary runtime state, cache artifacts, local logs, and regenerated evidence products that are not source-of-truth inputs. | May be removed when the PR proves the file is generated or runtime-only, names the generator or owner, and confirms no tracked source/test/script/fixture path depends on it. |
| Medium-risk tracked docs | Tracked documentation that appears stale, duplicated, branch-archive-only, or superseded by newer docs. | Do not delete solely because it looks old or because entry-point docs were shortened. Require reference checks, a supersession note, and reviewer-readable rationale showing the retained document now carries the needed history or guidance. |
| High-risk protected files | Anything under `src/`, `test/`, `scripts/`, `fixtures/`, benchmark fixtures, package/config files, release gates, or files consumed by CI, docs tests, examples, or validation scripts. | Treat deletion as blocked unless the PR proves there are no references, no behavioral or fixture coverage loss, an explicit replacement or deprecation path exists, and validation commands pass after the removal. |

## Evidence required before deleting tracked files

### 1. Reference checks

Run bounded reference checks and record the commands or search surfaces used. At
minimum, check for:

- direct path references, imports, CLI invocations, fixture names, and doc links;
- package scripts, CI workflows, release scripts, benchmark runners, and test
  fixtures that may load paths dynamically;
- README, docs, dogfood reports, and archive pages that preserve historical
  context.

If dynamic loading makes a negative result uncertain, keep the file or add a
narrower audit note instead of deleting it.

### 2. Supersession documentation

For medium-risk docs and any high-risk protected file, identify the replacement
source of truth before deletion. The PR should state one of:

- the newer document, source file, fixture, or script that fully supersedes it;
- the reason the content is obsolete and no longer needs a replacement;
- the retained archive or audit record that preserves the historical decision.

A cleanup PR must not delete legacy documentation merely because another PR is
auditing it. Link to the audit finding from the PR discussion instead of editing
an unrelated audit opportunistically.

### 3. Validation commands

Deletion evidence must include commands that prove the removal did not break the
relevant surface. Choose commands proportional to the risk class:

- low-risk generated/runtime: targeted regeneration or clean/build check when a
  generator exists;
- medium-risk tracked docs: docs link/check commands if available plus the
  project build when the docs participate in packaging or release evidence;
- high-risk protected files: at least the project build and the affected tests,
  benchmarks, release smoke, or script-specific validation that would have loaded
  the removed file.

For this repository, `npm run build` is the baseline validation command for a
cleanup deletion unless the PR explains why the file is docs-only and an even
narrower docs check is sufficient.

### 4. Rollback expectations

Every deletion PR must make rollback cheap:

- delete files in small, reviewable groups by risk class;
- keep evidence in the PR body or a durable audit document;
- avoid mixing deletion with unrelated rewrites or product behavior changes;
- document the exact file path and restoration source, such as the previous
  commit, superseding file, or generated command;
- if validation later reveals a hidden dependency, restore first and re-open the
  deletion only after new evidence closes the gap.

## Protected-file gate

The following paths are protected by default and require high-risk evidence
before deletion:

- `src/**`
- `test/**`
- `scripts/**`
- `fixtures/**`
- benchmark fixtures and validators
- package, TypeScript, CI, release, and hook configuration files

When in doubt, classify the file as high-risk and keep it until a focused audit
proves otherwise.

## Relationship to cleanup audits

Audit documents may list specific candidate files and the evidence gathered for
one cleanup effort. This policy is the reusable rule that future cleanup PRs
should apply before acting on any audit entry.

Policy-only edits should stay independent from instance audits unless the user
explicitly asks to update both surfaces in the same PR.
