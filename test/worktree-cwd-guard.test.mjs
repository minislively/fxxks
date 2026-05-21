import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertWorktreeCwdForFocusedTest,
  buildWorktreeCwdGuardMessage,
  resolveTestRepoRoot,
} from "./helpers/worktree-cwd-guard.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("worktree cwd guard returns the test worktree root when focused verification starts there", () => {
  assert.equal(assertWorktreeCwdForFocusedTest({ testFileUrl: import.meta.url, cwd: repoRoot }), repoRoot);
  assert.equal(resolveTestRepoRoot(import.meta.url), repoRoot);
});

test("worktree cwd guard explains root-cwd cross-worktree absolute test invocation risk", () => {
  const rootCwd = path.dirname(repoRoot);
  assert.throws(
    () =>
      assertWorktreeCwdForFocusedTest({
        testFileUrl: import.meta.url,
        issue: "#1025",
        command: "node --test test/react-web-status-surface.test.mjs",
        cwd: rootCwd,
      }),
    (error) => {
      assert.match(error.message, /#1025 worktree-local focused test cwd guard/);
      assert.match(error.message, /Expected cwd:/);
      assert.match(error.message, /Actual cwd:/);
      assert.match(error.message, /root-cwd cross-worktree absolute test invocation/);
      assert.match(error.message, /process\.cwd\(\) selects the repo build output under test/);
      return true;
    },
  );
});

test("worktree cwd guard message preserves the operator rerun command", () => {
  const message = buildWorktreeCwdGuardMessage({
    expectedRepoRoot: "/worktrees/issue-1025",
    actualCwd: "/repo-root",
    testFilePath: "/worktrees/issue-1025/test/react-web-status-surface.test.mjs",
    issue: "#1025",
    command: "npm run build && node --test test/react-web-status-surface.test.mjs",
  });

  assert.match(message, /cd \/worktrees\/issue-1025 && npm run build && node --test test\/react-web-status-surface\.test\.mjs/);
  assert.match(message, /Do not classify the target worktree as failing/);
});
