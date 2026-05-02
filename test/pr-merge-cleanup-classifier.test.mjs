import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const classifierScript = path.join(repoRoot, "scripts", "classify-pr-merge-cleanup.mjs");

test("PR merge cleanup classifier marks checked-out local branch deletion as recoverable fallout", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-pr-merge-cleanup-"));
  const inputPath = path.join(tempDir, "merge.txt");
  fs.writeFileSync(inputPath, [
    "✓ Merged pull request minislively/fooks#351 (Dogfood main CI pass echo)",
    "✓ Deleted remote branch dogfood/main-ci-pass-echo-350",
    "X Pull request minislively/fooks#351 was merged, but failed to delete local branch dogfood/main-ci-pass-echo-350: error: Cannot delete branch 'dogfood/main-ci-pass-echo-350' checked out at '/home/bellman/Workspace/fooks.omx-worktrees/main-ci-pass-echo-350'",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [classifierScript, "--input", inputPath, "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);

    assert.equal(result.classification, "recoverable-post-merge-cleanup-fallout");
    assert.equal(result.disposition, "do-not-retry-merge");
    assert.equal(result.evidence.merged, true);
    assert.equal(result.evidence.localBranchDeleteFailed, true);
    assert.equal(result.evidence.checkedOutInWorktree, true);
    assert.equal(result.evidence.branch, "dogfood/main-ci-pass-echo-350");
    assert.equal(result.evidence.worktreePath, "/home/bellman/Workspace/fooks.omx-worktrees/main-ci-pass-echo-350");
    assert.match(result.operatorGuidance.join("\n"), /do not retry the merge/i);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("PR merge cleanup classifier does not hide merge failure wording without success evidence", () => {
  const stdout = execFileSync(process.execPath, [classifierScript, "--json"], {
    cwd: repoRoot,
    input: "failed to merge pull request: merge conflict\n",
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const result = JSON.parse(stdout);

  assert.equal(result.classification, "possible-merge-failure");
  assert.equal(result.disposition, "inspect-merge-before-cleanup");
  assert.equal(result.evidence.mergeFailure, true);
});
