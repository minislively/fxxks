// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);

const {
  ARTIFACT_AUDIT_CLAIM_BOUNDARY,
  auditArtifacts,
  parseGitBranchList,
  parseGitWorktreePorcelain,
  parseTmuxPaneList,
} = require(path.join(repoRoot, "dist", "core", "artifact-audit.js"));

function makeRunner(outputs, calls = []) {
  return (command, args, cwd) => {
    calls.push([command, args, cwd]);
    const key = `${command} ${args.join(" ")}`;
    const value = outputs[key];
    if (value instanceof Error) throw value;
    if (value === undefined) throw new Error(`unexpected command: ${key}`);
    return value;
  };
}

test("artifact audit parsers handle git worktrees, branches, and tmux panes", () => {
  assert.deepEqual(parseGitWorktreePorcelain("worktree /repo/fooks\nHEAD abc\nbranch refs/heads/fooks-feature\n\nworktree /repo/detached\nHEAD def\ndetached\n"), [
    { path: "/repo/fooks", head: "abc", branch: "fooks-feature", detached: false },
    { path: "/repo/detached", head: "def", branch: undefined, detached: true },
  ]);
  assert.deepEqual(parseGitBranchList("  main\n* fooks-feature\nrefs/heads/fooks-other\n"), ["fooks-feature", "fooks-other", "main"]);
  assert.deepEqual(parseTmuxPaneList("fooks-old\t/work/.omx-worktrees/fooks-old\nignored-without-tab\n"), [
    { session: "fooks-old", path: "/work/.omx-worktrees/fooks-old" },
  ]);
});

test("artifact audit reports conservative candidates and only manual cleanup commands", () => {
  const cwd = "/repo/fooks-main";
  const existing = new Set([
    cwd,
    "/work/.omx-worktrees/fooks-feature",
    "/work/.omx-worktrees/fooks-active",
  ]);
  const calls = [];
  const result = auditArtifacts(cwd, {
    now: () => "2026-04-25T00:00:00.000Z",
    pathExists: (target) => existing.has(target),
    runner: makeRunner({
      "git worktree list --porcelain": [
        `worktree ${cwd}`,
        "HEAD 111",
        "branch refs/heads/fooks-current",
        "",
        "worktree /work/.omx-worktrees/fooks-feature",
        "HEAD 222",
        "branch refs/heads/fooks-feature",
        "",
        "worktree /work/.omx-worktrees/fooks-active",
        "HEAD 333",
        "branch refs/heads/fooks-active",
        "",
        "worktree /work/.omx-worktrees/fooks-missing",
        "HEAD 444",
        "branch refs/heads/fooks-missing",
        "",
      ].join("\n"),
      "git rev-parse --verify origin/main": "origin-main-sha\n",
      "git branch --format=%(refname:short)": "fooks-current\nfooks-feature\nfooks-active\nfooks-missing\nfooks-loose\nmain\n",
      "git branch --merged origin/main": "fooks-feature\nfooks-missing\nfooks-loose\nmain\n",
      "tmux list-panes -a -F #{session_name}\t#{pane_current_path}": [
        "fooks-old\t/work/.omx-worktrees/fooks-feature",
        "fooks-active\t/work/.omx-worktrees/fooks-active",
        `fooks-current\t${cwd}`,
        "fooks-missing\t/gone/fooks-path (deleted)",
      ].join("\n"),
    }, calls),
  });

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.command, "status artifacts");
  assert.equal(result.scope, "fooks");
  assert.equal(result.baseRef, "origin/main");
  assert.equal(result.claimBoundary, ARTIFACT_AUDIT_CLAIM_BOUNDARY);
  assert.deepEqual(result.blockers, []);

  const worktreeByBranch = new Map(result.worktrees.map((item) => [item.branch, item]));
  assert.equal(worktreeByBranch.get("fooks-current")?.status, "activeOrUnknown");
  assert.equal(worktreeByBranch.get("fooks-feature")?.status, "likelyMerged");
  assert.deepEqual(worktreeByBranch.get("fooks-feature")?.manualCleanupCommands, ["git worktree remove '/work/.omx-worktrees/fooks-feature'"]);
  assert.equal(worktreeByBranch.get("fooks-active")?.status, "activeOrUnknown");
  assert.equal(worktreeByBranch.get("fooks-missing")?.status, "missingPath");
  assert.deepEqual(worktreeByBranch.get("fooks-missing")?.manualCleanupCommands, ["git worktree prune --dry-run"]);

  const branchByName = new Map(result.branches.map((item) => [item.branch, item]));
  assert.equal(branchByName.get("fooks-current")?.status, "activeOrUnknown");
  assert.equal(branchByName.get("fooks-active")?.status, "activeOrUnknown");
  assert.equal(branchByName.get("fooks-loose")?.status, "likelyMerged");
  assert.deepEqual(branchByName.get("fooks-loose")?.manualCleanupCommands, ["git branch -d 'fooks-loose'"]);
  assert.equal(branchByName.get("main"), undefined);

  const sessionByName = new Map(result.sessions.map((item) => [item.session, item]));
  assert.equal(sessionByName.get("fooks-old")?.status, "candidateCleanup");
  assert.deepEqual(sessionByName.get("fooks-old")?.manualCleanupCommands, ["tmux kill-session -t 'fooks-old'"]);
  assert.equal(sessionByName.get("fooks-active")?.status, "activeOrUnknown");
  assert.deepEqual(sessionByName.get("fooks-active")?.manualCleanupCommands, []);
  assert.equal(sessionByName.get("fooks-current")?.status, "activeOrUnknown");
  assert.deepEqual(sessionByName.get("fooks-current")?.manualCleanupCommands, []);
  assert.equal(sessionByName.get("fooks-missing")?.status, "candidateCleanup");

  assert.ok(result.manualCleanupCommands.includes("git worktree prune --dry-run"));
  assert.ok(result.manualCleanupCommands.includes("git branch -d 'fooks-loose'"));
  assert.ok(result.manualCleanupCommands.includes("tmux kill-session -t 'fooks-old'"));
  assert.ok(calls.every(([command, args]) => command !== "git" || !["fetch", "prune", "worktree remove", "branch -d"].includes(args.join(" "))));
});

test("artifact audit falls back to local main and does not mark by name alone", () => {
  const cwd = "/repo/fooks-main";
  const result = auditArtifacts(cwd, {
    pathExists: (target) => target === cwd || target === "/work/fooks-name-only",
    runner: makeRunner({
      "git worktree list --porcelain": `worktree ${cwd}\nHEAD 111\nbranch refs/heads/main\n\nworktree /work/fooks-name-only\nHEAD 222\nbranch refs/heads/fooks-name-only\n`,
      "git rev-parse --verify origin/main": new Error("missing origin main"),
      "git rev-parse --verify main": "main-sha\n",
      "git branch --format=%(refname:short)": "main\nfooks-name-only\n",
      "git branch --merged main": "main\n",
      "tmux list-panes -a -F #{session_name}\t#{pane_current_path}": "fooks-name-only\t/work/fooks-name-only\n",
    }),
  });

  assert.equal(result.baseRef, "main");
  assert.equal(result.worktrees.find((item) => item.branch === "fooks-name-only")?.status, "activeOrUnknown");
  assert.equal(result.branches.find((item) => item.branch === "fooks-name-only")?.status, "activeOrUnknown");
  assert.equal(result.sessions.find((item) => item.session === "fooks-name-only")?.status, "activeOrUnknown");
  assert.deepEqual(result.manualCleanupCommands, []);
});


test("artifact audit treats child cwd as the active worktree and suppresses cleanup", () => {
  const worktreeRoot = "/repo/fooks-current";
  const cwd = `${worktreeRoot}/src/components`;
  const result = auditArtifacts(cwd, {
    pathExists: (target) => target === worktreeRoot || target === cwd,
    runner: makeRunner({
      "git worktree list --porcelain": `worktree ${worktreeRoot}\nHEAD 111\nbranch refs/heads/fooks-current\n`,
      "git rev-parse --verify origin/main": "origin-main-sha\n",
      "git branch --format=%(refname:short)": "fooks-current\n",
      "git branch --merged origin/main": "fooks-current\n",
      "tmux list-panes -a -F #{session_name}\t#{pane_current_path}": `fooks-current\t${worktreeRoot}`,
    }),
  });

  assert.equal(result.worktrees[0]?.current, true);
  assert.equal(result.worktrees[0]?.status, "activeOrUnknown");
  assert.deepEqual(result.worktrees[0]?.manualCleanupCommands, []);
  assert.equal(result.branches[0]?.current, true);
  assert.equal(result.branches[0]?.status, "activeOrUnknown");
  assert.equal(result.sessions[0]?.status, "activeOrUnknown");
  assert.deepEqual(result.sessions[0]?.manualCleanupCommands, []);
  assert.deepEqual(result.manualCleanupCommands, []);
});


test("status artifacts emits JSON and remains read-only when git and tmux are unavailable", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-artifact-audit-"));
  const before = fs.readdirSync(tempDir);
  const result = JSON.parse(execFileSync(process.execPath, [cli, "status", "artifacts"], { cwd: tempDir, encoding: "utf8" }));

  assert.equal(result.command, "status artifacts");
  assert.match(result.claimBoundary, /never deletes/);
  assert.ok(Array.isArray(result.blockers));
  assert.deepEqual(fs.readdirSync(tempDir), before);
});
