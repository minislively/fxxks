import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const triageScript = path.join(repoRoot, "scripts", "triage-ci-alerts.mjs");

test("CI alert triage marks cancelled and superseded historical runs as stale", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-triage-"));
  const inputPath = path.join(tempDir, "runs.json");
  fs.writeFileSync(inputPath, JSON.stringify([
    {
      databaseId: 104,
      workflowName: "CI",
      name: "Validate (Node 24)",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-04-27T10:00:00Z",
      updatedAt: "2026-04-27T10:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/104",
    },
    {
      databaseId: 103,
      workflowName: "CI",
      name: "Validate (Node 24)",
      headBranch: "feature-a",
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-04-27T09:00:00Z",
      updatedAt: "2026-04-27T09:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/103",
    },
    {
      databaseId: 102,
      workflowName: "CI",
      name: "Validate (Node 24)",
      headBranch: "feature-a",
      event: "pull_request",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-04-27T08:00:00Z",
      updatedAt: "2026-04-27T08:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/102",
    },
    {
      databaseId: 101,
      workflowName: "CI",
      name: "Validate (Node 20)",
      headBranch: "feature-b",
      event: "pull_request",
      status: "completed",
      conclusion: "cancelled",
      createdAt: "2026-04-27T07:00:00Z",
      updatedAt: "2026-04-27T07:02:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/101",
    },
  ]));

  try {
    const stdout = execFileSync(process.execPath, [triageScript, "--input", inputPath, "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const byId = new Map(result.rows.map((row) => [row.id, row]));

    assert.equal(result.counts.actionable, 1);
    assert.equal(result.counts.stale, 2);
    assert.equal(result.counts.informational, 1);
    assert.equal(byId.get(104).bucket, "actionable");
    assert.equal(byId.get(104).reason, "latest failure");
    assert.equal(byId.get(102).bucket, "stale");
    assert.equal(byId.get(102).reason, "superseded by run 103");
    assert.equal(byId.get(101).bucket, "stale");
    assert.equal(byId.get(101).reason, "completed cancelled");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage turns pasted GitHub Actions URLs into evidence", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-urls-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 205,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-04-27T12:00:00Z",
      updatedAt: "2026-04-27T12:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/205",
    },
    {
      databaseId: 204,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-04-27T11:00:00Z",
      updatedAt: "2026-04-27T11:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/204",
    },
    {
      databaseId: 203,
      workflowName: "Release",
      name: "Publish",
      headBranch: "release",
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-04-27T10:00:00Z",
      updatedAt: "2026-04-27T10:10:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/203",
    },
    {
      databaseId: 202,
      workflowName: "CI",
      name: "Validate",
      headBranch: "ci-alert-pr-job-url-regression",
      event: "pull_request",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-04-27T09:00:00Z",
      updatedAt: "2026-04-27T09:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/202",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "Discord alert: https://github.com/minislively/fooks/actions/runs/204",
    "clawhip replay job URL https://github.com/minislively/fooks/actions/runs/203/job/987654321",
    "clawhip fooks#263 · PR CI job URL https://github.com/minislively/fooks/actions/runs/202/job/333444555",
    "duplicate job URL https://github.com/minislively/fooks/actions/runs/204/job/123456789",
    "main branch job URL should keep parent run id https://github.com/minislively/fooks/actions/runs/205/job/444555666",
    "outside inspected window https://github.com/minislively/fooks/actions/runs/999",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const byAlertId = new Map(result.alerts.map((alert) => [alert.alertedRunId, alert]));

    assert.equal(result.alerts.length, 5);
    assert.equal(byAlertId.has("444555666"), false);
    assert.equal(byAlertId.get("205").alertedRunId, "205");
    assert.equal(byAlertId.get("205").alertedUrl, "https://github.com/minislively/fooks/actions/runs/205/job/444555666");
    assert.equal(byAlertId.get("205").evidence, "current");
    assert.equal(byAlertId.get("205").branch, "main");
    assert.equal(byAlertId.get("204").alertedUrl, "https://github.com/minislively/fooks/actions/runs/204");
    assert.equal(byAlertId.get("204").evidence, "stale");
    assert.equal(byAlertId.get("204").currentRunId, 205);
    assert.equal(byAlertId.get("204").reason, "superseded by run 205");
    assert.equal(byAlertId.get("204").appearances, 2);
    assert.equal(byAlertId.get("203").evidence, "actionable");
    assert.equal(byAlertId.get("203").alertedUrl, "https://github.com/minislively/fooks/actions/runs/203/job/987654321");
    assert.equal(byAlertId.get("202").evidence, "actionable");
    assert.equal(byAlertId.get("202").alertedRunId, "202");
    assert.equal(byAlertId.get("202").alertedUrl, "https://github.com/minislively/fooks/actions/runs/202/job/333444555");
    assert.equal(byAlertId.get("202").branch, "ci-alert-pr-job-url-regression");
    assert.equal(byAlertId.get("999").evidence, "missing");
    assert.equal(byAlertId.get("999").reason, "run URL was not present in the inspected gh run list window");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage keeps explicit rerun attempt evidence distinct", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-attempts-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 301,
      attempt: 2,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-04-28T12:00:00Z",
      updatedAt: "2026-04-28T12:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/301",
    },
    {
      databaseId: 302,
      workflowName: "CI",
      name: "Validate",
      headBranch: "missing-attempt",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-04-28T11:00:00Z",
      updatedAt: "2026-04-28T11:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/302",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "old rerun attempt https://github.com/minislively/fooks/actions/runs/301/attempts/1",
    "current run URL https://github.com/minislively/fooks/actions/runs/301",
    "current job URL https://github.com/minislively/fooks/actions/runs/301/job/777888999",
    "unknown current attempt https://github.com/minislively/fooks/actions/runs/302/attempts/1",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const attempt301 = result.alerts.find((alert) => alert.alertedRunId === "301" && alert.alertedAttempt === 1);
    const current301 = result.alerts.find((alert) => alert.alertedRunId === "301" && alert.alertedAttempt === null);
    const missingCurrentAttempt = result.alerts.find((alert) => alert.alertedRunId === "302" && alert.alertedAttempt === 1);

    assert.equal(result.alerts.length, 3);
    assert.equal(attempt301.alertedUrl, "https://github.com/minislively/fooks/actions/runs/301/attempts/1");
    assert.equal(attempt301.currentAttempt, 2);
    assert.equal(attempt301.evidence, "stale");
    assert.equal(attempt301.reason, "superseded by attempt 2");

    assert.equal(current301.alertedUrl, "https://github.com/minislively/fooks/actions/runs/301");
    assert.equal(current301.appearances, 2);
    assert.equal(current301.currentAttempt, 2);
    assert.equal(current301.evidence, "current");
    assert.equal(current301.reason, "not failing");

    assert.equal(missingCurrentAttempt.alertedUrl, "https://github.com/minislively/fooks/actions/runs/302/attempts/1");
    assert.equal(missingCurrentAttempt.currentAttempt, null);
    assert.equal(missingCurrentAttempt.evidence, "current");
    assert.equal(missingCurrentAttempt.reason, "not failing");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage identifies replayed historical main alerts for suppression", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-replay-storm-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 404,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-04-30T20:12:00Z",
      updatedAt: "2026-04-30T20:14:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/404",
    },
    {
      databaseId: 403,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "cancelled",
      createdAt: "2026-04-30T19:40:00Z",
      updatedAt: "2026-04-30T19:42:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/403",
    },
    {
      databaseId: 402,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-04-30T19:20:00Z",
      updatedAt: "2026-04-30T19:24:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/402",
    },
    {
      databaseId: 401,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-04-30T19:00:00Z",
      updatedAt: "2026-04-30T19:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/401",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "20:14 UTC replayed old success https://github.com/minislively/fooks/actions/runs/402",
    "20:14 UTC replayed old cancelled https://github.com/minislively/fooks/actions/runs/403",
    "20:14 UTC replayed old failure now superseded https://github.com/minislively/fooks/actions/runs/401",
    "current green main evidence https://github.com/minislively/fooks/actions/runs/404",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const byAlertId = new Map(result.alerts.map((alert) => [alert.alertedRunId, alert]));

    for (const id of ["401", "402", "403"]) {
      assert.equal(byAlertId.get(id).evidence, "stale");
      assert.equal(byAlertId.get(id).replay, true);
      assert.equal(byAlertId.get(id).disposition, "suppress-replay");
      assert.match(byAlertId.get(id).replayReason, /historical replay/);
      assert.equal(byAlertId.get(id).currentRunId, 404);
    }

    assert.equal(byAlertId.get("404").evidence, "current");
    assert.equal(byAlertId.get("404").replay, false);
    assert.equal(byAlertId.get("404").disposition, "review");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage does not call a latest cancelled alert a historical replay", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-replay-negative-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 501,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "cancelled",
      createdAt: "2026-04-30T20:00:00Z",
      updatedAt: "2026-04-30T20:01:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/501",
    },
  ]));
  fs.writeFileSync(alertsPath, "latest cancelled alert https://github.com/minislively/fooks/actions/runs/501\n");

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    assert.equal(result.alerts[0].evidence, "stale");
    assert.equal(result.alerts[0].reason, "completed cancelled");
    assert.equal(result.alerts[0].replay, false);
    assert.equal(result.alerts[0].disposition, "suppress-stale");
    assert.equal(result.alerts[0].replayReason, "");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage compacts bulk replay URLs around current main and cancelled samples", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-bulk-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  const runs = [
    {
      databaseId: 500,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-04-30T12:00:00Z",
      updatedAt: "2026-04-30T12:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/500",
    },
  ];
  for (let id = 401; id <= 414; id += 1) {
    runs.push({
      databaseId: id,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: id % 5 === 0 ? "cancelled" : "success",
      createdAt: `2026-04-29T${String(id - 400).padStart(2, "0")}:00:00Z`,
      updatedAt: `2026-04-29T${String(id - 400).padStart(2, "0")}:05:00Z`,
      url: `https://github.com/minislively/fooks/actions/runs/${id}`,
    });
  }

  fs.writeFileSync(runsPath, JSON.stringify(runs));
  fs.writeFileSync(alertsPath, [
    ...runs.slice(1).map((run) => `old replay https://github.com/minislively/fooks/actions/runs/${run.databaseId}`),
    "current main run mixed into the replay https://github.com/minislively/fooks/actions/runs/500",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "main",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);

    assert.equal(result.alertSummary.mode, "compact");
    assert.equal(result.alertSummary.total, 15);
    assert.equal(result.alertSummary.focusBranch, "main");
    assert.equal(result.alertSummary.byConclusion.success, 12);
    assert.ok(result.alertSummary.omitted > 0);
    assert.ok(result.alerts.length < result.alertSummary.total);

    const byAlertId = new Map(result.alerts.map((alert) => [alert.alertedRunId, alert]));
    assert.equal(byAlertId.get("500").evidence, "current");
    assert.equal(byAlertId.get("500").branch, "main");
    assert.equal(byAlertId.get("500").reason, "not failing");

    const cancelledSamples = result.alerts.filter((alert) => alert.conclusion === "cancelled");
    assert.equal(cancelledSamples.length, 2);
    assert.ok(cancelledSamples.every((alert) => alert.evidence === "stale"));
    assert.ok(cancelledSamples.every((alert) => alert.sampled === true));
    assert.ok([...byAlertId.keys()].every((id) => id === "500" || Number(id) % 5 === 0));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
