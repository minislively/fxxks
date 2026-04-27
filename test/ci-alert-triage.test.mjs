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
