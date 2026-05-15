import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const auditScript = path.join(repoRoot, "scripts", "audit-stale-worktrees.mjs");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function fakeTriage() {
  return {
    schemaVersion: 2,
    command: "status orphan-worktrees",
    linkedIssue: "#711",
    linkedIssueUrl: "https://github.com/minislively/fooks/issues/711",
    generatedAt: "2026-05-15T00:00:00.000Z",
    cwd: "/work/fooks.omx-worktrees/current",
    siblingRoot: "/work/fooks.omx-worktrees",
    baseRef: "origin/main",
    claimBoundary: "orphan local worktree triage boundary",
    readOnly: true,
    categories: {
      "safe-cleanup": [],
      "salvage-review": [],
      "manual-review-noise": [],
      keep: [],
    },
    entries: [],
    decisionTable: [],
    operatorWorksheet: {
      issue: "#711",
      readOnly: true,
      requiredConfirmation: "manual confirmation required",
      localOnlyCommitPolicy: "do-not-delete-local-only-commits-automatically",
    },
    blockers: [],
  };
}

function fakeEntry(overrides) {
  return {
    path: "/work/fooks.omx-worktrees/fooks-issue-123-stale-merged",
    branch: "fooks-issue-123-stale-merged",
    head: "abc123",
    current: false,
    exists: true,
    category: "safe-cleanup",
    reasons: ["safe cleanup candidate"],
    dirty: false,
    changedPathCount: 0,
    aheadOfBase: 0,
    behindBase: 0,
    baseRef: "origin/main",
    diffEvidence: { source: "git diff --shortstat origin/main...HEAD", changed: false, summary: "no committed diff against base" },
    remoteBranchExists: false,
    openPullRequest: { state: "none", source: "gh pr list --state open --json number,url,headRefName --limit 200" },
    closedPullRequest: { state: "none", source: "gh pr list --state closed --json number,url,headRefName,state,closedAt --limit 200" },
    activeTmuxPaneCount: 0,
    manualReviewCommands: [],
    manualCleanupCommands: ["git worktree remove <path>"],
    ...overrides,
  };
}

function triageWithEntries(entries) {
  const triage = fakeTriage();
  triage.entries = entries;
  triage.categories = {
    "safe-cleanup": entries.filter((entry) => entry.category === "safe-cleanup"),
    "salvage-review": entries.filter((entry) => entry.category === "salvage-review"),
    "manual-review-noise": entries.filter((entry) => entry.category === "manual-review-noise"),
    keep: entries.filter((entry) => entry.category === "keep"),
  };
  return triage;
}

function issueRunner(openIssues) {
  return (command, args) => {
    if (command === "gh" && args.join(" ") === "issue list --state open --json number,url,title --limit 200") {
      return JSON.stringify(openIssues);
    }
    throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
  };
}

test("stale worktree audit helpers wrap issue 854 and render stale categories", async () => {
  const { buildStaleWorktreeAudit, renderStaleWorktreeAuditMarkdown } = await import(auditScript);
  const staleEntry = fakeEntry({
    path: "/work/fooks.omx-worktrees/fooks-issue-123-stale-merged",
    branch: "fooks-issue-123-stale-merged",
  });
  const openIssueEntry = fakeEntry({
    path: "/work/fooks.omx-worktrees/fooks-issue-999-active-issue",
    branch: "fooks-issue-999-active-issue",
    category: "salvage-review",
    aheadOfBase: 2,
    diffEvidence: { source: "git diff --shortstat origin/main...HEAD", changed: true, summary: "1 file changed" },
    reasons: ["local-only commits need review"],
  });
  const currentEntry = fakeEntry({
    path: "/work/fooks.omx-worktrees/current",
    branch: "current",
    current: true,
    category: "keep",
    activeTmuxPaneCount: 1,
    reasons: ["worktree is the current working directory"],
  });
  const triage = triageWithEntries([staleEntry, openIssueEntry, currentEntry]);

  const result = buildStaleWorktreeAudit(triage.cwd, {
    triage,
    runner: issueRunner([{ number: 999, url: "https://github.com/minislively/fooks/issues/999", title: "active issue" }]),
  });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.command, "worktree:audit");
  assert.equal(result.linkedIssue, "#854");
  assert.equal(result.readOnly, true);
  assert.match(result.claimBoundary, /does not fetch, prune, remove worktrees, delete branches/);
  assert.match(result.claimBoundary, /write report files/);
  assert.equal(result.staleReviewCandidateRule, "open PR=0 + open issue=0 + local diff check completed");
  assert.deepEqual(result.staleReviewCandidates.map((entry) => entry.branch), ["fooks-issue-123-stale-merged"]);
  assert.equal(result.entries.find((entry) => entry.branch === "fooks-issue-999-active-issue").openIssue.state, "open");
  assert.equal(result.entries.find((entry) => entry.branch === "fooks-issue-999-active-issue").staleReviewCandidate, false);

  const markdown = renderStaleWorktreeAuditMarkdown(result);
  assert.match(markdown, /# Stale worktree audit/);
  assert.match(markdown, /Read-only boundary/);
  assert.match(markdown, /Open issue/);
  assert.match(markdown, /stale-review-candidate/);
  assert.match(markdown, /Salvage review required/);
  assert.match(markdown, /Safe cleanup candidates/);
});

test("stale worktree audit builder reads the current repo without mutation", async () => {
  const { buildStaleWorktreeAudit } = await import(auditScript);
  const result = buildStaleWorktreeAudit(repoRoot);
  assert.equal(result.command, "worktree:audit");
  assert.equal(result.linkedIssue, "#854");
  assert.equal(result.readOnly, true);
  assert.ok(Array.isArray(result.triage.entries));
  assert.ok(Array.isArray(result.entries));
  assert.ok(Array.isArray(result.staleReviewCandidates));
});

test("stale worktree audit script is stdout-only and rejects report file writes", () => {
  const result = spawnSync(process.execPath, [auditScript, "--output", "audit.md"], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown argument: --output/);
});

test("status stale-worktrees emits issue 854 JSON and rejects unknown args", () => {
  const output = execFileSync(process.execPath, [cliPath, "status", "stale-worktrees", "--json"], { cwd: repoRoot, encoding: "utf8", timeout: 10_000 });
  const result = JSON.parse(output);
  assert.equal(result.command, "status stale-worktrees");
  assert.equal(result.linkedIssue, "#854");
  assert.equal(result.readOnly, true);
  assert.equal(result.staleReviewCandidateRule, "open PR=0 + open issue=0 + local diff check completed");
  assert.ok(Array.isArray(result.entries));

  const rejected = spawnSync(process.execPath, [cliPath, "status", "stale-worktrees", "--write"], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Unexpected status stale-worktrees argument: --write/);
});

test("package exposes stdout-only stale worktree audit npm script", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["worktree:audit"], "node scripts/audit-stale-worktrees.mjs");
});
