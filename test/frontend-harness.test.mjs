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

function runPythonHarnessSnippet(snippet) {
  return JSON.parse(
    execFileSync("python3", ["-c", snippet], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, BENCHMARK_REPOS_DIR: isolatedReposDir },
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
  assert.equal(result.selectedCases[0].expectedFirstTurnRuntimeContext, "auto");
  assert.equal(result.selectedCases[0].expectedFooksPrepare, "scan-attach");
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
  assert.equal(result.selectedCases[0].expectedFirstTurnRuntimeContext, "auto");
  assert.equal(result.selectedCases[0].expectedFooksPrepare, "scan-attach");
});

test("frontend harness marks exact-file single-turn Codex context as no-op", () => {
  const customPrompt =
    "In apps/web/modules/auth/login/components/login-form.tsx add a red Tailwind Caps Lock warning below the password field.";
  const result = runRunnerConfig(["--runner", "codex", "--repo", "formbricks", "--task", "T5", "--task-prompt", customPrompt]);

  assert.equal(result.selectedCases.length, 1);
  assert.equal(result.selectedCases[0].taskClass, "targeted-edit");
  assert.equal(result.selectedCases[0].promptSpecificity, "exact-file");
  assert.equal(result.selectedCases[0].expectedContextPolicy, "light");
  assert.equal(result.selectedCases[0].expectedFirstTurnRuntimeContext, "no-op");
  assert.equal(result.selectedCases[0].expectedFooksPrepare, "bypass");
});

test("frontend harness scores Caps Lock artifacts and catches broad locale scope", () => {
  const snippet = `
import importlib.util, json
spec = importlib.util.spec_from_file_location("bench", ${JSON.stringify(runnerPath)})
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)
task = {"prompt": "Add a Caps Lock warning to the login password field."}
patch = '''
+const [isCapsLockOn, setIsCapsLockOn] = useState(false);
+const onPasswordKey = (event) => setIsCapsLockOn(event.getModifierState("CapsLock"));
+<PasswordInput onKeyDown={onPasswordKey} onKeyUp={onPasswordKey} />
+<p role="alert" className="text-red-600">{t("auth.login.caps_lock_warning")}</p>
'''
target = "apps/web/modules/auth/login/components/login-form.tsx"
good = bench.evaluate_acceptance(task, [target, "apps/web/locales/en-US.json"], patch)
broad = bench.evaluate_acceptance(task, [target] + [f"apps/web/locales/locale-{i}.json" for i in range(3)], patch)
print(json.dumps({"good": good, "broad": broad}))
`;
  const result = runPythonHarnessSnippet(snippet);

  assert.equal(result.good.available, true);
  assert.equal(result.good.passed, true);
  assert.equal(result.broad.passed, false);
  assert.equal(
    result.broad.checks.find((check) => check.name === "locale_scope_capped").passed,
    false,
  );
  assert.equal(
    result.broad.checks.find((check) => check.name === "file_scope_capped").passed,
    false,
  );
});
