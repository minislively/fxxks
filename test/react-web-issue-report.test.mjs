import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);
const { buildReactWebLabelPatchPreview } = require(path.join(repoRoot, "dist", "core", "react-web-label-preview.js"));
const {
  REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY,
  buildReactWebIssueReport,
} = require(path.join(repoRoot, "dist", "core", "react-web-issue-report.js"));

const fixtures = {
  missing: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "missing-labels.tsx"),
  labelled: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "labelled-controls.tsx"),
  association: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "label-association-candidates.tsx"),
  unsafeAssociation: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "label-association-unsafe.tsx"),
  rn: path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", "rn-accessibility-test-anchor.tsx"),
  customComponent: path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", "react-web", "custom-form-shell.tsx"),
};

function runIssues(file, ...args) {
  return spawnSync(process.execPath, [cliPath, "inspect", "react-web-issues", file, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function parseIssues(file) {
  const cli = runIssues(file, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  return JSON.parse(cli.stdout);
}

function matrixEntry({ fixture, expectedCards, report, preview, acceptedCards, rejectedCards = 0, noiseNotes = [], suggestionPlausibility }) {
  return {
    fixture,
    expectedCards,
    observedCards: report.summary.issueCount,
    acceptedCards,
    rejectedCards,
    noiseNotes,
    suggestionPlausibility,
    parityWithPreviewFindings: report.summary.issueCount === preview.summary.findingCount,
    verdict: report.summary.issueCount === expectedCards && acceptedCards === expectedCards && rejectedCards === 0 && noiseNotes.length === 0 && report.summary.issueCount === preview.summary.findingCount ? "pass" : "fail",
  };
}

test("React Web issue report emits actionable issue cards over label preview findings", () => {
  const report = parseIssues(fixtures.missing);
  const preview = buildReactWebLabelPatchPreview(fixtures.missing, repoRoot);

  assert.equal(report.schemaVersion, "react-web-issue-report.v1");
  assert.equal(report.command, "inspect react-web-issues");
  assert.equal(report.profile, "react-web");
  assert.equal(report.readOnly, true);
  assert.equal(report.autoApply, false);
  assert.equal(report.claimBoundary, REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY);
  assert.match(report.claimBoundary, /Read-only React Web issue report/);
  assert.match(report.claimBoundary, /does not auto-apply patches/);
  assert.match(report.claimBoundary, /does not infer custom-component semantics/);
  assert.equal(report.sourcePreview.findingCount, preview.summary.findingCount);
  assert.equal(report.summary.issueCount, 5);
  assert.equal(report.summary.manualReviewCount, 5);
  assert.equal(report.summary.unsafeToAutoApplyCount, 5);

  assert.deepEqual(report.issues.map((issue) => [issue.kind, issue.evidence.element, issue.confidence, issue.fixability, issue.autoFixSafety]), [
    ["react-web.missing-accessible-label", "button", "high", "manual-review", "unsafe-to-auto-apply"],
    ["react-web.missing-accessible-label", "input", "high", "manual-review", "unsafe-to-auto-apply"],
    ["react-web.ambiguous-accessible-label", "input", "medium", "manual-review", "unsafe-to-auto-apply"],
    ["react-web.missing-accessible-label", "select", "high", "manual-review", "unsafe-to-auto-apply"],
    ["react-web.ambiguous-accessible-label", "textarea", "medium", "manual-review", "unsafe-to-auto-apply"],
  ]);

  for (const issue of report.issues) {
    assert.ok(issue.problem.length > 0);
    assert.ok(issue.whyItMatters.length > 0);
    assert.equal(issue.evidence.filePath, "test/fixtures/react-web-label-preview/missing-labels.tsx");
    assert.ok(issue.evidence.line > 0);
    assert.ok(issue.evidence.context.length > 0);
    assert.ok(issue.evidence.sourceSignals.length > 0);
    assert.ok(issue.safetyRationale.length > 0);
    assert.ok(issue.suggestedFixIntent.length > 0);
    assert.equal(issue.preview.readOnly, true);
    assert.match(issue.preview.text, /aria-label="TODO:/);
  }
});

test("React Web issue report turns nearby native associations into safe preview cards", () => {
  const report = parseIssues(fixtures.association);
  const preview = buildReactWebLabelPatchPreview(fixtures.association, repoRoot);

  assert.equal(report.summary.issueCount, 3);
  assert.equal(report.summary.safePreviewCount, 3);
  assert.equal(report.summary.manualReviewCount, 0);
  assert.equal(report.summary.issueCount, preview.summary.findingCount);
  assert.ok(report.issues.every((issue) => issue.kind === "react-web.unassociated-nearby-label"));
  assert.ok(report.issues.every((issue) => issue.fixability === "safe-preview"));
  assert.ok(report.issues.every((issue) => issue.autoFixSafety === "not-auto-applied"));
  assert.match(report.issues[0].preview.text, /htmlFor="email"/);
});

test("React Web issue report fixture usefulness gate records accepted cards, noise, plausibility, and parity", () => {
  const cases = [
    {
      name: "missing-labels.tsx",
      file: fixtures.missing,
      expectedCards: 5,
      acceptedCards: 5,
      suggestionPlausibility: "TODO accessible-name previews are plausible but require human copy review.",
    },
    {
      name: "label-association-candidates.tsx",
      file: fixtures.association,
      expectedCards: 3,
      acceptedCards: 3,
      suggestionPlausibility: "Native nearby label/control htmlFor/id previews are deterministic and read-only.",
    },
    {
      name: "labelled-controls.tsx",
      file: fixtures.labelled,
      expectedCards: 0,
      acceptedCards: 0,
      suggestionPlausibility: "No suggestion needed because native controls already have label evidence.",
    },
  ];

  const matrix = cases.map((item) => {
    const report = buildReactWebIssueReport(item.file, repoRoot);
    const preview = buildReactWebLabelPatchPreview(item.file, repoRoot);
    return matrixEntry({ ...item, fixture: item.name, report, preview });
  });

  assert.deepEqual(matrix.map((entry) => entry.verdict), ["pass", "pass", "pass"]);
  assert.ok(matrix.every((entry) => entry.parityWithPreviewFindings));
  assert.ok(matrix.every((entry) => entry.noiseNotes.length === 0));
});

test("React Web issue report preserves skip and no unsupported custom-component inference boundaries", () => {
  const rnReport = parseIssues(fixtures.rn);
  assert.equal(rnReport.inScope, false);
  assert.match(rnReport.skippedReason, /^domain-classification:react-native/);
  assert.deepEqual(rnReport.issues, []);

  const customReport = parseIssues(fixtures.customComponent);
  assert.equal(customReport.inScope, true);
  assert.equal(customReport.summary.issueCount, 0);
  assert.deepEqual(customReport.issues, []);
});

test("React Web issue report avoids unsafe htmlFor inference and keeps fallback previews read-only", () => {
  const report = parseIssues(fixtures.unsafeAssociation);
  const preview = buildReactWebLabelPatchPreview(fixtures.unsafeAssociation, repoRoot);
  const matrix = matrixEntry({
    fixture: "label-association-unsafe.tsx",
    expectedCards: preview.summary.findingCount,
    observedCards: report.summary.issueCount,
    report,
    preview,
    acceptedCards: report.summary.issueCount,
    suggestionPlausibility: "Unsafe nearby association is rejected; fallback aria-label TODO previews remain read-only/manual-review.",
  });

  assert.equal(matrix.verdict, "pass");
  assert.equal(report.summary.safePreviewCount, 0);
  assert.ok(report.summary.manualReviewCount > 0);
  assert.ok(report.issues.every((issue) => issue.fixability === "manual-review"));
  assert.ok(report.issues.every((issue) => issue.autoFixSafety === "unsafe-to-auto-apply"));
  assert.doesNotMatch(JSON.stringify(report), /htmlFor=/);
});

test("React Web issue report text mode is issue-card-first and prints the claim boundary", () => {
  const cli = runIssues(fixtures.association);
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /# React Web issue report/);
  assert.match(cli.stdout, /Read-only React Web issue report/);
  assert.match(cli.stdout, /## Issue 1:/);
  assert.match(cli.stdout, /- why:/);
  assert.match(cli.stdout, /- file\/line:/);
  assert.match(cli.stdout, /- fixability: safe-preview/);
  assert.match(cli.stdout, /- auto-fix safety: not-auto-applied/);
  assert.match(cli.stdout, /```diff/);
  assert.doesNotMatch(cli.stdout, /Auto-apply: yes/);
});
