// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function makeRepo() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-work-item-dashboard-"));
  git(tempDir, ["init", "-b", "main"]);
  git(tempDir, ["config", "user.email", "test@example.com"]);
  git(tempDir, ["config", "user.name", "Test User"]);
  git(tempDir, ["remote", "add", "origin", "git@github.com:minislively/fooks.git"]);
  fs.writeFileSync(path.join(tempDir, "README.md"), "# fixture\n");
  git(tempDir, ["add", "README.md"]);
  git(tempDir, ["commit", "-m", "initial"]);
  git(tempDir, ["checkout", "-b", "feature/issue-922-docs-backed-work-item-action-dashboard"]);
  return tempDir;
}

function runStatus(cwd, env = {}) {
  return JSON.parse(execFileSync(process.execPath, [cli, "status"], { cwd, encoding: "utf8", env: { ...process.env, ...env } }));
}

test("bare status includes docs-backed WorkItem dashboard while preserving metric status shape", () => {
  const tempDir = makeRepo();
  const status = runStatus(tempDir, { OMX_SESSION_ID: "omx-test-session" });

  assert.equal(status.schemaVersion, 1);
  assert.equal(status.metricTier, "estimated");
  assert.equal("sessions" in status, false);
  assert.equal("latestSessionKeys" in status, false);

  const dashboard = status.workItemDashboard;
  assert.equal(dashboard.schemaVersion, 1);
  assert.equal(dashboard.readOnly, true);
  assert.match(dashboard.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(dashboard.claimBoundary, /Docs-backed active-work dashboard projection only/);
  assert.equal(dashboard.anchors.issue, "#922");
  assert.equal(dashboard.anchors.issueUrl, "https://github.com/minislively/fooks/issues/922");
  assert.equal(dashboard.anchors.branch, "feature/issue-922-docs-backed-work-item-action-dashboard");
  assert.equal(dashboard.anchors.session, "omx-test-session");
  assert.equal(dashboard.anchors.worktree, tempDir);
  assert.equal(dashboard.workItems[0].requiredNextAction.kind, "open-pr");
  assert.deepEqual(dashboard.tuiCompatibility.sharedTypes, ["WorkItem", "Evidence", "NextAction"]);
  assert.equal(dashboard.tuiCompatibility.modelOnly, true);
  assert.ok(dashboard.architectureAudit.some((item) => item.scope === "status" && /metric telemetry/.test(item.currentSurface)));
  assert.ok(dashboard.architectureAudit.some((item) => item.scope === "check" && /operator/.test(item.currentSurface)));
  assert.ok(dashboard.architectureAudit.some((item) => item.scope === "tui" && /do not rewrite/.test(item.firstPassAction)));
  assert.ok(dashboard.workItems[0].evidence.some((item) => item.kind === "architectureDoc" && item.supports.includes("WorkItem/Evidence/NextAction")));
  assert.ok(dashboard.workItems[0].nonClaims.some((item) => item.includes("provider usage")));
});

test("shared WorkItem dashboard builder is importable for non-CLI consumers", () => {
  const { buildWorkItemDashboard, WORK_ITEM_DASHBOARD_SOURCE } = require(path.join(repoRoot, "dist", "core", "work-item-dashboard.js"));
  const tempDir = makeRepo();
  const dashboard = buildWorkItemDashboard(tempDir, {
    schemaVersion: 1,
    metricTier: "estimated",
    updatedAt: new Date(0).toISOString(),
    sessionCount: 0,
    latestSessionCount: 0,
    eventCount: 0,
    comparableEventCount: 0,
    injectCount: 0,
    fallbackCount: 0,
    recordCount: 0,
    noopCount: 0,
    observedOpportunityCount: 0,
    observedOriginalEstimatedBytes: 0,
    observedOriginalEstimatedTokens: 0,
    totals: { originalEstimatedBytes: 0, actualEstimatedBytes: 0, savedEstimatedBytes: 0, originalEstimatedTokens: 0, actualEstimatedTokens: 0, savedEstimatedTokens: 0, savingsRatio: 0 },
    breakdown: { byRuntime: {}, byMeasurementSource: {}, byRuntimeAndSource: {} },
    claimBoundary: "test metric boundary",
  });
  assert.equal(dashboard.source, WORK_ITEM_DASHBOARD_SOURCE);
  assert.equal(dashboard.workItems[0].evidence.some((item) => item.kind === "worktree"), true);
  assert.equal(dashboard.tuiCompatibility.modelOnly, true);
});


test("WorkItem dashboard marks unavailable git status as inspect action instead of clean", () => {
  const { buildWorkItemDashboard } = require(path.join(repoRoot, "dist", "core", "work-item-dashboard.js"));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-work-item-no-git-"));
  const dashboard = buildWorkItemDashboard(tempDir, {
    schemaVersion: 1,
    metricTier: "estimated",
    updatedAt: new Date(0).toISOString(),
    sessionCount: 0,
    latestSessionCount: 0,
    eventCount: 0,
    comparableEventCount: 0,
    injectCount: 0,
    fallbackCount: 0,
    recordCount: 0,
    noopCount: 0,
    observedOpportunityCount: 0,
    observedOriginalEstimatedBytes: 0,
    observedOriginalEstimatedTokens: 0,
    totals: { originalEstimatedBytes: 0, actualEstimatedBytes: 0, savedEstimatedBytes: 0, originalEstimatedTokens: 0, actualEstimatedTokens: 0, savedEstimatedTokens: 0, savingsRatio: 0 },
    breakdown: { byRuntime: {}, byMeasurementSource: {}, byRuntimeAndSource: {} },
    claimBoundary: "test metric boundary",
  });

  assert.equal(dashboard.workItems[0].state, "blocked");
  assert.equal(dashboard.nextActions[0].kind, "inspect");
  assert.match(dashboard.nextActions[0].reason, /git worktree evidence unavailable/);
  assert.ok(dashboard.workItems[0].evidence.some((item) => item.kind === "worktree" && item.fresh === "unknown"));
});


test("WorkItem dashboard does not infer issue anchors from unrelated version numbers", () => {
  const { buildWorkItemDashboard } = require(path.join(repoRoot, "dist", "core", "work-item-dashboard.js"));
  const tempDir = makeRepo();
  git(tempDir, ["checkout", "-b", "react-18-upgrade"]);
  const dashboard = buildWorkItemDashboard(tempDir, {
    schemaVersion: 1,
    metricTier: "estimated",
    updatedAt: new Date(0).toISOString(),
    sessionCount: 0,
    latestSessionCount: 0,
    eventCount: 0,
    comparableEventCount: 0,
    injectCount: 0,
    fallbackCount: 0,
    recordCount: 0,
    noopCount: 0,
    observedOpportunityCount: 0,
    observedOriginalEstimatedBytes: 0,
    observedOriginalEstimatedTokens: 0,
    totals: { originalEstimatedBytes: 0, actualEstimatedBytes: 0, savedEstimatedBytes: 0, originalEstimatedTokens: 0, actualEstimatedTokens: 0, savedEstimatedTokens: 0, savingsRatio: 0 },
    breakdown: { byRuntime: {}, byMeasurementSource: {}, byRuntimeAndSource: {} },
    claimBoundary: "test metric boundary",
  });

  assert.equal(dashboard.anchors.issue, undefined);
  assert.equal(dashboard.nextActions[0].kind, "link");
});


test("WorkItem dashboard treats clean unlinked checkout as evidence-ready, not active work", () => {
  const { buildWorkItemDashboard } = require(path.join(repoRoot, "dist", "core", "work-item-dashboard.js"));
  const tempDir = makeRepo();
  git(tempDir, ["checkout", "main"]);
  const previousFooksSession = process.env.FOOKS_SESSION_ID;
  const previousOmxSession = process.env.OMX_SESSION_ID;
  const previousTmuxPane = process.env.TMUX_PANE;
  delete process.env.FOOKS_SESSION_ID;
  delete process.env.OMX_SESSION_ID;
  delete process.env.TMUX_PANE;
  const dashboard = buildWorkItemDashboard(tempDir, {
    schemaVersion: 1,
    metricTier: "estimated",
    updatedAt: new Date(0).toISOString(),
    sessionCount: 0,
    latestSessionCount: 0,
    eventCount: 0,
    comparableEventCount: 0,
    injectCount: 0,
    fallbackCount: 0,
    recordCount: 0,
    noopCount: 0,
    observedOpportunityCount: 0,
    observedOriginalEstimatedBytes: 0,
    observedOriginalEstimatedTokens: 0,
    totals: { originalEstimatedBytes: 0, actualEstimatedBytes: 0, savedEstimatedBytes: 0, originalEstimatedTokens: 0, actualEstimatedTokens: 0, savedEstimatedTokens: 0, savingsRatio: 0 },
    breakdown: { byRuntime: {}, byMeasurementSource: {}, byRuntimeAndSource: {} },
    claimBoundary: "test metric boundary",
  });

  try {
    assert.equal(dashboard.anchors.issue, undefined);
    assert.equal(dashboard.anchors.session, undefined);
    assert.equal(dashboard.workItems[0].state, "evidence-ready");
    assert.equal(dashboard.nextActions[0].kind, "link");
  } finally {
    if (previousFooksSession === undefined) delete process.env.FOOKS_SESSION_ID; else process.env.FOOKS_SESSION_ID = previousFooksSession;
    if (previousOmxSession === undefined) delete process.env.OMX_SESSION_ID; else process.env.OMX_SESSION_ID = previousOmxSession;
    if (previousTmuxPane === undefined) delete process.env.TMUX_PANE; else process.env.TMUX_PANE = previousTmuxPane;
  }
});


test("ambient session alone does not make a clean unlinked checkout active work", () => {
  const { buildWorkItemDashboard } = require(path.join(repoRoot, "dist", "core", "work-item-dashboard.js"));
  const tempDir = makeRepo();
  git(tempDir, ["checkout", "main"]);
  const previousFooksSession = process.env.FOOKS_SESSION_ID;
  process.env.FOOKS_SESSION_ID = "ambient-session-only";
  const dashboard = buildWorkItemDashboard(tempDir, {
    schemaVersion: 1,
    metricTier: "estimated",
    updatedAt: new Date(0).toISOString(),
    sessionCount: 0,
    latestSessionCount: 0,
    eventCount: 0,
    comparableEventCount: 0,
    injectCount: 0,
    fallbackCount: 0,
    recordCount: 0,
    noopCount: 0,
    observedOpportunityCount: 0,
    observedOriginalEstimatedBytes: 0,
    observedOriginalEstimatedTokens: 0,
    totals: { originalEstimatedBytes: 0, actualEstimatedBytes: 0, savedEstimatedBytes: 0, originalEstimatedTokens: 0, actualEstimatedTokens: 0, savedEstimatedTokens: 0, savingsRatio: 0 },
    breakdown: { byRuntime: {}, byMeasurementSource: {}, byRuntimeAndSource: {} },
    claimBoundary: "test metric boundary",
  });

  try {
    assert.equal(dashboard.anchors.issue, undefined);
    assert.equal(dashboard.anchors.session, "ambient-session-only");
    assert.equal(dashboard.workItems[0].state, "evidence-ready");
    assert.equal(dashboard.nextActions[0].kind, "link");
    assert.ok(dashboard.workItems[0].evidence.some((item) => item.kind === "session"));
  } finally {
    if (previousFooksSession === undefined) delete process.env.FOOKS_SESSION_ID;
    else process.env.FOOKS_SESSION_ID = previousFooksSession;
  }
});
