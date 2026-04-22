#!/usr/bin/env node
/**
 * Claude runtime hook smoke test — runs 6 scenarios automatically and prints results.
 */
import { handleClaudeRuntimeHook } from "../dist/adapters/claude-runtime-hook.js";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

function ok(label, cond) {
  console.log(cond ? `  ✅ ${label}` : `  ❌ ${label}`);
  return cond;
}

let allPass = true;

console.log("\n▶ SessionStart");
const start = handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: `smoke-${Date.now()}` }, cwd);
allPass &= ok('action === "inject"', start.action === "inject");
allPass &= ok("session-start text ≤ 80 chars", start.additionalContext.length <= 80);
allPass &= ok("contains 'fooks: active'", start.additionalContext.includes("fooks: active"));
allPass &= ok("contains 'no Read interception'", start.additionalContext.includes("no Read interception"));

console.log("\n▶ First prompt (exact file)");
const sessionId = `smoke-${Date.now()}`;
handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId }, cwd);
const first = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: "Explain fixtures/raw/SimpleButton.tsx" }, cwd);
allPass &= ok('action === "record"', first.action === "record");
allPass &= ok("repeatedFile === false", first.debug?.repeatedFile === false);
allPass &= ok("eligible === true", first.debug?.eligible === true);
allPass &= ok("escapeHatchUsed === false", first.debug?.escapeHatchUsed === false);

console.log("\n▶ Repeated prompt (same file)");
const second = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: "Again, explain fixtures/raw/SimpleButton.tsx" }, cwd);
allPass &= ok('action === "inject"', second.action === "inject");
allPass &= ok("repeatedFile === true", second.debug?.repeatedFile === true);
allPass &= ok("has additionalContext", Boolean(second.additionalContext));
allPass &= ok("disclaimer line ≤ 80 chars", second.additionalContext.split("\n")[1]?.length <= 80);
allPass &= ok("disclaimer contains legal boundary", second.additionalContext.includes("does not intercept Claude Read"));
allPass &= ok("payload size ≤ 9000", second.additionalContext.length <= 9000);

console.log("\n▶ Freshness (file modified between prompts)");
const freshId = `smoke-fresh-${Date.now()}`;
handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: freshId }, cwd);
handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: freshId, prompt: "Explain fixtures/raw/SimpleButton.tsx" }, cwd);
// Bump mtime so the next prompt sees a "refreshed" file
const targetFile = path.join(cwd, "fixtures/raw/SimpleButton.tsx");
const newMtime = new Date(Date.now() + 2000);
fs.utimesSync(targetFile, newMtime, newMtime);
const fresh = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: freshId, prompt: "Again, explain fixtures/raw/SimpleButton.tsx" }, cwd);
allPass &= ok('action === "inject"', fresh.action === "inject");
allPass &= ok("repeatedFile === true", fresh.debug?.repeatedFile === true);
allPass &= ok("reasons include 'refreshed-before-inject'", fresh.reasons.includes("refreshed-before-inject"));

console.log("\n▶ Escape hatch (#fooks-full-read)");
const escapeId = `smoke-escape-${Date.now()}`;
handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: escapeId }, cwd);
handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: escapeId, prompt: "Explain fixtures/raw/SimpleButton.tsx" }, cwd);
const escape = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: escapeId, prompt: "Explain fixtures/raw/SimpleButton.tsx #fooks-full-read" }, cwd);
allPass &= ok('action === "fallback"', escape.action === "fallback");
allPass &= ok("fallback.reason === 'escape-hatch-full-read'", escape.fallback?.reason === "escape-hatch-full-read");
allPass &= ok("repeatedFile === false", escape.debug?.repeatedFile === false);
allPass &= ok("escapeHatchUsed === true", escape.debug?.escapeHatchUsed === true);
allPass &= ok("eligible === true", escape.debug?.eligible === true);

console.log("\n▶ Stop hook clears session");
const stopId = `smoke-stop-${Date.now()}`;
const stopStart = handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: stopId }, cwd);
handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: stopId, prompt: "Explain fixtures/raw/SimpleButton.tsx" }, cwd);
const stop = handleClaudeRuntimeHook({ hookEventName: "Stop", sessionId: stopId }, cwd);
allPass &= ok('action === "noop"', stop.action === "noop");
allPass &= ok("reasons include 'session-stop'", stop.reasons.includes("session-stop"));
allPass &= ok("contextMode === 'no-op'", stop.contextMode === "no-op");
allPass &= ok("state file removed", stopStart.statePath && !fs.existsSync(stopStart.statePath));

console.log("\n▶ Payload size baseline");
const { execSync } = await import("node:child_process");
const payloadBytes = Number(execSync("node dist/cli/index.js extract fixtures/raw/SimpleButton.tsx --model-payload | wc -c", { cwd, encoding: "utf8" }).trim());
allPass &= ok(`extract payload ≤ 500 bytes (got ${payloadBytes})`, payloadBytes <= 500);

console.log("\n" + (allPass ? "🟢 All smoke checks passed." : "🔴 Some smoke checks failed."));
process.exit(allPass ? 0 : 1);
