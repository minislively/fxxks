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

function testMetricStatus() {
  return {
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
  };
}

test("bare status includes docs-backed WorkItem dashboard while preserving metric status shape", () => {
  const tempDir = makeRepo();
  const status = runStatus(tempDir, { OMX_SESSION_ID: "omx-test-session" });

  assert.equal(status.schemaVersion, 1);
  assert.equal(status.metricTier, "estimated");
  assert.equal("sessions" in status, false);
  assert.equal("latestSessionKeys" in status, false);

  const dashboard = status.workItemDashboard;
  assert.equal(dashboard.schemaVersion, 2);
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

test("fooks explain status renders WorkItem evidence, rejected evidence, and next action", () => {
  const tempDir = makeRepo();
  const text = execFileSync(process.execPath, [cli, "explain", "status"], {
    cwd: tempDir,
    encoding: "utf8",
    env: { ...process.env, OMX_SESSION_ID: "omx-explain-test" },
  });

  assert.match(text, /^# fooks explain status/m);
  assert.match(text, /CLI-only WorkItem evidence explanation/);
  assert.match(text, /## Why/);
  assert.match(text, /artifact 'status' resolves to WorkItem 'work-item-922' in state 'active-work'/);
  assert.match(text, /## Evidence/);
  assert.match(text, /Source evidence\/architectureDoc/);
  assert.match(text, /## Rejected evidence \/ non-claims/);
  assert.match(text, /provider usage, billing tokens/);
  assert.match(text, /## Next action/);
  assert.match(text, /kind: open-pr/);
});

test("fooks explain work-item --json exposes machine-readable WorkItem explanation", () => {
  const tempDir = makeRepo();
  const explanation = JSON.parse(execFileSync(process.execPath, [cli, "explain", "work-item", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
    env: { ...process.env, FOOOKS_UNUSED: "ignored" },
  }));

  assert.equal(explanation.schemaVersion, 2);
  assert.equal(explanation.command, "explain");
  assert.equal(explanation.artifact, "work-item");
  assert.equal(explanation.readOnly, true);
  assert.equal(explanation.workItem.id, "work-item-922");
  assert.equal(explanation.workItem.state, "active-work");
  assert.ok(explanation.why.some((line) => line.includes("next action:")));
  assert.ok(explanation.evidence.some((item) => item.kind === "worktree"));
  assert.ok(explanation.rejectedEvidence.some((item) => item.reason.includes("provider usage")));
  assert.equal(explanation.nextAction.kind, "open-pr");
  assert.ok(explanation.claimBoundary.includes("without changing provider/runtime behavior"));
});

test("fooks explain sample is static and does not claim live repository evidence", () => {
  const explanation = JSON.parse(execFileSync(process.execPath, [cli, "explain", "sample", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  }));

  assert.equal(explanation.artifact, "sample");
  assert.equal(explanation.workItem.id, "work-item-sample");
  assert.equal(explanation.workItem.state, "uninspected");
  assert.equal(explanation.nextAction.command, "fooks explain status");
  assert.ok(explanation.rejectedEvidence.some((item) => item.reason.includes("current repository status")));
  assert.ok(explanation.nonClaims.some((item) => item.includes("does not prove current repository readiness")));
});


test("fooks explain current defaults to the current repository WorkItem artifact", () => {
  const tempDir = makeRepo();
  const explicit = JSON.parse(execFileSync(process.execPath, [cli, "explain", "current", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  }));
  const implicit = JSON.parse(execFileSync(process.execPath, [cli, "explain", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  }));

  assert.equal(explicit.artifact, "current");
  assert.equal(implicit.artifact, "current");
  assert.equal(explicit.workItem.id, "work-item-922");
  assert.equal(implicit.workItem.id, "work-item-922");
  assert.equal(explicit.nextAction.kind, "open-pr");
});

test("fooks explain exposes command help without reading live WorkItem evidence", () => {
  const help = execFileSync(process.execPath, [cli, "explain", "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.match(help, /^Usage: fooks explain \[status\|work-item\|sample\|current\] \[--json\|--help\]/m);
  assert.match(help, /Start with 'fooks explain sample'/);
  assert.match(help, /fooks explain status/);
  assert.match(help, /CLI\/operator explanation only/);
  assert.match(help, /does not change provider\/runtime behavior/);
  assert.doesNotMatch(help, /Unexpected explain argument/);
  assert.doesNotMatch(help, /^# fooks explain/m);

  const shortHelp = execFileSync(process.execPath, [cli, "explain", "-h"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(shortHelp, help);
});

test("WorkItem dashboard represents TUI as a first-class frontend work domain", () => {
  const { buildWorkItemDashboard } = require(path.join(repoRoot, "dist", "core", "work-item-dashboard.js"));
  const tempDir = makeRepo();
  git(tempDir, ["checkout", "-b", "feature/issue-933-tui-frontend-domain"]);
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

  assert.deepEqual(dashboard.frontendDomainTaxonomy, ["react-web", "react-native", "webview", "tui", "shared", "unknown"]);
  assert.equal(dashboard.anchors.issue, "#933");
  assert.equal(dashboard.workItems[0].frontendDomain, "tui");
  assert.equal(dashboard.workItems[0].title, "Active TUI work #933");
  assert.ok(dashboard.workItems[0].evidence.some((item) => item.kind === "domainHint" && item.evidenceClass === "Workflow evidence" && /tui frontend work domain hinted by branch/.test(item.observed)));
  assert.ok(dashboard.workItems[0].nonClaims.some((item) => /user-developed terminal UI target/.test(item)));
});

test("fooks status and explain expose TUI-domain work item details", () => {
  const tempDir = makeRepo();
  git(tempDir, ["checkout", "-b", "feature/issue-933-tui-frontend-domain"]);

  const status = runStatus(tempDir);
  assert.equal(status.workItemDashboard.workItems[0].frontendDomain, "tui");
  assert.ok(status.workItemDashboard.workItems[0].evidence.some((item) => item.kind === "domainHint" && item.evidenceClass === "Workflow evidence"));

  const explanation = JSON.parse(execFileSync(process.execPath, [cli, "explain", "status", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  }));
  assert.equal(explanation.workItem.id, "work-item-933");
  assert.equal(explanation.workItem.frontendDomain, "tui");
  assert.ok(explanation.why.some((line) => line.includes("frontend domain 'tui'")));
  assert.ok(explanation.rejectedEvidence.some((item) => /fooks' own TUI board/.test(item.reason)));
});


test("WorkItem dashboard keeps unknown branch domain explicit and non-source", () => {
  const { buildWorkItemDashboard } = require(path.join(repoRoot, "dist", "core", "work-item-dashboard.js"));
  const tempDir = makeRepo();
  git(tempDir, ["checkout", "-b", "feature/issue-934-maintenance"]);
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

  assert.equal(dashboard.workItems[0].frontendDomain, "unknown");
  assert.equal(dashboard.workItems[0].title, "Active Unknown-domain work #934");
  assert.ok(dashboard.workItems[0].evidence.some((item) => item.kind === "domainHint" && item.evidenceClass === "Workflow evidence"));
  assert.equal(dashboard.workItems[0].evidence.some((item) => item.kind === "domainHint" && item.evidenceClass === "Source evidence"), false);
});


test("WorkItem dashboard maps domain-aware judgment to evidence focus, recommended state, and next action", () => {
  const { buildWorkItemDashboard } = require(path.join(repoRoot, "dist", "core", "work-item-dashboard.js"));

  const cases = [
    {
      branch: "feature/issue-935-react-web-routes",
      file: "src/pages/account/settings.tsx",
      domain: "react-web",
      state: "evidence-ready",
      action: "verify",
      focus: "browser UI behavior",
    },
    {
      branch: "feature/issue-935-react-native-ios-platform",
      file: "ios/ProfileView.tsx",
      domain: "react-native",
      state: "fallback-required",
      action: "fallback",
      focus: "ios/android platform evidence",
    },
    {
      branch: "feature/issue-935-webview-session-handoff",
      file: "src/mobile/CheckoutWebView.tsx",
      domain: "webview",
      state: "fallback-required",
      action: "fallback",
      focus: "bridge message flow",
    },
    {
      branch: "feature/issue-935-tui-keyboard-golden",
      file: "src/cli/StatusBoard.tsx",
      domain: "tui",
      state: "evidence-ready",
      action: "verify",
      focus: "keyboard navigation",
    },
    {
      branch: "feature/issue-935-shared-api-contract",
      file: "src/shared/contracts/settings.ts",
      domain: "shared",
      state: "evidence-ready",
      action: "verify",
      focus: "API contract/schema",
    },
    {
      branch: "feature/issue-935-maintenance",
      file: "README.md",
      domain: "unknown",
      state: "fallback-required",
      action: "inspect",
      focus: "explicit domain evidence",
    },
  ];

  for (const item of cases) {
    const tempDir = makeRepo();
    git(tempDir, ["checkout", "-b", item.branch]);
    const target = path.join(tempDir, item.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "// changed domain fixture\n");

    const dashboard = buildWorkItemDashboard(tempDir, testMetricStatus());
    const workItem = dashboard.workItems[0];
    assert.equal(workItem.frontendDomain, item.domain, item.domain);
    assert.equal(workItem.domainJudgment.frontendDomain, item.domain, item.domain);
    assert.equal(workItem.domainJudgment.recommendedState, item.state, item.domain);
    assert.equal(workItem.domainJudgment.nextAction.kind, item.action, item.domain);
    assert.ok(workItem.domainJudgment.evidenceFocus.some((focus) => focus.includes(item.focus)), item.domain);
    assert.ok(workItem.inferred.some((line) => line.includes(`Domain judgment recommends state ${item.state}`)), item.domain);
    assert.ok(workItem.nonClaims.some((line) => line.includes("pre-ingestion guidance")), item.domain);
  }
});

test("fooks explain surfaces machine-readable domain judgment details", () => {
  const tempDir = makeRepo();
  git(tempDir, ["checkout", "-b", "feature/issue-935-webview-deeplink-bridge"]);
  fs.mkdirSync(path.join(tempDir, "src", "mobile"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "src", "mobile", "CheckoutWebView.tsx"), "// WebView bridge fixture\n");

  const explanation = JSON.parse(execFileSync(process.execPath, [cli, "explain", "status", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  }));

  assert.equal(explanation.workItem.frontendDomain, "webview");
  assert.equal(explanation.workItem.domainJudgment.recommendedState, "fallback-required");
  assert.equal(explanation.workItem.domainJudgment.nextAction.kind, "fallback");
  assert.ok(explanation.workItem.domainJudgment.requiredEvidence.some((line) => /bridge.*handoff/i.test(line)));
});
