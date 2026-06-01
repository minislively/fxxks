import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const repoRoot = process.cwd();
const {
  REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_SCHEMA_VERSION,
  evaluateReactWebSnapshotAwareConsumerGate,
} = await import(path.join(repoRoot, "dist", "core", "react-web-snapshot-aware-consumer-gate.js"));

function snapshot(overrides = {}) {
  return {
    driftStatus: "fresh",
    reasons: [],
    manifestMatched: true,
    fixtureSourceMatched: true,
    ...overrides,
  };
}

function graph(overrides = {}) {
  return {
    schemaVersion: "react-web-fact-graph-consumer-dry-run.v1",
    freshnessStatus: "fresh",
    selectedAnchorCount: 3,
    deferredAnchorCount: 1,
    maxAnchors: 4,
    staleBehavior: "defer-all",
    authorization: "none",
    advisoryOnly: true,
    ...overrides,
  };
}

function probe(overrides = {}) {
  return {
    payloadContainsGraph: false,
    diagnosticOnly: true,
    claimable: false,
    ...overrides,
  };
}

test("snapshot-aware consumer gate allows only fresh graph with safe boundary", () => {
  const gate = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph(), probeBoundary: probe() });

  assert.equal(gate.schemaVersion, REACT_WEB_SNAPSHOT_AWARE_CONSUMER_GATE_SCHEMA_VERSION);
  assert.equal(gate.status, "allowed");
  assert.equal(gate.allowed, true);
  assert.equal(gate.authorization, "none");
  assert.equal(gate.advisoryOnly, true);
  assert.equal(gate.diagnosticOnly, true);
  assert.equal(gate.claimable, false);
  assert.deepEqual(gate.blockedReasons, []);
  assert.equal(gate.wouldSelectAnchorCount, 3);
  assert.equal(gate.nonClaims.preReadPayloadGraphInjection, false);
});

test("snapshot-aware consumer gate blocks drifted, mismatched, or reason-bearing snapshots and stale graphs", () => {
  const drifted = evaluateReactWebSnapshotAwareConsumerGate({
    snapshot: snapshot({ driftStatus: "drifted", reasons: ["fixture-source-fingerprint-mismatch"] }),
    graphConsumer: graph(),
    probeBoundary: probe(),
  });
  const mismatched = evaluateReactWebSnapshotAwareConsumerGate({
    snapshot: snapshot({ manifestMatched: false, fixtureSourceMatched: false }),
    graphConsumer: graph(),
    probeBoundary: probe(),
  });
  const reasonBearing = evaluateReactWebSnapshotAwareConsumerGate({
    snapshot: snapshot({ reasons: ["fixture-source-fingerprint-mismatch"] }),
    graphConsumer: graph(),
    probeBoundary: probe(),
  });
  const staleGraph = evaluateReactWebSnapshotAwareConsumerGate({
    snapshot: snapshot(),
    graphConsumer: graph({ freshnessStatus: "stale" }),
    probeBoundary: probe(),
  });

  assert.equal(drifted.status, "blocked");
  assert.deepEqual(drifted.blockedReasons, ["snapshot-drift-not-fresh", "snapshot-reasons-present"]);
  assert.deepEqual(mismatched.blockedReasons, ["snapshot-manifest-not-matched", "snapshot-fixture-source-not-matched"]);
  assert.deepEqual(reasonBearing.blockedReasons, ["snapshot-reasons-present"]);
  assert.equal(staleGraph.status, "blocked");
  assert.deepEqual(staleGraph.blockedReasons, ["graph-consumer-not-fresh"]);
});

test("snapshot-aware consumer gate fails closed on malformed graph or widened authority", () => {
  const missingSchema = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph({ schemaVersion: undefined }), probeBoundary: probe() });
  const missingCounts = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph({ selectedAnchorCount: undefined }), probeBoundary: probe() });
  const staleBehaviorMismatch = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph({ staleBehavior: "reuse-stale" }), probeBoundary: probe() });
  const widenedAuthority = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph({ authorization: "runtime" }), probeBoundary: probe() });

  assert.deepEqual(missingSchema.blockedReasons, ["graph-consumer-schema-mismatch"]);
  assert.deepEqual(missingCounts.blockedReasons, ["graph-consumer-counts-missing"]);
  assert.deepEqual(staleBehaviorMismatch.blockedReasons, ["graph-consumer-stale-behavior-mismatch"]);
  assert.deepEqual(widenedAuthority.blockedReasons, ["graph-consumer-authority-widened"]);
});

test("snapshot-aware consumer gate blocks probe boundary violations and unavailable graph", () => {
  const missingProbe = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph() });
  const leaked = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph(), probeBoundary: probe({ payloadContainsGraph: true }) });
  const notDiagnostic = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph(), probeBoundary: probe({ diagnosticOnly: false }) });
  const claimable = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph(), probeBoundary: probe({ claimable: true }) });
  const missingGraph = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: null, probeBoundary: probe() });
  const noAnchors = evaluateReactWebSnapshotAwareConsumerGate({ snapshot: snapshot(), graphConsumer: graph({ selectedAnchorCount: 0 }), probeBoundary: probe() });

  assert.deepEqual(missingProbe.blockedReasons, ["pre-read-probe-boundary-missing"]);
  assert.deepEqual(leaked.blockedReasons, ["pre-read-payload-graph-leak"]);
  assert.deepEqual(notDiagnostic.blockedReasons, ["pre-read-probe-not-diagnostic-only"]);
  assert.deepEqual(claimable.blockedReasons, ["pre-read-probe-claimable"]);
  assert.equal(missingGraph.status, "unavailable");
  assert.deepEqual(missingGraph.blockedReasons, ["graph-consumer-unavailable"]);
  assert.equal(noAnchors.status, "unavailable");
  assert.deepEqual(noAnchors.blockedReasons, ["no-anchors-selected"]);
});
