// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "architecture-boundaries.md");
const doc = fs.readFileSync(docPath, "utf8");

const requiredSections = [
  "# Architecture boundaries",
  "## Boundary doctrine",
  "## Current responsibility map",
  "## Mixed-location rule",
  "## React Web first, other lanes bounded",
  "## Cleanup rule for future PRs",
];

const requiredBoundaries = [
  "CLI / user commands",
  "Runtime adapters",
  "Pure engine / extraction core",
  "Domain support boundaries",
  "Evidence / status / release reporting",
  "Ops / dogfood guard utilities",
];

const representativePaths = [
  "src/cli/index.ts",
  "src/adapters/codex-runtime-hook.ts",
  "src/core/extract.ts",
  "src/core/domain-detector.ts",
  "src/core/payload-policy/react-web.ts",
  "src/core/react-web-status.ts",
  "src/core/react-web-evidence-artifact.ts",
  "src/core/worktree-evidence.ts",
  "src/core/artifact-audit.ts",
  "scripts/react-web-context-evidence.mjs",
  "scripts/release-claim-guards.mjs",
  "scripts/audit-remote-branches.mjs",
  "scripts/guard-pr-alerts.mjs",
  "scripts/triage-ci-alerts.mjs",
];

test("architecture boundary doc names the required responsibility layers", () => {
  for (const section of requiredSections) {
    assert.match(doc, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing section: ${section}`);
  }
  for (const boundary of requiredBoundaries) {
    assert.match(doc, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing boundary: ${boundary}`);
  }
});

test("architecture boundary doc anchors each layer to representative current paths", () => {
  for (const pathName of representativePaths) {
    assert.match(doc, new RegExp(pathName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing representative path: ${pathName}`);
  }
});

test("architecture boundary doc keeps evidence and ops out of runtime authority", () => {
  const requiredBoundarySentences = [
    "Reporting surfaces summarize artifacts, freshness, claim boundaries, or release evidence. They do not authorize runtime compaction by themselves.",
    "They are not product architecture seams and must not be cited as runtime support.",
    "That physical location does not make them runtime authority.",
  ];

  for (const sentence of requiredBoundarySentences) {
    assert.match(doc, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing boundary sentence: ${sentence}`);
  }
});

test("architecture boundary doc preserves React Web as strongest and keeps other lanes bounded", () => {
  assert.match(doc, /React Web is the strongest bounded runtime path/u);
  assert.match(doc, /React Native[\s\S]{0,180}not mobile runtime correctness/u);
  assert.match(doc, /WebView[\s\S]{0,180}not WebView support/u);
  assert.match(doc, /TUI \/ React CLI[\s\S]{0,180}not terminal semantics/u);
});
