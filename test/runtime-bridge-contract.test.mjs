import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupMetricSessions } from "./metric-cleanup.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const { handleCodexRuntimeHook } = await import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
const { CUSTOM_WRAPPER_DOM_SIGNAL_GAP } = await import(path.join(repoRoot, "dist", "adapters", "pre-read.js"));
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
  assert.match(secondInject.additionalContext, /^fooks: reused pre-read \(compressed\)/);
  assert.match(secondInject.additionalContext, /"domainPayload"/);
  assert.equal(secondInject.debug.decision.payload.domainPayload.domain, "react-web");
  assert.equal(secondInject.contextModeReason, "repeated-exact-file-edit-guidance");
  assert.equal(secondInject.additionalContext.includes("\"editGuidance\""), true);
  assert.ok(secondInject.reasons.includes("edit-guidance-opt-in"));
  assert.deepEqual(secondInject.debug.decision.payload.editGuidance.freshness, secondInject.debug.decision.payload.sourceFingerprint);

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
  assert.equal(secondWrapper.contextModeReason, "repeated-exact-file-payload");

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
  assert.equal(readOnlySecond.contextModeReason, "repeated-exact-file-payload");
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
    assert.equal(mixedCodeSecond.contextModeReason, "repeated-exact-file-payload");
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
