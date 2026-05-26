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

const domainMemory = readDoc("docs/domain-memory-contract.md");
const stateContract = readDoc("docs/state-contract.md");
const domainPayloadArchitecture = readDoc("docs/domain-payload-architecture.md");

test("domain-memory contract documents the explicit report-only receipt contract", () => {
  assertContains("domain memory", domainMemory, [
    "# Domain memory contract",
    "domain-memory.v1",
    "explicit report-only CLI output",
    "--domain-memory-receipt",
    "audit and receipt shape",
    "not a support expansion",
    "not a new automatic compact-payload path",
  ]);
});

test("domain-memory contract preserves evidence versus permission boundary", () => {
  assertContains("domain memory", domainMemory, [
    "Domain and concern evidence are observations. They are not permission.",
    "Compact or narrow reuse requires an explicit payload-policy decision",
    "must never authorize compact-payload reuse",
    "must never promote a domain",
    "policy remains the permission owner",
  ]);
});

test("domain-memory contract records freshness and fallback safety", () => {
  assertContains("domain memory", domainMemory, [
    "sourceFingerprint.fileHash",
    "sourceFingerprint.lineCount",
    "If any freshness anchor is missing or stale",
    "read the current source or rerun the relevant fooks command",
    "Fallback and deferred are valid safe states, not failures.",
    "must not auto-promote a domain or concern",
  ]);
});

test("domain-memory contract forbids support and runtime expansion", () => {
  assertContains("domain memory", domainMemory, [
    "runtime behavior",
    "detector behavior",
    "pre-read behavior",
    "cache storage changes",
    "model-facing payload schema changes",
    "React Native broad support",
    "WebView support, bridge safety, or compact-payload reuse",
    "broad TUI semantic support or terminal correctness",
    "provider-token, billing, cost, latency, or runtime-token claims",
    "Plain `inspect-domain --json` output remains unchanged",
    "`--domain-memory-receipt` requires `--json`",
    "does not authorize runtime, pre-read, cache, or compact-payload reuse",
  ]);
});

test("domain-memory contract scopes runtime advisory consumer to explicit and automatic fresh advisory receipts", () => {
  assertContains("domain memory", domainMemory, [
    "Runtime advisory consumer lane",
    "explicit prompt-provided receipt path",
    "advisory-only",
    "FOOKS DOMAIN MEMORY ADVISORY",
    "normal pre-read/runtime payload gate must already allow injection",
    "fails closed to full-read guidance",
    "automatic project-local lookup",
    "authorization: none",
    "advisoryOnly: true",
    "debug-only no-ops",
    "do not force full-read fallback",
    "Runtime lookup errors are represented as `unsupported` debug metadata",
    "does not add pre-read reuse, cache reuse, model-facing payload reuse",
    "Pre-read consumers, automatic receipt persistence, and authorized runtime/cache reuse require separate plans",
  ]);
});

test("domain-memory contract scopes lookup diagnostics to advisory-only evidence", () => {
  assertContains("domain memory", domainMemory, [
    "Lookup diagnostic lane",
    "fooks domain-memory lookup --file src/Foo.tsx --json",
    "recursively scans only the project-local `.fooks/domain-memory/` directory",
    "rejects symlinked lookup directories",
    "not-found`, `fresh`, `stale`, `incompatible`, `unsupported`, or `ambiguous`",
    "fresh for report/advisory evidence only",
    "authorization: \"none\"",
    "advisoryReceiptPath` is evidence-only",
    "Multiple fresh receipts are `ambiguous`",
    "mixed fresh/non-fresh",
    "do not authorize runtime reuse, pre-read reuse, cache reuse, model-facing payload reuse",
    "does not authorize pre-read decisions, cache storage, or model-facing payload reuse",
    "runtime hook consumes a `fresh` lookup only as advisory context after normal payload eligibility",
  ]);
});

test("domain-memory contract scopes codex pre-read lookup to explicit debug-only opt-in", () => {
  assertContains("domain memory", domainMemory, [
    "Codex pre-read advisory consumer lane",
    "fooks codex-pre-read src/Foo.tsx --json --include-domain-memory-lookup",
    "Without `--include-domain-memory-lookup`",
    "debug.domainMemoryLookup",
    "codex-pre-read opt-in domain-memory lookup",
    "authorization: \"none\"",
    "advisoryOnly: true",
    "must never change `decision`, `reasons`, `fallback`, `payload`, `readiness`",
    "do not authorize pre-read decisions or compact reuse",
  ]);
});

test("state and domain-payload architecture docs link the domain-memory contract without widening behavior", () => {
  assertContains("state contract", stateContract, [
    "domain-memory.v1",
    "Domain memory contract",
    "does not change cache storage, detector logic, runtime adapters, or implementation behavior",
    "freshness first, policy before reuse, fallback as explicit state",
  ]);

  assertContains("domain payload architecture", domainPayloadArchitecture, [
    "domain-memory.v1",
    "domain-memory-contract.md",
    "does not add runtime behavior, detector behavior, pre-read behavior, payload schema changes, or support wording",
    "scanner evidence and concern metadata remain observations",
    "policy remains the permission owner",
  ]);
});
