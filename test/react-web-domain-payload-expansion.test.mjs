import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const { handleCodexRuntimeHook } = await import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));

const reactWebWarnings = [
  "React Web current supported lane only; this payload does not imply React Native, WebView, TUI, Mixed, or Unknown support.",
  "Planner decision depends on current extractor readiness and domain profile evidence; rerun extraction if the source changes.",
];

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
  return second.debug.decision.payload.domainPayload;
}

function assertExactPayload(actual, expected) {
  assert.deepEqual(actual, expected);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), "domainPayload property order must remain stable");
}

function assertNoNonWhitelistedDetails(facts) {
  for (const forbiddenKey of ["rawText", "snippets", "loc", "componentLoc", "effectSignals", "callbackSignals", "stateSummary"]) {
    assert.equal(forbiddenKey in facts, false, `${forbiddenKey} must not be added to React Web domainPayload facts`);
  }
}

test.after(() => {
  cleanupRuntimeSessions("react-web-payload-expansion-");
});

test("React Web runtime payload preserves the full compact domainPayload contract", () => {
  const formPayload = repeatedPayloadFor("fixtures/compressed/FormSection.tsx", "form-section");

  assertExactPayload(formPayload, {
    schemaVersion: "domain-payload.v1",
    domain: "react-web",
    policy: "react-web-current-supported-lane",
    plannerDecision: "compact-safe",
    claimStatus: "current-supported-lane",
    claimBoundary: "react-web-measured-extraction",
    evidence: [
      "react-web:dom-tag:button",
      "react-web:dom-tag:div",
      "react-web:dom-tag:input",
      "react-web:dom-tag:label",
      "react-web:dom-tag:span",
      "react-web:jsx-attribute:className",
    ],
    facts: {
      componentName: "FormSection",
      exports: [{ name: "FormSection", kind: "named", type: "function" }],
      jsxDepth: 4,
      hasSideEffects: false,
      hasStyleBranching: false,
      domTags: ["button", "div", "input", "label", "span"],
      jsxAttributes: ["className"],
      styleSystem: "tailwind",
    },
    warnings: reactWebWarnings,
  });
  assertNoNonWhitelistedDetails(formPayload.facts);

  const hookPayload = repeatedPayloadFor("fixtures/compressed/HookEffectPanel.tsx", "hook-effect-panel");

  assertExactPayload(hookPayload, {
    schemaVersion: "domain-payload.v1",
    domain: "react-web",
    policy: "react-web-current-supported-lane",
    plannerDecision: "compact-safe",
    claimStatus: "current-supported-lane",
    claimBoundary: "react-web-measured-extraction",
    evidence: [
      "react-web:dom-tag:button",
      "react-web:jsx-attribute:className",
    ],
    facts: {
      componentName: "HookEffectPanel",
      exports: [{ name: "HookEffectPanel", kind: "named", type: "function" }],
      hooks: ["useCallback", "useEffect", "useMemo", "useState"],
      jsxDepth: 3,
      hasSideEffects: true,
      hasStyleBranching: false,
      domTags: ["button"],
      jsxAttributes: ["className"],
      eventHandlers: ["handleRefresh", "onClick"],
      styleSystem: "tailwind",
    },
    warnings: reactWebWarnings,
  });
  assertNoNonWhitelistedDetails(hookPayload.facts);
});
