import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REACT_WEB_SNAPSHOT_AWARE_INSPECT_SCHEMA_VERSION,
  buildReactWebSnapshotAwareInspect,
  renderReactWebSnapshotAwareInspectMarkdown,
} from "../scripts/react-web-snapshot-aware-inspect.mjs";
import { buildReactWebLiveHookDogfoodCoverageSummary } from "../scripts/react-web-live-hook-dogfood-evidence.mjs";

const repoRoot = process.cwd();

function freshCoverageSummary() {
  return buildReactWebLiveHookDogfoodCoverageSummary();
}

function graph(overrides = {}) {
  return {
    schemaVersion: "react-web-fact-graph-consumer-dry-run.v1",
    advisoryOnly: true,
    authorization: "none",
    freshnessStatus: "fresh",
    selectedAnchorCount: 3,
    deferredAnchorCount: 1,
    maxAnchors: 4,
    staleBehavior: "defer-all",
    ...overrides,
  };
}

function cleanProbeBoundary(overrides = {}) {
  return {
    payloadContainsGraph: false,
    diagnosticOnly: true,
    claimable: false,
    ...overrides,
  };
}

test("React Web snapshot-aware inspect reports ready only for fresh snapshot and fresh graph", () => {
  const evidence = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph(),
    probeBoundary: cleanProbeBoundary(),
    file: "fixtures/compressed/FormSection.tsx",
    selectedAnchors: [
      { label: "component: FormSection", source: "graph-consumer", evidence: ["fresh graph"] },
    ],
  });

  assert.equal(evidence.schemaVersion, REACT_WEB_SNAPSHOT_AWARE_INSPECT_SCHEMA_VERSION);
  assert.equal(evidence.inspectStatus, "ready");
  assert.equal(evidence.authorization, "none");
  assert.equal(evidence.advisoryOnly, true);
  assert.equal(evidence.diagnosticOnly, true);
  assert.equal(evidence.claimable, false);
  assert.equal(evidence.snapshot.driftStatus, "fresh");
  assert.equal(evidence.graphConsumer.freshnessStatus, "fresh");
  assert.equal(evidence.wouldSelectAnchorCount, 3);
  assert.equal(evidence.selectedAnchorDetailStatus, "provided");
  assert.equal(evidence.selectedAnchors.length, 1);
  assert.deepEqual(evidence.blockedReasons, []);
  assert.equal(evidence.nonClaims.runtimePreReadAuthorization, false);
  assert.equal(evidence.nonClaims.mergeGatePolicy, false);
});

test("React Web snapshot-aware inspect blocks on drifted or missing snapshot", () => {
  const fresh = freshCoverageSummary();
  const drifted = {
    ...fresh,
    snapshotDrift: {
      ...fresh.snapshotDrift,
      driftStatus: "drifted",
      reasons: ["fixture-source-fingerprint-mismatch"],
      manifest: { matched: true },
      fixtureSource: { matched: false },
    },
  };
  const missing = {
    ...fresh,
    snapshotDrift: {
      ...fresh.snapshotDrift,
      driftStatus: "missing-baseline",
      reasons: ["snapshot-baseline-missing"],
      manifest: { matched: false },
      fixtureSource: { matched: false },
    },
  };

  const driftedEvidence = buildReactWebSnapshotAwareInspect({ coverageSummary: drifted, graphConsumer: graph(), probeBoundary: cleanProbeBoundary() });
  const missingEvidence = buildReactWebSnapshotAwareInspect({ coverageSummary: missing, graphConsumer: graph(), probeBoundary: cleanProbeBoundary() });

  assert.equal(driftedEvidence.inspectStatus, "blocked");
  assert.deepEqual(driftedEvidence.blockedReasons, ["snapshot-drift-not-fresh"]);
  assert.equal(driftedEvidence.wouldSelectAnchorCount, 0);
  assert.equal(missingEvidence.inspectStatus, "blocked");
  assert.deepEqual(missingEvidence.blockedReasons, ["snapshot-drift-not-fresh"]);
  assert.equal(missingEvidence.wouldSelectAnchorCount, 0);
});

test("React Web snapshot-aware inspect blocks stale graph and unavailable graph separately", () => {
  const stale = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph({ freshnessStatus: "stale" }),
    probeBoundary: cleanProbeBoundary(),
  });
  const missingGraph = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: null,
    probeBoundary: cleanProbeBoundary(),
  });
  const noAnchors = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph({ selectedAnchorCount: 0, deferredAnchorCount: 4 }),
    probeBoundary: cleanProbeBoundary(),
  });
  const widenedAuthority = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph({ authorization: "runtime" }),
    probeBoundary: cleanProbeBoundary(),
  });
  const missingAuthorization = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph({ authorization: undefined }),
    probeBoundary: cleanProbeBoundary(),
  });
  const missingAdvisoryFlag = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph({ advisoryOnly: undefined }),
    probeBoundary: cleanProbeBoundary(),
  });

  assert.equal(stale.inspectStatus, "blocked");
  assert.deepEqual(stale.blockedReasons, ["graph-consumer-not-fresh"]);
  assert.equal(missingGraph.inspectStatus, "unavailable");
  assert.deepEqual(missingGraph.blockedReasons, ["graph-consumer-unavailable"]);
  assert.equal(noAnchors.inspectStatus, "unavailable");
  assert.deepEqual(noAnchors.blockedReasons, ["no-anchors-selected"]);
  assert.equal(widenedAuthority.inspectStatus, "blocked");
  assert.deepEqual(widenedAuthority.blockedReasons, ["graph-consumer-authority-widened"]);
  assert.equal(missingAuthorization.inspectStatus, "blocked");
  assert.deepEqual(missingAuthorization.blockedReasons, ["graph-consumer-authority-widened"]);
  assert.equal(missingAdvisoryFlag.inspectStatus, "blocked");
  assert.deepEqual(missingAdvisoryFlag.blockedReasons, ["graph-consumer-authority-widened"]);
});

test("React Web snapshot-aware inspect blocks pre-read probe boundary violations", () => {
  const missingBoundary = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph(),
  });
  const leakedPayload = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph(),
    probeBoundary: cleanProbeBoundary({ payloadContainsGraph: true }),
  });
  const notDiagnostic = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph(),
    probeBoundary: cleanProbeBoundary({ diagnosticOnly: false }),
  });
  const claimable = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph(),
    probeBoundary: cleanProbeBoundary({ claimable: true }),
  });

  assert.equal(missingBoundary.inspectStatus, "blocked");
  assert.deepEqual(missingBoundary.blockedReasons, ["pre-read-probe-boundary-missing"]);
  assert.equal(leakedPayload.inspectStatus, "blocked");
  assert.deepEqual(leakedPayload.blockedReasons, ["pre-read-payload-graph-leak"]);
  assert.equal(notDiagnostic.inspectStatus, "blocked");
  assert.deepEqual(notDiagnostic.blockedReasons, ["pre-read-probe-not-diagnostic-only"]);
  assert.equal(claimable.inspectStatus, "blocked");
  assert.deepEqual(claimable.blockedReasons, ["pre-read-probe-claimable"]);
});

test("React Web snapshot-aware inspect blocks malformed graph consumer shape", () => {
  const missingSchema = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph({ schemaVersion: undefined }),
    probeBoundary: cleanProbeBoundary(),
  });
  const missingCounts = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph({ selectedAnchorCount: undefined }),
    probeBoundary: cleanProbeBoundary(),
  });
  const staleBehaviorMismatch = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph({ staleBehavior: "reuse-stale" }),
    probeBoundary: cleanProbeBoundary(),
  });

  assert.equal(missingSchema.inspectStatus, "blocked");
  assert.deepEqual(missingSchema.blockedReasons, ["graph-consumer-schema-mismatch"]);
  assert.equal(missingCounts.inspectStatus, "blocked");
  assert.deepEqual(missingCounts.blockedReasons, ["graph-consumer-counts-missing"]);
  assert.equal(staleBehaviorMismatch.inspectStatus, "blocked");
  assert.deepEqual(staleBehaviorMismatch.blockedReasons, ["graph-consumer-stale-behavior-mismatch"]);
});

test("React Web snapshot-aware inspect markdown keeps non-claims explicit", () => {
  const evidence = buildReactWebSnapshotAwareInspect({
    coverageSummary: freshCoverageSummary(),
    graphConsumer: graph(),
    probeBoundary: cleanProbeBoundary(),
    file: "fixtures/compressed/FormSection.tsx",
  });
  const markdown = renderReactWebSnapshotAwareInspectMarkdown(evidence);

  assert.match(markdown, /# React Web snapshot-aware inspect/);
  assert.match(markdown, /Inspect status: ready/);
  assert.match(markdown, /Authorization: none/);
  assert.match(markdown, /Runtime\/pre-read authorization: no/);
  assert.match(markdown, /Merge gate policy change: no/);
  assert.match(markdown, /Provider token\/cost savings: no/);
  assert.match(markdown, /Broad React Web support: no/);
});

test("React Web snapshot-aware inspect CLI writes JSON and Markdown reports", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-web-snapshot-aware-inspect-"));
  const outputPath = path.join(tempDir, "inspect.json");
  const markdownPath = path.join(tempDir, "inspect.md");
  const cli = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "react-web-snapshot-aware-inspect.mjs"),
      "--run-id=cli-test",
      "--file=fixtures/compressed/FormSection.tsx",
      `--output=${outputPath}`,
      `--markdown-output=${markdownPath}`,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(fs.existsSync(markdownPath), true);
  const evidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const markdown = fs.readFileSync(markdownPath, "utf8");
  assert.equal(evidence.schemaVersion, REACT_WEB_SNAPSHOT_AWARE_INSPECT_SCHEMA_VERSION);
  assert.equal(evidence.authorization, "none");
  assert.equal(evidence.graphProbe.payloadContainsGraph, false);
  assert.match(markdown, /React Web snapshot-aware inspect/);
});
