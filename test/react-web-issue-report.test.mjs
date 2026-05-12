import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  assertReactWebIssueFixtureUsefulness,
  evaluateReactWebIssueFixtureUsefulness,
  reactWebIssueFixtureRegressionClasses,
} from "./helpers/react-web-issue-fixture-gate.mjs";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);
const { buildReactWebLabelPatchPreview } = require(path.join(repoRoot, "dist", "core", "react-web-label-preview.js"));
const {
  REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY,
  buildReactWebIssueReport,
  buildReactWebIssueReportSummaryJson,
} = require(path.join(repoRoot, "dist", "core", "react-web-issue-report.js"));

const fixtures = {
  missing: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "missing-labels.tsx"),
  labelled: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "labelled-controls.tsx"),
  association: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "label-association-candidates.tsx"),
  unsafeAssociation: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "label-association-unsafe.tsx"),
  relatedContext: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "related-context-form.tsx"),
  formControls: path.join(repoRoot, "fixtures", "compressed", "FormControls.tsx"),
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

function hasNestedKey(value, key) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, key)) return true;
  return Object.values(value).some((entry) => hasNestedKey(entry, key));
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
    assert.equal(issue.whereToLook.filePath, "test/fixtures/react-web-label-preview/missing-labels.tsx");
    assert.ok(issue.whereToLook.line > 0);
    assert.ok(issue.whereToLook.context.length > 0);
    assert.ok(issue.evidence.line > 0);
    assert.ok(issue.evidence.context.length > 0);
    assert.ok(issue.evidence.sourceSignals.length > 0);
    assert.ok(issue.safetyRationale.length > 0);
    assert.ok(issue.suggestedFixIntent.length > 0);
    assert.equal(issue.suggestedAction, issue.suggestedFixIntent);
    assert.match(issue.skipReason, /human review|accessible-name copy/);
    assert.ok(issue.triage.rank > 0);
    assert.ok(["high", "medium", "low"].includes(issue.triage.priority));
    assert.ok(["safe-preview", "high-confidence-manual-review", "manual-review"].includes(issue.triage.bucket));
    assert.equal(issue.triage.evidence.safePreviewAvailable, false);
    assert.equal(issue.triage.evidence.confidence, issue.confidence);
    assert.equal(issue.triage.evidence.nativeElement, issue.evidence.element);
    assert.equal(issue.triage.evidence.sameFileContextAvailable, true);
    assert.equal(issue.triage.evidence.relatedContextCount, issue.relatedContext.length);
    assert.ok(issue.triage.evidence.reasons.length > 0);

    assert.ok(Array.isArray(issue.relatedContext));
    assert.ok(issue.relatedContext.length > 0);
    assert.ok(issue.relatedContext.length <= 5);
    const requiredContextKeys = Object.keys(issue.relatedContext[0])
      .filter((key) => ["kind", "file", "reason", "confidence", "source", "action"].includes(key))
      .sort();
    assert.deepEqual(requiredContextKeys, ["action", "confidence", "file", "kind", "reason", "source"]);
    assert.equal(issue.relatedContext[0].kind, "same-file-pattern");
    assert.equal(issue.relatedContext[0].action, "inspect-first");
    assert.equal(issue.relatedContext[0].source, "label-preview");
    assert.equal(issue.relatedContext[0].file, issue.whereToLook.filePath);
    assert.equal(issue.relatedContext[0].line, issue.whereToLook.line);
    assert.doesNotMatch(JSON.stringify(issue.relatedContext), /must-edit|auto-apply/i);
    assert.equal(issue.preview, undefined);
  }
});

test("React Web issue report turns nearby native associations into safe preview cards", () => {
  const report = parseIssues(fixtures.association);
  const preview = buildReactWebLabelPatchPreview(fixtures.association, repoRoot);

  assert.equal(report.summary.issueCount, 3);
  assert.equal(report.summary.safePreviewCount, 1);
  assert.equal(report.summary.manualReviewCount, 2);
  assert.equal(report.summary.issueCount, preview.summary.findingCount);
  assert.ok(report.issues.every((issue) => issue.kind === "react-web.unassociated-nearby-label"));
  assert.deepEqual(report.issues.map((issue) => [issue.confidence, issue.fixability, issue.autoFixSafety, Boolean(issue.preview)]), [
    ["high", "safe-preview", "not-auto-applied", true],
    ["medium", "manual-review", "unsafe-to-auto-apply", false],
    ["medium", "manual-review", "unsafe-to-auto-apply", false],
  ]);
  assert.deepEqual(report.triageRollup.safePreviewIssueIds, ["react-web-label-1"]);
  assert.deepEqual(report.triageRollup.bucketCounts, {
    "safe-preview": 1,
    "high-confidence-manual-review": 0,
    "manual-review": 2,
  });
  assert.equal(report.issues[0].triage.evidence.safePreviewAvailable, true);
  assert.equal(report.issues[0].triage.bucket, "safe-preview");
  assert.equal(report.issues[0].triage.rank, 1);
  assert.match(report.issues[0].preview.text, /htmlFor="email"/);
  assert.ok(report.issues.every((issue) => issue.relatedContext.length > 0));
  assert.ok(report.issues.every((issue) => issue.relatedContext.length <= 5));
  assert.ok(report.issues.every((issue) => issue.relatedContext[0].action === "inspect-first"));
  assert.match(report.issues[1].skipReason, /not high-confidence deterministic evidence/);
});

test("React Web issue report JSON includes conservative priority rollup for first-minute compressed fixture", () => {
  const report = parseIssues(fixtures.formControls);

  assert.equal(report.summary.issueCount, 5);
  assert.equal(report.summary.safePreviewCount, 0);
  assert.equal(report.summary.manualReviewCount, 5);
  assert.match(report.triageRollup.claimBoundary, /Conservative local triage only/);
  assert.match(report.triageRollup.claimBoundary, /does not edit files/);
  assert.match(report.triageRollup.claimBoundary, /does not.*infer custom-component semantics/);
  assert.deepEqual(report.triageRollup.criteria, [
    "safe preview availability",
    "label-preview confidence",
    "native element type",
    "same-file JSX context",
    "related-context count and source quality",
  ]);
  assert.deepEqual(report.triageRollup.bucketCounts, {
    "safe-preview": 0,
    "high-confidence-manual-review": 5,
    "manual-review": 0,
  });
  assert.deepEqual(report.triageRollup.priorityCounts, { high: 5, medium: 0, low: 0 });
  assert.deepEqual(report.triageRollup.rankedIssueIds, [
    "react-web-label-1",
    "react-web-label-4",
    "react-web-label-5",
    "react-web-label-2",
    "react-web-label-3",
  ]);
  assert.deepEqual(report.triageRollup.topManualReviewIssueIds, [
    "react-web-label-1",
    "react-web-label-4",
    "react-web-label-5",
  ]);
  assert.deepEqual(report.triageRollup.safePreviewIssueIds, []);
  assert.deepEqual(report.triageRollup.manualReviewIssueIds, report.triageRollup.rankedIssueIds);

  const byId = Object.fromEntries(report.issues.map((issue) => [issue.id, issue]));
  assert.equal(byId["react-web-label-1"].triage.rank, 1);
  assert.equal(byId["react-web-label-2"].triage.rank, 4);
  assert.equal(byId["react-web-label-3"].triage.rank, 5);
  assert.equal(byId["react-web-label-1"].triage.evidence.relatedContextQuality, "same-file-only");
  assert.deepEqual(byId["react-web-label-1"].triage.evidence.relatedContextSources, [
    "label-preview",
    "same-directory",
  ]);
  assert.equal(byId["react-web-label-1"].triage.evidence.safePreviewAvailable, false);
  assert.equal(byId["react-web-label-1"].triage.evidence.sameFileContextAvailable, true);
  assert.ok(byId["react-web-label-1"].triage.evidence.reasons.some((reason) => /same-file JSX context/.test(reason)));
  assert.equal(byId["react-web-label-1"].fixShapeGuidance.shape, "human-reviewed-native-control-name");
  assert.match(byId["react-web-label-1"].fixShapeGuidance.claimBoundary, /Local fix-shape guidance only/);
  assert.match(byId["react-web-label-1"].fixShapeGuidance.claimBoundary, /does not generate accessible-name copy/);
  assert.equal(byId["react-web-label-1"].fixShapeGuidance.humanReviewRequired, true);
  assert.equal(byId["react-web-label-1"].fixShapeGuidance.autoApply, false);
  assert.deepEqual(byId["react-web-label-1"].fixShapeGuidance.localEvidence.attributes, [
    "name=email",
    "onChange",
    "required",
    "type=email",
  ]);
  assert.deepEqual(byId["react-web-label-2"].fixShapeGuidance.localEvidence.attributes, [
    "className",
    "defaultValue",
    "name=role",
  ]);
  assert.deepEqual(byId["react-web-label-3"].fixShapeGuidance.localEvidence.attributes, [
    "className",
    "defaultValue",
    "disabled",
    "name=notes",
  ]);
  assert.deepEqual(byId["react-web-label-4"].fixShapeGuidance.localEvidence.attributes, [
    "className",
    "spread:field",
    "type=text",
  ]);
  assert.deepEqual(byId["react-web-label-5"].fixShapeGuidance.localEvidence.attributes, [
    "className",
    "spread:register(\"email\")",
  ]);
  assert.ok(Object.values(byId).every((issue) => issue.fixShapeGuidance.localEvidence.sameFileContextAvailable));
  assert.ok(Object.values(byId).every((issue) => !issue.fixShapeGuidance.localEvidence.safePreviewAvailable));
  assert.ok(Object.values(byId).every((issue) => issue.fixShapeGuidance.inspectFirst.some((item) => /Select the final label\/name text manually/.test(item))));
  assert.doesNotMatch(JSON.stringify(report.issues.map((issue) => issue.fixShapeGuidance)), /must-edit|auto-apply|Controller/i);
  assert.doesNotMatch(JSON.stringify(report.triageRollup), /must-edit/i);
});

test("React Web issue report recommends bounded local related context from imports, siblings, tests, and same-file patterns", () => {
  const report = parseIssues(fixtures.relatedContext);

  assert.equal(report.summary.issueCount, 2);
  for (const issue of report.issues) {
    assert.ok(issue.relatedContext.length >= 2);
    assert.ok(issue.relatedContext.length <= 5);
    assert.ok(issue.relatedContext.every((entry) => typeof entry.file === "string" && entry.file.length > 0));
    assert.ok(issue.relatedContext.every((entry) => typeof entry.reason === "string" && entry.reason.length > 0));
    assert.ok(issue.relatedContext.every((entry) => ["high", "medium", "low"].includes(entry.confidence)));
    assert.ok(issue.relatedContext.every((entry) => entry.action === "inspect-first"));
  }

  const entries = report.issues[0].relatedContext;
  assert.deepEqual(entries.map((entry) => entry.kind), [
    "same-file-pattern",
    "imported-local-component",
    "imported-local-component",
    "nearby-test",
    "same-directory-source",
  ]);
  assert.ok(entries.some((entry) => entry.file.endsWith("/FormField.tsx") && entry.confidence === "medium"));
  assert.ok(entries.some((entry) => entry.file.endsWith("/Input.tsx") && entry.confidence === "medium"));
  assert.ok(entries.some((entry) => entry.kind === "nearby-test" && entry.file.endsWith("/related-context-form.test.tsx") && entry.confidence === "medium"));
  assert.ok(entries.some((entry) => entry.kind === "same-directory-source" && entry.confidence === "low"));

  const buttonEntries = report.issues[1].relatedContext;
  assert.ok(buttonEntries.some((entry) => entry.kind === "same-file-pattern" && entry.file.endsWith("/related-context-form.tsx")));
  assert.doesNotMatch(JSON.stringify(report.issues.flatMap((issue) => issue.relatedContext)), /must-edit|auto-apply/i);
});

test("React Web issue report includes nearby same-basename tests when not displaced by stronger local source evidence", () => {
  const report = parseIssues(fixtures.relatedContext);
  const allEntries = report.issues.flatMap((issue) => issue.relatedContext);
  assert.ok(allEntries.some((entry) => entry.kind === "nearby-test" && entry.file.endsWith("/related-context-form.test.tsx")));
});

test("React Web issue report fixture usefulness gate records accepted cards, noise, plausibility, and parity", () => {
  const cases = [
    {
      name: "missing-labels.tsx",
      file: fixtures.missing,
      expectedCards: 5,
      acceptedCards: 5,
      expectedSafePreviewCount: 0,
      expectedManualReviewCount: 5,
      suggestionPlausibility: "TODO accessible-name suggestions are plausible but require human copy review, so no preview is emitted.",
    },
    {
      name: "label-association-candidates.tsx",
      file: fixtures.association,
      expectedCards: 3,
      acceptedCards: 3,
      expectedSafePreviewCount: 1,
      expectedManualReviewCount: 2,
      suggestionPlausibility: "High-confidence native nearby label/control htmlFor/id previews are deterministic and read-only; medium-confidence associations stay manual review.",
    },
    {
      name: "labelled-controls.tsx",
      file: fixtures.labelled,
      expectedCards: 0,
      acceptedCards: 0,
      expectedSafePreviewCount: 0,
      expectedManualReviewCount: 0,
      suggestionPlausibility: "No suggestion needed because native controls already have label evidence.",
    },
    {
      name: "rn-accessibility-test-anchor.tsx",
      file: fixtures.rn,
      expectedCards: 0,
      acceptedCards: 0,
      expectedSafePreviewCount: 0,
      expectedManualReviewCount: 0,
      expectedUnsupported: true,
      expectedSkippedReason: /^domain-classification:react-native/,
      suggestionPlausibility: "React Native fixture is an unsupported boundary and must not produce React Web issue cards.",
    },
  ];

  assert.deepEqual(reactWebIssueFixtureRegressionClasses, [
    "count-mismatch",
    "detector-parity",
    "noisy-suggestion",
    "unsafe-preview",
    "unsupported-boundary",
  ]);

  const matrix = evaluateReactWebIssueFixtureUsefulness(
    cases,
    (file) => buildReactWebIssueReport(file, repoRoot),
    (file) => buildReactWebLabelPatchPreview(file, repoRoot),
  );

  for (const entry of matrix) assertReactWebIssueFixtureUsefulness(entry);
  assert.deepEqual(matrix.map((entry) => entry.verdict), ["pass", "pass", "pass", "pass"]);
  assert.ok(matrix.every((entry) => entry.parityWithPreviewFindings));
  assert.ok(matrix.every((entry) => entry.noiseNotes.length === 0));
  assert.ok(matrix.some((entry) => entry.expectedUnsupported === true && entry.unsupported === true));
  assert.ok(matrix.some((entry) => entry.expectedUnsupported === true && entry.unsupportedSkipBoundary === true));
});

test("React Web issue report preserves skip and no unsupported custom-component inference boundaries", () => {
  const rnReport = parseIssues(fixtures.rn);
  assert.equal(rnReport.inScope, false);
  assert.match(rnReport.skippedReason, /^domain-classification:react-native/);
  assert.deepEqual(rnReport.issues, []);
  assert.deepEqual(rnReport.firstMinuteSummary, { sourceTopIssueIds: [], items: [] });

  const customReport = parseIssues(fixtures.customComponent);
  assert.equal(customReport.inScope, true);
  assert.equal(customReport.summary.issueCount, 0);
  assert.deepEqual(customReport.issues, []);
  assert.deepEqual(customReport.firstMinuteSummary, { sourceTopIssueIds: [], items: [] });
});

test("React Web issue report avoids unsafe htmlFor inference and keeps fallback previews read-only", () => {
  const report = parseIssues(fixtures.unsafeAssociation);
  const preview = buildReactWebLabelPatchPreview(fixtures.unsafeAssociation, repoRoot);
  const matrix = evaluateReactWebIssueFixtureUsefulness(
    [
      {
        name: "label-association-unsafe.tsx",
        file: fixtures.unsafeAssociation,
        expectedCards: preview.summary.findingCount,
        acceptedCards: report.summary.issueCount,
        expectedSafePreviewCount: 0,
        expectedManualReviewCount: report.summary.issueCount,
        suggestionPlausibility: "Unsafe nearby association is rejected; fallback aria-label TODO suggestions remain manual-review without preview.",
      },
    ],
    (file) => buildReactWebIssueReport(file, repoRoot),
    (file) => buildReactWebLabelPatchPreview(file, repoRoot),
  );

  assertReactWebIssueFixtureUsefulness(matrix[0]);
  assert.equal(matrix[0].verdict, "pass");
  assert.equal(report.summary.safePreviewCount, 0);
  assert.ok(report.summary.manualReviewCount > 0);
  assert.ok(report.issues.every((issue) => issue.fixability === "manual-review"));
  assert.ok(report.issues.every((issue) => issue.autoFixSafety === "unsafe-to-auto-apply"));
  assert.ok(report.issues.every((issue) => issue.skipReason));
  assert.ok(report.issues.every((issue) => issue.preview === undefined));
  assert.ok(report.issues.every((issue) => issue.relatedContext.length <= 5));
  assert.ok(report.issues.every((issue) => issue.relatedContext.every((entry) => entry.action === "inspect-first")));
  assert.doesNotMatch(JSON.stringify(report.issues.flatMap((issue) => issue.relatedContext)), /must-edit|auto-apply/i);
  assert.doesNotMatch(JSON.stringify(report), /htmlFor=/);
});

test("React Web issue report text mode is issue-card-first and prints the claim boundary", () => {
  const cli = runIssues(fixtures.association);
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /# React Web issue report/);
  assert.match(cli.stdout, /Read-only React Web issue report/);
  assert.match(cli.stdout, /## Triage rollup/);
  assert.match(cli.stdout, /- priority counts:/);
  assert.match(cli.stdout, /- ranked issue ids:/);
  assert.match(cli.stdout, /- top manual-review ids:/);
  assert.match(cli.stdout, /- criteria: safe preview availability; label-preview confidence; native element type; same-file JSX context; related-context count and source quality/);
  assert.match(cli.stdout, /## Issue 1:/);
  assert.match(cli.stdout, /- triage: rank 1, high priority, safe-preview, score \d+/);
  assert.match(cli.stdout, /- triage evidence: safe preview yes, same-file context yes, related context \d+ \(/);
  assert.match(cli.stdout, /- why:/);
  assert.match(cli.stdout, /- where to look:/);
  assert.match(cli.stdout, /- fixability: safe-preview/);
  assert.match(cli.stdout, /- auto-fix safety: not-auto-applied/);
  assert.match(cli.stdout, /- suggested action:/);
  assert.match(cli.stdout, /- fix shape: safe-preview-htmlFor-association/);
  assert.match(cli.stdout, /- inspect first for fix shape:/);
  assert.match(cli.stdout, /Review the safe preview diff as a candidate shape; fooks still does not apply it/);
  assert.match(cli.stdout, /- inspect first:/);
  assert.match(cli.stdout, /same-file-pattern/);
  assert.match(cli.stdout, /```diff/);
  assert.doesNotMatch(cli.stdout, /Auto-apply: yes/);
});

test("React Web issue report text mode prints per-card manual-review fix-shape guidance", () => {
  const cli = runIssues(fixtures.formControls);
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /- top manual-review ids: react-web-label-1, react-web-label-4, react-web-label-5/);
  assert.match(cli.stdout, /- fix shape: human-reviewed-native-control-name/);
  assert.match(cli.stdout, /Use existing attribute evidence as hints only: name=email, onChange, required, type=email/);
  assert.match(cli.stdout, /Use existing attribute evidence as hints only: className, spread:field, type=text/);
  assert.match(cli.stdout, /Use existing attribute evidence as hints only: className, spread:register\("email"\)/);
  assert.match(cli.stdout, /Select the final label\/name text manually; fooks does not generate accessible-name copy/);
  assert.match(cli.stdout, /- inspect first for fix shape:/);
  assert.doesNotMatch(cli.stdout, /must-edit|Auto-apply: yes|Controller/);
});

test("React Web issue report text mode adds compact first-minute summary before detailed cards", () => {
  const cli = runIssues(fixtures.formControls);
  assert.equal(cli.status, 0, cli.stderr);

  const summaryIndex = cli.stdout.indexOf("## First-minute summary");
  const issueIndex = cli.stdout.indexOf("## Issue 1:");
  assert.ok(summaryIndex > 0, "expected compact first-minute summary");
  assert.ok(issueIndex > summaryIndex, "compact summary should appear before detailed issue cards");

  assert.match(cli.stdout, /Compact read-only triage from existing ranked issue evidence/);
  assert.match(cli.stdout, /inspect before editing and keep human review/);
  assert.match(
    cli.stdout,
    /- react-web-label-1: human-reviewed-native-control-name; first inspect: Inspect fixtures\/compressed\/FormControls\.tsx:23-23 \(input\) before editing\./,
  );
  assert.match(
    cli.stdout,
    /- react-web-label-4: human-reviewed-native-control-name; first inspect: Inspect fixtures\/compressed\/FormControls\.tsx:32-32 \(input\) before editing\./,
  );
  assert.match(
    cli.stdout,
    /- react-web-label-5: human-reviewed-native-control-name; first inspect: Inspect fixtures\/compressed\/FormControls\.tsx:34-34 \(input\) before editing\./,
  );
  const compactBlock = cli.stdout.slice(summaryIndex, issueIndex);
  assert.doesNotMatch(compactBlock, /must-edit|Auto-apply: yes|generated accessible-name copy/);
});

test("React Web issue report JSON includes machine-readable first-minute summary projection", () => {
  const cli = runIssues(fixtures.formControls, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  assert.doesNotMatch(cli.stdout, /First-minute summary/);

  const report = JSON.parse(cli.stdout);
  assert.equal(report.schemaVersion, "react-web-issue-report.v1");
  assert.deepEqual(report.triageRollup.topIssueIds, [
    "react-web-label-1",
    "react-web-label-4",
    "react-web-label-5",
  ]);
  assert.deepEqual(report.firstMinuteSummary.sourceTopIssueIds, report.triageRollup.topIssueIds);
  assert.deepEqual(
    report.firstMinuteSummary.items.map((item) => item.issueId),
    report.triageRollup.topIssueIds,
  );

  const byId = Object.fromEntries(report.issues.map((issue) => [issue.id, issue]));
  for (const item of report.firstMinuteSummary.items) {
    const issue = byId[item.issueId];
    assert.ok(issue, `expected first-minute item to reference an existing issue: ${item.issueId}`);
    assert.equal(item.fixShape, issue.fixShapeGuidance.shape);
    assert.equal(
      item.firstInspectStep,
      issue.fixShapeGuidance.inspectFirst[0] ?? `${issue.whereToLook.filePath}:${issue.whereToLook.line}-${issue.whereToLook.endLine}`,
    );
    assert.deepEqual(item.inspectFirst, issue.fixShapeGuidance.inspectFirst);
    assert.equal(item.fixShapeGuidance.claimBoundary, issue.fixShapeGuidance.claimBoundary);
    assert.equal(item.fixShapeGuidance.humanReviewRequired, true);
    assert.equal(item.fixShapeGuidance.autoApply, false);
  }

  assert.deepEqual(
    report.firstMinuteSummary.items.map((item) => [item.issueId, item.fixShape, item.firstInspectStep]),
    [
      [
        "react-web-label-1",
        "human-reviewed-native-control-name",
        "Inspect fixtures/compressed/FormControls.tsx:23-23 (input) before editing.",
      ],
      [
        "react-web-label-4",
        "human-reviewed-native-control-name",
        "Inspect fixtures/compressed/FormControls.tsx:32-32 (input) before editing.",
      ],
      [
        "react-web-label-5",
        "human-reviewed-native-control-name",
        "Inspect fixtures/compressed/FormControls.tsx:34-34 (input) before editing.",
      ],
    ],
  );
  assert.doesNotMatch(JSON.stringify(report.firstMinuteSummary), /must-edit|Auto-apply: yes|Controller/i);
});


test("React Web issue report summary JSON is compact first-minute data without detailed issue cards", () => {
  const fullCli = runIssues(fixtures.formControls, "--json");
  const summaryCli = runIssues(fixtures.formControls, "--summary-json");
  assert.equal(fullCli.status, 0, fullCli.stderr);
  assert.equal(summaryCli.status, 0, summaryCli.stderr);
  assert.ok(summaryCli.stdout.length < fullCli.stdout.length, `summary ${summaryCli.stdout.length} should be smaller than full ${fullCli.stdout.length}`);

  const fullReport = JSON.parse(fullCli.stdout);
  const summary = JSON.parse(summaryCli.stdout);
  const projected = buildReactWebIssueReportSummaryJson(fullReport);

  assert.equal(fullReport.schemaVersion, "react-web-issue-report.v1");
  assert.ok(Array.isArray(fullReport.issues));
  assert.ok(fullReport.issues.length > 0);
  assert.equal(summary.schemaVersion, "react-web-issue-report-summary.v1");
  assert.equal(summary.sourceReportSchemaVersion, fullReport.schemaVersion);
  assert.equal(summary.command, "inspect react-web-issues");
  assert.equal(summary.projection, "summary-json");
  assert.equal(summary.profile, "react-web");
  assert.equal(summary.filePath, fullReport.filePath);
  assert.equal(summary.readOnly, true);
  assert.equal(summary.autoApply, false);
  assert.equal(summary.claimBoundary, REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY);
  assert.match(summary.claimBoundary, /Read-only React Web issue report/);
  assert.match(summary.claimBoundary, /does not auto-apply patches/);
  assert.match(summary.claimBoundary, /does not infer custom-component semantics/);
  assert.deepEqual(summary.summary, fullReport.summary);
  assert.deepEqual(summary.triageTopIds, {
    rankedIssueIds: fullReport.triageRollup.rankedIssueIds,
    topIssueIds: fullReport.triageRollup.topIssueIds,
    topManualReviewIssueIds: fullReport.triageRollup.topManualReviewIssueIds,
    safePreviewIssueIds: fullReport.triageRollup.safePreviewIssueIds,
    manualReviewIssueIds: fullReport.triageRollup.manualReviewIssueIds,
  });
  assert.deepEqual(summary.firstMinuteSummary, fullReport.firstMinuteSummary);
  assert.deepEqual(summary, projected);

  assert.deepEqual(summary.triageTopIds.topIssueIds, [
    "react-web-label-1",
    "react-web-label-4",
    "react-web-label-5",
  ]);
  assert.deepEqual(summary.firstMinuteSummary.sourceTopIssueIds, summary.triageTopIds.topIssueIds);
  assert.deepEqual(Object.hasOwn(summary, "issues"), false);

  const compactText = JSON.stringify(summary);
  for (const detailedCardKey of ["issues", "relatedContext", "preview", "evidence", "sourceSignals", "suggestedAction", "whereToLook", "whyItMatters", "problem"]) {
    assert.equal(hasNestedKey(summary, detailedCardKey), false, `summary-json should not include detailed key ${detailedCardKey}`);
  }
  assert.doesNotMatch(compactText, /must-edit|Auto-apply: yes|Controller/i);
});

test("React Web issue report summary JSON preserves skip boundaries without detailed cards", () => {
  const rnCli = runIssues(fixtures.rn, "--summary-json");
  assert.equal(rnCli.status, 0, rnCli.stderr);
  const summary = JSON.parse(rnCli.stdout);

  assert.equal(summary.inScope, false);
  assert.match(summary.skippedReason, /^domain-classification:react-native/);
  assert.equal(summary.readOnly, true);
  assert.equal(summary.autoApply, false);
  assert.deepEqual(summary.summary, {
    issueCount: 0,
    safePreviewCount: 0,
    manualReviewCount: 0,
    unsafeToAutoApplyCount: 0,
  });
  assert.deepEqual(summary.triageTopIds, {
    rankedIssueIds: [],
    topIssueIds: [],
    topManualReviewIssueIds: [],
    safePreviewIssueIds: [],
    manualReviewIssueIds: [],
  });
  assert.deepEqual(summary.firstMinuteSummary, { sourceTopIssueIds: [], items: [] });
  assert.deepEqual(Object.hasOwn(summary, "issues"), false);
});

test("React Web issue report rejects conflicting JSON output flags", () => {
  const cli = runIssues(fixtures.formControls, "--json", "--summary-json");
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /either --json or --summary-json, not both/);
});
