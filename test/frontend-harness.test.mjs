import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const runnerPath = path.join(repoRoot, "benchmarks", "frontend-harness", "runners", "full-benchmark-suite.py");
const defaultReportsDir = path.join(repoRoot, "benchmarks", "frontend-harness", "reports");
const isolatedReposDir = path.join(fs.realpathSync.native("/tmp"), "fooks-missing-test-repos");

function runRunnerConfig(args = [], envOverrides = {}) {
  return JSON.parse(
    execFileSync("python3", [runnerPath, "--dry-run", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, BENCHMARK_REPOS_DIR: isolatedReposDir, ...envOverrides },
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}

test("frontend harness defaults to repo-local reports and preserves the legacy case matrix", () => {
  const result = runRunnerConfig();
  assert.equal(result.reportSchemaVersion, "frontend-harness.v2-context-mode");
  assert.equal(result.reportsDir, defaultReportsDir);
  assert.equal(result.defaultReportsDir, defaultReportsDir);
  assert.equal(result.runner, "omx");
  assert.equal(result.runnerLabel, "omx exec --full-auto");
  assert.equal(result.selectedCases.length, 5);
  assert.deepEqual(
    result.selectedCases.map((entry) => [entry.task, entry.repo]),
    [
      ["T1", "shadcn-ui"],
      ["T2", "shadcn-ui"],
      ["T5", "shadcn-ui"],
      ["T1", "cal.com"],
      ["T5", "cal.com"],
    ],
  );
  assert.equal(result.tokenEstimateNotes.scope, "tsx-only proxy");
  assert.equal(result.selectedCases[0].taskClass, "ambiguous-single-file");
  assert.equal(result.selectedCases[0].promptSpecificity, "ambiguous");
  assert.equal(result.selectedCases[0].expectedContextPolicy, "auto");
});

test("frontend harness supports single-case round-1 configuration and report dir overrides", () => {
  const customPrompt =
    "Find an existing email form and add inline validation, a red error message, and a loading state during submit.";
  const reportsDir = path.join(fs.realpathSync.native("/tmp"), "fooks-round1-reports");
  const result = runRunnerConfig(
    ["--runner", "codex", "--repo", "formbricks", "--task", "T5", "--task-prompt", customPrompt],
    { BENCHMARK_REPORTS_DIR: "/tmp/fooks-round1-reports" },
  );

  assert.equal(result.reportsDir, reportsDir);
  assert.equal(result.runner, "codex");
  assert.equal(result.runnerLabel, "codex exec --full-auto");
  assert.equal(result.selectedCases.length, 1);
  assert.equal(result.selectedCases[0].repo, "formbricks");
  assert.equal(result.selectedCases[0].task, "T5");
  assert.equal(result.selectedCases[0].prompt, customPrompt);
  assert.equal(result.selectedCases[0].repo_exists, false);
  assert.equal(result.selectedCases[0].taskClass, "ambiguous-multi-file");
  assert.equal(result.selectedCases[0].promptSpecificity, "ambiguous");
  assert.equal(result.selectedCases[0].expectedContextPolicy, "auto");
});
