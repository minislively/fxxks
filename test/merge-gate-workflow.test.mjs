import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "merge-gate.yml");
const pullRequestTemplatePath = path.join(repoRoot, ".github", "PULL_REQUEST_TEMPLATE.md");

test("merge gate workflow validates linked issues in CI without review approval events", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /pull_request_target:/);
  assert.doesNotMatch(workflow, /pull_request_review:/);
  assert.doesNotMatch(workflow, /MERGE_GATE_ALLOWED_MAINTAINERS/);
  assert.doesNotMatch(workflow, /MERGE_GATE_APPROVAL_MODE/);
  assert.doesNotMatch(workflow, /MERGE_GATE_REQUIRE_APPROVAL:/);
  assert.match(workflow, /Validate linked issue/);
});

test("pull request template keeps linked issue prompt and drops approval checklist", () => {
  const template = fs.readFileSync(pullRequestTemplatePath, "utf8");
  assert.match(template, /Linked issue/i);
  assert.match(template, /Fixes #/);
  assert.doesNotMatch(template, /non-author reviewer/i);
  assert.doesNotMatch(template, /current head commit/i);
  assert.doesNotMatch(template, /issue comment or regular PR comment/i);
});
