// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const docs = {
  "docs/product-direction.md": fs.readFileSync(path.join(repoRoot, "docs", "product-direction.md"), "utf8"),
  "docs/frontend-domains.md": fs.readFileSync(path.join(repoRoot, "docs", "frontend-domains.md"), "utf8"),
  "docs/evidence-model.md": fs.readFileSync(path.join(repoRoot, "docs", "evidence-model.md"), "utf8"),
  "docs/workflow-architecture.md": fs.readFileSync(path.join(repoRoot, "docs", "workflow-architecture.md"), "utf8"),
  "docs/state-contract.md": fs.readFileSync(path.join(repoRoot, "docs", "state-contract.md"), "utf8"),
};

function assertContains(label, doc, phrases) {
  for (const phrase of phrases) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} missing ${phrase}`);
  }
}

test("Issue 920 product architecture docs exist with required headings", () => {
  assertContains("product direction", docs["docs/product-direction.md"], [
    "# Product direction",
    "## Direction",
    "## Claim / non-claim boundary",
  ]);
  assertContains("frontend domains", docs["docs/frontend-domains.md"], [
    "# Frontend domains",
    "## Domain taxonomy",
    "## Promotion ladder",
  ]);
  assertContains("evidence model", docs["docs/evidence-model.md"], [
    "# Evidence model",
    "## Core terms",
    "## Claim lifecycle",
  ]);
  assertContains("workflow architecture", docs["docs/workflow-architecture.md"], [
    "# Workflow architecture",
    "## Service responsibilities",
    "## Agent handoff contract",
  ]);
  assertContains("state contract", docs["docs/state-contract.md"], [
    "# State contract",
    "## State categories",
    "## Product-facing state rules",
  ]);
});

test("Issue 920 docs define fooks as a frontend-first AI coding context manager", () => {
  assertContains("product direction", docs["docs/product-direction.md"], [
    "frontend-first AI coding context manager",
    "not an auto-fix engine",
    "A local estimate is a local estimate. A receipt is a record of a run or decision. Active work is unfinished",
  ]);
  assertContains("workflow architecture", docs["docs/workflow-architecture.md"], [
    "frontend-first AI coding context manager",
    "The workflow starts with source context and ends with a receipt.",
  ]);
});

test("Issue 920 docs keep evidence, receipts, claims, and active work distinct", () => {
  assertContains("evidence model", docs["docs/evidence-model.md"], [
    "Claim",
    "Non-claim",
    "Evidence",
    "Receipt",
    "Active work",
    "Active work is not evidence of completion.",
  ]);
  assertContains("state contract", docs["docs/state-contract.md"], [
    "Receipts are scoped.",
    "Active is not done.",
    "Internal is not public.",
  ]);
});

test("Issue 920 docs preserve service-layer separation", () => {
  assertContains("frontend domains", docs["docs/frontend-domains.md"], [
    "Domain evidence is an observation. It is not permission.",
    "Concern profiles can enrich a work order after a domain and policy decision. They cannot bypass fallback rules.",
  ]);
  assertContains("workflow architecture", docs["docs/workflow-architecture.md"], [
    "Source inspection",
    "Domain and concern profiling",
    "Policy planning",
    "Packet/work-order assembly",
    "Runtime adapters",
    "Reporting/receipts",
  ]);
});

test("Issue 920 docs explicitly do not authorize implementation/runtime changes", () => {
  const combined = Object.values(docs).join("\n");
  assert.match(combined, /does not change runtime\/provider behavior/u);
  assert.match(combined, /does not change detector behavior/u);
  assert.match(combined, /does not implement new workflow behavior/u);
  assert.match(combined, /does not change cache storage/u);
  assert.match(combined, /does not authorize dogfood symptom fixes/u);
});
