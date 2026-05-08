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

test("merge gate requires an allowed reviewer by default even when PR links a closing issue", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /review, review comment, or PR\/issue comment/);
  assert.match(result.blockers.join("\n"), /minislively/i);
  assert.match(result.blockers.join("\n"), /yeachan-heo/i);
  assert.deepEqual(result.approvingReviewers, []);
  assert.deepEqual(result.qualifyingParticipants, []);
});

test("merge gate still requires linked issue when approval checks are disabled", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /closing issue/);
  assert.doesNotMatch(result.blockers.join("\n"), /active approval/);
  assert.deepEqual(result.approvingReviewers, []);
  assert.deepEqual(result.qualifyingParticipants, []);
});

test("merge gate rejects PRs without a closing issue reference", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /closing issue/);
});

test("merge gate ignores dismissed allowed reviews when review checks are enabled", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [
      { user: { login: "minislively" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" },
      { user: { login: "minislively" }, state: "DISMISSED", submitted_at: "2026-05-01T00:02:00Z", commit_id: "head-sha" },
    ],
    requireApproval: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /review, review comment, or PR\/issue comment/);
  assert.match(result.blockers.join("\n"), /requires re-review/i);
});

test("merge gate can require approval on the current head commit when enabled", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [{ user: { login: "minislively" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "old-sha" }],
    requireApproval: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /current head commit/i);
  assert.match(result.blockers.join("\n"), /requires re-review/i);
});


test("merge gate passes by default with linked issue and current-head allowed review", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [{ user: { login: "minislively" }, state: "COMMENTED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" }],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approvingReviewers, ["minislively"]);
  assert.deepEqual(result.qualifyingParticipants, ["minislively"]);
});

test("issue comments from allowed users satisfy the approval gate", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [],
    issueComments: [{ user: { login: "yeachan-heo" } }],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approvingReviewers, []);
  assert.deepEqual(result.qualifyingParticipants, ["yeachan-heo"]);
});

test("review comments from allowed users satisfy the approval gate", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [],
    reviewComments: [{ user: { login: "Yeachan-Heo" } }],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approvingReviewers, []);
  assert.deepEqual(result.qualifyingParticipants, ["yeachan-heo"]);
});

test("merge gate allows self-review when the author is an allowed reviewer", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Fixes #42", head: { sha: "head-sha" }, user: { login: "minislively" } },
    reviews: [{ user: { login: "minislively" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" }],
    requireApproval: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approvingReviewers, ["minislively"]);
  assert.deepEqual(result.qualifyingParticipants, ["minislively"]);
});

test("merge gate rejects reviews from users outside the allowed reviewer set", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    reviews: [{ user: { login: "outside-reviewer" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" }],
    requireApproval: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /allowed reviewer/i);
  assert.deepEqual(result.approvingReviewers, []);
  assert.deepEqual(result.qualifyingParticipants, []);
});

test("merge gate can disable linked issue enforcement explicitly", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
    requireLinkedIssue: false,
    requireApproval: false,
  });

  assert.equal(result.ok, true);
});

test("merge gate skips linked issue requirement for docs/test-only changes when approval is otherwise disabled", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Tighten docs wording", body: "Refs #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
    changedFiles: ["docs/development-principles.md", "test/merge-gate-workflow.test.mjs"],
    requireApproval: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.docsTestsOnly, true);
});

test("merge gate still requires linked issue when docs/test-only allowlist is exceeded", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Touch docs and source", body: "Refs #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
    changedFiles: ["docs/development-principles.md", "src/core/domain-detector.ts"],
  });

  assert.equal(result.ok, false);
  assert.equal(result.docsTestsOnly, false);
  assert.match(result.blockers.join("\n"), /closing issue/);
});

test("merge gate can disable approval enforcement explicitly", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Fixes #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
    reviews: [],
    requireApproval: false,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approvingReviewers, []);
  assert.deepEqual(result.qualifyingParticipants, []);
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
