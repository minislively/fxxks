// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePullRequestMergeGate,
  pullRequestHasLinkedClosingIssue,
} from "../scripts/validate-pr-merge-gate.mjs";

const pr = { title: "Improve cache", body: "Fixes #42", head: { sha: "head-sha" } };

test("merge gate passes when PR links an issue and has maintainer approval", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    allowedMaintainers: ["minislively"],
    reviews: [
      { user: { login: "contributor" }, state: "APPROVED", submitted_at: "2026-05-01T00:00:00Z", commit_id: "head-sha" },
      { user: { login: "minislively" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" },
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approvingMaintainers, ["minislively"]);
});

test("merge gate rejects PRs without a closing issue reference", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42" },
    allowedMaintainers: ["minislively"],
    reviews: [{ user: { login: "minislively" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" }],
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /closing issue/);
});

test("merge gate requires latest maintainer review state to be approved", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    allowedMaintainers: ["minislively"],
    reviews: [
      { user: { login: "minislively" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "head-sha" },
      { user: { login: "minislively" }, state: "CHANGES_REQUESTED", submitted_at: "2026-05-01T00:02:00Z" },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /active approval/);
});

test("merge gate requires approval on the current head commit", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: pr,
    allowedMaintainers: ["minislively"],
    reviews: [{ user: { login: "minislively" }, state: "APPROVED", submitted_at: "2026-05-01T00:01:00Z", commit_id: "old-sha" }],
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /current head commit/);
});


test("closing issue detector accepts GitHub issue URLs", () => {
  assert.equal(
    pullRequestHasLinkedClosingIssue({ title: "", body: "Resolves https://github.com/minislively/fooks/issues/7" }),
    true,
  );
});
