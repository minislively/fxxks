import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  RN_STAGED_SLOT_FIXTURES,
  buildReactNativePayloadEvidence,
} from "../scripts/react-native-payload-evidence.mjs";

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", "manifest.json");
const docsFixtureExpectationsPath = path.join(repoRoot, "docs", "frontend-domain-fixture-expectations.md");
const docsBoundaryMapPath = path.join(repoRoot, "docs", "frontend-fixture-boundary-regression-map.md");

const SLOT_EXPECTATIONS = [
  {
    slot: "F1",
    id: "rn-primitive-basic",
    manifestLane: "rn-primitive",
    scriptLane: "RN primitive/input",
    boundary: "measured narrow payload",
    preReadExpectedOutcome: "payload",
    payloadPolicy: "rn-primitive-input-narrow-payload",
    evidenceScope: "rn-primitive-input-narrow-payload-only",
    fixturePath: "test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx",
  },
  {
    slot: "F13",
    id: "rn-primitive-inline-action",
    manifestLane: "rn-primitive",
    scriptLane: "RN primitive/input adjacent",
    boundary: "measured narrow payload",
    preReadExpectedOutcome: "payload",
    payloadPolicy: "rn-primitive-input-narrow-payload",
    evidenceScope: "rn-primitive-input-narrow-payload-only",
    fixturePath: "test/fixtures/frontend-domain-expectations/rn-primitive-inline-action.tsx",
  },
  {
    slot: "F2",
    id: "rn-style-platform-navigation",
    manifestLane: "rn-style-platform",
    scriptLane: "RN style/platform/navigation",
    boundary: "readiness evidence only",
    preReadExpectedOutcome: "fallback",
    payloadPolicy: null,
    evidenceScope: "rn-component-semantics-readiness-only",
    fixturePath: "test/fixtures/frontend-domain-expectations/rn-style-platform-navigation.tsx",
  },
  {
    slot: "F9",
    id: "rn-interaction-gesture",
    manifestLane: "rn-interaction",
    scriptLane: "RN interaction/list",
    boundary: "readiness evidence only",
    preReadExpectedOutcome: "fallback",
    payloadPolicy: null,
    evidenceScope: "rn-component-semantics-readiness-only",
    fixturePath: "test/fixtures/frontend-domain-expectations/rn-interaction-gesture.tsx",
  },
  {
    slot: "F10",
    id: "rn-image-scrollview",
    manifestLane: "rn-image-scrollview",
    scriptLane: "RN media/layout",
    boundary: "readiness evidence only",
    preReadExpectedOutcome: "fallback",
    payloadPolicy: null,
    evidenceScope: "rn-component-semantics-readiness-only",
    fixturePath: "test/fixtures/frontend-domain-expectations/rn-image-scrollview.tsx",
  },
];

function readManifestSelected() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")).selected;
}

test("RN staged slot fixtures keep the audited slot order and boundary labels", () => {
  assert.deepEqual(
    RN_STAGED_SLOT_FIXTURES.map((row) => row.slot),
    SLOT_EXPECTATIONS.map((row) => row.slot),
  );

  for (const expected of SLOT_EXPECTATIONS) {
    const actual = RN_STAGED_SLOT_FIXTURES.find((row) => row.slot === expected.slot);
    assert.ok(actual, expected.slot);
    assert.equal(actual.lane, expected.scriptLane, expected.slot);
    assert.equal(actual.boundary, expected.boundary, expected.slot);
    assert.equal(actual.relativeFile, expected.fixturePath, expected.slot);
  }
});

test("RN selected manifest slots keep payload-vs-readiness taxonomy aligned", () => {
  const selected = new Map(readManifestSelected().map((row) => [row.slot, row]));
  assert.deepEqual(
    SLOT_EXPECTATIONS.map((row) => row.slot),
    SLOT_EXPECTATIONS.map((row) => selected.get(row.slot)?.slot),
  );

  for (const expected of SLOT_EXPECTATIONS) {
    const row = selected.get(expected.slot);
    assert.ok(row, expected.slot);
    assert.equal(row.id, expected.id, expected.slot);
    assert.equal(row.lane, expected.manifestLane, expected.slot);
    assert.equal(row.path, expected.fixturePath, expected.slot);
    assert.equal(row.preReadExpectedOutcome, expected.preReadExpectedOutcome, expected.slot);
    assert.equal(row.supportClaim, "none", expected.slot);
    assert.equal(row.evidenceScope, expected.evidenceScope, expected.slot);
    if (expected.payloadPolicy) {
      assert.equal(row.payloadPolicy, expected.payloadPolicy, expected.slot);
    } else {
      assert.equal("payloadPolicy" in row, false, expected.slot);
      assert.equal(row.preReadExpectedReason, "unsupported-frontend-domain-profile", expected.slot);
    }
  }
});

test("RN fixture expectation docs keep the same slot taxonomy story", () => {
  const docs = fs.readFileSync(docsFixtureExpectationsPath, "utf8");

  assert.match(docs, /`F1` and `F13` are the only selected RN primitive\/input narrow payload candidates/i);
  assert.match(docs, /`F2`, `F9`, and `F10` remain fallback\/readiness-only/i);
  assert.match(docs, /\| F1 \| `rn-primitive-basic` \| `rn-primitive` \|[\s\S]*pre-read `payload` only through `rn-primitive-input-narrow-payload`/);
  assert.match(docs, /\| F13 \| `rn-primitive-inline-action` \| `rn-primitive` \|[\s\S]*pre-read `payload` only through `rn-primitive-input-narrow-payload`/);
  assert.match(docs, /\| F2 \| `rn-style-platform-navigation` \| `rn-style-platform` \|[\s\S]*pre-read `fallback` with `unsupported-frontend-domain-profile`/);
  assert.match(docs, /\| F9 \| `rn-interaction-gesture` \| `rn-interaction` \|[\s\S]*pre-read `fallback` with `unsupported-frontend-domain-profile`/);
  assert.match(docs, /\| F10 \| `rn-image-scrollview` \| `rn-image-scrollview` \|[\s\S]*pre-read `fallback` with `unsupported-frontend-domain-profile`/);
});

test("RN boundary regression map keeps the expected slot labels", () => {
  const docs = fs.readFileSync(docsBoundaryMapPath, "utf8");

  assert.match(docs, /\| `F1` \| RN primitive\/input \| measured narrow payload \|/);
  assert.match(docs, /\| `F13` \| RN primitive\/input adjacent \| measured narrow payload \|/);
  assert.match(docs, /\| `F2` \| RN style\/platform\/navigation \| readiness evidence only \|/);
  assert.match(docs, /\| `F9` \| RN interaction\/list \| readiness evidence only \|/);
  assert.match(docs, /\| `F10` \| RN media\/layout \| readiness evidence only \|/);
  assert.match(docs, /Keep only RN slots `F1` and `F13` on `payloadPolicy: "rn-primitive-input-narrow-payload"`/);
});

test("RN payload evidence staged inventory stays aligned with the audited slot contract", async () => {
  const evidence = await buildReactNativePayloadEvidence({ runId: `taxonomy-audit-${Date.now()}` });
  const stagedSlots = evidence.summary.stagedRnSurfaceInventory.stagedSlots;
  const stagedBySlot = new Map(stagedSlots.map((row) => [row.slot, row]));

  assert.deepEqual(
    stagedSlots.map((row) => row.slot),
    SLOT_EXPECTATIONS.map((row) => row.slot),
  );

  for (const expected of SLOT_EXPECTATIONS) {
    const row = stagedBySlot.get(expected.slot);
    assert.ok(row, expected.slot);
    assert.equal(row.file, expected.fixturePath, expected.slot);
    assert.equal(row.boundary, expected.boundary, expected.slot);
    assert.equal(row.preReadDecision, expected.preReadExpectedOutcome, expected.slot);
    assert.equal(row.sourceOnly, true, expected.slot);
    assert.equal(row.broadSupportClaimable, false, expected.slot);
    if (expected.preReadExpectedOutcome === "payload") {
      assert.equal(row.preReadExpectation, expected.payloadPolicy, expected.slot);
      assert.equal(row.claimBoundary, "rn-primitive-input-narrow-payload-only", expected.slot);
    } else {
      assert.equal(row.preReadExpectation, "unsupported-frontend-domain-profile", expected.slot);
    }
  }
});
