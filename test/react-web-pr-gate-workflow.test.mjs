import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "react-web-pr-gate.yml");
const packageJsonPath = path.join(repoRoot, "package.json");

test("React Web PR gate workflow is PR-scoped and fail-closed on the bounded gate script", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.match(workflow, /^name: React Web PR Gate/m);
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run evidence:react-web-pr-gate -- --run-id=pr-\$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.match(workflow, /REACT_WEB_PR_GATE_EXIT_CODE/);
  assert.match(workflow, /Fail when the bounded React Web PR gate trips/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.doesNotMatch(workflow, /assertReleaseBenchmarkSmokeGate/);

  assert.equal(
    pkg.scripts["evidence:react-web-pr-gate"],
    "npm run build && node scripts/react-web-pr-gate-surface.mjs",
  );
});
