import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync as realExecFileSync } from "node:child_process";
import { runCli } from "../scripts/triage-ci-alerts.mjs";

const repoRoot = process.cwd();
const triageScript = path.join(repoRoot, "scripts", "triage-ci-alerts.mjs");

function makeSpawnAdapter(options = {}) {
  return (command, args) => {
    if (command === "git" && args.join(" ") === "config --get remote.origin.url") {
      return { status: 0, stdout: "https://github.com/minislively/fooks.git\n", stderr: "" };
    }

    if (command === "gh") {
      const pathHead = options.env?.PATH?.split(path.delimiter)[0] ?? "";
      const logPath = pathHead ? path.join(path.dirname(pathHead), "gh-args.log") : "";
      if (logPath && fs.existsSync(path.dirname(logPath))) {
        fs.appendFileSync(logPath, `${JSON.stringify(args)}\n`);
      }

      if (args[0] === "run" && args[1] === "list") {
        return {
          status: 0,
          stdout: JSON.stringify([{
            databaseId: 26300000013,
            workflowName: "Merge Gate",
            name: "Merge Gate",
            headBranch: "fooks-issue-1094-rerun-status",
            event: "pull_request_target",
            status: "completed",
            conclusion: "success",
            createdAt: "2026-05-27T10:00:00Z",
            updatedAt: "2026-05-27T10:10:00Z",
            url: "https://github.com/minislively/fooks/actions/runs/26300000013",
          }]),
          stderr: "",
        };
      }

      if (args[0] === "api" && args[1].includes("actions/runs/26300000013/jobs?filter=all&per_page=100")) {
        return {
          status: 0,
          stdout: JSON.stringify({ jobs: [
            {
              id: 78006573443,
              name: "Validate approval review and linked issue",
              status: "completed",
              conclusion: "failure",
              completed_at: "2026-05-27T10:04:00Z",
            },
            {
              id: 78007392165,
              name: "Validate approval review and linked issue",
              status: "completed",
              conclusion: "success",
              completed_at: "2026-05-27T10:08:00Z",
            },
          ] }),
          stderr: "",
        };
      }
    }

    return { status: 1, stdout: "", stderr: `unexpected spawn ${command} ${JSON.stringify(args)}` };
  };
}

function execFileSync(file, args, options = {}) {
  if (file !== process.execPath || args[0] !== triageScript) {
    return realExecFileSync(file, args, options);
  }

  const chunks = [];
  runCli(args.slice(1), {
    stdout: { write: (chunk) => chunks.push(String(chunk)) },
    spawn: makeSpawnAdapter(options),
  });
  return chunks.join("");
}

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
    assert.equal(current301.reason, "verification-only current main success echo");

    assert.equal(missingCurrentAttempt.alertedUrl, "https://github.com/minislively/fooks/actions/runs/302/attempts/1");
    assert.equal(missingCurrentAttempt.currentAttempt, null);
    assert.equal(missingCurrentAttempt.evidence, "current");
    assert.equal(missingCurrentAttempt.reason, "not failing");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage separates stale attempt replay from current main success echo", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-attempt-echo-order-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 960,
      attempt: 2,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-02T13:00:00Z",
      updatedAt: "2026-05-02T13:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/960",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "current successful main run https://github.com/minislively/fooks/actions/runs/960",
    "stale replayed attempt https://github.com/minislively/fooks/actions/runs/960/attempts/1",
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
    const staleAttempt = result.alerts.find((alert) => alert.alertedRunId === "960" && alert.alertedAttempt === 1);
    const currentRun = result.alerts.find((alert) => alert.alertedRunId === "960" && alert.alertedAttempt === null);

    assert.equal(result.alerts.length, 2);
    assert.equal(result.counts.informational, 1);
    assert.equal(result.counts.stale ?? 0, 0);
    assert.equal(result.counts.actionable ?? 0, 0);

    assert.equal(staleAttempt.alertedUrl, "https://github.com/minislively/fooks/actions/runs/960/attempts/1");
    assert.equal(staleAttempt.evidence, "stale");
    assert.equal(staleAttempt.verdict, "stale");
    assert.equal(staleAttempt.replay, true);
    assert.equal(staleAttempt.disposition, "suppress-replay");
    assert.equal(staleAttempt.reason, "superseded by attempt 2");

    assert.equal(currentRun.alertedUrl, "https://github.com/minislively/fooks/actions/runs/960");
    assert.equal(currentRun.evidence, "current");
    assert.equal(currentRun.verdict, "current-main-echo");
    assert.equal(currentRun.echo, true);
    assert.equal(currentRun.disposition, "verification-only");
    assert.equal(currentRun.reason, "verification-only current main success echo");

    assert.equal(result.alertSummary.total, 2);
    assert.equal(result.alertSummary.currentHeadCount, 1);
    assert.deepEqual(result.alertSummary.currentHeadRunIds, ["960"]);
    assert.equal(result.alertSummary.currentMainEchoCount, 1);
    assert.equal(result.alertSummary.verificationOnlyCount, 1);
    assert.equal(result.alertSummary.staleReplayCount, 1);
    assert.equal(result.alertSummary.staleSuccessReplayCount, 1);
    assert.equal(result.alertSummary.actionableAlertCount, 0);
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
    assert.equal(byAlertId.get("404").verdict, "current-main-echo");
    assert.equal(byAlertId.get("404").echo, true);
    assert.equal(byAlertId.get("404").replay, false);
    assert.equal(byAlertId.get("404").disposition, "verification-only");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage classifies cancelled main run as superseded only with later success evidence", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-superseded-cancel-success-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 25288224129,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      headSha: "ce4848a",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-03T18:12:00Z",
      updatedAt: "2026-05-03T18:14:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/25288224129",
    },
    {
      databaseId: 25288202907,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      headSha: "c0d5ac7",
      event: "push",
      status: "completed",
      conclusion: "cancelled",
      createdAt: "2026-05-03T18:02:00Z",
      updatedAt: "2026-05-03T18:04:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/25288202907",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "stacked merge cancelled main echo https://github.com/minislively/fooks/actions/runs/25288202907",
    "later green main evidence https://github.com/minislively/fooks/actions/runs/25288224129",
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
    const byAlertId = new Map(result.alerts.map((alert) => [alert.alertedRunId, alert]));
    const cancelledEcho = byAlertId.get("25288202907");
    const laterSuccess = byAlertId.get("25288224129");

    assert.equal(cancelledEcho.verdict, "superseded-main-ci-cancel-echo");
    assert.equal(cancelledEcho.supersededMainCancellationEcho, true);
    assert.equal(cancelledEcho.replay, true);
    assert.equal(cancelledEcho.disposition, "suppress-replay");
    assert.equal(cancelledEcho.currentRunId, 25288224129);
    assert.equal(cancelledEcho.headSha, "c0d5ac7");
    assert.equal(cancelledEcho.latestHeadSha, "ce4848a");
    assert.equal(cancelledEcho.latestConclusion, "success");
    assert.equal(cancelledEcho.reason, "cancelled main run superseded by successful run 25288224129");

    assert.equal(laterSuccess.verdict, "current-main-echo");
    assert.equal(laterSuccess.disposition, "verification-only");
    assert.equal(result.alertSummary.supersededMainCancellationEchoCount, 1);
    assert.equal(result.alertSummary.currentMainEchoCount, 1);
    assert.equal(result.alertSummary.staleReplayCount, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage does not suppress cancelled main run without later success evidence", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-cancel-no-success-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 25288230000,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      headSha: "badf00d",
      event: "push",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-05-03T18:12:00Z",
      updatedAt: "2026-05-03T18:14:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/25288230000",
    },
    {
      databaseId: 25288202907,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      headSha: "c0d5ac7",
      event: "push",
      status: "completed",
      conclusion: "cancelled",
      createdAt: "2026-05-03T18:02:00Z",
      updatedAt: "2026-05-03T18:04:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/25288202907",
    },
  ]));
  fs.writeFileSync(alertsPath, "cancelled main echo without green successor https://github.com/minislively/fooks/actions/runs/25288202907\n");

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
    const cancelledEcho = result.alerts[0];

    assert.equal(result.counts.actionable, 1);
    assert.equal(cancelledEcho.evidence, "stale");
    assert.equal(cancelledEcho.verdict, "stale");
    assert.equal(cancelledEcho.supersededMainCancellationEcho, false);
    assert.equal(cancelledEcho.replay, false);
    assert.equal(cancelledEcho.disposition, "review");
    assert.equal(cancelledEcho.currentRunId, 25288230000);
    assert.equal(cancelledEcho.latestConclusion, "failure");
    assert.equal(cancelledEcho.reason, "cancelled main run has no later success evidence");
    assert.equal(result.alertSummary.supersededMainCancellationEchoCount, 0);
    assert.equal(result.alertSummary.staleReplayCount, 0);
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
    assert.equal(result.alerts[0].reason, "cancelled main run has no later success evidence");
    assert.equal(result.alerts[0].replay, false);
    assert.equal(result.alerts[0].disposition, "review");
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
    assert.equal(byAlertId.get("500").reason, "verification-only current main success echo");

    const cancelledSamples = result.alerts.filter((alert) => alert.conclusion === "cancelled");
    assert.equal(cancelledSamples.length, 2);
    assert.ok(cancelledSamples.every((alert) => alert.evidence === "stale"));
    assert.ok(cancelledSamples.every((alert) => alert.sampled === true));
    assert.ok([...byAlertId.keys()].every((id) => id === "500" || Number(id) % 5 === 0));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage collapses success-heavy clawhip bursts to current head plus stale count", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-green-burst-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  const currentRun = {
    databaseId: 700,
    workflowName: "CI",
    name: "Validate",
    headBranch: "main",
    event: "push",
    status: "completed",
    conclusion: "success",
    createdAt: "2026-05-01T12:00:00Z",
    updatedAt: "2026-05-01T12:05:00Z",
    url: "https://github.com/minislively/fooks/actions/runs/700",
  };
  const historicalRuns = Array.from({ length: 20 }, (_, index) => {
    const id = 600 + index;
    return {
      databaseId: id,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: `2026-04-30T${String(index).padStart(2, "0")}:00:00Z`,
      updatedAt: `2026-04-30T${String(index).padStart(2, "0")}:05:00Z`,
      url: `https://github.com/minislively/fooks/actions/runs/${id}`,
    };
  });

  fs.writeFileSync(runsPath, JSON.stringify([currentRun, ...historicalRuns]));
  fs.writeFileSync(alertsPath, [
    ...historicalRuns.map((run) => `clawhip green replay https://github.com/minislively/fooks/actions/runs/${run.databaseId}`),
    "current main-head green verdict https://github.com/minislively/fooks/actions/runs/700",
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
    assert.equal(result.alertSummary.total, 21);
    assert.equal(result.alertSummary.shown, 1);
    assert.equal(result.alertSummary.omitted, 20);
    assert.equal(result.alertSummary.currentHeadCount, 1);
    assert.deepEqual(result.alertSummary.currentHeadRunIds, ["700"]);
    assert.equal(result.alertSummary.batchVerdict, "historical-ci-replay-batch");
    assert.equal(result.alertSummary.batchDisposition, "suppress-historical-replay-before-current-main-echo");
    assert.match(result.alertSummary.batchReason, /current GitHub Actions reporting state for main is the freshest alert-triage evidence/);
    assert.equal(result.alertSummary.actionableAlertCount, 0);
    assert.equal(result.alertSummary.verificationOnlyCount, 1);
    assert.equal(result.alertSummary.staleReplayCount, 20);
    assert.equal(result.alertSummary.staleSuccessReplayCount, 20);
    assert.equal(result.alertSummary.byEvidence.stale, 20);
    assert.equal(result.alertSummary.byConclusion.success, 20);
    assert.equal(result.alertSummary.omittedRunEvidenceLimit, 12);
    assert.equal(result.alertSummary.omittedRunEvidence.length, 12);
    assert.deepEqual(
      result.alertSummary.omittedRunEvidence.map((evidence) => evidence.runId),
      historicalRuns.slice(0, 12).map((run) => String(run.databaseId)),
    );
    assert.ok(result.alertSummary.omittedRunEvidence.every((evidence) => evidence.evidence === "stale"));
    assert.ok(result.alertSummary.omittedRunEvidence.every((evidence) => evidence.disposition === "suppress-replay"));
    assert.ok(result.alertSummary.omittedRunEvidence.every((evidence) => evidence.replay === true));
    assert.equal(result.counts.actionable ?? 0, 0);
    assert.equal(result.counts.watch ?? 0, 0);
    assert.equal(result.alerts.length, 1);
    assert.equal(result.alerts[0].alertedRunId, "700");
    assert.equal(result.alerts[0].evidence, "current");
    assert.equal(result.alerts[0].verdict, "current-main-echo");
    assert.equal(result.alerts[0].echo, true);
    assert.equal(result.alerts[0].disposition, "verification-only");
    assert.equal(result.alerts[0].conclusion, "success");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage classifies pasted current main CI success as verification-only echo", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-main-pass-echo-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 850,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-02T09:00:00Z",
      updatedAt: "2026-05-02T09:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/850",
    },
    {
      databaseId: 849,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-02T08:00:00Z",
      updatedAt: "2026-05-02T08:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/849",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "git:fooks@main",
    "CI passed · fooks https://github.com/minislively/fooks/actions/runs/850/job/1234567890",
    "historical green replay https://github.com/minislively/fooks/actions/runs/849",
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
    const byAlertId = new Map(result.alerts.map((alert) => [alert.alertedRunId, alert]));

    assert.equal(byAlertId.get("850").evidence, "current");
    assert.equal(byAlertId.get("850").verdict, "current-main-echo");
    assert.equal(byAlertId.get("850").echo, true);
    assert.equal(byAlertId.get("850").disposition, "verification-only");
    assert.equal(byAlertId.get("850").reason, "verification-only current main success echo");
    assert.equal(byAlertId.get("850").currentRunId, 850);
    assert.equal(byAlertId.get("849").evidence, "stale");
    assert.equal(byAlertId.get("849").replay, true);
    assert.equal(byAlertId.get("849").disposition, "suppress-replay");
    assert.equal(result.alertSummary.currentHeadRunIds.includes("850"), true);
    assert.equal(result.alertSummary.currentMainEchoCount, 1);
    assert.equal(result.alertSummary.staleReplayCount, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage dedupes duplicate current main success run and job URLs", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-current-success-dedupe-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 902,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-02T12:00:00Z",
      updatedAt: "2026-05-02T12:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/902",
    },
    {
      databaseId: 901,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-02T11:00:00Z",
      updatedAt: "2026-05-02T11:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/901",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "current green run URL https://github.com/minislively/fooks/actions/runs/902",
    "current green job URL https://github.com/minislively/fooks/actions/runs/902/job/123456789",
    "historical green replay https://github.com/minislively/fooks/actions/runs/901",
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
    const currentEchoes = result.alerts.filter((alert) => alert.alertedRunId === "902");
    const staleReplay = result.alerts.find((alert) => alert.alertedRunId === "901");

    assert.equal(currentEchoes.length, 1);
    assert.equal(currentEchoes[0].appearances, 2);
    assert.equal(currentEchoes[0].alertedUrl, "https://github.com/minislively/fooks/actions/runs/902");
    assert.equal(currentEchoes[0].evidence, "current");
    assert.equal(currentEchoes[0].verdict, "current-main-echo");
    assert.equal(currentEchoes[0].disposition, "verification-only");

    assert.equal(staleReplay.evidence, "stale");
    assert.equal(staleReplay.replay, true);
    assert.equal(staleReplay.conclusion, "success");
    assert.equal(result.alertSummary.total, 2);
    assert.equal(result.alertSummary.currentMainEchoCount, 1);
    assert.equal(result.alertSummary.verificationOnlyCount, 1);
    assert.equal(result.alertSummary.staleReplayCount, 1);
    assert.equal(result.alertSummary.staleSuccessReplayCount, 1);
    assert.equal(result.alertSummary.actionableAlertCount, 0);
    assert.equal(result.counts.actionable ?? 0, 0);
    assert.equal(result.counts.watch ?? 0, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});


test("CI alert triage marks superseded pull_request_target Merge Gate job failures as stale rerun echoes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-merge-gate-rerun-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 26300000000,
      attempt: 2,
      workflowName: "Merge Gate",
      name: "Merge Gate",
      headBranch: "fooks-issue-1094-rerun-status",
      headSha: "feed1094",
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-27T10:00:00Z",
      updatedAt: "2026-05-27T10:08:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/26300000000",
      jobs: [
        {
          id: 78006573431,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "failure",
          completedAt: "2026-05-27T10:04:00Z",
          url: "https://github.com/minislively/fooks/actions/runs/26300000000/job/78006573431",
        },
        {
          id: 78007392157,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "success",
          completedAt: "2026-05-27T10:08:00Z",
          url: "https://github.com/minislively/fooks/actions/runs/26300000000/job/78007392157",
        },
      ],
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "PR #1094 old Merge Gate failure job https://github.com/minislively/fooks/actions/runs/26300000000/job/78006573431",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const alert = result.alerts[0];

    assert.equal(result.counts.informational, 1);
    assert.equal(alert.alertedRunId, "26300000000");
    assert.equal(alert.alertedJobId, 78006573431);
    assert.equal(alert.currentJobId, 78007392157);
    assert.equal(alert.ciLane, "pull_request_target:merge-gate");
    assert.equal(alert.evidence, "stale");
    assert.equal(alert.verdict, "superseded-successful-rerun-job-echo");
    assert.equal(alert.supersededSuccessfulRerunJobEcho, true);
    assert.equal(alert.replay, true);
    assert.equal(alert.disposition, "suppress-replay");
    assert.match(alert.reason, /pull_request_target:merge-gate job 78006573431 superseded by newer successful job 78007392157/);
    assert.match(alert.claimBoundary, /not authorization or merge authority/);
    assert.equal(result.alertSummary.supersededSuccessfulRerunJobEchoCount, 1);
    assert.equal(result.alertSummary.currentHeadRunIds.includes("26300000000"), false);
    assert.equal(result.alertSummary.actionableAlertCount, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});


test("CI alert triage marks superseded pull_request_target Merge Gate job cancellations as stale rerun echoes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-merge-gate-cancelled-rerun-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 26300000010,
      attempt: 2,
      workflowName: "Merge Gate",
      name: "Merge Gate",
      headBranch: "fooks-issue-1094-rerun-status",
      headSha: "feed1094",
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-27T10:00:00Z",
      updatedAt: "2026-05-27T10:08:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/26300000010",
      jobs: [
        {
          id: 78006573531,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "cancelled",
          completedAt: "2026-05-27T10:04:00Z",
          url: "https://github.com/minislively/fooks/actions/runs/26300000010/job/78006573531",
        },
        {
          id: 78007392257,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "success",
          completedAt: "2026-05-27T10:08:00Z",
          url: "https://github.com/minislively/fooks/actions/runs/26300000010/job/78007392257",
        },
      ],
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "PR #1094 old Merge Gate cancelled job https://github.com/minislively/fooks/actions/runs/26300000010/job/78006573531",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const alert = result.alerts[0];

    assert.equal(result.counts.informational, 1);
    assert.equal(alert.alertedRunId, "26300000010");
    assert.equal(alert.alertedJobId, 78006573531);
    assert.equal(alert.currentJobId, 78007392257);
    assert.equal(alert.evidence, "stale");
    assert.equal(alert.verdict, "superseded-successful-rerun-job-echo");
    assert.equal(alert.supersededSuccessfulRerunJobEcho, true);
    assert.equal(alert.replay, true);
    assert.equal(alert.disposition, "suppress-replay");
    assert.equal(result.alertSummary.supersededSuccessfulRerunJobEchoCount, 1);
    assert.equal(result.alertSummary.actionableAlertCount, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage does not suppress unrelated successful Merge Gate jobs in the same run", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-merge-gate-unrelated-job-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 26300000001,
      attempt: 1,
      workflowName: "Merge Gate",
      name: "Merge Gate",
      headBranch: "fooks-issue-1094-rerun-status",
      headSha: "feed1094",
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-27T10:00:00Z",
      updatedAt: "2026-05-27T10:08:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/26300000001",
      jobs: [
        {
          id: 78006573432,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "failure",
          completedAt: "2026-05-27T10:04:00Z",
          url: "https://github.com/minislively/fooks/actions/runs/26300000001/job/78006573432",
        },
        {
          id: 78007392158,
          name: "Report triage summary",
          status: "completed",
          conclusion: "success",
          completedAt: "2026-05-27T10:08:00Z",
          url: "https://github.com/minislively/fooks/actions/runs/26300000001/job/78007392158",
        },
      ],
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "PR #1094 unrelated Merge Gate job https://github.com/minislively/fooks/actions/runs/26300000001/job/78006573432",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const alert = result.alerts[0];

    assert.equal(alert.evidence, "review");
    assert.equal(alert.verdict, "merge-gate-job-not-superseded");
    assert.equal(alert.disposition, "review");
    assert.equal(alert.mergeGateJobNotSuperseded, true);
    assert.equal(alert.supersededSuccessfulRerunJobEcho, false);
    assert.equal(result.alertSummary.supersededSuccessfulRerunJobEchoCount, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage reviews Merge Gate job URLs when job-list evidence is unavailable", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-merge-gate-no-jobs-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 26300000002,
      attempt: 1,
      workflowName: "Merge Gate",
      name: "Merge Gate",
      headBranch: "fooks-issue-1094-rerun-status",
      headSha: "feed1094",
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-27T10:00:00Z",
      updatedAt: "2026-05-27T10:08:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/26300000002",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "PR #1094 needs job evidence https://github.com/minislively/fooks/actions/runs/26300000002/job/78006573433",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const alert = result.alerts[0];

    assert.equal(alert.evidence, "review");
    assert.equal(alert.verdict, "merge-gate-job-evidence-unavailable");
    assert.equal(alert.disposition, "review");
    assert.equal(alert.mergeGateJobEvidenceMissing, true);
    assert.equal(alert.supersededSuccessfulRerunJobEcho, false);
    assert.equal(result.alertSummary.supersededSuccessfulRerunJobEchoCount, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage requires newer timestamps before suppressing Merge Gate job echoes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-merge-gate-not-newer-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 26300000003,
      attempt: 1,
      workflowName: "Merge Gate",
      name: "Merge Gate",
      headBranch: "fooks-issue-1094-rerun-status",
      headSha: "feed1094",
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-27T10:00:00Z",
      updatedAt: "2026-05-27T10:08:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/26300000003",
      jobs: [
        {
          id: 78006573434,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "failure",
          completedAt: "2026-05-27T10:08:00Z",
        },
        {
          id: 78007392159,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "success",
          completedAt: "2026-05-27T10:08:00Z",
        },
      ],
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "PR #1094 same timestamp https://github.com/minislively/fooks/actions/runs/26300000003/job/78006573434",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const alert = result.alerts[0];

    assert.equal(alert.evidence, "review");
    assert.equal(alert.verdict, "merge-gate-job-not-superseded");
    assert.equal(alert.disposition, "review");
    assert.equal(alert.supersededSuccessfulRerunJobEcho, false);
    assert.equal(result.alertSummary.supersededSuccessfulRerunJobEchoCount, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage keeps distinct Merge Gate job URLs from the same run separate", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-merge-gate-distinct-jobs-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 26300000004,
      attempt: 1,
      workflowName: "Merge Gate",
      name: "Merge Gate",
      headBranch: "fooks-issue-1094-rerun-status",
      headSha: "feed1094",
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-27T10:00:00Z",
      updatedAt: "2026-05-27T10:10:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/26300000004",
      jobs: [
        {
          id: 78006573435,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "failure",
          completedAt: "2026-05-27T10:04:00Z",
        },
        {
          id: 78007392160,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "success",
          completedAt: "2026-05-27T10:08:00Z",
        },
        {
          id: 78006573436,
          name: "Unrelated required check",
          status: "completed",
          conclusion: "failure",
          completedAt: "2026-05-27T10:09:00Z",
        },
      ],
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "superseded job https://github.com/minislively/fooks/actions/runs/26300000004/job/78006573435",
    "unsuperseded job https://github.com/minislively/fooks/actions/runs/26300000004/job/78006573436",
  ].join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);

    assert.equal(result.alerts.length, 2);
    const byJobId = new Map(result.alerts.map((alert) => [alert.alertedJobId, alert]));
    assert.equal(byJobId.get(78006573435).verdict, "superseded-successful-rerun-job-echo");
    assert.equal(byJobId.get(78006573435).disposition, "suppress-replay");
    assert.equal(byJobId.get(78006573436).verdict, "merge-gate-job-not-superseded");
    assert.equal(byJobId.get(78006573436).disposition, "review");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});


test("CI alert triage does not suppress same-name rerun jobs outside pull_request_target Merge Gate", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-merge-gate-non-authority-lanes-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");
  const lanes = [
    { id: 26300000020, event: "pull_request", workflowName: "CI", name: "CI" },
    { id: 26300000021, event: "push", workflowName: "CI", name: "CI" },
    { id: 26300000022, event: "pull_request_target", workflowName: "Security Audit", name: "Security Audit" },
    { id: 26300000023, event: "pull_request_review", workflowName: "Merge Gate", name: "Merge Gate" },
  ];
  const runs = lanes.map((lane, index) => ({
    databaseId: lane.id,
    workflowName: lane.workflowName,
    name: lane.name,
    headBranch: "fooks-issue-1094-rerun-status",
    event: lane.event,
    status: "completed",
    conclusion: "success",
    createdAt: `2026-05-27T10:0${index}:00Z`,
    updatedAt: `2026-05-27T10:1${index}:00Z`,
    jobs: [
      {
        id: 78006573600 + index,
        name: "Validate approval review and linked issue",
        status: "completed",
        conclusion: "failure",
        completedAt: `2026-05-27T10:0${index}:00Z`,
      },
      {
        id: 78007392200 + index,
        name: "Validate approval review and linked issue",
        status: "completed",
        conclusion: "success",
        completedAt: `2026-05-27T10:1${index}:00Z`,
      },
    ],
  }));
  fs.writeFileSync(runsPath, JSON.stringify(runs));
  fs.writeFileSync(alertsPath, lanes.map((lane, index) => (
    `non-authority lane https://github.com/minislively/fooks/actions/runs/${lane.id}/job/${78006573600 + index}`
  )).join("\n"));

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);

    assert.equal(result.alertSummary.supersededSuccessfulRerunJobEchoCount, 0);
    assert.equal(result.alertSummary.reviewAlertCount, lanes.length);
    assert.equal(result.alerts.some((alert) => alert.verdict === "superseded-successful-rerun-job-echo"), false);
    assert.equal(result.alerts.every((alert) => alert.supersededSuccessfulRerunJobEcho === false), true);
    assert.equal(result.alerts.every((alert) => alert.verdict === "non-merge-gate-job-review"), true);
    assert.equal(result.alerts.every((alert) => alert.disposition === "review"), true);
    assert.equal(result.alerts.every((alert) => alert.nonMergeGateJobReview === true), true);
    assert.equal(result.alerts.find((alert) => alert.alertedRunId === "26300000023").ciLane, "pull_request_review");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage markdown renders the read-only claim boundary", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-merge-gate-markdown-boundary-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 26300000024,
      workflowName: "Merge Gate",
      name: "Merge Gate",
      headBranch: "fooks-issue-1094-rerun-status",
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-27T10:00:00Z",
      updatedAt: "2026-05-27T10:08:00Z",
      jobs: [
        {
          id: 78006573610,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "failure",
          completedAt: "2026-05-27T10:04:00Z",
        },
        {
          id: 78007392210,
          name: "Validate approval review and linked issue",
          status: "completed",
          conclusion: "success",
          completedAt: "2026-05-27T10:08:00Z",
        },
      ],
    },
  ]));
  fs.writeFileSync(alertsPath, "rerun job https://github.com/minislively/fooks/actions/runs/26300000024/job/78006573610\n");

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--input",
      runsPath,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--markdown",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    assert.match(stdout, /Claim boundary: read-only alert triage only/);
    assert.match(stdout, /not authorization or merge authority/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage live job enrichment asks GitHub for all job executions", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-live-jobs-"));
  const binDir = path.join(tempDir, "bin");
  const logPath = path.join(tempDir, "gh-args.log");
  const alertsPath = path.join(tempDir, "alerts.txt");
  fs.mkdirSync(binDir);
  fs.writeFileSync(path.join(binDir, "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const logPath = ${JSON.stringify(logPath)};
fs.appendFileSync(logPath, JSON.stringify(process.argv.slice(2)) + "\\n");
const args = process.argv.slice(2);
if (args[0] === "run" && args[1] === "list") {
  process.stdout.write(JSON.stringify([{
    databaseId: 26300000013,
    workflowName: "Merge Gate",
    name: "Merge Gate",
    headBranch: "fooks-issue-1094-rerun-status",
    event: "pull_request_target",
    status: "completed",
    conclusion: "success",
    createdAt: "2026-05-27T10:00:00Z",
    updatedAt: "2026-05-27T10:10:00Z",
    url: "https://github.com/minislively/fooks/actions/runs/26300000013"
  }]));
  process.exit(0);
}
if (args[0] === "api" && args[1].includes("actions/runs/26300000013/jobs?filter=all&per_page=100")) {
  process.stdout.write(JSON.stringify({ jobs: [
    {
      id: 78006573443,
      name: "Validate approval review and linked issue",
      status: "completed",
      conclusion: "failure",
      completed_at: "2026-05-27T10:04:00Z"
    },
    {
      id: 78007392165,
      name: "Validate approval review and linked issue",
      status: "completed",
      conclusion: "success",
      completed_at: "2026-05-27T10:08:00Z"
    }
  ] }));
  process.exit(0);
}
process.stderr.write("unexpected gh args " + JSON.stringify(args));
process.exit(1);
`);
  fs.chmodSync(path.join(binDir, "gh"), 0o755);
  fs.writeFileSync(alertsPath, "live job https://github.com/minislively/fooks/actions/runs/26300000013/job/78006573443\n");

  try {
    const stdout = execFileSync(process.execPath, [
      triageScript,
      "--alerts",
      alertsPath,
      "--branch",
      "fooks-issue-1094-rerun-status",
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);
    const ghCalls = fs.readFileSync(logPath, "utf8");

    assert.match(ghCalls, /jobs\?filter=all&per_page=100/);
    assert.equal(result.alerts[0].verdict, "superseded-successful-rerun-job-echo");
    assert.equal(result.alerts[0].currentJobId, 78007392165);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage suppresses stale tmux pane history blockers after recovery markers", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-tmux-stale-history-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 3790,
      workflowName: "CI",
      name: "Validate",
      headBranch: "fooks-issue-376-prune-remote-branch-noise",
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-02T13:00:00Z",
      updatedAt: "2026-05-02T13:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/3790",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "src/foo.ts(12,9): error TS7006: Parameter 'event' implicitly has an 'any' type.",
    "npm test passed",
    "PR #379 opened",
    "ralplan terminal",
    "tmux session killed",
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

    assert.equal(result.counts.actionable ?? 0, 0);
    assert.equal(result.tmuxHistorySummary.verdict, "stale-history-replay");
    assert.equal(result.tmuxHistorySummary.totalKeywordLines, 1);
    assert.equal(result.tmuxHistorySummary.staleKeywordLines, 1);
    assert.equal(result.tmuxHistorySummary.currentKeywordLines, 0);
    assert.equal(result.tmuxHistorySummary.lastMarkerLine, 5);
    assert.equal(result.tmuxHistory[0].evidence, "stale-history");
    assert.equal(result.tmuxHistory[0].verdict, "tmux-history-replay");
    assert.equal(result.tmuxHistory[0].disposition, "suppress-replay");
    assert.match(result.tmuxHistory[0].reason, /before recovery\/terminal marker/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage keeps fresh tmux blockers after recovery markers inspectable", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-tmux-fresh-history-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 3880,
      workflowName: "CI",
      name: "Validate",
      headBranch: "fix/issue-388-stale-tmux-error-realert",
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-05-03T08:00:00Z",
      updatedAt: "2026-05-03T08:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/3880",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "npm test passed",
    "PR #379 opened",
    "new command output after recovery",
    "src/current.ts(4,2): error TS7006: Parameter 'value' implicitly has an 'any' type.",
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

    assert.equal(result.tmuxHistorySummary.verdict, "fresh-blocker");
    assert.equal(result.tmuxHistorySummary.totalKeywordLines, 1);
    assert.equal(result.tmuxHistorySummary.staleKeywordLines, 0);
    assert.equal(result.tmuxHistorySummary.currentKeywordLines, 1);
    assert.equal(result.tmuxHistorySummary.lastMarkerLine, 2);
    assert.equal(result.tmuxHistory[0].evidence, "current");
    assert.equal(result.tmuxHistory[0].verdict, "fresh-blocker");
    assert.equal(result.tmuxHistory[0].disposition, "inspect");
    assert.match(result.tmuxHistory[0].reason, /after recovery\/terminal marker/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage treats tmux blocker keywords without recovery markers as current", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-tmux-no-marker-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([]));
  fs.writeFileSync(alertsPath, "src/current.ts(4,2): error TS7006: Parameter 'value' implicitly has an 'any' type.\n");

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

    assert.equal(result.tmuxHistorySummary.disposition, "inspect");
    assert.equal(result.tmuxHistorySummary.verdict, "fresh-blocker");
    assert.equal(result.tmuxHistorySummary.lastMarkerLine, null);
    assert.equal(result.tmuxHistory[0].matchedKeyword, "error");
    assert.equal(result.tmuxHistory[0].evidence, "current");
    assert.equal(result.tmuxHistory[0].disposition, "inspect");
    assert.match(result.tmuxHistory[0].reason, /no later recovery\/terminal marker/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage keeps URL actionable evidence inspectable when tmux history is stale", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-url-actionable-tmux-stale-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([
    {
      databaseId: 9901,
      workflowName: "CI",
      name: "Validate",
      headBranch: "main",
      event: "push",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-05-03T08:00:00Z",
      updatedAt: "2026-05-03T08:05:00Z",
      url: "https://github.com/minislively/fooks/actions/runs/9901",
    },
  ]));
  fs.writeFileSync(alertsPath, [
    "old pane line: error TS7006 from prior attempt",
    "npm test passed",
    "fresh CI URL still failing https://github.com/minislively/fooks/actions/runs/9901",
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

    assert.equal(result.alertSummary.actionableAlertCount, 1);
    assert.equal(result.alerts[0].evidence, "actionable");
    assert.equal(result.alerts[0].disposition, "inspect");
    assert.equal(result.tmuxHistorySummary.disposition, "suppress-replay");
    assert.equal(result.tmuxHistory[0].disposition, "suppress-replay");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage recognizes process exited code 0 as a tmux recovery marker", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-tmux-process-exited-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([]));
  fs.writeFileSync(alertsPath, [
    "src/x.ts: error TS7006",
    "process exited code 0",
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

    assert.equal(result.tmuxHistorySummary.lastMarkerLine, 2);
    assert.equal(result.tmuxHistorySummary.disposition, "suppress-replay");
    assert.equal(result.tmuxHistory[0].evidence, "stale-history");
    assert.equal(result.tmuxHistory[0].disposition, "suppress-replay");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CI alert triage does not let benign error counts hide failed keywords", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ci-alert-tmux-failed-zero-errors-"));
  const runsPath = path.join(tempDir, "runs.json");
  const alertsPath = path.join(tempDir, "alerts.txt");

  fs.writeFileSync(runsPath, JSON.stringify([]));
  fs.writeFileSync(alertsPath, [
    "summary: 1 failed, 0 errors",
    "npm test passed",
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

    assert.equal(result.tmuxHistorySummary.totalKeywordLines, 1);
    assert.equal(result.tmuxHistorySummary.staleKeywordLines, 1);
    assert.equal(result.tmuxHistory[0].matchedKeyword, "failed");
    assert.equal(result.tmuxHistory[0].evidence, "stale-history");
    assert.equal(result.tmuxHistory[0].disposition, "suppress-replay");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
