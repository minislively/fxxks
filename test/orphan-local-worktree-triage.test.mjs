// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);

const {
  ORPHAN_LOCAL_WORKTREE_TRIAGE_CLAIM_BOUNDARY,
  ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE,
  parseOrphanLocalWorktreePorcelain,
  parseOrphanLocalWorktreeRemoteBranches,
  parseOrphanLocalWorktreeTmuxPanes,
  triageOrphanLocalWorktrees,
} = require(path.join(repoRoot, "dist", "ops", "orphan-local-worktree-triage.js"));

function makeRunner(outputs, calls = []) {
  return (command, args, cwd) => {
    calls.push([command, args, cwd]);
    const key = `${cwd} :: ${command} ${args.join(" ")}`;
    const globalKey = `${command} ${args.join(" ")}`;
    const value = Object.hasOwn(outputs, key) ? outputs[key] : outputs[globalKey];
    if (value instanceof Error) throw value;
    if (value === undefined) throw new Error(`unexpected command: ${key}`);
    return value;
  };
}

test("orphan local worktree triage parsers normalize worktrees, remote branches, and tmux panes", () => {
  assert.deepEqual(parseOrphanLocalWorktreePorcelain("worktree /repo/fooks-main\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/fooks-local\nHEAD def\nbranch refs/heads/dogfood/local\n"), [
    { path: "/repo/fooks-main", head: "abc", branch: "main" },
    { path: "/repo/fooks-local", head: "def", branch: "dogfood/local" },
  ]);
  assert.deepEqual([...parseOrphanLocalWorktreeRemoteBranches("origin/main\nupstream/dogfood/kept\n")].sort(), ["dogfood/kept", "main"]);
  assert.deepEqual(parseOrphanLocalWorktreeTmuxPanes("fooks-a\t/work/fooks-a\nz\t/path\twith-tab\n"), [
    { session: "fooks-a", path: "/work/fooks-a" },
    { session: "z", path: "/path\twith-tab" },
  ]);
});

test("orphan local worktree triage classifies safe cleanup, salvage review, and keep without mutation commands", () => {
  const cwd = "/work/fooks.omx-worktrees/current";
  const safe = "/work/fooks.omx-worktrees/old-merged";
  const salvage = "/work/fooks.omx-worktrees/local-ahead";
  const keepRemote = "/work/fooks.omx-worktrees/has-remote";
  const keepPr = "/work/fooks.omx-worktrees/has-pr";
  const calls = [];
  const result = triageOrphanLocalWorktrees(cwd, {
    now: () => "2026-05-11T00:00:00.000Z",
    pathExists: (target) => [cwd, safe, salvage, keepRemote, keepPr].includes(target),
    runner: makeRunner({
      "git worktree list --porcelain": [
        `worktree ${cwd}`,
        "HEAD 111",
        "branch refs/heads/dogfood/current",
        "",
        `worktree ${safe}`,
        "HEAD 222",
        "branch refs/heads/dogfood/old-merged",
        "",
        `worktree ${salvage}`,
        "HEAD 333",
        "branch refs/heads/dogfood/local-ahead",
        "",
        `worktree ${keepRemote}`,
        "HEAD 444",
        "branch refs/heads/dogfood/has-remote",
        "",
        `worktree ${keepPr}`,
        "HEAD 555",
        "branch refs/heads/dogfood/has-pr",
        "",
      ].join("\n"),
      "git rev-parse --verify origin/main": "origin-main-sha\n",
      "git branch -r --format=%(refname:short)": "origin/main\norigin/dogfood/has-remote\n",
      "tmux list-panes -a -F #{session_name}\t#{pane_current_path}": `current\t${cwd}\n`,
      [`${cwd} :: git status --porcelain=v1 -z`]: "",
      [`${safe} :: git status --porcelain=v1 -z`]: "",
      [`${salvage} :: git status --porcelain=v1 -z`]: "",
      [`${keepRemote} :: git status --porcelain=v1 -z`]: "",
      [`${keepPr} :: git status --porcelain=v1 -z`]: "",
      [`${cwd} :: git rev-list --count origin/main..HEAD`]: "0\n",
      [`${safe} :: git rev-list --count origin/main..HEAD`]: "0\n",
      [`${salvage} :: git rev-list --count origin/main..HEAD`]: "2\n",
      [`${keepRemote} :: git rev-list --count origin/main..HEAD`]: "1\n",
      [`${keepPr} :: git rev-list --count origin/main..HEAD`]: "1\n",
      "gh pr list --state open --json number,url,headRefName --limit 200": JSON.stringify([{ number: 709, url: "https://github.com/minislively/fooks/pull/709", headRefName: "dogfood/has-pr" }]),
    }, calls),
  });

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.command, "status orphan-worktrees");
  assert.equal(result.linkedIssue, ORPHAN_LOCAL_WORKTREE_TRIAGE_ISSUE);
  assert.equal(result.claimBoundary, ORPHAN_LOCAL_WORKTREE_TRIAGE_CLAIM_BOUNDARY);
  assert.equal(result.readOnly, true);
  assert.equal(result.siblingRoot, "/work/fooks.omx-worktrees");
  assert.deepEqual(result.blockers, []);

  assert.deepEqual(result.categories["safe-cleanup"].map((entry) => entry.branch), ["dogfood/old-merged"]);
  assert.deepEqual(result.categories["salvage-review"].map((entry) => entry.branch), ["dogfood/local-ahead"]);
  assert.deepEqual(result.categories.keep.map((entry) => entry.branch).sort(), ["dogfood/current", "dogfood/has-pr", "dogfood/has-remote"]);

  const salvageEntry = result.entries.find((entry) => entry.branch === "dogfood/local-ahead");
  assert.equal(salvageEntry?.aheadOfBase, 2);
  assert.equal(salvageEntry?.remoteBranchExists, false);
  assert.match(salvageEntry?.manualReviewCommands.join("\n") ?? "", /review or cherry-pick local-only commits/i);
  assert.deepEqual(salvageEntry?.manualCleanupCommands, []);

  const safeEntry = result.entries.find((entry) => entry.branch === "dogfood/old-merged");
  assert.equal(safeEntry?.aheadOfBase, 0);
  assert.ok(safeEntry?.manualCleanupCommands.includes("git worktree remove <path>"));

  assert.equal(calls.some(([command, args]) => command === "git" && ["fetch", "worktree remove", "branch -d"].includes(args.join(" "))), false);
});

test("status orphan-worktrees emits parseable JSON", () => {
  const stdout = execFileSync(process.execPath, [cli, "status", "orphan-worktrees", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const result = JSON.parse(stdout);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.command, "status orphan-worktrees");
  assert.equal(result.linkedIssue, "#709");
  assert.equal(result.readOnly, true);
  assert.ok(Array.isArray(result.entries));
});
