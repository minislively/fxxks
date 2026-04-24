// @ts-check
/// <reference types="node" />

/** @typedef {import('../dist/core/schema.js').ExtractionResult} ExtractionResult */
/** @typedef {import('../dist/core/schema.js').PayloadReadiness} PayloadReadiness */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { cleanupMetricSessions } from "./metric-cleanup.mjs";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);
const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const {
  DESIGN_REVIEW_METADATA_ITEM_CAPS,
  DESIGN_REVIEW_METADATA_SCHEMA_VERSION,
  assessDesignReviewMetadataFreshness,
  deriveDesignReviewMetadata,
} = require(path.join(repoRoot, "dist", "core", "design-review-metadata.js"));
const { RAW_ORIGINAL_SIZE_THRESHOLD_BYTES } = require(path.join(repoRoot, "dist", "core", "decide.js"));
const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));
const { assessPayloadReadiness } = require(path.join(repoRoot, "dist", "core", "payload", "readiness.js"));
const codexPreReadModule = require(path.join(repoRoot, "dist", "adapters", "codex-pre-read.js"));
const { decideCodexPreRead } = codexPreReadModule;
const preReadModule = require(path.join(repoRoot, "dist", "adapters", "pre-read.js"));
const {
  extractPromptTarget,
  hasFullReadEscapeHatch,
} = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-prompt.js"));
const {
  codexRuntimeSessionPath,
} = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-session.js"));
const {
  handleCodexRuntimeHook,
  isEditIntentPrompt,
  hasPositiveFreshness,
} = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
const {
  readProjectMetricSummary,
  readSessionMetricSummary,
  refreshProjectMetricSummaryFromSession,
} = require(path.join(repoRoot, "dist", "core", "session-metrics.js"));
const {
  sessionEventsPath,
  sessionSummaryPath,
  sessionsSummaryPath,
} = require(path.join(repoRoot, "dist", "core", "paths.js"));
const { classifyPromptContext, discoverRelevantFilesByPolicy } = require(path.join(repoRoot, "dist", "core", "context-policy.js"));
const { prepareExecutionContext } = require(path.join(repoRoot, "dist", "adapters", "codex.js"));
const { attachClaude } = require(path.join(repoRoot, "dist", "adapters", "claude.js"));
const { handleCodexNativeHookPayload } = require(path.join(repoRoot, "dist", "adapters", "codex-native-hook.js"));
const { installClaudeHookPreset, claudeLocalSettingsPath } = require(path.join(repoRoot, "dist", "adapters", "claude-hook-preset.js"));
const { handleClaudeRuntimeHook, CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS } = require(path.join(repoRoot, "dist", "adapters", "claude-runtime-hook.js"));
const { readClaudeTrustStatus } = require(path.join(repoRoot, "dist", "adapters", "claude-runtime-trust.js"));
const { handleClaudeNativeHookPayload } = require(path.join(repoRoot, "dist", "adapters", "claude-native-hook.js"));
const { detectRunner } = require(path.join(repoRoot, "dist", "cli", "run.js"));
const ts = require("typescript");

const repoMetricTestSessionPrefixes = ["hook-", "cli-hook-", "bridge-contract-"];
test.after(() => cleanupMetricSessions(repoRoot, repoMetricTestSessionPrefixes));

function run(args, cwd = repoRoot, envOverrides = {}) {
  return JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...envOverrides } }));
}

function runText(args, cwd = repoRoot, envOverrides = {}) {
  return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...envOverrides } });
}

function runTextWithInput(args, input, cwd = repoRoot, envOverrides = {}) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    input,
    env: { ...process.env, ...envOverrides },
  });
}

function collectStrings(value) {
  const strings = [];
  const visit = (item) => {
    if (typeof item === "string") {
      strings.push(item);
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (item && typeof item === "object") {
      for (const child of Object.values(item)) visit(child);
    }
  };
  visit(value);
  return strings;
}

function fileSnapshot(root) {
  if (!fs.existsSync(root)) {
    return ["<missing>"];
  }
  const entries = [];
  const visit = (current) => {
    const stat = fs.statSync(current);
    const relative = path.relative(root, current) || ".";
    if (stat.isDirectory()) {
      entries.push(`${relative}/`);
      for (const child of fs.readdirSync(current).sort()) {
        visit(path.join(current, child));
      }
      return;
    }
    entries.push(`${relative}:${stat.size}:${fs.readFileSync(current, "utf8")}`);
  };
  visit(root);
  return entries;
}

function lineOf(filePath, needle) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  assert.notEqual(index, -1, `expected to find ${needle} in ${filePath}`);
  return index + 1;
}

function lastLineOf(filePath, needle) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const index = lines.findLastIndex((line) => line.includes(needle));
  assert.notEqual(index, -1, `expected to find ${needle} in ${filePath}`);
  return index + 1;
}

function patchTargetKeys(targets) {
  return targets.map((item) => `${item.kind}:${item.label}:${item.loc.startLine}:${item.loc.endLine}`);
}

function withThrowingCodexPreRead(callback) {
  const originalDecideCodexPreRead = codexPreReadModule.decideCodexPreRead;
  const originalDecidePreRead = preReadModule.decidePreRead;
  const throwingFn = () => {
    throw new Error("synthetic payload build failure");
  };
  codexPreReadModule.decideCodexPreRead = throwingFn;
  preReadModule.decidePreRead = throwingFn;

  try {
    return callback();
  } finally {
    codexPreReadModule.decideCodexPreRead = originalDecideCodexPreRead;
    preReadModule.decidePreRead = originalDecidePreRead;
  }
}

function makeTempProject(repositoryUrl = "https://github.com/minislively/temp-project.git") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), path.join(tempDir, "src", "components", "SimpleButton.tsx"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "raw", "Button.types.ts"), path.join(tempDir, "src", "components", "Button.types.ts"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), path.join(tempDir, "src", "components", "FormSection.tsx"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "Button.types.ts"), path.join(tempDir, "src", "components", "Button.types.ts"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.utils.ts"), path.join(tempDir, "src", "components", "FormSection.utils.ts"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"), path.join(tempDir, "src", "components", "DashboardPanel.tsx"));
  fs.writeFileSync(path.join(tempDir, "src", "date-utils.ts"), "export const formatDate = (value) => value.toISOString();\n");
  fs.writeFileSync(
    path.join(tempDir, "src", "components", "DateBadge.tsx"),
    [
      'import React from "react";',
      'import { formatDate } from "../date-utils";',
      "",
      "export function DateBadge({ value }: { value: Date }) {",
      '  return <span>{formatDate(value)}</span>;',
      "}",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "temp-project", repository: { url: repositoryUrl } }, null, 2));
  return tempDir;
}

function makeTempTsJsBetaProject(repositoryUrl = "https://github.com/minislively/temp-ts-js-project.git") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-ts-js-"));
  fs.mkdirSync(path.join(tempDir, "src", "lib"), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "fixtures", "ts-js-beta", "module-utils.ts"), path.join(tempDir, "src", "lib", "module-utils.ts"));
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "temp-ts-js-project", repository: { url: repositoryUrl } }, null, 2));
  return tempDir;
}

function reductionMetrics(filePath) {
  const result = extractFile(path.resolve(filePath));
  const payload = toModelFacingPayload(result, repoRoot);
  const source = fs.readFileSync(filePath, "utf8");
  const sourceBytes = Buffer.byteLength(source, "utf8");
  const resultBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  return {
    mode: result.mode,
    extractionResultReductionPct: (1 - resultBytes / sourceBytes) * 100,
    modelPayloadReductionPct: (1 - payloadBytes / sourceBytes) * 100,
  };
}

function modelPayloadReductionMetrics(filePath, cwd = repoRoot) {
  const result = extractFile(path.resolve(filePath));
  const payload = toModelFacingPayload(result, cwd);
  const source = fs.readFileSync(filePath, "utf8");
  const sourceBytes = Buffer.byteLength(source, "utf8");
  const fullBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  return {
    mode: result.mode,
    sourceBytes,
    fullBytes,
    payloadBytes,
    reductionPct: (1 - payloadBytes / fullBytes) * 100,
    sourcePayloadReductionPct: (1 - payloadBytes / sourceBytes) * 100,
    payload,
  };
}

function runtimeManifestPath(result) {
  const detail = result.runtimeProof.details.find((item) => item.startsWith("runtime-manifest="));
  return detail ? detail.slice("runtime-manifest=".length) : result.runtimeProof.artifactPath;
}

function appendMarker(filePath, marker) {
  const source = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, `${source.trimEnd()}\n${marker}\n`);
}

function withEnv(overrides, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("init creates config and cache contract", () => {
  const tempDir = makeTempProject();
  const result = run(["init"], tempDir);
  assert.ok(result.config.endsWith(path.join(".fooks", "config.json")));
  assert.ok(result.cacheDir.endsWith(path.join(".fooks", "cache")));
  assert.ok(fs.existsSync(path.join(tempDir, ".fooks", "config.json")));
  const config = JSON.parse(fs.readFileSync(path.join(tempDir, ".fooks", "config.json"), "utf8"));
  assert.equal(config.targetAccount, "<your-github-org>");
});

test("init prefers FOOKS_TARGET_ACCOUNT for canonical config writes", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const result = run(["init"], tempDir, { FOOKS_TARGET_ACCOUNT: "minislively" });
  assert.ok(result.config.endsWith(path.join(".fooks", "config.json")));
  const config = JSON.parse(fs.readFileSync(path.join(tempDir, ".fooks", "config.json"), "utf8"));
  assert.equal(config.targetAccount, "minislively");
});

test("detectRunner prefers codex when auth.json is present", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  fs.writeFileSync(path.join(codexHome, "auth.json"), "{}");
  const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-empty-bin-"));

  withEnv({ FOOKS_CODEX_HOME: codexHome, PATH: emptyBin }, () => {
    assert.equal(detectRunner(), "codex");
  });
});

test("detectRunner keeps codex as the product fallback even when omx is available", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-bin-"));
  const omxPath = path.join(binDir, "omx");
  fs.writeFileSync(omxPath, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(omxPath, 0o755);

  withEnv({ FOOKS_CODEX_HOME: codexHome, PATH: binDir }, () => {
    assert.equal(detectRunner(), "codex");
  });
});

test("detectRunner keeps codex as the compatibility fallback when no runner signal exists", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const emptyBin = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-empty-bin-"));

  withEnv({ FOOKS_CODEX_HOME: codexHome, PATH: emptyBin }, () => {
    assert.equal(detectRunner(), "codex");
  });
});

test("extract keeps small fixture raw", () => {
  const result = run(["extract", "fixtures/raw/SimpleButton.tsx"]);
  assert.equal(result.mode, "raw");
  assert.equal(result.useOriginal, true);
  assert.equal(result.componentName, "SimpleButton");
  assert.ok(result.rawText.includes("button"));
  assert.equal(result.meta.rawSizeBytes, 356);
  assert.ok(result.fileHash);
  assert.ok(result.meta.generatedAt);
  assert.equal(result.meta.decideConfidence, "high");
  assert.ok(result.contract.propsSummary.some((item) => item.includes("label")));
  assert.ok(result.style.summary.some((item) => item.includes("tailwind")));
});

test("extract can return model-facing payload without engine metadata", () => {
  const result = run(["extract", "fixtures/compressed/FormSection.tsx", "--model-payload"]);
  assert.equal(result.mode, "compressed");
  assert.equal(result.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.equal("fileHash" in result, false);
  assert.equal("meta" in result, false);
  assert.equal("rawText" in result, false);
  assert.equal(result.componentName, "FormSection");
  assert.equal(result.sourceFingerprint.fileHash.length, 64);
  assert.equal(result.sourceFingerprint.lineCount, 41);
  assert.ok(result.contract.propsSummary.some((item) => item.includes("fields")));
  assert.deepEqual(result.behavior.hooks, []);
  assert.ok(result.structure.sections.includes("section"));
  assert.ok(result.structure.repeatedBlocks.includes("array-map-render"));
  assert.equal(result.style.system, "tailwind");
});

test("extract adds source ranges and hook intent signals to frontend payloads", () => {
  const samplePath = path.join(repoRoot, "fixtures", "compressed", "HookEffectPanel.tsx");
  const result = extractFile(samplePath);
  const defaultPayload = toModelFacingPayload(result, repoRoot);
  assert.deepEqual(defaultPayload.sourceFingerprint, {
    fileHash: result.fileHash,
    lineCount: result.meta.lineCount,
  });
  assert.equal("editGuidance" in defaultPayload, false);

  const payload = toModelFacingPayload(result, repoRoot, { includeEditGuidance: true });

  assert.deepEqual(payload.componentLoc, {
    startLine: lineOf(samplePath, "export function HookEffectPanel"),
    endLine: lastLineOf(samplePath, "}"),
  });
  assert.deepEqual(payload.sourceFingerprint, {
    fileHash: result.fileHash,
    lineCount: result.meta.lineCount,
  });
  assert.deepEqual(payload.editGuidance.freshness, payload.sourceFingerprint);
  assert.ok(payload.editGuidance.instructions.some((item) => item.includes("sourceFingerprint.fileHash") && item.includes("sourceFingerprint.lineCount")));
  assert.ok(payload.editGuidance.instructions.some((item) => item.includes("re-run fooks extract") || item.includes("read the file")));
  assert.ok(payload.editGuidance.instructions.some((item) => item.includes("not LSP-backed")));
  assert.ok(payload.editGuidance.patchTargets.length <= 12);
  const targetKeys = patchTargetKeys(payload.editGuidance.patchTargets);
  assert.deepEqual(targetKeys, [...new Set(targetKeys)]);
  assert.equal(payload.editGuidance.patchTargets[0].kind, "component");
  assert.equal(payload.editGuidance.patchTargets[1].kind, "props");
  assert.equal(payload.contract.propsLoc.startLine, lineOf(samplePath, "type HookEffectPanelProps"));

  const effect = payload.behavior.effectSignals.find((item) => item.hook === "useEffect");
  assert.ok(effect);
  assert.deepEqual(effect.deps, ["loadUser", "userId"]);
  assert.equal(effect.hasCleanup, true);
  assert.equal(effect.hasAsyncWork, true);
  assert.deepEqual(effect.loc, {
    startLine: lineOf(samplePath, "useEffect(() =>"),
    endLine: lineOf(samplePath, "}, [loadUser, userId]);"),
  });
  assert.ok(payload.editGuidance.patchTargets.some((item) => item.kind === "effect" && item.loc.startLine === effect.loc.startLine && item.reason.includes("Effect hook")));

  const memo = payload.behavior.callbackSignals.find((item) => item.hook === "useMemo");
  assert.ok(memo);
  assert.deepEqual(memo.deps, ["name"]);
  assert.equal(memo.loc.startLine, lineOf(samplePath, "const greeting = useMemo"));
  assert.ok(payload.editGuidance.patchTargets.some((item) => item.kind === "callback" && item.loc.startLine === memo.loc.startLine && item.reason.includes("Callback")));

  const callback = payload.behavior.callbackSignals.find((item) => item.hook === "useCallback");
  assert.ok(callback);
  assert.deepEqual(callback.deps, ["loadUser", "userId"]);
  assert.equal(callback.loc.startLine, lineOf(samplePath, "const handleRefresh = useCallback"));

  assert.ok(payload.behavior.eventHandlerSignals.some((item) => item.name === "handleRefresh" && item.loc.startLine === lineOf(samplePath, "const handleRefresh = useCallback")));
  assert.ok(payload.editGuidance.patchTargets.some((item) => item.kind === "event-handler" && item.label === "handleRefresh"));
  assert.ok(payload.snippets.some((item) => item.reason === "effect-hook" && item.loc.startLine === lineOf(samplePath, "useEffect(() =>")));
  assert.ok(payload.editGuidance.patchTargets.some((item) => item.kind === "snippet" && item.loc.startLine === lineOf(samplePath, "useEffect(() =>")));
  assert.equal("fileHash" in payload, false);
  assert.equal("meta" in payload, false);
});

test("extract adds form control and validation surface signals with source ranges", () => {
  const samplePath = path.join(repoRoot, "fixtures", "compressed", "FormControls.tsx");
  const result = extractFile(samplePath);
  const payload = toModelFacingPayload(result, repoRoot, { includeEditGuidance: true });
  const surface = payload.behavior.formSurface;

  assert.ok(surface);
  assert.deepEqual(payload.sourceFingerprint, {
    fileHash: result.fileHash,
    lineCount: result.meta.lineCount,
  });
  assert.deepEqual(payload.editGuidance.freshness, payload.sourceFingerprint);
  assert.ok(payload.editGuidance.patchTargets.length <= 12);
  assert.ok(payload.editGuidance.patchTargets.some((item) => item.kind === "component" && item.label === "FormControls"));
  assert.equal(payload.componentLoc.startLine, lineOf(samplePath, "export function FormControls"));

  const email = surface.controls.find((item) => item.tag === "input" && item.name === "email");
  assert.ok(email);
  assert.equal(email.type, "email");
  assert.deepEqual(email.props, ["name", "type", "required"]);
  assert.deepEqual(email.handlers, ["onChange"]);
  assert.deepEqual(email.loc, {
    startLine: lineOf(samplePath, "<input name=\"email\""),
    endLine: lineOf(samplePath, "<input name=\"email\""),
  });
  assert.ok(payload.editGuidance.patchTargets.some((item) => item.kind === "form-control" && item.label === "input[name=email]" && item.loc.startLine === email.loc.startLine));

  assert.ok(surface.controls.some((item) => item.tag === "select" && item.name === "role" && item.props.includes("defaultValue")));
  assert.ok(surface.controls.some((item) => item.tag === "textarea" && item.name === "notes" && item.props.includes("disabled")));
  assert.ok(surface.submitHandlers.some((item) => item.value === "onSubmit" && item.loc.startLine === lineOf(samplePath, "<form onSubmit")));
  assert.ok(payload.editGuidance.patchTargets.some((item) => item.kind === "submit-handler" && item.label === "onSubmit"));

  const validationAnchors = surface.validationAnchors.map((item) => item.value);
  assert.ok(validationAnchors.includes("useForm"));
  assert.ok(validationAnchors.includes("resolver"));
  assert.ok(validationAnchors.includes("register"));
  assert.ok(validationAnchors.includes("Controller"));
  assert.ok(payload.editGuidance.patchTargets.some((item) => item.kind === "validation-anchor" && item.label === "useForm"));
});

test("extract keeps non-form button event handlers out of form surface", () => {
  const result = extractFile(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"));
  const payload = toModelFacingPayload(result, repoRoot);
  assert.ok(payload.behavior.eventHandlers.includes("onClick"));
  assert.equal(payload.behavior.formSurface, undefined);
  assert.ok(payload.sourceFingerprint);
});

test("compare reports local estimated model-facing payload reduction", () => {
  const result = run(["compare", "fixtures/compressed/FormSection.tsx", "--json"]);
  assert.equal(result.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.equal(result.mode, "compressed");
  assert.equal(result.useOriginal, false);
  assert.equal(result.metricTier, "estimated");
  assert.equal(result.measurement, "local-model-facing-payload");
  assert.ok(result.sourceBytes > result.modelFacingBytes);
  assert.ok(result.estimatedSourceTokens > result.estimatedModelFacingTokens);
  assert.ok(result.savedEstimatedBytes > 0);
  assert.ok(result.savedEstimatedTokens > 0);
  assert.ok(result.reductionPercent > 0);
  assert.equal(result.payloadLarger, false);
  assert.match(result.claimBoundary, /not provider billing tokens/);
  assert.match(result.claimBoundary, /not provider costs/);
  assert.ok(result.excludes.includes("provider-tokenizer-behavior"));
  assert.ok(result.excludes.includes("runtime-hook-envelope-overhead"));
  assert.ok(result.excludes.includes("optional-edit-guidance-overhead"));
});

test("compare keeps tiny raw fallback from reporting false positive savings", () => {
  const result = run(["compare", "fixtures/raw/SimpleButton.tsx", "--json"]);
  assert.equal(result.filePath, path.join("fixtures", "raw", "SimpleButton.tsx"));
  assert.equal(result.mode, "raw");
  assert.equal(result.useOriginal, true);
  assert.equal(result.metricTier, "estimated");
  assert.equal(result.savedEstimatedBytes, 0);
  assert.equal(result.savedEstimatedTokens, 0);
  assert.equal(result.reductionPercent, 0);
  assert.equal(result.payloadLarger, true);
  assert.equal(result.nonSavingReason, "original-source-preserved-for-small-raw-file");
  assert.match(result.claimBoundary, /not provider billing tokens/);
});

test("extract produces compressed output for boilerplate-heavy fixture", () => {
  const result = run(["extract", "fixtures/compressed/FormSection.tsx"]);
  assert.equal(result.mode, "compressed");
  assert.ok(["medium", "high"].includes(result.meta.decideConfidence));
  assert.equal(result.style.system, "tailwind");
  assert.ok(result.structure.repeatedBlocks.includes("array-map-render"));
  assert.equal(result.rawText, undefined);
});

test("extract produces hybrid output for complex fixture", () => {
  const result = run(["extract", "fixtures/hybrid/DashboardPanel.tsx"]);
  assert.equal(result.mode, "hybrid");
  assert.ok(["medium", "high"].includes(result.meta.decideConfidence));
  assert.ok(result.behavior.hooks.includes("useState"));
  assert.ok(result.behavior.eventHandlers.includes("handleAcknowledge"));
  assert.ok(result.snippets.length >= 1);
});

test("model-facing payload keeps hybrid snippets and prunes unknown style noise", () => {
  const fullResult = extractFile(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"));
  const payload = toModelFacingPayload(fullResult, repoRoot);
  assert.equal(payload.mode, "hybrid");
  assert.equal(payload.filePath, path.join("fixtures", "hybrid", "DashboardPanel.tsx"));
  assert.ok(payload.snippets.length >= 1);
  assert.equal("fileHash" in payload, false);
  assert.equal("meta" in payload, false);
  assert.ok(payload.behavior.eventHandlers.includes("handleAcknowledge"));
  assert.ok(payload.structure.conditionalRenders.length >= 1);
});

function designReviewFixture(name) {
  return path.join(repoRoot, "fixtures", "design-review", name);
}

function allDesignEvidenceLists(metadata) {
  return [
    ...metadata.visualRegions.map((item) => item.evidence),
    ...metadata.variantAxes.map((item) => item.evidence),
    ...metadata.stateAxes.map((item) => item.evidence),
    ...metadata.interactionAnchors.map((item) => item.evidence),
    ...metadata.styleReferences.map((item) => item.evidence),
  ];
}

function assertAllDesignItemsHaveEvidence(metadata) {
  for (const evidence of allDesignEvidenceLists(metadata)) {
    assert.ok(Array.isArray(evidence));
    assert.ok(evidence.length > 0);
    for (const ref of evidence) {
      assert.match(ref.source, /^(contract|behavior|structure|style|snippet)$/);
      assert.equal(typeof ref.field, "string");
      assert.ok(ref.field.length > 0);
    }
  }
}

function assertDesignCaps(metadata) {
  assert.ok(metadata.visualRegions.length <= DESIGN_REVIEW_METADATA_ITEM_CAPS.visualRegions);
  assert.ok(metadata.variantAxes.length <= DESIGN_REVIEW_METADATA_ITEM_CAPS.variantAxes);
  assert.ok(metadata.stateAxes.length <= DESIGN_REVIEW_METADATA_ITEM_CAPS.stateAxes);
  assert.ok(metadata.interactionAnchors.length <= DESIGN_REVIEW_METADATA_ITEM_CAPS.interactionAnchors);
  assert.ok(metadata.styleReferences.length <= DESIGN_REVIEW_METADATA_ITEM_CAPS.styleReferences);
}

function designStressItems(count, factory) {
  return Array.from({ length: count }, (_, index) => factory(index));
}

function syntheticCapStressExtraction(baseResult) {
  const manyControls = designStressItems(20, (index) => ({
    tag: index % 2 === 0 ? "input" : "textarea",
    name: `field${index}`,
    loc: { startLine: index + 10, endLine: index + 10 },
  }));
  const manyHandlers = designStressItems(20, (index) => ({
    name: `handleAction${index}`,
    trigger: `onClick${index}`,
    loc: { startLine: index + 40, endLine: index + 40 },
  }));
  const manySubmitHandlers = designStressItems(20, (index) => ({
    value: `handleSubmit${index}`,
    loc: { startLine: index + 70, endLine: index + 70 },
  }));
  const manyValidationAnchors = designStressItems(20, (index) => ({
    value: `validate${index}`,
    loc: { startLine: index + 100, endLine: index + 100 },
  }));

  return {
    ...baseResult,
    mode: "hybrid",
    contract: {
      ...baseResult.contract,
      propsSummary: [
        'variant?: "primary" | "secondary"',
        'tone?: "info" | "warning"',
        'size?: "sm" | "lg"',
        "disabled?: boolean",
        "selected?: boolean",
        "loading?: boolean",
        "compact?: boolean",
      ],
    },
    behavior: {
      ...baseResult.behavior,
      stateSummary: designStressItems(20, (index) => `loading${index}, error${index}`),
      eventHandlerSignals: manyHandlers,
      formSurface: {
        controls: manyControls,
        submitHandlers: manySubmitHandlers,
        validationAnchors: manyValidationAnchors,
      },
    },
    structure: {
      ...baseResult.structure,
      sections: designStressItems(30, (index) => `section${index}`),
      repeatedBlocks: designStressItems(20, (index) => `list${index}`),
      conditionalRenders: designStressItems(20, (index) => `loading${index} || error${index} || selected`),
    },
    style: {
      ...baseResult.style,
      system: "tailwind",
      summary: designStressItems(30, (index) => `tailwind-token-group-${index}`),
      hasStyleBranching: true,
    },
    snippets: designStressItems(20, (index) => ({
      label: `conditional-${index}`,
      code: `{condition${index} ? <span /> : null}`,
      reason: "conditional-render",
      loc: { startLine: index + 130, endLine: index + 130 },
    })),
  };
}

test("design-review metadata derives source-only schema with freshness and contract boundaries", () => {
  const result = extractFile(designReviewFixture("TailwindVariantCard.tsx"));
  const metadata = deriveDesignReviewMetadata(result);

  assert.ok(metadata);
  assert.equal(metadata.schemaVersion, DESIGN_REVIEW_METADATA_SCHEMA_VERSION);
  assert.deepEqual(metadata.freshness, {
    fileHash: result.fileHash,
    lineCount: result.meta.lineCount,
  });
  assert.deepEqual(metadata.scope, {
    kind: "same-component",
    filePath: result.filePath,
    componentName: "TailwindVariantCard",
    componentLoc: result.componentLoc,
  });
  assert.equal(metadata.confidence, "high");
  assert.equal(metadata.compressionContract.sourceDerivedOnly, true);
  assert.equal(metadata.compressionContract.notVisualProof, true);
  assert.equal(metadata.compressionContract.notFigmaBacked, true);
  assert.equal(metadata.compressionContract.notAccessibilityAudit, true);
  assert.equal(metadata.compressionContract.notLspBacked, true);
  assert.equal(metadata.compressionContract.notProviderTokenized, true);
  assert.deepEqual(metadata.compressionContract.maxItems, DESIGN_REVIEW_METADATA_ITEM_CAPS);
  assert.ok(metadata.compressionContract.staleWhen.includes("sourceFingerprint.fileHash changes"));
  assert.equal(metadata.compressionContract.requiredUserActionOnStale, "rerun extraction or read current source before editing");
  assertAllDesignItemsHaveEvidence(metadata);
  assertDesignCaps(metadata);
});

test("design-review metadata covers planned fixture categories conservatively", () => {
  const tailwind = deriveDesignReviewMetadata(extractFile(designReviewFixture("TailwindVariantCard.tsx")));
  assert.ok(tailwind);
  assert.equal(tailwind.confidence, "high");
  assert.deepEqual(
    ["variant", "size", "selected", "disabled"].every((name) => tailwind.variantAxes.some((axis) => axis.name === name)),
    true,
  );
  assert.ok(tailwind.styleReferences.some((item) => item.kind === "tailwind-group"));
  assert.ok(tailwind.visualRegions.some((item) => item.label === "section" || item.label === "TailwindVariantCard"));

  const form = deriveDesignReviewMetadata(extractFile(designReviewFixture("FormStateReview.tsx")));
  assert.ok(form);
  assert.ok(["medium", "high"].includes(form.confidence));
  assert.ok(form.interactionAnchors.some((item) => item.kind === "form-control" && item.label.includes("email")));
  assert.ok(form.interactionAnchors.some((item) => item.kind === "form-control" && item.label.includes("notes")));
  assert.ok(form.interactionAnchors.some((item) => item.kind === "submit-handler"));
  assert.ok(form.stateAxes.some((item) => item.name === "loading"));
  assert.ok(form.stateAxes.some((item) => item.name === "error"));
  assert.ok(form.visualRegions.some((item) => item.kind === "form" || item.kind === "control"));

  const styled = deriveDesignReviewMetadata(extractFile(designReviewFixture("StyledPanel.tsx")));
  assert.ok(styled);
  assert.ok(["medium", "high"].includes(styled.confidence));
  assert.ok(styled.styleReferences.some((item) => item.kind === "styled-component"));
  assert.ok(styled.variantAxes.some((axis) => axis.name === "tone"));
  assert.ok(styled.variantAxes.some((axis) => axis.name === "compact"));
  assert.ok(styled.visualRegions.some((item) => item.label === "PanelRoot" || item.label === "StyledPanel"));

  const generic = deriveDesignReviewMetadata(extractFile(designReviewFixture("GenericLayout.tsx")));
  assert.ok(generic);
  assert.notEqual(generic.confidence, "high");
  assert.deepEqual(generic.variantAxes, []);
  assert.deepEqual(generic.stateAxes, []);

  for (const metadata of [tailwind, form, styled, generic]) {
    assertAllDesignItemsHaveEvidence(metadata);
    assertDesignCaps(metadata);
  }
});

test("design-review metadata enforces item caps on over-cap extraction signals", () => {
  const baseResult = extractFile(designReviewFixture("TailwindVariantCard.tsx"));
  const metadata = deriveDesignReviewMetadata(syntheticCapStressExtraction(baseResult));

  assert.ok(metadata);
  assert.equal(metadata.visualRegions.length, DESIGN_REVIEW_METADATA_ITEM_CAPS.visualRegions);
  assert.ok(metadata.variantAxes.length <= DESIGN_REVIEW_METADATA_ITEM_CAPS.variantAxes);
  assert.equal(metadata.stateAxes.length, DESIGN_REVIEW_METADATA_ITEM_CAPS.stateAxes);
  assert.equal(metadata.interactionAnchors.length, DESIGN_REVIEW_METADATA_ITEM_CAPS.interactionAnchors);
  assert.equal(metadata.styleReferences.length, DESIGN_REVIEW_METADATA_ITEM_CAPS.styleReferences);
  assertAllDesignItemsHaveEvidence(metadata);
  assertDesignCaps(metadata);
});

test("design-review metadata blocks stale freshness from edit-safe use", () => {
  const result = extractFile(designReviewFixture("TailwindVariantCard.tsx"));
  const metadata = deriveDesignReviewMetadata(result);
  assert.ok(metadata);

  const changed = assessDesignReviewMetadataFreshness(metadata, {
    fileHash: metadata.freshness.fileHash === "0".repeat(64) ? "1".repeat(64) : "0".repeat(64),
    lineCount: metadata.freshness.lineCount + 1,
  });

  assert.equal(changed.fresh, false);
  assert.equal(changed.usableForEditing, false);
  assert.ok(changed.reasons.includes("stale-fileHash"));
  assert.ok(changed.reasons.includes("stale-lineCount"));
  assert.equal(changed.requiredUserActionOnStale, "rerun extraction or read current source before editing");

  const fresh = assessDesignReviewMetadataFreshness(metadata, metadata.freshness);
  assert.deepEqual(fresh, {
    fresh: true,
    usableForEditing: true,
    reasons: ["fresh"],
  });
});

test("design-review helper remains internal and default model-facing payloads stay unchanged", () => {
  const tailwindResult = extractFile(designReviewFixture("TailwindVariantCard.tsx"));
  const defaultPayload = toModelFacingPayload(tailwindResult, repoRoot);
  const guidedPayload = toModelFacingPayload(tailwindResult, repoRoot, { includeEditGuidance: true });
  const cliPayload = run(["extract", "fixtures/design-review/TailwindVariantCard.tsx", "--model-payload"]);
  const modulePayload = run(["extract", "fixtures/ts-js-beta/module-utils.ts", "--model-payload"]);
  const rawPayload = toModelFacingPayload(extractFile(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx")), repoRoot);

  for (const payload of [defaultPayload, guidedPayload, cliPayload, modulePayload, rawPayload]) {
    assert.equal("designReviewMetadata" in payload, false);
  }
  assert.equal("editGuidance" in defaultPayload, false);
  assert.equal("editGuidance" in guidedPayload, true);
  assert.equal("editGuidance" in cliPayload && "designReviewMetadata" in cliPayload.editGuidance, false);
  assert.equal("editGuidance" in modulePayload, false);
});

test("model-facing payload uses original source for tiny raw fixtures", () => {
  const fullResult = extractFile(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"));
  const payload = toModelFacingPayload(fullResult, repoRoot);
  assert.deepEqual(payload, {
    mode: "raw",
    filePath: path.join("fixtures", "raw", "SimpleButton.tsx"),
    useOriginal: true,
    rawText: fullResult.rawText,
  });
});

test("readiness helper uses stable reasons and ignores debug metadata", () => {
  const compressed = extractFile(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"));
  const compressedPayload = toModelFacingPayload(compressed, repoRoot);
  const compressedReadiness = assessPayloadReadiness(compressed, compressedPayload);
  assert.equal(compressedReadiness.ready, true);
  assert.deepEqual(compressedReadiness.reasons, []);

  const raw = extractFile(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"));
  const rawPayload = toModelFacingPayload(raw, repoRoot);
  const rawReadiness = assessPayloadReadiness(raw, rawPayload);
  assert.equal(rawReadiness.ready, true);
  assert.deepEqual(rawReadiness.reasons, []);
  assert.equal(rawPayload.useOriginal, true);
  assert.equal(rawPayload.rawText, raw.rawText);

  const missingContract = assessPayloadReadiness(compressed, { ...compressedPayload, contract: undefined });
  assert.ok(missingContract.reasons.includes("missing-contract"));

  const missingBehavior = assessPayloadReadiness(compressed, { ...compressedPayload, behavior: undefined });
  assert.ok(missingBehavior.reasons.includes("missing-behavior"));

  const missingStructure = assessPayloadReadiness(compressed, { ...compressedPayload, structure: undefined });
  assert.ok(missingStructure.reasons.includes("missing-structure"));

  const hybrid = extractFile(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"));
  const hybridPayload = toModelFacingPayload(hybrid, repoRoot);
  const missingSnippets = assessPayloadReadiness(hybrid, { ...hybridPayload, snippets: undefined });
  assert.ok(missingSnippets.reasons.includes("missing-hybrid-snippets"));

  assert.equal(compressedReadiness.signals.usedComplexityScore, false);
  assert.equal(compressedReadiness.signals.usedDecideReason, false);
});

test("codex pre-read chooses payload for eligible tsx/jsx and fallback otherwise", () => {
  const compressed = decideCodexPreRead(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), repoRoot);
  assert.equal(compressed.eligible, true);
  assert.equal(compressed.decision, "payload");
  assert.equal(compressed.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.ok(compressed.payload);
  assert.ok(compressed.payload.sourceFingerprint);
  assert.equal("editGuidance" in compressed.payload, false);
  assert.ok(["low", "medium", "high"].includes(compressed.debug.decideConfidence));

  const compressedOptIn = preReadModule.decidePreRead(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), repoRoot, "codex", {
    includeEditGuidance: true,
  });
  assert.equal(compressedOptIn.decision, "payload");
  assert.ok(compressedOptIn.payload.editGuidance);
  assert.deepEqual(compressedOptIn.payload.editGuidance.freshness, compressedOptIn.payload.sourceFingerprint);
  assert.ok(compressedOptIn.payload.editGuidance.patchTargets.length <= 12);

  const hybrid = decideCodexPreRead(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"), repoRoot);
  assert.equal(hybrid.decision, "payload");
  assert.ok(hybrid.payload.snippets?.length);
  assert.equal("editGuidance" in hybrid.payload, false);
  assert.ok(["medium", "high"].includes(hybrid.debug.decideConfidence));

  const jsx = decideCodexPreRead(path.join(repoRoot, "fixtures", "jsx", "SimpleWidget.jsx"), repoRoot);
  assert.equal(jsx.eligible, true);
  assert.equal(jsx.decision, "payload");
  assert.equal(jsx.filePath, path.join("fixtures", "jsx", "SimpleWidget.jsx"));
  assert.ok(jsx.payload.contract);
  assert.equal("editGuidance" in jsx.payload, false);

  const moduleTs = decideCodexPreRead(path.join(repoRoot, "fixtures", "ts-js-beta", "module-utils.ts"), repoRoot);
  assert.equal(moduleTs.eligible, true);
  assert.equal(moduleTs.decision, "payload");
  assert.equal(moduleTs.debug.language, "ts");
  assert.ok(moduleTs.payload.structure.moduleDeclarations?.length);
  assert.equal("editGuidance" in moduleTs.payload, false);

  const moduleTsWithGuidance = preReadModule.decidePreRead(
    path.join(repoRoot, "fixtures", "ts-js-beta", "module-utils.ts"),
    repoRoot,
    "codex",
    { includeEditGuidance: true },
  );
  assert.equal(moduleTsWithGuidance.decision, "payload");
  assert.equal("editGuidance" in moduleTsWithGuidance.payload, false);

  const moduleJs = decideCodexPreRead(path.join(repoRoot, "fixtures", "ts-js-beta", "module-config.js"), repoRoot);
  assert.equal(moduleJs.eligible, true);
  assert.equal(moduleJs.decision, "payload");
  assert.equal(moduleJs.debug.language, "js");
  assert.ok(moduleJs.payload.structure.moduleDeclarations?.length);

  const raw = decideCodexPreRead(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), repoRoot);
  assert.equal(raw.eligible, true);
  assert.equal(raw.decision, "payload");
  assert.deepEqual(raw.reasons, []);
  assert.equal(raw.payload.useOriginal, true);
  assert.equal(raw.payload.rawText?.length, 356);

  const weakTs = decideCodexPreRead(path.join(repoRoot, "fixtures", "ts-js-beta", "empty.ts"), repoRoot);
  assert.equal(weakTs.eligible, true);
  assert.equal(weakTs.decision, "fallback");
  assert.ok(weakTs.reasons.includes("missing-module-structure"));
  assert.equal(weakTs.fallback.reason, "missing-module-structure");

  const claudeTs = preReadModule.decidePreRead(path.join(repoRoot, "fixtures", "ts-js-beta", "module-utils.ts"), repoRoot, "claude");
  assert.equal(claudeTs.eligible, false);
  assert.equal(claudeTs.decision, "fallback");
  assert.ok(claudeTs.reasons.includes("ineligible-extension"));

  const linkedTs = decideCodexPreRead(path.join(repoRoot, "fixtures", "ts-linked", "Button.types.ts"), repoRoot);
  assert.equal(linkedTs.eligible, true);
  assert.equal(linkedTs.decision, "payload");
  assert.ok(linkedTs.payload.structure.moduleDeclarations?.length);
  assert.equal(linkedTs.debug.language, "ts");
});

test("codex pre-read falls back for larger raw files past the original-source threshold", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-large-raw-"));
  const largeRawPath = path.join(tempDir, "LargeRawButton.tsx");
  const baseSource = fs.readFileSync(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), "utf8").trimEnd();
  fs.writeFileSync(largeRawPath, `${baseSource}\n/* ${"x".repeat(220)} */\n`);

  const result = decideCodexPreRead(largeRawPath, tempDir);
  assert.equal(result.debug.mode, "raw");
  assert.equal(result.decision, "fallback");
  assert.ok(result.reasons.includes("raw-mode"));
  assert.equal(result.fallback.reason, "raw-mode");
});

test("codex pre-read keeps original payloads for small raw files below the validated floor", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-small-raw-"));
  const rawPath = path.join(tempDir, "SmallRawButton.tsx");
  const baseSource = fs.readFileSync(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), "utf8").trimEnd();
  let extracted;
  for (let extraBytes = 1; extraBytes < 220; extraBytes += 1) {
    fs.writeFileSync(rawPath, `${baseSource}\n/* ${"x".repeat(extraBytes)} */\n`);
    extracted = extractFile(rawPath);
    if (extracted.meta.rawSizeBytes > 200 && extracted.meta.rawSizeBytes < RAW_ORIGINAL_SIZE_THRESHOLD_BYTES) {
      break;
    }
  }

  assert.ok(extracted);
  assert.equal(extracted.mode, "raw");
  assert.ok(extracted.meta.rawSizeBytes > 200);
  assert.ok(extracted.meta.rawSizeBytes < RAW_ORIGINAL_SIZE_THRESHOLD_BYTES);

  const result = decideCodexPreRead(rawPath, tempDir);
  assert.equal(result.decision, "payload");
  assert.equal(result.payload.useOriginal, true);
  assert.equal(result.payload.rawText, extracted.rawText);
});

test("cli codex-pre-read reuses the same decision seam and advertises the command", () => {
  const cliPayload = run(["codex-pre-read", "fixtures/compressed/FormSection.tsx"]);
  const directPayload = decideCodexPreRead(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), repoRoot);
  assert.deepEqual(cliPayload, directPayload);

  const cliJsx = run(["codex-pre-read", "fixtures/jsx/SimpleWidget.jsx"]);
  const directJsx = decideCodexPreRead(path.join(repoRoot, "fixtures", "jsx", "SimpleWidget.jsx"), repoRoot);
  assert.deepEqual(cliJsx, directJsx);

  const cliFallback = run(["codex-pre-read", "fixtures/raw/SimpleButton.tsx"]);
  assert.equal(cliFallback.decision, "payload");
  assert.equal(cliFallback.payload.useOriginal, true);

  let usage = "";
  try {
    runText(["unknown-command"]);
  } catch (error) {
    usage = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(usage, /codex-pre-read/);
});

test("runtime prompt parser finds eligible tsx/jsx paths and escape hatches", () => {
  const promptDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-prompt-target-"));
  fs.mkdirSync(path.join(promptDir, "components"), { recursive: true });
  fs.writeFileSync(path.join(promptDir, "components", "QuestionAnswerForm.tsx"), "export function QuestionAnswerForm() { return null; }\n");
  const tsxTarget = extractPromptTarget("Please update components/QuestionAnswerForm.tsx for this flow", promptDir);
  assert.equal(tsxTarget, path.join("components", "QuestionAnswerForm.tsx"));

  const jsxTarget = extractPromptTarget("Review fixtures/jsx/SimpleWidget.jsx for repeated work", repoRoot);
  assert.equal(jsxTarget, path.join("fixtures", "jsx", "SimpleWidget.jsx"));

  const newRelativeTsxTarget = extractPromptTarget("Create src/components/NewCard.tsx for this feature", repoRoot);
  assert.equal(newRelativeTsxTarget, path.join("src", "components", "NewCard.tsx"));

  const newRelativeJsxTarget = extractPromptTarget("Add src/widgets/NewWidget.jsx before wiring it up", repoRoot);
  assert.equal(newRelativeJsxTarget, path.join("src", "widgets", "NewWidget.jsx"));

  const traversalTarget = extractPromptTarget("Edit ../outside/HiddenPanel.tsx next", repoRoot);
  assert.equal(traversalTarget, null);

  const absoluteMissingTarget = extractPromptTarget("Create /tmp/BrandNewPanel.tsx for this flow", repoRoot);
  assert.equal(absoluteMissingTarget, null);

  const absoluteOutsideExistingTarget = extractPromptTarget(
    `Inspect ${path.join(repoRoot, "..", "ai-job-finder", "components", "QuestionAnswerForm.tsx")} as well`,
    repoRoot,
  );
  assert.equal(absoluteOutsideExistingTarget, null);

  const tsTarget = extractPromptTarget("Check fixtures/ts-linked/Button.types.ts too", repoRoot);
  assert.equal(tsTarget, null);

  const codexTsTarget = extractPromptTarget("Check fixtures/ts-linked/Button.types.ts too", repoRoot, "codex-ts-js-beta");
  assert.equal(codexTsTarget, path.join("fixtures", "ts-linked", "Button.types.ts"));

  const codexJsTarget = extractPromptTarget("Inspect fixtures/ts-js-beta/module-config.js please", repoRoot, "codex-ts-js-beta");
  assert.equal(codexJsTarget, path.join("fixtures", "ts-js-beta", "module-config.js"));

  assert.equal(hasFullReadEscapeHatch("Need exact source #fooks-full-read"), true);
  assert.equal(hasFullReadEscapeHatch("Need exact source #fooks-disable-pre-read"), true);
  assert.equal(hasFullReadEscapeHatch("No override here"), false);
});

test("shared context policy distinguishes exact-file light/no-op from ambiguous auto", () => {
  const tempDir = makeTempProject();
  const exactExisting = classifyPromptContext("Modify exactly src/components/FormSection.tsx", tempDir);
  assert.equal(exactExisting.promptSpecificity, "exact-file");
  assert.equal(exactExisting.contextMode, "light");
  assert.equal(exactExisting.selectionSource, "explicit-path");
  assert.equal(exactExisting.contextBudget.maxFiles, 1);
  assert.equal(exactExisting.contextBudget.selectedFiles, 1);

  const exactNew = classifyPromptContext("Create src/components/NewPanel.tsx", tempDir);
  assert.equal(exactNew.promptSpecificity, "exact-file");
  assert.equal(exactNew.contextMode, "no-op");
  assert.equal(exactNew.contextBudget.selectedFiles, 0);

  const codexTs = classifyPromptContext("Inspect fixtures/ts-linked/Button.types.ts", repoRoot, "codex-ts-js-beta");
  assert.equal(codexTs.promptSpecificity, "exact-file");
  assert.equal(codexTs.contextMode, "light");
  assert.equal(codexTs.targets[0].filePath, path.join("fixtures", "ts-linked", "Button.types.ts"));

  const ambiguous = discoverRelevantFilesByPolicy("Add loading state to the form section", discoverProjectFilesForTest(tempDir), tempDir);
  assert.equal(ambiguous.policy.promptSpecificity, "ambiguous");
  assert.equal(ambiguous.policy.contextMode, "auto");
  assert.ok(ambiguous.files.length > 0);
  assert.ok(ambiguous.files.length <= 5);
});

test("ts/js extraction and readiness stay module-gated", () => {
  const moduleTs = extractFile(path.join(repoRoot, "fixtures", "ts-js-beta", "module-utils.ts"));
  assert.equal(moduleTs.language, "ts");
  assert.ok(moduleTs.structure.moduleDeclarations?.some((item) => item.value === "formatAmount"));
  const moduleTsPayload = toModelFacingPayload(moduleTs, repoRoot);
  assert.ok(moduleTsPayload.structure.moduleDeclarations?.length);
  const moduleTsReadiness = assessPayloadReadiness(moduleTs, moduleTsPayload);
  assert.equal(moduleTsReadiness.ready, true);
  assert.equal(moduleTsReadiness.reasons.includes("missing-module-structure"), false);

  const moduleJs = extractFile(path.join(repoRoot, "fixtures", "ts-js-beta", "module-config.js"));
  assert.equal(moduleJs.language, "js");
  assert.ok(moduleJs.structure.moduleDeclarations?.some((item) => item.value === "mergeThemeConfig"));
  const moduleJsPayload = toModelFacingPayload(moduleJs, repoRoot);
  assert.ok(moduleJsPayload.structure.moduleDeclarations?.length);
  assert.equal(assessPayloadReadiness(moduleJs, moduleJsPayload).ready, true);

  const weakTs = extractFile(path.join(repoRoot, "fixtures", "ts-js-beta", "empty.ts"));
  assert.equal(weakTs.language, "ts");
  const weakTsPayload = toModelFacingPayload(weakTs, repoRoot);
  const weakTsReadiness = assessPayloadReadiness(weakTs, weakTsPayload);
  assert.equal(weakTsReadiness.ready, false);
  assert.ok(weakTsReadiness.reasons.includes("missing-module-structure"));

  const weakJs = extractFile(path.join(repoRoot, "fixtures", "ts-js-beta", "weak-config.js"));
  assert.equal(weakJs.language, "js");
  assert.ok(weakJs.structure.moduleDeclarations?.some((item) => item.kind === "variable"));
  const weakJsPayload = toModelFacingPayload(weakJs, repoRoot, { includeEditGuidance: true });
  const weakJsReadiness = assessPayloadReadiness(weakJs, weakJsPayload);
  assert.equal(weakJsReadiness.ready, false);
  assert.ok(weakJsReadiness.reasons.includes("missing-module-structure"));
  assert.equal("editGuidance" in weakJsPayload, false);
});

function discoverProjectFilesForTest(cwd) {
  return [
    { filePath: path.join("src", "components", "FormSection.tsx"), kind: "component" },
    { filePath: path.join("src", "components", "SimpleButton.tsx"), kind: "component" },
    { filePath: path.join("src", "components", "DashboardPanel.tsx"), kind: "component" },
  ];
}

test("prepareExecutionContext writes context policy metadata and resolves files from cwd", async () => {
  const tempDir = makeTempProject();
  const policy = classifyPromptContext("Modify src/components/FormSection.tsx", tempDir);
  const result = await prepareExecutionContext("Modify src/components/FormSection.tsx", [path.join("src", "components", "FormSection.tsx")], tempDir, policy);
  assert.equal(result.contextMode, "light");
  assert.equal(result.promptSpecificity, "exact-file");
  const context = fs.readFileSync(result.contextPath, "utf8");
  assert.match(context, /fooks-context-policy/);
  assert.match(context, /"contextMode":"light"/);
  assert.match(context, /## src\/components\/FormSection.tsx/);
});

test("cli run keeps exact-file prompts to one light context file", () => {
  const tempDir = makeTempProject();
  const output = runText(["run", "Please", "update", "src/components/FormSection.tsx"], tempDir);
  assert.match(output, /Shared Handoff Context/);
  assert.match(output, /Context mode: light/);
  assert.match(output, /1 files/);
  assert.match(output, /Manual next steps:/);
  assert.match(output, /Inspect the shared context: cat /);
  assert.match(output, /Codex: start `codex` in this repo, then paste your prompt and the context from .*temp-context\.md/);
  assert.match(output, /Claude: start `claude` in this repo, then paste your prompt and the context from .*temp-context\.md/);
  assert.match(output, /preferred runtime \(codex or claude\)/);
  assert.match(output, /estimated extraction opportunity \d+%/);
  assert.doesNotMatch(output, /\d+% smaller/);
  assert.doesNotMatch(output, /Detected runner:/);
  assert.doesNotMatch(output, /--context/);
  assert.doesNotMatch(output, /hook installer/i);
  const context = fs.readFileSync(path.join(tempDir, ".fooks", "temp-context.md"), "utf8");
  assert.match(context, /"contextMode":"light"/);
  assert.match(context, /## src\/components\/FormSection.tsx/);
  assert.doesNotMatch(context, /## src\/components\/SimpleButton.tsx/);
});

test("cli run gives direct no-op guidance for new or missing exact-file targets", () => {
  const tempDir = makeTempProject();
  const output = runText(["run", "Please", "update", "src/components/NewPanel.tsx"], tempDir);
  assert.match(output, /Shared Handoff Context/);
  assert.match(output, /Context mode: no-op \(exact-file-new-or-missing-target\)/);
  assert.match(output, /Files: 0, Size: 0\.0KB/);
  assert.match(output, /No reusable source context was selected\./);
  assert.match(output, /This usually means your prompt targets a new or missing file, so the temp context is metadata-only\./);
  assert.match(output, /Reliable first success: run `fooks setup` in this repo first\./);
  assert.match(output, /When setup reports ready, open `codex` in this repo and use your original prompt directly\./);
  assert.match(output, /Optional check: `fooks status codex`/);
  assert.match(output, /If you intentionally want another runtime, use your original prompt there instead of the metadata-only temp context\./);
  assert.match(output, /Metadata-only context file: .*temp-context\.md/);
  assert.doesNotMatch(output, /Inspect the shared context: cat /);
  assert.doesNotMatch(output, /then paste your prompt and the context from/);
  assert.doesNotMatch(output, /preferred runtime \(codex or claude\)/);
  const context = fs.readFileSync(path.join(tempDir, ".fooks", "temp-context.md"), "utf8");
  assert.match(context, /"contextMode":"no-op"/);
  assert.doesNotMatch(context, /## src\/components\/NewPanel\.tsx/);
});

test("cli run prefers direct Codex prompt guidance when setup is already ready on the no-op branch", () => {
  const tempDir = makeTempProject();
  const codexStatusDir = path.join(tempDir, ".fooks", "adapters", "codex");
  fs.mkdirSync(codexStatusDir, { recursive: true });
  fs.writeFileSync(
    path.join(codexStatusDir, "status.json"),
    JSON.stringify(
      {
        runtime: "codex",
        connectionState: "connected",
        lifecycleState: "ready",
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const output = runText(["run", "Please", "update", "src/components/NewPanel.tsx"], tempDir);
  assert.match(output, /Codex setup already looks ready for this repo\./);
  assert.match(output, /Open `codex` in this repo and use your original prompt directly\./);
  assert.match(output, /If you intentionally want another runtime, use your original prompt there instead of the metadata-only temp context\./);
  assert.doesNotMatch(output, /Reliable first success: run `fooks setup` in this repo first\./);
  assert.doesNotMatch(output, /Optional check: `fooks status codex`/);
});

test("runtime hook falls back when repeated-file payload build throws", () => {
  const tempDir = makeTempProject();
  const sessionId = `hook-payload-throw-${Date.now()}`;
  const target = path.join("src", "components", "FormSection.tsx");
  const targetBytes = fs.statSync(path.join(tempDir, target)).size;

  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  const first = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Please inspect ${target}`,
    },
    tempDir,
  );
  assert.equal(first.action, "record");

  withThrowingCodexPreRead(() => {
    const fallback = handleCodexRuntimeHook(
      {
        hookEventName: "UserPromptSubmit",
        sessionId,
        prompt: `Again, update ${target}`,
      },
      tempDir,
    );

    assert.equal(fallback.action, "fallback");
    assert.equal(fallback.filePath, target);
    assert.deepEqual(fallback.reasons, ["repeated-file", "payload-build-failed"]);
    assert.equal(fallback.contextMode, "full");
    assert.equal(fallback.contextModeReason, "payload-build-failed");
    assert.equal(fallback.fallback.action, "full-read");
    assert.equal(fallback.fallback.reason, "payload-build-failed");
    assert.equal(fallback.debug.repeatedFile, true);
    assert.equal(fallback.debug.eligible, true);
    assert.equal(fallback.debug.escapeHatchUsed, false);
    assert.equal(fallback.debug.decision, undefined);

    const summary = readSessionMetricSummary(tempDir, sessionId);
    assert.equal(summary.eventCount, 2);
    assert.equal(summary.recordCount, 1);
    assert.equal(summary.fallbackCount, 1);
    assert.equal(summary.comparableEventCount, 1);
    assert.equal(summary.totals.originalEstimatedBytes, targetBytes);
    assert.equal(summary.totals.actualEstimatedBytes, targetBytes);
    assert.equal(summary.totals.savedEstimatedBytes, 0);
  });
});

test("runtime hook reuses payload only on repeated same-file prompts in one session", () => {
  const sessionId = `hook-repeat-${Date.now()}`;
  const start = handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, repoRoot);
  assert.equal(start.action, "noop");
  assert.match(start.statePath, /\.fooks\/state\/codex-runtime/);
  assert.ok(fs.existsSync(codexRuntimeSessionPath(repoRoot, sessionId)));

  const first = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  assert.equal(first.action, "record");
  assert.equal(first.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.equal(first.contextMode, "no-op");
  assert.equal(first.promptSpecificity, "exact-file");
  assert.equal(first.additionalContext, undefined);
  assert.match(first.statePath, /\.fooks\/state\/codex-runtime/);

  const second = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Again, update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  assert.equal(second.action, "inject");
  assert.equal(second.contextMode, "light");
  assert.equal(second.contextModeReason, "repeated-exact-file-edit-guidance");
  assert.equal(second.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.ok(
    second.additionalContext.startsWith(
      `fooks: reused pre-read (compressed) · file: ${path.join("fixtures", "compressed", "FormSection.tsx")}`,
    ),
  );
  assert.equal(second.additionalContext.includes("#fooks-full-read"), false);
  assert.equal(second.additionalContext.includes("#fooks-disable-pre-read"), false);
  assert.equal(second.additionalContext.includes("\"editGuidance\""), true);
  assert.ok(second.reasons.includes("edit-guidance-opt-in"));
  assert.equal(second.debug.repeatedFile, true);
  assert.deepEqual(second.debug.decision.payload.editGuidance.freshness, second.debug.decision.payload.sourceFingerprint);
  assert.ok(second.debug.decision.payload.editGuidance.patchTargets.length <= 12);

  fs.writeFileSync(second.statePath, "{not-json");
  const afterCorruptState = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Again, update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  assert.equal(afterCorruptState.action, "record");
  assert.equal(afterCorruptState.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
});

test("edit intent detection includes common exact-file coding verbs used by Codex prompts", () => {
  for (const prompt of [
    "Please implement fixtures/compressed/FormSection.tsx",
    "Rename a prop in fixtures/compressed/FormSection.tsx",
    "Replace the validation branch in fixtures/compressed/FormSection.tsx",
    "Adjust fixtures/compressed/FormSection.tsx",
    "Simplify fixtures/compressed/FormSection.tsx",
    "Rewrite fixtures/compressed/FormSection.tsx",
  ]) {
    assert.equal(isEditIntentPrompt(prompt), true, prompt);
  }

  for (const prompt of [
    "Explain fixtures/compressed/FormSection.tsx",
    "Review only fixtures/compressed/FormSection.tsx",
    "Summarize fixtures/compressed/FormSection.tsx",
  ]) {
    assert.equal(isEditIntentPrompt(prompt), false, prompt);
  }
});

test("runtime hook treats implement and rename prompts as safe edit-intent guidance candidates", () => {
  const target = path.join("fixtures", "compressed", "FormSection.tsx");

  const implementSession = `hook-implement-edit-guidance-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: implementSession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: implementSession,
      prompt: `Please implement a new validation path in ${target}`,
    },
    repoRoot,
  );
  const implementSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: implementSession,
      prompt: `Again, implement the validation change in ${target}`,
    },
    repoRoot,
  );
  assert.equal(implementSecond.action, "inject");
  assert.equal(implementSecond.contextModeReason, "repeated-exact-file-edit-guidance");
  assert.equal(implementSecond.additionalContext.includes("\"editGuidance\""), true);
  assert.equal(implementSecond.reasons.includes("edit-guidance-opt-in"), true);

  const renameSession = `hook-rename-edit-guidance-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: renameSession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: renameSession,
      prompt: `Please rename a prop in ${target}`,
    },
    repoRoot,
  );
  const renameSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: renameSession,
      prompt: `Again, rename the prop in ${target}`,
    },
    repoRoot,
  );
  assert.equal(renameSecond.action, "inject");
  assert.equal(renameSecond.contextModeReason, "repeated-exact-file-edit-guidance");
  assert.equal(renameSecond.additionalContext.includes("\"editGuidance\""), true);
  assert.equal(renameSecond.reasons.includes("edit-guidance-opt-in"), true);
});

test("runtime hook gates edit guidance to repeated exact-file edit intent prompts", () => {
  const target = path.join("fixtures", "compressed", "FormSection.tsx");

  const inspectSession = `hook-inspect-no-edit-guidance-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: inspectSession }, repoRoot);
  const firstInspect = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: inspectSession,
      prompt: `Please inspect ${target}`,
    },
    repoRoot,
  );
  const secondInspect = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: inspectSession,
      prompt: `Again, explain ${target}`,
    },
    repoRoot,
  );
  assert.equal(firstInspect.action, "record");
  assert.equal(secondInspect.action, "inject");
  assert.equal(secondInspect.contextModeReason, "repeated-exact-file-payload");
  assert.equal(secondInspect.additionalContext.includes("\"editGuidance\""), false);
  assert.equal("editGuidance" in secondInspect.debug.decision.payload, false);
  assert.equal(secondInspect.reasons.includes("edit-guidance-opt-in"), false);

  const reviewOnlySession = `hook-review-only-no-edit-guidance-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: reviewOnlySession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: reviewOnlySession,
      prompt: `Please review only ${target}`,
    },
    repoRoot,
  );
  const reviewOnly = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: reviewOnlySession,
      prompt: `Again, review only ${target}`,
    },
    repoRoot,
  );
  assert.equal(reviewOnly.action, "inject");
  assert.equal(reviewOnly.additionalContext.includes("\"editGuidance\""), false);
  assert.equal(reviewOnly.reasons.includes("edit-guidance-opt-in"), false);

  const multiFileSession = `hook-multifile-no-edit-guidance-${Date.now()}`;
  const otherTarget = path.join("fixtures", "jsx", "SimpleWidget.jsx");
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: multiFileSession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: multiFileSession,
      prompt: `Please update ${target} and ${otherTarget}`,
    },
    repoRoot,
  );
  const multiFile = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: multiFileSession,
      prompt: `Again, fix ${target} and ${otherTarget}`,
    },
    repoRoot,
  );
  assert.equal(multiFile.action, "inject");
  assert.equal(multiFile.promptSpecificity, "exact-file");
  assert.equal(multiFile.additionalContext.includes("\"editGuidance\""), false);
  assert.equal(multiFile.reasons.includes("edit-guidance-opt-in"), false);
});

test("bare status reports fast estimated session savings without exposing session contribution internals", () => {
  const tempDir = makeTempProject();
  const empty = run(["status"], tempDir);
  assert.equal(empty.schemaVersion, 1);
  assert.equal(empty.metricTier, "estimated");
  assert.equal(empty.sessionCount, 0);
  assert.equal(empty.latestSessionCount, 0);
  assert.equal(empty.eventCount, 0);
  assert.equal(empty.totals.savedEstimatedBytes, 0);
  assert.deepEqual(empty.breakdown.byRuntime, {});
  assert.deepEqual(empty.breakdown.byMeasurementSource, {});
  assert.deepEqual(empty.breakdown.byRuntimeAndSource, {});
  assert.equal("sessions" in empty, false);
  assert.equal("latestSessionKeys" in empty, false);
  assert.match(empty.claimBoundary, /not provider billing tokens/);
});

test("legacy unqualified metric summaries migrate to codex automatic hook identity", () => {
  const tempDir = makeTempProject();
  const legacySessionKey = "legacy-session";
  const timestamp = "2026-04-21T00:00:00.000Z";
  const usage = {
    originalEstimatedBytes: 400,
    actualEstimatedBytes: 100,
    savedEstimatedBytes: 300,
    originalEstimatedTokens: 100,
    actualEstimatedTokens: 25,
    savedEstimatedTokens: 75,
    savingsRatio: 0.75,
  };
  fs.mkdirSync(path.dirname(sessionSummaryPath(tempDir, legacySessionKey)), { recursive: true });
  fs.writeFileSync(
    sessionSummaryPath(tempDir, legacySessionKey),
    JSON.stringify(
      {
        schemaVersion: 1,
        metricTier: "estimated",
        sessionKey: legacySessionKey,
        sanitizedSessionKey: legacySessionKey,
        startedAt: timestamp,
        updatedAt: timestamp,
        eventCount: 1,
        comparableEventCount: 1,
        injectCount: 1,
        fallbackCount: 0,
        recordCount: 0,
        noopCount: 0,
        observedOpportunityCount: 0,
        observedOriginalEstimatedBytes: 0,
        observedOriginalEstimatedTokens: 0,
        totals: usage,
        claimBoundary: "legacy local estimate",
      },
      null,
      2,
    ),
  );

  const summary = readSessionMetricSummary(tempDir, legacySessionKey);
  assert.equal(summary.runtime, "codex");
  assert.equal(summary.measurementSource, "automatic-hook");
  assert.equal(summary.rawSessionKey, legacySessionKey);
  assert.equal(summary.metricSessionKey, `codex:automatic-hook:${legacySessionKey}`);
  assert.equal(summary.sessionKey, summary.metricSessionKey);
  assert.equal(summary.totals.savedEstimatedBytes, 300);

  const status = refreshProjectMetricSummaryFromSession(tempDir, legacySessionKey);
  assert.equal(status.breakdown.byRuntime.codex.eventCount, 1);
  assert.equal(status.breakdown.byMeasurementSource["automatic-hook"].eventCount, 1);
  assert.equal(status.breakdown.byRuntimeAndSource["codex:automatic-hook"].eventCount, 1);
  assert.equal(status.latestSessionCount, 1);
  assert.equal("sessions" in status, false);
});

test("runtime hook stores redacted estimated metrics for record, inject, fallback, and stop", () => {
  const tempDir = makeTempProject();
  const sessionId = `metrics-${Date.now()}`;
  const target = path.join("src", "components", "FormSection.tsx");
  const targetBytes = fs.statSync(path.join(tempDir, target)).size;

  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  const started = run(["status"], tempDir);
  assert.equal(started.sessionCount, 1);
  assert.equal(started.eventCount, 0);

  const first = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Please update ${target}`,
    },
    tempDir,
  );
  assert.equal(first.action, "record");

  const second = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Again, inspect ${target}`,
    },
    tempDir,
  );
  assert.equal(second.action, "inject");
  assert.ok(second.additionalContext);

  const sessionSummary = readSessionMetricSummary(tempDir, sessionId);
  assert.equal(sessionSummary.eventCount, 2);
  assert.equal(sessionSummary.recordCount, 1);
  assert.equal(sessionSummary.injectCount, 1);
  assert.equal(sessionSummary.comparableEventCount, 1);
  assert.equal(sessionSummary.observedOpportunityCount, 1);
  assert.equal(sessionSummary.observedOriginalEstimatedBytes, targetBytes);
  assert.equal(sessionSummary.totals.originalEstimatedBytes, targetBytes);
  assert.equal(sessionSummary.totals.actualEstimatedBytes, Buffer.byteLength(second.additionalContext, "utf8"));
  assert.equal(
    sessionSummary.totals.savedEstimatedBytes,
    Math.max(0, sessionSummary.totals.originalEstimatedBytes - sessionSummary.totals.actualEstimatedBytes),
  );

  assert.equal(sessionSummary.runtime, "codex");
  assert.equal(sessionSummary.measurementSource, "automatic-hook");
  assert.equal(sessionSummary.rawSessionKey, sessionId);
  assert.match(sessionSummary.metricSessionKey, /^codex:automatic-hook:/);

  const eventLog = fs.readFileSync(sessionEventsPath(tempDir, sessionSummary.metricSessionKey), "utf8");
  assert.doesNotMatch(eventLog, /Again, inspect/);
  assert.doesNotMatch(eventLog, /additionalContext/);
  assert.doesNotMatch(eventLog, /rawText/);
  assert.doesNotMatch(eventLog, /"debug"/);
  assert.doesNotMatch(eventLog, /"decision"/);

  const fallbackSession = `${sessionId}-fallback`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: fallbackSession }, tempDir);
  const fallback = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: fallbackSession,
      prompt: `Need exact source ${target} #fooks-full-read`,
    },
    tempDir,
  );
  assert.equal(fallback.action, "fallback");
  const fallbackSummary = readSessionMetricSummary(tempDir, fallbackSession);
  assert.equal(fallbackSummary.fallbackCount, 1);
  assert.equal(fallbackSummary.comparableEventCount, 1);
  assert.equal(fallbackSummary.totals.originalEstimatedBytes, targetBytes);
  assert.equal(fallbackSummary.totals.actualEstimatedBytes, targetBytes);
  assert.equal(fallbackSummary.totals.savedEstimatedBytes, 0);

  handleCodexRuntimeHook({ hookEventName: "Stop", sessionId }, tempDir);
  const stopped = readSessionMetricSummary(tempDir, sessionId);
  assert.ok(stopped.stoppedAt);

  const beforeRefresh = readProjectMetricSummary(tempDir);
  refreshProjectMetricSummaryFromSession(tempDir, sessionId);
  refreshProjectMetricSummaryFromSession(tempDir, sessionId);
  const afterRefresh = readProjectMetricSummary(tempDir);
  assert.equal(afterRefresh.eventCount, beforeRefresh.eventCount);
  assert.deepEqual(afterRefresh.totals, beforeRefresh.totals);

  const status = run(["status"], tempDir);
  assert.equal(status.sessionCount, 2);
  assert.equal(status.eventCount, 3);
  assert.equal(status.injectCount, 1);
  assert.equal(status.fallbackCount, 1);
  assert.equal(status.recordCount, 1);
  assert.equal(status.latestSessionCount, 2);
  assert.equal(status.breakdown.byRuntime.codex.eventCount, 3);
  assert.equal(status.breakdown.byMeasurementSource["automatic-hook"].eventCount, 3);
  assert.equal(status.breakdown.byRuntimeAndSource["codex:automatic-hook"].eventCount, 3);
  assert.equal("latestSessionKeys" in status, false);
  assert.equal("sessions" in status, false);

  const summaryFile = JSON.parse(fs.readFileSync(sessionsSummaryPath(tempDir), "utf8"));
  assert.equal(Object.keys(summaryFile.sessions).length, 2);
  assert.ok(Object.keys(summaryFile.sessions).every((key) => key.startsWith("codex-automatic-hook-")));
});

test("runtime metric write failures are non-fatal to hook decisions", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, ".fooks"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, ".fooks", "sessions"), "not-a-directory");

  const sessionId = `metrics-blocked-${Date.now()}`;
  const start = handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  assert.equal(start.action, "noop");

  const first = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Please update src/components/FormSection.tsx",
    },
    tempDir,
  );
  assert.equal(first.action, "record");
  assert.equal(first.filePath, path.join("src", "components", "FormSection.tsx"));
});

test("runtime hook injects tiny raw originals and still honors escape hatch fallbacks", () => {
  const rawSession = `hook-raw-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: rawSession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: rawSession,
      prompt: "Review fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );
  const rawSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: rawSession,
      prompt: "Again, review fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );
  assert.equal(rawSecond.action, "inject");
  assert.equal(rawSecond.contextMode, "light-minimal");
  assert.match(rawSecond.additionalContext, /"useOriginal": true/);
  assert.match(rawSecond.additionalContext, /"rawText":/);

  const overrideSession = `hook-override-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: overrideSession }, repoRoot);
  const overridden = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: overrideSession,
      prompt: "Please inspect fixtures/compressed/FormSection.tsx #fooks-full-read",
    },
    repoRoot,
  );
  assert.equal(overridden.action, "fallback");
  assert.equal(overridden.contextMode, "full");
  assert.ok(overridden.reasons.includes("escape-hatch-full-read"));
  assert.equal(overridden.fallback.reason, "escape-hatch-full-read");
  assert.equal(overridden.debug.escapeHatchUsed, true);
});

test("runtime hook refreshes stale target state before repeated attach and updates trust status", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  run(["attach", "codex"], tempDir, { FOOKS_CODEX_HOME: codexHome });

  const sessionId = `hook-refresh-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Review src/components/FormSection.tsx",
    },
    tempDir,
  );

  appendMarker(path.join(tempDir, "src", "components", "FormSection.tsx"), "// trust-refresh-marker");

  const second = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Again, review src/components/FormSection.tsx",
    },
    tempDir,
  );

  assert.equal(second.action, "inject");
  assert.ok(second.reasons.includes("refreshed-before-attach"));

  const trustStatus = run(["status", "codex"], tempDir);
  assert.equal(trustStatus.connectionState, "connected");
  assert.equal(trustStatus.lifecycleState, "attach-prepared");
  assert.equal(trustStatus.activeFile.filePath, path.join("src", "components", "FormSection.tsx"));
  assert.equal(trustStatus.activeFile.source, "prompt-target");
  assert.ok(trustStatus.lastRefreshAt);
  assert.ok(trustStatus.lastAttachPreparedAt);
});

test("stop clears active file from codex trust status after an attach-prepared session", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  run(["attach", "codex"], tempDir, { FOOKS_CODEX_HOME: codexHome });

  const sessionId = `hook-stop-status-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Review src/components/FormSection.tsx",
    },
    tempDir,
  );
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Again, review src/components/FormSection.tsx",
    },
    tempDir,
  );

  const prepared = run(["status", "codex"], tempDir);
  assert.equal(prepared.lifecycleState, "attach-prepared");
  assert.equal(prepared.activeFile.filePath, path.join("src", "components", "FormSection.tsx"));

  handleCodexRuntimeHook({ hookEventName: "Stop", sessionId }, tempDir);

  const afterStop = run(["status", "codex"], tempDir);
  assert.equal(afterStop.connectionState, "connected");
  assert.equal(afterStop.lifecycleState, "ready");
  assert.equal("activeFile" in afterStop, false);
});

test("runtime hook supports jsx repeated prompts and ignores linked ts prompts", () => {
  const jsxSession = `hook-jsx-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: jsxSession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: jsxSession,
      prompt: "Check fixtures/jsx/SimpleWidget.jsx",
    },
    repoRoot,
  );
  const jsxSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: jsxSession,
      prompt: "Again, check fixtures/jsx/SimpleWidget.jsx",
    },
    repoRoot,
  );
  assert.equal(jsxSecond.action, "inject");
  assert.equal(jsxSecond.filePath, path.join("fixtures", "jsx", "SimpleWidget.jsx"));

  const tsSession = `hook-ts-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: tsSession }, repoRoot);
  const tsPrompt = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: tsSession,
      prompt: "Check fixtures/ts-linked/Button.types.ts",
    },
    repoRoot,
  );
  assert.equal(tsPrompt.action, "record");
  assert.equal(tsPrompt.filePath, path.join("fixtures", "ts-linked", "Button.types.ts"));
});

test("cli codex-runtime-hook reuses runtime decision logic and advertises the command", () => {
  const cliStartSession = `cli-hook-start-${Date.now()}`;
  const directStartSession = `${cliStartSession}-direct`;
  const cliStart = run(["codex-runtime-hook", "--event", "SessionStart", "--session-id", cliStartSession]);
  const directStart = handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: directStartSession }, repoRoot);
  directStart.statePath = cliStart.statePath;
  assert.deepEqual(cliStart, directStart);

  const cliFirstSession = `cli-hook-first-${Date.now()}`;
  const directFirstSession = `${cliFirstSession}-direct`;
  run(["codex-runtime-hook", "--event", "SessionStart", "--session-id", cliFirstSession]);
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: directFirstSession }, repoRoot);
  const cliFirst = run([
    "codex-runtime-hook",
    "--event",
    "UserPromptSubmit",
    "--session-id",
    cliFirstSession,
    "--prompt",
    "Please update fixtures/compressed/FormSection.tsx",
  ]);
  const directFirst = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: directFirstSession,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  directFirst.statePath = cliFirst.statePath;
  assert.deepEqual(cliFirst, directFirst);

  const cliSecondSession = `cli-hook-second-${Date.now()}`;
  const directSecondSession = `${cliSecondSession}-direct`;
  run(["codex-runtime-hook", "--event", "SessionStart", "--session-id", cliSecondSession]);
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: directSecondSession }, repoRoot);
  run([
    "codex-runtime-hook",
    "--event",
    "UserPromptSubmit",
    "--session-id",
    cliSecondSession,
    "--prompt",
    "Please update fixtures/compressed/FormSection.tsx",
  ]);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: directSecondSession,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  const cliSecond = run([
    "codex-runtime-hook",
    "--event",
    "UserPromptSubmit",
    "--session-id",
    cliSecondSession,
    "--prompt",
    "Again, update fixtures/compressed/FormSection.tsx",
  ]);
  const directSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: directSecondSession,
      prompt: "Again, update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  directSecond.statePath = cliSecond.statePath;
  assert.deepEqual(cliSecond, directSecond);

  let usage = "";
  try {
    runText(["unknown-command"]);
  } catch (error) {
    usage = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(usage, /codex-runtime-hook/);
});

test("native hook bridge only activates inside attached codex projects", () => {
  const tempDir = makeTempProject();
  const detachedOutput = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: tempDir,
      prompt: "Please update src/components/FormSection.tsx",
      session_id: `native-detached-${Date.now()}`,
    },
    tempDir,
  );
  assert.equal(detachedOutput, null);

  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FOOKS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-")) });

  const sessionId = `native-attached-${Date.now()}`;
  const first = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Please update src/components/FormSection.tsx",
      session_id: sessionId,
    },
    attachedDir,
  );
  assert.equal(first, null);

  const second = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Again, update src/components/FormSection.tsx",
      session_id: sessionId,
    },
    attachedDir,
  );
  assert.equal(second.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(
    second.hookSpecificOutput.additionalContext,
    /fooks: reused pre-read \(compressed\) · file: src\/components\/FormSection\.tsx/,
  );
});

test("native hook bridge injects tiny raw originals on repeated prompts", () => {
  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FOOKS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-")) });

  const sessionId = `native-fallback-${Date.now()}`;
  handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Please inspect src/components/SimpleButton.tsx",
      session_id: sessionId,
    },
    attachedDir,
  );
  const fallback = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Again, inspect src/components/SimpleButton.tsx",
      session_id: sessionId,
    },
    attachedDir,
  );
  assert.equal(fallback.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(
    fallback.hookSpecificOutput.additionalContext,
    /fooks: reused pre-read \(raw\) · file: src\/components\/SimpleButton\.tsx/,
  );
  assert.match(fallback.hookSpecificOutput.additionalContext, /"useOriginal": true/);
});

test("native hook bridge maps payload-build failures to full-read guidance", () => {
  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FOOKS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-")) });

  const sessionId = `native-payload-throw-${Date.now()}`;
  const target = path.join("src", "components", "FormSection.tsx");
  handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: `Please update ${target}`,
      session_id: sessionId,
    },
    attachedDir,
  );

  withThrowingCodexPreRead(() => {
    const output = handleCodexNativeHookPayload(
      {
        hook_event_name: "UserPromptSubmit",
        cwd: attachedDir,
        prompt: `Again, update ${target}`,
        session_id: sessionId,
      },
      attachedDir,
    );

    assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.match(
      output.hookSpecificOutput.additionalContext,
      /^fooks: fallback \(payload-build-failed\) · file: src\/components\/FormSection\.tsx · Read the full source file for this turn\.$/,
    );
    assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /provider billing tokens/i);
    assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /token savings/i);
  });
});

test("native hook bridge uses fixed full-read status vocabulary for escape hatch overrides", () => {
  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FOOKS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-")) });

  const overridden = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Need exact source src/components/FormSection.tsx #fooks-full-read",
      session_id: `native-escape-${Date.now()}`,
    },
    attachedDir,
  );
  assert.equal(overridden.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(
    overridden.hookSpecificOutput.additionalContext,
    /^fooks: full read requested · file: src\/components\/FormSection\.tsx · Read the full source file for this turn\.$/,
  );
  assert.doesNotMatch(overridden.hookSpecificOutput.additionalContext, /fallback \(/);
});

test("cli codex-runtime-hook can read native hook payloads from stdin", () => {
  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FOOKS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-")) });

  const sessionId = `cli-native-${Date.now()}`;
  runTextWithInput(
    ["codex-runtime-hook", "--native-hook"],
    JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Please update src/components/FormSection.tsx",
      session_id: sessionId,
    }),
    attachedDir,
  );
  const cliSecond = JSON.parse(
    runTextWithInput(
      ["codex-runtime-hook", "--native-hook"],
      JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        cwd: attachedDir,
        prompt: "Again, update src/components/FormSection.tsx",
        session_id: sessionId,
      }),
      attachedDir,
    ),
  );
  assert.equal(cliSecond.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(
    cliSecond.hookSpecificOutput.additionalContext,
    /fooks: reused pre-read \(compressed\) · file: src\/components\/FormSection\.tsx/,
  );
});

test("scan indexes component and qualifying linked ts but excludes generic utils", () => {
  const tempDir = makeTempProject();
  const result = run(["scan"], tempDir);
  const filePaths = result.files.map((item) => item.filePath).sort();
  assert.ok(filePaths.includes(path.join("src", "components", "SimpleButton.tsx")));
  assert.ok(filePaths.includes(path.join("src", "components", "Button.types.ts")));
  assert.ok(filePaths.includes(path.join("src", "components", "FormSection.utils.ts")));
  assert.ok(!filePaths.includes(path.join("src", "date-utils.ts")));
  assert.ok(fs.existsSync(path.join(tempDir, ".fooks", "index.json")));
  assert.ok(result.refreshedEntries >= 5);
  assert.ok(result.observability);
  assert.ok(result.observability.timingsMs.discovery >= 0);
  assert.ok(result.observability.counters.fileReadCount >= 5);
  const formSectionEntry = result.files.find((item) => item.filePath === path.join("src", "components", "FormSection.tsx"));
  assert.ok(formSectionEntry);
  assert.equal(typeof formSectionEntry.complexityScore, "number");
  assert.ok(Array.isArray(formSectionEntry.decideReason));
  assert.ok(["low", "medium", "high"].includes(formSectionEntry.decideConfidence));

  const persistedIndex = JSON.parse(fs.readFileSync(path.join(tempDir, ".fooks", "index.json"), "utf8"));
  assert.equal(persistedIndex.observability, undefined);

  const secondRun = run(["scan"], tempDir);
  assert.ok(secondRun.reusedCacheEntries >= 5);
  assert.equal(secondRun.observability.counters.fileReadCount, 0);
  assert.equal(secondRun.observability.counters.metadataReuseCount, secondRun.files.length);
});

test("scan excludes cross-folder linked ts even when directly imported", () => {
  const tempDir = makeTempProject();
  const result = run(["scan"], tempDir);
  const filePaths = result.files.map((item) => item.filePath);
  assert.ok(filePaths.includes(path.join("src", "components", "DateBadge.tsx")));
  assert.ok(!filePaths.includes(path.join("src", "date-utils.ts")));
});

test("scan only refreshes changed files after cache warm-up", () => {
  const tempDir = makeTempProject();
  const firstScan = run(["scan"], tempDir);
  assert.ok(firstScan.refreshedEntries >= 5);

  const changedFile = path.join(tempDir, "src", "components", "FormSection.tsx");
  appendMarker(changedFile, "// cache-invalidation-marker");

  const secondScan = run(["scan"], tempDir);
  assert.equal(secondScan.refreshedEntries, 1);
  assert.equal(secondScan.reusedCacheEntries, firstScan.files.length - 1);
  assert.equal(secondScan.observability.counters.fileReadCount, 1);
  assert.equal(secondScan.observability.counters.metadataReuseCount, firstScan.files.length - 1);

  const indexEntry = secondScan.files.find((item) => item.filePath === path.join("src", "components", "FormSection.tsx"));
  assert.ok(indexEntry);
  assert.notEqual(indexEntry.fileHash, firstScan.files.find((item) => item.filePath === indexEntry.filePath).fileHash);
});

test("scan writes benchmark-only command-path timings to a side channel without changing stdout", () => {
  const tempDir = makeTempProject();
  const timingPath = path.join(os.tmpdir(), `fooks-bench-timing-${Date.now()}.json`);
  const stdout = runText(["scan"], tempDir, { FOOKS_BENCH_TIMING_PATH: timingPath });
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed.files));
  assert.equal(parsed.commandPathBreakdown, undefined);
  assert.equal(parsed.schemaVersion, undefined);
  assert.ok(fs.existsSync(timingPath));

  const timingPayload = JSON.parse(fs.readFileSync(timingPath, "utf8"));
  assert.equal(timingPayload.schemaVersion, 1);
  assert.equal(timingPayload.command, "scan");
  assert.ok(timingPayload.commandPathBreakdown.commandDispatchMs >= 0);
  assert.ok(timingPayload.commandPathBreakdown.pathsModuleImportMs >= 0);
  assert.ok(timingPayload.commandPathBreakdown.scanModuleImportMs >= 0);
  assert.ok(timingPayload.commandPathBreakdown.ensureProjectDataDirsMs >= 0);
  assert.ok(timingPayload.commandPathBreakdown.commandDispatchResidualMs >= 0);
  assert.ok(timingPayload.commandPathBreakdown.resultSerializeMs >= 0);
  assert.ok(timingPayload.commandPathBreakdown.stdoutWriteMs >= 0);

  fs.rmSync(timingPath, { force: true });
});

test("value-proof gate shows >=25% model-facing reduction on two long fixtures", () => {
  const compressed = reductionMetrics(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"));
  const hybrid = reductionMetrics(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"));
  assert.equal(compressed.mode, "compressed");
  assert.equal(hybrid.mode, "hybrid");
  assert.ok(compressed.modelPayloadReductionPct >= 25, `expected compressed model-facing reduction >= 25%, received ${compressed.modelPayloadReductionPct.toFixed(2)}%`);
  assert.ok(hybrid.modelPayloadReductionPct >= 25, `expected hybrid model-facing reduction >= 25%, received ${hybrid.modelPayloadReductionPct.toFixed(2)}%`);
});

test("model-facing payload trim still prunes engine metadata while keeping source ranges", () => {
  const tempDir = makeTempProject();
  const candidates = [
    modelPayloadReductionMetrics(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx")),
    modelPayloadReductionMetrics(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx")),
    modelPayloadReductionMetrics(path.join(tempDir, "src", "components", "DashboardPanel.tsx"), tempDir),
  ];

  const qualifying = candidates.filter((item) => item.mode !== "raw" && item.reductionPct >= 8);
  assert.ok(
    qualifying.length >= 2,
    `expected >=2 payload-vs-extraction trim reductions, received ${candidates.map((item) => item.reductionPct.toFixed(2)).join(", ")}`,
  );

  for (const candidate of candidates.filter((item) => item.mode !== "raw")) {
    assert.equal(candidate.payload.fileHash, undefined);
    assert.equal(candidate.payload.meta, undefined);
    assert.ok(candidate.payload.sourceFingerprint);
    assert.ok(candidate.payload.componentLoc);
    assert.ok(candidate.payload.contract);
    assert.ok(candidate.payload.behavior);
    assert.ok(candidate.payload.structure);
    if (candidate.mode === "hybrid") {
      assert.ok(candidate.payload.snippets?.length);
    }
  }
});

test("setup prepares explicit one-time Codex activation", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));

  const result = run(["setup"], tempDir, {
    FOOKS_ACTIVE_ACCOUNT: "minislively",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  });

  assert.equal(result.command, "setup");
  assert.equal(result.runtime, "codex");
  assert.equal(result.ready, true);
  assert.equal(result.state, "ready");
  assert.ok(result.initialized.config.endsWith(path.join(".fooks", "config.json")));
  assert.ok(fs.existsSync(path.join(tempDir, ".fooks", "config.json")));
  assert.equal(result.attach.runtimeProof.status, "passed");
  assert.ok(fs.existsSync(runtimeManifestPath(result.attach)));
  assert.equal(result.hooks.command, "fooks codex-runtime-hook --native-hook");
  assert.deepEqual(result.hooks.installedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  assert.equal(result.status.connectionState, "connected");
  assert.equal(result.status.lifecycleState, "ready");
  assert.equal(result.runtimes.codex.state, "automatic-ready");
  assert.equal(result.runtimes.codex.blocksOverall, true);
  assert.equal(result.runtimes.claude.state, "context-hook-ready");
  assert.equal(result.runtimes.claude.blocksOverall, false);
  assert.equal(result.runtimes.opencode.state, "tool-ready");
  assert.equal(result.runtimes.opencode.blocksOverall, false);
  assert.deepEqual(result.summary, ["codex:automatic-ready:ready", "claude:context-hook-ready:ready", "opencode:tool-ready:ready"]);
  assert.ok(result.claimBoundaries.some((item) => item.includes("Claude setup installs project-local context hooks")));
  assert.ok(result.nextSteps.some((item) => item.includes("Codex")));
  assert.ok(fs.existsSync(path.join(tempDir, ".opencode", "tools", "fooks_extract.ts")));
  assert.ok(fs.existsSync(path.join(tempDir, ".opencode", "commands", "fooks-extract.md")));

  const hooks = JSON.parse(fs.readFileSync(path.join(codexHome, "hooks.json"), "utf8"));
  assert.equal(hooks.hooks.SessionStart[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(hooks.hooks.UserPromptSubmit[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(hooks.hooks.Stop[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
});

test("setup can become ready for a public repo without an active account override", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));

  const result = run(["setup"], tempDir, {
    FOOKS_ACTIVE_ACCOUNT: "",
    FOOKS_TARGET_ACCOUNT: "",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  });

  assert.equal(result.ready, true);
  assert.equal(result.state, "ready");
  assert.equal(result.runtimes.codex.state, "automatic-ready");
  assert.equal(result.runtimes.claude.state, "context-hook-ready");
  assert.equal(result.runtimes.opencode.state, "tool-ready");
  assert.ok(result.attach.runtimeProof.details.includes("account-source=package-repository"));
  assert.ok(result.attach.runtimeProof.details.includes("account-context=example-org"));
});

test("setup is idempotent and preserves unrelated Codex hooks", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const hooksPath = path.join(codexHome, "hooks.json");
  fs.writeFileSync(hooksPath, JSON.stringify({
    hooks: {
      SessionStart: [{ matcher: "startup|resume", hooks: [{ type: "command", command: "node /tmp/omx-start.js" }] }],
      UserPromptSubmit: [{ hooks: [{ type: "command", command: "node /tmp/omx.js" }] }],
      Stop: [{ hooks: [{ type: "command", command: "node /tmp/omx-stop.js" }] }],
    },
  }, null, 2));

  const env = { FOOKS_ACTIVE_ACCOUNT: "minislively", FOOKS_CODEX_HOME: codexHome, FOOKS_CLAUDE_HOME: claudeHome };
  const first = run(["setup"], tempDir, env);
  assert.equal(first.ready, true);
  assert.equal(first.runtimes.opencode.state, "tool-ready");
  assert.equal(first.hooks.modified, true);
  assert.ok(first.hooks.backupPath);

  const second = run(["setup"], tempDir, env);
  assert.equal(second.ready, true);
  assert.equal(second.runtimes.opencode.state, "tool-ready");
  assert.equal(second.hooks.modified, false);
  assert.deepEqual(second.hooks.skippedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);

  const merged = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  for (const event of ["SessionStart", "UserPromptSubmit", "Stop"]) {
    const commands = merged.hooks[event].flatMap((matcher) => matcher.hooks.map((hook) => hook.command));
    assert.equal(commands.filter((command) => command === "fooks codex-runtime-hook --native-hook").length, 1);
  }
  assert.ok(merged.hooks.SessionStart.some((matcher) => matcher.hooks.some((hook) => hook.command === "node /tmp/omx-start.js")));
  assert.ok(merged.hooks.UserPromptSubmit.some((matcher) => matcher.hooks.some((hook) => hook.command === "node /tmp/omx.js")));
  assert.ok(merged.hooks.Stop.some((matcher) => matcher.hooks.some((hook) => hook.command === "node /tmp/omx-stop.js")));
});

test("setup reports partial activation without false ready claims when attach is blocked", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  // Use invalid codex home to trigger actual blocking (not account-based)
  const codexHome = path.join(tempDir, ".nonexistent-codex-home");

  const result = run(["setup"], tempDir, {
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: path.join(tempDir, ".missing-claude-home"),
  });

  assert.equal(result.command, "setup");
  assert.equal(result.ready, false);
  assert.equal(result.state, "partial");
  assert.equal(result.attach.runtimeProof.status, "blocked");
  assert.equal(result.runtimes.codex.state, "partial");
  assert.equal(result.runtimes.codex.blocksOverall, true);
  assert.equal(result.runtimes.claude.state, "blocked");
  assert.equal(result.runtimes.claude.blocksOverall, false);
  assert.equal(result.runtimes.opencode.state, "tool-ready");
  assert.equal(result.runtimes.opencode.blocksOverall, false);
  assert.ok(result.blockers.some((item) => item.includes("Codex runtime home not detected")));
  assert.equal(fs.existsSync(path.join(codexHome, "fooks")), false);
  assert.ok(result.nextSteps.some((item) => item.includes("Fix setup blockers")));
});

test("setup reports partial activation when Codex hooks cannot be parsed", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  fs.writeFileSync(path.join(codexHome, "hooks.json"), "{not-json");

  const result = run(["setup"], tempDir, {
    FOOKS_ACTIVE_ACCOUNT: "minislively",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  });

  assert.equal(result.command, "setup");
  assert.equal(result.ready, false);
  assert.equal(result.state, "partial");
  assert.equal(result.attach.runtimeProof.status, "passed");
  assert.equal(result.hooks, null);
  assert.equal(result.runtimes.codex.state, "partial");
  assert.equal(result.runtimes.codex.blocksOverall, true);
  assert.equal(result.runtimes.claude.state, "context-hook-ready");
  assert.equal(result.runtimes.opencode.state, "tool-ready");
  assert.ok(result.blockers.some((item) => item.includes("Codex hook preset install failed")));
  assert.ok(result.nextSteps.some((item) => item.includes("Fix setup blockers")));
  assert.equal(fs.readFileSync(path.join(codexHome, "hooks.json"), "utf8"), "{not-json");
});

test("setup reports partial activation when the Codex runtime manifest path cannot be written", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const blockedAttachmentsPath = path.join(codexHome, "fooks", "attachments");
  fs.mkdirSync(path.dirname(blockedAttachmentsPath), { recursive: true });
  fs.writeFileSync(blockedAttachmentsPath, "blocked");

  const result = run(["setup"], tempDir, {
    FOOKS_ACTIVE_ACCOUNT: "minislively",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  });

  assert.equal(result.ready, false);
  assert.equal(result.state, "partial");
  assert.equal(result.attach.runtimeProof.status, "blocked");
  assert.equal(result.runtimes.codex.state, "partial");
  assert.equal(result.runtimes.claude.state, "context-hook-ready");
  assert.ok(result.attach.runtimeProof.blocker.includes("Codex runtime manifest install failed"));
  assert.ok(result.attach.runtimeProof.blocker.match(/EEXIST|ENOTDIR/));
  assert.ok(result.blockers.some((item) => item.includes("Codex runtime manifest install failed")));
  assert.ok(result.nextSteps.some((item) => item.includes("Fix setup blockers")));
  assert.ok(result.attach.runtimeProof.details.some((item) => item.includes("runtime-manifest-write-attempted=true")));
  assert.ok(result.attach.runtimeProof.details.some((item) => item.includes("runtime-manifest-error=")));
});

test("setup reports blocked state for projects without React components", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-empty-"));
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "empty", repository: { url: "https://github.com/minislively/empty.git" } }, null, 2));
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));

  const result = run(["setup"], tempDir, { FOOKS_CODEX_HOME: codexHome });

  assert.equal(result.ready, false);
  assert.equal(result.state, "blocked");
  assert.equal(result.attach, null);
  assert.equal(result.hooks, null);
  assert.equal(result.runtimes.codex.state, "blocked");
  assert.equal(result.runtimes.codex.blocksOverall, true);
  assert.equal(result.runtimes.claude.state, "blocked");
  assert.equal(result.runtimes.claude.blocksOverall, false);
  assert.equal(result.runtimes.opencode.state, "manual-step-required");
  assert.equal(result.runtimes.opencode.blocksOverall, false);
  assert.equal(fs.existsSync(path.join(tempDir, ".opencode")), false);
  const setupProjectRoot = fs.realpathSync(tempDir);
  assert.equal(result.scope.projectRoot, setupProjectRoot);
  assert.equal(result.scope.packageInstall.mutatedBySetup, false);
  assert.ok(result.scope.projectLocal.paths.includes(path.join(setupProjectRoot, ".fooks", "config.json")));
  assert.deepEqual(result.scope.userRuntime.paths, []);
  assert.ok(result.scope.nonGoals.some((item) => item.includes("No interactive setup prompt")));
  assert.ok(result.blockers.some((item) => item.includes("No React/TSX component file or strong TS/JS beta file found")));
  assert.ok(result.nextSteps.some((item) => item.includes("Add a React/TSX component or a strong same-file TS/JS beta file")));
});

test("setup can become Codex-ready for TS/JS-only beta projects while Claude and opencode stay React-only", () => {
  const tempDir = makeTempTsJsBetaProject("https://github.com/example-org/temp-ts-js-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const env = {
    FOOKS_ACTIVE_ACCOUNT: "",
    FOOKS_TARGET_ACCOUNT: "",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  };

  const result = run(["setup"], tempDir, env);

  assert.equal(result.ready, true);
  assert.equal(result.state, "ready");
  assert.equal(result.runtimes.codex.ready, true);
  assert.equal(result.runtimes.codex.state, "automatic-ready");
  assert.equal(result.runtimes.claude.ready, false);
  assert.equal(result.runtimes.claude.state, "blocked");
  assert.equal(result.runtimes.opencode.ready, false);
  assert.equal(result.runtimes.opencode.state, "manual-step-required");
  assert.equal(fs.existsSync(path.join(tempDir, ".opencode")), false);
  assert.ok(result.nextSteps.some((item) => item.includes("Codex TS/JS beta file")));

  const codexAttach = result.attach ?? result.runtimes.codex.details?.attach;
  assert.ok(codexAttach);
  const manifest = JSON.parse(fs.readFileSync(runtimeManifestPath(codexAttach), "utf8"));
  assert.deepEqual(manifest.runtimeBridge.scope.extensions, [".tsx", ".jsx", ".ts", ".js"]);
});

test("cli help advertises setup and package install has no auto hook side effects", () => {
  const help = runText(["--help"]);
  assert.match(help, /fooks setup/);
  assert.match(help, /fooks doctor \[codex\|claude\] \[--json\]/);
  assert.match(help, /fooks compare <file> \[--json\]/);
  assert.match(help, /fooks status claude/);
  assert.match(help, /Codex: automatic repeated-file runtime hook path/);
  assert.match(help, /Claude: project-local context hooks/);
  assert.match(help, /opencode: manual\/semi-automatic custom tool/);
  assert.doesNotMatch(help, /--scope/);
  assert.doesNotMatch(help, /Unknown command/);

  let usage = "";
  try {
    runText(["unknown-command"]);
  } catch (error) {
    usage = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(usage, /Unknown command: unknown-command/);
  assert.match(usage, /fooks setup/);

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts?.postinstall, undefined);
  assert.equal(pkg.scripts?.preinstall, undefined);
  assert.equal(pkg.scripts?.prepare, undefined);
  assert.match(pkg.scripts?.["release:smoke"], /scripts\/release-smoke\.mjs/);
  assert.doesNotMatch(pkg.scripts?.["release:smoke"], /publish|version|tag/);
});

test("doctor rejects unknown targets and exposes bounded command help", () => {
  const help = runText(["doctor", "--help"]);
  assert.match(help, /Usage: fooks doctor \[codex\|claude\] \[--json\]/);
  assert.match(help, /read-only local diagnostics/);
  assert.match(help, /Does not prove provider health/);
  assert.match(help, /Does not enable Claude Read\/tool-call interception/);

  let output = "";
  try {
    runText(["doctor", "opencode", "--json"]);
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(output, /Unexpected doctor argument: opencode/);
});

test("doctor codex reports missing runtime blockers without mutating local state", () => {
  const tempDir = makeTempProject();
  const codexHome = path.join(tempDir, ".missing-codex-home");
  const claudeHome = path.join(tempDir, ".missing-claude-home");
  const env = { FOOKS_CODEX_HOME: codexHome, FOOKS_CLAUDE_HOME: claudeHome };
  const beforeProject = fileSnapshot(tempDir);
  const beforeCodex = fileSnapshot(codexHome);
  const beforeClaude = fileSnapshot(claudeHome);

  const result = run(["doctor", "codex", "--json"], tempDir, env);

  assert.equal(result.command, "doctor");
  assert.equal(result.target, "codex");
  assert.equal(result.healthy, false);
  assert.ok(result.summary.fail >= 1);
  assert.ok(result.checks.some((item) => item.name === "Codex runtime home" && item.status === "fail"));
  assert.ok(result.checks.some((item) => item.name === "Codex hooks" && item.status === "fail"));
  assert.ok(result.nextSteps.some((item) => item.includes("FOOKS_CODEX_HOME")));
  assert.deepEqual(fileSnapshot(tempDir), beforeProject);
  assert.deepEqual(fileSnapshot(codexHome), beforeCodex);
  assert.deepEqual(fileSnapshot(claudeHome), beforeClaude);
});

test("doctor codex detects incomplete hook event installation", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  fs.writeFileSync(path.join(codexHome, "hooks.json"), JSON.stringify({
    hooks: {
      SessionStart: [{ matcher: "startup|resume", hooks: [{ type: "command", command: "fooks codex-runtime-hook --native-hook" }] }],
    },
  }, null, 2));

  const result = run(["doctor", "codex", "--json"], tempDir, {
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  });
  const hooks = result.checks.find((item) => item.name === "Codex hooks");
  assert.equal(hooks.status, "fail");
  assert.deepEqual(hooks.evidence.installedEvents, ["SessionStart"]);
  assert.deepEqual(hooks.evidence.missingEvents, ["UserPromptSubmit", "Stop"]);
  assert.match(hooks.fix, /fooks install codex-hooks/);
});

test("doctor codex passes after isolated setup and reports readiness evidence", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const env = {
    FOOKS_ACTIVE_ACCOUNT: "",
    FOOKS_TARGET_ACCOUNT: "",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  };
  const setup = run(["setup"], tempDir, env);
  assert.equal(setup.ready, true);

  const result = run(["doctor", "codex", "--json"], tempDir, env);
  assert.equal(result.healthy, true);
  assert.equal(result.summary.fail, 0);
  const hooks = result.checks.find((item) => item.name === "Codex hooks");
  assert.equal(hooks.status, "pass");
  assert.deepEqual(hooks.evidence.installedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  assert.equal(hooks.evidence.commandMatches, true);
  const manifest = result.checks.find((item) => item.name === "Codex runtime manifest");
  assert.equal(manifest.status, "pass");
  assert.equal(manifest.evidence.bridgeCommandPlausible, true);
  assert.equal(result.checks.find((item) => item.name === "Codex trust status").status, "pass");
  assert.equal(result.checks.find((item) => item.name === "Eligible source files").status, "pass");
});

test("doctor codex recognizes TS/JS-only beta setup candidates", () => {
  const tempDir = makeTempTsJsBetaProject("https://github.com/example-org/temp-ts-js-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const env = {
    FOOKS_ACTIVE_ACCOUNT: "",
    FOOKS_TARGET_ACCOUNT: "",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  };

  const setup = run(["setup"], tempDir, env);
  assert.equal(setup.ready, true);

  const result = run(["doctor", "codex", "--json"], tempDir, env);
  const eligible = result.checks.find((item) => item.name === "Eligible source files");
  assert.equal(result.healthy, true);
  assert.equal(eligible.status, "pass");
  assert.match(eligible.message, /strong Codex \.ts\/\.js beta file/);
  assert.equal(eligible.evidence.componentFileCount, 0);
  assert.equal(eligible.evidence.codexTsJsBetaFileCount >= 1, true);
});

test("doctor aggregate treats Claude-only blockers as warnings when Codex is ready", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = path.join(tempDir, ".missing-claude-home");
  const env = {
    FOOKS_ACTIVE_ACCOUNT: "",
    FOOKS_TARGET_ACCOUNT: "",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  };
  const setup = run(["setup"], tempDir, env);
  assert.equal(setup.ready, true);
  assert.equal(setup.runtimes.claude.blocksOverall, false);

  const result = run(["doctor", "--json"], tempDir, env);
  assert.equal(result.target, "all");
  assert.equal(result.healthy, true);
  assert.equal(result.summary.fail, 0);
  assert.ok(result.summary.warn >= 1);
  assert.ok(result.checks.some((item) => item.runtime === "claude" && item.status === "warn"));
});

test("doctor claude focused target fails independently and keeps claim boundaries", () => {
  const tempDir = makeTempProject();
  const result = run(["doctor", "claude", "--json"], tempDir, {
    FOOKS_CLAUDE_HOME: path.join(tempDir, ".missing-claude-home"),
    FOOKS_CODEX_HOME: path.join(tempDir, ".missing-codex-home"),
  });
  const text = collectStrings(result).join("\n");

  assert.equal(result.target, "claude");
  assert.equal(result.healthy, false);
  assert.ok(result.summary.fail >= 1);
  assert.ok(result.checks.every((item) => item.runtime === "claude"));
  const optionalLsp = result.checks.find((item) => item.name === "Claude optional TypeScript language server");
  assert.ok(optionalLsp);
  assert.ok(["pass", "warn"].includes(optionalLsp.status));
  assert.notEqual(optionalLsp.status, "fail");
  assert.ok(result.claimBoundaries.some((item) => item.includes("does not intercept Claude Read/tool calls")));
  assert.match(text, /Doctor does not prove provider health/);
  assert.doesNotMatch(text, /Claude Read interception is enabled/i);
  assert.doesNotMatch(text, /Claude runtime-token savings are enabled/i);
  assert.doesNotMatch(text, /provider billing-token reduction is enabled/i);
});

test("doctor human output is readable and includes fixes plus boundaries", () => {
  const tempDir = makeTempProject();
  const output = runText(["doctor", "codex"], tempDir, {
    FOOKS_CODEX_HOME: path.join(tempDir, ".missing-codex-home"),
    FOOKS_CLAUDE_HOME: path.join(tempDir, ".missing-claude-home"),
  });
  assert.match(output, /^fooks doctor codex/m);
  assert.match(output, /❌ Codex runtime home/);
  assert.match(output, /Fix: Create the Codex runtime home or set FOOKS_CODEX_HOME/);
  assert.match(output, /Summary: \d+ passed, \d+ warnings, \d+ failures/);
  assert.match(output, /Overall: unhealthy/);
  assert.match(output, /Boundary: Doctor reports local fooks configuration and runtime hook readiness only\./);
});

test("doctor is read-only for prepared project, Codex, and Claude paths", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const env = {
    FOOKS_ACTIVE_ACCOUNT: "",
    FOOKS_TARGET_ACCOUNT: "",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  };
  run(["setup"], tempDir, env);
  const beforeProject = fileSnapshot(tempDir);
  const beforeCodex = fileSnapshot(codexHome);
  const beforeClaude = fileSnapshot(claudeHome);

  run(["doctor", "--json"], tempDir, env);
  run(["doctor", "codex", "--json"], tempDir, env);
  run(["doctor", "claude", "--json"], tempDir, env);
  runText(["doctor", "codex"], tempDir, env);

  assert.deepEqual(fileSnapshot(tempDir), beforeProject);
  assert.deepEqual(fileSnapshot(codexHome), beforeCodex);
  assert.deepEqual(fileSnapshot(claudeHome), beforeClaude);
});


test("setup runtime summary keeps Claude and opencode claims bounded", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const result = run(["setup"], tempDir, {
    FOOKS_ACTIVE_ACCOUNT: "minislively",
    FOOKS_CODEX_HOME: codexHome,
    FOOKS_CLAUDE_HOME: claudeHome,
  });
  const text = collectStrings(result).join("\n");

  assert.equal(result.runtimes.claude.blocksOverall, false);
  assert.equal(result.runtimes.opencode.blocksOverall, false);
  assert.match(text, /Claude P0 context hooks are project-local only/);
  assert.match(text, /opencode setup does not intercept read calls/);
  assert.match(text, /opencode setup does not prove automatic runtime-token savings/);
  assert.doesNotMatch(text, /Claude Read interception is enabled/i);
  assert.doesNotMatch(text, /Claude runtime-token savings are enabled/i);
  assert.doesNotMatch(text, /automatic opencode read interception is enabled/i);
  assert.doesNotMatch(text, /automatic opencode runtime-token savings are enabled/i);
  assert.doesNotMatch(text, /Codex runtime-token savings proof/i);
});

test("status claude reports handoff-ready artifacts when project-local hooks are absent", () => {
  const tempDir = makeTempProject();
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const env = {
    FOOKS_ACTIVE_ACCOUNT: "minislively",
    FOOKS_CLAUDE_HOME: claudeHome,
  };

  run(["attach", "claude"], tempDir, env);

  const status = run(["status", "claude"], tempDir, env);
  assert.equal(status.runtime, "claude");
  assert.equal(status.state, "handoff-ready");
  assert.equal(status.ready, true);
  assert.equal(status.mode, "manual-shared-handoff");
  assert.deepEqual(status.blockers, []);
  assert.equal(status.adapter.installed, true);
  assert.equal(status.adapter.adapterJson.valid, true);
  assert.equal(status.adapter.contextTemplate.valid, true);
  assert.equal(status.manifest.home, claudeHome);
  assert.equal(status.manifest.valid, true);
  assert.equal(status.hooks.exists, false);
  assert.equal(status.hooks.ready, false);
  assert.deepEqual(status.hooks.missingEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);

  const text = collectStrings(status).join("\n");
  assert.match(text, /manual-shared-handoff/);
  assert.match(text, /Run fooks install claude-hooks/);
  assert.doesNotMatch(text, /Claude Read interception is enabled/i);
  assert.doesNotMatch(text, /automatic Claude token savings are enabled/i);
});

test("install claude-hooks creates local settings and status reports context-hook-ready", () => {
  const tempDir = makeTempProject();
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const env = { FOOKS_CLAUDE_HOME: claudeHome };
  run(["attach", "claude"], tempDir, env);

  const result = run(["install", "claude-hooks"], tempDir, env);
  assert.equal(result.command, "install claude-hooks");
  assert.equal(result.runtime, "claude");
  assert.equal(result.created, true);
  assert.equal(result.modified, true);
  assert.deepEqual(result.installedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  assert.equal(result.settingsPath, path.join(fs.realpathSync(tempDir), ".claude", "settings.local.json"));

  const settings = JSON.parse(fs.readFileSync(path.join(tempDir, ".claude", "settings.local.json"), "utf8"));
  assert.equal(settings.hooks.SessionStart[0].hooks[0].command, "fooks claude-runtime-hook --native-hook");
  assert.equal(settings.hooks.UserPromptSubmit[0].hooks[0].command, "fooks claude-runtime-hook --native-hook");
  assert.equal(settings.hooks.Stop[0].hooks[0].command, "fooks claude-runtime-hook --native-hook");
  assert.equal(settings.hooks.Read, undefined);
  assert.equal(settings.hooks.PreToolUse, undefined);
  assert.equal(settings.hooks.PostToolUse, undefined);
  assert.equal(settings.hooks.SubagentStop, undefined);
  assert.equal(fs.existsSync(path.join(tempDir, ".claude", "settings.json")), false);

  const second = run(["install", "claude-hooks"], tempDir, env);
  assert.equal(second.modified, false);
  assert.deepEqual(second.skippedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);

  const status = run(["status", "claude"], tempDir, env);
  assert.equal(status.state, "context-hook-ready");
  assert.equal(status.mode, "automatic-context-hook");
  assert.equal(status.ready, true);
  assert.equal(status.hooks.ready, true);
  assert.deepEqual(status.hooks.installedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  assert.deepEqual(status.hooks.missingEvents, []);
  assert.deepEqual(status.hooks.unexpectedFooksEvents, []);
});

test("install claude-hooks preserves settings and avoids global/shared mutation", () => {
  const tempDir = makeTempProject();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-home-"));
  const globalClaudeDir = path.join(fakeHome, ".claude");
  fs.mkdirSync(globalClaudeDir, { recursive: true });
  const globalSettings = path.join(globalClaudeDir, "settings.json");
  fs.writeFileSync(globalSettings, JSON.stringify({ hooks: { UserPromptSubmit: [] }, keep: true }, null, 2));
  fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
  const sharedSettings = path.join(tempDir, ".claude", "settings.json");
  fs.writeFileSync(sharedSettings, JSON.stringify({ shared: true }, null, 2));
  const localSettings = claudeLocalSettingsPath(tempDir);
  fs.writeFileSync(localSettings, JSON.stringify({
    permissions: { allow: ["Bash(echo:*)"] },
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: "command", command: "node /tmp/other.js" }] }],
    },
  }, null, 2));

  const result = installClaudeHookPreset(tempDir, "fooks");
  assert.equal(result.created, false);
  assert.equal(result.modified, true);
  assert.ok(result.backupPath);
  const merged = JSON.parse(fs.readFileSync(localSettings, "utf8"));
  assert.deepEqual(merged.permissions, { allow: ["Bash(echo:*)"] });
  assert.ok(merged.hooks.UserPromptSubmit.some((matcher) => matcher.hooks.some((hook) => hook.command === "node /tmp/other.js")));
  assert.equal(fs.readFileSync(globalSettings, "utf8"), JSON.stringify({ hooks: { UserPromptSubmit: [] }, keep: true }, null, 2));
  assert.equal(fs.readFileSync(sharedSettings, "utf8"), JSON.stringify({ shared: true }, null, 2));
});

test("install claude-hooks reports malformed local settings without overwriting", () => {
  const tempDir = makeTempProject();
  fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
  const localSettings = claudeLocalSettingsPath(tempDir);
  fs.writeFileSync(localSettings, "{not-json");
  const result = installClaudeHookPreset(tempDir, "fooks");
  assert.equal(result.modified, false);
  assert.match(result.blocker, /not valid JSON/);
  assert.equal(fs.readFileSync(localSettings, "utf8"), "{not-json");
});

test("claude runtime hook records first eligible prompt, injects repeated same-file prompt, and no-ops unsupported prompts", () => {
  const tempDir = makeTempProject();
  const sessionId = "claude-repeated-flow";
  const target = path.join("src", "components", "FormSection.tsx");
  const otherTarget = path.join("src", "components", "SimpleButton.tsx");
  const readSeenCount = (statePath, filePath) => JSON.parse(fs.readFileSync(statePath, "utf8")).seenFiles[filePath]?.seenCount;

  const start = handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  assert.equal(start.action, "inject");
  assert.ok(start.additionalContext.length <= CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS);
  assert.match(start.additionalContext, /no Read interception/);
  assert.match(start.additionalContext, /first prompt triggers context/);
  assert.match(start.statePath, /\.fooks\/state\/claude-runtime/);
  assert.deepEqual(JSON.parse(fs.readFileSync(start.statePath, "utf8")).seenFiles, {});

  const first = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Explain src/components/FormSection.tsx",
    },
    tempDir,
  );
  assert.equal(first.action, "record");
  assert.equal(first.filePath, target);
  assert.equal(first.additionalContext, undefined);
  assert.equal(first.contextMode, "no-op");
  assert.match(first.statePath, /\.fooks\/state\/claude-runtime/);
  assert.equal(first.debug.eligible, true);
  assert.equal(first.debug.repeatedFile, false);
  assert.equal(readSeenCount(first.statePath, target), 1);

  const second = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Again, explain src/components/FormSection.tsx",
    },
    tempDir,
  );
  assert.equal(second.action, "inject");
  assert.equal(second.filePath, target);
  assert.ok(second.additionalContext.length <= CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS);
  assert.match(second.additionalContext, /fooks: Claude context hook/);
  assert.match(second.additionalContext, /src\/components\/FormSection\.tsx/);
  assert.doesNotMatch(second.additionalContext, /Claude Read interception is enabled/i);
  assert.doesNotMatch(second.additionalContext, /Claude runtime-token savings are enabled/i);
  assert.equal(second.debug.repeatedFile, true);
  assert.equal(readSeenCount(second.statePath, target), 2);

  const differentFile = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Explain src/components/SimpleButton.tsx",
    },
    tempDir,
  );
  assert.equal(differentFile.action, "record");
  assert.equal(differentFile.filePath, otherTarget);
  assert.equal(differentFile.additionalContext, undefined);
  assert.equal(readSeenCount(differentFile.statePath, otherTarget), 1);

  const freshSession = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: "claude-repeated-flow-fresh-session",
      prompt: "Explain src/components/FormSection.tsx",
    },
    tempDir,
  );
  assert.equal(freshSession.action, "record");
  assert.notEqual(freshSession.statePath, second.statePath);

  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  const afterReset = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Explain src/components/FormSection.tsx",
    },
    tempDir,
  );
  assert.equal(afterReset.action, "record");
  assert.equal(readSeenCount(afterReset.statePath, target), 1);

  fs.writeFileSync(afterReset.statePath, "{not-json");
  const afterCorruptState = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Again, explain src/components/FormSection.tsx",
    },
    tempDir,
  );
  assert.equal(afterCorruptState.action, "record");
  assert.equal(readSeenCount(afterCorruptState.statePath, target), 1);

  const multiTarget = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: "claude-repeated-flow-multi-target",
      prompt: "Create src/components/MissingPanel.tsx and explain src/components/FormSection.tsx",
    },
    tempDir,
  );
  assert.equal(multiTarget.action, "record");
  assert.equal(multiTarget.filePath, target);

  const noTarget = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", prompt: "Tell me about this repo" }, tempDir);
  assert.equal(noTarget.action, "noop");
  const linkedTs = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", prompt: "Explain src/components/Button.types.ts" }, tempDir);
  assert.equal(linkedTs.action, "noop");
  const missing = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", prompt: "Create src/components/NewPanel.tsx" }, tempDir);
  assert.equal(missing.action, "noop");
});

test("claude runtime hook refreshes stale target state and clears active file on stop", () => {
  const tempDir = makeTempProject();
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  run(["attach", "claude"], tempDir, { FOOKS_CLAUDE_HOME: claudeHome });

  const sessionId = `claude-hook-refresh-${Date.now()}`;
  const target = path.join("src", "components", "FormSection.tsx");
  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Review ${target}`,
    },
    tempDir,
  );

  appendMarker(path.join(tempDir, target), "// claude-trust-refresh-marker");

  const second = handleClaudeRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: `Again, review ${target}`,
    },
    tempDir,
  );

  assert.equal(second.action, "inject");
  assert.equal(second.filePath, target);
  assert.ok(second.reasons.includes("refreshed-before-inject"));
  assert.match(second.additionalContext, /fooks does not intercept Claude Read/);

  const prepared = readClaudeTrustStatus(tempDir);
  assert.equal(prepared.connectionState, "connected");
  assert.equal(prepared.lifecycleState, "attach-prepared");
  assert.equal(prepared.activeFile.filePath, target);
  assert.equal(prepared.activeFile.source, "prompt-target");
  assert.ok(prepared.lastRefreshAt);
  assert.ok(prepared.lastAttachPreparedAt);

  handleClaudeRuntimeHook({ hookEventName: "Stop", sessionId }, tempDir);

  const afterStop = readClaudeTrustStatus(tempDir);
  assert.equal(afterStop.connectionState, "connected");
  assert.equal(afterStop.lifecycleState, "ready");
  assert.equal("activeFile" in afterStop, false);
});

test("codex and claude estimated metrics are runtime/source-qualified without session collisions", () => {
  const tempDir = makeTempProject();
  const sessionId = "same-session";
  const target = path.join("src", "components", "FormSection.tsx");
  const targetBytes = fs.statSync(path.join(tempDir, target)).size;

  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  handleCodexRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Review ${target}` }, tempDir);

  const claudeStart = handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId }, tempDir);
  assert.equal(claudeStart.action, "inject");
  const claudeStartSummary = readSessionMetricSummary(tempDir, sessionId, { runtime: "claude", measurementSource: "project-local-context-hook" });
  assert.equal(claudeStartSummary.eventCount, 0);
  assert.equal(claudeStartSummary.injectCount, 0);
  assert.equal(claudeStartSummary.comparableEventCount, 0);

  const claudeFirst = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Explain ${target}` }, tempDir);
  assert.equal(claudeFirst.action, "record");
  const claudeSecond = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId, prompt: `Again, explain ${target}` }, tempDir);
  assert.equal(claudeSecond.action, "inject");
  assert.ok(claudeSecond.additionalContext);

  const codexSummary = readSessionMetricSummary(tempDir, sessionId);
  const claudeSummary = readSessionMetricSummary(tempDir, sessionId, { runtime: "claude", measurementSource: "project-local-context-hook" });
  assert.equal(codexSummary.runtime, "codex");
  assert.equal(codexSummary.measurementSource, "automatic-hook");
  assert.equal(claudeSummary.runtime, "claude");
  assert.equal(claudeSummary.measurementSource, "project-local-context-hook");
  assert.equal(codexSummary.rawSessionKey, sessionId);
  assert.equal(claudeSummary.rawSessionKey, sessionId);
  assert.notEqual(codexSummary.metricSessionKey, claudeSummary.metricSessionKey);
  assert.notEqual(sessionSummaryPath(tempDir, codexSummary.metricSessionKey), sessionSummaryPath(tempDir, claudeSummary.metricSessionKey));
  assert.ok(fs.existsSync(sessionSummaryPath(tempDir, codexSummary.metricSessionKey)));
  assert.ok(fs.existsSync(sessionSummaryPath(tempDir, claudeSummary.metricSessionKey)));

  assert.equal(claudeSummary.eventCount, 2);
  assert.equal(claudeSummary.recordCount, 1);
  assert.equal(claudeSummary.injectCount, 1);
  assert.equal(claudeSummary.comparableEventCount, 1);
  assert.equal(claudeSummary.observedOpportunityCount, 1);
  assert.equal(claudeSummary.observedOriginalEstimatedBytes, targetBytes);
  assert.equal(claudeSummary.totals.originalEstimatedBytes, targetBytes);
  assert.equal(claudeSummary.totals.actualEstimatedBytes, Buffer.byteLength(claudeSecond.additionalContext, "utf8"));

  const claudeEvents = fs.readFileSync(sessionEventsPath(tempDir, claudeSummary.metricSessionKey), "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(claudeEvents.length, 2);
  assert.ok(claudeEvents.every((event) => event.metricTier === "estimated"));
  assert.ok(claudeEvents.every((event) => event.claimBoundary.includes("not provider billing tokens")));
  assert.ok(claudeEvents.every((event) => event.runtime === "claude"));
  assert.ok(claudeEvents.every((event) => event.measurementSource === "project-local-context-hook"));
  assert.ok(claudeEvents.every((event) => event.rawSessionKey === sessionId));
  assert.ok(claudeEvents.every((event) => event.metricSessionKey === claudeSummary.metricSessionKey));
  assert.ok(claudeEvents.every((event) => event.eventName === "UserPromptSubmit"));

  const status = run(["status"], tempDir);
  assert.equal(status.sessionCount, 2);
  assert.equal(status.breakdown.byRuntime.codex.eventCount, 1);
  assert.equal(status.breakdown.byRuntime.claude.eventCount, 2);
  assert.equal(status.breakdown.byMeasurementSource["automatic-hook"].eventCount, 1);
  assert.equal(status.breakdown.byMeasurementSource["project-local-context-hook"].eventCount, 2);
  assert.equal(status.breakdown.byRuntimeAndSource["codex:automatic-hook"].eventCount, 1);
  assert.equal(status.breakdown.byRuntimeAndSource["claude:project-local-context-hook"].eventCount, 2);

  const summaryFile = JSON.parse(fs.readFileSync(sessionsSummaryPath(tempDir), "utf8"));
  assert.equal(Object.keys(summaryFile.sessions).length, 2);
  assert.ok(summaryFile.sessions[codexSummary.sanitizedSessionKey]);
  assert.ok(summaryFile.sessions[claudeSummary.sanitizedSessionKey]);
});

test("claude fallback metrics record zero savings and telemetry failures are non-fatal", () => {
  const tempDir = makeTempProject();
  const hugeTarget = path.join("src", "components", "HugeRaw.tsx");
  fs.writeFileSync(
    path.join(tempDir, hugeTarget),
    `export const huge = ${JSON.stringify("x".repeat(5000))};\n`,
  );
  const hugeBytes = fs.statSync(path.join(tempDir, hugeTarget)).size;
  const fallbackSession = "claude-fallback-metrics";
  handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: fallbackSession }, tempDir);
  assert.equal(handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: fallbackSession, prompt: `Explain ${hugeTarget}` }, tempDir).action, "record");
  const fallback = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: fallbackSession, prompt: `Again, explain ${hugeTarget}` }, tempDir);
  assert.equal(fallback.action, "fallback");
  const fallbackSummary = readSessionMetricSummary(tempDir, fallbackSession, { runtime: "claude", measurementSource: "project-local-context-hook" });
  assert.equal(fallbackSummary.fallbackCount, 1);
  assert.equal(fallbackSummary.comparableEventCount, 1);
  assert.equal(fallbackSummary.totals.originalEstimatedBytes, hugeBytes);
  assert.equal(fallbackSummary.totals.actualEstimatedBytes, hugeBytes);
  assert.equal(fallbackSummary.totals.savedEstimatedBytes, 0);

  const blockedDir = makeTempProject();
  fs.mkdirSync(path.join(blockedDir, ".fooks"), { recursive: true });
  fs.writeFileSync(path.join(blockedDir, ".fooks", "sessions"), "not-a-directory");
  const target = path.join("src", "components", "FormSection.tsx");
  const blockedSession = "claude-blocked-metrics";
  const start = handleClaudeRuntimeHook({ hookEventName: "SessionStart", sessionId: blockedSession }, blockedDir);
  assert.equal(start.action, "inject");
  assert.match(start.additionalContext, /fooks: active/);
  const first = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: blockedSession, prompt: `Explain ${target}` }, blockedDir);
  assert.equal(first.action, "record");
  const second = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: blockedSession, prompt: `Again, explain ${target}` }, blockedDir);
  assert.equal(second.action, "inject");
  assert.match(second.additionalContext, /fooks: Claude context hook/);
  const noTarget = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: blockedSession, prompt: "Explain this repo" }, blockedDir);
  assert.equal(noTarget.action, "noop");
  const missing = handleClaudeRuntimeHook({ hookEventName: "UserPromptSubmit", sessionId: blockedSession, prompt: "Explain src/components/MissingPanel.tsx" }, blockedDir);
  assert.equal(missing.action, "noop");
});

test("claude native hook bridge activates only in attached Claude projects", () => {
  const detachedDir = makeTempProject();
  const detached = handleClaudeNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: detachedDir,
      prompt: "Explain src/components/FormSection.tsx",
      session_id: "claude-detached",
    },
    detachedDir,
  );
  assert.equal(detached, null);

  const attachedDir = makeTempProject();
  run(["attach", "claude"], attachedDir, { FOOKS_CLAUDE_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-")) });
  const sessionStart = handleClaudeNativeHookPayload({ hook_event_name: "SessionStart", cwd: attachedDir, session_id: "claude-native-start" }, attachedDir);
  assert.equal(sessionStart.hookSpecificOutput.hookEventName, "SessionStart");
  assert.ok(sessionStart.hookSpecificOutput.additionalContext.length <= CLAUDE_ADDITIONAL_CONTEXT_MAX_CHARS);

  const firstPrompt = handleClaudeNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Explain src/components/FormSection.tsx",
      session_id: "claude-native-first",
    },
    attachedDir,
  );
  assert.equal(firstPrompt, null);

  const prompt = handleClaudeNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Again, explain src/components/FormSection.tsx",
      session_id: "claude-native-first",
    },
    attachedDir,
  );
  assert.equal(prompt.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(prompt.hookSpecificOutput.additionalContext, /src\/components\/FormSection\.tsx/);
  assert.doesNotMatch(prompt.hookSpecificOutput.additionalContext, /Claude Read interception is enabled/i);

  assert.equal(handleClaudeNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Explain src/components/SimpleButton.tsx",
      transcript_path: path.join(attachedDir, ".claude", "transcripts", "session.jsonl"),
    },
    attachedDir,
  ), null);
  const transcriptFallbackPrompt = handleClaudeNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Again, explain src/components/SimpleButton.tsx",
      transcript_path: path.join(attachedDir, ".claude", "transcripts", "session.jsonl"),
    },
    attachedDir,
  );
  assert.equal(transcriptFallbackPrompt.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(transcriptFallbackPrompt.hookSpecificOutput.additionalContext, /src\/components\/SimpleButton\.tsx/);

  assert.equal(handleClaudeNativeHookPayload({ hook_event_name: "PreToolUse", cwd: attachedDir }, attachedDir), null);
  assert.equal(handleClaudeNativeHookPayload({ hook_event_name: "PostToolUse", cwd: attachedDir }, attachedDir), null);
  assert.equal(handleClaudeNativeHookPayload({ hook_event_name: "Read", cwd: attachedDir }, attachedDir), null);
  assert.equal(handleClaudeNativeHookPayload({ hook_event_name: "Stop", cwd: attachedDir }, attachedDir), null);
  assert.equal(handleClaudeNativeHookPayload({ hook_event_name: "SubagentStop", cwd: attachedDir }, attachedDir), null);
});

test("cli claude-runtime-hook handles native JSON and malformed JSON", () => {
  const attachedDir = makeTempProject();
  run(["attach", "claude"], attachedDir, { FOOKS_CLAUDE_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-")) });
  const firstOutput = runTextWithInput(
    ["claude-runtime-hook", "--native-hook"],
    JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Explain src/components/FormSection.tsx",
      session_id: "cli-claude-native",
    }),
    attachedDir,
  );
  assert.equal(firstOutput, "");

  const output = JSON.parse(runTextWithInput(
    ["claude-runtime-hook", "--native-hook"],
    JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Again, explain src/components/FormSection.tsx",
      session_id: "cli-claude-native",
    }),
    attachedDir,
  ));
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /src\/components\/FormSection\.tsx/);

  const unsupportedOutput = runTextWithInput(
    ["claude-runtime-hook", "--native-hook"],
    JSON.stringify({
      hook_event_name: "PreToolUse",
      cwd: attachedDir,
      session_id: "cli-claude-native",
    }),
    attachedDir,
  );
  assert.equal(unsupportedOutput, "");

  const stopOutput = run(["claude-runtime-hook", "--event", "Stop", "--session-id", "cli-claude-native"], attachedDir);
  assert.equal(stopOutput.hookEventName, "Stop");
  assert.equal(stopOutput.action, "noop");
  assert.ok(stopOutput.reasons.includes("session-stop"));

  let failure = "";
  try {
    runTextWithInput(["claude-runtime-hook", "--native-hook"], "{not-json", attachedDir);
  } catch (error) {
    failure = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(failure, /fooks claude-runtime-hook: invalid JSON payload/);
});

test("status claude reports blocked state without creating artifacts", () => {
  const tempDir = makeTempProject();
  const claudeHome = path.join(tempDir, ".missing-claude-home");

  const beforeFooks = fs.existsSync(path.join(tempDir, ".fooks"));
  const status = run(["status", "claude"], tempDir, { FOOKS_CLAUDE_HOME: claudeHome });
  const afterFooks = fs.existsSync(path.join(tempDir, ".fooks"));

  assert.equal(status.runtime, "claude");
  assert.equal(status.state, "blocked");
  assert.equal(status.ready, false);
  assert.equal(status.adapter.installed, false);
  assert.equal(status.adapter.adapterJson.exists, false);
  assert.equal(status.adapter.contextTemplate.exists, false);
  assert.equal(status.manifest.homeExists, false);
  assert.equal(status.manifest.exists, false);
  assert.ok(status.blockers.some((item) => item.includes("Claude adapter metadata is missing")));
  assert.ok(status.blockers.some((item) => item.includes("Claude context template is missing")));
  assert.ok(status.blockers.some((item) => item.includes("Claude runtime home not detected")));
  assert.equal(afterFooks, beforeFooks);
});

test("install codex-hooks creates a reusable hooks preset", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const result = run(["install", "codex-hooks"], repoRoot, { FOOKS_CODEX_HOME: codexHome });
  assert.equal(result.created, true);
  assert.equal(result.modified, true);
  assert.deepEqual(result.installedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  const hooks = JSON.parse(fs.readFileSync(path.join(codexHome, "hooks.json"), "utf8"));
  assert.equal(hooks.hooks.SessionStart[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(hooks.hooks.UserPromptSubmit[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(hooks.hooks.Stop[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
});

test("install codex-hooks merges without clobbering existing hooks and stays idempotent", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const hooksPath = path.join(codexHome, "hooks.json");
  fs.writeFileSync(hooksPath, JSON.stringify({
    hooks: {
      SessionStart: [{ matcher: "startup|resume", hooks: [{ type: "command", command: "node /tmp/omx-start.js", statusMessage: "Loading OMX session context" }] }],
      UserPromptSubmit: [{ hooks: [{ type: "command", command: "node /tmp/omx.js", statusMessage: "Applying OMX prompt routing" }] }],
      Stop: [{ hooks: [{ type: "command", command: "node /tmp/omx-stop.js" }] }],
    },
  }, null, 2));

  const first = run(["install", "codex-hooks"], repoRoot, { FOOKS_CODEX_HOME: codexHome });
  assert.equal(first.created, false);
  assert.equal(first.modified, true);
  assert.equal(first.installedEvents.length, 3);
  assert.ok(first.backupPath);

  const merged = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  assert.equal(merged.hooks.SessionStart.length, 2);
  assert.equal(merged.hooks.SessionStart[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(merged.hooks.SessionStart[1].hooks[0].command, "node /tmp/omx-start.js");
  assert.equal(merged.hooks.UserPromptSubmit[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(merged.hooks.UserPromptSubmit[1].hooks[0].command, "node /tmp/omx.js");
  assert.equal(merged.hooks.Stop[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(merged.hooks.Stop[1].hooks[0].command, "node /tmp/omx-stop.js");

  const second = run(["install", "codex-hooks"], repoRoot, { FOOKS_CODEX_HOME: codexHome });
  assert.equal(second.modified, false);
  assert.deepEqual(second.skippedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
});

test("install codex-hooks normalizes bridge commands to the canonical fooks command", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const hooksPath = path.join(codexHome, "hooks.json");
  fs.writeFileSync(hooksPath, JSON.stringify({
    hooks: {
      SessionStart: [{ matcher: "startup|resume", hooks: [{ type: "command", command: "fooks codex-runtime-hook --native-hook" }] }],
      UserPromptSubmit: [{ hooks: [{ type: "command", command: "node \"<repo-root>/dist/cli/index.js\" codex-runtime-hook --native-hook" }] }],
      Stop: [{ hooks: [{ type: "command", command: "fooks codex-runtime-hook --native-hook" }] }],
    },
  }, null, 2));

  const result = run(["install", "codex-hooks"], repoRoot, { FOOKS_CODEX_HOME: codexHome });
  assert.equal(result.created, false);
  assert.equal(result.modified, true);
  assert.deepEqual(result.installedEvents, []);
  assert.deepEqual(result.skippedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);

  const normalized = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  assert.equal(normalized.hooks.SessionStart[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(normalized.hooks.UserPromptSubmit[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
  assert.equal(normalized.hooks.Stop[0].hooks[0].command, "fooks codex-runtime-hook --native-hook");
});

test("install opencode-tool creates project-local fooks_extract tool and slash command", () => {
  const tempDir = makeTempProject();
  const result = run(["install", "opencode-tool"], tempDir);

  assert.equal(result.command, "install opencode-tool");
  assert.equal(result.runtime, "opencode");
  assert.equal(result.artifactKind, "custom-tool");
  assert.equal(result.toolName, "fooks_extract");
  assert.equal(result.commandName, "fooks-extract");
  assert.equal(result.mode, "manual/semi-automatic");
  assert.equal(result.created, true);
  assert.equal(result.modified, true);
  assert.equal(result.toolCreated, true);
  assert.equal(result.toolModified, true);
  assert.equal(result.commandCreated, true);
  assert.equal(result.commandModified, true);
  assert.ok(result.artifactPath.endsWith(path.join(".opencode", "tools", "fooks_extract.ts")));
  assert.ok(result.commandPath.endsWith(path.join(".opencode", "commands", "fooks-extract.md")));

  const artifact = fs.readFileSync(result.artifactPath, "utf8");
  assert.match(artifact, /export default tool\(/);
  assert.match(artifact, /fooks_extract/);
  assert.match(artifact, /filePath/);
  assert.match(artifact, /execFile/);
  assert.match(artifact, /"extract"/);
  assert.match(artifact, /"--model-payload"/);
  assert.match(artifact, /path\.resolve/);
  assert.match(artifact, /path\.relative/);
  assert.match(artifact, /fs\.realpath/);
  assert.match(artifact, /resolvedBase/);
  assert.match(artifact, /\.tsx/);
  assert.match(artifact, /\.jsx/);
  assert.doesNotMatch(artifact, /tool\.execute\.before/);
  assert.doesNotMatch(artifact, /input\.tool\s*===\s*["']read["']/);
  assert.doesNotMatch(artifact, /exec\(/);

  const command = fs.readFileSync(result.commandPath, "utf8");
  assert.match(command, /description: Explicitly steer opencode to fooks_extract/);
  assert.match(command, /\$ARGUMENTS/);
  assert.match(command, /Call the `fooks_extract` custom tool/);
  assert.match(command, /explicit tool-selection steering/);
  assert.match(command, /Do not claim automatic opencode read interception or runtime-token savings/);
});

test("install opencode-tool is idempotent", () => {
  const tempDir = makeTempProject();
  const first = run(["install", "opencode-tool"], tempDir);
  const firstContent = fs.readFileSync(first.artifactPath, "utf8");
  const firstCommandContent = fs.readFileSync(first.commandPath, "utf8");
  const second = run(["install", "opencode-tool"], tempDir);

  assert.equal(first.created, true);
  assert.equal(first.modified, true);
  assert.equal(first.toolCreated, true);
  assert.equal(first.toolModified, true);
  assert.equal(first.commandCreated, true);
  assert.equal(first.commandModified, true);
  assert.equal(second.created, false);
  assert.equal(second.modified, false);
  assert.equal(second.toolCreated, false);
  assert.equal(second.toolModified, false);
  assert.equal(second.commandCreated, false);
  assert.equal(second.commandModified, false);
  assert.equal(fs.readFileSync(second.artifactPath, "utf8"), firstContent);
  assert.equal(fs.readFileSync(second.commandPath, "utf8"), firstCommandContent);
});

test("generated opencode tool executes fooks extract through a runtime-shaped harness", async () => {
  const tempDir = makeTempProject();
  const result = run(["install", "opencode-tool"], tempDir);
  const harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-opencode-harness-"));
  const stubPath = path.join(harnessDir, "opencode-plugin-stub.mjs");
  const transpiledPath = path.join(harnessDir, "fooks_extract.runtime.mjs");
  const binDir = path.join(harnessDir, "bin");
  const fooksBin = path.join(binDir, "fooks");

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    stubPath,
    [
      "export function tool(definition) { return definition }",
      "tool.schema = { string() { return { describe() { return this } } } }",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    fooksBin,
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} "$@"\n`,
    "utf8",
  );
  fs.chmodSync(fooksBin, 0o755);

  const source = fs
    .readFileSync(result.artifactPath, "utf8")
    .replace('from "@opencode-ai/plugin"', `from ${JSON.stringify(pathToFileURL(stubPath).href)}`);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  fs.writeFileSync(transpiledPath, transpiled, "utf8");

  const previousPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ""}`;
  try {
    const toolModule = await import(`${pathToFileURL(transpiledPath).href}?${Date.now()}`);
    const output = await toolModule.default.execute(
      { filePath: "src/components/SimpleButton.tsx" },
      { directory: tempDir, worktree: tempDir },
    );

    assert.match(output, /SimpleButton|button/i);
    assert.doesNotMatch(output, /fooks_extract could not determine/);
  } finally {
    process.env.PATH = previousPath;
  }
});

test("install opencode-tool does not touch Codex or Claude runtime state", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const result = run(["install", "opencode-tool"], tempDir, { FOOKS_CODEX_HOME: codexHome });

  assert.equal(result.runtime, "opencode");
  assert.equal(fs.existsSync(path.join(codexHome, "hooks.json")), false);
  assert.equal(fs.existsSync(path.join(tempDir, ".fooks", "adapters", "codex")), false);
  assert.equal(fs.existsSync(path.join(tempDir, ".fooks", "adapters", "claude")), false);
});

test("install rejects unknown targets with all supported install options", () => {
  const tempDir = makeTempProject();
  let stderr = "";
  try {
    run(["install", "unknown"], tempDir);
  } catch (error) {
    stderr = `${error.stderr ?? ""}${error.stdout ?? ""}`;
  }

  assert.match(stderr, /codex-hooks/);
  assert.match(stderr, /opencode-tool/);
});

test("docs describe opencode as manual custom-tool support without runtime savings claims", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const setup = fs.readFileSync(path.join(repoRoot, "docs", "setup.md"), "utf8");
  const release = fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8");
  const interception = fs.readFileSync(path.join(repoRoot, "docs", "opencode-read-interception.md"), "utf8");
  const combined = `${readme}\n${setup}\n${release}\n${interception}`;

  assert.match(combined, /fooks install opencode-tool/);
  assert.match(combined, /\/fooks-extract/);
  assert.match(combined, /manual\/semi-automatic/);
  assert.match(combined, /custom-tool/);
  assert.match(combined, /tool-selection steering/);
  assert.match(combined, /read interception|intercept opencode `read` calls/);
  assert.match(combined, /project-local `read` shadow|project-local `read` override/);
  assert.match(combined, /runtime-token savings|runtime-token benchmark claim/);
  assert.match(combined, /Claude and opencode/);
  assert.match(release, /npm run release:smoke/);
  assert.match(release, /FOOKS_ACTIVE_ACCOUNT/);
  assert.match(setup, /runtimes\.claude\.state/);
  assert.match(setup, /runtimes\.opencode\.state/);

  const releaseSmoke = fs.readFileSync(path.join(repoRoot, "scripts", "release-smoke.mjs"), "utf8");
  assert.ok(releaseSmoke.includes('run("npm", ["pack", "--dry-run", "--json"])'));
  assert.match(releaseSmoke, /FOOKS_CODEX_HOME/);
  assert.match(releaseSmoke, /FOOKS_CLAUDE_HOME/);
  assert.match(releaseSmoke, /account-source=package-repository/);
  assert.equal(releaseSmoke.includes('run("npm", ["publish"'), false);
});

test("package release surface keeps internal docs out of the npm tarball", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const release = fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8");
  const releaseSmoke = fs.readFileSync(path.join(repoRoot, "scripts", "release-smoke.mjs"), "utf8");
  const gitignore = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");

  assert.ok(pkg.files.includes("dist"));
  assert.ok(pkg.files.includes("docs/setup.md"));
  assert.ok(pkg.files.includes("docs/release.md"));
  assert.equal(pkg.files.includes("docs"), false);
  assert.equal(pkg.files.some((entry) => entry.startsWith("docs/internal")), false);
  assert.equal(pkg.files.some((entry) => entry.startsWith("benchmarks")), false);
  assert.doesNotMatch(readme, /Useful internal docs/);
  assert.doesNotMatch(readme, /benchmarks\/frontend-harness\/reports/);
  assert.match(readme, /intentionally not part of the npm package payload/);
  assert.match(release, /excludes internal notes, benchmark corpora\/results, and planning archives/);
  assert.match(releaseSmoke, /docs\/internal\//);
  assert.match(releaseSmoke, /packed tarball includes non-public path/);
  assert.match(gitignore, /docs\/internal\//);
  assert.match(gitignore, /\.opencode\//);
});

test("docs describe local compare estimates without billing-cost claims", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const setup = fs.readFileSync(path.join(repoRoot, "docs", "setup.md"), "utf8");
  const release = fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8");
  const combined = `${readme}
${setup}
${release}`;

  assert.match(readme, /Smaller model-facing context for repeated same-file work in Codex\./);
  assert.match(readme, /Claude and opencode are narrower helper paths, not Codex-equivalent automatic optimization\./);
  assert.match(combined, /fooks compare src\/components\/Button\.tsx/);
  assert.match(combined, /local model-facing payload estimate|local file-level estimate/);
  assert.match(combined, /TypeScript AST-derived/);
  assert.match(combined, /estimated input-token load|estimated input-token/);
  assert.match(combined, /not provider billing tokens/);
  assert.match(combined, /not provider costs/);
  assert.match(combined, /Claude.*project-local context hooks|project-local `SessionStart` \/ `UserPromptSubmit` hooks/s);
  assert.doesNotMatch(combined, /fooks reduces your actual provider bill/i);
  assert.doesNotMatch(combined, /measured Codex\/Claude billing tokens/i);
  assert.doesNotMatch(combined, /automatic Claude Read\/tool interception/i);
});

test("docs keep direct runtime benchmark regressions out of public win claims", () => {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const release = fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8");
  const followupPath = path.join(repoRoot, "benchmarks", "frontend-harness", "reports", "round1-risk-followup-1776327829.md");
  if (!fs.existsSync(followupPath)) {
    console.log("skip: benchmark followup report not present");
    return;
  }
  const followup = fs.readFileSync(followupPath, "utf8");
  const combined = `${readme}\n${release}\n${followup}`;

  assert.match(combined, /not stable yet|does \*\*not\*\* support a stable direct-Codex speed or runtime-token reduction claim/);
  assert.match(combined, /fooks used more runtime tokens in 3\/6 pairs/);
  assert.match(combined, /median runtime-token reduction was -5\.35%|Median runtime-token reduction: -5\.35%/);
  assert.match(release, /Blocks stable runtime-token\/time win claims/);
  assert.doesNotMatch(readme, /billing-grade runtime-token savings claims/i);
});

test("Layer 2 runner uses current Codex exec path instead of legacy configured gateway", () => {
  const wrapper = fs.readFileSync(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "codex-wrapper.js"), "utf8");
  const runner = fs.readFileSync(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "runner.js"), "utf8");
  const status = fs.readFileSync(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "STATUS.md"), "utf8");
  const release = fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8");
  const r4SmokePath = path.join(repoRoot, "benchmarks", "layer2-frontend-task", "results", "R4-current-exec-smoke-2026-04-21.json");
  if (!fs.existsSync(r4SmokePath)) {
    console.log("skip: layer2 smoke results not present");
    return;
  }
  const r4Smoke = JSON.parse(fs.readFileSync(r4SmokePath, "utf8"));
  const r4SmokeRun2 = JSON.parse(fs.readFileSync(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "results", "R4-current-exec-smoke-2026-04-21-run-2.json"), "utf8"));
  const r4Validation = JSON.parse(fs.readFileSync(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "results", "R4-current-exec-validation-2026-04-21.json"), "utf8"));

  assert.match(wrapper, /codex exec/);
  assert.match(wrapper, /--ephemeral/);
  assert.match(wrapper, /--sandbox/);
  assert.match(wrapper, /read-only/);
  assert.match(wrapper, /last-message\.txt/);
  assert.match(runner, /CODEX_MODEL/);
  assert.match(runner, /promptSafeExtraction/);
  assert.match(runner, /path\.basename\(targetFile\)/);
  assert.match(wrapper, /Use only the provided context/);
  assert.equal(r4Smoke.status, "proposal-only-paired-smoke-validated");
  assert.equal(r4Smoke.validation.passed, true);
  assert.equal(r4Smoke.results.vanilla.success, true);
  assert.equal(r4Smoke.results.fooks.success, true);
  assert.equal(r4Smoke.deltas.promptTokensApproxReductionPct, 92.4);
  assert.equal(r4SmokeRun2.status, "proposal-only-paired-smoke-validated");
  assert.equal(r4SmokeRun2.validation.passed, true);
  assert.equal(r4SmokeRun2.deltas.promptTokensApproxReductionPct, 92.4);
  assert.equal(r4Validation.status, "validated-repeated-proposal-only-smoke");
  assert.equal(r4Validation.pairCount, 2);
  assert.equal(r4Validation.aggregate.allPairsPassed, true);
  assert.equal(r4Validation.aggregate.promptTokensApproxReductionPct.median, 92.4);
  assert.ok(r4Validation.checks.every((check) => check.passed));
  assert.match(`${status}\n${release}`, /not provider billing telemetry|not enough for stable runtime-token\/time win claims/);
  assert.match(status, /two matched pairs|2\/2 matched pairs/i);
  assert.doesNotMatch(`${wrapper}\n${runner}`, /OPENAI_BASE_URL|api-base-url|gpt-4o|temperature|maxTokens/);
});

test("status cache reports empty for a fresh project before any scan", () => {
  const tempDir = makeTempProject();
  const status = run(["status", "cache"], tempDir);

  assert.equal(status.status, "empty");
  assert.equal(status.indexExists, false);
  assert.equal(status.indexValid, false);
  assert.equal(status.entryCount, 0);
});

test("status cache reports healthy after scan builds the cache index", () => {
  const tempDir = makeTempProject();
  const scan = run(["scan"], tempDir);
  const status = run(["status", "cache"], tempDir);

  assert.ok(scan.files.length > 0);
  assert.equal(status.status, "healthy");
  assert.equal(status.indexExists, true);
  assert.equal(status.indexValid, true);
  assert.ok(status.entryCount >= 5);
});

test("attach codex proves contract and runtime under minislively account context", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const result = run(["attach", "codex"], tempDir, { FOOKS_CODEX_HOME: codexHome });
  assert.equal(result.runtime, "codex");
  assert.equal(result.contractProof.passed, true);
  assert.equal(result.runtimeProof.status, "passed");
  assert.ok(result.runtimeProof.attemptedAt);
  assert.ok(result.filesCreated.some((item) => item.includes("adapter.json")));
  assert.ok(!fs.existsSync(path.join(tempDir, "fixtures")));
  assert.ok(result.runtimeProof.details.some((item) => item.includes("runtime-manifest=")));
  assert.ok(result.runtimeProof.details.some((item) => item.includes("account-source=")));
  assert.ok(fs.existsSync(runtimeManifestPath(result)));
  const runtimeManifest = JSON.parse(fs.readFileSync(runtimeManifestPath(result), "utf8"));
  assert.equal(runtimeManifest.runtimeBridge.command, "fooks codex-runtime-hook --native-hook");
  assert.deepEqual(runtimeManifest.runtimeBridge.supportedHookEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  assert.deepEqual(runtimeManifest.runtimeBridge.escapeHatches, ["#fooks-full-read", "#fooks-disable-pre-read"]);
  assert.equal(result.trustStatus.connectionState, "connected");
  assert.equal(result.trustStatus.lifecycleState, "ready");
  assert.ok(result.trustStatus.lastScanAt);
  assert.ok(result.trustStatus.lastRefreshAt);
  const status = run(["status", "codex"], tempDir);
  assert.equal(status.connectionState, "connected");
  assert.equal(status.lifecycleState, "ready");
  assert.ok(status.attachedAt);
  assert.ok(status.lastScanAt);
});

test("attach claude rejects Codex-only TS/JS beta projects before handoff check", () => {
  const tempDir = makeTempProject();
  for (const file of [
    path.join(tempDir, "src", "components", "SimpleButton.tsx"),
    path.join(tempDir, "src", "components", "FormSection.tsx"),
    path.join(tempDir, "src", "components", "DashboardPanel.tsx"),
    path.join(tempDir, "src", "components", "DateBadge.tsx"),
  ]) {
    fs.rmSync(file, { force: true });
  }

  assert.throws(
    () => run(["attach", "claude"], tempDir),
    /attach claude requires a React\/TSX component file for handoff check/,
  );
});

test("attach codex can still use a strong TS/JS beta project sample", () => {
  const tempDir = makeTempProject();
  for (const file of [
    path.join(tempDir, "src", "components", "SimpleButton.tsx"),
    path.join(tempDir, "src", "components", "FormSection.tsx"),
    path.join(tempDir, "src", "components", "DashboardPanel.tsx"),
    path.join(tempDir, "src", "components", "DateBadge.tsx"),
  ]) {
    fs.rmSync(file, { force: true });
  }

  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const result = run(["attach", "codex"], tempDir, { FOOKS_CODEX_HOME: codexHome });
  assert.equal(result.runtime, "codex");
  assert.equal(result.contractProof.passed, true);
  assert.equal(result.runtimeProof.status, "passed");
});

test("attach claude can report blocker without failing contract proof", () => {
  const tempDir = makeTempProject();
  const result = run(["attach", "claude"], tempDir, { FOOKS_CLAUDE_HOME: path.join(tempDir, ".missing-claude-home") });
  assert.equal(result.runtime, "claude");
  assert.equal(result.contractProof.passed, true);
  assert.equal(result.runtimeProof.status, "blocked");
  assert.ok(result.runtimeProof.attemptedAt);
  assert.ok(result.runtimeProof.blocker);
});

test("attach claude pairs manual handoff proof with reduced model-facing artifact", () => {
  const tempDir = makeTempProject();
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-claude-home-"));
  const samplePath = path.join(tempDir, "src", "components", "FormSection.tsx");

  withEnv({ FOOKS_CLAUDE_HOME: claudeHome }, () => {
    const result = attachClaude(samplePath, tempDir);
    assert.equal(result.runtime, "claude");
    assert.equal(result.contractProof.passed, true);
    assert.equal(result.runtimeProof.status, "passed");
    assert.ok(result.runtimeProof.attemptedAt);

    const manifestPath = runtimeManifestPath(result);
    assert.ok(manifestPath);
    assert.ok(fs.existsSync(manifestPath));
    assert.ok(result.filesCreated.some((item) => item.endsWith(path.join("claude", "adapter.json"))));
    assert.ok(result.filesCreated.some((item) => item.endsWith(path.join("claude", "context-template.md"))));
    assert.ok(fs.existsSync(path.join(tempDir, ".fooks", "adapters", "claude", "context-template.md")));

    const manifestText = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestText);
    assert.equal(manifest.runtime, "claude");
    assert.equal(manifest.runtimeBridge.command, "fooks claude-runtime-hook --native-hook");
    assert.deepEqual(manifest.runtimeBridge.supportedHookEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
    assert.deepEqual(manifest.runtimeBridge.scope.extensions, [".tsx", ".jsx"]);
    assert.equal(manifest.runtimeBridge.scope.strategy, "project-local-context-hook");
    assert.deepEqual(manifest.runtimeBridge.escapeHatches, ["#fooks-full-read", "#fooks-disable-pre-read"]);
    assert.match(manifest.runtimeBridge.claimBoundary, /no Claude Read interception or runtime-token savings claim/);
    assert.doesNotMatch(manifestText, /codex-runtime-hook/);
    assert.ok(result.runtimeProof.details.includes("runtime-token-telemetry=not-collected"));
  });

  const fullResult = extractFile(samplePath);
  const payload = toModelFacingPayload(fullResult, tempDir);
  const sourceBytes = Buffer.byteLength(fs.readFileSync(samplePath, "utf8"), "utf8");
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");

  assert.equal(fullResult.mode, "compressed");
  assert.equal(payload.mode, "compressed");
  assert.equal(payload.filePath, path.join("src", "components", "FormSection.tsx"));
  assert.equal("rawText" in payload, false);
  assert.ok(payloadBytes < sourceBytes, `expected reduced handoff artifact, got payload=${payloadBytes}, source=${sourceBytes}`);
});

test("attach can use explicit active account override instead of repository metadata", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-home-"));
  const result = run(["attach", "codex"], tempDir, {
    FOOKS_ACTIVE_ACCOUNT: "minislively",
    FOOKS_CODEX_HOME: codexHome,
  });
  assert.equal(result.runtimeProof.status, "passed");
  assert.ok(result.runtimeProof.details.includes("account-source=env"));
});

test("isEditIntentPrompt recognizes edit-intent prompts and rejects non-edit prompts", () => {
  assert.equal(isEditIntentPrompt("Update Button.tsx to add disabled state"), true);
  assert.equal(isEditIntentPrompt("Fix validation in Form.tsx"), true);
  assert.equal(isEditIntentPrompt("Refactor the hook logic"), true);
  assert.equal(isEditIntentPrompt("Patch the module export"), true);
  assert.equal(isEditIntentPrompt("Read Form.tsx and explain how it works"), false);
  assert.equal(isEditIntentPrompt("Review the code for style issues"), false);
  assert.equal(isEditIntentPrompt("What does this component do?"), false);
  assert.equal(isEditIntentPrompt("Describe the architecture"), false);
});

test("hasPositiveFreshness requires scannedAt to pass", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-freshness-"));
  const tempFile = path.join(tempDir, "freshness-test.tsx");
  fs.writeFileSync(tempFile, "export function Test() {}");
  assert.equal(hasPositiveFreshness("freshness-test.tsx", tempDir, { refreshed: false, scannedAt: new Date().toISOString() }), true);
  assert.equal(hasPositiveFreshness("freshness-test.tsx", tempDir, { refreshed: false }), false);
  fs.rmSync(tempDir, { recursive: true });
});
