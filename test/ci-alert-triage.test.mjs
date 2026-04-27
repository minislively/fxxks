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
  ]));
  fs.writeFileSync(alertsPath, [
    "Discord alert: https://github.com/minislively/fooks/actions/runs/204",
    "clawhip replay https://github.com/minislively/fooks/actions/runs/203/attempts/1",
    "duplicate https://github.com/minislively/fooks/actions/runs/204",
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

    assert.equal(result.alerts.length, 3);
    assert.equal(byAlertId.get("204").evidence, "stale");
    assert.equal(byAlertId.get("204").currentRunId, 205);
    assert.equal(byAlertId.get("204").reason, "superseded by run 205");
    assert.equal(byAlertId.get("204").appearances, 2);
    assert.equal(byAlertId.get("203").evidence, "actionable");
    assert.equal(byAlertId.get("999").evidence, "missing");
    assert.equal(byAlertId.get("999").reason, "run URL was not present in the inspected gh run list window");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
