import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "merge-gate.yml");
const pullRequestTemplatePath = path.join(repoRoot, ".github", "PULL_REQUEST_TEMPLATE.md");

test("merge gate workflow validates linked issues and allowed-reviewer participation", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /pull_request_review:/);
  assert.match(workflow, /MERGE_GATE_REQUIRE_APPROVAL: "true"/);
  assert.match(workflow, /MERGE_GATE_ALLOWED_REVIEWERS: "minislively,yeachan-heo"/);
  assert.match(workflow, /Validate approval review and linked issue/);
});

test("pull request template keeps linked issue prompt and approval checklist", () => {
  const template = fs.readFileSync(pullRequestTemplatePath, "utf8");
  assert.match(template, /Linked issue/i);
  assert.match(template, /Fixes #/);
  assert.match(template, /minislively/i);
  assert.match(template, /yeachan-heo/i);
  assert.match(template, /self-review.*allowed/i);
  assert.match(template, /review, review comment, or PR\/issue comment/i);
  assert.match(template, /current head commit/i);
});
