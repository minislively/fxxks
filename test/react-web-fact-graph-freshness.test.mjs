// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REACT_WEB_FACT_GRAPH_EXTRACTOR_VERSION,
  REACT_WEB_FACT_GRAPH_FRESHNESS_SCHEMA_VERSION,
  buildReactWebFactGraphFreshnessExpected,
  buildReactWebFactGraphFreshnessVerification,
  buildReactWebFactGraphInspection,
  selectReactWebFactGraphAnchors,
  verifyReactWebFactGraphFreshness,
} from "../dist/index.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const fixturePath = path.join(repoRoot, "test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx");

function runCli(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return result;
}

function freshInspection() {
  return buildReactWebFactGraphInspection(fixturePath, repoRoot);
}

function withoutGraphFingerprints(inspection) {
  const clone = structuredClone(inspection);
  clone.graph.freshness.sourceFingerprints = [];
  for (const node of clone.graph.nodes) {
    for (const ref of node.sourceRefs) delete ref.fingerprint;
  }
  for (const edge of clone.graph.edges) {
    for (const ref of edge.sourceRefs) delete ref.fingerprint;
  }
  return clone;
}

test("React Web fact graph freshness verifies current source and versions", () => {
  const verification = buildReactWebFactGraphFreshnessVerification(fixturePath, repoRoot);

  assert.equal(verification.schemaVersion, REACT_WEB_FACT_GRAPH_FRESHNESS_SCHEMA_VERSION);
  assert.equal(verification.status, "fresh");
  assert.equal(verification.advisoryOnly, true);
  assert.equal(verification.policy.reportOnly, true);
  assert.equal(verification.policy.authorizesRuntime, false);
  assert.equal(verification.policy.authorizesPreRead, false);
  assert.equal(verification.expected.extractorVersion, REACT_WEB_FACT_GRAPH_EXTRACTOR_VERSION);
  assert.equal(verification.expected.reactWebContextSchemaVersion, "react-web-context.v0");
  assert.deepEqual(verification.checks, {
    sourceFingerprint: "match",
    extractorVersion: "match",
    reactWebContextSchemaVersion: "match",
    factGraphSchemaVersion: "match",
  });
});

test("source fingerprint mismatch marks graph stale and consumer defers anchors", () => {
  const inspection = freshInspection();
  const expected = buildReactWebFactGraphFreshnessExpected(inspection, {
    sourceFingerprint: { fileHash: "sha256:changed", lineCount: 999 },
  });
  const verification = verifyReactWebFactGraphFreshness(inspection, expected);
  const dryRun = selectReactWebFactGraphAnchors(inspection, { freshnessVerification: verification });

  assert.equal(verification.status, "stale");
  assert.equal(verification.checks.sourceFingerprint, "mismatch");
  assert.equal(dryRun.freshnessVerification.status, "stale");
  assert.equal(dryRun.selectedAnchors.length, 0);
  assert.ok(dryRun.deferredAnchors.length > 0);
  assert.ok(dryRun.deferredAnchors.every((anchor) => anchor.deferredReason === "stale-or-unknown-freshness"));
});

test("missing graph fingerprint marks freshness unknown", () => {
  const inspection = withoutGraphFingerprints(freshInspection());
  const verification = verifyReactWebFactGraphFreshness(inspection, buildReactWebFactGraphFreshnessExpected(inspection));

  assert.equal(verification.status, "unknown");
  assert.equal(verification.checks.sourceFingerprint, "missing");
});

test("extractor and React Web context schema mismatches are stale", () => {
  const inspection = freshInspection();
  const extractorMismatch = structuredClone(inspection);
  extractorMismatch.graph.freshness.extractorVersions["react-web.fact-graph"] = "react-web.fact-graph.old";

  const extractorVerification = verifyReactWebFactGraphFreshness(extractorMismatch, buildReactWebFactGraphFreshnessExpected(inspection));
  const contextVerification = verifyReactWebFactGraphFreshness(inspection, buildReactWebFactGraphFreshnessExpected(inspection, {
    reactWebContextSchemaVersion: "react-web-context.future",
  }));

  assert.equal(extractorVerification.status, "stale");
  assert.equal(extractorVerification.checks.extractorVersion, "mismatch");
  assert.equal(contextVerification.status, "stale");
  assert.equal(contextVerification.checks.reactWebContextSchemaVersion, "mismatch");
});

test("fact graph schema mismatch is stale", () => {
  const inspection = freshInspection();
  const verification = verifyReactWebFactGraphFreshness(inspection, buildReactWebFactGraphFreshnessExpected(inspection, {
    factGraphSchemaVersion: "fact-graph-report.future",
  }));

  assert.equal(verification.status, "stale");
  assert.equal(verification.checks.factGraphSchemaVersion, "mismatch");
});

test("freshness verification is additive and does not mutate graph freshness", () => {
  const inspection = freshInspection();
  const before = structuredClone(inspection.graph.freshness);
  const verification = verifyReactWebFactGraphFreshness(inspection, buildReactWebFactGraphFreshnessExpected(inspection, {
    sourceFingerprint: { fileHash: "sha256:changed", lineCount: 999 },
  }));

  assert.equal(verification.status, "stale");
  assert.deepEqual(inspection.graph.freshness, before);
  assert.equal(inspection.graph.freshness.status, "fresh");
});

test("freshness JSON preserves non-authorization boundary", () => {
  const verification = buildReactWebFactGraphFreshnessVerification(fixturePath, repoRoot);
  const serialized = JSON.stringify(verification);

  assert.doesNotMatch(serialized, /runtimeAuthorized\s*[:=]\s*true|preReadAuthorized\s*[:=]\s*true|cacheAuthorized\s*[:=]\s*true|compact-safe|modelFacingReuse\s*[:=]\s*true/i);
  assert.doesNotMatch(serialized, /(?:proves?|guarantees?|establishes?|unlocks?)\s+[^.]{0,80}(?:token|cost|latency|provider|support-promotion|support promotion|runtime|pre-read|cache)/i);
  assert.ok(verification.nonClaims.some((claim) => /does not authorize runtime reuse/i.test(claim)));
});

test("CLI inspect react-web-fact-graph-freshness emits JSON and rejects extra args", () => {
  const json = JSON.parse(runCli(["inspect", "react-web-fact-graph-freshness", fixturePath, "--json"]).stdout);

  assert.equal(json.schemaVersion, REACT_WEB_FACT_GRAPH_FRESHNESS_SCHEMA_VERSION);
  assert.equal(json.status, "fresh");
  assert.equal(json.checks.sourceFingerprint, "match");

  const text = runCli(["inspect", "react-web-fact-graph-freshness", fixturePath]).stdout;
  assert.match(text, /React Web fact graph freshness/);
  assert.match(text, /sourceFingerprint: match/);

  const invalid = runCli(["inspect", "react-web-fact-graph-freshness", fixturePath, "--json", "extra"], 1);
  assert.match(invalid.stderr || invalid.stdout, /Unexpected compare argument: extra/i);
});
