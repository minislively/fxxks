import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyStaleEpicChecklistCandidate } from "./helpers/stale-epic-checklist-boundary.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(repoRoot, "docs", "dogfood", "stale-epic-checklist-boundary-1031.md");
const doc = fs.readFileSync(docPath, "utf8");
const compactDoc = doc.replace(/\s+/gu, " ");

function extractJsonFence(markdown) {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/u);
  assert.ok(match, "expected a fenced JSON report-shape example");
  return JSON.parse(match[1]);
}

test("issue #1031 helper treats unchecked epic text without current evidence as advisory only", () => {
  assert.deepEqual(
    classifyStaleEpicChecklistCandidate({
      epic: "#960",
      uncheckedEpicChecklistText: "long-run budget warning slice",
      evidence: {
        childIssues: [{ number: 988, state: "closed", title: "Long-run budget warning" }],
        branches: [],
        sessions: [],
        pullRequests: [],
      },
    }),
    {
      epic: "#960",
      checklistTextAuthority: "advisory",
      classification: "epic-checklist-advisory-only",
      activeNextWorkAllowed: false,
      activeEvidenceKinds: [],
      duplicateSessionRisk: "elevated-until-sibling-search",
      rule: "Unchecked epic checklist text is advisory unless backed by an open child issue, active branch/session, open PR, or exact duplicate search.",
    },
  );
});

test("issue #1031 helper allows active next work only when a current anchor or exact duplicate search backs the slice", () => {
  for (const [name, evidence, expectedKind] of [
    ["open child issue", { childIssues: [{ number: 1031, state: "open" }] }, "open-child-issue"],
    ["active branch", { branches: [{ name: "dogfood/issue-1031-stale-epic-checklist-boundary", active: true }] }, "active-branch"],
    ["live session", { sessions: [{ session: "fooks-dogfood-issue-1031", state: "active" }] }, "active-session"],
    ["open PR", { pullRequests: [{ number: 1032, state: "open" }] }, "open-pull-request"],
    ["exact duplicate search", { exactDuplicateSearch: { performed: true, query: '"long-run budget warning" repo:minislively/fooks' } }, "exact-duplicate-search"],
  ]) {
    const result = classifyStaleEpicChecklistCandidate({
      epic: "#960",
      uncheckedEpicChecklistText: "possible follow-up slice",
      evidence,
    });

    assert.equal(result.classification, "active-next-work-candidate", name);
    assert.equal(result.checklistTextAuthority, "backed", name);
    assert.equal(result.activeNextWorkAllowed, true, name);
    assert.deepEqual(result.activeEvidenceKinds, [expectedKind], name);
    assert.equal(result.duplicateSessionRisk, "bounded", name);
  }
});

test("issue #1031 dogfood doc preserves the stale epic checklist boundary", () => {
  const report = extractJsonFence(doc);

  assert.equal(report.issue, "#1031");
  assert.equal(report.readOnly, true);
  assert.equal(report.sourceEpic, "#960");
  assert.deepEqual(report.postPr1030OpenIssueInventory, ["#960"]);
  assert.equal(report.staleChecklistExample.closedChildIssue, "#988");
  assert.equal(report.staleChecklistExample.closedChildIssueIsActiveNextWork, false);
  assert.equal(report.operatorDecision.classification, "epic-checklist-advisory-only");
  assert.equal(report.operatorDecision.uncheckedEpicChecklistTextIsAdvisory, true);
  assert.deepEqual(report.operatorDecision.activeNextWorkRequiresOneOf, [
    "open-child-issue",
    "active-branch-or-worktree",
    "live-mapped-session",
    "open-pull-request",
    "exact-duplicate-search",
  ]);
  assert.equal(report.operatorDecision.duplicateSessionRisk, "elevated-until-sibling-search");
  assert.match(report.operatorDecision.rule, /Unchecked epic checklist text is advisory/);

  for (const required of [
    "narrow read-only dogfood docs/test/helper guard for issue #1031",
    "bounds stale unchecked checklist text in the open #960 epic",
    "after PR #1030",
    "only epic `#960` is open",
    "closed child issues such as long-run budget warning `#988`",
    "Unchecked epic checklist text is **advisory**",
    "an open child issue for the slice",
    "a non-stale active branch or worktree",
    "a live mapped session",
    "an open PR",
    "an exact duplicate search",
    "Closed child issues are receipts, not active next-work anchors",
    "`epic-checklist-advisory-only`",
    "do not spawn a new duplicate branch/session from the epic body text alone",
    "does not mutate GitHub issues automatically",
    "change merge policy",
    "provider/runtime hooks",
    "telemetry",
    "billing/token proof",
    "detector scope",
    "product claims",
  ]) {
    assert.ok(compactDoc.includes(required), `missing #1031 doc text: ${required}`);
  }
});
