// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const doc = fs.readFileSync(path.join(repoRoot, "docs", "dogfood", "clean-idle-nudge-handoff-1085.md"), "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

function assertDocsInclude(text) {
  assert.ok(compactDoc.includes(text), `missing issue #1085 doc text: ${text}`);
}

test("issue #1085 dogfood doc preserves clean-idle handoff shape", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#1085");
  assert.equal(report.readOnly, true);
  assert.equal(report.operatorCheckField, "activeWorkReceipts.cleanIdleNudgeHandoffBoundary");
  assert.equal(report.classification, "clean-idle-handoff-artifact-required");
  assert.equal(report.preservesOperatorCheckVerdict, "idleRequiresActiveArtifact");
  assert.equal(report.currentEvidence.postMergeMainCiEchoPresent, true);
  assert.equal(report.currentEvidence.staleResidueIsActiveDevelopmentEvidence, false);
  assert.equal(report.currentEvidence.ciEchoIsActiveDevelopmentEvidence, false);
  assert.equal(report.requiresExplicitHandoffArtifactBeforeDevelopmentClaim, true);
  assert.deepEqual(report.acceptableHandoffArtifacts, [
    "open GitHub issue",
    "non-main branch or live worktree",
    "mapped fooks tmux session",
    "open GitHub pull request",
  ]);
  assert.equal(report.mutationBoundary.createsIssuesFromCli, false);
  assert.equal(report.mutationBoundary.changesRuntimeProviderFrontendOrMergeGatePolicy, false);
  assert.match(report.rule, /idleRequiresActiveArtifact/);
  assert.match(report.rule, /do not auto-create an issue from the CLI/);
});

test("issue #1085 docs state CI echoes and stale residue are non-authorizing", () => {
  for (const required of [
    "Issue #1085 clean-idle nudge handoff",
    "clean-idle `fooks nudge` handoff",
    "`npm run --silent check -- --json` returns `idleRequiresActiveArtifact`",
    "A clean post-merge `main` CI echo is a receipt, not active work",
    "Stale local worktree residue is cleanup-review context, not active work",
    "seed or resume an explicit handoff artifact",
    "open GitHub issue",
    "non-`main` branch/worktree",
    "mapped fooks tmux session",
    "open PR",
    "must not auto-create issues",
    "must not auto-create an issue from the CLI",
    "close or mutate `#960`",
    "preserves the existing top-level `idleRequiresActiveArtifact` verdict",
    "activeWorkReceipts.cleanIdleNudgeHandoffBoundary",
    "Current development: **idle / handoff artifact required**",
    "Evidence that is not active work: post-merge CI echoes",
  ]) {
    assertDocsInclude(required);
  }
});
