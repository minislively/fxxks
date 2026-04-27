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
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
