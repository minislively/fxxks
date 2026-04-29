// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const docsRoots = ["README.md", "docs"];

const forbiddenBroadSupportClaims = [
  {
    label: "react-native-supported",
    pattern: /\b(?:React Native|RN)\b[^\n]{0,80}\b(?:is|are|now|currently)?\s*(?:fully\s+)?supported\b/i,
  },
  {
    label: "supports-react-native",
    pattern: /\b(?:supports?|supporting|support for)\b[^\n]{0,80}\b(?:React Native|RN)\b/i,
  },
  {
    label: "react-native-support-available",
    pattern: /\b(?:React Native|RN)\b[^\n]{0,80}\bsupport\b[^\n]{0,40}\b(?:available|enabled|shipped|ready|stable|general|broad|complete)\b/i,
  },
  {
    label: "webview-supported",
    pattern: /\bWebView\b[^\n]{0,80}\b(?:is|are|now|currently)?\s*(?:fully\s+)?supported\b/i,
  },
  {
    label: "supports-webview",
    pattern: /\b(?:supports?|supporting|support for)\b[^\n]{0,80}\bWebView\b/i,
  },
  {
    label: "webview-support-available",
    pattern: /\bWebView\b[^\n]{0,80}\bsupport\b[^\n]{0,40}\b(?:available|enabled|shipped|ready|stable|general|broad|complete)\b/i,
  },
  {
    label: "tui-supported",
    pattern: /\b(?:TUI|TUI\/Ink|terminal UI|React CLI)\b[^\n]{0,80}\b(?:is|are|now|currently)?\s*(?:fully\s+)?supported\b/i,
  },
  {
    label: "supports-tui",
    pattern: /\b(?:supports?|supporting|support for)\b[^\n]{0,80}\b(?:TUI|TUI\/Ink|terminal UI|React CLI)\b/i,
  },
  {
    label: "tui-support-available",
    pattern: /\b(?:TUI|TUI\/Ink|terminal UI|React CLI)\b[^\n]{0,80}\bsupport\b[^\n]{0,40}\b(?:available|enabled|shipped|ready|stable|general|broad|complete)\b/i,
  },
  {
    label: "webview-default-compact-extraction",
    pattern: /\b(?:default\s+)?WebView\b[^\n]{0,80}\b(?:compact payload|compact-payload|compact extraction|extraction)\b[^\n]{0,40}\b(?:enabled|supported|safe|available|default)\b/i,
  },
  {
    label: "tui-default-compact-extraction",
    pattern: /\b(?:default\s+)?(?:TUI|TUI\/Ink|terminal UI)\b[^\n]{0,80}\b(?:compact payload|compact-payload|compact extraction|extraction)\b[^\n]{0,40}\b(?:enabled|supported|safe|available|default)\b/i,
  },
];

const conservativeBoundary = /\b(?:not|no|nor|never|without|cannot|can't|does not|do not|must not|should not|isn't|aren't|remain(?:s)?\s+(?:deferred|fallback)|deferred(?:\s+support)?\s+lane|roadmap|future|candidate|evidence(?:-|\s)lane|evidence only|syntax(?:-|\s)level only|fallback(?:-|\s)first|claim boundary|forbidden support claims?|forbid(?:den)?|not support claims?|no support claim|not broad|not current support|no public|support claim expansion|not a .*support claim|claims? broad|before changing[^\n]{0,80}support wording|must choose|only\s+if\s+evidence)\b/i;

const measuredNarrowEvidence = /\b(?:measured\s+`?F1`?|F1`?\s+RN primitive\/input|rn-primitive-input-narrow-payload|narrow\s+(?:RN\s+)?(?:pre-read\s+)?payload|measured\s+(?:primitive\/input|same-file)\s+scope)\b/i;


const forbiddenSchemaEditGuidanceClaims = [
  {
    label: "edit-guidance-guarantees-edits",
    pattern: /\b(?:editGuidance|edit guidance|patchTargets?|patch targets?)\b[^\n]{0,120}\b(?:guarantees?|ensures?|proves?|makes?)\b[^\n]{0,80}\b(?:safe|successful|correct|accurate|automatic|runtime|production)\b[^\n]{0,60}\bedits?\b/i,
  },
  {
    label: "patch-targets-lsp-semantic-safety",
    pattern: /\b(?:patchTargets?|patch targets?|loc ranges?|line ranges?)\b[^\n]{0,120}\b(?:LSP-backed|semantic(?:ally)? safe|rename\/reference safe|rename safe|reference safe)\b/i,
  },
  {
    label: "edit-guidance-runtime-outcome-proof",
    pattern: /\b(?:editGuidance|edit guidance|patchTargets?|patch targets?)\b[^\n]{0,120}\b(?:runtime|automatic|Codex|Claude|live model)\b[^\n]{0,80}\b(?:outcome|editing?|accuracy|success|speed|fewer reads?|search steps?)\b[^\n]{0,80}\b(?:proven|guaranteed|available|enabled|improved|reduced)\b/i,
  },
  {
    label: "fallback-receives-edit-guidance",
    pattern: /\b(?:fallback|unsupported[-\s]frontend[-\s]domain[-\s]profile|unsupported[-\s]react[-\s]native[-\s]webview[-\s]boundary)\b[^\n]{0,120}\b(?:receives?|includes?|constructs?|gets?|returns?)\b[^\n]{0,80}\b(?:editGuidance|edit guidance|patchTargets?|patch targets?|compact payload)\b/i,
  },
];

const schemaEditGuidanceBoundary = /\b(?:not|no|nor|never|without|cannot|can't|does not|do not|must not|should not|isn't|aren't|remain(?:s)?|fallback-first|full-source|normal source reading|read the file|rerun|re-run|opt-in|explicitly request|requires?|before applying|confirm|matching source fingerprint|sourceFingerprint|AST-derived|line-aware hints?|edit aids?|not LSP-backed|not proof|not proven|not provider|not billing|local\/dry-run|claim boundary|forbidden|must stop|before compact payload construction|must continue to fallback|no automatic|no default|future opt-in path|requires an explicit opt-in path)\b/i;

const forbiddenBroadDomainParallelClaims = [
  {
    label: "domain-parallel-free-for-all",
    pattern: /\b(?:domain[-\s]parallel|parallel domain|domain lanes?|frontend domain lanes?)\b[^\n]{0,100}\b(?:free-for-all|any file|all files|shared files|shared seams|shared runtime|runtime seams)\b/i,
  },
  {
    label: "domain-parallel-broad-safe",
    pattern: /\b(?:safe to split|safe to parallelize|parallel-safe|safe in parallel)\b[^\n]{0,100}\b(?:without|no need for|does not need|needn'?t|across|any|all|shared)\b[^\n]{0,80}\b(?:owner|merge-order|serialization|serialized|disjoint-file|shared seams?|shared runtime|runtime seams?)\b/i,
  },
  {
    label: "domain-parallel-runtime-support",
    pattern: /\b(?:domain[-\s]parallel|parallel domain|safe to split)\b[^\n]{0,100}\b(?:runtime behavior|runtime support|support expansion|support claim|source changes?)\b[^\n]{0,60}\b(?:authorized|permitted|allowed|enabled|supported|safe|available|default)\b/i,
  },
];

const domainParallelBoundary = /\b(?:not itself runtime behavior change|does not authorize runtime source changes|docs\/tests-only by default|shared-file free-for-all|must name one shared-policy owner|merge-order note|disjoint-file proof|changed-file guard|must serialize|not parallel-safe|only when it avoids shared support-policy expansion|single runtime writer lane|full domain writer parallelism[^\n]{0,80}forbidden|remains forbidden|shared seams? must serialize|worktree launch needs a separate plan|separate approved launch plan|no domain implementation worktree is authorized)\b/i;

function collectMarkdownFiles(entry) {
  const absolute = path.join(repoRoot, entry);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  const files = [];
  for (const name of fs.readdirSync(absolute)) {
    const child = path.join(absolute, name);
    const childStat = fs.statSync(child);
    if (childStat.isDirectory()) {
      files.push(...collectMarkdownFiles(path.relative(repoRoot, child)));
    } else if (name.endsWith(".md")) {
      files.push(child);
    }
  }
  return files;
}

function isNegatedOrScoped(line) {
  if (conservativeBoundary.test(line)) return true;
  if (measuredNarrowEvidence.test(line) && /\b(?:React Native|RN)\b/i.test(line) && !/\bWebView\b/i.test(line)) return true;
  return false;
}

function findBroadSupportClaims(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    for (const rule of forbiddenBroadSupportClaims) {
      if (rule.pattern.test(normalized) && !isNegatedOrScoped(normalized)) {
        findings.push(`${relativePath}:${index + 1} [${rule.label}] ${normalized}`);
      }
    }
  }
  return findings;
}


function findSchemaEditGuidanceClaims(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    for (const rule of forbiddenSchemaEditGuidanceClaims) {
      if (rule.pattern.test(normalized) && !schemaEditGuidanceBoundary.test(normalized)) {
        findings.push(`${relativePath}:${index + 1} [${rule.label}] ${normalized}`);
      }
    }
  }
  return findings;
}

function findBroadDomainParallelClaims(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    for (const rule of forbiddenBroadDomainParallelClaims) {
      if (rule.pattern.test(normalized) && !domainParallelBoundary.test(normalized)) {
        findings.push(`${relativePath}:${index + 1} [${rule.label}] ${normalized}`);
      }
    }
  }
  return findings;
}

test("current docs do not make broad RN/WebView/TUI support claims", () => {
  const markdownFiles = docsRoots.flatMap(collectMarkdownFiles).sort();
  assert.ok(markdownFiles.some((file) => file.endsWith(path.join("docs", "release.md"))), "release doc should be in audit corpus");
  assert.ok(markdownFiles.some((file) => file.endsWith(path.join("docs", "roadmap.md"))), "roadmap doc should be in audit corpus");
  assert.ok(markdownFiles.some((file) => file.endsWith("README.md")), "README should be in audit corpus");

  const findings = markdownFiles.flatMap((file) => {
    const relativePath = path.relative(repoRoot, file);
    return findBroadSupportClaims(fs.readFileSync(file, "utf8"), relativePath);
  });

  assert.deepEqual(findings, [], `forbidden broad support claims found:\n${findings.join("\n")}`);
});

test("current docs do not make broad domain-parallel execution claims", () => {
  const markdownFiles = docsRoots.flatMap(collectMarkdownFiles).sort();

  const findings = markdownFiles.flatMap((file) => {
    const relativePath = path.relative(repoRoot, file);
    return findBroadDomainParallelClaims(fs.readFileSync(file, "utf8"), relativePath);
  });

  assert.deepEqual(findings, [], `forbidden broad domain-parallel claims found:\n${findings.join("\n")}`);
});


test("current docs do not make schema-facing edit-guidance or fallback execution claims", () => {
  const markdownFiles = docsRoots.flatMap(collectMarkdownFiles).sort();
  assert.ok(markdownFiles.some((file) => file.endsWith(path.join("docs", "edit-guidance-evidence.md"))), "edit-guidance evidence doc should be in audit corpus");
  assert.ok(markdownFiles.some((file) => file.endsWith(path.join("docs", "frontend-fixture-boundary-regression-map.md"))), "frontend fixture boundary map should be in audit corpus");

  const findings = markdownFiles.flatMap((file) => {
    const relativePath = path.relative(repoRoot, file);
    return findSchemaEditGuidanceClaims(fs.readFileSync(file, "utf8"), relativePath);
  });

  assert.deepEqual(findings, [], `forbidden schema-facing edit-guidance/fallback claims found:\n${findings.join("\n")}`);
});

test("claim-boundary doc audit preserves measured narrow evidence wording", () => {
  const release = fs.readFileSync(path.join(repoRoot, "docs", "release.md"), "utf8");
  const contract = fs.readFileSync(path.join(repoRoot, "docs", "frontend-domain-contract.md"), "utf8");
  const roadmap = fs.readFileSync(path.join(repoRoot, "docs", "roadmap.md"), "utf8");
  const combined = `${release}\n${contract}\n${roadmap}`;

  assert.match(combined, /measured `F1` RN primitive\/input narrow pre-read payload gate/);
  assert.match(combined, /`rn-primitive-input-narrow-payload`/);
  assert.match(combined, /not broad React Native support/);
  assert.match(combined, /WebView starts as a boundary\/fallback profile, not default compact extraction/);
  assert.match(combined, /TUI \/ React CLI profiles[\s\S]*Future profile candidate only; no implementation or support promise/);
});

test("claim-boundary doc audit rejects positive examples but allows negated or measured examples", () => {
  assert.deepEqual(findBroadSupportClaims("React Native support is available for all TSX files.", "synthetic.md"), [
    "synthetic.md:1 [react-native-support-available] React Native support is available for all TSX files.",
  ]);
  assert.deepEqual(findBroadSupportClaims("fooks now supports WebView compact extraction by default.", "synthetic.md"), [
    "synthetic.md:1 [supports-webview] fooks now supports WebView compact extraction by default.",
    "synthetic.md:1 [webview-default-compact-extraction] fooks now supports WebView compact extraction by default.",
  ]);
  assert.deepEqual(findBroadSupportClaims("TUI support is available with terminal correctness guarantees.", "synthetic.md"), [
    "synthetic.md:1 [tui-support-available] TUI support is available with terminal correctness guarantees.",
  ]);
  assert.deepEqual(findBroadSupportClaims("The measured F1 RN primitive/input narrow payload gate is not broad React Native support.", "synthetic.md"), []);
  assert.deepEqual(findBroadSupportClaims("WebView remains fallback-first; no WebView support claim.", "synthetic.md"), []);
  assert.deepEqual(findBroadSupportClaims("TUI / React CLI is a future profile candidate only; no implementation or support promise.", "synthetic.md"), []);
});


test("claim-boundary doc audit rejects schema-facing edit-guidance execution claims but allows scoped boundaries", () => {
  assert.deepEqual(findSchemaEditGuidanceClaims("editGuidance patchTargets guarantee safe automatic runtime edits.", "synthetic.md"), [
    "synthetic.md:1 [edit-guidance-guarantees-edits] editGuidance patchTargets guarantee safe automatic runtime edits.",
  ]);
  assert.deepEqual(findSchemaEditGuidanceClaims("patchTargets are LSP-backed rename/reference safe locations.", "synthetic.md"), [
    "synthetic.md:1 [patch-targets-lsp-semantic-safety] patchTargets are LSP-backed rename/reference safe locations.",
  ]);
  assert.deepEqual(findSchemaEditGuidanceClaims("fallback paths include editGuidance patchTargets for unsupported profiles.", "synthetic.md"), [
    "synthetic.md:1 [fallback-receives-edit-guidance] fallback paths include editGuidance patchTargets for unsupported profiles.",
  ]);
  assert.deepEqual(findSchemaEditGuidanceClaims("patchTargets are AST-derived edit aids that require a matching sourceFingerprint before applying edits.", "synthetic.md"), []);
  assert.deepEqual(findSchemaEditGuidanceClaims("Pre-read must stop at fallback before compact payload construction, including calls that request edit guidance.", "synthetic.md"), []);
  assert.deepEqual(findSchemaEditGuidanceClaims("A positive dry-run report is not by itself a claim that automatic Codex runtime editing improved.", "synthetic.md"), []);
});

test("claim-boundary doc audit rejects broad domain-parallel examples but allows scoped safety-layer wording", () => {
  assert.deepEqual(findBroadDomainParallelClaims("Domain-parallel lanes are safe to split across shared runtime seams without a named owner.", "synthetic.md"), [
    "synthetic.md:1 [domain-parallel-free-for-all] Domain-parallel lanes are safe to split across shared runtime seams without a named owner.",
    "synthetic.md:1 [domain-parallel-broad-safe] Domain-parallel lanes are safe to split across shared runtime seams without a named owner.",
  ]);
  assert.deepEqual(findBroadDomainParallelClaims("Safe to split means runtime support is enabled for domain-parallel source changes.", "synthetic.md"), [
    "synthetic.md:1 [domain-parallel-runtime-support] Safe to split means runtime support is enabled for domain-parallel source changes.",
  ]);
  assert.deepEqual(findBroadDomainParallelClaims("The PR wave contract says domain-parallel runtime support is authorized for source changes.", "synthetic.md"), [
    "synthetic.md:1 [domain-parallel-runtime-support] The PR wave contract says domain-parallel runtime support is authorized for source changes.",
  ]);
  assert.deepEqual(findBroadDomainParallelClaims("The PR wave contract says domain-parallel runtime support is permitted for source changes.", "synthetic.md"), [
    "synthetic.md:1 [domain-parallel-runtime-support] The PR wave contract says domain-parallel runtime support is permitted for source changes.",
  ]);
  assert.deepEqual(findBroadDomainParallelClaims("The PR wave contract says domain-parallel source changes are allowed by default.", "synthetic.md"), [
    "synthetic.md:1 [domain-parallel-runtime-support] The PR wave contract says domain-parallel source changes are allowed by default.",
  ]);
  assert.deepEqual(findBroadDomainParallelClaims("The PR wave contract is docs/tests-only unless a shared-seam owner says domain-parallel runtime support is authorized.", "synthetic.md"), [
    "synthetic.md:1 [domain-parallel-runtime-support] The PR wave contract is docs/tests-only unless a shared-seam owner says domain-parallel runtime support is authorized.",
  ]);
  assert.deepEqual(findBroadDomainParallelClaims("The parallel safety layer is docs/tests-only by default and does not authorize runtime source changes.", "synthetic.md"), []);
  assert.deepEqual(findBroadDomainParallelClaims("Domain lanes may proceed in parallel only when each lane has a disjoint-file proof and shared seams must serialize.", "synthetic.md"), []);
  assert.deepEqual(findBroadDomainParallelClaims("The PR wave contract is docs/tests-only; shared seams must serialize behind a named owner and worktree launch needs a separate plan.", "synthetic.md"), []);
});
