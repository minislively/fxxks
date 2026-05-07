// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyDocsTestsOnlyChange,
  evaluatePullRequestMergeGate,
  pullRequestHasLinkedClosingIssue,
} from "../scripts/validate-pr-merge-gate.mjs";

test("merge gate passes when PR links a closing issue", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Fixes #42", head: { sha: "head-sha" }, user: { login: "contributor" } },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.blockers, []);
});

test("merge gate still requires linked issue", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42", head: { sha: "head-sha" } },
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /closing issue/);
});

test("merge gate rejects PRs without a closing issue reference", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42" },
  });

  assert.equal(result.ok, false);
  assert.match(result.blockers.join("\n"), /closing issue/);
});

test("merge gate can disable linked issue enforcement explicitly", () => {
  const result = evaluatePullRequestMergeGate({
    pullRequest: { title: "Improve cache", body: "Refs #42" },
    requireLinkedIssue: false,
  });

  assert.equal(result.ok, true);
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
