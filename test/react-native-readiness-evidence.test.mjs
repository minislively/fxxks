import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildReactNativeReadinessEvidence,
  RN_READINESS_SLOT_ORDER,
  renderReactNativeReadinessEvidenceMarkdown,
} from "../scripts/react-native-readiness-evidence.mjs";

const repoRoot = process.cwd();
let evidencePromise;

function getEvidence() {
  evidencePromise ??= buildReactNativeReadinessEvidence({ runId: `test-${Date.now()}-${Math.random()}` });
  return evidencePromise;
}

test("React Native readiness evidence emits the approved slot map without widening RN claims", async () => {
  const evidence = await getEvidence();

  assert.equal(evidence.schemaVersion, "react-native-readiness-evidence.v1");
  assert.equal(evidence.profile, "react-native");
  assert.equal(evidence.measurement, "aggregated-react-native-readiness-evidence-lane");
  assert.match(evidence.claimBoundary, /Aggregated local React Native readiness evidence only/);
  assert.match(evidence.claimBoundary, /not broad React Native support/);
  assert.match(evidence.claimBoundary, /not runtime correctness/);

  assert.equal(evidence.summary.slotCount, 7);
  assert.deepEqual(evidence.slots.map((row) => row.slot), RN_READINESS_SLOT_ORDER);
  assert.deepEqual(evidence.summary.payloadCapableSlots, ["F1", "F13", "F14", "F15"]);
  assert.deepEqual(evidence.summary.readinessOnlySlots, ["F2", "F9", "F10"]);
  assert.deepEqual(evidence.claimability, {
    broadReactNativeSupport: false,
    runtimeCorrectness: false,
    providerBillingSavings: false,
  });
  assert.equal(evidence.summary.childArtifact.schemaVersion, "react-native-payload-evidence.v4");
  assert.equal(evidence.summary.childArtifact.stagedSlotCount, 7);

  const bySlot = new Map(evidence.slots.map((row) => [row.slot, row]));
  assert.deepEqual(bySlot.get("F1"), {
    slot: "F1",
    id: "rn-primitive-basic",
    surface: "RN primitive/input",
    outcome: "payload",
    policy: "rn-primitive-input-narrow-payload",
    claim: "narrow measured evidence only",
    supportClaim: "none",
    evidenceScope: "rn-primitive-input-narrow-payload-only",
    fixture: "test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx",
  });
  assert.deepEqual(bySlot.get("F13"), {
    slot: "F13",
    id: "rn-primitive-inline-action",
    surface: "RN primitive/input adjacent",
    outcome: "payload",
    policy: "rn-primitive-input-narrow-payload",
    claim: "narrow measured evidence only",
    supportClaim: "none",
    evidenceScope: "rn-primitive-input-narrow-payload-only",
    fixture: "test/fixtures/frontend-domain-expectations/rn-primitive-inline-action.tsx",
  });
  assert.deepEqual(bySlot.get("F14"), {
    slot: "F14",
    id: "rn-accessibility-test-anchor",
    surface: "RN primitive/input accessibility adjacent",
    outcome: "payload",
    policy: "rn-primitive-input-narrow-payload",
    claim: "narrow measured evidence only",
    supportClaim: "none",
    evidenceScope: "rn-primitive-input-narrow-payload-only",
    fixture: "test/fixtures/frontend-domain-expectations/rn-accessibility-test-anchor.tsx",
  });
  assert.deepEqual(bySlot.get("F15"), {
    slot: "F15",
    id: "rn-state-action-adjacent",
    surface: "RN primitive/input state-action adjacent",
    outcome: "payload",
    policy: "rn-primitive-input-narrow-payload",
    claim: "narrow measured evidence only",
    supportClaim: "none",
    evidenceScope: "rn-primitive-input-narrow-payload-only",
    fixture: "test/fixtures/frontend-domain-expectations/rn-state-action-concern.tsx",
  });
  assert.equal(bySlot.get("F2").outcome, "fallback");
  assert.equal(bySlot.get("F2").policy, "source-only-readiness");
  assert.equal(bySlot.get("F2").fallbackReason, "unsupported-frontend-domain-profile");
  assert.deepEqual(bySlot.get("F2").blockers, [
    "no runtime navigation correctness evidence",
    "must not imply broad RN support",
  ]);
  assert.equal(bySlot.get("F9").fallbackReason, "unsupported-frontend-domain-profile");
  assert.deepEqual(bySlot.get("F9").blockers, [
    "no gesture or list virtualization correctness evidence",
    "must not imply broad RN support",
  ]);
  assert.equal(bySlot.get("F10").fallbackReason, "unsupported-frontend-domain-profile");
  assert.deepEqual(bySlot.get("F10").blockers, [
    "no image or layout correctness evidence",
    "must not imply broad RN support",
  ]);
});

test("React Native readiness evidence markdown keeps non-claims explicit", async () => {
  const evidence = await getEvidence();
  const markdown = renderReactNativeReadinessEvidenceMarkdown(evidence);

  assert.match(markdown, /# React Native readiness evidence/);
  assert.match(markdown, /Profile: react-native/);
  assert.match(markdown, /Slot count: 7/);
  assert.match(markdown, /Payload-capable slots: F1, F13, F14, F15/);
  assert.match(markdown, /Readiness-only slots: F2, F9, F10/);
  assert.match(markdown, /Broad React Native support claimable: no/);
  assert.match(markdown, /Runtime correctness claimable: no/);
  assert.match(markdown, /Provider billing savings claimable: no/);
  assert.match(markdown, /\| F2 \| rn-style-platform-navigation \| RN style\/platform\/navigation \| fallback \| source-only-readiness \| unsupported-frontend-domain-profile \| no runtime navigation correctness evidence; must not imply broad RN support \|/);
  assert.doesNotMatch(markdown, /Broad React Native support claimable: yes/i);
  assert.doesNotMatch(markdown, /Runtime correctness claimable: yes/i);
});

test("React Native readiness evidence command writes bounded JSON and Markdown reports", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-react-native-readiness-evidence-"));
  const outputPath = path.join(tempDir, "react-native-readiness-evidence.json");
  const markdownPath = path.join(tempDir, "react-native-readiness-evidence.md");

  const cli = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "react-native-readiness-evidence.mjs"),
      "--run-id=cli-test",
      `--output=${outputPath}`,
      `--markdown-output=${markdownPath}`,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(fs.existsSync(markdownPath), true);

  const stdoutEvidence = JSON.parse(cli.stdout);
  const fileEvidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const markdown = fs.readFileSync(markdownPath, "utf8");

  assert.equal(stdoutEvidence.runId, "cli-test");
  assert.equal(stdoutEvidence.profile, "react-native");
  assert.deepEqual(fileEvidence, stdoutEvidence);
  assert.match(markdown, /# React Native readiness evidence/);
  assert.match(markdown, /Payload-capable slots: F1, F13, F14, F15/);
});
