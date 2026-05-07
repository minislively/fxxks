// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoots = ["README.md", "docs"];

const forbiddenClientStateConcernClaims = [
  {
    label: "state-correctness-proof",
    pattern: /\b(?:zustand|jotai|redux|react-redux|@reduxjs\/toolkit|client-state)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:state\s+is\s+correct|correct\s+state|state\s+transition\s+is\s+correct)\b/i,
  },
  {
    label: "reducer-store-logic-proof",
    pattern: /\b(?:zustand|jotai|redux|react-redux|@reduxjs\/toolkit|client-state|reducer|store)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:reducer|store)\b[^\n]{0,80}\b(?:works?|is\s+correct|correctness|verified)\b/i,
  },
  {
    label: "global-app-understanding",
    pattern: /\b(?:zustand|jotai|redux|react-redux|@reduxjs\/toolkit|client-state)\b[^\n]{0,100}\b(?:proves?|guarantees?|means|establishes?)\b[^\n]{0,100}\b(?:global\s+app\s+state|entire\s+app\s+state|app-wide\s+state)\b/i,
  },
  {
    label: "authorization-broadening",
    pattern: /\b(?:zustand|jotai|redux|react-redux|@reduxjs\/toolkit|client-state)\b[^\n]{0,100}\b(?:authorizes?|unlocks?|allows?|counts\s+as|proves?)\b[^\n]{0,100}\b(?:compact\s+payload|payload\s+reuse|React\s*Web)\b/i,
  },
];

const boundedClaimBoundary = /\b(?:same-file|claim boundary|does not|do not|not|no|without|cannot|must not|only|metadata|non-authorizing|fail-closed|future|deferred)\b/i;

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

function isBounded(line) {
  return boundedClaimBoundary.test(line);
}

function findForbiddenClientStateConcernClaims(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    for (const rule of forbiddenClientStateConcernClaims) {
      if (rule.pattern.test(normalized) && !isBounded(normalized)) {
        findings.push(`${relativePath}:${index + 1} [${rule.label}] ${normalized}`);
      }
    }
  }

  return findings;
}

test("client-state concern docs stay inside the metadata-only claim boundary", () => {
  const markdownFiles = docsRoots.flatMap(collectMarkdownFiles).sort();
  const findings = markdownFiles.flatMap((file) => {
    const relativePath = path.relative(repoRoot, file);
    return findForbiddenClientStateConcernClaims(fs.readFileSync(file, "utf8"), relativePath);
  });

  assert.deepEqual(findings, [], `forbidden client-state concern claims found:\n${findings.join("\n")}`);
});

test("client-state concern docs explicitly forbid correctness and authorization overreach", () => {
  const contract = fs.readFileSync(path.join(repoRoot, "docs", "frontend-domain-contract.md"), "utf8");
  const architecture = fs.readFileSync(path.join(repoRoot, "docs", "domain-payload-architecture.md"), "utf8");
  const combined = `${contract}\n${architecture}`;

  assert.match(combined, /allowlisted `zustand`, `jotai`, `redux`, `react-redux`, or `@reduxjs\/toolkit` imports/i);
  assert.match(combined, /not\*\* state-correctness proof, reducer\/store-logic proof, global app-state understanding, or compact-payload authorization by itself/i);
  assert.match(combined, /custom reducer\/store modules remain future\/deferred/i);
});

test("client-state concern claim audit rejects broad examples but allows bounded examples", () => {
  assert.deepEqual(
    findForbiddenClientStateConcernClaims("redux proves the reducer works and the global app state is correct.", "synthetic.md"),
    [
      "synthetic.md:1 [state-correctness-proof] redux proves the reducer works and the global app state is correct.",
      "synthetic.md:1 [reducer-store-logic-proof] redux proves the reducer works and the global app state is correct.",
      "synthetic.md:1 [global-app-understanding] redux proves the reducer works and the global app state is correct.",
    ],
  );
  assert.deepEqual(
    findForbiddenClientStateConcernClaims("zustand proves the state is correct and allows compact payload reuse.", "synthetic.md"),
    [
      "synthetic.md:1 [state-correctness-proof] zustand proves the state is correct and allows compact payload reuse.",
      "synthetic.md:1 [authorization-broadening] zustand proves the state is correct and allows compact payload reuse.",
    ],
  );
  assert.deepEqual(
    findForbiddenClientStateConcernClaims(
      "Allowlisted client-state imports are metadata only; they do not prove reducer logic, global app-state understanding, or compact payload authorization.",
      "synthetic.md",
    ),
    [],
  );
});
