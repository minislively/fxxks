import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(repoRoot, "docs", "dogfood", "worktree-cwd-focused-test-guard-1025.md");

test("issue #1025 dogfood doc keeps focused React Web status verification tied to worktree cwd", () => {
  const doc = fs.readFileSync(docPath, "utf8");

  assert.match(doc, /# Issue #1025 worktree cwd focused-test guard/);
  assert.match(doc, /#960 reliability\/session-handoff lane/);
  assert.match(doc, /`process\.cwd\(\)` as the\s+repo root under verification/);
  assert.match(doc, /root-cwd cross-worktree invocation/);
  assert.match(doc, /false local\s+failure/);
  assert.match(doc, /cd \/path\/to\/issue-worktree/);
  assert.match(doc, /node --test test\/react-web-status-surface\.test\.mjs/);
  assert.match(doc, /rerun from the expected cwd before reporting branch health/);
  assert.match(doc, /does not change product\s+runtime behavior, provider hooks, merge policy, telemetry, billing\/token proof,\s+or frontend detector scope/);
});
