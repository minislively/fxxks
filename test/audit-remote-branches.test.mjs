import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const auditScript = path.join(repoRoot, "scripts", "audit-remote-branches.mjs");

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, { mode: 0o755 });
}

test("remote branch audit handles ignored fetch stdout", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-branch-audit-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });

  writeExecutable(path.join(binDir, "git"), `#!/bin/sh
args="$*"
case "$args" in
  "remote get-url origin")
    printf '%s\n' 'https://github.com/minislively/fooks.git'
    ;;
  "fetch --prune origin")
    exit 0
    ;;
  "rev-parse --verify origin/main")
    printf '%s\n' 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ;;
  "branch -r --format=%(refname:short)")
    printf '%s\n' 'origin/main' 'origin/feature-a'
    ;;
  "rev-list --left-right --count origin/main...origin/feature-a")
    printf '%s\n' '0 1'
    ;;
  "cherry origin/main origin/feature-a")
    printf '%s\n' '+ bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    ;;
  "log -1 --format=%cs origin/feature-a")
    printf '%s\n' '2026-04-27'
    ;;
  "log -1 --format=%s origin/feature-a")
    printf '%s\n' 'Example branch audit fixture'
    ;;
  "rev-parse --short=12 origin/feature-a")
    printf '%s\n' 'bbbbbbbbbbbb'
    ;;
  "diff --name-status origin/main origin/feature-a")
    printf '%s\n' 'M	README.md' 'D	scripts/audit-remote-branches.mjs' 'D	test/domain-detector.test.mjs' 'A	docs/new-note.md'
    ;;
  "diff --shortstat origin/main origin/feature-a")
    printf '%s\n' '4 files changed, 12 insertions(+), 98 deletions(-)'
    ;;
  *)
    printf 'unexpected git args: %s\n' "$args" >&2
    exit 64
    ;;
esac
`);

  writeExecutable(path.join(binDir, "gh"), `#!/bin/sh
printf '%s\n' '[]'
`);

  try {
    const stdout = execFileSync(process.execPath, [auditScript, "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);

    assert.equal(result.summary.totalBranches, 1);
    assert.equal(result.branches[0].branch, "feature-a");
    assert.equal(result.branches[0].classification, "valid-candidate");
    assert.deepEqual(result.branches[0].currentTreeImpact, {
      addedFiles: 1,
      modifiedFiles: 1,
      deletedFiles: 2,
      renamedFiles: 0,
      shortstat: "4 files changed, 12 insertions(+), 98 deletions(-)",
      destructiveStaleTree: true,
      deletedPathEvidence: [
        "scripts/audit-remote-branches.mjs",
        "test/domain-detector.test.mjs",
      ],
    });
    assert.deepEqual(result.discordNextActionShortlist, [
      {
        branch: "feature-a",
        ref: "origin/feature-a",
        action: "Read-only triage: inspect the branch diff and record an owner plus outcome; this artifact does not recommend deleting branches or merging code.",
        reviewFocus: "inspect deleted current-file paths before any cleanup decision",
        evidence: "1 unique patch commit; destructive-stale-tree (2 current-file deletes; deletes `scripts/audit-remote-branches.mjs`, `test/domain-detector.test.mjs`); last commit 2026-04-27 (bbbbbbbbbbbb)",
        diffCommand: "git diff --stat origin/main...origin/feature-a",
      },
    ]);

    const markdown = execFileSync(process.execPath, [auditScript, "--markdown"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.match(markdown, /## Discord-friendly valid-candidate next-action shortlist/);
    assert.match(markdown, /Read-only operator shortlist for Discord handoff/);
    assert.match(markdown, /does not recommend deleting branches or merging code/);
    assert.match(markdown, /`feature-a` — inspect deleted current-file paths before any cleanup decision/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("remote branch audit classifies archived otherwise-valid candidates from archive docs", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-branch-audit-archive-"));
  const binDir = path.join(tempDir, "bin");
  const archiveDocsDir = path.join(tempDir, "archive-docs");
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(archiveDocsDir, { recursive: true });

  fs.writeFileSync(path.join(archiveDocsDir, "explicit-branch-archive-999.md"), `# Explicit branch archive\n\nBranch inspected: \`origin/feature-archived\`\n`);
  fs.writeFileSync(path.join(archiveDocsDir, "title-branch-archive-998.md"), `# Archive rationale for \`feature-title-archived\` (#998)\n`);
  fs.writeFileSync(path.join(archiveDocsDir, "precedence-branch-archive-997.md"), `# Precedence branch archive\n\nBranch inspected: \`origin/feature-open-archived\`\nBranch inspected: \`origin/feature-merged-archived\`\nBranch inspected: \`origin/feature-patch-archived\`\n`);

  writeExecutable(path.join(binDir, "git"), `#!/bin/sh
args="$*"
case "$args" in
  "remote get-url origin")
    printf '%s\n' 'https://github.com/minislively/fooks.git'
    ;;
  "fetch --prune origin")
    exit 0
    ;;
  "rev-parse --verify origin/main")
    printf '%s\n' 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ;;
  "branch -r --format=%(refname:short)")
    printf '%s\n' \
      'origin/main' \
      'origin/feature-archived' \
      'origin/feature-title-archived' \
      'origin/feature-open-archived' \
      'origin/feature-merged-archived' \
      'origin/feature-patch-archived' \
      'origin/feature-live'
    ;;
  "rev-list --left-right --count origin/main...origin/feature-merged-archived")
    printf '%s\n' '3 0'
    ;;
  "rev-list --left-right --count origin/main..."*)
    printf '%s\n' '2 1'
    ;;
  "cherry origin/main origin/feature-patch-archived")
    printf '%s\n' '- bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    ;;
  "cherry origin/main "*)
    printf '%s\n' '+ bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    ;;
  "log -1 --format=%cs "*)
    printf '%s\n' '2026-04-27'
    ;;
  "log -1 --format=%s "*)
    printf '%s\n' "Archive fixture"
    ;;
  "rev-parse --short=12 "*)
    printf '%s\n' 'bbbbbbbbbbbb'
    ;;
  "diff --name-status origin/main "*)
    printf '%s\n' 'M\tREADME.md'
    ;;
  "diff --shortstat origin/main "*)
    printf '%s\n' '1 file changed, 1 insertion(+)'
    ;;
  *)
    printf 'unexpected git args: %s\n' "$args" >&2
    exit 64
    ;;
esac
`);

  writeExecutable(path.join(binDir, "gh"), `#!/bin/sh
cat <<'JSON'
[{"headRefName":"feature-open-archived","headRepositoryOwner":{"login":"minislively"},"number":123,"title":"Open archived fixture","url":"https://example.test/pr/123"}]
JSON
`);

  try {
    const stdout = execFileSync(process.execPath, [
      auditScript,
      "--json",
      "--archive-docs-dir",
      archiveDocsDir,
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const byBranch = new Map(result.branches.map((row) => [row.branch, row]));

    assert.equal(byBranch.get("feature-archived").classification, "archived");
    assert.deepEqual(byBranch.get("feature-archived").archiveEvidence, {
      sourcePath: path.relative(repoRoot, path.join(archiveDocsDir, "explicit-branch-archive-999.md")),
      matchType: "branch-inspected",
      matchedRef: "origin/feature-archived",
      lineNumber: 3,
    });
    assert.equal(byBranch.get("feature-title-archived").classification, "archived");
    assert.equal(byBranch.get("feature-title-archived").archiveEvidence.matchType, "title");
    assert.equal(byBranch.get("feature-open-archived").classification, "open-pr");
    assert.equal(byBranch.get("feature-open-archived").archiveEvidence, undefined);
    assert.equal(byBranch.get("feature-merged-archived").classification, "redundant-merged");
    assert.equal(byBranch.get("feature-patch-archived").classification, "redundant-patch-equivalent");
    assert.equal(byBranch.get("feature-live").classification, "valid-candidate");
    assert.deepEqual(result.discordNextActionShortlist.map((row) => row.branch), ["feature-live"]);
    assert.equal(result.summary.counts.archived, 2);

    const markdown = execFileSync(process.execPath, [
      auditScript,
      "--markdown",
      "--archive-docs-dir",
      archiveDocsDir,
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.match(markdown, /Archived valid candidates suppressed: 2/);
    assert.match(markdown, /## Archived valid candidates/);
    assert.match(markdown, /not a recommendation to delete remote branches, merge stale trees, or replay stale-tree deletes/);
    assert.doesNotMatch(markdown.split("## Discord-friendly valid-candidate next-action shortlist")[1].split("## Valid candidates without open PRs")[0], /feature-archived/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
