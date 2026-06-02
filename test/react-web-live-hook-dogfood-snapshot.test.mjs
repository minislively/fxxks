import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const {
  buildReactWebRuntimeSnapshotGateInput,
} = await import(path.join(repoRoot, "dist", "core", "react-web-live-hook-dogfood-snapshot.js"));

test("runtime snapshot gate input is fresh for current dogfood snapshot", () => {
  const snapshot = buildReactWebRuntimeSnapshotGateInput({ repoRoot });

  assert.equal(snapshot.driftStatus, "fresh");
  assert.deepEqual(snapshot.reasons, []);
  assert.equal(snapshot.manifestMatched, true);
  assert.equal(snapshot.fixtureSourceMatched, true);
});

test("runtime snapshot gate input fails closed when baseline is missing", () => {
  const tempSnapshotPath = path.join(".tmp-react-web-missing-snapshot", `missing-${Date.now()}.json`);
  fs.rmSync(path.join(repoRoot, ".tmp-react-web-missing-snapshot"), { recursive: true, force: true });
  const snapshot = buildReactWebRuntimeSnapshotGateInput({ repoRoot, snapshotPath: tempSnapshotPath });

  assert.equal(snapshot.driftStatus, "missing-baseline");
  assert.deepEqual(snapshot.reasons, ["snapshot-baseline-missing"]);
  assert.equal(snapshot.manifestMatched, false);
  assert.equal(snapshot.fixtureSourceMatched, false);
});
