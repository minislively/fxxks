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
  "## Domain-policy sublayers",
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
  "src/core/domain-profiles/*",
  "src/core/payload-policy/react-web.ts",
  "src/core/payload-policy/*",
  "src/core/concern-profiles/*",
  "src/core/payload/model-facing.ts",
  "src/core/payload/domain-payload.ts",
  "src/reporting/react-web-status.ts",
  "src/reporting/react-web-evidence-artifact.ts",
  "src/reporting/worktree-evidence.ts",
  "src/ops/artifact-audit.ts",
  "src/core/react-web-status.ts",
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
    "Compatibility shims remain at the former `src/core/*` paths for import/export stability.",
    "That physical location does not make them runtime authority.",
  ];

  for (const sentence of requiredBoundarySentences) {
    assert.match(doc, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing boundary sentence: ${sentence}`);
  }
});

test("architecture boundary doc locks domain-policy sublayer directionality", () => {
  const requiredBoundarySentences = [
    "Reads source syntax and emits source-derived evidence plus a classification. It must not authorize compact reuse by itself.",
    "Profiles describe support boundaries; they do not assemble model-facing payloads.",
    "Concern profiles are evidence-only and non-authorizing; they are never standalone domain evidence or payload permission.",
    "This is the authorization seam for whether source evidence may affect a model-facing packet.",
    "Assembly consumes policy; it must not invent a new support claim outside the policy gate.",
    "The intended direction is detector/profile/concern evidence -> payload policy -> payload assembly -> runtime adapter.",
    "Runtime adapters may invoke this stack, but they do not bypass it.",
    "Reporting surfaces may summarize artifacts that come from this stack, but they do not become policy authority.",
  ];

  for (const sentence of requiredBoundarySentences) {
    assert.match(doc, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing domain-policy sentence: ${sentence}`);
  }
});

test("architecture boundary doc rejects churn-only domain-policy moves", () => {
  const requiredBoundarySentences = [
    "Do not move or rename these domain-policy files unless the PR gives a reviewer-readable boundary reason",
    "preserves deep-import/package-export compatibility where applicable",
    "includes tests proving public behavior and claim boundaries are unchanged",
    "If the only benefit is readability, prefer this document and focused boundary tests over import churn.",
  ];

  for (const sentence of requiredBoundarySentences) {
    assert.match(doc, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing cleanup guard: ${sentence}`);
  }
});

test("architecture boundary doc preserves React Web as strongest and keeps other lanes bounded", () => {
  assert.match(doc, /React Web is the strongest bounded runtime path/u);
  assert.match(doc, /React Native[\s\S]{0,180}not mobile runtime correctness/u);
  assert.match(doc, /WebView[\s\S]{0,180}not WebView support/u);
  assert.match(doc, /TUI \/ React CLI[\s\S]{0,180}not terminal semantics/u);
});
