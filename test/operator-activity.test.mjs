// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);

const {
  OPERATOR_ACTIVITY_CLAIM_BOUNDARY,
  OPERATOR_ACTIVITY_COMMAND,
  OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
  OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE,
  OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_CLAIM_BOUNDARY,
  OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE,
  OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG,
  OPERATOR_ACTIVITY_REMOTE_SOURCE,
  OPERATOR_ACTIVITY_TMUX_COMMAND,
  OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT,
  parseOperatorActivityTmuxPanes,
  readOperatorActivitySnapshot,
} = require(path.join(repoRoot, "dist", "ops", "operator-activity.js"));

const {
  OPERATOR_CHECK_CLAIM_BOUNDARY,
  OPERATOR_CHECK_COMMAND,
  OPERATOR_CHECK_SOURCE,
  readOperatorCheckSnapshot,
} = require(path.join(repoRoot, "dist", "ops", "operator-check.js"));

function run(args, cwd, envOverrides = {}) {
  return JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...envOverrides } }));
}

function runText(args, cwd) {
  return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
}

function makeTempProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-activity-"));
  fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "export const value = 1;\n");
  return tempDir;
}

test("parseOperatorActivityTmuxPanes parses tab-delimited session, path, and command", () => {
  assert.deepEqual(parseOperatorActivityTmuxPanes("fooks-a\t/tmp/fooks\tzsh\nother\t/tmp/other\tnode\n"), [
    { session: "fooks-a", path: "/tmp/fooks", command: "zsh" },
    { session: "other", path: "/tmp/other", command: "node" },
  ]);
});

test("operator activity snapshot is local-first and does not call remote counts unless explicitly enabled", () => {
  const tempDir = makeTempProject();
  const calls = [];
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    now: () => "2026-05-03T22:10:00.000Z",
    runner: () => " M src/index.ts\0?? notes.md\0",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-424\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "2\t1\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      calls.push([command, ...args].join(" "));
      if (command === "gh") throw new Error("gh must not be called by default");
      return `fooks-dogfood\t${tempDir}\tzsh\nnot-related\t/tmp/elsewhere\tzsh\n`;
    },
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.command, OPERATOR_ACTIVITY_COMMAND);
  assert.equal(snapshot.claimBoundary, OPERATOR_ACTIVITY_CLAIM_BOUNDARY);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.generatedAt, "2026-05-03T22:10:00.000Z");
  assert.equal(snapshot.worktree.branch, "dogfood/issue-424");
  assert.equal(snapshot.worktree.upstream, "origin/main");
  assert.equal(snapshot.worktree.ahead, 2);
  assert.equal(snapshot.worktree.behind, 1);
  assert.equal(snapshot.worktree.clean, false);
  assert.equal(snapshot.worktree.delta.source, "current git status only; no session baseline comparison");
  assert.deepEqual(snapshot.worktree.delta.changedPaths, ["notes.md", "src/index.ts"]);
  assert.equal(snapshot.tmux.available, true);
  assert.equal(snapshot.tmux.command, OPERATOR_ACTIVITY_TMUX_COMMAND);
  assert.equal(snapshot.tmux.sessions.length, 1);
  assert.equal(snapshot.tmux.sessions[0].session, "fooks-dogfood");
  assert.equal(snapshot.optionalCounts.enabled, false);
  assert.match(snapshot.optionalCounts.source, /--include-remote-counts/);
  assert.equal(calls.some((call) => call.startsWith("gh ")), false);
});

test("idle activity snapshot remains zero and read-only with opt-in remote counts", () => {
  const tempDir = makeTempProject();
  const commandCalls = [];
  const gitCalls = [];
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-04T02:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      gitCalls.push(args.join(" "));
      if (args[0] === "fetch") throw new Error("status activity must not fetch");
      if (args[0] === "symbolic-ref") return "dogfood/issue-428-idle-activity-snapshot\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      commandCalls.push([command, ...args].join(" "));
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\nalso-other\t/tmp/elsewhere\tnode\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      throw new Error(`unexpected command ${command} ${args.join(" ")}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.command, OPERATOR_ACTIVITY_COMMAND);
  assert.equal(snapshot.generatedAt, "2026-05-04T02:00:00.000Z");
  assert.equal(snapshot.cwd, tempDir);
  assert.equal(snapshot.claimBoundary, OPERATOR_ACTIVITY_CLAIM_BOUNDARY);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.worktree.clean, true);
  assert.equal(snapshot.worktree.verdict.kind, "clean");
  assert.equal(snapshot.worktree.branch, "dogfood/issue-428-idle-activity-snapshot");
  assert.equal(snapshot.worktree.upstream, "origin/main");
  assert.equal(snapshot.worktree.ahead, 0);
  assert.equal(snapshot.worktree.behind, 0);
  assert.equal(snapshot.worktree.divergenceSource, "local tracking refs only; no fetch performed");
  assert.deepEqual(snapshot.worktree.delta, {
    source: "current git status only; no session baseline comparison",
    changedPathCount: 0,
    trackedPathCount: 0,
    untrackedPathCount: 0,
    conflictedPathCount: 0,
    changedPaths: [],
    conflictedPaths: [],
  });
  assert.deepEqual(snapshot.worktree.blockers, []);
  assert.equal(snapshot.tmux.available, true);
  assert.equal(snapshot.tmux.command, OPERATOR_ACTIVITY_TMUX_COMMAND);
  assert.deepEqual(snapshot.tmux.sessions, []);
  assert.deepEqual(snapshot.tmux.blockers, []);
  assert.deepEqual(snapshot.optionalCounts, {
    enabled: true,
    source: OPERATOR_ACTIVITY_REMOTE_SOURCE,
    openIssues: 0,
    openPullRequests: 0,
    blockers: [],
  });
  assert.deepEqual(snapshot.currentRunEvidence, {
    available: true,
    source: OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE,
    claimBoundary: OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY,
    classification: "activeOrUnknown",
    mainEchoEvidence: false,
    activeWorkEvidence: false,
    remoteCountsRequired: true,
    evidence: {
      branch: "dogfood/issue-428-idle-activity-snapshot",
      upstream: "origin/main",
      clean: true,
      ahead: 0,
      behind: 0,
      fooksSessionCount: 0,
      openIssues: 0,
      openPullRequests: 0,
      legacyStaleClosedArtifactWorktreeCount: 0,
    },
    reasons: [
      "current branch is dogfood/issue-428-idle-activity-snapshot, not main",
      "current worktree is clean",
      "local tracking divergence is zero",
      "no fooks-like tmux sessions are mapped to this snapshot",
      "open issue and pull request counts are both zero",
    ],
    blockers: [],
  });
  assert.deepEqual(snapshot.blockers, []);
  assert.equal(commandCalls.filter((call) => call.startsWith("gh ")).length, 3);
  assert.equal(gitCalls.some((call) => call.includes("fetch")), false);
});

test("operator activity reports exact-head post-merge main CI and release-report conclusions", () => {
  const tempDir = makeTempProject();
  const mainHead = "abc123main";
  const calls = [];
  const runs = [
    {
      databaseId: 101,
      status: "completed",
      conclusion: "success",
      updatedAt: "2026-05-12T10:00:00Z",
      headBranch: "main",
      headSha: mainHead,
      event: "push",
      workflowName: "CI",
      url: "https://github.com/minislively/fooks/actions/runs/101",
    },
    {
      databaseId: 102,
      status: "completed",
      conclusion: "success",
      updatedAt: "2026-05-12T10:05:00Z",
      headBranch: "main",
      headSha: mainHead,
      event: "push",
      workflowName: "React Web Release Report",
      url: "https://github.com/minislively/fooks/actions/runs/102",
    },
    {
      databaseId: 99,
      status: "completed",
      conclusion: "success",
      updatedAt: "2026-05-12T09:00:00Z",
      headBranch: "main",
      headSha: "stale-premerge",
      event: "push",
      workflowName: "CI",
      url: "https://github.com/minislively/fooks/actions/runs/99",
    },
  ];
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-12T10:10:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "gh" && args[0] === "run") return JSON.stringify(runs);
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.postMergeMainCiEvidence.available, true);
  assert.equal(snapshot.postMergeMainCiEvidence.source, OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_SOURCE);
  assert.equal(snapshot.postMergeMainCiEvidence.claimBoundary, OPERATOR_ACTIVITY_POST_MERGE_MAIN_CI_CLAIM_BOUNDARY);
  assert.equal(snapshot.postMergeMainCiEvidence.readOnly, true);
  assert.equal(snapshot.postMergeMainCiEvidence.exactHeadRequired, true);
  assert.equal(snapshot.postMergeMainCiEvidence.mainRef, "origin/main");
  assert.equal(snapshot.postMergeMainCiEvidence.mainHeadSource, "local origin/main tracking ref; no fetch performed");
  assert.equal(snapshot.postMergeMainCiEvidence.remoteFreshness, "not verified");
  assert.equal(snapshot.postMergeMainCiEvidence.mainHead, mainHead);
  assert.deepEqual(snapshot.postMergeMainCiEvidence.summary, {
    exactHeadWorkflowCount: 2,
    successCount: 2,
    pendingCount: 0,
    unknownCount: 0,
    failureCount: 0,
    allExactHeadConclusionsSuccessful: true,
  });
  assert.deepEqual(snapshot.postMergeMainCiEvidence.workflowEvidence.map((item) => [item.workflow, item.status, item.headSha]), [
    ["CI", "success", mainHead],
    ["React Web Release Report", "success", mainHead],
  ]);
  assert.equal(calls.some((call) => /fetch|delete/.test(call)), false);
});

test("operator check keeps missing exact-head workflow evidence unknown instead of success", () => {
  const tempDir = makeTempProject();
  const mainHead = "new-main-head";
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-12T11:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "rev-parse --verify origin/main") return `${mainHead}\n`;
      if (command === "gh" && args[0] === "run") {
        return JSON.stringify([
          {
            databaseId: 201,
            status: "completed",
            conclusion: "success",
            updatedAt: "2026-05-12T10:30:00Z",
            headBranch: "main",
            headSha: "old-main-head",
            event: "push",
            workflowName: "CI",
            url: "https://github.com/minislively/fooks/actions/runs/201",
          },
          {
            databaseId: 202,
            status: "in_progress",
            conclusion: "",
            updatedAt: "2026-05-12T10:35:00Z",
            headBranch: "main",
            headSha: mainHead,
            event: "push",
            workflowName: "React Web Release Report",
            url: "https://github.com/minislively/fooks/actions/runs/202",
          },
        ]);
      }
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, `HEAD ${mainHead}`, "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.postMergeMainCiEvidence.mainHead, mainHead);
  assert.deepEqual(snapshot.postMergeMainCiEvidence.workflowEvidence.map((item) => [item.workflow, item.status]), [
    ["CI", "unknown"],
    ["React Web Release Report", "pending"],
  ]);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.successCount, 0);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.unknownCount, 1);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.pendingCount, 1);
  assert.equal(snapshot.postMergeMainCiEvidence.summary.allExactHeadConclusionsSuccessful, false);
  assert.equal(snapshot.activity.postMergeMainCiEvidence, snapshot.postMergeMainCiEvidence);
});

test("operator activity marks clean current main with zero counts and no sessions as non-active main echo evidence", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-10T02:30:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "git" && args.join(" ") === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && args.join(" ") === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && args.join(" ") === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && args.join(" ") === "branch --merged origin/main") return "main\n";
      throw new Error(`unexpected command ${command} ${args.join(" ")}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.currentRunEvidence.available, true);
  assert.equal(snapshot.currentRunEvidence.source, OPERATOR_ACTIVITY_CURRENT_RUN_SOURCE);
  assert.equal(snapshot.currentRunEvidence.claimBoundary, OPERATOR_ACTIVITY_CURRENT_RUN_CLAIM_BOUNDARY);
  assert.equal(snapshot.currentRunEvidence.classification, "mainEchoNonActive");
  assert.equal(snapshot.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.currentRunEvidence.activeWorkEvidence, false);
  assert.equal(snapshot.currentRunEvidence.remoteCountsRequired, true);
  assert.deepEqual(snapshot.currentRunEvidence.evidence, {
    branch: "main",
    upstream: "origin/main",
    clean: true,
    ahead: 0,
    behind: 0,
    fooksSessionCount: 0,
    openIssues: 0,
    openPullRequests: 0,
    legacyStaleClosedArtifactWorktreeCount: 0,
  });
  assert.deepEqual(snapshot.currentRunEvidence.reasons, [
    "current branch is main",
    "current worktree is clean",
    "local tracking divergence is zero",
    "no fooks-like tmux sessions are mapped to this snapshot",
    "open issue and pull request counts are both zero",
  ]);
  assert.deepEqual(snapshot.currentRunEvidence.blockers, []);
});

test("operator check forces a concrete active artifact when post-merge main echo is idle", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-10T03:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/main", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.command, OPERATOR_CHECK_COMMAND);
  assert.equal(snapshot.claimBoundary, OPERATOR_CHECK_CLAIM_BOUNDARY);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.source, OPERATOR_CHECK_SOURCE);
  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.equal(snapshot.postMergeMainEchoBoundary.explicit, true);
  assert.equal(snapshot.postMergeMainEchoBoundary.currentRunClassification, "mainEchoNonActive");
  assert.equal(snapshot.postMergeMainEchoBoundary.mainEchoEvidence, true);
  assert.equal(snapshot.postMergeMainEchoBoundary.activeWorkEvidence, false);
  assert.equal(snapshot.postMergeMainEchoBoundary.echoOnly, true);
  assert.deepEqual(snapshot.activeArtifacts, []);
  assert.equal(snapshot.requiredActiveArtifact.required, true);
  assert.deepEqual(snapshot.requiredActiveArtifact.acceptableArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);
  assert.match(snapshot.requiredActiveArtifact.message, /No concrete active issue, PR, or mapped fooks session/);
  assert.equal(snapshot.activity.optionalCounts.enabled, true);
  assert.equal(snapshot.activity.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.activeWorkReceipts.classification, "mainEcho");
  assert.equal(snapshot.activeWorkReceipts.receipts.length, 1);
  assert.equal(snapshot.activeWorkReceipts.receipts[0].kind, "branch");
  assert.equal(snapshot.activeWorkReceipts.receipts[0].classification, "mainEcho");
  assert.match(snapshot.activeWorkReceipts.reportLine, /mainEcho=1/);
  assert.equal(snapshot.activeWorkReceipts.reportLine.includes("staleResidueLedger="), false);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.counts, {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 0,
  });
  assert.equal(snapshot.activeWorkReceipts.staleResidueLedger.totalCount, 0);
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.issue, "#739");
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.rowCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueIsActiveWorkEvidence, false);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);
  assert.deepEqual(snapshot.blockers, []);
});

test("operator check treats issue, PR, or mapped session as the concrete active boundary", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-10T03:10:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-705-post-merge-echo-idle-boundary\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "tmux") return `fooks-705\t${tempDir}\tzsh\n`;
      if (command === "gh" && args[0] === "issue") return "[{\"number\":705}]";
      if (command === "gh" && args[0] === "pr") return "[{\"number\":706}]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/dogfood/issue-705-post-merge-echo-idle-boundary", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "dogfood/issue-705-post-merge-echo-idle-boundary\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.verdict, "activeArtifactPresent");
  assert.equal(snapshot.requiredActiveArtifact.required, false);
  assert.deepEqual(snapshot.activeArtifacts, [
    { kind: "issue", count: 1, source: OPERATOR_ACTIVITY_REMOTE_SOURCE },
    { kind: "pullRequest", count: 1, source: OPERATOR_ACTIVITY_REMOTE_SOURCE },
    { kind: "session", count: 1, source: OPERATOR_ACTIVITY_TMUX_COMMAND },
  ]);
  assert.equal(snapshot.postMergeMainEchoBoundary.echoOnly, false);

  assert.equal(snapshot.activeWorkReceipts.schemaVersion, 1);
  assert.equal(snapshot.activeWorkReceipts.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.identifiers.repo, "github.com/minislively/fooks");
  assert.equal(snapshot.activeWorkReceipts.identifiers.repoSource, "git remote.origin.url");
  assert.equal(snapshot.activeWorkReceipts.classification, "active");
  assert.match(snapshot.activeWorkReceipts.reportLine, /fooks active-work receipt: active; active=4/);
  const receiptsByKind = new Map(snapshot.activeWorkReceipts.receipts.map((receipt) => [receipt.kind, receipt]));
  assert.deepEqual(receiptsByKind.get("issue"), {
    kind: "issue",
    classification: "active",
    identifiers: snapshot.activeWorkReceipts.identifiers,
    count: 1,
    source: OPERATOR_ACTIVITY_REMOTE_SOURCE,
    reasons: ["aggregate open issue count is greater than zero"],
    blockers: [],
  });
  assert.equal(receiptsByKind.get("pullRequest")?.count, 1);
  assert.equal(receiptsByKind.get("branch")?.classification, "active");
  const sessionReceipt = receiptsByKind.get("session");
  assert.equal(sessionReceipt?.classification, "active");
  assert.deepEqual(sessionReceipt?.identifiers.session, { name: "fooks-705", paneCount: 1 });
  assert.equal("number" in receiptsByKind.get("issue"), false);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 3);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueActiveBoundary.acceptableActiveArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);
});


test("operator check projects sibling worktree adoption receipts without cleanup commands", () => {
  const tempDir = makeTempProject();
  const siblingRoot = path.dirname(tempDir);
  const safeWorktree = path.join(siblingRoot, "old-clean-residue");
  const localAheadWorktree = path.join(siblingRoot, "local-ahead-orphan");
  const remoteWorktree = path.join(siblingRoot, "remote-active");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-11T06:10:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "dogfood/issue-720-stale-worktree-active-adoption\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "tmux" && joined.includes("pane_current_command")) return `fooks-720\t${tempDir}\tzsh\n`;
      if (command === "tmux") return `fooks-720\t${tempDir}\n`;
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "git" && joined === "config --get remote.origin.url") return "https://github.com/minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/dogfood/issue-720-stale-worktree-active-adoption",
          "",
          `worktree ${safeWorktree}`,
          "HEAD 222",
          "branch refs/heads/dogfood/old-clean-residue",
          "",
          `worktree ${localAheadWorktree}`,
          "HEAD 333",
          "branch refs/heads/dogfood/local-ahead-orphan",
          "",
          `worktree ${remoteWorktree}`,
          "HEAD 444",
          "branch refs/heads/dogfood/remote-active",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "dogfood/issue-720-stale-worktree-active-adoption\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\norigin/dogfood/remote-active\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") {
        if (cwd === localAheadWorktree) return "2 files changed, 10 insertions(+), 1 deletion(-)\n";
        if (cwd === remoteWorktree) return "1 file changed, 1 insertion(+)\n";
        return "";
      }
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") {
        if (cwd === localAheadWorktree) return "1 2\n";
        if (cwd === remoteWorktree) return "0 1\n";
        return "0 0\n";
      }
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => [tempDir, safeWorktree, localAheadWorktree, remoteWorktree].includes(targetPath),
  });

  const worktreeReceipts = snapshot.activeWorkReceipts.receipts.filter((receipt) => receipt.kind === "worktree");
  assert.equal(snapshot.activeWorkReceipts.readOnly, true);
  assert.equal(worktreeReceipts.length, 3);
  assert.equal(snapshot.activeWorkReceipts.staleResidueLedger.issue, "#736");
  assert.equal(snapshot.activeWorkReceipts.staleResidueLedger.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.staleResidueLedger.totalCount, 2);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.counts, {
    "safe-cleanup": 1,
    "salvage-review": 1,
    "manual-review-noise": 0,
  });
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.classes.map((row) => row.nextReviewAction), [
    "review-closed-or-merged-evidence-before-manual-cleanup",
    "preserve-local-only-commits-before-adoption-or-cleanup",
    "confirm-closed-pr-or-detached-review-context-before-ignoring",
  ]);
  assert.equal(
    snapshot.activeWorkReceipts.staleResidueLedger.localOnlyCommitPolicy,
    "do-not-delete-local-only-commits-automatically",
  );
  assert.match(snapshot.activeWorkReceipts.reportLine, /staleResidueLedger=2/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /cleanupReviewManifest=2\(#739\)/);
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.issue, "#739");
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.readOnly, true);
  assert.match(snapshot.activeWorkReceipts.cleanupReviewManifest.claimBoundary, /per-row reason, risk class, and required manual action/);
  assert.equal(snapshot.activeWorkReceipts.cleanupReviewManifest.rowCount, 2);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 2);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 1);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueIsActiveWorkEvidence, false);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);
  assert.match(snapshot.activeWorkReceipts.staleResidueActiveBoundary.reminder, /require an open issue, open PR, or mapped fooks tmux session/);
  const byBranch = new Map(worktreeReceipts.map((receipt) => [receipt.identifiers.worktree.branch, receipt]));
  const manifestRowsByBranch = new Map(snapshot.activeWorkReceipts.cleanupReviewManifest.rows.map((row) => [row.branch, row]));

  const safe = byBranch.get("dogfood/old-clean-residue");
  assert.equal(safe?.classification, "closedOrStale");
  assert.equal(safe?.identifiers.siblingWorktree?.category, "safe-cleanup");
  assert.match(safe?.reasons.join("\n") ?? "", /stale worktree residue candidate/);
  const safeManifestRow = manifestRowsByBranch.get("dogfood/old-clean-residue");
  assert.equal(safeManifestRow?.reviewId, "safe-cleanup:dogfood/old-clean-residue");
  assert.equal(safeManifestRow?.riskClass, "low-confirm-clean-before-manual-cleanup");
  assert.equal(safeManifestRow?.requiredManualAction, "confirm-no-needed-local-state-before-manual-cleanup");
  assert.match(safeManifestRow?.reason ?? "", /stale worktree residue candidate/);

  const localAhead = byBranch.get("dogfood/local-ahead-orphan");
  assert.equal(localAhead?.classification, "closedOrStale");
  assert.equal(localAhead?.identifiers.siblingWorktree?.category, "salvage-review");
  assert.equal(localAhead?.identifiers.siblingWorktree?.aheadOfBase, 2);
  assert.equal(localAhead?.identifiers.siblingWorktree?.localOnlyCommitPolicy, "do-not-delete-local-only-commits-automatically");
  assert.equal(localAhead?.identifiers.siblingWorktree?.behindBase, 1);
  assert.match(localAhead?.reasons.join("\n") ?? "", /preserve local-only commits/);
  const localAheadManifestRow = manifestRowsByBranch.get("dogfood/local-ahead-orphan");
  assert.equal(localAheadManifestRow?.riskClass, "high-preserve-local-only-state");
  assert.equal(localAheadManifestRow?.requiredManualAction, "preserve-or-cherry-pick-local-only-commits-before-adoption-or-cleanup");
  assert.equal(localAheadManifestRow?.evidence.aheadOfBase, 2);
  assert.equal(localAheadManifestRow?.evidence.remoteBranchExists, false);

  assert.equal(snapshot.activeWorkReceipts.salvageReviewQueue.issue, "#726");
  assert.equal(snapshot.activeWorkReceipts.salvageReviewQueue.readOnly, true);
  assert.equal(snapshot.activeWorkReceipts.salvageReviewQueue.itemCount, 1);
  assert.match(snapshot.activeWorkReceipts.salvageReviewQueue.claimBoundary, /does not delete, push, fetch, mutate/);
  const queueItem = snapshot.activeWorkReceipts.salvageReviewQueue.items[0];
  assert.equal(queueItem.branch, "dogfood/local-ahead-orphan");
  assert.equal(queueItem.head, "333");
  assert.equal(queueItem.category, "salvage-review");
  assert.equal(queueItem.evidence.aheadOfBase, 2);
  assert.equal(queueItem.evidence.behindBase, 1);
  assert.equal(queueItem.evidence.remoteBranchExists, false);
  assert.equal(queueItem.evidence.diff.changed, true);
  assert.match(queueItem.evidence.diff.summary, /2 files changed/);
  assert.equal(queueItem.localOnlyCommitPolicy, "do-not-delete-local-only-commits-automatically");

  const remote = byBranch.get("dogfood/remote-active");
  assert.equal(remote?.classification, "active");
  assert.equal(remote?.identifiers.siblingWorktree?.category, "keep");
  assert.equal(remote?.identifiers.siblingWorktree?.remoteBranchExists, true);

  const receiptJson = JSON.stringify([
    worktreeReceipts,
    snapshot.activeWorkReceipts.salvageReviewQueue,
    snapshot.activeWorkReceipts.staleResidueLedger,
    snapshot.activeWorkReceipts.cleanupReviewManifest,
    snapshot.activeWorkReceipts.staleResidueActiveBoundary,
  ]);
  assert.equal(receiptJson.includes(safeWorktree), false);
  assert.equal(receiptJson.includes(localAheadWorktree), false);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands/.test(receiptJson), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d/.test(call)), false);
});

test("operator check receipt marks closed-PR remote worktree residue as non-active noise", () => {
  const tempDir = makeTempProject();
  const siblingRoot = path.dirname(tempDir);
  const closedPrWorktree = path.join(siblingRoot, "fooks-issue-631-rn-compare-inspect-visibility");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-11T08:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${closedPrWorktree}`,
          "HEAD 222",
          "branch refs/heads/fooks-issue-631-rn-compare-inspect-visibility",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-issue-631-rn-compare-inspect-visibility\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\norigin/fooks-issue-631-rn-compare-inspect-visibility\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return cwd === closedPrWorktree ? "0 48\n" : "0 0\n";
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") {
        return JSON.stringify([
          {
            number: 634,
            url: "https://github.com/minislively/fooks/pull/634",
            headRefName: "fooks-issue-631-rn-compare-inspect-visibility",
            state: "CLOSED",
            closedAt: "2026-05-01T00:00:00Z",
          },
        ]);
      }
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => [tempDir, closedPrWorktree].includes(targetPath),
  });

  assert.equal(snapshot.activeWorkReceipts.classification, "closedOrStale");
  const receipt = snapshot.activeWorkReceipts.receipts.find(
    (item) => item.kind === "worktree" && item.identifiers.worktree.branch === "fooks-issue-631-rn-compare-inspect-visibility",
  );
  assert.equal(receipt?.classification, "closedOrStale");
  assert.equal(receipt?.identifiers.siblingWorktree?.category, "manual-review-noise");
  assert.equal(receipt?.identifiers.siblingWorktree?.remoteBranchExists, true);
  assert.equal(receipt?.identifiers.siblingWorktree?.openPullRequestState, "none");
  assert.equal(receipt?.identifiers.siblingWorktree?.closedPullRequestState, "closed");
  assert.match(receipt?.reasons.join("\n") ?? "", /#723/);
  assert.match(receipt?.reasons.join("\n") ?? "", /closed pull request evidence.*#634/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /closedOrStale=1/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /staleResidueLedger=1/);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.counts, {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 1,
  });
  assert.equal(snapshot.activeWorkReceipts.reportLine.includes(closedPrWorktree), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d/.test(call)), false);
});

test("operator check receipt marks detached PR review worktree leftovers as non-active cleanup-review noise", () => {
  const tempDir = makeTempProject();
  const siblingRoot = path.dirname(tempDir);
  const reviewLeftover = path.join(siblingRoot, "fooks-pr-728-review");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-11T12:30:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${reviewLeftover}`,
          "HEAD dcb590c",
          "detached",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") {
        return cwd === reviewLeftover ? "3 files changed, 15 insertions(+), 2 deletions(-)\n" : "";
      }
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") {
        return cwd === reviewLeftover ? "0 5\n" : "0 0\n";
      }
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") {
        return JSON.stringify([
          {
            number: 728,
            url: "https://github.com/minislively/fooks/pull/728",
            headRefName: "dogfood/issue-728-review",
            state: "MERGED",
            closedAt: "2026-05-10T00:00:00Z",
          },
        ]);
      }
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => [tempDir, reviewLeftover].includes(targetPath),
  });

  assert.equal(snapshot.activeWorkReceipts.classification, "closedOrStale");
  const receipt = snapshot.activeWorkReceipts.receipts.find(
    (item) => item.kind === "worktree" && item.identifiers.worktree.head === "dcb590c",
  );
  assert.equal(receipt?.classification, "closedOrStale");
  assert.equal(receipt?.identifiers.worktree.branch, undefined);
  assert.equal(receipt?.identifiers.siblingWorktree?.category, "manual-review-noise");
  assert.equal(receipt?.identifiers.siblingWorktree?.remoteBranchExists, "unknown");
  assert.equal(receipt?.identifiers.siblingWorktree?.openPullRequestState, "none");
  assert.equal(receipt?.identifiers.siblingWorktree?.closedPullRequestState, "closed");
  assert.equal(receipt?.identifiers.siblingWorktree?.activeTmuxPaneCount, 0);
  assert.equal(receipt?.identifiers.siblingWorktree?.aheadOfBase, 5);
  assert.match(receipt?.reasons.join("\n") ?? "", /#733/);
  assert.match(receipt?.reasons.join("\n") ?? "", /detached fooks PR review worktree leftover/);
  assert.match(receipt?.reasons.join("\n") ?? "", /do not auto-delete, push, or mutate/i);
  assert.match(snapshot.activeWorkReceipts.reportLine, /closedOrStale=1/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /staleResidueLedger=1/);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueLedger.counts, {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 1,
  });
  assert.equal(snapshot.activeWorkReceipts.salvageReviewQueue.itemCount, 0);

  const receiptJson = JSON.stringify([
    receipt,
    snapshot.activeWorkReceipts.salvageReviewQueue,
    snapshot.activeWorkReceipts.staleResidueLedger,
  ]);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands/.test(receiptJson), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|push/.test(call)), false);
});

test("operator check stale residue ledger aggregates manual-review-noise and excludes keep entries", () => {
  const tempDir = makeTempProject();
  const siblingRoot = path.dirname(tempDir);
  const closedPrWorktree = path.join(siblingRoot, "fooks-issue-631-rn-compare-inspect-visibility");
  const reviewLeftover = path.join(siblingRoot, "fooks-pr-728-review");
  const keepWorktree = path.join(siblingRoot, "remote-active");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-11T13:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${closedPrWorktree}`,
          "HEAD 222",
          "branch refs/heads/fooks-issue-631-rn-compare-inspect-visibility",
          "",
          `worktree ${reviewLeftover}`,
          "HEAD dcb590c",
          "detached",
          "",
          `worktree ${keepWorktree}`,
          "HEAD 444",
          "branch refs/heads/dogfood/remote-active",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") {
        return "main\nfooks-issue-631-rn-compare-inspect-visibility\ndogfood/remote-active\n";
      }
      if (command === "git" && joined === "branch -r --format=%(refname:short)") {
        return "origin/main\norigin/fooks-issue-631-rn-compare-inspect-visibility\norigin/dogfood/remote-active\n";
      }
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") {
        if (cwd === reviewLeftover) return "3 files changed, 15 insertions(+), 2 deletions(-)\n";
        if (cwd === keepWorktree) return "1 file changed, 1 insertion(+)\n";
        return "";
      }
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") {
        if (cwd === closedPrWorktree) return "0 48\n";
        if (cwd === reviewLeftover) return "0 5\n";
        if (cwd === keepWorktree) return "0 1\n";
        return "0 0\n";
      }
      if (command === "tmux") return "";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") {
        return JSON.stringify([
          {
            number: 634,
            url: "https://github.com/minislively/fooks/pull/634",
            headRefName: "fooks-issue-631-rn-compare-inspect-visibility",
            state: "CLOSED",
            closedAt: "2026-05-01T00:00:00Z",
          },
          {
            number: 728,
            url: "https://github.com/minislively/fooks/pull/728",
            headRefName: "dogfood/issue-728-review",
            state: "MERGED",
            closedAt: "2026-05-10T00:00:00Z",
          },
        ]);
      }
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => [tempDir, closedPrWorktree, reviewLeftover, keepWorktree].includes(targetPath),
  });

  const ledger = snapshot.activeWorkReceipts.staleResidueLedger;
  assert.equal(ledger.totalCount, 2);
  assert.deepEqual(ledger.counts, {
    "safe-cleanup": 0,
    "salvage-review": 0,
    "manual-review-noise": 2,
  });
  assert.deepEqual(ledger.classes.map((row) => row.category), [
    "safe-cleanup",
    "salvage-review",
    "manual-review-noise",
  ]);
  assert.equal(ledger.classes[2].nextReviewAction, "confirm-closed-pr-or-detached-review-context-before-ignoring");
  assert.match(snapshot.activeWorkReceipts.reportLine, /staleResidueLedger=2/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /cleanupReviewManifest=2\(#739\)/);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueCount, 2);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);

  const manifest = snapshot.activeWorkReceipts.cleanupReviewManifest;
  assert.equal(manifest.issue, "#739");
  assert.equal(manifest.rowCount, 2);
  assert.deepEqual(manifest.rows.map((row) => row.category), ["manual-review-noise", "manual-review-noise"]);
  assert.deepEqual(new Set(manifest.rows.map((row) => row.riskClass)), new Set(["medium-confirm-stale-context"]));
  assert.deepEqual(
    new Set(manifest.rows.map((row) => row.requiredManualAction)),
    new Set(["confirm-closed-pr-or-detached-review-context-before-ignoring"]),
  );
  assert.equal(JSON.stringify(manifest).includes(keepWorktree), false);

  const worktreeReceipts = snapshot.activeWorkReceipts.receipts.filter((receipt) => receipt.kind === "worktree");
  assert.equal(worktreeReceipts.filter((receipt) => receipt.identifiers.siblingWorktree?.category === "manual-review-noise").length, 2);
  assert.equal(worktreeReceipts.filter((receipt) => receipt.identifiers.siblingWorktree?.category === "keep").length, 1);
  assert.equal(JSON.stringify(ledger).includes(keepWorktree), false);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands/.test(JSON.stringify([ledger, manifest])), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|push/.test(call)), false);
});

test("operator activity exposes bounded stale legacy closed worktree evidence for zero-count reminders", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "docs", "closed-artifact-branch-archive-685.md"),
    [
      "# Archive: `fooks-closed-artifact-685` stale branch (#685)",
      "",
      "## Bounded evidence",
      "- Remote branch: `origin/fooks-closed-artifact-685`",
      "",
    ].join("\n"),
  );

  const staleWorktree = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-closed-artifact-685");
  const calls = [];
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    now: () => "2026-05-10T01:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${staleWorktree}`,
          "HEAD 222",
          "branch refs/heads/fooks-closed-artifact-685",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-closed-artifact-685\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === staleWorktree || targetPath === path.join(tempDir, "docs"),
  });

  assert.deepEqual(snapshot.optionalCounts, {
    enabled: true,
    source: OPERATOR_ACTIVITY_REMOTE_SOURCE,
    openIssues: 0,
    openPullRequests: 0,
    blockers: [],
  });
  assert.equal(snapshot.tmux.available, true);
  assert.deepEqual(snapshot.tmux.sessions, []);
  assert.equal(snapshot.legacyWorktreeEvidence.available, true);
  assert.equal(snapshot.legacyWorktreeEvidence.source, "status artifacts");
  assert.equal(snapshot.legacyWorktreeEvidence.staleClosedArtifactWorktreeCount, 1);
  assert.equal(snapshot.legacyWorktreeEvidence.entryLimit, OPERATOR_ACTIVITY_LEGACY_WORKTREE_ENTRY_LIMIT);
  assert.equal(snapshot.legacyWorktreeEvidence.omittedEntryCount, 0);
  assert.equal(snapshot.legacyWorktreeEvidence.cleanupCommandsIncluded, false);
  assert.deepEqual(snapshot.legacyWorktreeEvidence.blockers, []);
  assert.equal(snapshot.currentRunEvidence.classification, "mainEchoNonActive");
  assert.equal(snapshot.currentRunEvidence.mainEchoEvidence, true);
  assert.equal(snapshot.currentRunEvidence.activeWorkEvidence, false);
  assert.equal(snapshot.currentRunEvidence.evidence.legacyStaleClosedArtifactWorktreeCount, 1);
  assert.ok(
    snapshot.currentRunEvidence.reasons.includes(
      "legacy closed-artifact worktree evidence is separated from active current-run evidence",
    ),
  );
  assert.deepEqual(snapshot.legacyWorktreeEvidence.entries, [
    {
      path: staleWorktree,
      branch: "fooks-closed-artifact-685",
      head: "222",
      status: "staleClosedArtifact",
      reasons: [
        "branch has local branch-archive evidence",
        "no tmux panes map to this worktree",
        "worktree is not the current working directory",
      ],
      archiveEvidence: {
        sourcePath: path.join("docs", "closed-artifact-branch-archive-685.md"),
        matchType: "remote-branch",
        matchedRef: "origin/fooks-closed-artifact-685",
        lineNumber: 4,
      },
      activeSessionEvidence: "no tmux panes mapped to this worktree",
    },
  ]);

  const legacyJson = JSON.stringify(snapshot.legacyWorktreeEvidence);
  assert.equal(legacyJson.includes("manualCleanupCommands"), false);
  assert.equal(legacyJson.includes("cleanupOrder"), false);
  assert.equal(legacyJson.includes("staleRuntimeCleanups"), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|kill-session/.test(call)), false);
});

test("operator check surfaces legacy local residue as cleanup-review evidence only", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "docs", "fooks-issue-778-branch-archive.md"),
    [
      "# Archive: `fooks-issue-767-legacy-residue` stale branch (#767)",
      "",
      "- Remote branch: `origin/fooks-issue-767-legacy-residue`",
      "",
    ].join("\n"),
  );

  const staleWorktree = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-issue-767-legacy-residue");
  const calls = [];
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-13T00:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args, cwd) => {
      calls.push([command, ...args].join(" "));
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${staleWorktree}`,
          "HEAD 767767",
          "branch refs/heads/fooks-issue-767-legacy-residue",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-issue-767-legacy-residue\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return cwd === staleWorktree ? "0 0\n" : "0 0\n";
      if (command === "tmux") return "not-related\t/tmp/no-active-pane\tzsh\n";
      if (command === "gh" && joined === "issue list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number --limit 1000") return "[]";
      if (command === "gh" && joined === "pr list --state open --json number,url,headRefName --limit 200") return "[]";
      if (command === "gh" && joined === "pr list --state closed --json number,url,headRefName,state,closedAt --limit 200") return "[]";
      if (command === "gh" && joined.startsWith("run list ")) return "[]";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === staleWorktree || targetPath === path.join(tempDir, "docs"),
  });

  assert.equal(snapshot.verdict, "idleRequiresActiveArtifact");
  assert.equal(snapshot.postMergeMainEchoBoundary.mainEchoEvidence, true);
  assert.deepEqual(snapshot.activeArtifacts, []);
  assert.equal(snapshot.requiredActiveArtifact.required, true);
  assert.deepEqual(snapshot.requiredActiveArtifact.acceptableArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);

  const review = snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview;
  assert.equal(review.issue, "#778");
  assert.equal(review.readOnly, true);
  assert.equal(review.rowCount, 1);
  assert.equal(review.cleanupCommandsIncluded, false);
  assert.equal(review.staleLocalResidueIsActiveWorkEvidence, false);
  assert.equal(review.satisfiesActiveArtifactRequirement, false);
  assert.match(review.claimBoundary, /never counts it as active work/);
  assert.match(snapshot.activeWorkReceipts.reportLine, /legacyLocalResidueCleanupReview=1\(#778\)/);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.activeArtifactReceiptCount, 0);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.satisfiesActiveArtifactRequirement, false);
  assert.equal(snapshot.activeWorkReceipts.staleResidueActiveBoundary.staleResidueIsActiveWorkEvidence, false);
  assert.deepEqual(snapshot.activeWorkReceipts.staleResidueActiveBoundary.acceptableActiveArtifacts, [
    "open GitHub issue",
    "open GitHub pull request",
    "mapped fooks tmux session",
  ]);
  assert.equal(
    snapshot.activeWorkReceipts.receipts.some((receipt) => receipt.classification === "active"),
    false,
  );

  assert.deepEqual(review.rows, [
    {
      reviewId: "legacy-local-residue:fooks-issue-767-legacy-residue",
      path: staleWorktree,
      branch: "fooks-issue-767-legacy-residue",
      head: "767767",
      status: "staleClosedArtifact",
      reasons: [
        "branch has local branch-archive evidence",
        "no tmux panes map to this worktree",
        "worktree is not the current working directory",
      ],
      archiveEvidence: {
        sourcePath: path.join("docs", "fooks-issue-778-branch-archive.md"),
        matchType: "remote-branch",
        matchedRef: "origin/fooks-issue-767-legacy-residue",
        lineNumber: 3,
      },
      activeSessionEvidence: "no tmux panes mapped to this worktree",
      staleLocalResidueIsActiveWorkEvidence: false,
      satisfiesActiveArtifactRequirement: false,
      requiredManualAction: "confirm-closed-or-merged-artifact-before-manual-cleanup-review",
    },
  ]);

  const reviewJson = JSON.stringify(review);
  assert.equal(/worktree remove|branch -d|deleteCommand|manualCleanupCommands|cleanupOrder/.test(reviewJson), false);
  assert.equal(calls.some((call) => /fetch|worktree remove|branch -d|push|kill-session/.test(call)), false);
});

test("operator activity keeps legacy worktree inference conservative when tmux is unavailable", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "docs", "closed-artifact-branch-archive-685.md"), "Branch inspected: `origin/fooks-closed-artifact-685`\n");
  const staleWorktree = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-closed-artifact-685");

  const snapshot = readOperatorActivitySnapshot(tempDir, {
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "git" && joined === "worktree list --porcelain") {
        return [`worktree ${tempDir}`, "HEAD 111", "branch refs/heads/main", "", `worktree ${staleWorktree}`, "HEAD 222", "branch refs/heads/fooks-closed-artifact-685", ""].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-closed-artifact-685\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "tmux") throw new Error("tmux missing");
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === staleWorktree,
  });

  assert.equal(snapshot.legacyWorktreeEvidence.available, true);
  assert.equal(snapshot.legacyWorktreeEvidence.staleClosedArtifactWorktreeCount, 0);
  assert.deepEqual(snapshot.legacyWorktreeEvidence.entries, []);
  assert.match(snapshot.legacyWorktreeEvidence.blockers.join("\n"), /tmux pane list unavailable: tmux missing/);
});

test("operator activity classifies stale deleted tmux worktree panes with manual cleanup guidance", () => {
  const tempDir = makeTempProject();
  const staleWorktree = path.join(tempDir, ".omx-worktrees", "fooks-issue-467-stale-worktree-cleanup");
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command) => {
      if (command === "tmux") return `fooks-issue-467\t${staleWorktree} (deleted)\tzsh\n`;
      throw new Error(`unexpected command ${command}`);
    },
    pathExists: (targetPath) => targetPath === tempDir,
  });

  assert.equal(snapshot.tmux.sessions.length, 1);
  assert.equal(snapshot.tmux.sessions[0].session, "fooks-issue-467");
  assert.equal(snapshot.tmux.sessions[0].current, false);
  assert.equal(snapshot.tmux.sessions[0].status, "staleRuntimeCandidate");
  assert.deepEqual(snapshot.tmux.sessions[0].reasons, ["all panes point at missing or deleted paths"]);
  assert.deepEqual(snapshot.tmux.sessions[0].panes, [
    {
      path: `${staleWorktree} (deleted)`,
      exists: false,
      deleted: true,
      current: false,
      command: "zsh",
    },
  ]);
  assert.deepEqual(snapshot.tmux.sessions[0].manualCleanupCommands, ["tmux kill-session -t 'fooks-issue-467'"]);
  assert.deepEqual(snapshot.tmux.sessions[0].cleanupOrder, [
    "Verify the PR/worktree is no longer active",
    "Stop the stale tmux/OMX/Codex session manually",
    "Run any git worktree prune/remove follow-up only after the runtime is stopped",
  ]);
});

test("operator activity treats tmux and opt-in GitHub count failures as non-fatal blockers", () => {
  const tempDir = makeTempProject();
  const snapshot = readOperatorActivitySnapshot(tempDir, {
    includeRemoteCounts: true,
    runner: () => "",
    gitRunner: () => { throw new Error("no branch"); },
    commandRunner: (command, args) => {
      if (command === "tmux") throw new Error("tmux missing");
      if (command === "gh" && args[0] === "issue") return "[{\"number\":1},{\"number\":2}]";
      throw new Error("gh unavailable");
    },
  });

  assert.equal(snapshot.tmux.available, false);
  assert.match(snapshot.tmux.blockers.join("\n"), /tmux missing/);
  assert.equal(snapshot.optionalCounts.enabled, true);
  assert.equal(snapshot.optionalCounts.source, OPERATOR_ACTIVITY_REMOTE_SOURCE);
  assert.equal(snapshot.optionalCounts.openIssues, 2);
  assert.equal(snapshot.optionalCounts.openPullRequests, undefined);
  assert.match(snapshot.optionalCounts.blockers.join("\n"), /gh unavailable/);
  assert.match(snapshot.blockers.join("\n"), /tmux missing/);
  assert.match(snapshot.blockers.join("\n"), /gh unavailable/);
});

test("operator check receipt classifies stale session and legacy closed branch without unsafe cleanup details", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "docs", "closed-artifact-branch-archive-714.md"), "Branch inspected: `origin/fooks-issue-714-old`\n");
  const staleWorktree = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-issue-714-old");
  const deletedPanePath = path.join(path.dirname(tempDir), "fooks.omx-worktrees", "fooks-issue-714-deleted");
  const snapshot = readOperatorCheckSnapshot(tempDir, {
    now: () => "2026-05-10T04:00:00.000Z",
    runner: () => "",
    gitRunner: (_cwd, args) => {
      if (args[0] === "symbolic-ref") return "main\n";
      if (args[0] === "rev-parse") return "origin/main\n";
      if (args[0] === "rev-list") return "0\t0\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    commandRunner: (command, args) => {
      const joined = args.join(" ");
      if (command === "git" && joined === "config --get remote.origin.url") return "git@github.com:minislively/fooks.git\n";
      if (command === "git" && joined === "worktree list --porcelain") {
        return [
          `worktree ${tempDir}`,
          "HEAD 111",
          "branch refs/heads/main",
          "",
          `worktree ${staleWorktree}`,
          "HEAD 222",
          "branch refs/heads/fooks-issue-714-old",
          "",
        ].join("\n");
      }
      if (command === "git" && joined === "rev-parse --verify origin/main") return "origin-main-sha\n";
      if (command === "git" && joined === "branch --format=%(refname:short)") return "main\nfooks-issue-714-old\n";
      if (command === "git" && joined === "branch -r --format=%(refname:short)") return "origin/main\n";
      if (command === "git" && joined === "branch --merged origin/main") return "main\n";
      if (command === "git" && joined === "status --porcelain=v1 -z") return "";
      if (command === "git" && joined === "diff --shortstat origin/main...HEAD") return "";
      if (command === "git" && joined === "rev-list --left-right --count origin/main...HEAD") return "0 0\n";
      if (command === "tmux") return `fooks-issue-714-deleted\t${deletedPanePath} (deleted)\tzsh\n`;
      if (command === "gh" && args[0] === "issue") return "[]";
      if (command === "gh" && args[0] === "pr") return "[]";
      throw new Error(`unexpected command ${command} ${joined}`);
    },
    pathExists: (targetPath) => targetPath === tempDir || targetPath === staleWorktree,
  });

  assert.equal(snapshot.activeWorkReceipts.classification, "closedOrStale");
  const staleSession = snapshot.activeWorkReceipts.receipts.find((receipt) => receipt.kind === "session");
  assert.equal(staleSession?.classification, "closedOrStale");
  assert.deepEqual(staleSession?.identifiers.session, { name: "fooks-issue-714-deleted", paneCount: 1 });
  const closedBranch = snapshot.activeWorkReceipts.receipts.find(
    (receipt) => receipt.kind === "branch" && receipt.identifiers.worktree.branch === "fooks-issue-714-old",
  );
  assert.equal(closedBranch?.classification, "closedOrStale");

  assert.equal(snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview.rowCount, 1);
  assert.equal(snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview.rows[0].path, staleWorktree);
  assert.equal(snapshot.activeWorkReceipts.legacyLocalResidueCleanupReview.rows[0].satisfiesActiveArtifactRequirement, false);

  const receiptJson = JSON.stringify(snapshot.activeWorkReceipts);
  assert.equal(receiptJson.includes(deletedPanePath), false);
  assert.equal(receiptJson.includes("tmux kill-session"), false);
  assert.equal(receiptJson.includes("manualCleanupCommands"), false);
  assert.equal(receiptJson.includes("cleanupOrder"), false);
  assert.equal(snapshot.activeWorkReceipts.reportLine.includes(staleWorktree), false);
  assert.equal(snapshot.activeWorkReceipts.reportLine.includes("kill-session"), false);
});

test("status activity CLI route preserves existing status contracts", () => {
  const tempDir = makeTempProject();
  const before = fs.readdirSync(tempDir).sort();

  const check = run(["check"], tempDir);
  assert.equal(check.command, OPERATOR_CHECK_COMMAND);
  assert.equal(check.readOnly, true);
  assert.equal(check.activity.optionalCounts.enabled, true);
  assert.deepEqual(fs.readdirSync(tempDir).sort(), before);

  const activity = run(["status", "activity"], tempDir);
  assert.equal(activity.command, OPERATOR_ACTIVITY_COMMAND);
  assert.equal(activity.optionalCounts.enabled, false);
  assert.equal(activity.readOnly, true);
  assert.deepEqual(fs.readdirSync(tempDir).sort(), before);

  const bare = run(["status"], tempDir);
  assert.equal(bare.schemaVersion, 1);
  assert.equal(bare.metricTier, "estimated");
  assert.equal("worktree" in bare, false);
  assert.equal("tmux" in bare, false);
  assert.equal("optionalCounts" in bare, false);

  const worktree = run(["status", "worktree"], tempDir);
  assert.equal(worktree.schemaVersion, 1);
  assert.equal("tmux" in worktree, false);
  assert.equal("optionalCounts" in worktree, false);

  const artifacts = run(["status", "artifacts"], tempDir);
  assert.equal(artifacts.command, "status artifacts");
  assert.ok(Array.isArray(artifacts.manualCleanupCommands));
  assert.equal("optionalCounts" in artifacts, false);

  const help = runText(["--help"], tempDir);
  assert.match(help, /fooks check \[--json\]/);
  assert.match(help, /fooks status activity \[--include-remote-counts\]/);

  let output = "";
  try {
    runText(["check", "--unexpected"], tempDir);
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(output, /Unexpected check argument/);

  output = "";
  try {
    runText(["status", "activity", "--unexpected"], tempDir);
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(output, /Unexpected status activity argument/);
  assert.match(OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG, /--include-remote-counts/);
});
