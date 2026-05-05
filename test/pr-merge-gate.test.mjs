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

test("merge gate can allow docs/test-only self-maintainer PRs when explicitly configured", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: {
      title: "Clarify TUI metadata boundaries",
      body: "Closes #484",
      head: { sha: "head-sha" },
      user: { login: "minislively" },
    },
    allowedMaintainers: ["minislively"],
    changedFiles: [
      "docs/tui-operational-readiness.md",
      "docs/tui-fixture-candidates.md",
      "test/payload-policy-tui-ink.test.mjs",
    ],
    reviews: [],
    approvalMode: "docs-tests-self-ok",
  });

  assert.equal(result.ok, true);
  assert.equal(result.approvalBypassReason, "docs-tests-only-self-maintainer");
  assert.deepEqual(result.approvingMaintainers, []);
});

test("merge gate keeps docs/test-only self-maintainer exception disabled in strict mode", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: {
      title: "Clarify TUI metadata boundaries",
      body: "Closes #484",
      head: { sha: "head-sha" },
      user: { login: "minislively" },
    },
    allowedMaintainers: ["minislively"],
    changedFiles: ["docs/tui-operational-readiness.md", "test/payload-policy-tui-ink.test.mjs"],
    reviews: [],
    approvalMode: "strict",
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /active approval/);
});

test("merge gate does not bypass approval for code or shared policy files", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: {
      title: "Change merge gate",
      body: "Closes #485",
      head: { sha: "head-sha" },
      user: { login: "minislively" },
    },
    allowedMaintainers: ["minislively"],
    changedFiles: [".github/workflows/merge-gate.yml", "scripts/validate-pr-merge-gate.mjs", "AGENTS.md", "test/pr-merge-gate.test.mjs"],
    reviews: [],
    approvalMode: "docs-tests-self-ok",
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /active approval/);
  assert.deepEqual(result.pathClassification.disallowedFiles, [
    ".github/workflows/merge-gate.yml",
    "scripts/validate-pr-merge-gate.mjs",
    "AGENTS.md",
  ]);
});

test("merge gate does not bypass approval for non-maintainer authors", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: {
      title: "Clarify docs",
      body: "Closes #486",
      head: { sha: "head-sha" },
      user: { login: "external-contributor" },
    },
    allowedMaintainers: ["minislively"],
    changedFiles: ["docs/tui-operational-readiness.md", "test/payload-policy-tui-ink.test.mjs"],
    reviews: [],
    approvalMode: "docs-tests-self-ok",
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /active approval/);
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
