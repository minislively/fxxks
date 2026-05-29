import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { cleanupMetricSessions } from "./metric-cleanup.mjs";
import {
  reactWebA11yAnchorSource,
  reactWebComponentApiSource,
  reactWebFormStateFlowSource,
  reactWebFormStateRolesSource,
  reactWebLayoutRegionSource,
  reactWebStylingVariantSource,
  reactWebImportRoleSource,
} from "./react-web-inline-sources.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const { handleCodexRuntimeHook, summarizeRuntimeReactWebFactGraphDryRun } = await import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
const {
  CUSTOM_WRAPPER_DOM_SIGNAL_GAP,
  REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
  REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY,
  RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
  UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  WEBVIEW_BOUNDARY_FALLBACK_POLICY,
  decidePreRead,
} = await import(path.join(repoRoot, "dist", "adapters", "pre-read.js"));
const {
  CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS,
  handleClaudeRuntimeHook,
} = await import(path.join(repoRoot, "dist", "adapters", "claude-runtime-hook.js"));
const { readSessionMetricSummary } = await import(path.join(repoRoot, "dist", "core", "session-metrics.js"));

function cleanupRuntimeSessions(repoRoot, runtime, prefixes) {
  const root = path.join(repoRoot, ".fooks", "state", runtime);
  if (!fs.existsSync(root)) {
    return;
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && prefixes.some((prefix) => entry.name.startsWith(prefix))) {
      fs.rmSync(path.join(root, entry.name), { force: true });
    }
  }

  if (fs.readdirSync(root).length === 0) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test.after(async () => {
  await cleanupMetricSessions(repoRoot, ["bridge-contract-"]);
  cleanupRuntimeSessions(repoRoot, "codex-runtime", ["bridge-contract-"]);
  cleanupRuntimeSessions(repoRoot, "claude-runtime", ["bridge-contract-claude-"]);
});

function graphDryRunFixture(overrides = {}) {
  return {
    inScope: true,
    graphSummary: {
      freshnessStatus: "fresh",
    },
    selectedAnchors: [{ rank: 1 }],
    deferredAnchors: [],
    ...overrides,
  };
}

test("runtime graph packing reasons cover every canonical omission and success state", () => {
  assert.equal(summarizeRuntimeReactWebFactGraphDryRun(graphDryRunFixture()).reason, "fresh-anchors-packed");
  assert.equal(
    summarizeRuntimeReactWebFactGraphDryRun(graphDryRunFixture({ graphSummary: { freshnessStatus: "stale" }, selectedAnchors: [], deferredAnchors: [{ rank: 1 }] })).reason,
    "freshness-not-fresh",
  );
  assert.equal(
    summarizeRuntimeReactWebFactGraphDryRun(graphDryRunFixture({ graphSummary: { freshnessStatus: "unknown" }, selectedAnchors: [], deferredAnchors: [{ rank: 1 }] })).reason,
    "freshness-not-fresh",
  );
  assert.equal(summarizeRuntimeReactWebFactGraphDryRun(graphDryRunFixture({ selectedAnchors: [] })).reason, "no-anchors-selected");
  assert.equal(summarizeRuntimeReactWebFactGraphDryRun(graphDryRunFixture({ inScope: false, selectedAnchors: [] })).reason, "out-of-scope");
  assert.equal(summarizeRuntimeReactWebFactGraphDryRun(graphDryRunFixture(), { budgetExceeded: true }).reason, "budget-exceeded");
  assert.equal(
    summarizeRuntimeReactWebFactGraphDryRun(graphDryRunFixture(), { sourceRelativeBudgetExceeded: true }).reason,
    "source-relative-budget-exceeded",
  );
});

test("runtime bridge contract keeps repeated-read inject and fallback semantics stable", () => {
  const injectSession = `bridge-contract-inject-${Date.now()}`;
  const start = handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: injectSession }, repoRoot);
  assert.match(start.statePath, /\.fooks\/state\/codex-runtime/);

  const firstInject = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: injectSession,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  const secondInject = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: injectSession,
      prompt: "Again, update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );

  assert.equal(firstInject.action, "record");
  assert.equal(secondInject.action, "inject");
  assert.equal(secondInject.debug.decision.payload.domainPayload.domain, "react-web");
  assert.equal(secondInject.contextModeReason, "repeated-exact-file-edit-guidance");
  assert.match(secondInject.additionalContext, /candidate: react-web-edit-card\.v1/);
  assert.doesNotMatch(secondInject.additionalContext, /domainPayload/);
  assert.doesNotMatch(secondInject.additionalContext, /editGuidance/);
  assert.ok(secondInject.reasons.includes("edit-guidance-opt-in"));
  assert.deepEqual(secondInject.debug.decision.payload.editGuidance.freshness, secondInject.debug.decision.payload.sourceFingerprint);
  assert.equal(secondInject.debug.decision.payload.reactWebContext.schemaVersion, "react-web-context.v0");
  assert.equal(secondInject.debug.decision.debug.reactWebContextBudget.included, true);
  assert.equal(secondInject.debug.additionalContextAdmission.admitted, true);
  assert.equal(secondInject.debug.additionalContextAdmission.reason, "admitted");
  assert.equal(secondInject.debug.additionalContextAdmission.candidateKind, "react-web-edit-card.v1");
  assert.ok(secondInject.debug.additionalContextAdmission.candidateBytes < secondInject.debug.additionalContextAdmission.sourceBytes);
  assert.ok(secondInject.debug.additionalContextAdmission.reductionPct >= secondInject.debug.additionalContextAdmission.minReductionPct);
  assert.equal(secondInject.debug.reactWebFactGraphPacking.included, true);
  assert.equal(secondInject.debug.reactWebFactGraphPacking.reason, "fresh-anchors-packed");
  assert.equal(secondInject.debug.reactWebFactGraphPacking.freshnessStatus, "fresh");
  assert.ok(secondInject.debug.reactWebFactGraphPacking.selectedAnchorCount > 0);
  assert.equal(secondInject.debug.reactWebContextPacking.included, true);
  assert.equal(secondInject.debug.reactWebContextPacking.reason, "packed");
  assert.equal(secondInject.debug.reactWebContextPacking.priority[0], "editTargetRouting");
  assert.ok(
    secondInject.debug.reactWebContextPacking.priority.indexOf("formStateRoles") >
      secondInject.debug.reactWebContextPacking.priority.indexOf("intentTargets"),
  );
  assert.deepEqual(secondInject.debug.reactWebContextPacking.fields, []);
  assert.equal(
    secondInject.debug.reactWebContextPacking.totalAnchors,
    secondInject.debug.reactWebContextPacking.fields.reduce((total, field) => total + field.count, 0),
  );
  assert.doesNotMatch(JSON.stringify(secondInject.debug.reactWebContextPacking), /provider|billing|latency|edit-quality|typechecker|cross-file/i);

  const contextSession = `bridge-contract-react-web-context-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: contextSession }, repoRoot);
  const firstContext = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: contextSession,
      prompt: "Inspect fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  const secondContext = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: contextSession,
      prompt: "Inspect fixtures/compressed/FormSection.tsx again",
    },
    repoRoot,
  );

  assert.equal(firstContext.action, "record");
  assert.equal(secondContext.action, "inject");
  assert.equal(secondContext.contextModeReason, "repeated-exact-file-react-web-payload");
  assert.equal(secondContext.additionalContext.includes("\"reactWebContext\""), true);
  assert.equal(secondContext.debug.decision.payload.reactWebContext.schemaVersion, "react-web-context.v0");
  assert.equal(secondContext.debug.decision.debug.reactWebContextBudget.included, true);
  const optimizedContextPayload = JSON.parse(secondContext.additionalContext.split("\n").slice(1).join("\n"));
  assert.equal(optimizedContextPayload.reactWebContext.schemaVersion, "react-web-context.v0");
  assert.equal("editTargetRouting" in optimizedContextPayload.reactWebContext, false);
  assert.equal(secondContext.debug.reactWebContextPacking.included, true);
  assert.deepEqual(secondContext.debug.reactWebContextPacking.fields, []);
  assert.equal(secondContext.debug.additionalContextAdmission, undefined);
  assert.ok(
    Buffer.byteLength(secondContext.additionalContext, "utf8") <= fs.statSync(path.join(repoRoot, "fixtures/compressed/FormSection.tsx")).size,
  );

  const pressureSession = `bridge-contract-react-web-context-pressure-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: pressureSession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: pressureSession,
      prompt: "Inspect fixtures/compressed/HookEffectPanel.tsx",
    },
    repoRoot,
  );
  const pressureContext = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: pressureSession,
      prompt: "Inspect fixtures/compressed/HookEffectPanel.tsx again",
    },
    repoRoot,
  );
  const pressurePayload = JSON.parse(pressureContext.additionalContext.split("\n").slice(1).join("\n"));
  assert.equal(pressureContext.action, "inject");
  assert.equal(pressureContext.contextModeReason, "repeated-exact-file-react-web-payload");
  assert.equal("reactWebContext" in pressurePayload, false);
  assert.equal(pressureContext.debug.additionalContextAdmission, undefined);
  assert.ok(
    Buffer.byteLength(pressureContext.additionalContext, "utf8") <= fs.statSync(path.join(repoRoot, "fixtures/compressed/HookEffectPanel.tsx")).size,
  );

  const runtimePackingTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-context-routing-"));
  try {
    fs.mkdirSync(path.join(runtimePackingTempDir, "src"), { recursive: true });
    const largeReactSource = `${fs.readFileSync(path.join(repoRoot, "fixtures/compressed/FormSection.tsx"), "utf8")}
{/* ${"routing budget filler ".repeat(200)} */}
`;
    fs.writeFileSync(path.join(runtimePackingTempDir, "src", "LargeFormSection.tsx"), largeReactSource);

    const packedSession = `bridge-contract-react-web-context-packed-${Date.now()}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: packedSession }, runtimePackingTempDir);
    handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: packedSession,
        prompt: "Inspect src/LargeFormSection.tsx",
      },
      runtimePackingTempDir,
    );
    const packedContext = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: packedSession,
        prompt: "Inspect src/LargeFormSection.tsx again",
      },
      runtimePackingTempDir,
    );
    const packedPayload = JSON.parse(packedContext.additionalContext.split("\n").slice(1).join("\n"));

    assert.equal(packedContext.action, "inject");
    assert.equal(packedContext.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.ok(Array.isArray(packedPayload.reactWebContext.editTargetRouting));
    assert.ok(packedPayload.reactWebContext.editTargetRouting.length > 0);
    assert.equal(packedContext.debug.reactWebContextPacking.fields[0].name, "editTargetRouting");
    assert.ok(Array.isArray(packedPayload.reactWebContext.a11yAnchors));
    assert.ok(
      packedContext.debug.reactWebContextPacking.priority.indexOf("formStateRoles") >
        packedContext.debug.reactWebContextPacking.priority.indexOf("editTargetRouting"),
    );
    assert.ok(
      packedContext.debug.reactWebContextPacking.priority.indexOf("formStateRoles") >
        packedContext.debug.reactWebContextPacking.priority.indexOf("formStateFlow"),
    );
    assert.ok(
      packedContext.debug.reactWebContextPacking.priority.indexOf("formStateRoles") >
        packedContext.debug.reactWebContextPacking.priority.indexOf("a11yAnchors"),
    );
    assert.ok(
      packedContext.debug.reactWebContextPacking.priority.indexOf("formStateRoles") >
        packedContext.debug.reactWebContextPacking.priority.indexOf("intentTargets"),
    );
    assert.ok(Buffer.byteLength(packedContext.additionalContext, "utf8") <= Buffer.byteLength(largeReactSource, "utf8"));
    assert.equal("sourceRanges" in packedPayload.reactWebContext, false);
  } finally {
    fs.rmSync(runtimePackingTempDir, { recursive: true, force: true });
  }

  const wrapperSession = `bridge-contract-wrapper-debug-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: wrapperSession }, repoRoot);
  const firstWrapper = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: wrapperSession,
      prompt: "Please update test/fixtures/frontend-domain-expectations/react-web/custom-design-system-card.tsx",
    },
    repoRoot,
  );
  const secondWrapper = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: wrapperSession,
      prompt: "Again, update test/fixtures/frontend-domain-expectations/react-web/custom-design-system-card.tsx",
    },
    repoRoot,
  );

  assert.equal(firstWrapper.action, "record");
  assert.equal(secondWrapper.action, "inject");
  assert.equal(secondWrapper.debug.decision.debug.domainDetection.classification, "react-web");
  assert.deepEqual(secondWrapper.debug.decision.debug.frontendPayloadPolicy.evidenceGates, [CUSTOM_WRAPPER_DOM_SIGNAL_GAP]);
  assert.equal(secondWrapper.contextModeReason, "repeated-exact-file-edit-guidance");
  assert.equal(secondWrapper.debug.additionalContextAdmission.admitted, true);
  assert.equal(secondWrapper.debug.additionalContextAdmission.candidateKind, "react-web-edit-card.v1");

  const readOnlySession = `bridge-contract-readonly-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: readOnlySession }, repoRoot);
  const firstReadOnly = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: readOnlySession,
      prompt: "Please read fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  const secondReadOnly = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: readOnlySession,
      prompt: "Again, summarize fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );

  assert.equal(firstReadOnly.action, "record");
  assert.equal(secondReadOnly.action, "inject");
  assert.equal(secondReadOnly.additionalContext.includes("\"editGuidance\""), false);
  assert.equal("editGuidance" in secondReadOnly.debug.decision.payload, false);
  assert.equal(secondReadOnly.debug.additionalContextAdmission, undefined);
  assert.equal(secondReadOnly.debug.reactWebFactGraphPacking.included, false);
  assert.equal(secondReadOnly.debug.reactWebFactGraphPacking.reason, "no-edit-guidance");
  assert.equal(secondReadOnly.debug.reactWebFactGraphPacking.freshnessStatus, "unknown");

  const smallRawSession = `bridge-contract-small-raw-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: smallRawSession }, repoRoot);

  const firstSmallRaw = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: smallRawSession,
      prompt: "Please inspect fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );
  const secondSmallRaw = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: smallRawSession,
      prompt: "Again, inspect fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );

  assert.equal(firstSmallRaw.action, "record");
  assert.equal(secondSmallRaw.action, "inject");
  assert.match(secondSmallRaw.additionalContext, /^fooks: reused pre-read \(raw\)/);
  assert.match(secondSmallRaw.additionalContext, /"useOriginal": true/);
  assert.equal("reactWebContextPacking" in secondSmallRaw.debug, false);

  const overrideSession = `bridge-contract-override-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: overrideSession }, repoRoot);
  const override = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: overrideSession,
      prompt: "Need exact source fixtures/compressed/FormSection.tsx #fooks-full-read",
    },
    repoRoot,
  );

  assert.equal(override.action, "fallback");
  assert.equal(override.fallback.reason, "escape-hatch-full-read");
  assert.equal(override.debug.reactWebFactGraphPacking.included, false);
  assert.equal(override.debug.reactWebFactGraphPacking.reason, "out-of-scope");

  const legacyOverride = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: overrideSession,
      prompt: "Need exact source fixtures/compressed/FormSection.tsx #fooks-full-read",
    },
    repoRoot,
  );

  assert.equal(legacyOverride.action, "fallback");
  assert.equal(legacyOverride.fallback.reason, "escape-hatch-full-read");
});

function hasRuntimeA11yAnchor(anchors, predicate) {
  return anchors.some(predicate);
}

test("runtime bridge preserves React Web a11y anchors in repeated-read context when budget permits", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-a11y-anchor-retention-"));
  try {
    fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
    const source = reactWebA11yAnchorSource();
    fs.writeFileSync(path.join(tempDir, "src", "InlineA11yContactForm.tsx"), source);

    const sessionId = `bridge-contract-a11y-anchor-${Date.now()}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineA11yContactForm.tsx",
      },
      tempDir,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineA11yContactForm.tsx again",
      },
      tempDir,
    );
    const payload = JSON.parse(second.additionalContext.split("\n").slice(1).join("\n"));

    assert.equal(first.action, "record");
    assert.equal(second.action, "inject");
    assert.equal(second.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(second.debug.decision.debug.reactWebContextBudget.included, true);
    assert.equal(second.debug.decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(Array.isArray(payload.reactWebContext.a11yAnchors));

    const anchors = payload.reactWebContext.a11yAnchors;
    assert.ok(
      hasRuntimeA11yAnchor(
        anchors,
        (item) => item.kind === "htmlFor" && item.label === "email" && item.relation?.kind === "label-control",
      ),
    );
    assert.ok(
      hasRuntimeA11yAnchor(
        anchors,
        (item) =>
          item.kind === "aria" &&
          item.label.startsWith("aria-describedby=email-error email-help") &&
          item.relation?.kind === "aria-idrefs" &&
          item.relation.resolvedIds.includes("email-error") &&
          !item.relation.resolvedIds.includes("missing-id"),
      ),
    );
    assert.ok(
      hasRuntimeA11yAnchor(
        anchors,
        (item) =>
          item.kind === "aria" &&
          item.label === "aria-labelledby=email-label" &&
          item.relation?.kind === "aria-idrefs" &&
          item.relation.resolvedIds.includes("email-label"),
      ),
    );
    assert.ok(
      hasRuntimeA11yAnchor(
        anchors,
        (item) => item.kind === "aria" && item.label === "aria-invalid=invalid" && item.relation?.kind === "invalid-state",
      ),
    );
    assert.ok(
      hasRuntimeA11yAnchor(
        anchors,
        (item) =>
          item.kind === "role" &&
          item.label === "alert" &&
          item.relation?.kind === "alert-region" &&
          item.relation.sourceId === "email-error",
      ),
    );
    assert.ok(Buffer.byteLength(second.additionalContext, "utf8") <= Buffer.byteLength(source, "utf8"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime bridge preserves React Web styling variant hints in repeated-read context when budget permits", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-styling-variant-retention-"));
  try {
    fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
    const source = reactWebStylingVariantSource();
    fs.writeFileSync(path.join(tempDir, "src", "InlineVariantPanel.tsx"), source);

    const sessionId = `bridge-contract-styling-variant-${Date.now()}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineVariantPanel.tsx",
      },
      tempDir,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineVariantPanel.tsx again",
      },
      tempDir,
    );
    const payload = JSON.parse(second.additionalContext.split("\n").slice(1).join("\n"));

    assert.equal(first.action, "record");
    assert.equal(second.action, "inject");
    assert.equal(second.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(second.debug.decision.debug.reactWebContextBudget.included, true);
    assert.equal(second.debug.decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(Array.isArray(payload.reactWebContext.stylingVariantHints));

    const hints = payload.reactWebContext.stylingVariantHints;
    assert.ok(hints.some((item) => item.kind === "props-contract" && item.propName === "variant"));
    assert.ok(hints.some((item) => item.kind === "data-state" && item.propName === "data-state"));
    assert.ok(hints.some((item) => item.kind === "className-branch" && item.propName === "className" && item.loc));
    assert.ok(hints.some((item) => item.kind === "inline-style" && item.propName === "style" && item.loc));
    assert.ok(hints.some((item) => item.kind === "variant-prop" && item.propName === "disabled"));
    assert.ok(Buffer.byteLength(second.additionalContext, "utf8") <= Buffer.byteLength(source, "utf8"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime bridge preserves React Web import role hints in repeated-read context when budget permits", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-import-role-retention-"));
  try {
    fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
    const source = reactWebImportRoleSource();
    fs.writeFileSync(path.join(tempDir, "src", "InlineImportRolePanel.tsx"), source);

    const sessionId = `bridge-contract-import-role-${Date.now()}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineImportRolePanel.tsx",
      },
      tempDir,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineImportRolePanel.tsx again",
      },
      tempDir,
    );
    const payload = JSON.parse(second.additionalContext.split("\n").slice(1).join("\n"));

    assert.equal(first.action, "record");
    assert.equal(second.action, "inject");
    assert.equal(second.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(second.debug.decision.debug.reactWebContextBudget.included, true);
    assert.equal(second.debug.decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(Array.isArray(payload.reactWebContext.importRoleHints));

    const rolesByModule = new Map(
      payload.reactWebContext.importRoleHints.map((item) => [item.moduleSpecifier, item.role]),
    );
    assert.equal(rolesByModule.get("react-hook-form"), "form-library");
    assert.equal(rolesByModule.get("zod"), "validation-library");
    assert.equal(rolesByModule.get("next/link"), "routing");
    assert.equal(rolesByModule.get("@/components/ui/button"), "ui-kit");
    assert.equal(rolesByModule.get("lucide-react"), "icon-library");
    assert.equal(rolesByModule.get("./FieldShell"), "local-component");
    assert.equal(rolesByModule.has("date-fns"), false);
    assert.ok(Buffer.byteLength(second.additionalContext, "utf8") <= Buffer.byteLength(source, "utf8"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime bridge preserves React Web form state-flow in repeated-read context when budget permits", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-form-flow-retention-"));
  try {
    fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
    const source = reactWebFormStateFlowSource();
    fs.writeFileSync(path.join(tempDir, "src", "InlineRetentionForm.tsx"), source);

    const sessionId = `bridge-contract-form-flow-${Date.now()}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineRetentionForm.tsx",
      },
      tempDir,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineRetentionForm.tsx again",
      },
      tempDir,
    );
    const payload = JSON.parse(second.additionalContext.split("\n").slice(1).join("\n"));

    assert.equal(first.action, "record");
    assert.equal(second.action, "inject");
    assert.equal(second.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(second.debug.decision.debug.reactWebContextBudget.included, true);
    assert.equal(second.debug.decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(Array.isArray(payload.reactWebContext.formStateFlow));
    assert.ok(
      payload.reactWebContext.formStateFlow.some(
        (item) => item.kind === "controlled-control" && item.label === "input[name=email]",
      ),
    );
    assert.ok(Buffer.byteLength(second.additionalContext, "utf8") <= Buffer.byteLength(source, "utf8"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime bridge preserves React Web form-state roles in repeated-read context when budget permits", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-form-role-retention-"));
  try {
    fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
    const source = reactWebFormStateRolesSource();
    fs.writeFileSync(path.join(tempDir, "src", "InlineFormStateRolesForm.tsx"), source);

    const sessionId = `bridge-contract-form-role-${Date.now()}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineFormStateRolesForm.tsx",
      },
      tempDir,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineFormStateRolesForm.tsx again",
      },
      tempDir,
    );
    const payload = JSON.parse(second.additionalContext.split("\n").slice(1).join("\n"));

    assert.equal(first.action, "record");
    assert.equal(second.action, "inject");
    assert.equal(second.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(second.debug.decision.debug.reactWebContextBudget.included, true);
    assert.equal(second.debug.decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(Array.isArray(payload.reactWebContext.formStateRoles));
    assert.ok(payload.reactWebContext.formStateRoles.length <= 8);

    const roles = new Set(payload.reactWebContext.formStateRoles.map((item) => item.role));
    assert.equal(roles.has("form-root"), true);
    assert.equal(roles.has("field-registration"), true);
    assert.equal(roles.has("submit-flow"), true);
    assert.equal(roles.has("value-control-relation"), true);
    assert.equal(roles.has("validation-defaults"), true);
    assert.ok(payload.reactWebContext.formStateRoles.every((item) => item.labels.length <= 4));
    assert.ok(payload.reactWebContext.formStateRoles.every((item) => item.evidence.length > 0));
    assert.doesNotMatch(
      JSON.stringify({ payload: payload.reactWebContext.formStateRoles, debug: second.debug.reactWebContextPacking }),
      /authoriz|cross-file|typechecker|LSP-backed|billing|latency|provider-token|auto-apply/i,
    );
    assert.ok(Buffer.byteLength(second.additionalContext, "utf8") <= Buffer.byteLength(source, "utf8"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime bridge preserves React Web component API hints in repeated-read context when budget permits", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-component-api-retention-"));
  try {
    fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
    const source = reactWebComponentApiSource();
    fs.writeFileSync(path.join(tempDir, "src", "InlineComponentApiPanel.tsx"), source);

    const sessionId = `bridge-contract-component-api-${Date.now()}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineComponentApiPanel.tsx",
      },
      tempDir,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineComponentApiPanel.tsx again",
      },
      tempDir,
    );
    const payload = JSON.parse(second.additionalContext.split("\n").slice(1).join("\n"));

    assert.equal(first.action, "record");
    assert.equal(second.action, "inject");
    assert.equal(second.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(second.debug.decision.debug.reactWebContextBudget.included, true);
    assert.equal(second.debug.decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(Array.isArray(payload.reactWebContext.componentApiHints));

    const apiKinds = new Set(payload.reactWebContext.componentApiHints.map((item) => item.kind));
    assert.equal(apiKinds.has("prop"), true);
    assert.equal(apiKinds.has("custom-component-usage"), true);
    assert.ok(payload.reactWebContext.componentApiHints.some((item) => item.propName === "title"));
    assert.ok(payload.reactWebContext.componentApiHints.some((item) => item.label === "StatusBadge"));
    assert.ok(Buffer.byteLength(second.additionalContext, "utf8") <= Buffer.byteLength(source, "utf8"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime bridge preserves React Web layout regions in repeated-read context when budget permits", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-layout-region-retention-"));
  try {
    fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
    const source = reactWebLayoutRegionSource();
    fs.writeFileSync(path.join(tempDir, "src", "InlineLayoutPanel.tsx"), source);

    const sessionId = `bridge-contract-layout-region-${Date.now()}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineLayoutPanel.tsx",
      },
      tempDir,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: "Inspect src/InlineLayoutPanel.tsx again",
      },
      tempDir,
    );
    const payload = JSON.parse(second.additionalContext.split("\n").slice(1).join("\n"));

    assert.equal(first.action, "record");
    assert.equal(second.action, "inject");
    assert.equal(second.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(second.debug.decision.debug.reactWebContextBudget.included, true);
    assert.equal(second.debug.decision.debug.reactWebContextBudget.reason, "within-budget");
    assert.ok(Array.isArray(payload.reactWebContext.layoutRegionHints));

    const layoutKinds = new Set(payload.reactWebContext.layoutRegionHints.map((item) => item.kind));
    assert.equal(layoutKinds.has("semantic-region"), true);
    assert.equal(layoutKinds.has("list-region"), true);
    assert.equal(layoutKinds.has("form-region"), true);
    assert.equal(layoutKinds.has("repeated-region"), true);
    assert.ok(Buffer.byteLength(second.additionalContext, "utf8") <= Buffer.byteLength(source, "utf8"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("runtime bridge preserves React Web custom-wrapper domainPayload parity for F11/F12", () => {
  const wrapperFixtures = [
    {
      label: "custom-design-system-card",
      path: "test/fixtures/frontend-domain-expectations/react-web/custom-design-system-card.tsx",
      componentName: "BillingPlanCard",
      requiredEvidence: ["react-web:jsx-attribute:className"],
      expectedJsxComponents: [
        "Badge",
        "Button",
        "Card",
        "CardContent",
        "CardDescription",
        "CardHeader",
        "CardTitle",
        "StatRow",
      ],
    },
    {
      label: "custom-form-shell",
      path: "test/fixtures/frontend-domain-expectations/react-web/custom-form-shell.tsx",
      componentName: "ProfileSettingsShell",
      requiredEvidence: ["react-web:jsx-attribute:className", "react-web:jsx-attribute:htmlFor"],
      expectedJsxComponents: [
        "Button",
        "ButtonGroup",
        "ErrorText",
        "Field",
        "FieldControl",
        "FieldLabel",
        "HelperText",
        "TextField",
      ],
    },
  ];

  const forbiddenFactKeys = [
    "rawText",
    "snippets",
    "loc",
    "componentLoc",
    "effectSignals",
    "callbackSignals",
    "stateSummary",
    "sourceRanges",
    "customComponentSemantics",
  ];

  for (const fixture of wrapperFixtures) {
    const direct = decidePreRead(path.join(repoRoot, fixture.path), repoRoot, "codex");

    assert.equal(direct.decision, "payload", `${fixture.label} direct pre-read should build payload`);
    assert.equal(direct.debug.domainDetection.classification, "react-web", `${fixture.label} must stay React Web`);
    assert.equal(direct.debug.domainDetection.profile.claimStatus, "current-supported-lane");
    assert.equal(direct.debug.frontendPayloadPolicy.name, REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY);
    assert.equal(direct.debug.frontendPayloadPolicy.allowed, true);
    assert.ok(
      direct.debug.frontendPayloadPolicy.evidenceGates.includes(CUSTOM_WRAPPER_DOM_SIGNAL_GAP),
      `${fixture.label} must expose ${CUSTOM_WRAPPER_DOM_SIGNAL_GAP}`,
    );
    assert.equal(direct.payload.domainPayload.domain, "react-web");

    const sessionId = `bridge-contract-wrapper-parity-${fixture.label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, repoRoot);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please inspect ${fixture.path}`,
      },
      repoRoot,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Again, inspect ${fixture.path}`,
      },
      repoRoot,
    );

    assert.equal(first.action, "record", `${fixture.label} first runtime prompt should record`);
    assert.equal(second.action, "inject", `${fixture.label} repeated runtime prompt should inject`);
    assert.equal(second.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(second.additionalContext.includes("\"domainPayload\""), true);
    assert.equal("fallback" in second, false, `${fixture.label} should not fallback after React Web wrapper evidence`);
    assert.deepEqual(
      second.debug.decision.payload.domainPayload,
      direct.payload.domainPayload,
      `${fixture.label} runtime domainPayload must match direct pre-read domainPayload`,
    );

    const runtimePayload = second.debug.decision.payload.domainPayload;
    assert.equal(runtimePayload.schemaVersion, "domain-payload.v1");
    assert.equal(runtimePayload.domain, "react-web");
    assert.equal(runtimePayload.policy, REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY);
    assert.equal(runtimePayload.plannerDecision, "compact-safe");
    assert.equal(runtimePayload.claimStatus, "current-supported-lane");
    assert.equal(runtimePayload.claimBoundary, "react-web-measured-extraction");
    assert.equal(runtimePayload.facts.componentName, fixture.componentName);
    assert.equal(runtimePayload.facts.jsxComponentCount, fixture.expectedJsxComponents.length);
    assert.deepEqual(runtimePayload.facts.jsxComponents, fixture.expectedJsxComponents);
    for (const evidence of fixture.requiredEvidence) {
      assert.ok(runtimePayload.evidence.includes(evidence), `${fixture.label} should include ${evidence}`);
    }
    for (const forbiddenKey of forbiddenFactKeys) {
      assert.equal(forbiddenKey in runtimePayload.facts, false, `${fixture.label} must not emit ${forbiddenKey}`);
    }
    assert.equal("formControls" in runtimePayload.facts, false, `${fixture.label} must not infer DOM form controls from custom components`);
    assert.equal("customComponentSemantics" in runtimePayload.facts, false, `${fixture.label} must keep custom components structural only`);
  }
});


test("codex runtime activates React Web payload semantics only for the React Web lane", () => {
  const runRepeatedPrompt = (label, prompt, cwd = repoRoot) => {
    const sessionId = `bridge-contract-domain-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, cwd);
    const first = handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt }, cwd);
    const second = handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Again, ${prompt}` }, cwd);
    return { first, second };
  };

  const reactWeb = runRepeatedPrompt("react-web", "inspect fixtures/compressed/FormSection.tsx");
  assert.equal(reactWeb.first.action, "record");
  assert.equal(reactWeb.second.action, "inject");
  assert.equal(reactWeb.second.contextModeReason, "repeated-exact-file-react-web-payload");
  assert.equal(reactWeb.second.debug.decision.debug.domainDetection.classification, "react-web");
  assert.equal(reactWeb.second.debug.decision.debug.frontendPayloadPolicy.name, REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY);
  assert.equal(reactWeb.second.debug.decision.payload.domainPayload.domain, "react-web");
  assert.equal(reactWeb.second.debug.decision.payload.domainPayload.plannerDecision, "compact-safe");
  assert.deepEqual(reactWeb.second.debug.reactWebActivationMode, {
    available: true,
    verdict: "would-activate",
    repeatedFilePositive: true,
    profileGateVerdict: "would-activate",
    profileGateReasons: [
      "current-supported-lane-claim",
      "direct-evidence-strength",
      "direct-file-evidence-present",
      "freshness-current",
      "planner-decision-compact-safe",
      "react-web-domain-payload-present",
      "runtime-decision-use",
    ],
    globMatchVerdict: "would-activate",
    globMatchReasons: [
      "current-supported-lane-claim",
      "direct-evidence-strength",
      "file-path-glob-react-extension-match",
      "freshness-current",
      "planner-decision-compact-safe",
      "react-web-domain-payload-present",
      "runtime-decision-use",
    ],
    promotedTrigger: "profile-gate",
    promoted: true,
    deferredTriggers: ["always-on", "model-decision"],
    blockedReasons: [],
  });

  const rnPrimitive = runRepeatedPrompt("rn-primitive", "inspect test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx");
  assert.equal(rnPrimitive.second.action, "inject");
  assert.equal(rnPrimitive.second.contextModeReason, "repeated-exact-file-narrow-payload");
  assert.equal(rnPrimitive.second.debug.decision.debug.domainDetection.classification, "react-native");
  assert.equal(rnPrimitive.second.debug.decision.debug.frontendPayloadPolicy.name, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(rnPrimitive.second.debug.decision.debug.frontendPayloadPolicy.allowed, true);
  assert.equal(rnPrimitive.second.debug.decision.payload.domainPayload.domain, "react-native");
  assert.equal(rnPrimitive.second.debug.decision.payload.domainPayload.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(rnPrimitive.second.debug.decision.payload.domainPayload.reuseContract.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(rnPrimitive.second.debug.decision.payload.domainPayload.reuseContract.freshnessSource, "sourceFingerprint");
  assert.equal(rnPrimitive.second.debug.reactWebActivationMode, undefined);
  assert.equal(rnPrimitive.second.additionalContext.includes('"domainPayload"'), true);
  assert.equal(rnPrimitive.second.additionalContext.includes('"reuseContract"'), true);
  assert.match(rnPrimitive.second.additionalContext, /"domain":\s*"react-native"/);

  const rnAdjacent = runRepeatedPrompt("rn-primitive-adjacent", "inspect test/fixtures/frontend-domain-expectations/rn-primitive-inline-action.tsx");
  assert.equal(rnAdjacent.second.action, "inject");
  assert.equal(rnAdjacent.second.contextModeReason, "repeated-exact-file-narrow-payload");
  assert.equal(rnAdjacent.second.debug.decision.payload.domainPayload.domain, "react-native");
  assert.equal(rnAdjacent.second.debug.decision.payload.domainPayload.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(rnAdjacent.second.debug.decision.payload.domainPayload.reuseContract.supportBoundary, "measured-evidence-only; no broad RN/WebView/TUI support");

  for (const [label, fixture, forbiddenSignal] of [
    ["rn-style-platform", "rn-style-platform-navigation.tsx", "react-native:primitive:ScrollView"],
    ["rn-interaction", "rn-interaction-gesture.tsx", "react-native:primitive:FlatList"],
    ["rn-image-scrollview", "rn-image-scrollview.tsx", "react-native:primitive:Image"],
  ]) {
    const { second } = runRepeatedPrompt(label, `inspect test/fixtures/frontend-domain-expectations/${fixture}`);
    assert.equal(second.action, "fallback", `${label} should not inherit the RN F1 narrow payload`);
    assert.equal(second.contextModeReason, UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
    assert.equal(second.debug.decision.debug.domainDetection.classification, "react-native");
    assert.equal(second.debug.decision.fallback.reason, UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
    assert.equal(second.debug.decision.debug.frontendPayloadPolicy.name, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
    assert.equal(second.debug.decision.debug.frontendPayloadPolicy.allowed, false);
    assert.match(second.debug.decision.debug.frontendPayloadPolicy.reason, new RegExp(`^forbidden-signal:${forbiddenSignal.replaceAll(".", "\\.")}`));
    assert.equal("payload" in second.debug.decision, false);
    assert.notEqual(second.debug.decision.debug.frontendPayloadPolicy.name, REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY);
    assert.equal(second.additionalContext, undefined);
  }

  for (const [label, prompt, classification, reason, policyName] of [
    ["webview", "inspect test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx", "webview", REACT_NATIVE_WEBVIEW_BOUNDARY_REASON, WEBVIEW_BOUNDARY_FALLBACK_POLICY],
    ["tui", "inspect test/fixtures/frontend-domain-expectations/tui-ink-basic.tsx", "tui-ink", UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON, undefined],
    ["mixed", "inspect test/fixtures/frontend-domain-expectations/negative-rn-webview-boundary.tsx", "mixed", REACT_NATIVE_WEBVIEW_BOUNDARY_REASON, WEBVIEW_BOUNDARY_FALLBACK_POLICY],
  ]) {
    const { second } = runRepeatedPrompt(label, prompt);
    assert.equal(second.action, "fallback", `${label} should not inject React Web payload semantics`);
    assert.equal(second.contextModeReason, reason);
    assert.equal(second.debug.decision.debug.domainDetection.classification, classification);
    assert.equal(second.debug.decision.fallback.reason, reason);
    assert.equal("payload" in second.debug.decision, false);
    assert.notEqual(second.debug.decision.debug.frontendPayloadPolicy?.name, REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY);
    if (policyName) assert.equal(second.debug.decision.debug.frontendPayloadPolicy.name, policyName);
  }

  const unknownDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-runtime-unknown-domain-"));
  try {
    fs.writeFileSync(path.join(unknownDir, "PlainUnknown.tsx"), "export function PlainUnknown() { return null; }\n");
    const { second: unknown } = runRepeatedPrompt("unknown", "inspect PlainUnknown.tsx", unknownDir);
    assert.equal(unknown.action, "fallback");
    assert.equal(unknown.contextModeReason, UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
    assert.equal(unknown.debug.decision.debug.domainDetection.classification, "unknown");
    assert.equal(unknown.debug.decision.debug.domainDetection.profile.claimStatus, "deferred");
    assert.equal(unknown.debug.decision.fallback.reason, UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
    assert.equal("payload" in unknown.debug.decision, false);
    assert.notEqual(unknown.debug.decision.debug.frontendPayloadPolicy?.name, REACT_WEB_CURRENT_SUPPORTED_PAYLOAD_POLICY);
  } finally {
    fs.rmSync(unknownDir, { recursive: true, force: true });
  }
});

test("runtime boundary fallbacks do not bypass into edit-guidance injection", () => {
  const target = "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx";

  const codexSession = `bridge-contract-boundary-edit-codex-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: codexSession }, repoRoot);
  const codexFirst = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: codexSession,
      prompt: `Please update ${target}`,
    },
    repoRoot,
  );
  const codexSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: codexSession,
      prompt: `Again, update ${target}`,
    },
    repoRoot,
  );

  assert.equal(codexFirst.action, "record");
  assert.equal(codexSecond.action, "fallback");
  assert.equal(codexSecond.contextModeReason, REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.equal(codexSecond.fallback.reason, REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.equal(codexSecond.reasons.includes("edit-guidance-opt-in"), false);
  assert.equal(codexSecond.additionalContext, undefined);
  assert.equal("payload" in codexSecond.debug.decision, false);
  assert.equal(codexSecond.debug.decision.debug.domainDetection.classification, "webview");
  assert.equal(codexSecond.debug.decision.debug.domainDetection.profile.claimStatus, "fallback-boundary");

  const claudeSession = `bridge-contract-boundary-edit-claude-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: claudeSession }, repoRoot);
  const claudeFirst = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: claudeSession,
      prompt: `Please update ${target}`,
    },
    repoRoot,
  );
  const claudeSecond = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: claudeSession,
      prompt: `Again, update ${target}`,
    },
    repoRoot,
  );

  assert.equal(claudeFirst.action, "record");
  assert.equal(claudeSecond.action, "fallback");
  assert.equal(claudeSecond.contextModeReason, REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.equal(claudeSecond.fallback.reason, REACT_NATIVE_WEBVIEW_BOUNDARY_REASON);
  assert.equal(claudeSecond.reasons.includes("edit-guidance-opt-in"), false);
  assert.equal(claudeSecond.additionalContext.includes(REACT_NATIVE_WEBVIEW_BOUNDARY_REASON), true);
  assert.equal(claudeSecond.additionalContext.includes('"domainPayload"'), false);
  assert.equal(claudeSecond.additionalContext.includes('"editGuidance"'), false);
  assert.equal(claudeSecond.debug.repeatedFile, true);
  assert.equal(claudeSecond.debug.eligible, true);
  assert.equal(claudeSecond.debug.bounded, true);
});

test("runtime fallback bridges preserve direct pre-read fallback decisions", () => {
  const cases = [
    {
      label: "webview-boundary",
      target: "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx",
      expectedClassification: "webview",
      expectedPolicyName: WEBVIEW_BOUNDARY_FALLBACK_POLICY,
      expectedReason: REACT_NATIVE_WEBVIEW_BOUNDARY_REASON,
    },
    {
      label: "rn-style-platform",
      target: "test/fixtures/frontend-domain-expectations/rn-style-platform-navigation.tsx",
      expectedClassification: "react-native",
      expectedPolicyName: RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY,
      expectedReason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
    },
  ];

  const repeatedCodexPrompt = (label, target) => {
    const sessionId = `bridge-contract-fallback-parity-codex-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, repoRoot);
    const first = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please update ${target}`,
      },
      repoRoot,
    );
    const second = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Again, update ${target}`,
      },
      repoRoot,
    );
    return { first, second };
  };

  const repeatedClaudePrompt = (label, target) => {
    const sessionId = `bridge-contract-claude-fallback-parity-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId }, repoRoot);
    const first = handleClaudeRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Please update ${target}`,
      },
      repoRoot,
    );
    const second = handleClaudeRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Again, update ${target}`,
      },
      repoRoot,
    );
    return { first, second };
  };

  for (const fixture of cases) {
    const direct = decidePreRead(path.join(repoRoot, fixture.target), repoRoot, "codex", {
      includeEditGuidance: true,
    });

    assert.equal(direct.decision, "fallback", `${fixture.label} direct pre-read should fallback`);
    assert.equal(direct.fallback.reason, fixture.expectedReason, `${fixture.label} direct fallback reason should stay stable`);
    assert.equal(direct.debug.domainDetection.classification, fixture.expectedClassification);
    assert.equal(direct.debug.frontendPayloadPolicy.name, fixture.expectedPolicyName);
    assert.equal(direct.debug.frontendPayloadPolicy.allowed, false);

    const codex = repeatedCodexPrompt(fixture.label, fixture.target);
    assert.equal(codex.first.action, "record", `${fixture.label} first Codex prompt should record`);
    assert.equal(codex.second.action, "fallback", `${fixture.label} repeated Codex prompt should fallback`);
    assert.equal(codex.second.contextModeReason, direct.fallback.reason);
    assert.equal(codex.second.fallback.reason, direct.fallback.reason);
    assert.equal(codex.second.debug.decision.fallback.reason, direct.fallback.reason);
    assert.equal(codex.second.debug.decision.debug.domainDetection.classification, fixture.expectedClassification);
    assert.equal(codex.second.debug.decision.debug.frontendPayloadPolicy.name, fixture.expectedPolicyName);
    assert.equal(codex.second.debug.decision.debug.frontendPayloadPolicy.allowed, false);
    assert.equal("payload" in codex.second.debug.decision, false);
    assert.equal(codex.second.additionalContext, undefined);

    const claude = repeatedClaudePrompt(fixture.label, fixture.target);
    assert.equal(claude.first.action, "record", `${fixture.label} first Claude prompt should record`);
    assert.equal(claude.second.action, "fallback", `${fixture.label} repeated Claude prompt should fallback`);
    assert.equal(claude.second.contextModeReason, direct.fallback.reason);
    assert.equal(claude.second.fallback.reason, direct.fallback.reason);
    assert.equal(claude.second.additionalContext.includes(direct.fallback.reason), true);
    assert.equal(claude.second.additionalContext.includes('"domainPayload"'), false);
    assert.equal(claude.second.additionalContext.includes('"editGuidance"'), false);
    assert.equal(claude.second.debug.repeatedFile, true);
    assert.equal(claude.second.debug.eligible, true);
    assert.equal(claude.second.debug.bounded, true);
  }
});

test("claude runtime keeps RN F1 narrow payload separate from broader RN domains", () => {
  const runRepeatedPrompt = (label, prompt) => {
    const sessionId = `bridge-contract-claude-rn-domain-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId }, repoRoot);
    const first = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt }, repoRoot);
    const second = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Again, ${prompt}` }, repoRoot);
    return { first, second };
  };

  const rnPrimitive = runRepeatedPrompt("rn-primitive", "inspect test/fixtures/frontend-domain-expectations/rn-primitive-basic.tsx");
  assert.equal(rnPrimitive.first.action, "record");
  assert.equal(rnPrimitive.second.action, "inject");
  assert.equal(rnPrimitive.second.contextModeReason, "repeated-exact-file-narrow-payload");
  assert.equal(rnPrimitive.second.debug.decision.debug.domainDetection.classification, "react-native");
  assert.equal(rnPrimitive.second.debug.decision.debug.frontendPayloadPolicy.name, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(rnPrimitive.second.debug.decision.debug.frontendPayloadPolicy.allowed, true);
  assert.equal(rnPrimitive.second.debug.decision.payload.domainPayload.domain, "react-native");
  assert.equal(rnPrimitive.second.debug.decision.payload.domainPayload.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(rnPrimitive.second.debug.decision.payload.domainPayload.reuseContract.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(rnPrimitive.second.debug.decision.payload.domainPayload.reuseContract.freshnessSource, "sourceFingerprint");
  assert.equal(rnPrimitive.second.additionalContext.includes('"domainPayload"'), true);
  assert.equal(rnPrimitive.second.additionalContext.includes('"reuseContract"'), true);
  assert.match(rnPrimitive.second.additionalContext, /"domain":\s*"react-native"/);

  const rnAdjacent = runRepeatedPrompt("rn-primitive-adjacent", "inspect test/fixtures/frontend-domain-expectations/rn-primitive-inline-action.tsx");
  assert.equal(rnAdjacent.second.action, "inject");
  assert.equal(rnAdjacent.second.contextModeReason, "repeated-exact-file-narrow-payload");
  assert.equal(rnAdjacent.second.debug.decision.payload.domainPayload.domain, "react-native");
  assert.equal(rnAdjacent.second.debug.decision.payload.domainPayload.policy, RN_PRIMITIVE_INPUT_NARROW_PAYLOAD_POLICY);
  assert.equal(rnAdjacent.second.debug.decision.payload.domainPayload.reuseContract.sourceDerivedOnly, true);

  for (const [label, fixture] of [
    ["rn-style-platform", "rn-style-platform-navigation.tsx"],
    ["rn-interaction", "rn-interaction-gesture.tsx"],
    ["rn-image-scrollview", "rn-image-scrollview.tsx"],
  ]) {
    const { second } = runRepeatedPrompt(label, `inspect test/fixtures/frontend-domain-expectations/${fixture}`);
    assert.equal(second.action, "fallback", `${label} should not inherit the RN F1 narrow payload`);
    assert.equal(second.contextModeReason, UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
    assert.equal(second.fallback.reason, UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON);
    assert.equal(second.additionalContext.includes(UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON), true);
    assert.equal(second.additionalContext.includes('"domainPayload"'), false);
    assert.equal(second.debug.repeatedFile, true);
    assert.equal(second.debug.bounded, true);
  }
});

test("claude runtime bridge follows record-then-inject repeated same-file contract", () => {
  const target = path.join("fixtures", "compressed", "FormSection.tsx");
  const linkedTsTarget = path.join("fixtures", "compressed", "FormSection.utils.ts");
  const missingJsTarget = path.join("src", "cli", "index.js");
  const otherTarget = path.join("fixtures", "raw", "SimpleButton.tsx");
  const readState = (statePath) => JSON.parse(fs.readFileSync(statePath, "utf8"));

  const injectSession = `bridge-contract-claude-inject-${Date.now()}`;
  const start = handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: injectSession }, repoRoot);
  assert.equal(start.action, "inject");
  assert.match(start.statePath, /\.fooks\/state\/claude-runtime/);

  const first = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: injectSession,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  assert.equal(first.action, "record");
  assert.equal(first.filePath, target);
  assert.equal(first.additionalContext, undefined);
  assert.equal(first.debug.repeatedFile, false);
  assert.equal(readState(first.statePath).seenFiles[target].seenCount, 1);

  const second = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: injectSession,
      prompt: "Again, update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  assert.equal(second.action, "inject");
  assert.equal(second.filePath, target);
  assert.equal(second.contextModeReason, "repeated-exact-file-edit-guidance");
  assert.ok(second.reasons.includes("edit-guidance-opt-in"));
  assert.ok(second.additionalContext.length <= CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS);
  assert.match(second.additionalContext, /fixtures\/compressed\/FormSection\.tsx/);
  assert.match(second.additionalContext, /does not intercept Claude Read or claim runtime-token savings/);
  assert.equal(second.additionalContext.includes("\"editGuidance\""), true);
  assert.equal(second.additionalContext.includes("\"domainPayload\""), true);
  assert.equal(second.debug.decision.payload.domainPayload.domain, "react-web");
  assert.deepEqual(second.debug.decision.payload.editGuidance.freshness, second.debug.decision.payload.sourceFingerprint);
  assert.doesNotMatch(second.additionalContext, /Claude Read interception is enabled/i);
  assert.equal(second.debug.repeatedFile, true);
  assert.equal(readState(second.statePath).seenFiles[target].seenCount, 2);
  const editGuidanceMetricSummary = readSessionMetricSummary(repoRoot, injectSession, {
    runtime: "claude",
    measurementSource: "project-local-context-hook",
  });
  assert.equal(editGuidanceMetricSummary.runtime, "claude");
  assert.equal(editGuidanceMetricSummary.measurementSource, "project-local-context-hook");
  assert.equal(editGuidanceMetricSummary.eventCount, 2);
  assert.equal(editGuidanceMetricSummary.comparableEventCount, 0);

  const readOnlySession = `bridge-contract-claude-readonly-${Date.now()}`;
  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: readOnlySession }, repoRoot);
  handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: readOnlySession,
      prompt: `Please inspect ${target}`,
    },
    repoRoot,
  );
  const readOnlySecond = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: readOnlySession,
      prompt: `Again, summarize ${target}`,
    },
    repoRoot,
  );
  assert.equal(readOnlySecond.action, "inject");
  assert.equal(readOnlySecond.contextModeReason, "repeated-exact-file-react-web-payload");
  assert.equal(readOnlySecond.additionalContext.includes("\"editGuidance\""), false);
  assert.equal("editGuidance" in readOnlySecond.debug.decision.payload, false);
  assert.equal(readOnlySecond.reasons.includes("edit-guidance-opt-in"), false);

  const multiFileSession = `bridge-contract-claude-multifile-${Date.now()}`;
  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: multiFileSession }, repoRoot);
  handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: multiFileSession,
      prompt: `Please update ${target} and ${otherTarget}`,
    },
    repoRoot,
  );
  const multiFileSecond = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: multiFileSession,
      prompt: `Again, fix ${target} and ${otherTarget}`,
    },
    repoRoot,
  );
  assert.equal(multiFileSecond.action, "inject");
  assert.equal(multiFileSecond.additionalContext.includes("\"editGuidance\""), false);
  assert.equal(multiFileSecond.reasons.includes("edit-guidance-opt-in"), false);

  for (const [label, extraTarget] of [
    ["mixed-ts", linkedTsTarget],
    ["mixed-js", missingJsTarget],
  ]) {
    const mixedCodeSession = `bridge-contract-claude-${label}-${Date.now()}`;
    handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: mixedCodeSession }, repoRoot);
    handleClaudeRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: mixedCodeSession,
        prompt: `Please update ${target} and ${extraTarget}`,
      },
      repoRoot,
    );
    const mixedCodeSecond = handleClaudeRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId: mixedCodeSession,
        prompt: `Again, fix ${target} and ${extraTarget}`,
      },
      repoRoot,
    );
    assert.equal(mixedCodeSecond.action, "inject");
    assert.equal(mixedCodeSecond.contextModeReason, "repeated-exact-file-react-web-payload");
    assert.equal(mixedCodeSecond.additionalContext.includes("\"editGuidance\""), false);
    assert.equal(mixedCodeSecond.reasons.includes("edit-guidance-opt-in"), false);
  }

  const differentFile = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: injectSession,
      prompt: "Please inspect fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );
  assert.equal(differentFile.action, "record");
  assert.equal(differentFile.filePath, otherTarget);
  assert.equal(readState(differentFile.statePath).seenFiles[otherTarget].seenCount, 1);

  const differentSession = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: `bridge-contract-claude-other-${Date.now()}`,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  assert.equal(differentSession.action, "record");
  assert.notEqual(differentSession.statePath, second.statePath);

  const noTarget = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: injectSession, prompt: "Explain this repo" }, repoRoot);
  assert.equal(noTarget.action, "noop");
  const missing = handleClaudeRuntimeHook({
    hookEventName: "UserPromptSubmit",
    sessionId: injectSession,
    prompt: "Create fixtures/raw/MissingPanel.tsx",
  }, repoRoot);
  assert.equal(missing.action, "noop");
});
