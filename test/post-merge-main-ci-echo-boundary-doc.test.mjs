// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const doc = fs.readFileSync(path.join(repoRoot, "docs", "post-merge-main-ci-echo-boundary.md"), "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function assertDocIncludes(text) {
  assert.ok(compactDoc.includes(text), `missing boundary text: ${text}`);
}

test("post-merge main CI echo boundary doc names the read-only operator surfaces", () => {
  for (const required of [
    "echo receipt only",
    "open issue, an open pull request, a non-`main` active branch/worktree signal, or a mapped fooks tmux session",
    "the echo receipt and the active artifact receipt separate",
    "fooks check --json",
    'verdict: "idleRequiresActiveArtifact"',
    "requiredActiveArtifact.required: true",
    "open GitHub issue, an open GitHub pull request, or a mapped fooks tmux session",
    "fooks status activity --include-remote-counts --json",
    "currentRunEvidence",
    'classification: "mainEchoNonActive"',
    "mainEchoEvidence: true",
    "activeWorkEvidence: false",
    "ci:alerts",
    'verdict: "current-main-echo"',
    'disposition: "verification-only"',
    "npm run evidence:react-web-release-report",
    "advisory release report",
  ]) {
    assertDocIncludes(required);
  }
});

test("post-merge main CI echo boundary doc preserves non-goals", () => {
  for (const nonGoal of [
    "does not change runtime/provider behavior",
    "merge-gate policy",
    "detector scope",
    "React Web behavior",
    "React Native behavior",
    "TUI behavior",
    "WebView behavior",
    "no performance, product, billing, provider-cost, runtime-token, or broad-support claim",
    "not cleanup authority",
  ]) {
    assertDocIncludes(nonGoal);
  }
});
