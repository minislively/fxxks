import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyEpicOnlyOpenIssueState } from "./helpers/stale-epic-checklist-boundary.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(repoRoot, "docs", "dogfood", "epic-only-open-issue-idle-guard-1033.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #1033 helper treats open_issue=1 with only #960 as idle/advisory", () => {
  assert.deepEqual(
    classifyEpicOnlyOpenIssueState({
      epic: "#960",
      openIssueCount: 1,
      evidence: {
        issues: [{ number: 960, state: "open" }],
        branches: [],
        worktrees: [],
        sessions: [],
        pullRequests: [],
        processes: [],
      },
    }),
    {
      epic: "#960",
      openIssueCount: 1,
      epicOnlyOpenIssueState: true,
      classification: "epic-only-open-issue-advisory",
      activeDevelopmentAllowed: false,
      activeEvidenceKinds: [],
      requiredBeforeActiveDevelopment: [
        "open-child-issue",
        "active-branch",
        "active-worktree",
        "active-session",
        "open-pull-request",
        "active-process",
      ],
      rule: "An open_issue=1 snapshot that contains only epic #960 is advisory/idle until backed by a concrete child issue, branch, worktree, session, pull request, or process.",
    },
  );
});

test("issue #1033 helper counts concrete active artifacts normally", () => {
  for (const [name, evidence, expectedKind] of [
    ["open child issue", { issues: [{ number: 960, state: "open" }, { number: 1033, state: "open" }] }, "open-child-issue"],
    ["active branch", { issues: [{ number: 960, state: "open" }], branches: [{ name: "fooks-issue-1033-epic-only-idle-guard", active: true }] }, "active-branch"],
    ["active worktree", { issues: [{ number: 960, state: "open" }], worktrees: [{ path: "/tmp/fooks-1033", active: true }] }, "active-worktree"],
    ["live session", { issues: [{ number: 960, state: "open" }], sessions: [{ session: "fooks-issue-1033", state: "active" }] }, "active-session"],
    ["open PR", { issues: [{ number: 960, state: "open" }], pullRequests: [{ number: 1034, state: "open" }] }, "open-pull-request"],
    ["mapped process", { issues: [{ number: 960, state: "open" }], processes: [{ pid: 1033, active: true }] }, "active-process"],
  ]) {
    const result = classifyEpicOnlyOpenIssueState({ epic: "#960", evidence });
    assert.equal(result.classification, "concrete-active-artifact-present", name);
    assert.equal(result.activeDevelopmentAllowed, true, name);
    assert.deepEqual(result.activeEvidenceKinds, [expectedKind], name);
  }
});

test("issue #1033 dogfood doc preserves the epic-only idle boundary", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#1033");
  assert.equal(report.readOnly, true);
  assert.equal(report.sourceEpic, "#960");
  assert.deepEqual(report.openIssueInventory, ["#960"]);
  assert.equal(report.operatorDecision.openIssueCount, 1);
  assert.equal(report.operatorDecision.classification, "epic-only-open-issue-advisory");
  assert.equal(report.operatorDecision.epicOnlyOpenIssueState, true);
  assert.equal(report.operatorDecision.activeDevelopmentAllowed, false);
  assert.deepEqual(report.operatorDecision.activeDevelopmentRequiresOneOf, [
    "open-child-issue",
    "active-branch",
    "active-worktree",
    "active-session",
    "open-pull-request",
    "active-process",
  ]);
  assert.match(report.operatorDecision.rule, /open_issue=1 snapshot that contains only epic #960/);

  for (const required of [
    "narrow read-only dogfood docs/test/helper guard for issue #1033",
    "Epic #960 operations reliability",
    "only open issue is Epic `#960`",
    "aggregate count `open_issue=1`",
    "`epic-only-open-issue-advisory`",
    "idle/advisory for active-development purposes",
    "open child issue distinct from `#960`",
    "active branch",
    "active worktree",
    "live mapped session",
    "open pull request",
    "mapped running process",
    "does not mutate GitHub issues",
    "change merge policy",
    "provider/runtime hooks",
    "telemetry",
    "billing/token proof",
    "detector scope",
    "product claims",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #1033 doc text: ${required}`);
  }
});
