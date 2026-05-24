import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyAdvisoryOnlyQueueAfterCompletedChild } from "./helpers/stale-epic-checklist-boundary.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(
  repoRoot,
  "docs",
  "dogfood",
  "advisory-only-queue-after-completed-child-1050.md",
);
const doc = fs.readFileSync(docPath, "utf8");

const completedChildReceipt = {
  issue: { number: 1046, state: "closed" },
  pullRequest: { number: 1049, state: "closed", merged: true },
};

test("issue #1050 helper flags advisory-only epic-only queue as action-required", () => {
  const result = classifyAdvisoryOnlyQueueAfterCompletedChild({
    clean: true,
    branch: "main",
    ahead: 0,
    behind: 0,
    openIssueCount: 1,
    openPullRequestCount: 0,
    epic: "#960",
    completedChildReceipt,
    evidence: {
      issues: [{ number: 960, state: "open" }],
      pullRequests: [],
    },
  });

  assert.equal(result.issue, "#1050");
  assert.equal(result.epic, "#960");
  assert.equal(
    result.classification,
    "advisory-only-queue-after-completed-child-action-required",
  );
  assert.equal(result.cleanPostChildCompletionEcho, true);
  assert.equal(result.completedChildReceipt, true);
  assert.equal(result.advisoryOnlyQueue, true);
  assert.equal(result.terminalIdleAllowed, false);
  assert.equal(result.actionRequiredForConcreteChildOrSession, true);
  assert.equal(result.activeDevelopmentAllowed, false);
  assert.deepEqual(result.requiredConcreteChildArtifacts, [
    "open-child-issue",
    "active-session",
    "active-branch",
    "open-pull-request",
    "active-worktree",
    "active-process",
  ]);
  assert.deepEqual(result.activeEvidenceKinds, []);
  assert.match(result.rule, /advisory-only queue is action-required/);
});

test("issue #1050 helper treats present open child issue as concrete-child-session-present", () => {
  const result = classifyAdvisoryOnlyQueueAfterCompletedChild({
    clean: true,
    branch: "main",
    ahead: 0,
    behind: 0,
    openIssueCount: 2,
    openPullRequestCount: 0,
    epic: "#960",
    completedChildReceipt,
    evidence: {
      issues: [
        { number: 960, state: "open" },
        { number: 1077, state: "open" },
      ],
      pullRequests: [],
    },
  });

  assert.equal(
    result.classification,
    "concrete-child-session-present",
  );
  assert.equal(result.actionRequiredForConcreteChildOrSession, false);
  assert.equal(result.activeDevelopmentAllowed, true);
});

test("issue #1050 helper treats open PR as concrete-child-session-present", () => {
  const result = classifyAdvisoryOnlyQueueAfterCompletedChild({
    clean: true,
    branch: "main",
    ahead: 0,
    behind: 0,
    openIssueCount: 1,
    openPullRequestCount: 1,
    epic: "#960",
    completedChildReceipt,
    evidence: {
      issues: [{ number: 960, state: "open" }],
      pullRequests: [{ number: 1080, state: "open" }],
    },
  });

  assert.equal(
    result.classification,
    "concrete-child-session-present",
  );
  assert.equal(result.actionRequiredForConcreteChildOrSession, false);
});

test("issue #1050 helper requires completed child receipt before action-required", () => {
  const result = classifyAdvisoryOnlyQueueAfterCompletedChild({
    clean: true,
    branch: "main",
    ahead: 0,
    behind: 0,
    openIssueCount: 1,
    openPullRequestCount: 0,
    epic: "#960",
    completedChildReceipt: {},
    evidence: {
      issues: [{ number: 960, state: "open" }],
      pullRequests: [],
    },
  });

  assert.equal(result.completedChildReceipt, false);
  assert.equal(
    result.classification,
    "concrete-child-session-present",
  );
});

test("issue #1050 doc preserves the advisory-only queue guard contract", () => {
  const compact = doc.replace(/\s+/gu, " ");
  for (const required of [
    "Advisory-only queue after completed child work (#1050)",
    "PR #1049",
    "Epic `#960`",
    "open_pr=0",
    "advisory-only-queue-after-completed-child-action-required",
    "not a\nterminal idle answer",
    "concrete-child-session-present",
    "intentionally read-only",
  ]) {
    const needle = required.replace(/\s+/gu, " ");
    assert.ok(
      compact.includes(needle),
      `missing #1050 doc text: ${required}`,
    );
  }
});
