// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "dogfood", "active-pr-cleanup-branch-deletion-1047.md");

test("issue #1047 doc distinguishes active PR cleanup from branch deletion cleanup", () => {
  const doc = fs.readFileSync(docPath, "utf8");

  assert.match(doc, /active PR cleanup is not branch-deletion cleanup/i);
  assert.match(doc, /PR is still open and a required check is pending/i);
  assert.match(doc, /must not be collapsed into `safe-cleanup`, stale residue, or a\s+false idle\/no-artifact state/i);
  assert.match(doc, /Current non-main branch \| Active branch evidence/i);
  assert.match(doc, /Mapped fooks tmux\/session \| Active session evidence/i);
  assert.match(doc, /No open issue\/PR\/session, clean main, zero divergence \| Real idle\/no-artifact state/i);
  assert.match(doc, /does not change merge policy/i);
});
