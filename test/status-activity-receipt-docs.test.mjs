// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const setupDoc = fs.readFileSync(path.join(repoRoot, "docs", "setup.md"), "utf8");
const docs = `${readme}\n${setupDoc}`.replace(/\s+/gu, " ");

function assertDocsInclude(text) {
  assert.ok(docs.includes(text), `missing receipt docs text: ${text}`);
}

test("operator docs document status activity receipt projection boundary", () => {
  for (const required of [
    "fooks status activity --receipt-json",
    "current-run receipt projection",
    "advisory, read-only, and does not create active work by itself",
    "must not be treated as creating active issue/branch/session/PR work by itself",
    "returns only `currentRunEvidence.receipt`",
  ]) {
    assertDocsInclude(required);
  }
});

test("operator docs document next-child evidence cue as check-derived status activity output", () => {
  for (const required of [
    "operatorStatusCues.remoteCountsRequiredNextAction",
    "advisory/non-authorizing",
    "fooks status activity --include-remote-counts --json",
    "before treating #960-only state as proven",
    "operatorStatusCues.nextChildEvidence",
    "operatorStatusCues.closeoutReceipt",
    "activeWorkReceipts.nextChildEvidenceBoundary",
    "bounded #960 closeout receipt",
    "operator-check JSON boundary remains the source of truth",
    "concrete child issue, PR, non-main branch, mapped fooks session, active worktree/process evidence, or blocker",
  ]) {
    assertDocsInclude(required);
  }
});

test("source checkout docs keep receipt-json compatible with npm alias guidance", () => {
  for (const required of [
    "`npm run -s status:activity -- --receipt-json`",
    "Those aliases build first",
    "same built `dist/cli/index.js`",
    "source-checkout handoffs should cite the aliases instead of sending maintainers to `docs/setup.md` or a direct `dist/cli/index.js` path",
  ]) {
    assertDocsInclude(required);
  }
});
