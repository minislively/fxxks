// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REACT_WEB_FACT_GRAPH_EXTRACTOR_ID,
  REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION,
  buildReactWebFactGraphInspection,
} from "../dist/index.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function fixture(relativePath) {
  return path.join(repoRoot, relativePath);
}

function runCli(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("React Web fact graph inspection emits report-only graph with source provenance", () => {
  const report = buildReactWebFactGraphInspection(
    fixture("test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx"),
    repoRoot,
  );

  assert.equal(report.schemaVersion, REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION);
  assert.equal(report.command, "inspect react-web-fact-graph");
  assert.equal(report.profile, "react-web");
  assert.equal(report.inScope, true);
  assert.equal(report.advisoryOnly, true);
  assert.equal(report.graph.schemaVersion, "fact-graph-report.v1");
  assert.equal(report.graph.scope.domain, "react-web");
  assert.equal(report.graph.policy.reportOnly, true);
  assert.equal(report.graph.policy.runtimeAuthorized, false);
  assert.equal(report.graph.policy.candidatesAuthorizeRuntime, false);
  assert.ok(report.graph.metrics.nodeCount > 0);
  assert.ok(report.graph.metrics.edgeCount > 0);
  assert.equal(report.graph.freshness.status, "fresh");
  assert.equal(report.graph.freshness.extractorVersions[REACT_WEB_FACT_GRAPH_EXTRACTOR_ID], REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION);
  assert.equal(report.graph.freshness.extractorVersions.reactWebContext, "react-web-context.v0");

  const sourceBackedNode = report.graph.nodes.find((node) => node.sourceRefs.length > 0);
  assert.ok(sourceBackedNode, "expected at least one source-backed node");
  assert.equal(sourceBackedNode.sourceRefs[0].extractor.id, REACT_WEB_FACT_GRAPH_EXTRACTOR_ID);
  assert.equal(sourceBackedNode.sourceRefs[0].extractor.version, REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION);
  assert.ok(!path.isAbsolute(sourceBackedNode.sourceRefs[0].filePath));
  assert.equal(Object.hasOwn(sourceBackedNode, "runtimeEligibility"), false);
});

test("React Web fact graph keeps domain payload and concerns advisory-only", () => {
  const report = buildReactWebFactGraphInspection(
    fixture("test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx"),
    repoRoot,
  );
  const serialized = JSON.stringify(report);

  assert.doesNotMatch(serialized, /compact-safe|claimStatus|plannerDecision|runtimeEligibility|preReadAuthorized|cacheAuthorized/i);
  assert.ok(report.graph.nodes.filter((node) => node.kind === "concern-profile").every((node) => node.confidence === "candidate"));
  assert.ok(report.graph.nodes.filter((node) => node.kind === "concern-profile").every((node) => node.properties?.advisoryOnly === true));
});

test("React Web fact graph fails closed for mixed-domain files", () => {
  const report = buildReactWebFactGraphInspection(
    fixture("test/fixtures/frontend-domain-expectations/tui-ink-web-dom-mixed.tsx"),
    repoRoot,
  );

  assert.equal(report.inScope, false);
  assert.equal(report.skippedReason, "mixed-domain-fail-closed");
  assert.equal(report.graph.metrics.nodeCount, 0);
  assert.equal(report.graph.metrics.edgeCount, 0);
  assert.match(report.graph.warnings.join("\n"), /mixed-domain-fail-closed/);
});

test("React Web fact graph distinguishes unsupported from supported empty", () => {
  const unsupported = buildReactWebFactGraphInspection(
    fixture("test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx"),
    repoRoot,
  );
  const supportedEmpty = buildReactWebFactGraphInspection(
    fixture("test/fixtures/react-web-label-preview/related-context-form.tsx"),
    repoRoot,
  );

  assert.equal(unsupported.inScope, false);
  assert.equal(unsupported.skippedReason, "unsupported-domain:react-native");
  assert.equal(unsupported.graph.metrics.nodeCount, 0);
  assert.equal(supportedEmpty.inScope, true);
  assert.equal("skippedReason" in supportedEmpty, false);
  assert.equal(supportedEmpty.graph.metrics.nodeCount, 0);
  assert.match(supportedEmpty.graph.warnings.join("\n"), /no graphable source-backed facts/i);
});

test("CLI inspect react-web-fact-graph emits JSON with flags before or after file", () => {
  const file = "test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx";
  const after = runCli(["inspect", "react-web-fact-graph", file, "--json"]);
  const before = runCli(["inspect", "react-web-fact-graph", "--json", file]);

  assert.equal(after.schemaVersion, REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION);
  assert.equal(before.schemaVersion, REACT_WEB_FACT_GRAPH_INSPECTION_SCHEMA_VERSION);
  assert.equal(after.inScope, true);
  assert.equal(before.inScope, true);
  assert.equal(after.graph.scope.files[0], file);
  assert.equal(before.graph.scope.files[0], file);
});
