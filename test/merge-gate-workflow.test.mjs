import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "merge-gate.yml");

test("merge gate workflow allowlist includes the approved maintainer accounts", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /MERGE_GATE_ALLOWED_MAINTAINERS: minislively,bellman,Yeachan-Heo/);
  assert.doesNotMatch(workflow, /MERGE_GATE_ALLOWED_MAINTAINERS: minislively\s*$/m);
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /pull_request_review:/);
  assert.match(workflow, /Validate maintainer approval and linked issue/);
});

const codeownersPath = path.join(repoRoot, ".github", "CODEOWNERS");

test("code owners include the approved maintainer accounts", () => {
  const codeowners = fs.readFileSync(codeownersPath, "utf8");
  assert.match(codeowners, /\* @minislively @bellman @Yeachan-Heo/);
});
