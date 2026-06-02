import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const REACT_WEB_FIELD_ARRAY_DOGFOOD_SCHEMA_VERSION = "react-web-field-array-dogfood-evidence.v1";
export const DEFAULT_FIELD_ARRAY_FIXTURE = "test/fixtures/react-web-context-expansion/field-array-contacts-form.tsx";

async function loadBuiltIndex(repoRoot) {
  return import(path.join(repoRoot, "dist", "index.js"));
}

function selectedUseFieldArrayPatchTarget(dryRun) {
  return dryRun.selectedAnchors.some(
    (anchor) => anchor.kind === "patch-target:validation-anchor" && anchor.label === "useFieldArray",
  );
}

function selectedDynamicFieldRole(dryRun) {
  return dryRun.selectedAnchors.some(
    (anchor) => anchor.kind === "form-state-role:dynamic-fields" && /useFieldArray/.test(anchor.label),
  );
}

function dynamicFieldRoleCoverage(dryRun) {
  return dryRun.formStateRoleCoverage.find((item) => item.role === "dynamic-fields") ?? null;
}

function anchorSnapshot(dryRun) {
  return dryRun.selectedAnchors.map((anchor) => ({
    rank: anchor.rank,
    anchorType: anchor.anchorType,
    kind: anchor.kind,
    label: anchor.label,
    priority: anchor.priority,
    confidence: anchor.confidence,
  }));
}

function deferredRoleSnapshot(dryRun) {
  return dryRun.deferredAnchors
    .filter((anchor) => anchor.kind.startsWith("form-state-role:"))
    .map((anchor) => ({
      rank: anchor.rank,
      kind: anchor.kind,
      label: anchor.label,
      priority: anchor.priority,
      deferredReason: anchor.deferredReason,
    }));
}

function decidePriorityAction(defaultRun, wideRun) {
  const defaultPatchTargetSelected = selectedUseFieldArrayPatchTarget(defaultRun);
  const widePatchTargetSelected = selectedUseFieldArrayPatchTarget(wideRun);
  const defaultRole = dynamicFieldRoleCoverage(defaultRun);
  const wideRole = dynamicFieldRoleCoverage(wideRun);

  if (!defaultPatchTargetSelected && !widePatchTargetSelected) {
    return {
      verdict: "promote-or-fix-required",
      reason: "useFieldArray patch-target evidence is not selected even under a wider anchor budget",
      nextAction: "fix extraction or raise useFieldArray patch-target visibility before changing role priority",
    };
  }

  if (!defaultPatchTargetSelected && widePatchTargetSelected) {
    return {
      verdict: "defer-promotion-pending-task-outcome",
      reason: "default consumer budget does not select useFieldArray patch-target evidence, but a wider inspection budget does; this shows a budget pressure risk, not proof that role-priority promotion improves edits",
      nextAction: "run task-outcome dogfood for a field-array edit before promoting dynamic-fields or useFieldArray priority",
    };
  }

  if (defaultPatchTargetSelected && defaultRole?.status === "selected") {
    return {
      verdict: "promotion-not-needed",
      reason: "default consumer budget already selects both useFieldArray patch-target and dynamic-fields role evidence",
      nextAction: "keep current priority and gather task-outcome evidence only if failures appear",
    };
  }

  if (defaultPatchTargetSelected && wideRole?.status === "deferred") {
    return {
      verdict: "defer-promotion-pending-task-outcome",
      reason: "useFieldArray patch-target evidence is selected, while dynamic-fields role remains budget-deferred even in the inspected wide budget; this is a measurement signal, not proof that priority promotion improves edits",
      nextAction: "run task-outcome dogfood before promoting dynamic-fields priority",
    };
  }

  return {
    verdict: "defer-promotion-pending-task-outcome",
    reason: "useFieldArray patch-target evidence is selected, and role coverage is now observable; no task-outcome miss has been shown yet",
    nextAction: "keep role coverage diagnostic-only until a dogfood edit task demonstrates missed dynamic-field semantics",
  };
}

export async function buildReactWebFieldArrayDogfoodEvidence({
  repoRoot = defaultRepoRoot,
  fixture = DEFAULT_FIELD_ARRAY_FIXTURE,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const { buildReactWebFactGraphConsumerDryRun } = await loadBuiltIndex(repoRoot);
  const absoluteFixture = path.join(repoRoot, fixture);
  const source = fs.readFileSync(absoluteFixture, "utf8");
  const defaultDryRun = buildReactWebFactGraphConsumerDryRun(absoluteFixture, repoRoot);
  const wideDryRun = buildReactWebFactGraphConsumerDryRun(absoluteFixture, repoRoot, { maxAnchors: 20 });
  const priorityDecision = decidePriorityAction(defaultDryRun, wideDryRun);

  return {
    schemaVersion: REACT_WEB_FIELD_ARRAY_DOGFOOD_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    runId,
    measurement: "react-web-field-array-consumer-priority-dogfood",
    fixture,
    claimBoundary:
      "Local diagnostic dogfood evidence only: checks whether React Web fact graph consumer dry-run exposes useFieldArray patch-target and dynamic-fields role coverage. It is not task-success evidence, not runtime authorization, not token/cost/billing proof, and not a claim that priority promotion improves model edits.",
    source: {
      byteLength: Buffer.byteLength(source, "utf8"),
      containsUseFieldArray: /\buseFieldArray\b/.test(source),
      containsFieldsMap: /\bfields\.map\s*\(/.test(source),
      containsAppendOrRemove: /\b(?:append|remove)\s*\(/.test(source),
    },
    defaultBudget: {
      maxAnchors: defaultDryRun.selectionPolicy.maxAnchors,
      selectedAnchorCount: defaultDryRun.selectedAnchors.length,
      deferredAnchorCount: defaultDryRun.deferredAnchors.length,
      useFieldArrayPatchTargetSelected: selectedUseFieldArrayPatchTarget(defaultDryRun),
      dynamicFieldsRoleSelected: selectedDynamicFieldRole(defaultDryRun),
      dynamicFieldsRoleCoverage: dynamicFieldRoleCoverage(defaultDryRun),
      selectedAnchors: anchorSnapshot(defaultDryRun),
      deferredFormStateRoles: deferredRoleSnapshot(defaultDryRun),
    },
    wideBudget: {
      maxAnchors: wideDryRun.selectionPolicy.maxAnchors,
      selectedAnchorCount: wideDryRun.selectedAnchors.length,
      deferredAnchorCount: wideDryRun.deferredAnchors.length,
      useFieldArrayPatchTargetSelected: selectedUseFieldArrayPatchTarget(wideDryRun),
      dynamicFieldsRoleSelected: selectedDynamicFieldRole(wideDryRun),
      dynamicFieldsRoleCoverage: dynamicFieldRoleCoverage(wideDryRun),
      selectedAnchors: anchorSnapshot(wideDryRun),
      deferredFormStateRoles: deferredRoleSnapshot(wideDryRun),
    },
    priorityDecision,
  };
}

export function renderReactWebFieldArrayDogfoodMarkdown(evidence) {
  const role = evidence.defaultBudget.dynamicFieldsRoleCoverage;
  const wideRole = evidence.wideBudget.dynamicFieldsRoleCoverage;
  const defaultAnchors = evidence.defaultBudget.selectedAnchors
    .slice(0, 12)
    .map((anchor) => `- #${anchor.rank} ${anchor.kind}: ${anchor.label} (priority=${anchor.priority})`)
    .join("\n");
  const deferredRoles = evidence.wideBudget.deferredFormStateRoles.length > 0
    ? evidence.wideBudget.deferredFormStateRoles
      .map((anchor) => `- #${anchor.rank} ${anchor.kind}: ${anchor.label}; reason=${anchor.deferredReason}`)
      .join("\n")
    : "- none";

  return `# React Web field-array dogfood priority evidence\n\n${evidence.claimBoundary}\n\n## Fixture\n\n- Fixture: \`${evidence.fixture}\`\n- Contains useFieldArray: ${evidence.source.containsUseFieldArray ? "yes" : "no"}\n- Contains fields.map: ${evidence.source.containsFieldsMap ? "yes" : "no"}\n- Contains append/remove: ${evidence.source.containsAppendOrRemove ? "yes" : "no"}\n\n## Default consumer budget\n\n- maxAnchors: ${evidence.defaultBudget.maxAnchors}\n- selected/deferred: ${evidence.defaultBudget.selectedAnchorCount}/${evidence.defaultBudget.deferredAnchorCount}\n- useFieldArray patch-target selected: ${evidence.defaultBudget.useFieldArrayPatchTargetSelected ? "yes" : "no"}\n- dynamic-fields role selected: ${evidence.defaultBudget.dynamicFieldsRoleSelected ? "yes" : "no"}\n- dynamic-fields role coverage: ${role ? `${role.status}; selected=${role.selectedCount}; deferred=${role.deferredCount}; reasons=${role.reasons.join(", ")}` : "missing"}\n\n## Wide inspection budget\n\n- maxAnchors: ${evidence.wideBudget.maxAnchors}\n- selected/deferred: ${evidence.wideBudget.selectedAnchorCount}/${evidence.wideBudget.deferredAnchorCount}\n- useFieldArray patch-target selected: ${evidence.wideBudget.useFieldArrayPatchTargetSelected ? "yes" : "no"}\n- dynamic-fields role selected: ${evidence.wideBudget.dynamicFieldsRoleSelected ? "yes" : "no"}\n- dynamic-fields role coverage: ${wideRole ? `${wideRole.status}; selected=${wideRole.selectedCount}; deferred=${wideRole.deferredCount}; reasons=${wideRole.reasons.join(", ")}` : "missing"}\n\n## Priority decision\n\n- Verdict: ${evidence.priorityDecision.verdict}\n- Reason: ${evidence.priorityDecision.reason}\n- Next action: ${evidence.priorityDecision.nextAction}\n\n## Selected anchors sample\n\n${defaultAnchors}\n\n## Deferred form-state role anchors under wide budget\n\n${deferredRoles}\n\n## Boundary\n\nThis artifact decides whether priority promotion is justified by consumer visibility evidence only. It does not prove model edit success.\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture="))?.slice("--fixture=".length);
  const evidence = await buildReactWebFieldArrayDogfoodEvidence({ repoRoot: defaultRepoRoot, runId, fixture: fixtureArg ?? DEFAULT_FIELD_ARRAY_FIXTURE });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebFieldArrayDogfoodMarkdown(evidence));
  }
  if (!outputArg && !markdownArg) {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }
}
