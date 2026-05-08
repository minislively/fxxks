import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "react-web-release-report.yml");
const packageJsonPath = path.join(repoRoot, "package.json");

test("React Web release report workflow is release-facing and invokes the package script", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.match(workflow, /^name: React Web Release Report/m);
  assert.match(workflow, /push:\s+[\s\S]*branches:\s+[\s\S]*- main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run evidence:react-web-release-report -- --run-id=release-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.doesNotMatch(workflow, /assertReleaseBenchmarkSmokeGate/);
  assert.doesNotMatch(workflow, /validate-pr-merge-gate/);

  assert.equal(
    pkg.scripts["evidence:react-web-release-report"],
    "npm run build && node scripts/react-web-release-report-surface.mjs",
  );
});
