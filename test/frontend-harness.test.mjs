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

test("frontend harness supports cal.com T4 dry-run metadata and iterations", () => {
  const result = runRunnerConfig(["--runner", "codex", "--repo", "cal.com", "--task", "T4", "--iterations", "3"]);

  assert.equal(result.runner, "codex");
  assert.equal(result.runnerLabel, "codex exec --full-auto");
  assert.equal(result.iterations, 3);
  assert.equal(result.selectedCases.length, 1);
  assert.equal(result.selectedCases[0].repo, "cal.com");
  assert.equal(result.selectedCases[0].task, "T4");
  assert.equal(result.selectedCases[0].taskClass, "ambiguous-multi-file");
  assert.equal(result.selectedCases[0].expectedContextPolicy, "auto");
  assert.equal(result.selectedCases[0].expectedFooksPrepare, "scan-attach");
  assert.equal(result.selectedCases[0].taskRepoMappingIncludesRepo, true);
});

test("frontend harness scores T4 component extraction pass and mandatory/advisory checks", () => {
  const snippet = `
import importlib.util, json
spec = importlib.util.spec_from_file_location("bench", ${JSON.stringify(runnerPath)})
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)
task = {"id": "T4", "prompt": "Find a component with inline header JSX (title, subtitle, actions). Extract this into a separate Header component."}
files = ["apps/web/components/booking/booking-card.tsx", "apps/web/components/booking/booking-header.tsx"]
patch = '''
diff --git a/apps/web/components/booking/booking-card.tsx b/apps/web/components/booking/booking-card.tsx
--- a/apps/web/components/booking/booking-card.tsx
+++ b/apps/web/components/booking/booking-card.tsx
+import { BookingHeader } from "./booking-header";
-<section><h1>{title}</h1><p>{subtitle}</p><Button>Save</Button></section>
+<section><BookingHeader title={title} subtitle={subtitle} actions={<Button>Save</Button>} /></section>
diff --git a/apps/web/components/booking/booking-header.tsx b/apps/web/components/booking/booking-header.tsx
new file mode 100644
--- /dev/null
+++ b/apps/web/components/booking/booking-header.tsx
+export function BookingHeader({ title, subtitle, actions, children }) {
+  return <header><h1>{title}</h1><p>{subtitle}</p><div>{actions}{children}</div></header>;
+}
'''
advisory_weak = patch.replace("<header>", "<header>").replace(" className=\\\"flex\\\"", "")
good = bench.evaluate_acceptance(task, files, patch)
weak = bench.evaluate_acceptance(task, files, advisory_weak)
print(json.dumps({"good": good, "weak": weak}))
`;
  const result = runPythonHarnessSnippet(snippet);

  assert.equal(result.good.available, true);
  assert.equal(result.good.kind, "component-extraction");
  assert.equal(result.good.passed, true);
  for (const name of [
    "header_component_created_or_extracted",
    "original_component_uses_header",
    "header_semantics_preserved",
    "header_actions_preserved",
    "no_unused_header_false_positive",
    "file_scope_capped",
    "runtime_files_excluded",
    "diff_check_passed",
  ]) {
    assert.equal(result.good.checks.find((check) => check.name === name).passed, true, name);
  }
  assert.equal(result.weak.passed, true);
  assert.equal(result.weak.checks.find((check) => check.name === "style_continuity_present").mandatory, false);
});

test("frontend harness rejects T4 false positives and unrelated prompts", () => {
  const snippet = `
import importlib.util, json
spec = importlib.util.spec_from_file_location("bench", ${JSON.stringify(runnerPath)})
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)
task = {"id": "T4", "prompt": "Find a component with inline header JSX (title, subtitle, actions). Extract this into a separate Header component."}
files = ["apps/web/components/booking/booking-card.tsx", "apps/web/components/booking/booking-header.tsx"]
base = '''
diff --git a/apps/web/components/booking/booking-card.tsx b/apps/web/components/booking/booking-card.tsx
--- a/apps/web/components/booking/booking-card.tsx
+++ b/apps/web/components/booking/booking-card.tsx
-<section><h1>{title}</h1><p>{subtitle}</p><Button>Save</Button></section>
+REPLACEMENT
diff --git a/apps/web/components/booking/booking-header.tsx b/apps/web/components/booking/booking-header.tsx
new file mode 100644
--- /dev/null
+++ b/apps/web/components/booking/booking-header.tsx
+export function BookingHeader({ title, subtitle, actions }) {
+  return <header className="flex"><h1>{title}</h1><p>{subtitle}</p><div>{actions}</div></header>;
+}
'''
unused = bench.evaluate_acceptance(task, files, base.replace("REPLACEMENT", "<section />"))
drops_semantics = bench.evaluate_acceptance(task, files, base.replace("REPLACEMENT", "import { BookingHeader } from './booking-header';\\n<BookingHeader actions={<Button>Save</Button>} />").replace("{ title, subtitle, actions }", "{ actions }").replace("<h1>{title}</h1><p>{subtitle}</p>", ""))
drops_actions = bench.evaluate_acceptance(task, files, base.replace("REPLACEMENT", "import { BookingHeader } from './booking-header';\\n<BookingHeader title={title} subtitle={subtitle} />").replace("{ title, subtitle, actions }", "{ title, subtitle }").replace("<div>{actions}</div>", ""))
broad = bench.evaluate_acceptance(task, files + [f"apps/web/unrelated/file-{i}.tsx" for i in range(5)], base.replace("REPLACEMENT", "import { BookingHeader } from './booking-header';\\n<BookingHeader title={title} subtitle={subtitle} actions={<Button>Save</Button>} />"))
other = bench.evaluate_acceptance({"id": "T1", "prompt": "Move a button"}, files, base)
print(json.dumps({"unused": unused, "drops_semantics": drops_semantics, "drops_actions": drops_actions, "broad": broad, "other": other}))
`;
  const result = runPythonHarnessSnippet(snippet);

  assert.equal(result.unused.available, true);
  assert.equal(result.unused.passed, false);
  assert.equal(result.unused.checks.find((check) => check.name === "original_component_uses_header").passed, false);
  assert.equal(result.drops_semantics.passed, false);
  assert.equal(result.drops_semantics.checks.find((check) => check.name === "header_semantics_preserved").passed, false);
  assert.equal(result.drops_actions.passed, false);
  assert.equal(result.drops_actions.checks.find((check) => check.name === "header_actions_preserved").passed, false);
  assert.equal(result.broad.passed, false);
  assert.equal(result.broad.checks.find((check) => check.name === "file_scope_capped").passed, false);
  assert.equal(result.other.available, false);
});

test("frontend harness parses actual runtime tokens and suppresses missing-token claims", () => {
  const snippet = `
import importlib.util, json
spec = importlib.util.spec_from_file_location("bench", ${JSON.stringify(runnerPath)})
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)
acceptance = {"available": True, "passed": True}
result = {
  "task": "T4",
  "vanilla": {"success": True, "duration_ms": 1000, "tokens_used": 1000, "files_list": ["apps/web/a.tsx"], "artifact": {"acceptance": acceptance}},
  "fooks": {"success": True, "total_time": 800, "tokens_used": None, "files_list": ["apps/web/a.tsx"], "artifact": {"acceptance": acceptance}},
}
aggregate = bench.aggregate_quality_gated_results([result], 1)
print(json.dumps({
  "newline": bench.parse_tokens_used("tokens used\\n1,234"),
  "colon": bench.parse_tokens_used("tokens used: 2,345"),
  "missing": bench.parse_tokens_used("no token block"),
  "aggregate": aggregate
}))
`;
  const result = runPythonHarnessSnippet(snippet);

  assert.equal(result.newline, 1234);
  assert.equal(result.colon, 2345);
  assert.equal(result.missing, null);
  assert.equal(result.aggregate.qualityGatedPairCount, 1);
  assert.equal(result.aggregate.runtimeTokenClaimAvailable, false);
  assert.equal(result.aggregate.qualityGatedMedianRuntimeTokenReduction, null);
  assert.equal(result.aggregate.verdict, "smoke-pass-proceed-to-n3");
});
