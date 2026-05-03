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

function repeatedPrompt(relativeFile, suffix) {
  const sessionId = `react-web-release-smoke-${suffix}-${Date.now()}`;
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
      prompt: `Please inspect ${relativeFile} again and keep the same-file context compact if safe`,
    },
    repoRoot,
  );

  return { first, second };
}

test.after(() => {
  cleanupRuntimeSessions("react-web-release-smoke-");
});

test("release smoke: repeated React Web TSX work injects compact current-lane payload", () => {
  const { first, second } = repeatedPrompt("fixtures/compressed/HookEffectPanel.tsx", "react-web");

  assert.equal(first.action, "record");
  assert.equal(second.action, "inject");
  assert.equal(second.debug.decision.decision, "payload");
  assert.deepEqual(second.debug.decision.reasons, []);

  const payload = second.debug.decision.payload;
  assert.notEqual(payload.useOriginal, true, "release smoke must exercise the compact path, not raw source reuse");

  const domainPayload = payload.domainPayload;
  assert.equal(domainPayload.schemaVersion, "domain-payload.v1");
  assert.equal(domainPayload.domain, "react-web");
  assert.equal(domainPayload.policy, "react-web-current-supported-lane");
  assert.equal(domainPayload.plannerDecision, "compact-safe");
  assert.equal(domainPayload.claimStatus, "current-supported-lane");
  assert.equal(domainPayload.claimBoundary, "react-web-measured-extraction");
  assert.ok(domainPayload.warnings.some((warning) => warning.includes("React Web current supported lane only")));

  assert.equal(domainPayload.facts.componentName, "HookEffectPanel");
  assert.deepEqual(domainPayload.facts.hooks, ["useCallback", "useEffect", "useMemo", "useState"]);
  assert.ok(domainPayload.facts.domTags.includes("button"));
  assert.ok(domainPayload.facts.jsxAttributes.includes("className"));
  assert.ok(domainPayload.facts.eventHandlers.includes("handleRefresh"));
  assert.equal(domainPayload.facts.styleSystem, "tailwind");
});

test("release smoke: WebView boundary falls back instead of becoming React Web support", () => {
  const { first, second } = repeatedPrompt(
    "test/fixtures/frontend-domain-expectations/webview-boundary-basic.tsx",
    "webview-boundary",
  );

  assert.equal(first.action, "record");
  assert.equal(second.action, "fallback");
  assert.equal(second.debug.decision.decision, "fallback");
  assert.deepEqual(second.debug.decision.reasons, ["unsupported-react-native-webview-boundary"]);
  assert.equal(second.debug.decision.fallback.reason, "unsupported-react-native-webview-boundary");
  assert.equal("payload" in second.debug.decision, false);

  const domainDetection = second.debug.decision.debug.domainDetection;
  assert.equal(domainDetection.classification, "webview");
  assert.equal(domainDetection.profile.claimStatus, "fallback-boundary");
  assert.ok(domainDetection.signals.includes("webview:component:WebView"));
});
