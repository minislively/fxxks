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
const {
  CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS,
  handleClaudeRuntimeHook,
} = await import(path.join(repoRoot, "dist", "adapters", "claude-runtime-hook.js"));

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
  assert.ok(second.additionalContext.length <= CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS);
  assert.match(second.additionalContext, /fixtures\/compressed\/FormSection\.tsx/);
  assert.doesNotMatch(second.additionalContext, /Claude Read interception is enabled/i);
  assert.equal(second.debug.repeatedFile, true);
  assert.equal(readState(second.statePath).seenFiles[target].seenCount, 2);

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
