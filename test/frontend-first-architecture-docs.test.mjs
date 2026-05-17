// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPaths = [
  "docs/product-direction.md",
  "docs/frontend-domains.md",
  "docs/evidence-model.md",
  "docs/workflow-architecture.md",
  "docs/state-contract.md",
];

function readDoc(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const docs = Object.fromEntries(docPaths.map((relativePath) => [relativePath, readDoc(relativePath)]));
const combined = Object.values(docs).join("\n");

test("frontend-first product architecture docs define fooks direction", () => {
  for (const relativePath of docPaths) {
    assert.ok(docs[relativePath].trim().length > 400, `${relativePath} should contain substantive architecture text`);
  }

  assert.match(docs["docs/product-direction.md"], /frontend-first AI coding context manager/);
  assert.match(docs["docs/product-direction.md"], /not a generic scanner, benchmark wrapper, or autonomous coding agent/);
  assert.match(docs["docs/workflow-architecture.md"], /docs architecture pass fixes language before implementation issues/);
});

test("frontend architecture docs bind React Web, WebView, and React Native domains", () => {
  const frontendDomains = docs["docs/frontend-domains.md"];

  assert.match(frontendDomains, /## React Web/);
  assert.match(frontendDomains, /## WebView/);
  assert.match(frontendDomains, /## React Native \/ RN/);
  assert.match(frontendDomains, /cross-domain claim must list each domain separately/);
  assert.match(combined, /React Web, WebView, and React Native/);
});

test("evidence, state, and next-action contracts are connected", () => {
  const evidenceModel = docs["docs/evidence-model.md"];
  const stateContract = docs["docs/state-contract.md"];
  const workflow = docs["docs/workflow-architecture.md"];

  for (const required of ["Source evidence", "Test evidence", "Workflow evidence", "Session evidence", "Receipt evidence"]) {
    assert.match(evidenceModel, new RegExp(required));
  }

  for (const requiredState of [
    "architecture_blocked",
    "idle_clean",
    "active_session",
    "active_branch",
    "pr_ready",
    "receipt_only",
    "blocked",
  ]) {
    assert.match(stateContract, new RegExp(requiredState));
  }

  assert.match(stateContract, /State to next-action mapping/);
  assert.match(stateContract, /Evidence cannot choose a next action without state/);
  assert.match(workflow, /Evidence model selects the required proof/);
});

test("architecture docs preserve the no symptom-fix PR boundary", () => {
  assert.match(combined, /product direction\/evidence architecture not documented/);
  assert.match(combined, /not create another symptom-fix dogfood PR/);
  assert.match(combined, /docs architecture pass only/);
  assert.doesNotMatch(combined, /guarantees production readiness/i);
});
