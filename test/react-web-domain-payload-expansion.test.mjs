import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const { handleCodexRuntimeHook } = await import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));

function cleanupRuntimeSessions(prefix) {
  const root = path.join(repoRoot, ".fooks", "state", "codex-runtime");
  if (!fs.existsSync(root)) return;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith(prefix)) {
      fs.rmSync(path.join(root, entry.name), { force: true });
    }
  }

  if (fs.existsSync(root) && fs.readdirSync(root).length === 0) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function repeatedPayloadFor(relativeFile, sessionSuffix) {
  const sessionId = `react-web-payload-expansion-${sessionSuffix}-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, repoRoot);

  const first = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Please inspect ${relativeFile}`,
    },
    repoRoot,
  );
  const second = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Again inspect ${relativeFile}`,
    },
    repoRoot,
  );

  assert.equal(first.action, "record");
  assert.equal(second.action, "inject");
  assert.equal(second.debug.decision.payload.domainPayload.domain, "react-web");
  return second.debug.decision.payload.domainPayload.facts;
}

function assertNoNonWhitelistedDetails(facts) {
  for (const forbiddenKey of ["rawText", "snippets", "loc", "componentLoc", "effectSignals", "callbackSignals", "stateSummary"]) {
    assert.equal(forbiddenKey in facts, false, `${forbiddenKey} must not be added to React Web domainPayload facts`);
  }
}

test.after(() => {
  cleanupRuntimeSessions("react-web-payload-expansion-");
});

test("React Web runtime payload exposes only whitelisted compact facts", () => {
  const formFacts = repeatedPayloadFor("fixtures/compressed/FormSection.tsx", "form-section");

  assert.equal(formFacts.componentName, "FormSection");
  assert.deepEqual(formFacts.exports, [{ name: "FormSection", kind: "named", type: "function" }]);
  assert.equal(formFacts.jsxDepth, 4);
  assert.equal(formFacts.hasSideEffects, false);
  assert.equal(formFacts.hasStyleBranching, false);
  assert.equal(formFacts.styleSystem, "tailwind");
  assert.ok(formFacts.domTags.includes("input"));
  assertNoNonWhitelistedDetails(formFacts);

  const hookFacts = repeatedPayloadFor("fixtures/compressed/HookEffectPanel.tsx", "hook-effect-panel");

  assert.equal(hookFacts.componentName, "HookEffectPanel");
  assert.deepEqual(hookFacts.exports, [{ name: "HookEffectPanel", kind: "named", type: "function" }]);
  assert.deepEqual(hookFacts.hooks, ["useCallback", "useEffect", "useMemo", "useState"]);
  assert.equal(hookFacts.jsxDepth, 3);
  assert.equal(hookFacts.hasSideEffects, true);
  assert.equal(hookFacts.hasStyleBranching, false);
  assert.ok(hookFacts.eventHandlers.includes("onClick"));
  assertNoNonWhitelistedDetails(hookFacts);
});
