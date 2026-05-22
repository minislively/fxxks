import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyCleanEpicAdvisoryInventorySessionWhip,
  classifyCleanEpicOnlySessionWhip,
  classifyEpicOnlyOpenIssueState,
} from "./helpers/stale-epic-checklist-boundary.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(repoRoot, "docs", "dogfood", "epic-only-open-issue-idle-guard-1033.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");
const issue1040DocPath = path.join(repoRoot, "docs", "dogfood", "clean-epic-only-session-whip-1040.md");
const issue1040Doc = fs.readFileSync(issue1040DocPath, "utf8");
const compactIssue1040Doc = issue1040Doc.replace(/\s+/gu, " ");
const issue1046DocPath = path.join(repoRoot, "docs", "dogfood", "clean-epic-advisory-inventory-spawn-child-1046.md");
const issue1046Doc = fs.readFileSync(issue1046DocPath, "utf8");
const compactIssue1046Doc = issue1046Doc.replace(/\s+/gu, " ");

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

test("issue #1040 helper treats clean post-merge epic-only session whip as idle", () => {
  assert.deepEqual(
    classifyCleanEpicOnlySessionWhip({
      epic: "#960",
      branch: "main",
      clean: true,
      ahead: 0,
      behind: 0,
      openIssueCount: 1,
      openPullRequestCount: 0,
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
      issue: "#1040",
      epic: "#960",
      classification: "clean-epic-only-session-whip-idle",
      cleanPostMergeEcho: true,
      epicOnlyOpenIssueState: true,
      activeDevelopmentAllowed: false,
      sessionWhipMayEndOnCleanEcho: false,
      requiredConcreteChildArtifacts: [
        "open-child-issue",
        "active-session",
        "active-branch",
        "open-pull-request",
        "active-worktree",
        "active-process",
      ],
      activeEvidenceKinds: [],
      mutationBoundary: {
        mutatesGitHubIssues: false,
        changesMergePolicy: false,
        changesProviderRuntimeHooks: false,
        changesTelemetry: false,
        changesBillingTokenProof: false,
        changesDetectorScope: false,
        changesProductClaims: false,
      },
      rule: "A clean post-merge session-whip snapshot with only planning epic #960 open is idle and must name a concrete child issue, session, branch, PR, worktree, or process before claiming active work.",
    },
  );
});

test("issue #1040 helper counts concrete child artifacts normally", () => {
  for (const [name, evidence, expectedKind] of [
    ["open child issue", { issues: [{ number: 960, state: "open" }, { number: 1040, state: "open" }] }, "open-child-issue"],
    ["active session", { issues: [{ number: 960, state: "open" }], sessions: [{ session: "fooks-issue-1040", active: true }] }, "active-session"],
    ["active branch", { issues: [{ number: 960, state: "open" }], branches: [{ name: "fooks-issue-1040-clean-epic-only-whip", active: true }] }, "active-branch"],
    ["open PR", { issues: [{ number: 960, state: "open" }], pullRequests: [{ number: 1041, state: "open" }] }, "open-pull-request"],
    ["active worktree", { issues: [{ number: 960, state: "open" }], worktrees: [{ path: "/tmp/fooks-1040", active: true }] }, "active-worktree"],
    ["active process", { issues: [{ number: 960, state: "open" }], processes: [{ pid: 1040, active: true }] }, "active-process"],
  ]) {
    const result = classifyCleanEpicOnlySessionWhip({
      epic: "#960",
      branch: "main",
      clean: true,
      ahead: 0,
      behind: 0,
      openIssueCount: 1,
      openPullRequestCount: 0,
      evidence,
    });
    assert.equal(result.classification, "concrete-child-artifact-present", name);
    assert.equal(result.activeDevelopmentAllowed, true, name);
    assert.deepEqual(result.activeEvidenceKinds, [expectedKind], name);
  }
});

test("issue #1040 dogfood doc preserves the clean epic-only session-whip boundary", () => {
  const report = extractJsonFence(issue1040Doc);

  assert.equal(report.issue, "#1040");
  assert.equal(report.readOnly, true);
  assert.equal(report.sourceEpic, "#960");
  assert.equal(report.postMergeReceipt, "PR #1039");
  assert.equal(report.operatorDecision.classification, "clean-epic-only-session-whip-idle");
  assert.equal(report.operatorDecision.sessionWhipMayEndOnCleanEcho, false);
  assert.equal(report.operatorDecision.activeDevelopmentAllowed, false);
  assert.deepEqual(report.operatorDecision.activeDevelopmentRequiresOneOf, [
    "open-child-issue",
    "active-session",
    "active-branch",
    "open-pull-request",
    "active-worktree",
    "active-process",
  ]);
  assert.match(report.operatorDecision.rule, /clean post-merge session-whip snapshot with only planning epic #960 open/);

  for (const required of [
    "narrow read-only dogfood docs/test/helper/operator-check-adjacent",
    "after PR #1039",
    "only open GitHub issue is planning Epic `#960`",
    "`open_pr=0`",
    "no mapped tmux session",
    "no mapped process",
    "no active sibling worktree",
    "clean root worktree on `main`",
    "`clean-epic-only-session-whip-idle`",
    "must not end as a clean echo",
    "open child issue distinct from `#960`",
    "active session",
    "active branch",
    "open PR",
    "active worktree",
    "active process",
    "does not mutate GitHub issues automatically",
    "change merge policy",
    "provider/runtime hooks",
    "telemetry",
    "billing/token proof",
    "detector scope",
    "product claims",
  ]) {
    assert.ok(compactIssue1040Doc.includes(required), `missing #1040 doc text: ${required}`);
  }
});

test("issue #1046 helper treats clean epic plus idle child inventory as status-only", () => {
  assert.deepEqual(
    classifyCleanEpicAdvisoryInventorySessionWhip({
      epic: "#960",
      branch: "main",
      clean: true,
      ahead: 0,
      behind: 0,
      openIssueCount: 2,
      openPullRequestCount: 0,
      evidence: {
        issues: [{ number: 960, state: "open" }, { number: 1046, state: "open" }],
        branches: [],
        worktrees: [],
        sessions: [],
        pullRequests: [],
        processes: [],
      },
    }),
    {
      issue: "#1046",
      epic: "#960",
      classification: "clean-epic-plus-idle-child-session-whip-idle",
      cleanPostMergeEcho: true,
      epicPlusSingleIdleChildInventory: true,
      activeDevelopmentAllowed: false,
      statusOnlyCheckMayEndOnCleanEcho: false,
      requiredConcreteChildArtifacts: [
        "active-session",
        "active-branch",
        "open-pull-request",
        "active-worktree",
        "active-process",
      ],
      activeEvidenceKinds: [],
      mutationBoundary: {
        mutatesGitHubIssues: false,
        changesMergePolicy: false,
        changesProviderRuntimeHooks: false,
        changesTelemetry: false,
        changesBillingTokenProof: false,
        changesDetectorScope: false,
        changesProductClaims: false,
        reopensClosedArtifacts: false,
      },
      rule: "A clean post-merge session-whip/operator-check snapshot with only planning epic #960 plus one idle child issue and no active branch, session, PR, worktree, or process is status-only and must spawn or adopt concrete child work before claiming active development.",
    },
  );
});

test("issue #1046 helper keeps active child work artifacts active", () => {
  for (const [name, evidence, expectedKind] of [
    ["active session", { issues: [{ number: 960, state: "open" }, { number: 1046, state: "open" }], sessions: [{ session: "fooks-issue-1046", active: true }] }, "active-session"],
    ["active branch", { issues: [{ number: 960, state: "open" }, { number: 1046, state: "open" }], branches: [{ name: "fooks-issue-1046-clean-epic-advisory-inventory", active: true }] }, "active-branch"],
    ["open PR", { issues: [{ number: 960, state: "open" }, { number: 1046, state: "open" }], pullRequests: [{ number: 1049, state: "open" }] }, "open-pull-request"],
    ["active worktree", { issues: [{ number: 960, state: "open" }, { number: 1046, state: "open" }], worktrees: [{ path: "/tmp/fooks-1046", active: true }] }, "active-worktree"],
    ["active process", { issues: [{ number: 960, state: "open" }, { number: 1046, state: "open" }], processes: [{ pid: 1046, active: true }] }, "active-process"],
  ]) {
    const result = classifyCleanEpicAdvisoryInventorySessionWhip({
      epic: "#960",
      branch: "main",
      clean: true,
      ahead: 0,
      behind: 0,
      openIssueCount: 2,
      openPullRequestCount: expectedKind === "open-pull-request" ? 1 : 0,
      evidence,
    });
    assert.equal(result.classification, "active-child-work-adopted", name);
    assert.equal(result.activeDevelopmentAllowed, true, name);
    assert.deepEqual(result.activeEvidenceKinds, [expectedKind], name);
  }
});

test("issue #1046 dogfood doc preserves the clean epic/advisory inventory spawn-or-adopt guard", () => {
  const report = extractJsonFence(issue1046Doc);

  assert.equal(report.issue, "#1046");
  assert.equal(report.readOnly, true);
  assert.equal(report.sourceEpic, "#960");
  assert.equal(report.postMergeReceipt, "PR #1048");
  assert.equal(report.operatorDecision.classification, "clean-epic-plus-idle-child-session-whip-idle");
  assert.equal(report.operatorDecision.statusOnlyCheckMayEndOnCleanEcho, false);
  assert.equal(report.operatorDecision.activeDevelopmentAllowed, false);
  assert.deepEqual(report.operatorDecision.activeDevelopmentRequiresOneOf, [
    "active-session",
    "active-branch",
    "open-pull-request",
    "active-worktree",
    "active-process",
  ]);
  assert.match(report.operatorDecision.rule, /only planning epic #960 plus one idle child issue/);

  for (const required of [
    "narrow read-only dogfood docs/test/operator-check/session-whip guard",
    "after PR #1048",
    "Epic `#960` plus one concrete but idle child issue",
    "`open_pr=0`",
    "no active branch",
    "no mapped tmux session",
    "no open PR",
    "status-only check/whip receipt",
    "`clean-epic-plus-idle-child-session-whip-idle`",
    "must spawn or adopt concrete child work",
    "active session",
    "active branch",
    "open PR",
    "active worktree",
    "active process",
    "does not mutate GitHub issues automatically",
    "change merge policy",
    "provider/runtime hooks",
    "telemetry",
    "billing/token proof",
    "detector scope",
    "product claims",
    "reopen closed PRs or issues",
  ]) {
    assert.ok(compactIssue1046Doc.includes(required), `missing #1046 doc text: ${required}`);
  }
});
