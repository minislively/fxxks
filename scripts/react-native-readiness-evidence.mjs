import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReactNativePayloadEvidence,
  RN_STAGED_SLOT_FIXTURES,
} from "./react-native-payload-evidence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const RN_READINESS_SLOT_ORDER = ["F1", "F13", "F14", "F15", "F2", "F9", "F10"];

function readSelectedManifestRows(repoRoot) {
  const manifestPath = path.join(repoRoot, "test", "fixtures", "frontend-domain-expectations", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return new Map(manifest.selected.map((row) => [row.slot, row]));
}

function blockersForReadinessSlot(slot) {
  switch (slot) {
    case "F2":
      return [
        "no runtime navigation correctness evidence",
        "must not imply broad RN support",
      ];
    case "F9":
      return [
        "no gesture or list virtualization correctness evidence",
        "must not imply broad RN support",
      ];
    case "F10":
      return [
        "no image or layout correctness evidence",
        "must not imply broad RN support",
      ];
    default:
      return [];
  }
}

export async function buildReactNativeReadinessEvidence({
  repoRoot = defaultRepoRoot,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const payloadEvidence = await buildReactNativePayloadEvidence({ repoRoot, runId: `${runId}-payload-evidence` });
  const manifestBySlot = readSelectedManifestRows(repoRoot);
  const stagedBySlot = new Map(payloadEvidence.summary.stagedRnSurfaceInventory.stagedSlots.map((row) => [row.slot, row]));
  const slotSurfaceBySlot = new Map(RN_STAGED_SLOT_FIXTURES.map((row) => [row.slot, row.lane]));

  const slots = RN_READINESS_SLOT_ORDER.map((slot) => {
    const manifest = manifestBySlot.get(slot);
    const staged = stagedBySlot.get(slot);
    const surface = slotSurfaceBySlot.get(slot);
    const payloadCapable = manifest?.preReadExpectedOutcome === "payload";

    if (payloadCapable) {
      return {
        slot,
        id: manifest.id,
        surface,
        outcome: "payload",
        policy: manifest.payloadPolicy,
        claim: "narrow measured evidence only",
        supportClaim: manifest.supportClaim,
        evidenceScope: manifest.evidenceScope,
        fixture: manifest.path,
      };
    }

    return {
      slot,
      id: manifest?.id ?? null,
      surface,
      outcome: "fallback",
      policy: "source-only-readiness",
      supportClaim: manifest?.supportClaim ?? "none",
      evidenceScope: manifest?.evidenceScope ?? "rn-component-semantics-readiness-only",
      fixture: manifest?.path ?? staged?.file ?? null,
      fallbackReason: staged?.preReadExpectation ?? manifest?.preReadExpectedReason ?? null,
      blockers: blockersForReadinessSlot(slot),
    };
  });

  return {
    schemaVersion: "react-native-readiness-evidence.v1",
    generatedAt: new Date().toISOString(),
    runId,
    profile: "react-native",
    measurement: "aggregated-react-native-readiness-evidence-lane",
    claimBoundary:
      "Aggregated local React Native readiness evidence only: summarizes the current merged RN slot contract without widening payload policy, runtime behavior, or support claims. This is not broad React Native support, not runtime correctness, not device execution proof, and not provider billing or cost evidence.",
    slots,
    summary: {
      slotCount: slots.length,
      payloadCapableSlots: slots.filter((row) => row.outcome === "payload").map((row) => row.slot),
      readinessOnlySlots: slots.filter((row) => row.outcome !== "payload").map((row) => row.slot),
      childArtifact: {
        schemaVersion: payloadEvidence.schemaVersion,
        stagedSlotCount: payloadEvidence.summary.stagedRnSurfaceInventory.stagedSlots.length,
      },
    },
    claimability: {
      broadReactNativeSupport: false,
      runtimeCorrectness: false,
      providerBillingSavings: false,
    },
  };
}

export function renderReactNativeReadinessEvidenceMarkdown(evidence) {
  const slotRows = evidence.slots
    .map((row) => {
      const blockerText = Array.isArray(row.blockers) && row.blockers.length > 0 ? row.blockers.join("; ") : row.claim;
      const fallbackReason = row.fallbackReason ?? row.policy;
      return `| ${row.slot} | ${row.id} | ${row.surface} | ${row.outcome} | ${row.policy} | ${fallbackReason} | ${blockerText} |`;
    })
    .join("\n");

  return `# React Native readiness evidence\n\n${evidence.claimBoundary}\n\n## Summary\n\n- Profile: ${evidence.profile}\n- Slot count: ${evidence.summary.slotCount}\n- Payload-capable slots: ${evidence.summary.payloadCapableSlots.join(", ")}\n- Readiness-only slots: ${evidence.summary.readinessOnlySlots.join(", ")}\n- Broad React Native support claimable: ${evidence.claimability.broadReactNativeSupport ? "yes" : "no"}\n- Runtime correctness claimable: ${evidence.claimability.runtimeCorrectness ? "yes" : "no"}\n- Provider billing savings claimable: ${evidence.claimability.providerBillingSavings ? "yes" : "no"}\n\n## Slot readiness map\n\n| Slot | ID | Surface | Outcome | Policy | Fallback / claim anchor | Boundary note |\n| --- | --- | --- | --- | --- | --- | --- |\n${slotRows}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const evidence = await buildReactNativeReadinessEvidence({ repoRoot: defaultRepoRoot, runId });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }

  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactNativeReadinessEvidenceMarkdown(evidence));
  }

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}
