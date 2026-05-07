import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "merge-gate.yml");

test("merge gate workflow validates approval reviews and linked issues in CI", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /pull_request_review:/);
  assert.doesNotMatch(workflow, /MERGE_GATE_ALLOWED_MAINTAINERS/);
  assert.doesNotMatch(workflow, /MERGE_GATE_APPROVAL_MODE/);
  assert.match(workflow, /MERGE_GATE_REQUIRE_APPROVAL: "true"/);
  assert.match(workflow, /Validate approval review and linked issue/);
});
