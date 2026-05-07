// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyDocsTestsOnlyChange,
  evaluatePullRequestMergeGate,
  pullRequestHasLinkedClosingIssue,
} from "../scripts/validate-pr-merge-gate.mjs";

const pr = { title: "Improve cache", body: "Fixes #42", head: { sha: "head-sha" }, user: { login: "contributor" } };

test("merge gate passes when PR links a closing issue and has current-head approval", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [
      { user: { login: "reviewer" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" },
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approvingReviewers, ["reviewer"]);
});

test("merge gate still requires linked issue when approval exists", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
    reviews: [
      { user: { login: "reviewer" }, state: "APPROVED", submitted_at: "2026-05-01T00:02:00Z", commit_id: "head-sha" },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /closing issue/);
  assert.doesNotMatch(result.blockers.join("\n"), /active approval/);
  assert.deepEqual(result.approvingReviewers, ["reviewer"]);
});

test("merge gate rejects PRs without a closing issue reference", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
    reviews: [{ user: { login: "reviewer" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" }],
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /closing issue/);
});

test("merge gate requires latest reviewer state to stay approved", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [
      { user: { login: "reviewer" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" },
      { user: { login: "reviewer" }, state: "CHANGES_REQUESTED", submitted_at: "2026-05-01T00:02:00Z" },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /GitHub PR review approval/);
  assert.match(result.blockers.join("\n"), /requires re-approval/i);
});

test("merge gate requires approval on the current head commit", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [{ user: { login: "reviewer" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "old-sha" }],
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /current head commit/);
  assert.match(result.blockers.join("\n"), /comments do not count/i);
  assert.match(result.blockers.join("\n"), /requires re-approval/i);
});

test("merge gate ignores PR author self-approval", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Fixes #42", head: { sha: "head-sha" }, user: { login: "reviewer" } },
    reviews: [{ user: { login: "reviewer" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" }],
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /reviewer other than the PR author/);
  assert.deepEqual(result.approvingReviewers, []);
});

test("merge gate can disable linked issue enforcement explicitly", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
    reviews: [{ user: { login: "reviewer" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" }],
    requireLinkedIssue: false,
  });

  assert.equal(result.ok, true);
});

test("merge gate can disable approval enforcement explicitly", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Fixes #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
    reviews: [],
    requireApproval: false,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approvingReviewers, []);
});

test("docs/test-only classifier excludes manifest and non-doc non-test paths", () => {
  assert.deepEqual(classifyDocsTestsOnlyChange(["docs/a.md", "test/a.test.mjs"]), {
    docsTestsOnly: true,
    changedFiles: ["docs/a.md", "test/a.test.mjs"],
    disallowedFiles: [],
  });

  assert.deepEqual(classifyDocsTestsOnlyChange(["test/fixtures/frontend-domain-expectations/manifest.json"]), {
    docsTestsOnly: false,
    changedFiles: ["test/fixtures/frontend-domain-expectations/manifest.json"],
    disallowedFiles: ["test/fixtures/frontend-domain-expectations/manifest.json"],
  });

  assert.deepEqual(classifyDocsTestsOnlyChange(["src/core/domain-detector.ts"]), {
    docsTestsOnly: false,
    changedFiles: ["src/core/domain-detector.ts"],
    disallowedFiles: ["src/core/domain-detector.ts"],
  });

  assert.deepEqual(classifyDocsTestsOnlyChange(["AGENTS.md"]), {
    docsTestsOnly: false,
    changedFiles: ["AGENTS.md"],
    disallowedFiles: ["AGENTS.md"],
  });
});

test("closing issue detector accepts GitHub issue URLs", () => {
  assert.equal(
    pullRequestHasLinkedClosingIssue({ title: "", body: "Resolves https://github.com/minislively/fooks/issues/7" }),
    true,
  );
});
