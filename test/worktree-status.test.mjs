// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);

const {
  parseWorktreeStatus,
  summarizeWorktreeStatus,
  parseAndSummarizeWorktreeStatus,
} = require(path.join(repoRoot, "dist", "core", "worktree-status.js"));

test("parseWorktreeStatus parses modified, staged, deleted, and untracked porcelain entries", () => {
  const entries = parseWorktreeStatus(" M README.md\nA  src/new.ts\n D old.txt\n?? scratch.log\n");

  assert.deepEqual(entries.map((entry) => [entry.path, entry.indexStatus, entry.worktreeStatus, entry.kind, entry.tracked]), [
    ["README.md", " ", "M", "modified", true],
    ["src/new.ts", "A", " ", "added", true],
    ["old.txt", " ", "D", "deleted", true],
    ["scratch.log", "?", "?", "untracked", false],
  ]);
});

test("parseWorktreeStatus preserves staged and worktree type-change status", () => {
  const entries = parseWorktreeStatus("T  scripts/run.sh\n T docs/link.md\nMT src/mixed.ts\n");

  assert.deepEqual(entries.map((entry) => [entry.path, entry.indexStatus, entry.worktreeStatus, entry.kind, entry.tracked]), [
    ["scripts/run.sh", "T", " ", "type-changed", true],
    ["docs/link.md", " ", "T", "type-changed", true],
    ["src/mixed.ts", "M", "T", "type-changed", true],
  ]);
});

test("parseWorktreeStatus preserves rename source and destination for line porcelain", () => {
  const entries = parseWorktreeStatus("R  src/old.ts -> src/new.ts\n");

  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "renamed");
  assert.equal(entries[0].originalPath, "src/old.ts");
  assert.equal(entries[0].path, "src/new.ts");
});

test("parseWorktreeStatus parses nul-terminated porcelain rename fields", () => {
  const entries = parseWorktreeStatus("R  src/new.ts\0src/old.ts\0?? notes.md\0", { nulTerminated: true });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].kind, "renamed");
  assert.equal(entries[0].path, "src/new.ts");
  assert.equal(entries[0].originalPath, "src/old.ts");
  assert.equal(entries[1].kind, "untracked");
  assert.equal(entries[1].path, "notes.md");
});

test("summarizeWorktreeStatus separates tracked, untracked, ignored, and conflicted paths", () => {
  const summary = summarizeWorktreeStatus(parseWorktreeStatus(" M README.md\n?? scratch.log\n!! dist/index.js\nUU src/conflict.ts\n"));

  assert.equal(summary.clean, false);
  assert.deepEqual(summary.changedPaths, ["README.md", "scratch.log", "src/conflict.ts"]);
  assert.deepEqual(summary.trackedPaths, ["README.md", "src/conflict.ts"]);
  assert.deepEqual(summary.untrackedPaths, ["scratch.log"]);
  assert.deepEqual(summary.ignoredPaths, ["dist/index.js"]);
  assert.deepEqual(summary.conflictedPaths, ["src/conflict.ts"]);
});

test("parseAndSummarizeWorktreeStatus treats empty or ignored-only output as clean", () => {
  assert.equal(parseAndSummarizeWorktreeStatus("\n").clean, true);
  assert.equal(parseAndSummarizeWorktreeStatus("!! dist/index.js\n").clean, true);
});
