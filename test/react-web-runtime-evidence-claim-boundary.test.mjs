// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoots = ["README.md", "docs"];

const forbiddenBroadReactWebRuntimeClaims = [
  {
    label: "universal-react-web-support",
    pattern: /\b(?:supports?|supporting|support for|compatible with)\b[^\n]{0,80}\b(?:all|any|arbitrary|universal|general|full|complete|broad)\b[^\n]{0,80}\b(?:React\s*Web|React\/Web|React\s+apps?|web\s+React|\.tsx|\.jsx)\b/i,
  },
  {
    label: "react-web-stable-runtime-support",
    pattern: /\b(?:React\s*Web|React\/Web|web\s+React)\b[^\n]{0,120}\b(?:(?:stable|GA|general|full|complete|broad|universal)\b[^\n]{0,60}\b(?:runtime\s+support|runtime\s+evidence|payload\s+reuse|payload\s+gate|compact\s+payload|extraction)|(?:runtime\s+support|runtime\s+evidence|payload\s+reuse|payload\s+gate|compact\s+payload|extraction)\b[^\n]{0,60}\b(?:stable|GA|general|full|complete|broad|universal|all|any|arbitrary))\b/i,
  },
  {
    label: "react-web-runtime-evidence-proves-support",
    pattern: /\b(?:React\s*Web|React\/Web|web\s+React)\b[^\n]{0,100}\b(?:runtime\s+evidence|runtime\s+gate|payload\s+gate|payload\s+reuse)\b[^\n]{0,80}\b(?:proves?|guarantees?|unlocks?|establishes?)\b[^\n]{0,80}\b(?:support|compatibility|coverage|runtime-token|latency|billing|cost)\b/i,
  },
  {
    label: "react-web-runtime-savings-proof",
    pattern: /\b(?:React\s*Web|React\/Web|web\s+React)\b[^\n]{0,100}\b(?:runtime-token|runtime token|latency|billing|cost)\b[^\n]{0,80}\b(?:savings?|reduction|win|proof|guarantee)\b/i,
  },
];

const boundedClaimBoundary = /\b(?:measured|same-file|current supported lane only|current supported lane|fixture(?:-backed)?|local synthetic|claim boundary|does not|do not|not|no|without|cannot|must not|only|fallback|deferred|narrow|before any|separate approval|not broad|not stable|not provider|not runtime-token)\b/i;

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

function findBroadReactWebRuntimeClaims(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    for (const rule of forbiddenBroadReactWebRuntimeClaims) {
      if (rule.pattern.test(normalized) && !isBounded(normalized)) {
        findings.push(`${relativePath}:${index + 1} [${rule.label}] ${normalized}`);
      }
    }
  }

  return findings;
}

test("React Web runtime evidence docs stay inside the measured payload-gate boundary", () => {
  const markdownFiles = docsRoots.flatMap(collectMarkdownFiles).sort();
  const findings = markdownFiles.flatMap((file) => {
    const relativePath = path.relative(repoRoot, file);
    return findBroadReactWebRuntimeClaims(fs.readFileSync(file, "utf8"), relativePath);
  });

  assert.deepEqual(findings, [], `forbidden broad React Web runtime claims found:\n${findings.join("\n")}`);
});

test("React Web runtime evidence audit preserves the narrow fixture boundary", () => {
  const fixtureExpectations = fs.readFileSync(path.join(repoRoot, "docs", "frontend-domain-fixture-expectations.md"), "utf8");
  const contract = fs.readFileSync(path.join(repoRoot, "docs", "frontend-domain-contract.md"), "utf8");
  const combined = `${fixtureExpectations}\n${contract}`;

  assert.match(combined, /F11` and `F12` are selected React Web runtime-gate fixtures/);
  assert.match(combined, /prove the current supported lane handles custom JSX components with web-specific attributes before any RN\/WebView\/TUI lane is promoted/);
  assert.match(combined, /React Web evidence is used to imply RN, WebView, TUI, Mixed, or Unknown support/);
});

test("React Web runtime evidence audit rejects broad examples but allows scoped examples", () => {
  assert.deepEqual(
    findBroadReactWebRuntimeClaims("React Web runtime evidence proves support for arbitrary React apps.", "synthetic.md"),
    [
      "synthetic.md:1 [universal-react-web-support] React Web runtime evidence proves support for arbitrary React apps.",
      "synthetic.md:1 [react-web-stable-runtime-support] React Web runtime evidence proves support for arbitrary React apps.",
      "synthetic.md:1 [react-web-runtime-evidence-proves-support] React Web runtime evidence proves support for arbitrary React apps.",
    ],
  );
  assert.deepEqual(
    findBroadReactWebRuntimeClaims("fooks has stable React/Web runtime support for all TSX files.", "synthetic.md"),
    ["synthetic.md:1 [react-web-stable-runtime-support] fooks has stable React/Web runtime support for all TSX files."],
  );
  assert.deepEqual(
    findBroadReactWebRuntimeClaims("React Web payload gate proves runtime-token savings for web React apps.", "synthetic.md"),
    [
      "synthetic.md:1 [react-web-runtime-evidence-proves-support] React Web payload gate proves runtime-token savings for web React apps.",
      "synthetic.md:1 [react-web-runtime-savings-proof] React Web payload gate proves runtime-token savings for web React apps.",
    ],
  );
  assert.deepEqual(
    findBroadReactWebRuntimeClaims("F11/F12 are measured same-file React Web runtime-gate fixtures only; this is not stable runtime-token proof.", "synthetic.md"),
    [],
  );
});
