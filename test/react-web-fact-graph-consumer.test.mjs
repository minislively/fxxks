// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REACT_WEB_FACT_GRAPH_CONSUMER_SCHEMA_VERSION,
  buildFactGraphReport,
  buildReactWebFactGraphConsumerDryRun,
  buildReactWebFactGraphInspection,
  selectReactWebFactGraphAnchors,
} from "../dist/index.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function fixture(relativePath) {
  return path.join(repoRoot, relativePath);
}

function runCli(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return result;
}

function supportedFixture() {
  return fixture("test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx");
}

function ids(anchors) {
  return anchors.map((anchor) => `${anchor.rank}:${anchor.anchorType}:${anchor.anchorId}`);
}

test("React Web fact graph consumer dry-run selects fresh source-backed anchors", () => {
  const dryRun = buildReactWebFactGraphConsumerDryRun(supportedFixture(), repoRoot);

  assert.equal(dryRun.schemaVersion, REACT_WEB_FACT_GRAPH_CONSUMER_SCHEMA_VERSION);
  assert.equal(dryRun.command, "inspect react-web-fact-graph-consumer");
  assert.equal(dryRun.profile, "react-web");
  assert.equal(dryRun.advisoryOnly, true);
  assert.equal(dryRun.inScope, true);
  assert.equal(dryRun.selectionPolicy.reportOnly, true);
  assert.equal(dryRun.selectionPolicy.authorization, "none");
  assert.equal(dryRun.selectionPolicy.maxAnchors, 8);
  assert.equal(dryRun.graphSummary.freshnessStatus, "fresh");
  assert.ok(dryRun.selectedAnchors.length > 0);

  for (const anchor of dryRun.selectedAnchors) {
    assert.equal(anchor.freshnessStatus, "fresh");
    assert.ok(anchor.rank > 0);
    assert.ok(anchor.anchorId.length > 0);
    assert.ok(anchor.kind.length > 0);
    assert.ok(anchor.reason.length > 0);
    assert.ok(anchor.sourceRefs.length > 0);
  }
});

test("pure selector preserves edge-backed anchors and deterministic ordering", () => {
  const inspection = buildReactWebFactGraphInspection(supportedFixture(), repoRoot);
  const first = selectReactWebFactGraphAnchors(inspection, { maxAnchors: 8 });
  const second = selectReactWebFactGraphAnchors(inspection, { maxAnchors: 8 });

  assert.deepEqual(ids(first.selectedAnchors), ids(second.selectedAnchors));
  const edgeAnchor = first.selectedAnchors.find((anchor) => anchor.anchorType === "edge") ?? first.deferredAnchors.find((anchor) => anchor.anchorType === "edge");
  assert.ok(edgeAnchor, "expected at least one edge-backed graph anchor");
  assert.ok(edgeAnchor.edgeId);
  assert.ok(edgeAnchor.fromNodeId);
  assert.ok(edgeAnchor.toNodeId);
});

test("selector comparator ties by source line, edge before node, label, and id", () => {
  const sourceRef = (line, id) => ({
    filePath: "fixtures/Tie.tsx",
    loc: { startLine: line, startColumn: 1, endLine: line, endColumn: 10 },
    fingerprint: { fileHash: `hash-${id}`, lineCount: 30 },
    extractor: { id: "test", version: "v1" },
  });
  const graph = buildFactGraphReport({
    scope: { files: ["fixtures/Tie.tsx"], domain: "react-web" },
    freshness: {
      status: "fresh",
      staleWhen: ["test changes"],
      sourceFingerprints: [{ fileHash: "hash-root", lineCount: 30 }],
      extractorVersions: { test: "v1" },
    },
    nodes: [
      {
        id: "node-z",
        domain: "react-web",
        kind: "patch-target:component",
        label: "Z node",
        confidence: "known",
        sourceRefs: [sourceRef(10, "node-z")],
        evidence: ["test node z"],
      },
      {
        id: "node-a",
        domain: "react-web",
        kind: "patch-target:component",
        label: "A node",
        confidence: "known",
        sourceRefs: [sourceRef(10, "node-a")],
        evidence: ["test node a"],
      },
      {
        id: "node-early",
        domain: "react-web",
        kind: "patch-target:component",
        label: "Early node",
        confidence: "known",
        sourceRefs: [sourceRef(5, "node-early")],
        evidence: ["test node early"],
      },
    ],
    edges: [
      {
        id: "edge-same-line",
        domain: "react-web",
        kind: "targets",
        from: "node-z",
        to: "node-a",
        confidence: "known",
        sourceRefs: [sourceRef(10, "edge-same-line")],
        evidence: ["test edge"],
      },
    ],
  });
  const dryRun = selectReactWebFactGraphAnchors({
    schemaVersion: "react-web-fact-graph-inspection.v1",
    command: "inspect react-web-fact-graph",
    profile: "react-web",
    inScope: true,
    advisoryOnly: true,
    graph,
  }, { maxAnchors: 4 });

  assert.equal(dryRun.selectedAnchors[0].anchorId, "node-early", "lower source line wins before edge tie");
  assert.equal(dryRun.selectedAnchors[1].anchorType, "edge", "edge wins over node when priority/confidence/line tie");
  assert.equal(dryRun.selectedAnchors[2].anchorId, "node-a", "label tiebreak sorts A before Z");
  assert.equal(dryRun.selectedAnchors[3].anchorId, "node-z");
});

test("budget overflow is deferred with explicit reason", () => {
  const dryRun = buildReactWebFactGraphConsumerDryRun(supportedFixture(), repoRoot, { maxAnchors: 1 });

  assert.equal(dryRun.selectedAnchors.length, 1);
  assert.ok(dryRun.deferredAnchors.length > 0);
  assert.ok(dryRun.deferredAnchors.every((anchor) => anchor.deferredReason === "budget-deferred"));
});

test("mixed and unsupported files fail closed without selected anchors", () => {
  const mixed = buildReactWebFactGraphConsumerDryRun(
    fixture("test/fixtures/frontend-domain-expectations/tui-ink-web-dom-mixed.tsx"),
    repoRoot,
  );
  const unsupported = buildReactWebFactGraphConsumerDryRun(
    fixture("test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx"),
    repoRoot,
  );

  assert.equal(mixed.inScope, false);
  assert.equal(mixed.skippedReason, "mixed-domain-fail-closed");
  assert.equal(mixed.selectedAnchors.length, 0);
  assert.equal(unsupported.inScope, false);
  assert.equal(unsupported.skippedReason, "unsupported-domain:react-native");
  assert.equal(unsupported.selectedAnchors.length, 0);
});

test("supported empty React Web files are distinct from unsupported files", () => {
  const dryRun = buildReactWebFactGraphConsumerDryRun(
    fixture("test/fixtures/react-web-label-preview/related-context-form.tsx"),
    repoRoot,
  );

  assert.equal(dryRun.inScope, true);
  assert.equal("skippedReason" in dryRun, false);
  assert.equal(dryRun.selectedAnchors.length, 0);
  assert.match(dryRun.warnings.join("\n"), /no graphable source-backed facts|no source-backed anchors/i);
});

test("unknown freshness defers all source-backed candidates instead of selecting", () => {
  const inspection = structuredClone(buildReactWebFactGraphInspection(supportedFixture(), repoRoot));
  inspection.graph.freshness.status = "unknown";
  inspection.graph.freshness.sourceFingerprints = [];

  const dryRun = selectReactWebFactGraphAnchors(inspection, { maxAnchors: 8 });

  assert.equal(dryRun.selectedAnchors.length, 0);
  assert.ok(dryRun.deferredAnchors.length > 0);
  assert.ok(dryRun.deferredAnchors.every((anchor) => anchor.deferredReason === "stale-or-unknown-freshness"));
  assert.match(dryRun.warnings.join("\n"), /stale or unknown/i);
});

test("consumer JSON and text preserve non-authorization boundary", () => {
  const dryRun = buildReactWebFactGraphConsumerDryRun(supportedFixture(), repoRoot);
  const serialized = JSON.stringify(dryRun);
  const text = runCli(["inspect", "react-web-fact-graph-consumer", "test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx"]).stdout;

  assert.doesNotMatch(serialized, /runtimeAuthorized\s*[:=]\s*true|preReadAuthorized|cacheAuthorized|compact-safe|modelFacingReuse/i);
  assert.doesNotMatch(serialized, /(?:proves?|guarantees?|establishes?|unlocks?)\s+[^.]{0,80}(?:token|cost|latency|provider|support-promotion|support promotion)/i);
  assert.ok(dryRun.nonClaims.some((claim) => /does not authorize runtime reuse/i.test(claim)));
  assert.ok(dryRun.nonClaims.some((claim) => /does not claim token/i.test(claim)));
  assert.match(dryRun.warnings.join("\n"), /does not claim token, cost, latency/i);
  assert.match(text, /Non-claims:/);
  assert.match(text, /does not claim token/i);
});

test("CLI inspect react-web-fact-graph-consumer parses JSON and max-anchors flags", () => {
  const file = "test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx";
  const after = JSON.parse(runCli(["inspect", "react-web-fact-graph-consumer", file, "--json"]).stdout);
  const before = JSON.parse(runCli(["inspect", "react-web-fact-graph-consumer", "--json", "--max-anchors", "1", file]).stdout);

  assert.equal(after.schemaVersion, REACT_WEB_FACT_GRAPH_CONSUMER_SCHEMA_VERSION);
  assert.equal(before.schemaVersion, REACT_WEB_FACT_GRAPH_CONSUMER_SCHEMA_VERSION);
  assert.equal(before.selectionPolicy.maxAnchors, 1);
  assert.equal(before.selectedAnchors.length, 1);

  const invalid = runCli(["inspect", "react-web-fact-graph-consumer", "--max-anchors", "0", file, "--json"], 1);
  assert.match(invalid.stderr || invalid.stdout, /max-anchors must be an integer between 1 and 20/i);
});
