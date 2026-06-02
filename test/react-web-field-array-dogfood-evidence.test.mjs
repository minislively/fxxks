import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import {
  REACT_WEB_FIELD_ARRAY_DOGFOOD_SCHEMA_VERSION,
  buildReactWebFieldArrayDogfoodEvidence,
  renderReactWebFieldArrayDogfoodMarkdown,
} from "../scripts/react-web-field-array-dogfood-evidence.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("React Web field-array dogfood evidence records priority decision boundary", async () => {
  const evidence = await buildReactWebFieldArrayDogfoodEvidence({ repoRoot, runId: "test" });

  assert.equal(evidence.schemaVersion, REACT_WEB_FIELD_ARRAY_DOGFOOD_SCHEMA_VERSION);
  assert.equal(evidence.measurement, "react-web-field-array-consumer-priority-dogfood");
  assert.equal(evidence.source.containsUseFieldArray, true);
  assert.equal(evidence.source.containsFieldsMap, true);
  assert.equal(evidence.defaultBudget.useFieldArrayPatchTargetSelected, false);
  assert.equal(evidence.wideBudget.useFieldArrayPatchTargetSelected, true);
  assert.equal(evidence.defaultBudget.dynamicFieldsRoleSelected, false);
  assert.equal(evidence.defaultBudget.dynamicFieldsRoleCoverage.status, "deferred");
  assert.equal(evidence.priorityDecision.verdict, "defer-promotion-pending-task-outcome");
  assert.match(evidence.claimBoundary, /not task-success evidence/);
  assert.match(evidence.claimBoundary, /not token\/cost\/billing proof/);

  const markdown = renderReactWebFieldArrayDogfoodMarkdown(evidence);
  assert.match(markdown, /React Web field-array dogfood priority evidence/);
  assert.match(markdown, /useFieldArray patch-target selected: no/);
  assert.match(markdown, /Wide inspection budget/);
  assert.match(markdown, /useFieldArray patch-target selected: yes/);
  assert.match(markdown, /dynamic-fields role selected: no/);
  assert.match(markdown, /defer-promotion-pending-task-outcome/);
});

test("React Web field-array dogfood evidence CLI writes JSON and markdown", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-field-array-dogfood-"));
  try {
    const outputPath = path.join(tempDir, "evidence.json");
    const markdownPath = path.join(tempDir, "evidence.md");
    const result = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts", "react-web-field-array-dogfood-evidence.mjs"),
      "--run-id=cli-test",
      `--output=${outputPath}`,
      `--markdown-output=${markdownPath}`,
    ], { cwd: repoRoot, encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const evidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const markdown = fs.readFileSync(markdownPath, "utf8");
    assert.equal(evidence.schemaVersion, REACT_WEB_FIELD_ARRAY_DOGFOOD_SCHEMA_VERSION);
    assert.match(markdown, /Priority decision/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
