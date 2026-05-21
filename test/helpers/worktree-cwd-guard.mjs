import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveTestRepoRoot(testFileUrl) {
  return path.resolve(path.dirname(fileURLToPath(testFileUrl)), "..");
}

export function buildWorktreeCwdGuardMessage({
  expectedRepoRoot,
  actualCwd,
  testFilePath,
  issue = "#1025",
  command = "node --test test/react-web-status-surface.test.mjs",
}) {
  return [
    `${issue} worktree-local focused test cwd guard: run this focused verification from the worktree repo root.`,
    `Expected cwd: ${expectedRepoRoot}`,
    `Actual cwd: ${actualCwd}`,
    `Test file: ${testFilePath}`,
    `Use: cd ${expectedRepoRoot} && ${command}`,
    "Do not classify the target worktree as failing from a root-cwd cross-worktree absolute test invocation; process.cwd() selects the repo build output under test.",
  ].join("\n");
}

function realpathIfPresent(value) {
  try {
    return fs.realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}

export function assertWorktreeCwdForFocusedTest({ testFileUrl, issue, command, cwd = process.cwd() }) {
  const expectedRepoRoot = resolveTestRepoRoot(testFileUrl);
  const actualCwd = path.resolve(cwd);
  if (realpathIfPresent(actualCwd) !== realpathIfPresent(expectedRepoRoot)) {
    throw new Error(
      buildWorktreeCwdGuardMessage({
        expectedRepoRoot,
        actualCwd,
        testFilePath: fileURLToPath(testFileUrl),
        issue,
        command,
      }),
    );
  }
  return expectedRepoRoot;
}
