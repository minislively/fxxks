import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "merge-gate.yml");
const pullRequestTemplatePath = path.join(repoRoot, ".github", "PULL_REQUEST_TEMPLATE.md");

test("merge gate workflow validates approval reviews and linked issues in CI", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /pull_request_review:/);
  assert.doesNotMatch(workflow, /MERGE_GATE_ALLOWED_MAINTAINERS/);
  assert.doesNotMatch(workflow, /MERGE_GATE_APPROVAL_MODE/);
  assert.match(workflow, /MERGE_GATE_REQUIRE_APPROVAL: "true"/);
  assert.match(workflow, /Validate approval review and linked issue/);
});

test("pull request template warns about current-head non-author approval", () => {
  const template = fs.readFileSync(pullRequestTemplatePath, "utf8");
  assert.match(template, /non-author reviewer/i);
  assert.match(template, /current head commit/i);
  assert.match(template, /issue comment or regular PR comment/i);
  assert.match(template, /fresh approval again/i);
});
