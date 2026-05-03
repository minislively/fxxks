// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const preRead = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));
const preReadSource = fs.readFileSync(path.join(repoRoot, "src", "adapters", "pre-read.ts"), "utf8");

test("pre-read centralizes full-read fallback envelope construction", () => {
  assert.match(preReadSource, /function buildPreReadFallbackDecision\(/);
  const fallbackEnvelopeConstructions = preReadSource.match(/fallback:\s*{\s*\n\s*action:\s*"full-read"/g) ?? [];
  assert.equal(fallbackEnvelopeConstructions.length, 1);
  assert.doesNotMatch(preReadSource, /return \{\s*\n\s*runtime,[\s\S]*?decision: "fallback",[\s\S]*?fallback: \{\s*\n\s*action: "full-read"/);
});

test("pre-read fallback builder preserves ineligible extension decisions", () => {
  const decision = preRead.decidePreRead(path.join(repoRoot, "not-a-source.md"), repoRoot, "codex");

  assert.deepEqual(decision, {
    runtime: "codex",
    filePath: "not-a-source.md",
    eligible: false,
    decision: "fallback",
    reasons: ["ineligible-extension"],
    debug: {},
    fallback: {
      action: "full-read",
      reason: "ineligible-extension",
    },
  });
});

test("pre-read fallback debug remains domain and policy shaped", () => {
  const tempDir = fs.mkdtempSync(path.join(repoRoot, ".tmp-pre-read-debug-"));
  try {
    const filePath = path.join(tempDir, "Cli.tsx");
    fs.writeFileSync(filePath, `import { Box } from "ink"; export function Cli() { return <Box />; }`);
    const decision = preRead.decidePreRead(filePath, tempDir, "codex");

    assert.equal(decision.decision, "fallback");
    assert.equal(decision.debug.domainDetection.classification, "tui-ink");
    assert.equal(decision.debug.frontendPayloadPolicy.allowed, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
