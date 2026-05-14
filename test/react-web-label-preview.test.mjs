import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const positiveFixture = path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "missing-labels.tsx");
const negativeFixture = path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "labelled-controls.tsx");
const rnFixture = path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", "rn-accessibility-test-anchor.tsx");
const associationFixture = path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "label-association-candidates.tsx");
const unsafeAssociationFixture = path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "label-association-unsafe.tsx");
const expandedNativeControlsFixture = path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "expanded-native-controls.tsx");
const emptyAriaLabelFixture = path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "empty-aria-labels.tsx");
const quietNativeEvidenceFixture = path.join(repoRoot, "test", "fixtures", "react-web-label-preview", "quiet-native-evidence.tsx");

function runPreview(file, ...args) {
  return spawnSync(process.execPath, [cliPath, "inspect", "react-web-label-preview", file, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

test("React Web label preview reports deterministic read-only patches for missing and ambiguous labels", () => {
  const cli = runPreview(positiveFixture, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  const preview = JSON.parse(cli.stdout);

  assert.equal(preview.schemaVersion, "react-web-label-patch-preview.v1");
  assert.equal(preview.command, "inspect react-web-label-preview");
  assert.equal(preview.profile, "react-web");
  assert.equal(preview.readOnly, true);
  assert.equal(preview.autoApply, false);
  assert.equal(preview.inScope, true);
  assert.match(preview.claimBoundary, /Read-only React Web JSX label preview only/);
  assert.equal(preview.summary.findingCount, 5);
  assert.equal(preview.summary.missingCount, 3);
  assert.equal(preview.summary.ambiguousCount, 2);
  assert.equal(preview.summary.emptyAccessibleNameCount, 0);
  assert.equal(preview.summary.associationCount, 0);

  assert.deepEqual(preview.findings.map((finding) => [finding.kind, finding.element, finding.confidence]), [
    ["missing-accessible-label", "button", "high"],
    ["missing-accessible-label", "input", "high"],
    ["ambiguous-accessible-label", "input", "medium"],
    ["missing-accessible-label", "select", "high"],
    ["ambiguous-accessible-label", "textarea", "medium"],
  ]);

  for (const finding of preview.findings) {
    assert.equal(finding.suggestedPatch.readOnly, true);
    assert.equal(finding.suggestedPatch.attribute, "aria-label");
    assert.match(finding.suggestedPatch.preview, /^--- a\/test\/fixtures\/react-web-label-preview\/missing-labels\.tsx/m);
    assert.match(finding.suggestedPatch.preview, /\+.*aria-label="TODO:/);
    assert.equal(typeof finding.context, "string");
    assert.ok(finding.loc.startLine > 0);
    assert.ok(finding.reason.length > 0);
  }
});

test("React Web label preview stays quiet when native controls have narrow label evidence", () => {
  const cli = runPreview(negativeFixture, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  const preview = JSON.parse(cli.stdout);

  assert.equal(preview.inScope, true);
  assert.deepEqual(preview.summary, { findingCount: 0, missingCount: 0, ambiguousCount: 0, emptyAccessibleNameCount: 0, associationCount: 0 });
  assert.deepEqual(preview.findings, []);
});

test("React Web label preview stays quiet for native controls with sufficient name evidence and custom decoys", () => {
  const cli = runPreview(quietNativeEvidenceFixture, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  const preview = JSON.parse(cli.stdout);

  assert.equal(preview.inScope, true);
  assert.deepEqual(preview.summary, { findingCount: 0, missingCount: 0, ambiguousCount: 0, emptyAccessibleNameCount: 0, associationCount: 0 });
  assert.deepEqual(preview.findings, []);
  assert.doesNotMatch(JSON.stringify(preview), /DesignSystemTextInput|displayName|TODO:/);
});

test("React Web label preview suggests conservative nearby label associations", () => {
  const cli = runPreview(associationFixture, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  const preview = JSON.parse(cli.stdout);

  assert.equal(preview.inScope, true);
  assert.equal(preview.summary.findingCount, 3);
  assert.equal(preview.summary.associationCount, 3);
  assert.equal(preview.summary.missingCount, 0);
  assert.equal(preview.summary.ambiguousCount, 0);
  assert.equal(preview.summary.emptyAccessibleNameCount, 0);
  assert.deepEqual(preview.findings.map((finding) => [finding.kind, finding.element, finding.confidence, finding.suggestedPatch.attribute]), [
    ["unassociated-nearby-label", "input", "high", "htmlFor"],
    ["unassociated-nearby-label", "select", "medium", "id/htmlFor"],
    ["unassociated-nearby-label", "textarea", "medium", "id/htmlFor"],
  ]);
  assert.match(preview.findings[0].suggestedPatch.preview, /<label htmlFor="email">/);
  assert.match(preview.findings[1].suggestedPatch.preview, /<label htmlFor="department">/);
  assert.match(preview.findings[1].suggestedPatch.preview, /<select name="department" id="department">/);
  assert.match(preview.findings[2].suggestedPatch.preview, /<textarea name="notes" id="notes" \/>/);
  assert.ok(preview.findings.every((finding) => finding.suggestedPatch.readOnly === true));
});

test("React Web label preview covers expanded native control fixture boundaries", () => {
  const cli = runPreview(expandedNativeControlsFixture, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  const preview = JSON.parse(cli.stdout);

  assert.equal(preview.inScope, true);
  assert.deepEqual(preview.summary, { findingCount: 4, missingCount: 4, ambiguousCount: 0, emptyAccessibleNameCount: 0, associationCount: 0 });
  assert.deepEqual(preview.findings.map((finding) => [finding.kind, finding.element, finding.confidence, finding.suggestedPatch.attribute]), [
    ["missing-accessible-label", "input", "high", "aria-label"],
    ["missing-accessible-label", "input", "high", "aria-label"],
    ["missing-accessible-label", "input", "high", "aria-label"],
    ["missing-accessible-label", "textarea", "high", "aria-label"],
  ]);
  assert.ok(preview.findings.some((finding) => /value=\{email\}|onChange/.test(finding.context)));
  assert.ok(preview.findings.some((finding) => /register\("username"\)/.test(finding.context)));
  assert.ok(preview.findings.some((finding) => /disabled/.test(finding.context)));
  assert.ok(preview.findings.some((finding) => /readOnly/.test(finding.context)));
  assert.doesNotMatch(JSON.stringify(preview), /DesignSystemField|Billing account|billingAccount/);
  assert.ok(preview.findings.every((finding) => finding.suggestedPatch.readOnly === true));
});

test("React Web label preview avoids unsafe nearby label associations", () => {
  const cli = runPreview(unsafeAssociationFixture, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  const preview = JSON.parse(cli.stdout);

  assert.equal(preview.inScope, true);
  assert.equal(preview.summary.associationCount, 0);
  assert.equal(preview.summary.emptyAccessibleNameCount, 0);
  assert.ok(preview.summary.missingCount > 0);
  assert.ok(preview.findings.every((finding) => finding.suggestedPatch.attribute === "aria-label"));
  assert.doesNotMatch(cli.stdout, /htmlFor=/);
});

test("React Web label preview reports empty aria-label native controls as manual-review findings", () => {
  const cli = runPreview(emptyAriaLabelFixture, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  const preview = JSON.parse(cli.stdout);

  assert.equal(preview.inScope, true);
  assert.deepEqual(preview.summary, {
    findingCount: 3,
    missingCount: 0,
    ambiguousCount: 0,
    emptyAccessibleNameCount: 3,
    associationCount: 0,
  });
  assert.deepEqual(preview.findings.map((finding) => [finding.kind, finding.element, finding.confidence, finding.suggestedPatch.attribute]), [
    ["empty-accessible-name", "input", "high", "aria-label"],
    ["empty-accessible-name", "button", "high", "aria-label"],
    ["empty-accessible-name", "textarea", "high", "aria-label"],
  ]);
  assert.ok(preview.findings.every((finding) => finding.reason.includes("empty aria-label")));
  assert.ok(preview.findings.every((finding) => finding.suggestedPatch.readOnly === true));
  assert.doesNotMatch(JSON.stringify(preview), /Search/);
});

test("React Web label preview text mode is explicit about read-only patch previews", () => {
  const cli = runPreview(positiveFixture);
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /# React Web label patch preview/);
  assert.match(cli.stdout, /Read-only: yes/);
  assert.match(cli.stdout, /```diff/);
  assert.match(cli.stdout, /aria-label="TODO: describe/);
  assert.doesNotMatch(cli.stdout, /auto-apply/i);
});

test("React Web label preview does not expand into React Native fixtures", () => {
  const cli = runPreview(rnFixture, "--json");
  assert.equal(cli.status, 0, cli.stderr);
  const preview = JSON.parse(cli.stdout);

  assert.equal(preview.inScope, false);
  assert.match(preview.skippedReason, /^domain-classification:react-native/);
  assert.deepEqual(preview.findings, []);
});
