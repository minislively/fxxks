import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const guardScript = path.join(repoRoot, "scripts", "guard-pr-alerts.mjs");

test("PR alert guard skips ordinary issues before PR handling", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-pr-alert-guard-"));
  const alertsPath = path.join(tempDir, "alerts.txt");
  const eventsPath = path.join(tempDir, "events.json");

  fs.writeFileSync(alertsPath, "clawhip/relay surfaced fooks#226 as PR closed/commented");
  fs.writeFileSync(eventsPath, JSON.stringify({
    number: 226,
    title: "Closed non-PR issue",
    state: "closed",
    html_url: "https://github.com/minislively/fooks/issues/226",
  }));

  try {
    const stdout = execFileSync(process.execPath, [
      guardScript,
      "--repo",
      "minislively/fooks",
      "--alerts",
      alertsPath,
      "--events",
      eventsPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);

    assert.equal(result.totalRefs, 1);
    assert.equal(result.counts.issue, 1);
    assert.equal(result.counts.skip, 1);
    assert.equal(result.rows[0].kind, "issue");
    assert.equal(result.rows[0].prHandling, "skip");
    assert.equal(result.rows[0].reason, "GitHub issue API response has no pull_request field");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("PR alert guard allows pull requests when GitHub issue payload has pull_request", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-pr-alert-guard-pr-"));
  const alertsPath = path.join(tempDir, "alerts.txt");
  const eventsPath = path.join(tempDir, "events.json");

  fs.writeFileSync(alertsPath, "relay: https://github.com/minislively/fooks/pull/227 closed");
  fs.writeFileSync(eventsPath, JSON.stringify({
    number: 227,
    title: "Actual PR",
    state: "closed",
    html_url: "https://github.com/minislively/fooks/pull/227",
    pull_request: {
      url: "https://api.github.com/repos/minislively/fooks/pulls/227",
      html_url: "https://github.com/minislively/fooks/pull/227",
    },
  }));

  try {
    const stdout = execFileSync(process.execPath, [
      guardScript,
      "--repo",
      "minislively/fooks",
      "--alerts",
      alertsPath,
      "--events",
      eventsPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);

    assert.equal(result.totalRefs, 1);
    assert.equal(result.counts.pull_request, 1);
    assert.equal(result.counts.allow, 1);
    assert.equal(result.rows[0].kind, "pull_request");
    assert.equal(result.rows[0].prHandling, "allow");
    assert.equal(result.rows[0].reason, "GitHub issue API response includes pull_request");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("PR alert guard treats new-to-merged alerts for already merged PRs as verification-only echo", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-pr-alert-guard-echo-"));
  const alertsPath = path.join(tempDir, "alerts.txt");
  const eventsPath = path.join(tempDir, "events.json");

  fs.writeFileSync(alertsPath, "clawhip: PR fooks#348 <new> -> merged");
  fs.writeFileSync(eventsPath, JSON.stringify({
    number: 348,
    title: "Already merged PR",
    state: "closed",
    html_url: "https://github.com/minislively/fooks/pull/348",
    pull_request: {
      url: "https://api.github.com/repos/minislively/fooks/pulls/348",
      html_url: "https://github.com/minislively/fooks/pull/348",
      merged_at: "2026-05-02T09:00:00Z",
    },
  }));

  try {
    const stdout = execFileSync(process.execPath, [
      guardScript,
      "--repo",
      "minislively/fooks",
      "--alerts",
      alertsPath,
      "--events",
      eventsPath,
      "--json",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(stdout);

    assert.equal(result.totalRefs, 1);
    assert.equal(result.counts.pull_request, 1);
    assert.equal(result.counts.echo, 1);
    assert.equal(result.rows[0].kind, "pull_request");
    assert.equal(result.rows[0].prHandling, "echo");
    assert.equal(result.rows[0].reason, "Alert reports <new> -> merged and GitHub state is already merged; verification-only echo");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
