import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  assertReactWebIssueFixtureUsefulness,
  assertReactWebWorkOrderQuality,
  evaluateReactWebIssueFixtureUsefulness,
  parseReactWebWorkOrderQuality,
  reactWebIssueFixtureRegressionClasses,
  reactWebWorkOrderQualityRegressionClasses,
} from "./helpers/react-web-issue-fixture-gate.mjs";
import {
  consumeReactWebDryRunForAgentTasks,
  consumeReactWebSummaryForAgentTask,
} from "./helpers/react-web-agent-handoff-dogfood.mjs";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);
const { buildReactWebLabelPatchPreview } = require(path.join(repoRoot, "dist", "core", "react-web-label-preview.js"));
const {
  REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY,
  buildReactWebIssueReport,
  buildReactWebIssueReportMigrationDryRunJson,
  buildReactWebIssueReportSummaryJson,
  renderReactWebIssueReportText,
} = require(path.join(repoRoot, "dist", "core", "react-web-issue-report.js"));

const fixtures = {
  missing: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "missing-labels.tsx"),
  labelled: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "labelled-controls.tsx"),
  association: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "label-association-candidates.tsx"),
  unsafeAssociation: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "label-association-unsafe.tsx"),
  relatedContext: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "related-context-form.tsx"),
  expandedNativeControls: path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "expanded-native-controls.tsx"),
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


function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertOnlyWorkOrderRegressionClass(report, regressionClass) {
  const result = parseReactWebWorkOrderQuality({ fixture: regressionClass, report });
  assert.equal(result.verdict, "fail");
  assert.deepEqual(result.regressionClasses, [regressionClass]);
}

function assertCompactFirstMinuteItem(item) {
  assert.equal(typeof item.whyThisFirst, "string");
  assert.ok(item.whyThisFirst.length > 0);
  assert.ok(item.whyThisFirst.length <= 180, item.whyThisFirst);
  assert.equal(typeof item.nextAction, "string");
  assert.ok(item.nextAction.length > 0);
  assert.ok(item.nextAction.length <= 180, item.nextAction);

  assert.ok(Array.isArray(item.humanDecisionNeeded));
  assert.ok(item.humanDecisionNeeded.length >= 1);
  assert.ok(item.humanDecisionNeeded.length <= 2);
  assert.ok(Array.isArray(item.doNotDo));
  assert.ok(item.doNotDo.length >= 2);
  assert.ok(item.doNotDo.length <= 3);
  assert.ok(Array.isArray(item.contextHints));
  assert.ok(item.contextHints.length >= 1);
  assert.ok(item.contextHints.length <= 4);

  for (const entry of [...item.humanDecisionNeeded, ...item.doNotDo]) {
    assert.equal(typeof entry, "string");
    assert.ok(entry.length > 0);
    assert.ok(entry.length <= 120, entry);
  }
  for (const entry of item.contextHints) {
    assert.equal(typeof entry, "string");
    assert.ok(entry.length > 0);
    assert.ok(entry.length <= 100, entry);
  }

  assert.ok(item.humanDecisionNeeded.some((entry) => /label\/name|copy|shape/i.test(entry)));
  assert.ok(item.doNotDo.some((entry) => /apply|patch/i.test(entry)));
  assert.ok(item.doNotDo.some((entry) => /custom-component semantics/i.test(entry)));
  assert.ok(item.contextHints.some((entry) => /native|context|source|convention|preview/i.test(entry)));

  const compactText = JSON.stringify({
    whyThisFirst: item.whyThisFirst,
    nextAction: item.nextAction,
    humanDecisionNeeded: item.humanDecisionNeeded,
    doNotDo: item.doNotDo,
    contextHints: item.contextHints,
  });
  assert.doesNotMatch(compactText, /contextPacket|conventionHints|relatedContext|sourceSignals|suggestedAction|whereToLook|whyItMatters|problem/i);
  assert.doesNotMatch(compactText, /must-edit|Auto-apply: yes|CI gate|merge gate|generated accessible-name copy/i);
}

function assertCompactConventionContextHint(item) {
  const conventionHints = item.contextHints.filter((entry) => /advisory convention react-web\.native-label-context/.test(entry));
  assert.equal(conventionHints.length, 1);
  assert.ok(conventionHints[0].length <= 100, conventionHints[0]);
  assert.match(conventionHints[0], /inspect same-file JSX/);
  assert.doesNotMatch(conventionHints[0], /policyBoundary|excludedInference|public config|CI gate|merge gate|auto-apply|must-edit/i);
}

function assertConventionDoesNotPolluteActionFields(item) {
  const actionText = JSON.stringify({
    firstInspectStep: item.firstInspectStep,
    inspectFirst: item.inspectFirst,
    whyThisFirst: item.whyThisFirst,
    nextAction: item.nextAction,
    humanDecisionNeeded: item.humanDecisionNeeded,
    doNotDo: item.doNotDo,
  });
  assert.doesNotMatch(actionText, /advisory convention|react-web\.native-label-context|repo-owned convention/i);
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
    assert.equal(typeof issue.contextPacket.whyThisFile, "string");
    assert.equal(typeof issue.contextPacket.relatedPattern, "string");
    assert.equal(typeof issue.contextPacket.nearbyPrecedent, "string");
    assert.equal(issue.contextPacket.confidence, issue.confidence);
    assert.ok(Array.isArray(issue.contextPacket.excludedInference));
    assert.ok(issue.contextPacket.excludedInference.length >= 3);
    assert.match(issue.contextPacket.whyThisFile, /missing-labels\.tsx:\d+-\d+/);
    assert.match(issue.contextPacket.relatedPattern, /native (button|input|select|textarea)/);
    assert.match(issue.contextPacket.nearbyPrecedent, /same-file-pattern|nearby-test|same-directory-source|No nearby precedent/);
    assert.ok(issue.contextPacket.excludedInference.some((entry) => /custom-component semantics/.test(entry)));
    assert.ok(issue.contextPacket.excludedInference.some((entry) => /broad accessibility coverage/.test(entry)));
    assert.ok(issue.contextPacket.excludedInference.some((entry) => /auto-apply patches/.test(entry)));
    assert.doesNotMatch(JSON.stringify(issue.contextPacket), /must-edit/i);
    assert.ok(Array.isArray(issue.contextPacket.conventionHints));
    assert.ok(issue.contextPacket.conventionHints.some((entry) => /react-web\.native-label-context/.test(entry)));
    assert.ok(Array.isArray(issue.conventionHints));
    assert.equal(issue.conventionHints.length, 1);
    assert.equal(issue.conventionHints[0].id, "react-web.native-label-context");
    assert.equal(issue.conventionHints[0].advisoryOnly, true);
    assert.equal(issue.conventionHints[0].enforcement, "none");
    assert.equal(issue.conventionHints[0].source, "internal-prototype-fixture");
    assert.match(issue.conventionHints[0].policyBoundary, /Advisory convention hint only/);
    assert.doesNotMatch(JSON.stringify(issue.conventionHints), /must-edit|auto-apply|CI gate|merge gate/i);
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
  assert.match(report.issues[0].contextPacket.relatedPattern, /safe-preview pattern/);
  assert.ok(report.issues[0].contextPacket.excludedInference.some((entry) => /candidate diff only/.test(entry)));
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
  assert.match(
    report.issues[0].contextPacket.nearbyPrecedent,
    /(FormField\.tsx|Input\.tsx|related-context-form\.test\.tsx)/,
  );
  assert.match(report.issues[0].contextPacket.nearbyPrecedent, /(imported-local-component|nearby-test)/);

  const buttonEntries = report.issues[1].relatedContext;
  assert.ok(buttonEntries.some((entry) => entry.kind === "same-file-pattern" && entry.file.endsWith("/related-context-form.tsx")));
  assert.doesNotMatch(JSON.stringify(report.issues.flatMap((issue) => issue.relatedContext)), /must-edit|auto-apply/i);
});

test("React Web issue report includes nearby same-basename tests when not displaced by stronger local source evidence", () => {
  const report = parseIssues(fixtures.relatedContext);
  const allEntries = report.issues.flatMap((issue) => issue.relatedContext);
  assert.ok(allEntries.some((entry) => entry.kind === "nearby-test" && entry.file.endsWith("/related-context-form.test.tsx")));
});

test("React Web issue report covers expanded native control fixture boundaries", () => {
  const report = parseIssues(fixtures.expandedNativeControls);
  const preview = buildReactWebLabelPatchPreview(fixtures.expandedNativeControls, repoRoot);

  assert.equal(report.inScope, true);
  assert.equal(report.summary.issueCount, 4);
  assert.equal(report.summary.safePreviewCount, 0);
  assert.equal(report.summary.manualReviewCount, 4);
  assert.equal(report.summary.unsafeToAutoApplyCount, 4);
  assert.equal(report.summary.issueCount, preview.summary.findingCount);
  assert.ok(report.issues.every((issue) => issue.kind === "react-web.missing-accessible-label"));
  assert.ok(report.issues.every((issue) => issue.fixability === "manual-review"));
  assert.ok(report.issues.every((issue) => issue.autoFixSafety === "unsafe-to-auto-apply"));
  assert.deepEqual(report.issues.map((issue) => issue.fixShapeGuidance.localEvidence.attributes), [
    ["name=email", "onChange", "required", "type=email", "value"],
    ["className", 'spread:register("username")'],
    ["disabled", "name=disabledEmail"],
    ["name=readonlyNotes", "readOnly"],
  ]);
  assert.deepEqual(report.triageRollup.topIssueIds, [
    "react-web-label-1",
    "react-web-label-2",
    "react-web-label-3",
  ]);
  assert.deepEqual(report.firstMinuteSummary.sourceTopIssueIds, report.triageRollup.topIssueIds);
  assertReactWebWorkOrderQuality(parseReactWebWorkOrderQuality({ fixture: "expanded-native-controls.tsx", report }));

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /DesignSystemField|Billing account|billingAccount/);
  assert.doesNotMatch(serialized, /must-edit|Auto-apply: yes/i);
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
      name: "expanded-native-controls.tsx",
      file: fixtures.expandedNativeControls,
      expectedCards: 4,
      acceptedCards: 4,
      expectedSafePreviewCount: 0,
      expectedManualReviewCount: 4,
      suggestionPlausibility: "Controlled, react-hook-form/register, disabled, and readOnly native controls stay manual-review; custom wrapper props are not inferred as native issue cards.",
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
  assert.deepEqual(matrix.map((entry) => entry.verdict), ["pass", "pass", "pass", "pass", "pass"]);
  assert.ok(matrix.every((entry) => entry.parityWithPreviewFindings));
  assert.ok(matrix.every((entry) => entry.noiseNotes.length === 0));
  assert.ok(matrix.some((entry) => entry.expectedUnsupported === true && entry.unsupported === true));
  assert.ok(matrix.some((entry) => entry.expectedUnsupported === true && entry.unsupportedSkipBoundary === true));
});

test("React Web first-minute work-order quality gate accepts current output", () => {
  assert.deepEqual(reactWebWorkOrderQualityRegressionClasses, [
    "missing-location",
    "weak-why",
    "non-action-next-step",
    "missing-human-decision",
    "unsafe-do-not-do",
    "context-hints-bad-size",
  ]);

  const report = buildReactWebIssueReport(fixtures.formControls, repoRoot);
  const result = parseReactWebWorkOrderQuality({ fixture: "FormControls.tsx", report });

  assertReactWebWorkOrderQuality(result);
  assert.deepEqual(result.regressionClasses, []);
  assert.deepEqual(result.sourceTopIssueIds, report.triageRollup.topIssueIds);
  assert.equal(result.observedItemCount, 3);
});

test("React Web first-minute work-order quality gate maps fixture regressions to the six classes", () => {
  const baseReport = buildReactWebIssueReport(fixtures.formControls, repoRoot);
  const cases = [
    {
      regressionClass: "missing-location",
      mutate(report) {
        report.firstMinuteSummary.sourceTopIssueIds = report.firstMinuteSummary.sourceTopIssueIds.slice(1);
      },
    },
    {
      regressionClass: "weak-why",
      mutate(report) {
        report.firstMinuteSummary.items[0].whyThisFirst = "Important.";
      },
    },
    {
      regressionClass: "non-action-next-step",
      mutate(report) {
        report.firstMinuteSummary.items[0].nextAction = "Maybe fix this eventually.";
      },
    },
    {
      regressionClass: "missing-human-decision",
      mutate(report) {
        report.firstMinuteSummary.items[0].humanDecisionNeeded = [];
      },
    },
    {
      regressionClass: "unsafe-do-not-do",
      mutate(report) {
        report.firstMinuteSummary.items[0].doNotDo = ["Stay careful.", "Avoid surprises."];
      },
    },
    {
      regressionClass: "context-hints-bad-size",
      mutate(report) {
        report.firstMinuteSummary.items[0].contextHints = [];
      },
    },
  ];

  for (const fixtureCase of cases) {
    const report = cloneJson(baseReport);
    fixtureCase.mutate(report);
    assertOnlyWorkOrderRegressionClass(report, fixtureCase.regressionClass);
  }
});

test("React Web first-minute work-order quality gate keeps safety invariants structural", () => {
  const baseReport = buildReactWebIssueReport(fixtures.formControls, repoRoot);

  const autoApplyReport = cloneJson(baseReport);
  autoApplyReport.firstMinuteSummary.items[0].fixShapeGuidance.autoApply = true;
  assertOnlyWorkOrderRegressionClass(autoApplyReport, "unsafe-do-not-do");

  const humanReviewReport = cloneJson(baseReport);
  humanReviewReport.firstMinuteSummary.items[0].fixShapeGuidance.humanReviewRequired = false;
  assertOnlyWorkOrderRegressionClass(humanReviewReport, "missing-human-decision");
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
  assert.match(cli.stdout, /- context packet:/);
  assert.match(cli.stdout, /  - why this file:/);
  assert.match(cli.stdout, /  - related pattern:/);
  assert.match(cli.stdout, /  - nearby precedent:/);
  assert.match(cli.stdout, /  - excluded inference:/);
  assert.match(cli.stdout, /- convention hints:/);
  assert.match(cli.stdout, /react-web\.native-label-context/);
  assert.match(cli.stdout, /Advisory convention hint only/);
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
  assert.deepEqual(
    report.issues.map((issue) => [
      issue.id,
      issue.triage.rank,
      issue.triage.priority,
      issue.triage.bucket,
      issue.triage.evidence.score,
    ]),
    [
      ["react-web-label-1", 1, "high", "high-confidence-manual-review", 8],
      ["react-web-label-2", 4, "high", "high-confidence-manual-review", 8],
      ["react-web-label-3", 5, "high", "high-confidence-manual-review", 8],
      ["react-web-label-4", 2, "high", "high-confidence-manual-review", 8],
      ["react-web-label-5", 3, "high", "high-confidence-manual-review", 8],
    ],
  );
  assert.doesNotMatch(JSON.stringify(report.issues.map((issue) => issue.triage)), /convention|react-web\.native-label-context/i);
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
    assertCompactFirstMinuteItem(item);
    assertCompactConventionContextHint(item);
    assertConventionDoesNotPolluteActionFields(item);
    assert.match(item.whyThisFirst, new RegExp(`Rank ${issue.triage.rank} ${issue.triage.priority} issue`));
    assert.match(item.nextAction, /Start by inspecting/);
    assert.ok(item.contextHints.some((entry) => entry.includes(issue.evidence.element)));
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

test("React Web issue report text renders first-minute summary from canonical projection", () => {
  const report = buildReactWebIssueReport(fixtures.formControls, repoRoot);
  report.firstMinuteSummary.items[0] = {
    ...report.firstMinuteSummary.items[0],
    whyThisFirst: "SENTINEL why from canonical summary.",
    nextAction: "SENTINEL next action from canonical summary.",
    humanDecisionNeeded: ["SENTINEL human decision."],
    doNotDo: ["SENTINEL do not do one.", "SENTINEL do not do two."],
    contextHints: ["SENTINEL context hint."],
  };

  const text = renderReactWebIssueReportText(report);
  const summaryIndex = text.indexOf("## First-minute summary");
  const issueIndex = text.indexOf("## Issue 1:");
  assert.ok(summaryIndex > 0);
  assert.ok(issueIndex > summaryIndex);
  const compactBlock = text.slice(summaryIndex, issueIndex);

  assert.match(compactBlock, /SENTINEL why from canonical summary/);
  assert.match(compactBlock, /SENTINEL next action from canonical summary/);
  assert.match(compactBlock, /SENTINEL human decision/);
  assert.match(compactBlock, /SENTINEL do not do one/);
  assert.match(compactBlock, /SENTINEL context hint/);
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
  for (const item of summary.firstMinuteSummary.items) {
    assertCompactFirstMinuteItem(item);
    assertCompactConventionContextHint(item);
    assertConventionDoesNotPolluteActionFields(item);
  }
  assert.deepEqual(Object.hasOwn(summary, "issues"), false);

  const compactText = JSON.stringify(summary);
  for (const detailedCardKey of ["issues", "contextPacket", "conventionHints", "relatedContext", "preview", "evidence", "sourceSignals", "suggestedAction", "whereToLook", "whyItMatters", "problem"]) {
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

test("React Web issue report migration dry-run JSON projects read-only candidates", () => {
  const fullCli = runIssues(fixtures.formControls, "--json");
  const dryRunCli = runIssues(fixtures.formControls, "--dry-run-json");
  assert.equal(fullCli.status, 0, fullCli.stderr);
  assert.equal(dryRunCli.status, 0, dryRunCli.stderr);

  const fullReport = JSON.parse(fullCli.stdout);
  const dryRun = JSON.parse(dryRunCli.stdout);
  const projected = buildReactWebIssueReportMigrationDryRunJson(fullReport);

  assert.equal(dryRun.schemaVersion, "react-web-issue-report-migration-dry-run.v1");
  assert.equal(dryRun.sourceReportSchemaVersion, fullReport.schemaVersion);
  assert.equal(dryRun.command, "inspect react-web-issues");
  assert.equal(dryRun.projection, "migration-dry-run-json");
  assert.equal(dryRun.profile, "react-web");
  assert.equal(dryRun.filePath, fullReport.filePath);
  assert.equal(dryRun.readOnly, true);
  assert.equal(dryRun.dryRunOnly, true);
  assert.equal(dryRun.autoApply, false);
  assert.equal(dryRun.claimBoundary, REACT_WEB_ISSUE_REPORT_CLAIM_BOUNDARY);
  assert.deepEqual(dryRun, projected);
  assert.deepEqual(
    dryRun.candidates.map((candidate) => candidate.issueId),
    fullReport.triageRollup.rankedIssueIds,
  );
  assert.deepEqual(dryRun.summary, {
    candidateCount: 5,
    affectedFiles: ["fixtures/compressed/FormControls.tsx"],
    safePreviewCandidateCount: 0,
    manualReviewCandidateCount: 5,
  });

  for (const candidate of dryRun.candidates) {
    assert.match(candidate.issueId, /^react-web-label-/);
    assert.match(candidate.migrationCandidate, /^human-reviewed-|^safe-preview-/);
    assert.equal(candidate.affectedFile, "fixtures/compressed/FormControls.tsx");
    assert.match(candidate.firstInspectStep, /^Inspect fixtures\/compressed\/FormControls\.tsx:\d+-\d+ \((input|select|textarea)\) before editing\.$/);
    assert.equal(candidate.previewAvailable, false);
    assert.equal(candidate.humanReviewRequired, true);
    assert.equal(candidate.autoApply, false);
    assert.equal(candidate.dryRunOnly, true);
    assert.ok(candidate.riskNotes.length >= 3);
    assert.ok(candidate.riskNotes.some((note) => /human review|human-reviewed/i.test(note)));
    assert.ok(candidate.riskNotes.some((note) => /Do not apply patches automatically/i.test(note)));
    assert.ok(candidate.riskNotes.every((note) => note.length <= 160));
  }

  const compactText = JSON.stringify(dryRun);
  for (const detailedCardKey of ["issues", "contextPacket", "conventionHints", "relatedContext", "preview", "evidence", "sourceSignals", "suggestedAction", "whereToLook", "whyItMatters", "problem"]) {
    assert.equal(hasNestedKey(dryRun, detailedCardKey), false, `dry-run-json should not include detailed key ${detailedCardKey}`);
  }
  assert.doesNotMatch(compactText, /must-edit|Auto-apply: yes|Controller|policyBoundary|excludedInference/i);
});

test("React Web issue report migration dry-run JSON preserves empty and unsupported boundaries", () => {
  const labelledCli = runIssues(fixtures.labelled, "--dry-run-json");
  assert.equal(labelledCli.status, 0, labelledCli.stderr);
  const labelled = JSON.parse(labelledCli.stdout);
  assert.equal(labelled.inScope, true);
  assert.equal(labelled.readOnly, true);
  assert.equal(labelled.dryRunOnly, true);
  assert.equal(labelled.autoApply, false);
  assert.deepEqual(labelled.summary, {
    candidateCount: 0,
    affectedFiles: [],
    safePreviewCandidateCount: 0,
    manualReviewCandidateCount: 0,
  });
  assert.deepEqual(labelled.candidates, []);

  const rnCli = runIssues(fixtures.rn, "--dry-run-json");
  assert.equal(rnCli.status, 0, rnCli.stderr);
  const rn = JSON.parse(rnCli.stdout);
  assert.equal(rn.inScope, false);
  assert.match(rn.skippedReason, /^domain-classification:react-native/);
  assert.equal(rn.readOnly, true);
  assert.equal(rn.dryRunOnly, true);
  assert.equal(rn.autoApply, false);
  assert.deepEqual(rn.summary, {
    candidateCount: 0,
    affectedFiles: [],
    safePreviewCandidateCount: 0,
    manualReviewCandidateCount: 0,
  });
  assert.deepEqual(rn.candidates, []);
});

test("React Web agent handoff dogfood consumes summary JSON as an inspect-first task", () => {
  const report = buildReactWebIssueReport(fixtures.formControls, repoRoot);
  const summary = buildReactWebIssueReportSummaryJson(report);
  const task = consumeReactWebSummaryForAgentTask(summary);
  const firstItem = summary.firstMinuteSummary.items[0];

  assert.equal(task.kind, "inspect-first-task");
  assert.equal(task.source, "summary-json");
  assert.equal(task.issueId, firstItem.issueId);
  assert.equal(task.filePath, summary.filePath);
  assert.equal(task.claimBoundary, summary.claimBoundary);
  assert.equal(task.firstInspectStep, firstItem.firstInspectStep);
  assert.equal(task.nextAction, firstItem.nextAction);
  assert.equal(task.whyThisFirst, firstItem.whyThisFirst);
  assert.deepEqual(task.humanDecisionNeeded, firstItem.humanDecisionNeeded);
  assert.deepEqual(task.doNotDo, firstItem.doNotDo);
  assert.deepEqual(task.contextHints, firstItem.contextHints);
  assert.equal(task.fixShape, firstItem.fixShape);
  assert.deepEqual(task.fixShapeGuidance, firstItem.fixShapeGuidance);
  assert.equal(task.autoApply, false);
  assert.equal(task.humanReviewRequired, true);

  const handoffText = JSON.stringify(task);
  assert.match(handoffText, /Read-only React Web issue report/);
  assert.match(handoffText, /does not auto-apply patches/);
  assert.match(task.nextAction, /Start by inspecting/);
  assert.ok(task.contextHints.some((hint) => /native|context|source|convention|preview/i.test(hint)));
  assert.doesNotMatch(handoffText, /must-edit|Auto-apply: yes|codemod|CI enforcement|merge gate/i);
});

test("React Web agent handoff dogfood consumes dry-run JSON as read-only candidate tasks", () => {
  const report = buildReactWebIssueReport(fixtures.formControls, repoRoot);
  const dryRun = buildReactWebIssueReportMigrationDryRunJson(report);
  const handoff = consumeReactWebDryRunForAgentTasks(dryRun);

  assert.equal(handoff.kind, "dry-run-candidate-tasks");
  assert.equal(handoff.source, "dry-run-json");
  assert.equal(handoff.filePath, dryRun.filePath);
  assert.equal(handoff.claimBoundary, dryRun.claimBoundary);
  assert.equal(handoff.dryRunOnly, true);
  assert.equal(handoff.autoApply, false);
  assert.equal(handoff.candidates.length, dryRun.candidates.length);

  const firstCandidate = handoff.candidates[0];
  const sourceCandidate = dryRun.candidates[0];
  assert.deepEqual(firstCandidate, {
    issueId: sourceCandidate.issueId,
    affectedFile: sourceCandidate.affectedFile,
    migrationCandidate: sourceCandidate.migrationCandidate,
    firstInspectStep: sourceCandidate.firstInspectStep,
    previewAvailable: sourceCandidate.previewAvailable,
    humanReviewRequired: sourceCandidate.humanReviewRequired,
    autoApply: sourceCandidate.autoApply,
    dryRunOnly: sourceCandidate.dryRunOnly,
    riskNotes: sourceCandidate.riskNotes,
  });
  assert.equal(firstCandidate.dryRunOnly, true);
  assert.equal(firstCandidate.autoApply, false);
  assert.equal(firstCandidate.humanReviewRequired, true);
  assert.ok(firstCandidate.riskNotes.some((note) => /Do not apply patches automatically/i.test(note)));
  assert.doesNotMatch(JSON.stringify(handoff), /must-edit|Auto-apply: yes|codemod|CI enforcement|merge gate/i);
});

test("React Web agent handoff dogfood stops on empty and unsupported projections", () => {
  const labelledReport = buildReactWebIssueReport(fixtures.labelled, repoRoot);
  const labelledSummary = buildReactWebIssueReportSummaryJson(labelledReport);
  const labelledDryRun = buildReactWebIssueReportMigrationDryRunJson(labelledReport);

  const summaryStop = consumeReactWebSummaryForAgentTask(labelledSummary);
  assert.deepEqual(summaryStop, {
    kind: "stop",
    source: "summary-json",
    reason: "no-first-minute-items",
    inScope: true,
    autoApply: false,
  });
  assert.equal(Object.hasOwn(summaryStop, "issueId"), false);
  assert.equal(Object.hasOwn(summaryStop, "firstInspectStep"), false);

  const dryRunStop = consumeReactWebDryRunForAgentTasks(labelledDryRun);
  assert.deepEqual(dryRunStop, {
    kind: "stop",
    source: "dry-run-json",
    reason: "no-dry-run-candidates",
    inScope: true,
    autoApply: false,
    dryRunOnly: true,
    candidates: [],
  });

  const rnReport = buildReactWebIssueReport(fixtures.rn, repoRoot);
  const rnSummaryStop = consumeReactWebSummaryForAgentTask(buildReactWebIssueReportSummaryJson(rnReport));
  assert.equal(rnSummaryStop.kind, "stop");
  assert.equal(rnSummaryStop.reason, "unsupported-boundary");
  assert.equal(rnSummaryStop.inScope, false);
  assert.match(rnSummaryStop.skippedReason, /^domain-classification:react-native/);

  const rnDryRunStop = consumeReactWebDryRunForAgentTasks(buildReactWebIssueReportMigrationDryRunJson(rnReport));
  assert.equal(rnDryRunStop.kind, "stop");
  assert.equal(rnDryRunStop.reason, "unsupported-boundary");
  assert.equal(rnDryRunStop.inScope, false);
  assert.match(rnDryRunStop.skippedReason, /^domain-classification:react-native/);
});

test("React Web issue report rejects conflicting JSON output flags", () => {
  const cli = runIssues(fixtures.formControls, "--json", "--summary-json");
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /only one of --json, --summary-json, or --dry-run-json/);

  const dryRunCli = runIssues(fixtures.formControls, "--summary-json", "--dry-run-json");
  assert.notEqual(dryRunCli.status, 0);
  assert.match(dryRunCli.stderr, /only one of --json, --summary-json, or --dry-run-json/);
});
