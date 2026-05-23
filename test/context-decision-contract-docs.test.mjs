// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readDoc(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertContains(label, doc, phrases) {
  for (const phrase of phrases) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} missing ${phrase}`);
  }
}

const contract = readDoc("docs/context-decision-contract.md");
const setup = readDoc("docs/setup.md");
const stateContract = readDoc("docs/state-contract.md");
const domainPayloadArchitecture = readDoc("docs/domain-payload-architecture.md");

test("context-decision contract documents the explicit report-only CLI appendix", () => {
  assertContains("context decision", contract, [
    "# Context decision contract",
    "context-decision.v1",
    "fooks inspect-domain <file> --json --context-decision",
    "top-level `contextDecision` only when `--context-decision` is passed",
    "Plain `inspect-domain --json` output remains unchanged",
    "`--context-decision` requires `--json`",
  ]);
});

test("context-decision contract preserves decision metadata versus permission boundary", () => {
  assertContains("context decision", contract, [
    "full-read",
    "report-only",
    "compact-context",
    "narrow-payload",
    "defer",
    "policy.allowed: false",
    "Policy remains the permission owner",
    "not permission to reuse context",
  ]);
});

test("context-decision contract forbids runtime, support, and provider-cost expansion", () => {
  assertContains("context decision", contract, [
    "does not change detector behavior",
    "runtime adapters",
    "pre-read behavior",
    "cache storage",
    "setup readiness",
    "model-facing payload schemas",
    "React Native support",
    "WebView support",
    "broad TUI semantics",
    "provider-token/cost/latency claims",
  ]);
});

test("related docs link context-decision without widening behavior", () => {
  assertContains("setup", setup, [
    "context-decision.v1",
    "--context-decision",
    "does not authorize runtime, pre-read, cache, setup-readiness, or model-facing payload reuse",
  ]);
  assertContains("state contract", stateContract, [
    "context-decision.v1",
    "context-decision-contract.md",
    "does not change cache storage, detector logic, runtime adapters, pre-read behavior, setup-readiness behavior, or implementation behavior",
  ]);
  assertContains("domain payload architecture", domainPayloadArchitecture, [
    "context-decision.v1",
    "context-decision-contract.md",
    "Diagnostic `compact-context` or `narrow-payload` decisions remain report-only",
    "policy remains the permission owner",
  ]);
});
