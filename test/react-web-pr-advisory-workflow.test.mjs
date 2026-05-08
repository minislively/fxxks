import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "react-web-pr-advisory.yml");
const packageJsonPath = path.join(repoRoot, "package.json");

test("React Web PR advisory workflow is PR-scoped and invokes the package script", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.match(workflow, /^name: React Web PR Advisory/m);
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run evidence:react-web-pr-advisory -- --run-id=pr-\$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.doesNotMatch(workflow, /assertReleaseBenchmarkSmokeGate/);
  assert.doesNotMatch(workflow, /validate-pr-merge-gate/);

  assert.equal(
    pkg.scripts["evidence:react-web-pr-advisory"],
    "npm run build && node scripts/react-web-pr-advisory-surface.mjs",
  );
});
