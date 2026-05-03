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
  OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG,
  OPERATOR_ACTIVITY_REMOTE_SOURCE,
  OPERATOR_ACTIVITY_TMUX_COMMAND,
  parseOperatorActivityTmuxPanes,
  readOperatorActivitySnapshot,
} = require(path.join(repoRoot, "dist", "core", "operator-activity.js"));

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

test("status activity CLI route preserves existing status contracts", () => {
  const tempDir = makeTempProject();
  const before = fs.readdirSync(tempDir).sort();

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
  assert.match(help, /fooks status activity \[--include-remote-counts\]/);

  let output = "";
  try {
    runText(["status", "activity", "--unexpected"], tempDir);
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(output, /Unexpected status activity argument/);
  assert.match(OPERATOR_ACTIVITY_REMOTE_COUNTS_FLAG, /--include-remote-counts/);
});
